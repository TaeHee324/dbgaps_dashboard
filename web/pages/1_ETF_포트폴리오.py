"""ETF & 포트폴리오 통합 탭.

Architecture exception: imports src/backtest.py, src/metrics.py, src/rules.py
for real-time backtest. pykrx and network requests are forbidden.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backtest import load_prices as bt_load_prices, run_backtest, summarize_backtest, benchmark_nav  # noqa: E402
from metrics import monthly_returns  # noqa: E402
from rules import check_individual_etf_limit, check_risk_asset_limit  # noqa: E402

PRICES_PATH = ROOT / "data" / "prices_daily.csv"
ETF_MASTER_PATH = ROOT / "data" / "etf_master.csv"
PORTFOLIOS_DIR = ROOT / "portfolios"
BENCHMARK_CODE = "069500"
_PROTECTED_NAMES = {"base", "conservative", "aggressive"}

_PERIOD_OFFSET = {
    "1M": pd.DateOffset(months=1),
    "3M": pd.DateOffset(months=3),
    "6M": pd.DateOffset(months=6),
    "1Y": pd.DateOffset(years=1),
}


# ── data loaders ──────────────────────────────────────────────────────────────

@st.cache_data(ttl=600)
def _load_prices_raw() -> pd.DataFrame:
    if not PRICES_PATH.exists():
        return pd.DataFrame(columns=["date", "code", "close"])
    df = pd.read_csv(PRICES_PATH, dtype={"code": "string"}, parse_dates=["date"])
    df["code"] = df["code"].str.zfill(6)
    return df


@st.cache_data(ttl=600)
def _load_prices_for_backtest() -> pd.DataFrame:
    return bt_load_prices(PRICES_PATH)


@st.cache_data
def _load_etf_master() -> pd.DataFrame:
    if not ETF_MASTER_PATH.exists():
        return pd.DataFrame(columns=["code", "name"])
    df = pd.read_csv(ETF_MASTER_PATH, dtype={"code": "string"})
    df["code"] = df["code"].str.zfill(6)
    return df


def _etf_code_list(prices: pd.DataFrame, master: pd.DataFrame) -> pd.DataFrame:
    """Return DataFrame[code, name] sorted by code."""
    codes = prices["code"].dropna().unique()
    df = pd.DataFrame({"code": codes})
    if not master.empty and "name" in master.columns:
        df = df.merge(master[["code", "name"]], on="code", how="left")
    else:
        df["name"] = pd.NA
    return df.sort_values("code").reset_index(drop=True)


# ── helpers ───────────────────────────────────────────────────────────────────

def _price_chart(
    prices: pd.DataFrame, code: str, name: str, period: str
) -> tuple[go.Figure, pd.DataFrame] | go.Figure:
    etf_prices = prices[prices["code"] == code].sort_values("date")
    if etf_prices.empty:
        return go.Figure()

    if period == "전체":
        chart_df = etf_prices
    else:
        max_date = etf_prices["date"].max()
        chart_df = etf_prices[etf_prices["date"] >= max_date - _PERIOD_OFFSET[period]]

    if chart_df.empty:
        return go.Figure()

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=chart_df["date"],
        y=chart_df["close"],
        mode="lines",
        name=name if name else code,
        line=dict(color="#2563EB", width=2),
    ))
    fig.update_layout(
        title=f"{name} ({code})" if name else code,
        xaxis_title="",
        yaxis_title="종가 (원)",
        margin=dict(l=0, r=0, t=40, b=0),
        plot_bgcolor="#F8FAFC",
        paper_bgcolor="#FFFFFF",
        yaxis=dict(tickformat=","),
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
    )
    return fig, chart_df


def _run_backtest(codes: list[str], raw_weights: dict[str, float], period_years: int | None):
    prices_all = _load_prices_for_backtest()

    if period_years is not None:
        max_date = prices_all["date"].max()
        cutoff = max_date - pd.DateOffset(years=period_years)
        prices = prices_all[prices_all["date"] >= cutoff].reset_index(drop=True)
    else:
        prices = prices_all

    weight_series = pd.Series({c: raw_weights[c] for c in codes})
    weight_series = weight_series / weight_series.sum()

    bt_result = run_backtest(prices, weight_series)

    bm_series = None
    try:
        bm_series = benchmark_nav(prices, BENCHMARK_CODE)
        bt_result = bt_result.copy()
        bt_result["benchmark_value"] = bm_series.reindex(
            pd.to_datetime(bt_result["date"])
        ).values
    except Exception:
        pass

    summary = summarize_backtest(bt_result, benchmark=bm_series)
    monthly = monthly_returns(bt_result)
    return bt_result, summary, monthly


def _render_rules(codes: list[str], weights: dict[str, float], master: pd.DataFrame) -> None:
    portfolio = pd.DataFrame({"code": codes})
    if not master.empty and "name" in master.columns and "risk_type" in master.columns:
        portfolio = portfolio.merge(master[["code", "name", "risk_type"]], on="code", how="left")
    else:
        portfolio["name"] = portfolio["code"]
        portfolio["risk_type"] = pd.NA
    portfolio["weight"] = portfolio["code"].map(weights)

    individual = check_individual_etf_limit(portfolio, limit=0.20, weight_col="weight")
    violations = individual[~individual["passed"]]
    if violations.empty:
        st.success("개별 ETF 20% 상한: 모두 통과")
    else:
        for _, row in violations.iterrows():
            nm = row.get("name", row["code"])
            st.warning(f"개별 ETF 20% 초과 — {nm} ({row['code']}): {row['weight']:.1%}")

    risk = check_risk_asset_limit(portfolio, limit=0.70, weight_col="weight")
    risky_pct = risk["risky_weight"]
    if risk["passed"]:
        st.success(f"위험자산 비중: {risky_pct:.1%} — 70% 상한 통과")
    else:
        st.warning(f"위험자산 비중: {risky_pct:.1%} — 70% 상한 초과")


def _nav_chart(bt_result: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=bt_result["date"],
        y=bt_result["portfolio_value"],
        mode="lines",
        name="포트폴리오",
        line=dict(color="#2563EB", width=2),
    ))
    if "benchmark_value" in bt_result.columns:
        fig.add_trace(go.Scatter(
            x=bt_result["date"],
            y=bt_result["benchmark_value"],
            mode="lines",
            name=f"벤치마크 ({BENCHMARK_CODE})",
            line=dict(color="#94A3B8", width=1.5, dash="dot"),
        ))
    fig.update_layout(
        title="NAV",
        xaxis_title="",
        yaxis_title="원",
        margin=dict(l=0, r=0, t=40, b=0),
        plot_bgcolor="#F8FAFC",
        paper_bgcolor="#FFFFFF",
        yaxis=dict(tickformat=","),
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
    )
    return fig


# ── page ──────────────────────────────────────────────────────────────────────

st.set_page_config(layout="wide")
st.title("ETF & 포트폴리오")

prices_raw = _load_prices_raw()
master = _load_etf_master()
etf_list = _etf_code_list(prices_raw, master)

if prices_raw.empty:
    st.error("data/prices_daily.csv 없음 — src/update_prices.py 를 실행하세요.")
    st.stop()

price_max = prices_raw["date"].max()
st.caption(f"가격 데이터 기준: {price_max.strftime('%Y-%m-%d')} | {len(etf_list):,}개 종목")

left, right = st.columns([4, 6])

# ── 왼쪽 패널 ─────────────────────────────────────────────────────────────────
with left:
    st.subheader("ETF 탐색")

    search = st.text_input("코드 또는 ETF명 검색", placeholder="예: 069500, 나스닥")

    filtered = etf_list.copy()
    if search.strip():
        q = search.strip()
        mask = filtered["code"].str.contains(q, case=False, na=False)
        if "name" in filtered.columns:
            mask = mask | filtered["name"].fillna("").str.contains(q, case=False, na=False)
        filtered = filtered[mask].reset_index(drop=True)

    display_df = filtered[["code", "name"]].rename(columns={"code": "코드", "name": "ETF명"})

    table_event = st.dataframe(
        display_df,
        column_config={
            "코드": st.column_config.TextColumn("코드"),
            "ETF명": st.column_config.TextColumn("ETF명"),
        },
        hide_index=True,
        use_container_width=True,
        on_select="rerun",
        selection_mode="single-row",
        height=320,
    )

    selected_rows = table_event.selection.rows if table_event.selection else []
    if selected_rows:
        sel_row = filtered.iloc[selected_rows[0]]
        st.session_state["chart_code"] = sel_row["code"]
        st.session_state["chart_name"] = sel_row.get("name", sel_row["code"]) or sel_row["code"]

    chart_code: str | None = st.session_state.get("chart_code")
    chart_name: str = st.session_state.get("chart_name", chart_code or "")

    st.divider()
    st.subheader("포트폴리오 구성")

    if "portfolio_rows" not in st.session_state:
        st.session_state["portfolio_rows"] = [{"code": "", "weight": 0.0}]

    rows: list[dict] = st.session_state["portfolio_rows"]

    updated_rows = []
    for i, row in enumerate(rows):
        c1, c2, c3 = st.columns([3, 2, 1])
        with c1:
            code_val = st.text_input(
                "ETF 코드",
                value=row["code"],
                key=f"row_code_{i}",
                placeholder="예: 069500",
                label_visibility="collapsed",
            )
        with c2:
            wt_val = st.number_input(
                "비중",
                value=float(row["weight"]),
                min_value=0.0,
                max_value=1.0,
                step=0.01,
                format="%.2f",
                key=f"row_weight_{i}",
                label_visibility="collapsed",
            )
        with c3:
            if st.button("✕", key=f"del_{i}", help="행 삭제") and len(rows) > 1:
                continue
        updated_rows.append({"code": code_val.strip().zfill(6) if code_val.strip() else "", "weight": wt_val})

    st.session_state["portfolio_rows"] = updated_rows

    if st.button("+ 행 추가"):
        st.session_state["portfolio_rows"].append({"code": "", "weight": 0.0})
        st.rerun()

    if chart_code and st.button("선택 ETF 추가"):
        st.session_state["portfolio_rows"].append({"code": chart_code, "weight": 0.0})
        st.rerun()

    valid_rows = [r for r in updated_rows if r["code"]]
    total_weight = round(sum(r["weight"] for r in valid_rows), 4)
    st.caption(f"비중 합계: **{total_weight:.2f}** / 1.00")
    if valid_rows and total_weight > 1.0:
        st.warning("비중 합계가 1.0을 초과합니다.")

# ── 오른쪽 패널 ───────────────────────────────────────────────────────────────
with right:
    # 주가 차트
    st.subheader("주가 차트")
    period_toggle = st.radio(
        "기간",
        options=["1M", "3M", "6M", "1Y", "전체"],
        index=3,
        horizontal=True,
        key="chart_period",
    )

    if chart_code:
        result = _price_chart(prices_raw, chart_code, chart_name, period_toggle)
        if isinstance(result, tuple):
            fig_price, chart_df = result
            st.plotly_chart(fig_price, use_container_width=True)

            cp = int(chart_df["close"].iloc[-1])
            sp = int(chart_df["close"].iloc[0])
            pr = (cp - sp) / sp
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("기간 수익률", f"{pr:+.2%}")
            m2.metric("현재가", f"{cp:,}원")
            m3.metric("기간 최고가", f"{int(chart_df['close'].max()):,}원")
            m4.metric("기간 최저가", f"{int(chart_df['close'].min()):,}원")
        else:
            st.warning(f"{chart_code}: 선택 기간에 데이터 없음")
    else:
        st.info("왼쪽 테이블에서 ETF를 선택하면 주가 차트가 표시됩니다.")

    st.divider()

    # 백테스트
    st.subheader("백테스트")
    bt_period = st.selectbox("백테스트 기간", ["1년", "3년", "5년", "전체"], index=1)
    _PERIOD_YEARS = {"1년": 1, "3년": 3, "5년": 5, "전체": None}

    run_ready = bool(valid_rows) and abs(total_weight - 1.0) < 0.01
    if not run_ready and valid_rows:
        st.caption("비중 합계가 1.0 ± 0.01이 되면 백테스트를 실행할 수 있습니다.")

    if st.button("백테스트 실행", disabled=not run_ready):
        codes = [r["code"] for r in valid_rows]
        weights = {r["code"]: r["weight"] for r in valid_rows}
        try:
            bt_result, bt_summary, bt_monthly = _run_backtest(
                codes, weights, _PERIOD_YEARS[bt_period]
            )
            st.session_state["bt_result"] = bt_result
            st.session_state["bt_summary"] = bt_summary
            st.session_state["bt_inputs"] = {"codes": codes, "weights": weights, "period": bt_period}
        except Exception as exc:
            st.error(f"백테스트 실패: {exc}")
            for k in ("bt_result", "bt_summary", "bt_inputs"):
                st.session_state.pop(k, None)

    if "bt_result" in st.session_state:
        bt_result = st.session_state["bt_result"]
        bt_summary = st.session_state["bt_summary"]
        bt_inputs = st.session_state["bt_inputs"]

        s = bt_summary
        kpi_cols = st.columns(7)
        kpi_data = [
            ("누적수익률", s.get("cumulative_return"), ".1%"),
            ("CAGR", s.get("cagr"), ".1%"),
            ("MDD", s.get("mdd"), ".1%"),
            ("샤프", s.get("sharpe"), ".2f"),
            ("칼마", s.get("calmar"), ".2f"),
            ("알파", s.get("alpha"), ".2f"),
            ("베타", s.get("beta"), ".2f"),
        ]
        for col, (label, val, fmt) in zip(kpi_cols, kpi_data):
            if val is None:
                col.metric(label, "N/A")
            else:
                col.metric(label, format(val, fmt))

        st.markdown("**규칙 체크**")
        _render_rules(bt_inputs["codes"], bt_inputs["weights"], master)

        st.plotly_chart(_nav_chart(bt_result), use_container_width=True)

        st.divider()
        st.subheader("포트폴리오 저장")
        save_name = st.text_input("이름", placeholder="예: my_portfolio", key="save_name")
        clean = save_name.strip()
        is_protected = bool(clean) and clean.lower() in _PROTECTED_NAMES
        overwrite_ok = False
        if is_protected:
            st.warning(f"'{clean}'은 기본 포트폴리오입니다. 덮어쓰기됩니다.")
            overwrite_ok = st.checkbox("덮어쓰기 확인", key="overwrite_confirm")
        save_disabled = not clean or (is_protected and not overwrite_ok)
        if st.button("저장", disabled=save_disabled, key="save_btn"):
            PORTFOLIOS_DIR.mkdir(exist_ok=True)
            pd.DataFrame({
                "code": bt_inputs["codes"],
                "weight": [bt_inputs["weights"][c] for c in bt_inputs["codes"]],
            }).to_csv(PORTFOLIOS_DIR / f"{clean}.csv", index=False)
            st.success(f"portfolios/{clean}.csv 저장 완료")
