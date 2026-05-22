from pathlib import Path
import sys

import pandas as pd
import streamlit as st


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
WEB = ROOT / "web"
for _p in (str(SRC), str(WEB)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from backtest import load_prices, load_weights, run_backtest, summarize_backtest, benchmark_nav  # noqa: E402
from metrics import monthly_returns  # noqa: E402
from rules import check_individual_etf_limit, check_risk_asset_limit  # noqa: E402
from components import (  # noqa: E402
    render_kpi_strip,
    render_nav_chart,
    render_drawdown_chart,
    render_monthly_returns_chart,
)


ETF_MASTER_PATH = ROOT / "data" / "etf_master.csv"
PRICES_PATH = ROOT / "data" / "prices_daily.csv"
BASE_PORTFOLIO_PATH = ROOT / "portfolios" / "base.csv"
PORTFOLIOS_DIR = ROOT / "portfolios"
BENCHMARK_CODE = "069500"
_PROTECTED_NAMES = {"base", "conservative", "aggressive"}
MAX_ETF_SELECTIONS = 10
PERIOD_YEARS: dict[str, int | None] = {"1년": 1, "3년": 3, "5년": 5, "전체": None}


@st.cache_data
def load_etf_master() -> pd.DataFrame:
    etfs = pd.read_csv(ETF_MASTER_PATH, dtype={"code": str})
    required = {"code", "name", "asset_class", "risk_type"}
    missing = required - set(etfs.columns)
    if missing:
        raise ValueError(f"ETF master missing columns: {sorted(missing)}")
    etfs["label"] = etfs["name"] + " (" + etfs["code"] + ")"
    return etfs.sort_values(["asset_class", "name", "code"]).reset_index(drop=True)


@st.cache_data
def load_price_range() -> tuple[str, str]:
    prices = pd.read_csv(PRICES_PATH, usecols=["date"])
    dates = pd.to_datetime(prices["date"], errors="coerce").dropna()
    if dates.empty:
        return "N/A", "N/A"
    return dates.min().strftime("%Y-%m-%d"), dates.max().strftime("%Y-%m-%d")


@st.cache_data(ttl=600)
def load_all_prices() -> pd.DataFrame:
    return load_prices(PRICES_PATH)


@st.cache_data
def load_base_weights() -> dict[str, float]:
    if not BASE_PORTFOLIO_PATH.exists():
        return {}
    weights = load_weights(BASE_PORTFOLIO_PATH)
    return {code: float(weight * 100) for code, weight in weights.items()}


def _slice_prices(prices: pd.DataFrame, period: str) -> pd.DataFrame:
    years = PERIOD_YEARS.get(period)
    if years is None:
        return prices
    max_date = prices["date"].max()
    cutoff = max_date - pd.DateOffset(years=years)
    return prices[prices["date"] >= cutoff].reset_index(drop=True)


def _execute_backtest(
    prices_all: pd.DataFrame,
    selected_codes: list[str],
    weights: dict[str, float],
    period: str,
) -> tuple[pd.DataFrame, dict, pd.DataFrame]:
    prices = _slice_prices(prices_all, period)
    weight_series = pd.Series({code: weights[code] / 100.0 for code in selected_codes})
    weight_series = weight_series / weight_series.sum()
    bt_result = run_backtest(prices, weight_series)

    bm_series: pd.Series | None = None
    try:
        bm_series = benchmark_nav(prices, BENCHMARK_CODE)
        bm_aligned = bm_series.reindex(pd.to_datetime(bt_result["date"]))
        bt_result = bt_result.copy()
        bt_result["benchmark_value"] = bm_aligned.values
    except Exception:
        pass

    summary = summarize_backtest(bt_result, benchmark=bm_series)
    monthly = monthly_returns(bt_result)
    return bt_result, summary, monthly


def _render_rules_check(
    selected_codes: list[str],
    weights: dict[str, float],
    etfs: pd.DataFrame,
) -> None:
    portfolio = etfs[etfs["code"].isin(selected_codes)][["code", "name", "risk_type"]].copy()
    portfolio["weight"] = portfolio["code"].map(
        {code: weights[code] / 100.0 for code in selected_codes}
    )
    portfolio = portfolio.dropna(subset=["weight"])

    individual = check_individual_etf_limit(portfolio, limit=0.20, weight_col="weight")
    violations = individual[~individual["passed"]]
    if violations.empty:
        st.success("개별 ETF 20% 상한: 모두 통과")
    else:
        for _, row in violations.iterrows():
            st.warning(f"개별 ETF 20% 초과 — {row['name']} ({row['code']}): {row['weight']:.1%}")

    risk = check_risk_asset_limit(portfolio, limit=0.70, weight_col="weight")
    risky_pct = risk["risky_weight"]
    if risk["passed"]:
        st.success(f"위험자산 비중: {risky_pct:.1%} — 70% 상한 통과")
    else:
        st.warning(f"위험자산 비중: {risky_pct:.1%} — 70% 상한 초과")


def render_status_bar(start_date: str, end_date: str, etf_count: int) -> None:
    st.markdown(
        f"""
        <div class="builder-status">
            <span>가격 데이터: {start_date} ~ {end_date}</span>
            <span>ETF 마스터: {etf_count:,}개</span>
            <span>계산 상태: 입력 대기</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def inject_builder_style() -> None:
    st.markdown(
        """
        <style>
        .builder-status {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 16px;
            align-items: center;
            margin: 4px 0 18px;
            padding: 10px 12px;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            background: #F6F9FC;
            color: #64748B;
            font-size: 0.86rem;
        }
        .builder-section-title {
            margin: 18px 0 8px;
            color: #0D253D;
            font-size: 1rem;
            font-weight: 650;
        }
        .weight-total {
            margin: 4px 0 8px;
            color: #0D253D;
            font-variant-numeric: tabular-nums;
            font-weight: 650;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def main() -> None:
    inject_builder_style()

    st.title("포트폴리오 빌더")

    etfs = load_etf_master()
    price_start, price_end = load_price_range()
    base_weights = load_base_weights()
    label_to_code = dict(zip(etfs["label"], etfs["code"], strict=True))
    code_to_label = dict(zip(etfs["code"], etfs["label"], strict=True))
    default_labels = [
        code_to_label[code] for code in base_weights if code in code_to_label
    ][:MAX_ETF_SELECTIONS]

    render_status_bar(price_start, price_end, len(etfs))

    st.markdown('<div class="builder-section-title">ETF 선택</div>', unsafe_allow_html=True)
    selected_labels = st.multiselect(
        "ETF명(코드)",
        options=etfs["label"].tolist(),
        default=default_labels,
        max_selections=MAX_ETF_SELECTIONS,
        placeholder="최대 10개 ETF 선택",
    )

    selected_codes = [label_to_code[label] for label in selected_labels]

    period = st.selectbox(
        "기간",
        options=["1년", "3년", "5년", "전체"],
        index=1,
    )

    st.markdown('<div class="builder-section-title">비중 입력</div>', unsafe_allow_html=True)
    weights: dict[str, float] = {}
    if not selected_codes:
        st.caption("ETF를 선택하면 비중 입력란이 표시됩니다.")
    else:
        for code in selected_codes:
            row = etfs.loc[etfs["code"] == code].iloc[0]
            label = f"{row['name']} ({code})"
            weights[code] = st.number_input(
                label,
                min_value=0.0,
                max_value=100.0,
                value=round(base_weights.get(code, 0.0), 1),
                step=0.1,
                format="%.1f",
                key=f"weight_{code}",
            )

    total_weight = round(sum(weights.values()), 1)
    is_ready = bool(selected_codes) and abs(total_weight - 100.0) < 0.05

    st.markdown(
        f'<div class="weight-total">현재 합계: {total_weight:.1f}% / 100%</div>',
        unsafe_allow_html=True,
    )
    if selected_codes and not is_ready:
        st.warning("비중 합계가 100.0%가 되도록 조정해야 백테스트를 실행할 수 있습니다.")

    run_clicked = st.button("백테스트 실행", disabled=not is_ready)

    with st.expander("입력 요약", expanded=False):
        if selected_codes:
            summary_table = pd.DataFrame(
                {
                    "code": selected_codes,
                    "name": [etfs.loc[etfs["code"] == code, "name"].iloc[0] for code in selected_codes],
                    "weight": [weights[code] for code in selected_codes],
                    "period": period,
                }
            )
            st.dataframe(summary_table, use_container_width=True, hide_index=True)
        else:
            st.write("선택된 ETF가 없습니다.")

    if run_clicked:
        try:
            prices_all = load_all_prices()
            bt_result, bt_summary, bt_monthly = _execute_backtest(
                prices_all, selected_codes, weights, period
            )
            st.session_state["bt_result"] = bt_result
            st.session_state["bt_summary"] = bt_summary
            st.session_state["bt_monthly"] = bt_monthly
            st.session_state["bt_inputs"] = {
                "codes": selected_codes,
                "weights": weights.copy(),
                "period": period,
            }
        except Exception as exc:
            st.error(f"백테스트 실행 실패: {exc}")
            for key in ("bt_result", "bt_summary", "bt_monthly", "bt_inputs"):
                st.session_state.pop(key, None)

    if "bt_result" in st.session_state:
        bt_result = st.session_state["bt_result"]
        bt_summary = st.session_state["bt_summary"]
        bt_monthly = st.session_state["bt_monthly"]
        bt_inputs = st.session_state["bt_inputs"]

        st.divider()
        st.markdown(
            f'<div class="builder-section-title">백테스트 결과 — {bt_inputs["period"]}</div>',
            unsafe_allow_html=True,
        )

        render_kpi_strip(pd.DataFrame([bt_summary]))

        st.markdown('<div class="builder-section-title">규칙 체크</div>', unsafe_allow_html=True)
        _render_rules_check(bt_inputs["codes"], bt_inputs["weights"], etfs)

        col_nav, col_dd = st.columns(2)
        with col_nav:
            st.markdown("**NAV**")
            st.plotly_chart(render_nav_chart(bt_result), use_container_width=True)
        with col_dd:
            st.markdown("**Drawdown**")
            st.plotly_chart(render_drawdown_chart(bt_result), use_container_width=True)

        st.markdown('<div class="builder-section-title">월별 수익률</div>', unsafe_allow_html=True)
        st.plotly_chart(render_monthly_returns_chart(bt_monthly), use_container_width=True)

        st.divider()
        st.markdown('<div class="builder-section-title">포트폴리오 저장</div>', unsafe_allow_html=True)
        save_name = st.text_input("포트폴리오 이름", placeholder="예: my_portfolio", key="save_name")
        clean_save_name = save_name.strip()
        is_protected = bool(clean_save_name) and clean_save_name.lower() in _PROTECTED_NAMES
        overwrite_confirmed = False
        if is_protected:
            st.warning(f"'{clean_save_name}'은 기본 포트폴리오 이름입니다. 저장하면 기존 데이터가 덮어쓰여집니다.")
            overwrite_confirmed = st.checkbox("덮어쓰기를 확인합니다", key="overwrite_confirm")
        save_disabled = not clean_save_name or (is_protected and not overwrite_confirmed)
        if st.button("이 포트폴리오 저장", disabled=save_disabled, key="save_btn"):
            save_df = pd.DataFrame({
                "code": bt_inputs["codes"],
                "weight": [bt_inputs["weights"][c] / 100.0 for c in bt_inputs["codes"]],
            })
            save_df.to_csv(PORTFOLIOS_DIR / f"{clean_save_name}.csv", index=False)
            st.success(f"portfolios/{clean_save_name}.csv 에 저장되었습니다.")


if __name__ == "__main__":
    main()
