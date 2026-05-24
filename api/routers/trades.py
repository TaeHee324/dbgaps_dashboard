from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

import db
from api import schemas


router = APIRouter(prefix="/api", tags=["trades"])


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
                "weight_before, weight_after, reason, note, strategy_checklist, "
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
            "note": row["note"],
            "strategy_checklist": checklist if isinstance(checklist, list) else [],
            "quantity": float(row["quantity"]) if row["quantity"] is not None else None,
            "price": float(row["price"]) if row["price"] is not None else None,
            "amount": float(row["amount"]) if row["amount"] is not None else None,
        })
    return result


@router.post("/trade-log", response_model=schemas.TradeLogEntry)
def add_trade(payload: schemas.AddTradeRequest):
    _ensure_table()
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO trade_log
                  (date, action, etf_code, etf_name, weight_before, weight_after,
                   reason, note, strategy_checklist, quantity, price, amount)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, date::text, action, etf_code, etf_name,
                          weight_before, weight_after, reason, note, strategy_checklist,
                          quantity, price, amount
                """,
                (
                    payload.date,
                    payload.action,
                    payload.etf_code,
                    payload.etf_name,
                    payload.weight_before,
                    payload.weight_after,
                    payload.reason,
                    payload.note,
                    json.dumps(payload.strategy_checklist, ensure_ascii=False),
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
        "note": row["note"],
        "strategy_checklist": checklist if isinstance(checklist, list) else [],
        "quantity": float(row["quantity"]) if row["quantity"] is not None else None,
        "price": float(row["price"]) if row["price"] is not None else None,
        "amount": float(row["amount"]) if row["amount"] is not None else None,
    }


@router.put("/trade-log/{trade_id}", response_model=schemas.TradeLogEntry)
def update_trade(trade_id: int, payload: schemas.UpdateTradeRequest):
    _ensure_table()
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE trade_log
                SET date = %s, action = %s, etf_code = %s, etf_name = %s,
                    weight_before = %s, weight_after = %s, reason = %s,
                    note = %s, strategy_checklist = %s,
                    quantity = %s, price = %s, amount = %s
                WHERE id = %s
                RETURNING id, date::text, action, etf_code, etf_name,
                          weight_before, weight_after, reason, note, strategy_checklist,
                          quantity, price, amount
                """,
                (
                    payload.date,
                    payload.action,
                    payload.etf_code,
                    payload.etf_name,
                    payload.weight_before,
                    payload.weight_after,
                    payload.reason,
                    payload.note,
                    json.dumps(payload.strategy_checklist, ensure_ascii=False),
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
        "note": row["note"],
        "strategy_checklist": checklist if isinstance(checklist, list) else [],
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
