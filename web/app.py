import sys
from pathlib import Path

import streamlit as st

WEB_DIR = Path(__file__).resolve().parent
if str(WEB_DIR) not in sys.path:
    sys.path.insert(0, str(WEB_DIR))

st.set_page_config(page_title="DBGAPS", layout="wide")

with st.sidebar:
    if st.button("데이터 새로고침"):
        st.cache_data.clear()
        st.rerun()

pg = st.navigation([
    st.Page("홈.py", title="홈", icon=None),
    st.Page("pages/0_운용현황.py", title="운용 현황", icon=None),
    st.Page("pages/1_ETF_포트폴리오.py", title="ETF & 포트폴리오", icon=None),
    st.Page("pages/2_포트폴리오_비교.py", title="포트폴리오 비교", icon=None),
    st.Page("pages/3_매매일지.py", title="매매일지", icon=None),
    st.Page("pages/4_시황.py", title="시황", icon=None),
    st.Page("pages/5_운용보고서.py", title="운용보고서", icon=None),
])
pg.run()
