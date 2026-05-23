import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data_loader import load_comparison_nav, load_comparison_summary
from components import render_comparison_nav_chart, render_comparison_table

st.set_page_config(page_title="포트폴리오 비교", layout="wide")
st.title("포트폴리오 비교")

summary_df = load_comparison_summary()
nav_dict = load_comparison_nav()

if summary_df.empty and not nav_dict:
    st.warning("run_engine.py를 먼저 실행하세요")
    st.stop()

PERIODS = ["1년", "3년", "5년", "전체"]
period = st.radio("기간", PERIODS, horizontal=True, index=3)

cutoff_map = {"1년": 1, "3년": 3, "5년": 5, "전체": None}
years = cutoff_map[period]

if years is not None and nav_dict:
    cutoff = pd.Timestamp.today() - pd.DateOffset(years=years)
    filtered_nav = {}
    for name, df in nav_dict.items():
        if df.empty or "date" not in df.columns:
            filtered_nav[name] = df
            continue
        df_cut = df[df["date"] >= cutoff].copy()
        if not df_cut.empty:
            filtered_nav[name] = df_cut
    nav_dict_display = filtered_nav
else:
    nav_dict_display = nav_dict

st.subheader("비교 지표")
if summary_df.empty:
    st.warning("run_engine.py를 먼저 실행하세요")
else:
    if years is not None:
        st.caption(f"KPI는 전체 기간 기준 (NAV 차트만 {period} 필터 적용)")
    render_comparison_table(summary_df)

st.subheader("NAV 비교")
if not nav_dict_display:
    st.warning("run_engine.py를 먼저 실행하세요")
else:
    fig = render_comparison_nav_chart(nav_dict_display)
    st.plotly_chart(fig, use_container_width=True)
