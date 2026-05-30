from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

import db
from api import schemas


router = APIRouter(prefix="/api", tags=["trades"])


def _calc_weights(
    trade_date: str,
    etf_code: str,
    action: str,
    quantity: float,
    price: float,
    exclude_trade_id: int | None = None,
) -> tuple[float, float]:
    """weight_before, weight_after 계산."""
    INITIAL_CAPITAL = 1_000_000_000

    with db.get_connection() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT action, etf_code, quantity, price
                FROM trade_log
                WHERE date < %s
                  AND quantity IS NOT NULL AND price IS NOT NULL
            """
            params: list = [trade_date]
            if exclude_trade_id is not None:
                query += " AND id != %s"
                params.append(exclude_trade_id)
            query += " ORDER BY date ASC, id ASC"
            cur.execute(query, params)
            rows = cur.fetchall()

    positions: dict[str, dict] = {}
    total_buy = 0.0
    total_sell = 0.0

    for r in rows:
        code = str(r["etf_code"])
        qty = float(r["quantity"])
        p = float(r["price"])
        act = str(r["action"])
        if code not in positions:
            positions[code] = {"qty": 0.0, "cost": 0.0}
        pos = positions[code]
        if act in ("매수", "리밸런싱"):
            pos["qty"] += qty
            pos["cost"] += qty * p
            total_buy += qty * p
        elif act == "매도" and pos["qty"] > 0:
            avg = pos["cost"] / pos["qty"]
            sold = min(qty, pos["qty"])
            pos["qty"] -= sold
            pos["cost"] -= avg * sold
            total_sell += sold * p

    with db.get_connection() as conn:
        with conn.cursor() as cur:
            all_codes = list(positions.keys())
            if etf_code not in all_codes:
                all_codes.append(etf_code)
            cur.execute(
                """
                SELECT DISTINCT ON (code) code, close
                FROM prices_daily
                WHERE code = ANY(%s) AND date <= %s
                ORDER BY code, date DESC
                """,
                (all_codes, trade_date),
            )
            price_rows = cur.fetchall()

    prices_map: dict[str, float] = {str(r["code"]): float(r["close"]) for r in price_rows}
    if etf_code not in prices_map:
        prices_map[etf_code] = price

    etf_market_value = sum(
        pos["qty"] * prices_map.get(code, 0.0)
        for code, pos in positions.items()
        if pos["qty"] > 0
    )
    cash_before = INITIAL_CAPITAL - total_buy + total_sell
    total_nav_before = etf_market_value + cash_before

    etf_qty_before = positions.get(etf_code, {}).get("qty", 0.0)
    etf_val_before = etf_qty_before * prices_map.get(etf_code, price)
    weight_before = etf_val_before / total_nav_before if total_nav_before > 0 else 0.0

    trade_amount = quantity * price
    if action in ("매수", "리밸런싱"):
        etf_qty_after = etf_qty_before + quantity
        cash_after = cash_before - trade_amount
    elif action == "매도":
        etf_qty_after = max(0.0, etf_qty_before - quantity)
        cash_after = cash_before + trade_amount
    else:
        etf_qty_after = etf_qty_before
        cash_after = cash_before

    etf_val_after = etf_qty_after * prices_map.get(etf_code, price)
    other_etf_val = etf_market_value - etf_val_before
    total_nav_after = other_etf_val + etf_val_after + cash_after
    weight_after = etf_val_after / total_nav_after if total_nav_after > 0 else 0.0

    return float(weight_before), float(weight_after)


def _ensure_table() -> None:
    try:
        db.init_trade_log_table()
    except Exception:
        pass


@router.get("/trade-log", response_model=list[schemas.TradeLogEntry])
def trade_log():
    _ensure_table()
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, date::text, action, etf_code, etf_name, "
                "weight_before, weight_after, reason, strategy_checklist, strategy_notes, "
                "quantity, price, amount "
                "FROM trade_log ORDER BY date DESC, id DESC"
            )
            rows = cur.fetchall()
    result = []
    for row in rows:
        checklist = row["strategy_checklist"]
        if isinstance(checklist, str):
            checklist = json.loads(checklist)
        result.append({
            "id": row["id"],
            "date": row["date"],
            "action": row["action"],
            "etf_code": row["etf_code"],
            "etf_name": row["etf_name"],
            "weight_before": float(row["weight_before"]),
            "weight_after": float(row["weight_after"]),
            "reason": row["reason"],
            "strategy_checklist": checklist if isinstance(checklist, list) else [],
            "strategy_notes": (json.loads(row["strategy_notes"]) if isinstance(row["strategy_notes"], str) else row["strategy_notes"]) or {},
            "quantity": float(row["quantity"]) if row["quantity"] is not None else None,
            "price": float(row["price"]) if row["price"] is not None else None,
            "amount": float(row["amount"]) if row["amount"] is not None else None,
        })
    return result


@router.post("/trade-log", response_model=schemas.TradeLogEntry)
def add_trade(payload: schemas.AddTradeRequest):
    _ensure_table()
    # weight 자동 계산 (quantity, price가 있을 때만)
    weight_before = 0.0
    weight_after = 0.0
    if payload.quantity and payload.price:
        weight_before, weight_after = _calc_weights(
            payload.date, payload.etf_code, payload.action,
            float(payload.quantity), float(payload.price)
        )
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO trade_log
                  (date, action, etf_code, etf_name, weight_before, weight_after,
                   reason, strategy_checklist, strategy_notes, quantity, price, amount)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, date::text, action, etf_code, etf_name,
                          weight_before, weight_after, reason, strategy_checklist, strategy_notes,
                          quantity, price, amount
                """,
                (
                    payload.date,
                    payload.action,
                    payload.etf_code,
                    payload.etf_name,
                    weight_before,
                    weight_after,
                    payload.reason,
                    json.dumps(payload.strategy_checklist, ensure_ascii=False),
                    json.dumps(payload.strategy_notes, ensure_ascii=False),
                    payload.quantity,
                    payload.price,
                    payload.amount,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    checklist = row["strategy_checklist"]
    if isinstance(checklist, str):
        checklist = json.loads(checklist)
    return {
        "id": row["id"],
        "date": row["date"],
        "action": row["action"],
        "etf_code": row["etf_code"],
        "etf_name": row["etf_name"],
        "weight_before": float(row["weight_before"]),
        "weight_after": float(row["weight_after"]),
        "reason": row["reason"],
        "strategy_checklist": checklist if isinstance(checklist, list) else [],
        "strategy_notes": (json.loads(row["strategy_notes"]) if isinstance(row["strategy_notes"], str) else row["strategy_notes"]) or {},
        "quantity": float(row["quantity"]) if row["quantity"] is not None else None,
        "price": float(row["price"]) if row["price"] is not None else None,
        "amount": float(row["amount"]) if row["amount"] is not None else None,
    }


@router.put("/trade-log/{trade_id}", response_model=schemas.TradeLogEntry)
def update_trade(trade_id: int, payload: schemas.UpdateTradeRequest):
    _ensure_table()
    # weight 자동 계산 (quantity, price가 있을 때만)
    weight_before = 0.0
    weight_after = 0.0
    if payload.quantity and payload.price:
        weight_before, weight_after = _calc_weights(
            payload.date, payload.etf_code, payload.action,
            float(payload.quantity), float(payload.price),
            exclude_trade_id=trade_id,
        )
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE trade_log
                SET date = %s, action = %s, etf_code = %s, etf_name = %s,
                    weight_before = %s, weight_after = %s, reason = %s,
                    strategy_checklist = %s, strategy_notes = %s,
                    quantity = %s, price = %s, amount = %s
                WHERE id = %s
                RETURNING id, date::text, action, etf_code, etf_name,
                          weight_before, weight_after, reason, strategy_checklist, strategy_notes,
                          quantity, price, amount
                """,
                (
                    payload.date,
                    payload.action,
                    payload.etf_code,
                    payload.etf_name,
                    weight_before,
                    weight_after,
                    payload.reason,
                    json.dumps(payload.strategy_checklist, ensure_ascii=False),
                    json.dumps(payload.strategy_notes, ensure_ascii=False),
                    payload.quantity,
                    payload.price,
                    payload.amount,
                    trade_id,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
    checklist = row["strategy_checklist"]
    if isinstance(checklist, str):
        checklist = json.loads(checklist)
    return {
        "id": row["id"],
        "date": row["date"],
        "action": row["action"],
        "etf_code": row["etf_code"],
        "etf_name": row["etf_name"],
        "weight_before": float(row["weight_before"]),
        "weight_after": float(row["weight_after"]),
        "reason": row["reason"],
        "strategy_checklist": checklist if isinstance(checklist, list) else [],
        "strategy_notes": (json.loads(row["strategy_notes"]) if isinstance(row["strategy_notes"], str) else row["strategy_notes"]) or {},
        "quantity": float(row["quantity"]) if row["quantity"] is not None else None,
        "price": float(row["price"]) if row["price"] is not None else None,
        "amount": float(row["amount"]) if row["amount"] is not None else None,
    }


@router.delete("/trade-log/{trade_id}", status_code=204)
def delete_trade(trade_id: int):
    _ensure_table()
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM trade_log WHERE id = %s", (trade_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
        conn.commit()
