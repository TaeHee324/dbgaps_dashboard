import json
from pathlib import Path

import pandas as pd
import streamlit as st


TRADE_LOG_PATH = Path(__file__).parent.parent.parent / "data" / "trade_log.json"
ACTION_TO_SCHEMA = {
    "매수": "buy",
    "매도": "sell",
}
ACTION_TO_LABEL = {
    "buy": "매수",
    "sell": "매도",
}


def _load_trade_log() -> list[dict]:
    if not TRADE_LOG_PATH.exists():
        return []

    try:
        with TRADE_LOG_PATH.open("r", encoding="utf-8") as file:
            records = json.load(file)
    except (json.JSONDecodeError, OSError):
        return []

    if not isinstance(records, list):
        return []
    return records


def _save_trade_log(records: list[dict]) -> None:
    TRADE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with TRADE_LOG_PATH.open("w", encoding="utf-8") as file:
        json.dump(records, file, ensure_ascii=False, indent=2)
        file.write("\n")


def _format_weight(value: object) -> str:
    try:
        return f"{float(value):.2%}"
    except (TypeError, ValueError):
        return "N/A"


def _history_table(records: list[dict]) -> pd.DataFrame:
    rows = []
    for record in records:
        reason = str(record.get("reason", ""))
        rows.append(
            {
                "날짜": record.get("date", ""),
                "매수/매도": ACTION_TO_LABEL.get(record.get("action"), record.get("action", "")),
                "ETF코드": str(record.get("etf_code", "")),
                "ETF명": record.get("etf_name", ""),
                "비중전": _format_weight(record.get("weight_before")),
                "비중후": _format_weight(record.get("weight_after")),
                "이유": reason[:20],
            }
        )
    return pd.DataFrame(rows)


st.title("매매일지")

with st.form("trade_log_form", clear_on_submit=True):
    col1, col2, col3, col4 = st.columns([1.1, 0.9, 1.0, 1.6])
    with col1:
        trade_date = st.date_input("날짜")
    with col2:
        action_label = st.selectbox("매수·매도", ["매수", "매도"])
    with col3:
        etf_code = st.text_input("ETF 코드")
    with col4:
        etf_name = st.text_input("ETF명")

    col5, col6 = st.columns(2)
    with col5:
        weight_before = st.number_input("비중 변화 전", min_value=0.0, max_value=1.0, step=0.01)
    with col6:
        weight_after = st.number_input("비중 변화 후", min_value=0.0, max_value=1.0, step=0.01)

    reason = st.text_area("이유")
    note = st.text_area("메모")
    submitted = st.form_submit_button("기록 저장")

if submitted:
    if not reason.strip():
        st.error("이유를 입력해야 합니다.")
    else:
        trade_log = _load_trade_log()
        trade_log.append(
            {
                "date": trade_date.strftime("%Y-%m-%d"),
                "action": ACTION_TO_SCHEMA[action_label],
                "etf_code": etf_code.strip(),
                "etf_name": etf_name.strip(),
                "weight_before": float(weight_before),
                "weight_after": float(weight_after),
                "reason": reason.strip(),
                "note": note.strip(),
            }
        )
        _save_trade_log(trade_log)
        st.success("매매 기록을 저장했습니다.")

st.subheader("이력")

records = sorted(_load_trade_log(), key=lambda record: record.get("date", ""), reverse=True)

if not records:
    st.info("기록 없음")
else:
    st.dataframe(_history_table(records), use_container_width=True, hide_index=True)

    for record in records:
        date_label = record.get("date", "")
        etf_name_label = record.get("etf_name", "") or record.get("etf_code", "")
        with st.expander(f"{date_label} | {etf_name_label}"):
            st.write(f"매수/매도: {ACTION_TO_LABEL.get(record.get('action'), record.get('action', ''))}")
            st.write(f"ETF 코드: {record.get('etf_code', '')}")
            st.write(f"비중 변화: {_format_weight(record.get('weight_before'))} -> {_format_weight(record.get('weight_after'))}")
            st.write(f"이유: {record.get('reason', '')}")
            note_text = record.get("note", "")
            if note_text:
                st.write(f"메모: {note_text}")
