import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import streamlit as st

from data_loader import (
    load_portfolio_summary,
    load_current_holdings,
    load_backtest_nav,
    load_rule_results,
    load_turnover,
    load_monthly_returns,
)
from components import (
    render_status_bar,
    render_kpi_strip,
    render_nav_chart,
    render_drawdown_chart,
    render_turnover_section,
    render_rule_badges,
    render_monthly_returns_chart,
    render_holdings_table,
)

st.set_page_config(page_title="DBGAPS Dashboard", layout="wide")

with st.sidebar:
    if st.button("데이터 새로고침"):
        st.cache_data.clear()
        st.rerun()

summary = load_portfolio_summary()
backtest = load_backtest_nav()
holdings = load_current_holdings()
rules = load_rule_results()
turnover = load_turnover()
monthly_returns = load_monthly_returns()


def _get_backtest_data_date(backtest_df):
    if backtest_df.empty or "date" not in backtest_df.columns:
        return "데이터 없음"
    return backtest_df["date"].iloc[-1].strftime("%Y-%m-%d")


render_status_bar(_get_backtest_data_date(backtest))
render_kpi_strip(summary)

col1, col2 = st.columns(2)
with col1:
    st.plotly_chart(render_nav_chart(backtest), use_container_width=True)
with col2:
    st.plotly_chart(render_drawdown_chart(backtest), use_container_width=True)

render_turnover_section(turnover)

render_rule_badges({
    "rule_individual_etf": rules.get("individual"),
    "rule_risk_asset": rules.get("risk_asset"),
})

st.plotly_chart(render_monthly_returns_chart(monthly_returns), use_container_width=True)

render_holdings_table(holdings)
