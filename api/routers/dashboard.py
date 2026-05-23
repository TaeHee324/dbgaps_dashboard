from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pandas as pd
from fastapi import APIRouter

from api import schemas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output"
DATA_DIR = ROOT / "data"

router = APIRouter(prefix="/api", tags=["dashboard"])


def _read_csv(path: Path, **kwargs) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    try:
        return pd.read_csv(path, **kwargs)
    except Exception:
        return pd.DataFrame()


def _normalize_code(value: object) -> str:
    code = "" if pd.isna(value) else str(value).strip()
    return code.zfill(6) if code.isdigit() else code


def _clean_scalar(value: object) -> object:
    if pd.isna(value):
        if isinstance(value, (float, int)):
            return 0.0
        return ""
    if hasattr(value, "item"):
        value = value.item()
    return value


def _format_date(value: object, fmt: str = "%Y-%m-%d") -> str:
    if pd.isna(value):
        return ""
    ts = pd.to_datetime(value, errors="coerce")
    if pd.isna(ts):
        return str(value)
    return ts.strftime(fmt)


def _clean_bool(value: object) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "y"}
    return bool(value)


def _records(df: pd.DataFrame, columns: list[str], date_columns: set[str] | None = None) -> list[dict]:
    if df.empty:
        return []
    date_columns = date_columns or set()
    out: list[dict] = []
    for _, row in df.iterrows():
        item = {}
        for column in columns:
            value = row[column] if column in df.columns else None
            if column in date_columns:
                item[column] = _format_date(value)
            elif column == "code":
                item[column] = _normalize_code(value)
            elif column in {"passed"}:
                item[column] = _clean_bool(value)
            else:
                item[column] = _clean_scalar(value)
        out.append(item)
    return out


@router.get("/portfolio-summary", response_model=schemas.PortfolioSummary | None)
def portfolio_summary():
    df = _read_csv(OUTPUT_DIR / "portfolio_summary.csv")
    if df.empty:
        return None
    columns = [
        "cumulative_return",
        "cagr",
        "mdd",
        "alpha",
        "beta",
        "annual_volatility",
        "win_rate",
        "sharpe",
        "calmar",
    ]
    row = df.iloc[0]
    return {column: float(_clean_scalar(row[column] if column in df.columns else 0.0)) for column in columns}


@router.get("/holdings", response_model=list[schemas.Holding])
def holdings():
    df = _read_csv(OUTPUT_DIR / "current_holdings.csv")
    columns = [
        "code",
        "name",
        "quantity",
        "avg_price",
        "cost_basis",
        "price_date",
        "current_price",
        "market_value",
        "unrealized_pnl",
        "unrealized_return",
        "current_weight",
        "risk_type",
        "asset_class",
    ]
    return _records(df, columns, {"price_date"})


@router.get("/backtest-nav", response_model=list[schemas.NavPoint])
def backtest_nav():
    df = _read_csv(OUTPUT_DIR / "backtest_nav.csv")
    return _records(
        df,
        ["date", "portfolio_value", "daily_return", "cumulative_return", "drawdown"],
        {"date"},
    )


@router.get("/monthly-returns", response_model=list[schemas.MonthlyReturn])
def monthly_returns():
    df = _read_csv(OUTPUT_DIR / "monthly_returns.csv")
    return _records(df, ["year", "month", "monthly_return"])


@router.get("/comparison/summary", response_model=list[schemas.ComparisonSummaryItem])
def comparison_summary():
    df = _read_csv(OUTPUT_DIR / "comparison" / "summary.csv")
    return _records(df, ["portfolio_name", "cagr", "mdd", "sharpe", "calmar"])


