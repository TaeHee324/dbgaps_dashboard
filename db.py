"""Shared portfolio database module.

Used by both web/ (Streamlit dashboard) and src/ (calculation engine).
Reads DATABASE_URL from environment — set via .env locally, Railway injects it in production.

Local dev note: Railway provides two connection URLs.
  - Internal (postgres.railway.internal): only works within Railway's network.
  - External (TCP proxy, e.g. monorail.proxy.rlwy.net:PORT): use this for local dev.
Set DATABASE_URL to the external URL in your local .env file.
"""
from __future__ import annotations

import csv
import json
import os
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent
_SEED_DIR = ROOT / "portfolios"
_PROTECTED = {"base", "conservative", "aggressive"}


def _get_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL 환경변수가 설정되지 않았습니다.\n"
            ".env 파일에 DATABASE_URL=postgresql://... 을 추가하세요.\n"
            "로컬 개발 시 Railway 콘솔의 외부(TCP proxy) 연결 URL을 사용하세요."
        )
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def get_connection():
    return psycopg2.connect(_get_url(), cursor_factory=RealDictCursor)


def init_db() -> None:
    """Create portfolios table if not exists, then seed protected portfolios from CSV."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS portfolios (
                    name         VARCHAR(100) PRIMARY KEY,
                    holdings     JSONB        NOT NULL,
                    is_protected BOOLEAN      DEFAULT FALSE,
                    created_at   TIMESTAMP    DEFAULT NOW(),
                    updated_at   TIMESTAMP    DEFAULT NOW()
                )
            """)
        conn.commit()

    for name in _PROTECTED:
        csv_path = _SEED_DIR / f"{name}.csv"
        if not csv_path.exists():
            continue
        with csv_path.open(newline="", encoding="utf-8") as f:
            holdings = [
                {"code": row["code"], "weight": float(row["weight"])}
                for row in csv.DictReader(f)
            ]
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO portfolios (name, holdings, is_protected)
                    VALUES (%s, %s, TRUE)
                    ON CONFLICT (name) DO NOTHING
                    """,
                    (name, json.dumps(holdings)),
                )
            conn.commit()


def list_portfolios() -> list[dict]:
    """Return [{"name": ..., "is_protected": ..., "group_name": ...}, ...] ordered protected-first then by name."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            # group_name 컬럼이 없을 경우를 대비해 안전하게 조회
            try:
                cur.execute(
                    "SELECT name, is_protected, group_name FROM portfolios ORDER BY is_protected DESC, name"
                )
            except Exception:
                cur.execute(
                    "SELECT name, is_protected FROM portfolios ORDER BY is_protected DESC, name"
                )
            return [dict(row) for row in cur.fetchall()]


def get_portfolio(name: str) -> list[dict] | None:
    """Return holdings [{"code": ..., "weight": ...}] or None if not found."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT holdings FROM portfolios WHERE name = %s", (name,))
            row = cur.fetchone()
            return row["holdings"] if row else None


def upsert_portfolio(name: str, holdings: list[dict], group_name: str | None = None) -> None:
    """Insert or overwrite a portfolio (non-protected flag preserved on update)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO portfolios (name, holdings, is_protected, group_name)
                    VALUES (%s, %s, FALSE, %s)
                    ON CONFLICT (name) DO UPDATE
                        SET holdings   = EXCLUDED.holdings,
                            group_name = EXCLUDED.group_name,
                            updated_at = NOW()
                    """,
                    (name, json.dumps(holdings), group_name),
                )
            except Exception:
                # group_name 컬럼이 없을 경우 fallback
                cur.execute(
                    """
                    INSERT INTO portfolios (name, holdings, is_protected)
                    VALUES (%s, %s, FALSE)
                    ON CONFLICT (name) DO UPDATE
                        SET holdings   = EXCLUDED.holdings,
                            updated_at = NOW()
                    """,
                    (name, json.dumps(holdings)),
                )
        conn.commit()


def delete_portfolio(name: str) -> None:
    """Delete a portfolio. Raises ValueError if not found or protected."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT is_protected FROM portfolios WHERE name = %s", (name,))
            row = cur.fetchone()
            if row is None:
                raise ValueError(f"포트폴리오 '{name}'을 찾을 수 없습니다.")
            if row["is_protected"]:
                raise ValueError(f"'{name}'은 기본 포트폴리오로 삭제할 수 없습니다.")
            cur.execute("DELETE FROM portfolios WHERE name = %s", (name,))
        conn.commit()


def load_prices_from_db() -> pd.DataFrame:
    """SELECT date, code, close FROM prices_daily. Returns empty DataFrame if table is empty or missing."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT date, code, close FROM prices_daily ORDER BY date, code")
                rows = cur.fetchall()
    except Exception:
        return pd.DataFrame(columns=["date", "code", "close"])
    if not rows:
        return pd.DataFrame(columns=["date", "code", "close"])
    df = pd.DataFrame([dict(r) for r in rows])
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["code"] = df["code"].str.zfill(6)
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    return df.dropna(subset=["date", "code", "close"])


def get_max_date_by_code() -> dict[str, str]:
    """Return {code: "YYYY-MM-DD"} with the latest date per code from prices_daily."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT code, MAX(date) AS max_date FROM prices_daily GROUP BY code")
                rows = cur.fetchall()
    except Exception:
        return {}
    return {
        str(row["code"]).zfill(6): row["max_date"].isoformat()
        for row in rows
        if row["max_date"] is not None
    }


def upsert_prices(rows: list[dict]) -> None:
    """Insert or update rows into prices_daily (batch).

    rows: [{"date": "YYYY-MM-DD", "code": "xxxxxx", "close": float}, ...]
    Each thread must call this with its own connection (psycopg2 connections are not thread-safe).
    """
    if not rows:
        return
    values = [(row["date"], str(row["code"]).zfill(6), float(row["close"])) for row in rows]
    with get_connection() as conn:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO prices_daily (date, code, close)
                VALUES %s
                ON CONFLICT (date, code) DO UPDATE SET close = EXCLUDED.close
                """,
                values,
                page_size=1000,
            )
        conn.commit()


def init_trade_log_table() -> None:
    """Create trade_log table if not exists."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS trade_log (
                    id                 SERIAL PRIMARY KEY,
                    date               DATE         NOT NULL,
                    action             VARCHAR(20)  NOT NULL,
                    etf_code           VARCHAR(20)  NOT NULL,
                    etf_name           VARCHAR(100) NOT NULL,
                    weight_before      DECIMAL(8,4) NOT NULL DEFAULT 0,
                    weight_after       DECIMAL(8,4) NOT NULL DEFAULT 0,
                    reason             TEXT         NOT NULL DEFAULT '',
                    note               TEXT         NOT NULL DEFAULT '',
                    strategy_checklist JSONB        NOT NULL DEFAULT '[]',
                    created_at         TIMESTAMP    DEFAULT NOW()
                )
            """)
            cur.execute("ALTER TABLE trade_log ADD COLUMN IF NOT EXISTS quantity       NUMERIC DEFAULT NULL")
            cur.execute("ALTER TABLE trade_log ADD COLUMN IF NOT EXISTS price          NUMERIC DEFAULT NULL")
            cur.execute("ALTER TABLE trade_log ADD COLUMN IF NOT EXISTS amount         NUMERIC DEFAULT NULL")
            cur.execute("ALTER TABLE trade_log ADD COLUMN IF NOT EXISTS strategy_notes JSONB DEFAULT '{}'")

        conn.commit()
