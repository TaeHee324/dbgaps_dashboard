from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import APIRouter

import db
from api import schemas

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"

router = APIRouter(prefix="/api/risk", tags=["risk"])

INITIAL_CAPITAL = 1_000_000_000


def _normalize_code(value: object) -> str:
    code = "" if pd.isna(value) else str(value).strip()
    return code.zfill(6) if code.isdigit() else code


def _read_csv(path: Path, **kwargs) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    try:
        return pd.read_csv(path, **kwargs)
    except Exception:
        return pd.DataFrame()


def _get_fifo_holdings() -> tuple[list[dict], float]:
    """
    trade_log DB에서 FIFO 보유 현황 + prices_daily.csv 최신 종가 조회.
    반환: (holdings_list, cash)
    holdings_list: [{code, name, quantity, cost_basis, current_price,
                     market_value, risk_type, asset_class}]
    """
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
        return [], float(INITIAL_CAPITAL)

    holdings: dict[str, dict] = {}
    total_buy_cost = 0.0
    total_sell_proceeds = 0.0

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
            total_buy_cost += qty * price
        elif action == "매도":
            if h["quantity"] > 0:
                avg = h["cost_basis"] / h["quantity"]
                sold = min(qty, h["quantity"])
                h["quantity"] -= sold
                h["cost_basis"] -= avg * sold
                total_sell_proceeds += sold * price
                if h["quantity"] <= 0:
                    h["quantity"] = 0.0
                    h["cost_basis"] = 0.0

    # DB 최신 종가
    prices_latest: dict[str, float] = {}
    try:
        prices_df = db.load_prices_from_db()
        if not prices_df.empty:
            idx = prices_df.groupby("code")["date"].idxmax()
            latest_prices = prices_df.loc[idx].set_index("code")
            for c, row in latest_prices.iterrows():
                prices_latest[str(c)] = float(row["close"])
    except Exception:
        pass

    # etf_master.csv risk_type, asset_class
    master_map: dict[str, tuple[str, str]] = {}
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
            qty = data["quantity"]
            cost = data["cost_basis"]
            close = prices_latest.get(code, 0.0)
            market_value = qty * close
            risk_type, asset_class = master_map.get(code, ("", ""))
            result.append({
                "code": code,
                "name": data["name"],
                "quantity": qty,
                "cost_basis": cost,
                "current_price": close,
                "market_value": market_value,
                "risk_type": risk_type,
                "asset_class": asset_class,
            })

    cash = INITIAL_CAPITAL - total_buy_cost + total_sell_proceeds
    return result, cash


def _get_target_weights() -> dict[str, float]:
    """active 포트폴리오의 holdings에서 ETF별 목표 비중 반환."""
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT holdings FROM portfolios WHERE is_active = TRUE LIMIT 1"
                )
                row = cur.fetchone()
        if row is None:
            return {}
        holdings = row["holdings"]
        if isinstance(holdings, str):
            import json
            holdings = json.loads(holdings)
        # holdings = [{"code": "069500", "weight": 0.20}, ...]
        return {str(h["code"]): float(h["weight"]) for h in holdings}
    except Exception:
        return {}


@router.get("/portfolio", response_model=schemas.RiskPortfolioResponse)
def risk_portfolio():
    holdings, _ = _get_fifo_holdings()

    total_mv = sum(h["market_value"] for h in holdings)
    if total_mv > 0:
        weights = [h["market_value"] / total_mv for h in holdings]
        hhi = sum(w ** 2 for w in weights)
    else:
        hhi = 0.0
    hhi_label = "분산양호" if hhi < 0.18 else ("보통" if hhi < 0.25 else "집중경고")

    # 데이터 헬스
    latest_price_date = ""
    business_days_stale = 0
    health_status = "오류"
    try:
        prices_df = db.load_prices_from_db()
        if not prices_df.empty:
            latest_ts = prices_df["date"].max()
            latest_price_date = latest_ts.strftime("%Y-%m-%d")
            today = pd.Timestamp.today().normalize()
            stale = len(pd.bdate_range(latest_ts + pd.Timedelta(days=1), today))
            business_days_stale = int(stale)
            health_status = "정상" if stale <= 1 else ("주의" if stale == 2 else "오류")
    except Exception:
        pass

    return {
        "hhi": hhi,
        "hhi_label": hhi_label,
        "data_health": {
            "latest_price_date": latest_price_date,
            "business_days_stale": business_days_stale,
            "status": health_status,
        },
    }


@router.get("/etf-analysis", response_model=list[schemas.EtfRiskItem])
def etf_analysis():
    holdings, _ = _get_fifo_holdings()
    target_weights = _get_target_weights()

    held = [h for h in holdings if h["quantity"] > 0]
    if not held:
        return []

    total_mv = sum(h["market_value"] for h in held)
    held_codes = [h["code"] for h in held]

    # 가격 이력 pivot
    price_pivot: pd.DataFrame = pd.DataFrame()
    try:
        prices_df = db.load_prices_from_db()
        if not prices_df.empty:
            prices_df = prices_df[prices_df["code"].isin(held_codes)]
            price_pivot = prices_df.pivot_table(
                index="date", columns="code", values="close", aggfunc="last"
            ).ffill()
    except Exception:
        pass

    result = []
    for h in held:
        code = h["code"]
        current_weight = h["market_value"] / total_mv if total_mv > 0 else 0.0
        target_weight = target_weights.get(code)
        weight_drift = (current_weight - target_weight) if target_weight is not None else None

        individual_mdd = 0.0
        current_drawdown = 0.0
        vol_20d = None

        if not price_pivot.empty and code in price_pivot.columns:
            closes = price_pivot[code].dropna()
            if len(closes) >= 2:
                rolling_max = closes.cummax()
                drawdowns = (closes - rolling_max) / rolling_max
                individual_mdd = float(drawdowns.min())
                current_drawdown = float(drawdowns.iloc[-1])
            rets = closes.pct_change().dropna()
            if len(rets) >= 10:
                vol_20d = float(rets.tail(20).std() * np.sqrt(252))

        result.append({
            "code": code,
            "name": h["name"],
            "current_weight": current_weight,
            "target_weight": target_weight,
            "weight_drift": weight_drift,
            "individual_mdd": individual_mdd,
            "current_drawdown": current_drawdown,
            "vol_20d": vol_20d,
            "risk_contribution_pct": None,
        })

    # 위험기여도 계산 (전체 ETF 동시)
    if not price_pivot.empty and len(held_codes) >= 1:
        available = [c for c in held_codes if c in price_pivot.columns]
        if len(available) >= 1:
            rets_1y = price_pivot[available].pct_change().dropna().tail(252)
            if len(rets_1y) >= 20:
                w_arr = np.array([
                    next(h["market_value"] for h in held if h["code"] == c)
                    for c in available
                ]) / total_mv
                cov = rets_1y.cov().values * 252
                port_var = float(w_arr @ cov @ w_arr)
                if port_var > 0:
                    pct = (w_arr * (cov @ w_arr)) / port_var
                    code_to_rc = dict(zip(available, pct.tolist()))
                    for item in result:
                        item["risk_contribution_pct"] = code_to_rc.get(item["code"])

    # 정렬: risk_contribution_pct 내림차순 (None 하단)
    result.sort(
        key=lambda x: (x["risk_contribution_pct"] is None, -(x["risk_contribution_pct"] or 0))
    )

    return result
