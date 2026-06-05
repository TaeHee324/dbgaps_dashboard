from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

import db
from api.schemas import CalendarEvent, CalendarWeeklySummary

router = APIRouter(prefix="/api", tags=["calendar"])

_KST_EXPR = "to_char(event_time AT TIME ZONE COALESCE(timezone, 'UTC') AT TIME ZONE 'Asia/Seoul', 'HH24:MI')"

_BASE_COLS = f"""
    id,
    event_date,
    event_date_end,
    title,
    event_type,
    category,
    country,
    importance,
    period,
    release_type,
    measurement,
    unit,
    previous,
    consensus,
    forecast,
    actual,
    surprise_dir,
    status,
    affected_assets,
    portfolio_note,
    description,
    metadata,
    {_KST_EXPR} AS kst_time
"""


def _row_to_event(row: dict) -> CalendarEvent:
    return CalendarEvent(
        id=row["id"],
        event_date=row["event_date"].isoformat(),
        event_date_end=row["event_date_end"].isoformat() if row["event_date_end"] else None,
        kst_time=row["kst_time"],
        title=row["title"],
        event_type=row["event_type"],
        category=row["category"],
        country=row["country"],
        importance=row["importance"],
        period=row["period"],
        release_type=row["release_type"],
        measurement=row["measurement"],
        unit=row["unit"],
        previous=row["previous"],
        consensus=row["consensus"],
        forecast=row["forecast"],
        actual=row["actual"],
        surprise_dir=row["surprise_dir"],
        status=row["status"],
        affected_assets=row["affected_assets"] or [],
        portfolio_note=row["portfolio_note"],
        description=row["description"],
        metadata=row["metadata"],
    )


@router.get("/calendar/events", response_model=list[CalendarEvent])
def get_calendar_events(
    year: int = Query(..., ge=2020, le=2099),
    month: int = Query(..., ge=1, le=12),
    category: Optional[str] = Query(default=None),
    country: Optional[str] = Query(default=None),
    importance_min: int = Query(default=1, ge=1, le=3),
):
    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1)
    else:
        month_end = date(year, month + 1, 1)

    conditions = [
        "event_date >= %s",
        "event_date < %s",
        "status != 'cancelled'",
        "importance >= %s",
    ]
    params: list = [month_start, month_end, importance_min]

    if category:
        conditions.append("category = %s")
        params.append(category)
    if country:
        conditions.append("country = %s")
        params.append(country)

    where = " AND ".join(conditions)
    sql = f"SELECT {_BASE_COLS} FROM calendar_events WHERE {where} ORDER BY event_date, importance DESC, event_time"

    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                return [_row_to_event(r) for r in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# IMPORTANT: /events/week must be registered BEFORE /events/{event_id}
@router.get("/calendar/events/week", response_model=list[CalendarEvent])
def get_calendar_week_events():
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=4)

    sql = f"""
        SELECT {_BASE_COLS}
        FROM calendar_events
        WHERE event_date BETWEEN %s AND %s
          AND status != 'cancelled'
        ORDER BY event_date, importance DESC, event_time
    """
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, [week_start, week_end])
                return [_row_to_event(r) for r in cur.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/calendar/events/{event_id}", response_model=CalendarEvent)
def get_calendar_event(event_id: int):
    sql = f"SELECT {_BASE_COLS} FROM calendar_events WHERE id = %s"
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, [event_id])
                row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Event not found")
        return _row_to_event(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/calendar/weekly-summary", response_model=list[CalendarWeeklySummary])
def get_calendar_weekly_summary():
    sql = """
        SELECT
            week_start::text,
            week_end::text,
            total_events,
            critical_count,
            major_count,
            key_events
        FROM calendar_weekly_summary
        ORDER BY week_start
    """
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = cur.fetchall()
        return [
            CalendarWeeklySummary(
                week_start=r["week_start"],
                week_end=r["week_end"],
                total_events=r["total_events"],
                critical_count=r["critical_count"],
                major_count=r["major_count"],
                key_events=r["key_events"] or [],
            )
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
