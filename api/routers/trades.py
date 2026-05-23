from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter

from api import schemas


ROOT = Path(__file__).resolve().parents[2]
TRADE_LOG_PATH = ROOT / "data" / "trade_log.json"

router = APIRouter(prefix="/api", tags=["trades"])


def _read_trade_log() -> list[dict]:
    if not TRADE_LOG_PATH.exists():
        return []
    try:
        data = json.loads(TRADE_LOG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    return data if isinstance(data, list) else []


@router.get("/trade-log", response_model=list[schemas.TradeLogEntry])
def trade_log():
    return _read_trade_log()


@router.post("/trade-log", response_model=schemas.AddTradeResponse)
def add_trade(payload: schemas.AddTradeRequest):
    entries = _read_trade_log()
    item = payload.model_dump()
    entries.append(item)
    TRADE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    TRADE_LOG_PATH.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return item
