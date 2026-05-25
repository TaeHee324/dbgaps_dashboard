from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

import db
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
    base_cols = ["portfolio_name", "cagr", "mdd", "sharpe", "calmar"]
    extra_cols = [c for c in ["sortino", "annual_volatility", "win_rate"] if c in df.columns]
    return _records(df, base_cols + extra_cols)


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
        keep_cols = [c for c in ["code", "name", "risk_type", "asset_class"] if c in master.columns]
        master = master[keep_cols].copy()
        master["code"] = master["code"].map(_normalize_code)
        codes = codes.merge(master, on="code", how="left")
    else:
        codes["name"] = ""
    for col in ["name", "risk_type", "asset_class"]:
        if col not in codes.columns:
            codes[col] = ""
        else:
            codes[col] = codes[col].fillna("")
    return _records(codes, ["code", "name", "risk_type", "asset_class"])


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


@router.get("/reports", response_model=list[schemas.ReportListItem])
def report_list():
    if not OUTPUT_DIR.exists():
        return []
    files = sorted(OUTPUT_DIR.glob("report_*.md"), reverse=True)
    result = []
    for f in files:
        # filename 예: report_202606.md → period: "2026년 06월", title: "DBGAPS 운용보고서 2026년 06월"
        stem = f.stem  # "report_202606"
        raw = stem.replace("report_", "")  # "202606"
        if len(raw) == 6:
            period = f"{raw[:4]}년 {raw[4:]}월"
        else:
            period = raw
        result.append({
            "filename": f.name,
            "title": f"DBGAPS 운용보고서 {period}",
            "period": period,
        })
    return result


@router.get("/report/{filename}", response_model=schemas.ReportResponse | None)
def report_by_filename(filename: str):
    # 경로 traversal 방지: basename만 허용
    safe_name = Path(filename).name
    path = OUTPUT_DIR / safe_name
    if not path.exists() or path.suffix != ".md":
        return None
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return None
    return {"content": content, "filename": safe_name}


def _calc_live_holdings() -> list[dict]:
    """trade_log DB에서 FIFO로 현재 보유종목 계산. src/ import 없이 직접 구현."""
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT date, action, etf_code, etf_name, quantity, price "
                    "FROM trade_log "
                    "WHERE quantity IS NOT NULL AND price IS NOT NULL "
                    "ORDER BY date ASC, id ASC"
                )
                rows = cur.fetchall()
    except Exception:
        return []

    holdings: dict[str, dict] = {}
    for row in rows:
        code = str(row["etf_code"])
        name = str(row["etf_name"])
        qty = float(row["quantity"])
        price = float(row["price"])
        action = str(row["action"])

        if code not in holdings:
            holdings[code] = {"name": name, "quantity": 0.0, "cost_basis": 0.0}

        h = holdings[code]
        if action in ("매수", "리밸런싱"):
            h["quantity"] += qty
            h["cost_basis"] += qty * price
        elif action == "매도":
            if h["quantity"] > 0:
                avg = h["cost_basis"] / h["quantity"]
                sold = min(qty, h["quantity"])
                h["quantity"] -= sold
                h["cost_basis"] -= avg * sold
                if h["quantity"] <= 0:
                    h["quantity"] = 0.0
                    h["cost_basis"] = 0.0

    # prices_daily.csv — 코드별 최신 종가 및 날짜
    prices_latest: dict[str, tuple[float, str]] = {}  # code -> (close, date_str)
    try:
        prices_df = _read_csv(DATA_DIR / "prices_daily.csv", dtype={"code": "string"})
        if not prices_df.empty and {"code", "date", "close"}.issubset(prices_df.columns):
            prices_df["code"] = prices_df["code"].map(_normalize_code)
            prices_df["date"] = pd.to_datetime(prices_df["date"], errors="coerce")
            idx = prices_df.groupby("code")["date"].idxmax()
            latest_prices = prices_df.loc[idx].set_index("code")
            for c, row in latest_prices.iterrows():
                prices_latest[str(c)] = (float(row["close"]), _format_date(row["date"]))
    except Exception:
        pass

    # etf_master.csv — 코드별 risk_type, asset_class
    master_map: dict[str, tuple[str, str]] = {}  # code -> (risk_type, asset_class)
    try:
        master_df = _read_csv(DATA_DIR / "etf_master.csv", dtype={"code": "string"})
        if not master_df.empty and "code" in master_df.columns:
            master_df["code"] = master_df["code"].map(_normalize_code)
            for _, row in master_df.iterrows():
                c = str(row["code"])
                rt = str(row["risk_type"]) if "risk_type" in master_df.columns and not pd.isna(row.get("risk_type")) else ""
                ac = str(row["asset_class"]) if "asset_class" in master_df.columns and not pd.isna(row.get("asset_class")) else ""
                master_map[c] = (rt, ac)
    except Exception:
        pass

    result = []
    for code, data in holdings.items():
        if data["quantity"] > 0:
            qty = round(data["quantity"], 4)
            cost = round(data["cost_basis"], 2)
            avg = round(cost / qty, 2) if qty else 0.0
            close, price_date = prices_latest.get(code, (0.0, ""))
            market_value = round(qty * close, 2)
            unrealized_pnl = round(market_value - cost, 2)
            unrealized_return = round(unrealized_pnl / cost, 6) if cost else 0.0
            risk_type, asset_class = master_map.get(code, ("", ""))
            result.append({
                "code": code,
                "name": data["name"],
                "quantity": qty,
                "avg_price": avg,
                "cost_basis": cost,
                "price_date": price_date,
                "current_price": close,
                "market_value": market_value,
                "unrealized_pnl": unrealized_pnl,
                "unrealized_return": unrealized_return,
                "current_weight": 0.0,  # placeholder; computed below
                "risk_type": risk_type,
                "asset_class": asset_class,
            })

    # current_weight 계산
    total_mv = sum(h["market_value"] for h in result)
    if total_mv > 0:
        for h in result:
            h["current_weight"] = round(h["market_value"] / total_mv, 6)

    return result


@router.get("/live-holdings", response_model=list[schemas.LiveHolding])
def live_holdings():
    return _calc_live_holdings()


@router.get("/portfolio-etfs", response_model=list[schemas.EtfItem])
def portfolio_etfs():
    """현재 보유 중인 ETF 목록 (trade_log 기반). 없으면 current_holdings.csv fallback."""
    live = _calc_live_holdings()
    if live:
        return [{"code": h["code"], "name": h["name"], "risk_type": "", "asset_class": ""} for h in live]
    # fallback: output/current_holdings.csv
    df = _read_csv(OUTPUT_DIR / "current_holdings.csv")
    if df.empty or "code" not in df.columns:
        return []
    return [
        {"code": _normalize_code(row["code"]), "name": str(row.get("name", "")), "risk_type": "", "asset_class": ""}
        for _, row in df.iterrows()
    ]


@router.get("/report-image/{filename}")
def report_image(filename: str):
    safe_name = Path(filename).name
    for ext in (".png", ".jpg", ".jpeg", ".svg", ".webp"):
        path = OUTPUT_DIR / safe_name
        if path.exists() and path.suffix.lower() == ext:
            return FileResponse(str(path))
    raise HTTPException(status_code=404, detail="image not found")


@router.get("/update-log")
def update_log():
    import json as _json
    changelog_path = Path(__file__).resolve().parents[2] / "data" / "CHANGELOG.json"
    if not changelog_path.exists():
        return []
    try:
        return _json.loads(changelog_path.read_text(encoding="utf-8"))
    except Exception:
        return []
