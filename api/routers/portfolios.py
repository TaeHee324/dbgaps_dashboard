from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Response, status

import db
from api import schemas


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
SRC = ROOT / "src"
ETF_MASTER_PATH = DATA_DIR / "etf_master.csv"
COMPARISON_OUTPUT = ROOT / "output" / "comparison"
BENCHMARK_CODE = "069500"

router = APIRouter(prefix="/api", tags=["portfolios"])


def _normalize_code(value: object) -> str:
    code = "" if pd.isna(value) else str(value).strip()
    return code.zfill(6) if code.isdigit() else code


def _format_date(value: object) -> str:
    ts = pd.to_datetime(value, errors="coerce")
    if pd.isna(ts):
        return ""
    return ts.strftime("%Y-%m-%d")


def _safe_float(value: object) -> float:
    if value is None or pd.isna(value):
        return 0.0
    return float(value)


def _ensure_db() -> bool:
    try:
        db.init_db()
        return True
    except Exception:
        return False


def _delete_comparison_outputs(name: str) -> None:
    """Remove generated comparison artifacts for a deleted portfolio."""
    if not COMPARISON_OUTPUT.exists():
        return

    nav_path = COMPARISON_OUTPUT / f"{Path(name).name}_nav.csv"
    if nav_path.exists():
        nav_path.unlink()

    summary_path = COMPARISON_OUTPUT / "summary.csv"
    if not summary_path.exists():
        return

    summary = pd.read_csv(summary_path)
    if "portfolio_name" not in summary.columns:
        return

    filtered = summary[summary["portfolio_name"] != name]
    if len(filtered) == len(summary):
        return
    filtered.to_csv(summary_path, index=False)


@router.get("/portfolios", response_model=list[schemas.Portfolio])
def list_portfolios():
    if not _ensure_db():
        return []
    try:
        return [
            {"name": item["name"], "group_name": item.get("group_name")}
            for item in db.list_portfolios()
        ]
    except Exception:
        return []


@router.get("/portfolios/{name}", response_model=list[schemas.PortfolioHolding])
def get_portfolio(name: str):
    if not _ensure_db():
        raise HTTPException(status_code=404, detail="not found")
    holdings = db.get_portfolio(name)
    if holdings is None:
        raise HTTPException(status_code=404, detail="not found")
    return holdings


@router.post("/portfolios", response_model=schemas.PortfolioUpsertResponse)
def upsert_portfolio(payload: schemas.PortfolioUpsertRequest):
    if not _ensure_db():
        raise HTTPException(status_code=503, detail="database unavailable")
    holdings = [
        {"code": _normalize_code(holding.code), "weight": holding.weight}
        for holding in payload.holdings
    ]
    db.upsert_portfolio(payload.name, holdings, group_name=payload.group_name)

    # 백테스트 자동 실행 (best-effort)
    try:
        import sys as _sys
        if str(SRC) not in _sys.path:
            _sys.path.insert(0, str(SRC))
        import pandas as _pd
        from backtest import run_backtest, summarize_backtest  # noqa: E402

        INITIAL_VALUE = 100_000_000

        _prices = db.load_prices_from_db()
        if not _prices.empty:
            _weights = _pd.Series({h["code"]: h["weight"] for h in holdings})
            _bt = run_backtest(_prices, _weights, initial_value=INITIAL_VALUE)
            _summary = summarize_backtest(_bt, None)

            COMPARISON_OUTPUT.mkdir(parents=True, exist_ok=True)
            _safe_name = Path(payload.name).name  # strip path separators
            _bt[["date", "portfolio_value", "cumulative_return", "drawdown"]].to_csv(
                COMPARISON_OUTPUT / f"{_safe_name}_nav.csv", index=False
            )

            # summary.csv 갱신: 기존 행 교체 또는 신규 추가
            _summary_path = COMPARISON_OUTPUT / "summary.csv"
            _new_row = _pd.DataFrame([{
                "portfolio_name": payload.name,
                "cagr": _summary["cagr"],
                "mdd": _summary["mdd"],
                "sharpe": _summary["sharpe"],
                "calmar": _summary["calmar"],
                "sortino": _summary.get("sortino"),
                "annual_volatility": _summary.get("annual_volatility"),
                "win_rate": _summary.get("win_rate"),
            }])
            if _summary_path.exists():
                _existing = _pd.read_csv(_summary_path)
                _existing = _existing[_existing["portfolio_name"] != payload.name]
                _merged = _pd.concat([_existing, _new_row], ignore_index=True)
            else:
                _merged = _new_row
            _merged.to_csv(_summary_path, index=False)
    except Exception:
        pass  # 백테스트 실패해도 저장 자체는 성공

    return {"name": payload.name, "holdings": holdings, "group_name": payload.group_name}


