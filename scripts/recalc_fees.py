"""
기존 trade_log 레코드의 fee를 10원 단위 절사 기준으로 일괄 재계산.
실행: python scripts/recalc_fees.py [--dry-run]
주의: 실행 전 DB 백업 권장. 한 번만 실행.
"""
import sys
import os
import math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

import db


def main():
    dry_run = "--dry-run" in sys.argv

    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, date::text, etf_code, action, quantity, price, fee
                FROM trade_log
                WHERE quantity IS NOT NULL AND price IS NOT NULL
                ORDER BY date ASC, id ASC
                """
            )
            trades = cur.fetchall()

    print(f"총 {len(trades)}건 검사 시작{'(dry-run)' if dry_run else ''}...")

    updated = 0
    skipped = 0
    errors = 0

    for t in trades:
        tid = t["id"]
        date = str(t["date"])
        code = str(t["etf_code"])
        action = str(t["action"])
        qty = float(t["quantity"])
        price = float(t["price"])
        old_fee = t["fee"]

        try:
            new_fee = math.floor(qty * price * 0.001 / 10) * 10

            if old_fee is not None and int(old_fee) == new_fee:
                skipped += 1
                continue

            print(f"  [{tid}] {date} {code} {action}: fee {old_fee} -> {new_fee}")

            if not dry_run:
                with db.get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE trade_log SET fee = %s WHERE id = %s",
                            (new_fee, tid),
                        )
                    conn.commit()
            updated += 1
        except Exception as e:
            print(f"  [{tid}] 오류: {e}")
            errors += 1

    print(f"\n완료: {updated}건 업데이트, {skipped}건 스킵, {errors}건 오류")


if __name__ == "__main__":
    main()
