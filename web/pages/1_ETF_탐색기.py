from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st


ROOT = Path(__file__).resolve().parents[2]
ETF_MASTER_PATH = ROOT / "data" / "etf_master.csv"
PRICES_PATH = ROOT / "data" / "prices_daily.csv"

DISPLAY_COLUMNS = [
    "code",
    "name",
    "asset_class",
    "risk_type",
    "aum_억원",
    "benchmark",
]

RENAME_COLUMNS = {
    "code": "코드",
    "name": "ETF명",
    "asset_class": "자산군",
    "risk_type": "위험구분",
    "aum_억원": "AUM(억원)",
    "benchmark": "벤치마크",
}


@st.cache_data(ttl=600)
def load_prices() -> pd.DataFrame:
    if not PRICES_PATH.exists():
        return pd.DataFrame(columns=["date", "code", "close"])
    df = pd.read_csv(PRICES_PATH, dtype={"code": "string"}, parse_dates=["date"])
    df["code"] = df["code"].astype("string").str.zfill(6)
    return df


@st.cache_data
def load_etf_master() -> pd.DataFrame:
    if not ETF_MASTER_PATH.exists():
        return pd.DataFrame(columns=DISPLAY_COLUMNS)

    df = pd.read_csv(ETF_MASTER_PATH, dtype={"code": "string", "raw_ticker": "string"})
    for column in DISPLAY_COLUMNS:
        if column not in df.columns:
            df[column] = pd.NA

    df["code"] = df["code"].astype("string").str.zfill(6)
    df["aum_억원"] = pd.to_numeric(df["aum_억원"], errors="coerce")
    return df


def get_data_date() -> str:
    if not ETF_MASTER_PATH.exists():
        return "데이터 없음"
    modified_at = pd.Timestamp.fromtimestamp(ETF_MASTER_PATH.stat().st_mtime)
    return modified_at.strftime("%Y-%m-%d %H:%M")


def filter_etfs(
    df: pd.DataFrame,
    query: str,
    selected_asset_classes: list[str],
    selected_risk_types: list[str],
) -> pd.DataFrame:
    filtered = df.copy()

    query = query.strip()
    if query:
        query_mask = (
            filtered["name"].fillna("").str.contains(query, case=False, na=False)
            | filtered["code"].fillna("").str.contains(query, case=False, na=False)
        )
        filtered = filtered[query_mask]

    if selected_asset_classes:
        filtered = filtered[filtered["asset_class"].isin(selected_asset_classes)]

    if selected_risk_types:
        filtered = filtered[filtered["risk_type"].isin(selected_risk_types)]

    return filtered.sort_values("aum_억원", ascending=False, na_position="last")


st.title("ETF 탐색기")
st.caption(f"ETF 마스터 기준: {get_data_date()} | 원천: data/etf_master.csv")

etf_master = load_etf_master()

if etf_master.empty:
    st.warning("ETF 마스터 데이터 없음")
    st.stop()

with st.sidebar:
    if st.button("ETF 데이터 새로고침"):
        st.cache_data.clear()
        st.rerun()

search_query = st.text_input(
    "ETF명 또는 코드 검색",
    placeholder="예: 나스닥, 379810",
)

filter_col1, filter_col2 = st.columns([2, 1])

asset_class_options = sorted(
    etf_master["asset_class"].dropna().astype(str).unique().tolist()
)
risk_type_options = [
    value
    for value in ["위험", "안전"]
    if value in set(etf_master["risk_type"].dropna().astype(str))
]

with filter_col1:
    selected_asset_classes = st.multiselect(
        "자산군",
        options=asset_class_options,
        placeholder="전체 자산군",
    )

with filter_col2:
    selected_risk_types = st.multiselect(
        "위험구분",
        options=risk_type_options,
        placeholder="전체",
    )

filtered_etfs = filter_etfs(
    etf_master,
    search_query,
    selected_asset_classes,
    selected_risk_types,
)

st.subheader("ETF 리스트")
st.caption(f"필터링 결과 {len(filtered_etfs):,}개 | 기본 정렬: AUM 내림차순")

