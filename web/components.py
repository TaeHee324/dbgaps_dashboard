import pandas as pd
import plotly.graph_objects as go
import streamlit as st

_DANGER = "#DC2626"
_SUCCESS = "#16A34A"
_WARNING = "#D97706"


def render_status_bar(data_date: str):
    st.info(f"데이터 기준일: {data_date}")


def render_kpi_strip(summary_df: pd.DataFrame):
    if summary_df.empty:
        st.warning("계산 데이터 없음")
        return

    row = summary_df.iloc[0]
    cols = st.columns(5)

    def _get(key, default=None):
        return row[key] if key in summary_df.columns else default

    with cols[0]:
        val = _get("cumulative_return")
        st.metric("누적수익률", f"{val*100:.2f}%" if val is not None else "—")
    with cols[1]:
        val = _get("cagr")
        st.metric("CAGR", f"{val*100:.2f}%" if val is not None else "—")
    with cols[2]:
        val = _get("mdd")
        st.metric("MDD", f"{val*100:.2f}%" if val is not None else "—")
    with cols[3]:
        val = _get("sharpe")
        st.metric("샤프지수", f"{val:.2f}" if val is not None else "—")
    with cols[4]:
        val = _get("annual_volatility")
        st.metric("연간변동성", f"{val*100:.2f}%" if val is not None else "—")


def render_nav_chart(backtest_df: pd.DataFrame) -> go.Figure:
    if backtest_df.empty or "portfolio_value" not in backtest_df.columns:
        st.warning("NAV 데이터 없음")
        return go.Figure()

    df = backtest_df.copy()
    base = df["portfolio_value"].iloc[0]
    nav = df["portfolio_value"] / base * 100

    x = df["date"] if "date" in df.columns else df.index
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=x, y=nav,
        mode="lines",
        name="포트폴리오",
        line=dict(color="#2563EB", width=2),
    ))

    if "benchmark_value" in df.columns:
        bm_base = df["benchmark_value"].iloc[0]
        bm_nav = df["benchmark_value"] / bm_base * 100
        fig.add_trace(go.Scatter(
            x=x, y=bm_nav,
            mode="lines",
            name="벤치마크(069500)",
            line=dict(color="#64748B", width=1.5, dash="dash"),
        ))

    fig.update_layout(
        yaxis_title="NAV (기준 100)",
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
        margin=dict(l=0, r=0, t=32, b=0),
        plot_bgcolor="#F8FAFC",
        paper_bgcolor="#FFFFFF",
    )
    return fig


def render_drawdown_chart(backtest_df: pd.DataFrame) -> go.Figure:
    if backtest_df.empty or "portfolio_value" not in backtest_df.columns:
        st.warning("Drawdown 데이터 없음")
        return go.Figure()

    df = backtest_df.copy()
    x = df["date"] if "date" in df.columns else df.index
    rolling_max = df["portfolio_value"].cummax()
    drawdown = (df["portfolio_value"] - rolling_max) / rolling_max * 100

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=x,
        y=drawdown,
        mode="lines",
        fill="tozeroy",
        fillcolor="rgba(220,38,38,0.15)",
        line=dict(color=_DANGER, width=1.5),
        name="Drawdown",
    ))
    fig.update_layout(
        yaxis_title="Drawdown (%)",
        margin=dict(l=0, r=0, t=32, b=0),
        plot_bgcolor="#F8FAFC",
        paper_bgcolor="#FFFFFF",
    )
    return fig


def render_rule_badges(rule_dict: dict):
    if not rule_dict:
        st.warning("규칙 데이터 없음")
        return

    individual = rule_dict.get("rule_individual_etf")
    risk = rule_dict.get("rule_risk_asset")

    if individual is not None and not individual.empty:
        all_ok = individual["passed"].all() if "passed" in individual.columns else False
        if all_ok:
            st.success("개별 ETF 20% 상한: 통과")
        else:
            st.error("개별 ETF 20% 상한: 위반")
    else:
        st.warning("개별 ETF 20% 상한: 데이터 없음")

    if risk is not None and not risk.empty:
        ok = bool(risk.iloc[0]["passed"]) if "passed" in risk.columns else False
        risky_w = risk.iloc[0].get("risky_weight", None)
        suffix = f" (현재 {risky_w:.1%})" if risky_w is not None else ""
        if ok:
            st.success(f"위험자산 70% 상한: 통과{suffix}")
        else:
            st.error(f"위험자산 70% 상한: 위반{suffix}")
    else:
        st.warning("위험자산 70% 상한: 데이터 없음")


_HOLDINGS_RENAME = {
    "code": "코드",
    "name": "ETF명",
    "quantity": "수량",
    "avg_price": "평균단가",
    "cost_basis": "매입금액",
    "price_date": "기준일",
    "current_price": "현재가",
    "market_value": "평가금액",
    "unrealized_pnl": "평가손익",
    "unrealized_return": "수익률(%)",
    "current_weight": "비중(%)",
    "risk_type": "위험구분",
    "asset_class": "자산군",
}


def render_holdings_table(holdings_df: pd.DataFrame):
    if holdings_df.empty:
        st.info("보유 종목 없음")
        return

    df = holdings_df.copy()

    for col in ("current_weight", "unrealized_return"):
        if col in df.columns:
            df[col] = df[col] * 100

    df = df.rename(columns={k: v for k, v in _HOLDINGS_RENAME.items() if k in df.columns})

    st.dataframe(
        df,
        column_config={
            "비중(%)": st.column_config.NumberColumn("비중(%)", format="%.1f%%"),
            "수익률(%)": st.column_config.NumberColumn("수익률(%)", format="%.2f%%"),
            "평가금액": st.column_config.NumberColumn("평가금액", format="%,.0f"),
            "매입금액": st.column_config.NumberColumn("매입금액", format="%,.0f"),
            "평가손익": st.column_config.NumberColumn("평가손익", format="%,.0f"),
            "평균단가": st.column_config.NumberColumn("평균단가", format="%,.0f"),
            "현재가": st.column_config.NumberColumn("현재가", format="%,.0f"),
            "수량": st.column_config.NumberColumn("수량", format="%,.0f"),
        },
        hide_index=True,
    )
