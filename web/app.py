import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import streamlit as st

from data_loader import (
    load_portfolio_summary,
    load_current_holdings,
    load_backtest_nav,
    load_rule_results,
    get_data_date,
)
from components import (
    render_status_bar,
    render_kpi_strip,
    render_nav_chart,
    render_drawdown_chart,
    render_rule_badges,
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

render_status_bar(get_data_date())
render_kpi_strip(summary)

col1, col2 = st.columns(2)
with col1:
    st.plotly_chart(render_nav_chart(backtest), use_container_width=True)
with col2:
    st.plotly_chart(render_drawdown_chart(backtest), use_container_width=True)

render_rule_badges({
    "rule_individual_etf": rules.get("individual"),
    "rule_risk_asset": rules.get("risk_asset"),
})
render_holdings_table(holdings)