display_df = filtered_etfs[DISPLAY_COLUMNS].rename(columns=RENAME_COLUMNS).reset_index(drop=True)

table_event = st.dataframe(
    display_df,
    column_config={
        "코드": st.column_config.TextColumn("코드", help="KRX ETF 코드"),
        "ETF명": st.column_config.TextColumn("ETF명"),
        "자산군": st.column_config.TextColumn("자산군"),
        "위험구분": st.column_config.TextColumn("위험구분"),
        "AUM(억원)": st.column_config.NumberColumn("AUM(억원)", format="%,.2f"),
        "벤치마크": st.column_config.TextColumn("벤치마크"),
    },
    hide_index=True,
    use_container_width=True,
    on_select="rerun",
    selection_mode="single-row",
)

selected_rows = table_event.selection.rows if table_event.selection else []
if selected_rows:
    selected_row = filtered_etfs.iloc[selected_rows[0]]
    selected_etf = selected_row[DISPLAY_COLUMNS].to_dict()
    st.session_state["selected_etf"] = selected_etf
    st.session_state["selected_etf_code"] = selected_etf["code"]
else:
    selected_etf = st.session_state.get("selected_etf")

if selected_etf:
    st.markdown(
        f"선택 ETF: **{selected_etf['name']}** "
        f"(`{selected_etf['code']}`) | {selected_etf['asset_class']} | {selected_etf['risk_type']}"
    )
else:
    st.info("차트 섹션으로 전달할 ETF를 테이블에서 하나 선택하세요.")

st.divider()
st.subheader("주가 차트")

period = st.radio(
    "기간",
    options=["1M", "3M", "6M", "1Y", "전체"],
    index=3,
    horizontal=True,
)

_PERIOD_OFFSET = {
    "1M": pd.DateOffset(months=1),
    "3M": pd.DateOffset(months=3),
    "6M": pd.DateOffset(months=6),
    "1Y": pd.DateOffset(years=1),
}

if selected_etf:
    all_prices = load_prices()
    code = selected_etf["code"]
    name = selected_etf.get("name", code)

    etf_prices = all_prices[all_prices["code"] == code].sort_values("date")

    if etf_prices.empty:
        st.warning(f"{code} 가격 데이터 없음 (prices_daily.csv에 해당 코드가 없습니다)")
    else:
        max_date = etf_prices["date"].max()
        if period == "전체":
            chart_df = etf_prices
        else:
            start_date = max_date - _PERIOD_OFFSET[period]
            chart_df = etf_prices[etf_prices["date"] >= start_date]

        if chart_df.empty:
            st.warning("선택 기간에 데이터 없음")
        else:
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=chart_df["date"],
                y=chart_df["close"],
                mode="lines",
                name=name,
                line=dict(color="#2563EB", width=2),
            ))
            fig.update_layout(
                title=f"{name} ({code})",
                xaxis_title="",
                yaxis_title="종가 (원)",
                margin=dict(l=0, r=0, t=40, b=0),
                plot_bgcolor="#F8FAFC",
                paper_bgcolor="#FFFFFF",
                yaxis=dict(tickformat=","),
                legend=dict(orientation="h", yanchor="bottom", y=1.02),
            )
            st.plotly_chart(fig, use_container_width=True)

            current_price = int(chart_df["close"].iloc[-1])
            start_price = int(chart_df["close"].iloc[0])
            period_return = (current_price - start_price) / start_price
            high_price = int(chart_df["close"].max())
            low_price = int(chart_df["close"].min())

            m1, m2, m3, m4 = st.columns(4)
            with m1:
                st.metric("기간 수익률", f"{period_return:+.2%}")
            with m2:
                st.metric("현재가", f"{current_price:,}원")
            with m3:
                st.metric("기간 최고가", f"{high_price:,}원")
            with m4:
                st.metric("기간 최저가", f"{low_price:,}원")
else:
    st.info("테이블에서 ETF를 선택하면 주가 차트가 표시됩니다.")
