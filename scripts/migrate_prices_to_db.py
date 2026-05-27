"""One-time migration: data/prices_daily.csv -> PostgreSQL prices_daily table.

Run once after creating the prices_daily table in Railway PostgreSQL:

    CREATE TABLE prices_daily (
        date DATE        NOT NULL,
        code VARCHAR(6)  NOT NULL,
        close NUMERIC    NOT NULL,
        PRIMARY KEY (date, code)
    );

Then run this script:
    python scripts/migrate_prices_to_db.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import db

CSV_PATH = ROOT / "data" / "prices_daily.csv"


def migrate() -> None:
    if not CSV_PATH.exists():
        print(f"파일 없음: {CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH, dtype={"code": str})
    if df.empty:
        print("CSV가 비어 있습니다.")
        return

    df["code"] = df["code"].str.zfill(6)
    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d")
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    df = df.dropna(subset=["date", "code", "close"])

    rows = df[["date", "code", "close"]].to_dict("records")
    print(f"마이그레이션 시작: {len(rows)}행, {df['code'].nunique()}개 코드")
    db.upsert_prices(rows)
    print(f"완료: {len(rows)}행 upsert — {df['date'].min()} ~ {df['date'].max()}")


if __name__ == "__main__":
    migrate()
