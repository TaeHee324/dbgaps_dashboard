"""Demo data reset and setup script.

Steps:
1. Delete all trade_log rows from PostgreSQL
2. Upsert 'base' portfolio in DB with 6 ETFs
3. Replace data/trades.csv with 2026-05-02 buy trades
4. Delete all output/ CSV files
"""

from __future__ import annotations

import glob
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from dotenv import load_dotenv
load_dotenv()

import pandas as pd
import db

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = ROOT / "output"

DEMO_PORTFOLIO = [
    {"code": "091160", "name": "KODEX 반도체",                  "weight": 0.20, "category": "위험/국내주식_섹터"},
    {"code": "360750", "name": "TIGER 미국S&P500",               "weight": 0.20, "category": "위험/해외주식_지수"},
    {"code": "449450", "name": "PLUS K방산",                     "weight": 0.15, "category": "위험/국내주식_섹터"},
    {"code": "411060", "name": "ACE KRX금현물",                  "weight": 0.15, "category": "위험/FX 및 원자재"},
    {"code": "488770", "name": "KODEX 머니마켓액티브",            "weight": 0.20, "category": "안전/금리연계형/초단기채권"},
    {"code": "273130", "name": "KODEX 종합채권(AA-이상)액티브",   "weight": 0.10, "category": "안전/국내채권_회사채"},
]

CAPITAL = 1_000_000_000
TRADE_DATE = "2026-05-02"


# ── Step 1: trade_log 전체 삭제 ──────────────────────────────────────────────
print("Step 1: trade_log 전체 삭제...")
db.init_trade_log_table()
with db.get_connection() as conn:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM trade_log")
        deleted = cur.rowcount
    conn.commit()
print(f"  완료: {deleted}건 삭제됨")


# ── Step 2: base 포트폴리오 DB 업데이트 ─────────────────────────────────────
print("Step 2: 'base' 포트폴리오 DB 업데이트...")
db.init_db()
holdings_for_db = [{"code": e["code"], "weight": e["weight"]} for e in DEMO_PORTFOLIO]
# upsert_portfolio는 is_protected=FALSE로 설정하므로, protected 포트폴리오는 직접 UPDATE
with db.get_connection() as conn:
    with conn.cursor() as cur:
        import json
        cur.execute(
            """
            INSERT INTO portfolios (name, holdings, is_protected)
            VALUES (%s, %s, TRUE)
            ON CONFLICT (name) DO UPDATE
                SET holdings   = EXCLUDED.holdings,
                    updated_at = NOW()
            """,
            ("base", json.dumps(holdings_for_db)),
        )
    conn.commit()
print(f"  완료: 'base' 포트폴리오 {len(holdings_for_db)}개 ETF 업데이트")


# ── Step 3: 가격 조회 및 trades.csv 생성 ────────────────────────────────────
print("Step 3: 가격 조회 및 data/trades.csv 생성...")

prices = pd.read_csv(DATA / "prices_daily.csv", dtype={"code": str})
prices["date"] = pd.to_datetime(prices["date"])
prices["code"] = prices["code"].str.zfill(6)

target_date = pd.Timestamp(TRADE_DATE)

rows = []
print(f"  {'코드':>8}  {'이름':<30}  {'비중':>5}  {'날짜':>12}  {'가격':>10}  {'수량':>8}  {'금액':>15}")
print("  " + "-" * 90)

for etf in DEMO_PORTFOLIO:
    code = str(etf["code"]).zfill(6)
    name = etf["name"]
    weight = etf["weight"]

    # 2026-05-02 이후 가장 가까운 거래일 선택
    sub = prices[(prices["code"] == code) & (prices["date"] >= target_date)].sort_values("date")
    if sub.empty:
        raise RuntimeError(f"prices_daily.csv에서 {code} 의 {TRADE_DATE} 이후 데이터를 찾을 수 없습니다.")

    row_price = sub.iloc[0]
    trade_date_str = row_price["date"].strftime("%Y-%m-%d")
    price = float(row_price["close"])
    quantity = int(weight * CAPITAL / price)
    amount = quantity * price

    print(f"  {code:>8}  {name:<30}  {weight:>4.0%}  {trade_date_str:>12}  {price:>10,.0f}  {quantity:>8,}  {amount:>15,.0f}")

    rows.append({
        "date": trade_date_str,
        "code": code,
        "name": name,
        "side": "buy",
        "quantity": quantity,
        "price": price,
        "amount": amount,
        "fee": 0,
        "memo": "초기 편입",
    })

trades_df = pd.DataFrame(rows, columns=["date", "code", "name", "side", "quantity", "price", "amount", "fee", "memo"])
trades_df.to_csv(DATA / "trades.csv", index=False)
print(f"  완료: data/trades.csv 작성 ({len(rows)}건)")


# ── Step 4: output/ CSV 전체 삭제 ───────────────────────────────────────────
print("Step 4: output/ CSV 전체 삭제...")
deleted_files = 0

for csv_file in glob.glob(str(OUTPUT / "*.csv")):
    os.remove(csv_file)
    deleted_files += 1

comparison_dir = OUTPUT / "comparison"
if comparison_dir.exists():
    for csv_file in glob.glob(str(comparison_dir / "*.csv")):
        os.remove(csv_file)
        deleted_files += 1

print(f"  완료: {deleted_files}개 파일 삭제됨")


# ── 완료 요약 ────────────────────────────────────────────────────────────────
print("\n=== 초기화 완료 ===")
print(f"  총 자본:      {CAPITAL:>15,.0f} 원")
print(f"  거래 기준일:  {TRADE_DATE}")
print(f"  ETF 수:       {len(rows)}개")
total_invested = sum(r["amount"] for r in rows)
print(f"  총 투자금액:  {total_invested:>15,.0f} 원")
print(f"  미투자(잔여): {CAPITAL - total_invested:>15,.0f} 원")