@router.delete("/portfolios/{name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(name: str):
    if not _ensure_db() or db.get_portfolio(name) is None:
        raise HTTPException(status_code=404, detail="not found")
    try:
        db.delete_portfolio(name)
        _delete_comparison_outputs(name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _nav_records(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    records = []
    for _, row in df.iterrows():
        records.append(
            {
                "date": _format_date(row["date"]),
                "portfolio_value": _safe_float(row["portfolio_value"]),
                "daily_return": _safe_float(row["daily_return"]),
                "cumulative_return": _safe_float(row["cumulative_return"]),
                "drawdown": _safe_float(row["drawdown"]),
            }
        )
    return records


def _monthly_records(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    return [
        {
            "year": int(row["year"]),
            "month": int(row["month"]),
            "monthly_return": _safe_float(row["monthly_return"]),
        }
        for _, row in df.iterrows()
    ]


def _summary_record(summary: dict) -> dict:
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
    return {column: _safe_float(summary.get(column)) for column in columns}


def _load_master() -> pd.DataFrame:
    if not ETF_MASTER_PATH.exists():
        return pd.DataFrame(columns=["code", "name", "risk_type"])
    master = pd.read_csv(ETF_MASTER_PATH, dtype={"code": "string"})
    if "code" in master.columns:
        master["code"] = master["code"].map(_normalize_code)
    return master


def _rules_for_holdings(holdings: list[schemas.PortfolioHolding]) -> dict:
    from rules import check_individual_etf_limit, check_risk_asset_limit

    portfolio = pd.DataFrame(
        [{"code": _normalize_code(item.code), "weight": float(item.weight)} for item in holdings]
    )
    master = _load_master()
    merge_columns = [column for column in ["code", "name", "risk_type"] if column in master.columns]
    if merge_columns:
        portfolio = portfolio.merge(master[merge_columns], on="code", how="left")
    if "name" not in portfolio.columns:
        portfolio["name"] = portfolio["code"]
    portfolio["name"] = portfolio["name"].fillna(portfolio["code"])
    if "risk_type" not in portfolio.columns:
        portfolio["risk_type"] = ""
    portfolio["risk_type"] = portfolio["risk_type"].fillna("")

    individual = check_individual_etf_limit(portfolio, limit=0.20, weight_col="weight")
    risk_asset = check_risk_asset_limit(portfolio, limit=0.70, weight_col="weight")
    individual = individual.rename(columns={"weight": "current_weight"})
    return {
        "individual": [
            {
                "code": _normalize_code(row["code"]),
                "name": str(row.get("name") or row["code"]),
                "current_weight": _safe_float(row["current_weight"]),
                "limit": _safe_float(row["limit"]),
                "excess": _safe_float(row["excess"]),
                "passed": bool(row["passed"]),
            }
            for _, row in individual.iterrows()
        ],
        "risk_asset": {
            "rule": str(risk_asset["rule"]),
            "risky_weight": _safe_float(risk_asset["risky_weight"]),
            "limit": _safe_float(risk_asset["limit"]),
            "excess": _safe_float(risk_asset["excess"]),
            "passed": bool(risk_asset["passed"]),
        },
    }


@router.post("/backtest", response_model=schemas.BacktestResponse)
def run_backtest(payload: schemas.BacktestRequest):
    if str(SRC) not in sys.path:
        sys.path.insert(0, str(SRC))

    from backtest import benchmark_nav, run_backtest, summarize_backtest
    from metrics import monthly_returns

    if not payload.holdings:
        raise HTTPException(status_code=422, detail="holdings must not be empty")

    try:
        prices = db.load_prices_from_db()
        if prices.empty:
            raise HTTPException(status_code=503, detail="가격 데이터가 없습니다. 먼저 현재가 갱신을 실행하세요.")
        if payload.start_date:
            prices = prices[prices["date"] >= pd.to_datetime(payload.start_date)]
        if payload.end_date:
            prices = prices[prices["date"] <= pd.to_datetime(payload.end_date)]

        weights = pd.Series(
            {
                _normalize_code(holding.code): float(holding.weight)
                for holding in payload.holdings
            }
        )
        if weights.sum() <= 0:
            raise ValueError("portfolio weights must sum to a positive value")
        weights = weights / weights.sum()

        result = run_backtest(prices, weights)
        benchmark = None
        try:
            benchmark = benchmark_nav(prices, BENCHMARK_CODE)
        except Exception:
            benchmark = None

        summary = summarize_backtest(result, benchmark=benchmark)
        monthly = monthly_returns(result)
        return {
            "nav": _nav_records(result),
            "summary": _summary_record(summary),
            "monthly": _monthly_records(monthly),
            "rules": _rules_for_holdings(payload.holdings),
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
