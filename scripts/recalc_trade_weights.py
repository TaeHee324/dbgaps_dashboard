"""
기존 trade_log 레코드의 weight_before/weight_after를 일괄 재계산.
실행: python scripts/recalc_trade_weights.py
주의: 실행 전 DB 백업 권장. 한 번만 실행.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

import db

INITIAL_CAPITAL = 1_000_000_000


def calc_weights(trade_date: str, etf_code: str, action: str,
                 quantity: float, price: float, exclude_trade_id: int) -> tuple[float, float]:
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT action, etf_code, quantity, price
                FROM trade_log
                WHERE date < %s AND id != %s
                  AND quantity IS NOT NULL AND price IS NOT NULL
                ORDER BY date ASC, id ASC
                """,
                (trade_date, exclude_trade_id),
            )
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


def main():
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, date::text, etf_code, action, quantity, price
                FROM trade_log
                WHERE quantity IS NOT NULL AND price IS NOT NULL
                ORDER BY date ASC, id ASC
                """
            )
            trades = cur.fetchall()

    print(f"총 {len(trades)}건 재계산 시작...")

    updated = 0
    errors = 0
    for t in trades:
        tid = t["id"]
        date = str(t["date"])
        code = str(t["etf_code"])
        action = str(t["action"])
        qty = float(t["quantity"])
        price = float(t["price"])
        try:
            wb, wa = calc_weights(date, code, action, qty, price, exclude_trade_id=tid)
            with db.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE trade_log SET weight_before = %s, weight_after = %s WHERE id = %s",
                        (wb, wa, tid),
                    )
                conn.commit()
            print(f"  [{tid}] {date} {code} {action}: before={wb:.4f} after={wa:.4f}")
            updated += 1
        except Exception as e:
            print(f"  [{tid}] 오류: {e}")
            errors += 1

    print(f"\n완료: {updated}건 업데이트, {errors}건 오류")


if __name__ == "__main__":
    main()
