"""Update local daily ETF close prices.

This script keeps ``data/prices_daily.csv`` in long format:

    date,code,close

It uses ``pykrx`` when available. Install it in the project environment with:

    pip install pykrx pandas

Only this module should perform KRX network requests. Downstream calculation
modules consume the generated CSV with pandas only.
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable

import pandas as pd

try:
    from pykrx import stock
except ImportError as exc:  # pragma: no cover - environment dependent
    stock = None
    PYKRX_IMPORT_ERROR = exc
else:
    PYKRX_IMPORT_ERROR = None

ROOT = Path(__file__).resolve().parents[1]
ETF_MASTER_PATH = ROOT / "data" / "etf_master.csv"
PRICES_DAILY_PATH = ROOT / "data" / "prices_daily.csv"
PRICE_COLUMNS = ["date", "code", "close"]
BENCHMARK_CODE = "069500"


def parse_yyyymmdd(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def compact_day(value: date) -> str:
    return value.strftime("%Y%m%d")


def load_codes(master_path: Path = ETF_MASTER_PATH) -> list[str]:
    master = pd.read_csv(master_path, dtype={"code": str})
    codes = master["code"].str.zfill(6).dropna().drop_duplicates().tolist()
    if BENCHMARK_CODE not in codes:
        codes.append(BENCHMARK_CODE)
    return codes


def load_existing_prices(path: Path = PRICES_DAILY_PATH) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame(columns=PRICE_COLUMNS)
    prices = pd.read_csv(path, dtype={"code": str})
    if prices.empty:
        return pd.DataFrame(columns=PRICE_COLUMNS)
    prices = prices[PRICE_COLUMNS].copy()
    prices["code"] = prices["code"].str.zfill(6)
    prices["date"] = pd.to_datetime(prices["date"]).dt.strftime("%Y-%m-%d")
    prices["close"] = pd.to_numeric(prices["close"], errors="coerce")
    return prices.dropna(subset=["date", "code", "close"])


def next_start_date(existing: pd.DataFrame, code: str, default_start: date) -> date:
    code_prices = existing.loc[existing["code"] == code, "date"]
    if code_prices.empty:
        return default_start
    latest = pd.to_datetime(code_prices.max()).date()
    return latest + timedelta(days=1)


def fetch_daily_close(code: str, start: date, end: date) -> pd.DataFrame:
    if stock is None:
        raise RuntimeError(
            "pykrx is required to fetch prices. Install with `pip install pykrx pandas`."
        ) from PYKRX_IMPORT_ERROR
    if start > end:
        return pd.DataFrame(columns=PRICE_COLUMNS)

    raw = stock.get_etf_ohlcv_by_date(compact_day(start), compact_day(end), code)
    if raw.empty:
        raw = stock.get_market_ohlcv_by_date(compact_day(start), compact_day(end), code)
    if raw.empty:
        return pd.DataFrame(columns=PRICE_COLUMNS)

    close_col = next((column for column in ("종가", "close", "Close") if column in raw.columns), None)
    if close_col is None:
        raise ValueError(f"unexpected pykrx columns for {code}: {list(raw.columns)}")

    frame = raw.reset_index().rename(columns={raw.index.name or "index": "date", close_col: "close"})
    frame = frame[["date", "close"]]
    frame["date"] = pd.to_datetime(frame["date"]).dt.strftime("%Y-%m-%d")
    frame["code"] = code
    frame["close"] = pd.to_numeric(frame["close"], errors="coerce")
    return frame[PRICE_COLUMNS].dropna(subset=["date", "close"])


def update_prices(
    codes: Iterable[str],
    start: date,
    end: date,
    prices_path: Path = PRICES_DAILY_PATH,
    dry_run: bool = False,
) -> pd.DataFrame:
    existing = load_existing_prices(prices_path)
    fetched_frames: list[pd.DataFrame] = []

    for code in codes:
        code = str(code).zfill(6)
        code_start = next_start_date(existing, code, start)
        if code_start > end:
            print(f"skip {code}: already up to date")
            continue
        print(f"fetch {code}: {code_start} to {end}")
        try:
            fetched = fetch_daily_close(code, code_start, end)
        except Exception as exc:  # pragma: no cover - network/provider dependent
            print(f"error {code}: {exc}")
            continue
        if fetched.empty:
            print(f"empty {code}: no rows returned")
            continue
        print(f"ok {code}: {len(fetched)} rows")
        fetched_frames.append(fetched)

    if fetched_frames:
        combined = pd.concat([existing, *fetched_frames], ignore_index=True)
    else:
        combined = existing.copy()

    if combined.empty:
        combined = pd.DataFrame(columns=PRICE_COLUMNS)
    else:
        combined = combined.drop_duplicates(["date", "code"], keep="last")
        combined = combined.sort_values(["code", "date"]).reset_index(drop=True)

    if not dry_run:
        prices_path.parent.mkdir(parents=True, exist_ok=True)
        combined.to_csv(prices_path, index=False, encoding="utf-8")

    return combined


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Update data/prices_daily.csv")
    parser.add_argument("--start", default="2015-01-01", help="default first fetch date")
    parser.add_argument("--end", default=date.today().isoformat(), help="last fetch date")
    parser.add_argument("--code", action="append", help="six-character ETF code; repeatable")
    parser.add_argument("--dry-run", action="store_true", help="fetch without writing CSV")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    start = parse_yyyymmdd(args.start)
    end = parse_yyyymmdd(args.end)
    codes = args.code or load_codes()
    if BENCHMARK_CODE not in codes:
        codes = [*codes, BENCHMARK_CODE]
    prices = update_prices(codes, start, end, dry_run=args.dry_run)
    if prices.empty:
        print("done: no price rows available")
    else:
        min_date = prices["date"].min()
        max_date = prices["date"].max()
        code_count = prices["code"].nunique()
        print(f"done: {len(prices)} rows, {code_count} codes, {min_date} to {max_date}")


if __name__ == "__main__":
    main()
