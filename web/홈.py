import json
from pathlib import Path

import pandas as pd
import streamlit as st

from data_loader import load_backtest_nav, load_portfolio_summary
from components import render_drawdown_chart, render_nav_chart

_BASE_CSV = Path(__file__).parent.parent / "portfolios" / "base.csv"
_TRADE_LOG_PATH = Path(__file__).parent.parent / "data" / "trade_log.json"


def _load_trade_log() -> list:
    if not _TRADE_LOG_PATH.exists():
        return []
    try:
        data = json.loads(_TRADE_LOG_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


st.title("DBGAPS")

# --- KPI 요약 ---
summary = load_portfolio_summary()
if not summary.empty:
    row = summary.iloc[0]
    c1, c2, c3 = st.columns(3)

    def _pct(key: str) -> str:
        v = row.get(key)
        return f"{v * 100:.2f}%" if v is not None else "—"

    def _ratio(key: str) -> str:
        v = row.get(key)
        return f"{v:.2f}" if v is not None else "—"

    with c1:
        st.metric("CAGR", _pct("cagr"))
    with c2:
        st.metric("MDD", _pct("mdd"))
    with c3:
        st.metric("샤프지수", _ratio("sharpe"))
else:
    st.warning("KPI 데이터 없음 — `python src/run_engine.py` 실행 후 새로고침하세요.")

st.divider()

# --- NAV + Drawdown 차트 ---
backtest = load_backtest_nav()
trade_log = _load_trade_log()

if not backtest.empty:
    col1, col2 = st.columns(2)
    with col1:
        st.caption("NAV (기준 100)")
        st.plotly_chart(render_nav_chart(backtest, trade_log=trade_log), use_container_width=True)
    with col2:
        st.caption("Drawdown")
        st.plotly_chart(render_drawdown_chart(backtest), use_container_width=True)
else:
    st.warning("NAV 데이터 없음 — `python src/run_engine.py` 실행 후 새로고침하세요.")

st.divider()

# --- 투데이 시황 ---
st.subheader("시황")
st.info("시황 정보는 준비 중입니다.")

st.divider()

# --- 운용 전략 개요 ---
st.subheader("운용 전략")
if _BASE_CSV.exists():
    base_df = pd.read_csv(_BASE_CSV, dtype={"code": str})
    base_df = base_df.rename(columns={"code": "ETF 코드", "weight": "비중"})
    base_df["비중"] = base_df["비중"].apply(lambda w: f"{float(w):.0%}")
    st.dataframe(base_df, hide_index=True, use_container_width=False)
else:
    st.warning("포트폴리오 파일을 찾을 수 없습니다.")
