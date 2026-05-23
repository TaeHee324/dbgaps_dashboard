import json
from pathlib import Path

import streamlit as st

_TRADE_LOG_PATH = Path(__file__).parent.parent.parent / "data" / "trade_log.json"


def _load_trade_log() -> list:
    if not _TRADE_LOG_PATH.exists():
        return []
    try:
        data = json.loads(_TRADE_LOG_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []

from data_loader import (
    load_portfolio_summary,
    load_current_holdings,
    load_backtest_nav,
    load_rule_results,
    load_turnover,
    load_monthly_returns,
    load_report,
    load_comparison_summary,
    load_comparison_nav,
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
    render_report_section,
    render_comparison_table,
    render_comparison_nav_chart,
)

summary = load_portfolio_summary()
backtest = load_backtest_nav()
holdings = load_current_holdings()
rules = load_rule_results()
turnover = load_turnover()
monthly_returns = load_monthly_returns()
report_text = load_report()
comparison_summary = load_comparison_summary()
comparison_nav = load_comparison_nav()
trade_log = _load_trade_log()


def _get_backtest_data_date(backtest_df):
    if backtest_df.empty or "date" not in backtest_df.columns:
        return "데이터 없음"
    return backtest_df["date"].iloc[-1].strftime("%Y-%m-%d")


render_status_bar(_get_backtest_data_date(backtest))
render_kpi_strip(summary)

col1, col2 = st.columns(2)
with col1:
    st.plotly_chart(render_nav_chart(backtest, trade_log=trade_log), use_container_width=True)
with col2:
    st.plotly_chart(render_drawdown_chart(backtest), use_container_width=True)

render_turnover_section(turnover)

render_rule_badges({
    "rule_individual_etf": rules.get("individual"),
    "rule_risk_asset": rules.get("risk_asset"),
})

st.plotly_chart(render_monthly_returns_chart(monthly_returns), use_container_width=True)

if not comparison_summary.empty and comparison_nav:
    with st.expander("포트폴리오 비교", expanded=True):
        render_comparison_table(comparison_summary)
        st.plotly_chart(render_comparison_nav_chart(comparison_nav), use_container_width=True)

render_holdings_table(holdings)

render_report_section(report_text)
