"""Insert demo trades from data/trades.csv into PostgreSQL trade_log table."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from dotenv import load_dotenv
load_dotenv()

import pandas as pd
import db

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

# 목표 비중 (ETF 코드 → weight)
WEIGHT_AFTER = {
    "091160": 0.20,
    "360750": 0.20,
    "449450": 0.15,
    "411060": 0.15,
    "488770": 0.20,
    "273130": 0.10,
}

print("trade_log 테이블 초기화...")
db.init_trade_log_table()
print("  완료")

print("data/trades.csv 읽기...")
trades = pd.read_csv(DATA / "trades.csv", dtype={"code": str})
trades["code"] = trades["code"].str.zfill(6)
print(f"  {len(trades)}건 로드됨")

print("trade_log에 거래 삽입...")
inserted = 0
with db.get_connection() as conn:
    with conn.cursor() as cur:
        for _, row in trades.iterrows():
            code = str(row["code"]).zfill(6)
            weight_after = WEIGHT_AFTER.get(code, 0.0)

            cur.execute(
                """
                INSERT INTO trade_log
                    (date, action, etf_code, etf_name,
                     weight_before, weight_after,
                     reason, note, strategy_checklist,
                     quantity, price, amount)
                VALUES
                    (%s, %s, %s, %s,
                     %s, %s,
                     %s, %s, %s,
                     %s, %s, %s)
                """,
                (
                    str(row["date"]),
                    "매수",
                    code,
                    str(row["name"]),
                    0.0,
                    weight_after,
                    "초기 편입 — AI CAPEX 수혜, 리스크 분산 전략",
                    "",
                    "[]",
                    float(row["quantity"]),
                    float(row["price"]),
                    float(row["amount"]),
                ),
            )
            inserted += 1
            print(f"  삽입: {code} {row['name']} | {row['date']} | {float(row['price']):,.0f}원 × {int(row['quantity']):,}주 = {float(row['amount']):,.0f}원")

    conn.commit()

print(f"\n완료: {inserted}건 삽입됨")

# 검증
with db.get_connection() as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS cnt FROM trade_log")
        total = cur.fetchone()["cnt"]
print(f"trade_log 총 행 수: {total}")
