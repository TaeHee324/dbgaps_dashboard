from __future__ import annotations

import subprocess
import threading
from datetime import datetime
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

import db
from api import schemas


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output"
DATA_DIR = ROOT / "data"

router = APIRouter(prefix="/api", tags=["dashboard"])

_refresh_state: dict = {"status": "idle", "step": "", "updated_at": ""}


def _run_refresh() -> None:
    global _refresh_state
    try:
        _refresh_state = {"status": "running", "step": "fetching_prices", "updated_at": ""}
        r1 = subprocess.run(
            ["python", "src/update_prices.py"],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        if r1.returncode != 0:
            raise RuntimeError(r1.stderr or "update_prices failed")
        _refresh_state["step"] = "running_engine"
        r2 = subprocess.run(
            ["python", "src/run_engine.py"],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        if r2.returncode != 0:
            raise RuntimeError(r2.stderr or "run_engine failed")
        _refresh_state = {"status": "done", "step": "done", "updated_at": pd.Timestamp.now().isoformat()}
    except Exception:
        _refresh_state = {"status": "error", "step": "error", "updated_at": pd.Timestamp.now().isoformat()}


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


def _active_portfolio_names() -> set[str] | None:
    try:
        db.init_db()
        return {str(item["name"]) for item in db.list_portfolios()}
    except Exception:
        return None


@router.get("/portfolio-summary", response_model=schemas.PortfolioSummary | None)
def portfolio_summary():
    df = _read_csv(OUTPUT_DIR / "portfolio_summary.csv")
    if df.empty:
        return None
    base_columns = [
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
    extra_columns = [
        "sortino",
        "information_ratio",
        "mdd_duration",
        "win_rate_monthly",
        "var_95",
        "tail_ratio",
    ]
    row = df.iloc[0]
    result = {col: float(_clean_scalar(row[col] if col in df.columns else 0.0)) for col in base_columns}
    for col in extra_columns:
        if col in df.columns:
            val = _clean_scalar(row[col])
            result[col] = int(val) if col == "mdd_duration" else (float(val) if val is not None else None)
        else:
            result[col] = None
    return result


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
    active_names = _active_portfolio_names()
    if active_names is not None and "portfolio_name" in df.columns:
        df = df[df["portfolio_name"].isin(active_names)]
    base_cols = ["portfolio_name", "cagr", "mdd", "sharpe", "calmar"]
    extra_cols = [c for c in ["sortino", "annual_volatility", "win_rate"] if c in df.columns]
    return _records(df, base_cols + extra_cols)


@router.get("/comparison/nav", response_model=dict[str, list[schemas.ComparisonNavPoint]])
def comparison_nav():
    comparison_dir = OUTPUT_DIR / "comparison"
    if not comparison_dir.exists():
        return {}
    active_names = _active_portfolio_names()
    result: dict[str, list[dict]] = {}
    for path in sorted(comparison_dir.glob("*_nav.csv")):
        df = _read_csv(path)
        name = path.name.removesuffix("_nav.csv")
        if active_names is not None and name not in active_names:
            continue
        cols = ["date", "portfolio_value", "cumulative_return"]
        if "drawdown" in df.columns:
            cols.append("drawdown")
        result[name] = _records(df, cols, {"date"})
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

    # prices_daily DB — 코드별 최신 종가 및 날짜
    prices_latest: dict[str, tuple[float, str]] = {}  # code -> (close, date_str)
    try:
        prices_df = db.load_prices_from_db()
        if not prices_df.empty:
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


@router.get("/actual-nav", response_model=list[schemas.NavPoint])
def actual_nav():
    """trade_log DB 기반 실제 운용 NAV 시계열. cash = 초기자본 - 누적 매수원금 + 매도 회수금."""
    INITIAL_CAPITAL = 1_000_000_000

    # 1. DB에서 거래 내역 전체 읽기
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT date, action, etf_code, quantity, price "
                    "FROM trade_log "
                    "WHERE quantity IS NOT NULL AND price IS NOT NULL "
                    "ORDER BY date ASC, id ASC"
                )
                trade_rows = cur.fetchall()
    except Exception:
        return []

    if not trade_rows:
        return []

    # 2. prices_daily DB 읽기
    prices_df = db.load_prices_from_db()
    if prices_df.empty:
        return []

    prices_df = prices_df.sort_values("date")

    # 3. 거래 내역을 날짜별로 집계 (누적 보유 상태 계산용)
    trade_list = []
    for r in trade_rows:
        trade_list.append({
            "date": pd.to_datetime(r["date"]),
            "action": str(r["action"]),
            "code": _normalize_code(r["etf_code"]),
            "quantity": float(r["quantity"]),
            "price": float(r["price"]),
        })

    # 4. 거래 첫날부터 가격 데이터 마지막 날까지 일별 포트폴리오 가치 계산
    first_trade_date = min(t["date"] for t in trade_list)
    all_dates = prices_df["date"].unique()
    all_dates = sorted(d for d in all_dates if d >= first_trade_date)

    if not all_dates:
        return []

    # 가격 pivot: date × code
    price_pivot = prices_df.pivot_table(index="date", columns="code", values="close", aggfunc="last").ffill()

    holdings: dict[str, float] = {}   # code -> quantity
    cost_basis: dict[str, float] = {} # code -> total cost
    cumulative_buy_cost = 0.0         # 누적 매수원금
    cumulative_sell_proceeds = 0.0    # 누적 매도 회수금

    trade_idx = 0
    nav_list: list[dict] = []
    prev_total_value: float | None = None

    for dt in all_dates:
        # 해당 날짜의 거래 반영
        while trade_idx < len(trade_list) and trade_list[trade_idx]["date"] <= dt:
            t = trade_list[trade_idx]
            code = t["code"]
            qty = t["quantity"]
            price = t["price"]
            action = t["action"]

            if action in ("매수", "리밸런싱"):
                holdings[code] = holdings.get(code, 0.0) + qty
                cost_basis[code] = cost_basis.get(code, 0.0) + qty * price
                cumulative_buy_cost += qty * price
            elif action == "매도":
                held = holdings.get(code, 0.0)
                sold = min(qty, held)
                holdings[code] = held - sold
                if held > 0:
                    avg = cost_basis.get(code, 0.0) / held
                    cost_basis[code] = cost_basis.get(code, 0.0) - avg * sold
                cumulative_sell_proceeds += sold * price
            trade_idx += 1

        # 해당 날짜 포트폴리오 가치 계산
        portfolio_value = 0.0
        for code, qty in holdings.items():
            if qty <= 0:
                continue
            if dt in price_pivot.index and code in price_pivot.columns:
                close = price_pivot.at[dt, code]
                if not pd.isna(close):
                    portfolio_value += qty * close

        cash = INITIAL_CAPITAL - cumulative_buy_cost + cumulative_sell_proceeds
        total_value = portfolio_value + cash

        if total_value <= 0:
            continue

        daily_return = 0.0
        if prev_total_value is not None and prev_total_value > 0:
            daily_return = (total_value - prev_total_value) / prev_total_value

        cumulative_return = (total_value - INITIAL_CAPITAL) / INITIAL_CAPITAL if INITIAL_CAPITAL > 0 else 0.0

        nav_list.append({
            "date": dt,
            "portfolio_value": total_value,
            "daily_return": daily_return,
            "cumulative_return": cumulative_return,
            "cash": cash,
        })
        prev_total_value = total_value

    if not nav_list:
        return []

    # drawdown 계산
    peak = 0.0
    result = []
    for i, row in enumerate(nav_list):
        pv = row["portfolio_value"]
        if pv > peak:
            peak = pv
        drawdown = (pv - peak) / peak if peak > 0 else 0.0
        result.append({
            "date": _format_date(row["date"]),
            "portfolio_value": round(pv, 2),
            "daily_return": round(row["daily_return"], 6),
            "cumulative_return": round(row["cumulative_return"], 6),
            "drawdown": round(drawdown, 6),
            "cash": round(row["cash"], 2),
        })

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


@router.get("/live-rules", response_model=schemas.RulesResponse | None)
def live_rules():
    """live holdings 기반 규칙 체크. src/rules.py import 없이 직접 구현."""
    live = _calc_live_holdings()
    if not live:
        return None

    total_mv = sum(h["market_value"] for h in live)
    if total_mv <= 0:
        return None

    INDIVIDUAL_LIMIT = 0.20
    RISK_ASSET_LIMIT = 0.70

    # 세부 자산군별 상한 (asset_class -> limit)
    ASSET_CLASS_LIMITS: dict[str, float] = {
        "국내주식_지수": 0.30,
        "국내주식_섹터": 0.15,
        "해외주식_지수": 0.30,
        "해외주식_섹터": 0.10,
        "FX 및 원자재": 0.20,
        "국내채권_종합": 0.50,
        "국내채권_회사채": 0.30,
        "해외채권_종합": 0.50,
        "해외채권_회사채": 0.30,
        "금리연계형/초단기채권": 0.50,
    }

    individual: list[dict] = []
    for h in live:
        w = h["market_value"] / total_mv
        individual.append({
            "code": h["code"],
            "name": h["name"],
            "current_weight": round(w, 6),
            "limit": INDIVIDUAL_LIMIT,
            "excess": round(w - INDIVIDUAL_LIMIT, 6),
            "passed": w <= INDIVIDUAL_LIMIT,
        })

    # 위험자산 비중 (risk_type == "위험")
    risky_labels = {"위험", "위험자산", "risk", "risky"}
    risky_weight = sum(
        h["market_value"] / total_mv
        for h in live
        if str(h.get("risk_type", "")).lower() in {lbl.lower() for lbl in risky_labels}
    )

    # 세부 자산군 비중 체크 — asset_class 기준 합산
    asset_class_weights: dict[str, float] = {}
    for h in live:
        ac = str(h.get("asset_class", ""))
        w = h["market_value"] / total_mv
        asset_class_weights[ac] = asset_class_weights.get(ac, 0.0) + w

    # 자산군 한도 위반 시 risk_asset 항목에 반영 (가장 심각한 위반 우선)
    # 기본 위험자산 체크를 먼저 구성
    risk_asset = {
        "rule": "risk_asset_limit",
        "risky_weight": round(risky_weight, 6),
        "limit": RISK_ASSET_LIMIT,
        "excess": round(risky_weight - RISK_ASSET_LIMIT, 6),
        "passed": risky_weight <= RISK_ASSET_LIMIT,
    }

    # 세부 자산군 위반 항목을 individual에 추가 (자산군 집계 항목으로 표시)
    for ac, limit in ASSET_CLASS_LIMITS.items():
        w = asset_class_weights.get(ac, 0.0)
        if w > 0:
            individual.append({
                "code": f"[{ac}]",
                "name": f"자산군: {ac}",
                "current_weight": round(w, 6),
                "limit": limit,
                "excess": round(w - limit, 6),
                "passed": w <= limit,
            })

    return {
        "individual": individual,
        "risk_asset": risk_asset,
    }


@router.post("/refresh-prices", status_code=202)
def refresh_prices(background_tasks: BackgroundTasks) -> dict:
    global _refresh_state
    if _refresh_state["status"] == "running":
        return {"status": "already_running"}
    _refresh_state = {"status": "running", "step": "", "updated_at": ""}
    background_tasks.add_task(_run_refresh)
    return {"status": "started"}


@router.get("/refresh-status")
def refresh_status() -> dict:
    return _refresh_state


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
