import pandas as pd
import plotly.graph_objects as go
import streamlit as st

_DANGER = "#DC2626"
_SUCCESS = "#16A34A"
_WARNING = "#D97706"
_PRIMARY = "#533AFD"
_INK_SECONDARY = "#64748B"


def render_status_bar(data_date: str):
    st.info(f"데이터 기준일: {data_date}")


def render_kpi_strip(summary_df: pd.DataFrame):
    if summary_df.empty:
        st.warning("계산 데이터 없음")
        return

    row = summary_df.iloc[0]
    cols = st.columns(7)

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
    with cols[5]:
        val = _get("alpha")
        st.metric("Alpha", f"{val*100:.2f}%" if val is not None else "—")
    with cols[6]:
        val = _get("beta")
        st.metric("Beta", f"{val:.2f}" if val is not None else "—")


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
    elif "benchmark_cumulative_return" in df.columns:
        bm_nav = (1 + df["benchmark_cumulative_return"]) * 100
        fig.add_trace(go.Scatter(
            x=x, y=bm_nav,
            mode="lines",
            name="Benchmark",
            line=dict(color="#64748B", width=1.5, dash="dash"),
        ))
    else:
        # 벤치마크 데이터 없음
        pass

    fig.update_layout(
        yaxis_title="NAV (기준 100)",
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
        margin=dict(l=0, r=0, t=32, b=0),
        plot_bgcolor="#F8FAFC",
        paper_bgcolor="#FFFFFF",
    )
    return fig

def _is_passed(value) -> bool:
    if isinstance(value, str):
        return value.strip().lower() == "true"
    return bool(value)


def _format_percent(value) -> str:
    return f"{float(value) * 100:.1f}%"


def _render_pass_badge(passed: bool):
    color = _SUCCESS if passed else _DANGER
    label = "passed" if passed else "failed"
    st.markdown(
        f"<span style='display:inline-block;padding:0.2rem 0.55rem;"
        f"border-radius:999px;background:{color};color:white;"
        f"font-size:0.8rem;font-weight:700'>{label}</span>",
        unsafe_allow_html=True,
    )


def render_turnover_section(turnover_dict: dict):
    st.subheader("회전율")

    if not turnover_dict:
        st.warning("회전율 데이터 없음")
        return

    items = [
        ("초기 누적 회전율", turnover_dict.get("initial")),
        ("주간 회전율 최근값", turnover_dict.get("weekly")),
        ("월간 회전율 최근값", turnover_dict.get("monthly")),
    ]

    cols = st.columns(3)
    for col, (label, df) in zip(cols, items):
        with col:
            if df is None or df.empty or "turnover" not in df.columns:
                st.metric(label, "N/A")
                _render_pass_badge(False)
                continue

            row = df.iloc[-1]
            st.metric(label, _format_percent(row["turnover"]))
            _render_pass_badge(_is_passed(row.get("passed", False)))


def render_monthly_returns_chart(monthly_df: pd.DataFrame) -> go.Figure:
    if monthly_df.empty or "monthly_return" not in monthly_df.columns:
        st.warning("월별 수익률 데이터 없음")
        return go.Figure()

    df = monthly_df.copy()
    if {"year", "month"}.issubset(df.columns):
        x = df.apply(lambda row: f"{int(row['year']):04d}-{int(row['month']):02d}", axis=1)
    else:
        x = df.index.astype(str)

    returns = df["monthly_return"] * 100
    colors = ["#2563EB" if value >= 0 else _DANGER for value in returns]

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=x,
        y=returns,
        marker_color=colors,
        name="Monthly Return",
    ))
    fig.update_layout(
        title="월별 수익률",
        yaxis_title="수익률 (%)",
        xaxis_title="",
        margin=dict(l=0, r=0, t=40, b=0),
        plot_bgcolor="#F8FAFC",
        paper_bgcolor="#FFFFFF",
        showlegend=False,
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


def render_comparison_table(summary_df: pd.DataFrame):
    if summary_df.empty:
        return

    df = summary_df.copy()
    for column in ["cagr", "mdd"]:
        if column in df.columns:
            df[column] = df[column] * 100

    rename = {
        "portfolio_name": "포트폴리오",
        "cagr": "CAGR",
        "mdd": "MDD",
        "sharpe": "샤프",
        "calmar": "칼마",
    }
    df = df.rename(columns={key: value for key, value in rename.items() if key in df.columns})

    st.dataframe(
        df,
        column_config={
            "CAGR": st.column_config.NumberColumn("CAGR", format="%.2f%%"),
            "MDD": st.column_config.NumberColumn("MDD", format="%.2f%%"),
            "샤프": st.column_config.NumberColumn("샤프", format="%.2f"),
            "칼마": st.column_config.NumberColumn("칼마", format="%.2f"),
        },
        hide_index=True,
        use_container_width=True,
    )


def render_comparison_nav_chart(nav_dict: dict[str, pd.DataFrame]) -> go.Figure:
    fig = go.Figure()
    if not nav_dict:
        return fig

    palette = [_PRIMARY, "#2563EB", _SUCCESS, _WARNING, _DANGER, _INK_SECONDARY]
    for index, (portfolio_name, df) in enumerate(nav_dict.items()):
        if df.empty or "portfolio_value" not in df.columns:
            continue

        base = df["portfolio_value"].iloc[0]
        if base == 0:
            continue
        x = df["date"] if "date" in df.columns else df.index
        nav = df["portfolio_value"] / base * 100
        fig.add_trace(
            go.Scatter(
                x=x,
                y=nav,
                mode="lines",
                name=portfolio_name,
                line=dict(color=palette[index % len(palette)], width=2),
            )
        )

    fig.update_layout(
        yaxis_title="NAV (기준 100)",
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
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


def render_report_section(report_text: str | None):
    st.subheader("월간보고서")

    if not report_text:
        st.info("보고서 없음")
        return

    st.markdown(report_text)
    if st.button("복사", key="copy_monthly_report"):
        st.code(report_text, language="markdown")