@router.get("/comparison/nav", response_model=dict[str, list[schemas.ComparisonNavPoint]])
def comparison_nav():
    comparison_dir = OUTPUT_DIR / "comparison"
    if not comparison_dir.exists():
        return {}
    result: dict[str, list[dict]] = {}
    for path in sorted(comparison_dir.glob("*_nav.csv")):
        df = _read_csv(path)
        name = path.name.removesuffix("_nav.csv")
        result[name] = _records(df, ["date", "portfolio_value", "cumulative_return"], {"date"})
    return result


@router.get("/rules", response_model=schemas.RulesResponse | None)
def rules():
    individual = _read_csv(OUTPUT_DIR / "rule_individual_etf.csv")
    risk_asset = _read_csv(OUTPUT_DIR / "rule_risk_asset.csv")
    if individual.empty or risk_asset.empty:
        return None
    risk_records = _records(risk_asset, ["rule", "risky_weight", "limit", "excess", "passed"])
    if not risk_records:
        return None
    return {
        "individual": _records(
            individual,
            ["code", "name", "current_weight", "limit", "excess", "passed"],
        ),
        "risk_asset": risk_records[0],
    }


@router.get("/turnover", response_model=schemas.TurnoverResponse | None)
def turnover():
    initial = _read_csv(OUTPUT_DIR / "turnover_initial.csv")
    weekly = _read_csv(OUTPUT_DIR / "turnover_weekly.csv")
    monthly = _read_csv(OUTPUT_DIR / "turnover_monthly.csv")
    if initial.empty or weekly.empty or monthly.empty:
        return None
    initial_records = _records(initial, ["traded_value", "turnover", "turnover_source", "limit", "passed"])
    if not initial_records:
        return None
    return {
        "initial": initial_records[0],
        "weekly": _records(
            weekly,
            ["date", "traded_value", "turnover", "turnover_source", "limit", "passed"],
            {"date"},
        ),
        "monthly": _records(
            monthly,
            ["date", "traded_value", "turnover", "turnover_source", "limit", "passed"],
            {"date"},
        ),
    }


@router.get("/data-date", response_model=schemas.DataDateResponse)
def data_date():
    files = list(OUTPUT_DIR.glob("*.csv")) if OUTPUT_DIR.exists() else []
    if not files:
        return {"date": ""}
    latest = max(path.stat().st_mtime for path in files)
    return {"date": datetime.fromtimestamp(latest).strftime("%Y-%m-%d %H:%M")}


@router.get("/etf-list", response_model=list[schemas.EtfItem])
def etf_list():
    prices = _read_csv(DATA_DIR / "prices_daily.csv", dtype={"code": "string"})
    if prices.empty or "code" not in prices.columns:
        return []
    codes = pd.DataFrame({"code": sorted({_normalize_code(code) for code in prices["code"].dropna()})})
    master = _read_csv(DATA_DIR / "etf_master.csv", dtype={"code": "string"})
    if not master.empty and {"code", "name"}.issubset(master.columns):
        master = master[["code", "name"]].copy()
        master["code"] = master["code"].map(_normalize_code)
        codes = codes.merge(master, on="code", how="left")
    else:
        codes["name"] = ""
    codes["name"] = codes["name"].fillna("")
    return _records(codes, ["code", "name"])


@router.get("/etf-prices/{code}", response_model=list[schemas.EtfPricePoint])
def etf_prices(code: str):
    prices = _read_csv(DATA_DIR / "prices_daily.csv", dtype={"code": "string"})
    if prices.empty or not {"date", "code", "close"}.issubset(prices.columns):
        return []
    target = _normalize_code(code)
    prices["code"] = prices["code"].map(_normalize_code)
    df = prices[prices["code"] == target].sort_values("date")
    return _records(df, ["date", "close"], {"date"})


@router.get("/report", response_model=schemas.ReportResponse | None)
def report():
    reports = sorted(OUTPUT_DIR.glob("report_*.md")) if OUTPUT_DIR.exists() else []
    if not reports:
        return None
    latest = reports[-1]
    try:
        content = latest.read_text(encoding="utf-8")
    except Exception:
        return None
    return {"content": content, "filename": latest.name}
