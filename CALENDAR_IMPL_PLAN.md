# 캘린더 탭 구현 계획 — 실행용 최종본

> 이 문서는 새 세션에서 즉시 실행하기 위한 완전 자립형 계획서다.
> 기존 코드와의 충돌 점검 완료 버전.

---

## 0. 컨텍스트 요약 (새 세션용)

### 프로젝트 스택
- **백엔드**: FastAPI + psycopg2 + Railway PostgreSQL (`db.py` 공용 모듈)
- **프론트엔드**: Next.js 15 App Router + React 19 + TypeScript + Tailwind CSS 4 + TanStack Query v5
- **API 패턴**: `lib/api.ts`의 `get()` 래퍼 사용. 상대 URL `/api/...` 금지 — `NEXT_PUBLIC_API_URL` 접두어 필수 (get() 자동 처리)

### DB 현황
- `calendar_events` 테이블: **355건** (2026-06-01 ~ 2026-06-30)
- `calendar_weekly_summary` 뷰: 존재 확인
- 스키마 전체: `CALENDAR_DB_SPEC.md` 참조

### 기존 API 라우터 구조
```
api/routers/dashboard.py   prefix="/api", tags=["dashboard"]
api/routers/portfolios.py  prefix="/api", tags=["portfolios"]
api/routers/trades.py      prefix="/api", tags=["trades"]
api/routers/risk.py        prefix="/api", tags=["risk"]
```
모든 라우터는 `APIRouter(prefix="/api", ...)` 패턴 사용.

### 구현 대상 Route
`/market` (기존 플레이스홀더) → 경제 캘린더로 교체.
네비 레이블: "시황" → "시황·캘린더"

---

## 1. 충돌 점검 결과

### ✅ 안전 확인 항목

| 항목 | 결과 |
|------|------|
| 신규 API 경로 `/api/calendar/...` | 기존 경로 전체와 충돌 없음 |
| `api/schemas.py` 추가 모델 | 기존 모델 무수정, 파일 하단에 append만 |
| `lib/hooks/calendar.ts` | 신규 파일 (dashboard/portfolio/trades.ts와 독립) |
| TanStack Query key | `["calendar-events", ...]` — 기존 key 전부와 충돌 없음 |
| `components/calendar/` | 신규 디렉토리, 기존 charts/ui와 독립 |
| CRITICAL-1 | `calendar.py`는 `src/` import 없음, `db.py`만 사용 |
| CRITICAL-2 | yfinance import 없음 |
| CRITICAL-5 | 훅에서 `get()` 사용, 상대 URL 없음 |

### ⚠️ 반드시 지켜야 할 사항 (실수 빈도 높음)

**W-1: FastAPI 라우트 순서 — `/events/week`를 `/events/{event_id}` 앞에 등록**
```python
# calendar.py 라우터 등록 순서 (이 순서 바꾸면 "week"가 int로 파싱되어 422 에러)
@router.get("/calendar/events/week")        # ← 먼저
@router.get("/calendar/events/{event_id}")  # ← 나중에
```

**W-2: psycopg2 DATE → str 변환 필수**
```python
# psycopg2 RealDictCursor는 DATE 컬럼을 datetime.date 객체로 반환
# Pydantic 모델에 str 필드이므로 명시적 변환 필요
"event_date": row["event_date"].isoformat(),
"event_date_end": row["event_date_end"].isoformat() if row["event_date_end"] else None,
```

**W-3: affected_assets NULL 처리**
```python
# NULL인 경우 빈 리스트로 정규화
"affected_assets": row["affected_assets"] or [],
```

**W-4: `"use client"` 지시어**
- `app/market/page.tsx`: useState/context 사용 → `"use client"` 필수
- `app/market/CalendarContext.tsx`: createContext 사용 → `"use client"` 필수
- `components/calendar/` 하위 모든 파일: 이벤트 핸들러/state 사용 → `"use client"` 필수

**W-5: CalendarContext는 `app/market/` 내부에 배치**
- `lib/contexts/` 신규 디렉토리 생성 불필요 (페이지 전용 context)
- `app/market/CalendarContext.tsx`로 배치 → 단순하고 스코프 명확

**W-6: 훅 파라미터의 queryKey 배열**
```typescript
// 월 변경 시 자동 refetch되도록 year, month를 key에 포함
queryKey: ["calendar-events", year, month, filters]
// filters 객체는 JSON.stringify하지 말고 spread
queryKey: ["calendar-events", year, month, filters.category, filters.country, filters.importance_min]
```

**W-7: staleTime 오버라이드**
```typescript
// 캘린더 데이터는 일 단위 갱신 → 기본 60초보다 긴 staleTime 적용
staleTime: 5 * 60 * 1000,  // 5분
```

---

## 2. 실행 순서 및 파일 명세

```
Phase 1 — 백엔드 (순서 의존)
  1-A. api/schemas.py              CalendarEvent, CalendarWeeklySummary 추가
  1-B. api/routers/calendar.py     신규 파일
  1-C. api/main.py                 calendar 라우터 import + register

Phase 2 — 프론트 기반 (1-A 완료 후)
  2-A. lib/hooks/calendar.ts       신규 파일

Phase 3 — 컴포넌트 (2-A 완료 후, 3-* 는 병렬 가능)
  3-A. components/calendar/EventBadge.tsx
  3-B. components/calendar/DayDetailPanel.tsx
  3-C. components/calendar/MonthGrid.tsx
  3-D. components/calendar/WeekView.tsx
  3-E. components/calendar/ListView.tsx
  3-F. components/calendar/CalendarHeader.tsx

Phase 4 — 페이지 조립 (3-* 완료 후)
  4-A. app/market/CalendarContext.tsx
  4-B. app/market/page.tsx          플레이스홀더 → 전체 교체
  4-C. app/layout.tsx               "시황" → "시황·캘린더"
```

---

## 3. Phase 1 — 백엔드

### 1-A. `api/schemas.py` 하단에 추가 (기존 코드 무수정)

```python
# ── Calendar ──────────────────────────────────────────────────────────────────

class CalendarEvent(BaseModel):
    id: int
    event_date: str                        # "YYYY-MM-DD"
    event_date_end: str | None             # 복수일 이벤트 종료일
    kst_time: str | None                   # "HH:MM" (서버에서 KST 변환 완료)
    title: str
    event_type: str
    category: str
    country: str | None
    importance: int                        # 1=참고 2=주의 3=핵심
    period: str | None
    release_type: str | None
    measurement: str | None
    unit: str | None
    previous: str | None
    consensus: str | None
    forecast: str | None
    actual: str | None
    surprise_dir: int | None               # +1/0/-1/None
    status: str
    affected_assets: list[str]             # 빈 배열로 정규화
    portfolio_note: str | None
    description: str | None
    metadata: dict | None


class CalendarWeeklySummary(BaseModel):
    week_start: str
    week_end: str
    total_events: int
    critical_count: int
    major_count: int
    key_events: list[str]
```

---

### 1-B. `api/routers/calendar.py` 신규 생성

```python
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

import db
from api.schemas import CalendarEvent, CalendarWeeklySummary

router = APIRouter(prefix="/api", tags=["calendar"])

# ─── helpers ──────────────────────────────────────────────────────────────────

_KST_EXPR = """
    to_char(
        event_time AT TIME ZONE COALESCE(timezone, 'UTC') AT TIME ZONE 'Asia/Seoul',
        'HH24:MI'
    )
""".strip()

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


# ─── endpoints ────────────────────────────────────────────────────────────────

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


# W-1: /events/week 는 /events/{event_id} 보다 먼저 등록해야 함
@router.get("/calendar/events/week", response_model=list[CalendarEvent])
def get_calendar_week_events():
    """현재 주(월~금) 이벤트 전체 반환."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # 월요일
    week_end = week_start + timedelta(days=4)             # 금요일

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
```

---

### 1-C. `api/main.py` 수정

```python
# 기존 import 줄에 calendar 추가
from api.routers import dashboard, portfolios, risk, trades, calendar

# 기존 include_router 줄 아래에 추가
app.include_router(calendar.router)
```

---

## 4. Phase 2 — 프론트엔드 훅

### 2-A. `frontend/lib/hooks/calendar.ts` 신규 생성

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarEvent = {
  id: number;
  event_date: string;           // "YYYY-MM-DD"
  event_date_end: string | null;
  kst_time: string | null;      // "HH:MM" or null
  title: string;
  event_type: string;
  category: string;
  country: string | null;
  importance: number;           // 1 | 2 | 3
  period: string | null;
  release_type: string | null;
  measurement: string | null;
  unit: string | null;
  previous: string | null;
  consensus: string | null;
  forecast: string | null;
  actual: string | null;
  surprise_dir: number | null;  // 1 | 0 | -1 | null
  status: string;
  affected_assets: string[];
  portfolio_note: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
};

export type CalendarWeeklySummary = {
  week_start: string;
  week_end: string;
  total_events: number;
  critical_count: number;
  major_count: number;
  key_events: string[];
};

export type CalendarFilters = {
  category?: string;
  country?: string;
  importance_min?: number;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  return sp.toString() ? `?${sp.toString()}` : "";
}

export function useCalendarEvents(
  year: number,
  month: number,
  filters: CalendarFilters = {}
) {
  const { category, country, importance_min = 1 } = filters;
  return useQuery({
    queryKey: ["calendar-events", year, month, category, country, importance_min],
    queryFn: () =>
      get<CalendarEvent[]>(
        `/api/calendar/events${buildQuery({ year, month, category, country, importance_min })}`
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCalendarWeekEvents() {
  return useQuery({
    queryKey: ["calendar-week"],
    queryFn: () => get<CalendarEvent[]>("/api/calendar/events/week"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCalendarEvent(eventId: number | null) {
  return useQuery({
    queryKey: ["calendar-event", eventId],
    queryFn: () => get<CalendarEvent>(`/api/calendar/events/${eventId}`),
    enabled: eventId !== null,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCalendarWeeklySummary() {
  return useQuery({
    queryKey: ["calendar-weekly-summary"],
    queryFn: () => get<CalendarWeeklySummary[]>("/api/calendar/weekly-summary"),
    staleTime: 60 * 60 * 1000, // 1시간 (뷰는 daily 갱신)
  });
}
```

---

## 5. Phase 3 — 컴포넌트

> **디자인 규칙 (DESIGN.md 요약)**
> - 배경: white/surfaceMuted, 텍스트: deep navy(`#0D253D`), 강조: indigo(`#533AFD`)
> - 이모지 사용 금지 (이벤트 유형 구분은 텍스트 접두사 사용)
> - pure black 금지, 중첩 카드 금지, decorative gradient 금지
> - 테이블 숫자는 tabular numerals (`fontVariantNumeric: "tabular-nums"`)

### 중요도 색상 토큰 (컴포넌트 공통)

```typescript
const IMPORTANCE = {
  3: { bg: "#FEE2E2", text: "#DC2626", label: "핵심" },
  2: { bg: "#FEF3C7", text: "#D97706", label: "주의" },
  1: { bg: "#F1F5F9", text: "#64748B", label: "참고" },
} as const;
```

### 이벤트 유형 접두사

```typescript
const EVENT_TYPE_LABEL: Record<string, string> = {
  economic_release: "지표",
  central_bank:     "CB",
  earnings:         "실적",
  index_change:     "지수",
  options_expiry:   "만기",
  market_holiday:   "휴장",
  tech_conference:  "컨퍼",
  medical_conf:     "의학",
  summit:           "정상",
};
```

---

### 3-A. `components/calendar/EventBadge.tsx`

뱃지 하나: `[유형] 제목` + 중요도 배경색

```tsx
"use client";
import type { CalendarEvent } from "@/lib/hooks/calendar";

const IMPORTANCE_STYLE = {
  3: { background: "#FEE2E2", color: "#DC2626" },
  2: { background: "#FEF3C7", color: "#D97706" },
  1: { background: "#F1F5F9", color: "#64748B" },
} as const;

const EVENT_PREFIX: Record<string, string> = {
  economic_release: "지표", central_bank: "CB", earnings: "실적",
  index_change: "지수", options_expiry: "만기", market_holiday: "휴장",
  tech_conference: "컨퍼", medical_conf: "의학", summit: "정상",
};

interface Props {
  event: CalendarEvent;
  onClick?: () => void;
  compact?: boolean;  // 월간 그리드용 (true) / 상세용 (false)
}

export function EventBadge({ event, onClick, compact = true }: Props) {
  const style = IMPORTANCE_STYLE[event.importance as 1 | 2 | 3] ?? IMPORTANCE_STYLE[1];
  const prefix = EVENT_PREFIX[event.event_type] ?? "기타";
  const label = compact
    ? `[${prefix}] ${event.title.slice(0, 18)}${event.title.length > 18 ? "…" : ""}`
    : `[${prefix}] ${event.title}`;

  return (
    <button
      onClick={onClick}
      style={{
        ...style,
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "1px 4px",
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.4,
        cursor: onClick ? "pointer" : "default",
        border: "none",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
```

---

### 3-B. `components/calendar/DayDetailPanel.tsx`

선택된 날짜의 이벤트 목록 패널 (페이지 하단 or 우측)

```tsx
"use client";
import type { CalendarEvent } from "@/lib/hooks/calendar";

const SURPRISE_LABEL: Record<number, { text: string; color: string }> = {
  1:  { text: "예상 상회", color: "#16A34A" },
  0:  { text: "예상 부합", color: "#64748B" },
  [-1]: { text: "예상 하회", color: "#DC2626" },
};

interface Props {
  date: string;           // "YYYY-MM-DD"
  events: CalendarEvent[];
  onClose?: () => void;
}

export function DayDetailPanel({ date, events, onClose }: Props) {
  if (!events.length) return null;

  const [y, m, d] = date.split("-");
  const title = `${m}월 ${d}일 (${events.length}건)`;

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 6,
        padding: "16px 20px",
        marginTop: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0D253D", margin: 0 }}>{title}</h3>
        {onClose && (
          <button onClick={onClose} style={{ fontSize: 12, color: "#64748B", background: "none", border: "none", cursor: "pointer" }}>
            닫기
          </button>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
            {["시각(KST)", "중요도", "국가", "이벤트", "이전값", "예상", "실제", "상태"].map(h => (
              <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontWeight: 600, color: "#64748B", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map(ev => {
            const impStyle = ev.importance === 3
              ? { color: "#DC2626", fontWeight: 700 }
              : ev.importance === 2
              ? { color: "#D97706", fontWeight: 600 }
              : { color: "#64748B" };

            return (
              <tr key={ev.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {ev.kst_time ?? "미정"}
                </td>
                <td style={{ padding: "6px 8px", ...impStyle }}>
                  {"★".repeat(ev.importance)}
                </td>
                <td style={{ padding: "6px 8px", color: "#0D253D" }}>{ev.country ?? "—"}</td>
                <td style={{ padding: "6px 8px", color: "#0D253D", maxWidth: 260 }}>
                  <div style={{ fontWeight: 500 }}>{ev.title}</div>
                  {ev.period && <div style={{ color: "#64748B", fontSize: 11 }}>{ev.period}</div>}
                  {ev.portfolio_note && (
                    <div style={{ color: "#533AFD", fontSize: 11, marginTop: 2 }}>
                      포트폴리오: {ev.portfolio_note}
                    </div>
                  )}
                  {ev.affected_assets.length > 0 && (
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 3 }}>
                      {ev.affected_assets.map(a => (
                        <span key={a} style={{ background: "#EDE9FF", color: "#533AFD", borderRadius: 3, padding: "0 4px", fontSize: 10 }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums" }}>
                  {ev.previous ?? "—"}{ev.unit ? ` ${ev.unit}` : ""}
                </td>
                <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums" }}>
                  {ev.forecast ?? ev.consensus ?? "—"}
                </td>
                <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums", fontWeight: ev.actual ? 600 : 400 }}>
                  {ev.actual ?? "—"}
                  {ev.surprise_dir !== null && ev.surprise_dir !== undefined && (
                    <span style={{ marginLeft: 4, fontSize: 10, color: SURPRISE_LABEL[ev.surprise_dir]?.color }}>
                      {SURPRISE_LABEL[ev.surprise_dir]?.text}
                    </span>
                  )}
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <span style={{
                    background: ev.status === "released" ? "#DCFCE7" : "#F1F5F9",
                    color: ev.status === "released" ? "#16A34A" : "#64748B",
                    padding: "1px 6px", borderRadius: 9999, fontSize: 10,
                  }}>
                    {ev.status === "released" ? "발표완료" : ev.status === "scheduled" ? "예정" : ev.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
```

---

### 3-C. `components/calendar/MonthGrid.tsx`

7×5/6 월간 그리드. 멀티데이 스팬 처리 포함.

```tsx
"use client";
import { useCalendarContext } from "@/app/market/CalendarContext";
import { EventBadge } from "./EventBadge";
import type { CalendarEvent } from "@/lib/hooks/calendar";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  events: CalendarEvent[];
  year: number;
  month: number;
}

export function MonthGrid({ events, year, month }: Props) {
  const { selectedDate, setSelectedDate } = useCalendarContext();

  // 해당 월 그리드 계산
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=일
  const totalDays = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  // 날짜별 이벤트 인덱싱 (단일일 + 멀티데이 전개)
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    const startD = new Date(ev.event_date);
    const endD = ev.event_date_end ? new Date(ev.event_date_end) : startD;
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      if (!eventsByDate[key]) eventsByDate[key] = [];
      // 멀티데이 이벤트는 첫날에만 원본 추가, 나머지는 span 표시용 참조만
      if (key === ev.event_date) {
        eventsByDate[key].push(ev);
      } else {
        if (!eventsByDate[key].some(e => e.id === ev.id)) {
          eventsByDate[key].push(ev);
        }
      }
    }
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // 6행 맞추기
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* 요일 헤더 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 1 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{
            textAlign: "center", fontSize: 11, fontWeight: 600,
            color: i === 0 ? "#DC2626" : i === 6 ? "#2563EB" : "#64748B",
            padding: "4px 0",
          }}>
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} style={{ minHeight: 80, background: "#F8FAFC" }} />;

          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = (eventsByDate[dateStr] || []).sort((a, b) => b.importance - a.importance);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const isSun = idx % 7 === 0;
          const isSat = idx % 7 === 6;

          return (
            <div
              key={dateStr}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              style={{
                minHeight: 80,
                padding: "4px 4px 6px",
                background: isSelected ? "#EDE9FF" : isSun || isSat ? "#F8FAFC" : "#fff",
                border: isToday ? "2px solid #533AFD" : "1px solid #E2E8F0",
                borderRadius: 4,
                cursor: "pointer",
                overflow: "hidden",
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: isToday ? 700 : 400,
                color: isSun ? "#DC2626" : isSat ? "#2563EB" : "#0D253D",
                marginBottom: 3,
              }}>
                {day}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {dayEvents.slice(0, 3).map(ev => (
                  <EventBadge key={ev.id} event={ev} compact />
                ))}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: 10, color: "#64748B", paddingLeft: 4 }}>
                    +{dayEvents.length - 3}건
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### 3-D. `components/calendar/WeekView.tsx`

이번 주 이벤트 — 요일별 컬럼 테이블

```tsx
"use client";
import type { CalendarEvent } from "@/lib/hooks/calendar";
import { EventBadge } from "./EventBadge";
import { useCalendarContext } from "@/app/market/CalendarContext";

const WEEKDAY_KO = ["월", "화", "수", "목", "금"];

interface Props {
  events: CalendarEvent[];
}

export function WeekView({ events }: Props) {
  const { setSelectedDate, selectedDate } = useCalendarContext();

  // 이번 주 월~금 날짜 계산
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);

  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const byDate: Record<string, CalendarEvent[]> = {};
  for (const d of weekDates) byDate[d] = [];
  for (const ev of events) {
    if (byDate[ev.event_date]) byDate[ev.event_date].push(ev);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
      {weekDates.map((date, i) => {
        const dayEvents = (byDate[date] || []).sort((a, b) => b.importance - a.importance);
        const [, , d] = date.split("-");
        const isSelected = date === selectedDate;

        return (
          <div
            key={date}
            onClick={() => setSelectedDate(isSelected ? null : date)}
            style={{
              background: isSelected ? "#EDE9FF" : "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 6,
              padding: "10px 10px 12px",
              minHeight: 120,
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 12, color: "#64748B", marginBottom: 6 }}>
              {WEEKDAY_KO[i]} {parseInt(d)}일
              {dayEvents.length > 0 && (
                <span style={{ marginLeft: 4, fontSize: 10, color: "#533AFD" }}>({dayEvents.length})</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {dayEvents.map(ev => (
                <EventBadge key={ev.id} event={ev} compact={false} />
              ))}
              {dayEvents.length === 0 && (
                <div style={{ fontSize: 11, color: "#CBD5E1" }}>일정 없음</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

### 3-E. `components/calendar/ListView.tsx`

날짜별 그룹 목록 뷰 — 고밀도 데이터 탐색용

```tsx
"use client";
import type { CalendarEvent } from "@/lib/hooks/calendar";
import { useCalendarContext } from "@/app/market/CalendarContext";

const IMPORTANCE_STYLE = {
  3: { background: "#FEE2E2", color: "#DC2626" },
  2: { background: "#FEF3C7", color: "#D97706" },
  1: { background: "#F1F5F9", color: "#64748B" },
} as const;

const EVENT_PREFIX: Record<string, string> = {
  economic_release: "지표", central_bank: "CB", earnings: "실적",
  index_change: "지수", options_expiry: "만기", market_holiday: "휴장",
  tech_conference: "컨퍼", medical_conf: "의학", summit: "정상",
};

interface Props {
  events: CalendarEvent[];
}

export function ListView({ events }: Props) {
  const { setSelectedDate, selectedDate } = useCalendarContext();

  // 날짜별 그룹화
  const groups: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!groups[ev.event_date]) groups[ev.event_date] = [];
    groups[ev.event_date].push(ev);
  }
  const sortedDates = Object.keys(groups).sort();

  if (sortedDates.length === 0) {
    return <div style={{ color: "#64748B", fontSize: 13, padding: 20 }}>해당 기간에 이벤트가 없습니다.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {sortedDates.map(date => {
        const dayEvents = groups[date].sort((a, b) => b.importance - a.importance);
        const [, m, d] = date.split("-");
        const isSelected = date === selectedDate;

        return (
          <div key={date}>
            <div
              onClick={() => setSelectedDate(isSelected ? null : date)}
              style={{
                padding: "6px 12px",
                background: isSelected ? "#EDE9FF" : "#F6F9FC",
                borderTop: "1px solid #E2E8F0",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#0D253D",
              }}
            >
              {m}월 {parseInt(d)}일 ({dayEvents.length}건)
            </div>
            {dayEvents.map(ev => {
              const impStyle = IMPORTANCE_STYLE[ev.importance as 1|2|3] ?? IMPORTANCE_STYLE[1];
              const prefix = EVENT_PREFIX[ev.event_type] ?? "기타";
              return (
                <div
                  key={ev.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 40px 36px 1fr 80px 80px 80px",
                    gap: "0 12px",
                    padding: "6px 12px",
                    borderBottom: "1px solid #F1F5F9",
                    fontSize: 12,
                    alignItems: "center",
                    background: "#fff",
                  }}
                >
                  <span style={{ color: "#64748B", fontVariantNumeric: "tabular-nums" }}>
                    {ev.kst_time ?? "미정"}
                  </span>
                  <span style={{
                    ...impStyle,
                    borderRadius: 3,
                    padding: "1px 4px",
                    fontSize: 10,
                    fontWeight: 600,
                    textAlign: "center",
                  }}>
                    {impStyle === IMPORTANCE_STYLE[3] ? "핵심" : impStyle === IMPORTANCE_STYLE[2] ? "주의" : "참고"}
                  </span>
                  <span style={{ color: "#64748B", fontSize: 11 }}>{ev.country ?? "—"}</span>
                  <span style={{ color: "#0D253D", fontWeight: 500 }}>
                    <span style={{ color: "#64748B", marginRight: 4, fontSize: 10 }}>[{prefix}]</span>
                    {ev.title}
                    {ev.period && <span style={{ color: "#94A3B8", marginLeft: 6, fontSize: 10 }}>{ev.period}</span>}
                  </span>
                  <span style={{ color: "#64748B", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    {ev.previous ?? "—"}
                  </span>
                  <span style={{ color: "#64748B", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    {ev.forecast ?? ev.consensus ?? "—"}
                  </span>
                  <span style={{
                    color: ev.actual
                      ? (ev.surprise_dir === 1 ? "#16A34A" : ev.surprise_dir === -1 ? "#DC2626" : "#0D253D")
                      : "#CBD5E1",
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                    fontWeight: ev.actual ? 600 : 400,
                  }}>
                    {ev.actual ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

---

### 3-F. `components/calendar/CalendarHeader.tsx`

월 탐색 + 뷰 토글 + 필터 칩

```tsx
"use client";
import { useCalendarContext } from "@/app/market/CalendarContext";

type ViewMode = "month" | "week" | "list";

const CATEGORIES = [
  { value: "", label: "전체" },
  { value: "macro_us", label: "미국 거시" },
  { value: "macro_kr", label: "한국 거시" },
  { value: "earnings", label: "기업 실적" },
  { value: "market", label: "시장 이벤트" },
];

const IMPORTANCE_OPTIONS = [
  { value: 1, label: "전체" },
  { value: 2, label: "주의 이상" },
  { value: 3, label: "핵심만" },
];

export function CalendarHeader() {
  const { viewMode, setViewMode, currentYear, currentMonth, navigateMonth, filters, setFilters } =
    useCalendarContext();

  const VIEWS: { key: ViewMode; label: string }[] = [
    { key: "month", label: "월간" },
    { key: "week", label: "주간" },
    { key: "list", label: "목록" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
      {/* 상단: 제목 + 월 탐색 + 뷰 토글 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0D253D", margin: 0 }}>
          시황·경제 캘린더
        </h1>

        {viewMode === "month" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => navigateMonth(-1)} style={btnStyle}>◀</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0D253D", minWidth: 80, textAlign: "center" }}>
              {currentYear}년 {currentMonth}월
            </span>
            <button onClick={() => navigateMonth(1)} style={btnStyle}>▶</button>
            <button onClick={() => navigateMonth(0)} style={{ ...btnStyle, fontSize: 11 }}>오늘</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
          {VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              style={{
                ...btnStyle,
                background: viewMode === v.key ? "#533AFD" : "#F6F9FC",
                color: viewMode === v.key ? "#fff" : "#0D253D",
                fontWeight: viewMode === v.key ? 600 : 400,
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* 하단: 필터 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>카테고리:</span>
        {CATEGORIES.map(c => (
          <FilterChip
            key={c.value}
            label={c.label}
            active={filters.category === c.value || (c.value === "" && !filters.category)}
            onClick={() => setFilters({ ...filters, category: c.value || undefined })}
          />
        ))}
        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginLeft: 8 }}>중요도:</span>
        {IMPORTANCE_OPTIONS.map(o => (
          <FilterChip
            key={o.value}
            label={o.label}
            active={(filters.importance_min ?? 1) === o.value}
            onClick={() => setFilters({ ...filters, importance_min: o.value })}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 10px",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        background: active ? "#EDE9FF" : "#F1F5F9",
        color: active ? "#533AFD" : "#64748B",
        border: active ? "1px solid #533AFD" : "1px solid #E2E8F0",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "3px 10px",
  borderRadius: 4,
  fontSize: 12,
  background: "#F6F9FC",
  color: "#0D253D",
  border: "1px solid #E2E8F0",
  cursor: "pointer",
};
```

---

## 6. Phase 4 — 페이지 조립

### 4-A. `app/market/CalendarContext.tsx` 신규 생성

```tsx
"use client";

import { createContext, useContext, useState } from "react";
import type { CalendarFilters } from "@/lib/hooks/calendar";

type ViewMode = "month" | "week" | "list";

interface CalendarContextValue {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  currentYear: number;
  currentMonth: number;
  navigateMonth: (delta: number) => void; // 0 = 오늘로 복귀
  selectedDate: string | null;
  setSelectedDate: (d: string | null) => void;
  filters: CalendarFilters;
  setFilters: (f: CalendarFilters) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const today = new Date();

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFilters>({ importance_min: 2 });

  function navigateMonth(delta: number) {
    if (delta === 0) {
      setCurrentYear(today.getFullYear());
      setCurrentMonth(today.getMonth() + 1);
      return;
    }
    setCurrentMonth(prev => {
      const next = prev + delta;
      if (next > 12) { setCurrentYear(y => y + 1); return 1; }
      if (next < 1)  { setCurrentYear(y => y - 1); return 12; }
      return next;
    });
    setSelectedDate(null);
  }

  return (
    <CalendarContext.Provider value={{
      viewMode, setViewMode,
      currentYear, currentMonth, navigateMonth,
      selectedDate, setSelectedDate,
      filters, setFilters,
    }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendarContext() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendarContext must be used inside CalendarProvider");
  return ctx;
}
```

---

### 4-B. `app/market/page.tsx` 전체 교체

```tsx
"use client";

import { CalendarProvider, useCalendarContext } from "./CalendarContext";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { WeekView } from "@/components/calendar/WeekView";
import { ListView } from "@/components/calendar/ListView";
import { DayDetailPanel } from "@/components/calendar/DayDetailPanel";
import {
  useCalendarEvents,
  useCalendarWeekEvents,
  useCalendarWeeklySummary,
} from "@/lib/hooks/calendar";

function WeekStrip() {
  const { data: summaries = [] } = useCalendarWeeklySummary();
  if (!summaries.length) return null;

  return (
    <div style={{
      display: "flex", gap: 8, overflowX: "auto", marginBottom: 14,
      padding: "8px 0",
    }}>
      {summaries.map(s => (
        <div key={s.week_start} style={{
          flexShrink: 0,
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 6,
          padding: "8px 14px",
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, color: "#0D253D", marginBottom: 2 }}>
            {s.week_start.slice(5).replace("-", "/")} 주
            {s.critical_count > 0 && (
              <span style={{ marginLeft: 6, color: "#DC2626", fontSize: 11 }}>
                핵심 {s.critical_count}건
              </span>
            )}
          </div>
          <div style={{ color: "#64748B" }}>전체 {s.total_events}건</div>
          {s.key_events.length > 0 && (
            <div style={{ color: "#533AFD", fontSize: 11, marginTop: 2 }}>
              {s.key_events.slice(0, 2).join(", ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CalendarBody() {
  const { viewMode, currentYear, currentMonth, selectedDate, filters } = useCalendarContext();

  const { data: monthEvents = [], isLoading: loadingMonth } = useCalendarEvents(
    currentYear, currentMonth, filters
  );
  const { data: weekEvents = [], isLoading: loadingWeek } = useCalendarWeekEvents();

  const selectedDayEvents = selectedDate
    ? (viewMode === "week" ? weekEvents : monthEvents).filter(
        ev => ev.event_date === selectedDate ||
              (ev.event_date_end && ev.event_date <= selectedDate && ev.event_date_end >= selectedDate)
      )
    : [];

  const isLoading = viewMode === "week" ? loadingWeek : loadingMonth;
  const events = viewMode === "week" ? weekEvents : monthEvents;

  return (
    <div>
      {isLoading && (
        <div style={{ color: "#64748B", fontSize: 13, padding: "20px 0" }}>로딩 중...</div>
      )}

      {!isLoading && (
        <>
          {viewMode === "month" && (
            <MonthGrid events={events} year={currentYear} month={currentMonth} />
          )}
          {viewMode === "week" && <WeekView events={events} />}
          {viewMode === "list" && <ListView events={events} />}

          {selectedDate && selectedDayEvents.length > 0 && (
            <DayDetailPanel date={selectedDate} events={selectedDayEvents} />
          )}
        </>
      )}
    </div>
  );
}

export default function MarketPage() {
  return (
    <CalendarProvider>
      <div style={{ maxWidth: 1100 }}>
        <CalendarHeader />
        <WeekStrip />
        <CalendarBody />
      </div>
    </CalendarProvider>
  );
}
```

---

### 4-C. `app/layout.tsx` 수정 — 1줄 변경

```typescript
// 변경 전
{ href: "/market", label: "시황" },

// 변경 후
{ href: "/market", label: "시황·캘린더" },
```

---

## 7. 실행 전 최종 체크리스트

### 백엔드 검증
```bash
uvicorn api.main:app --reload
# 아래 3개 엔드포인트 브라우저/curl 확인
# GET http://localhost:8000/api/calendar/events?year=2026&month=6
# GET http://localhost:8000/api/calendar/events/week
# GET http://localhost:8000/api/calendar/weekly-summary
```

### 프론트엔드 검증
```bash
cd frontend && npm run dev
# http://localhost:3000/market 접속
# 1. 월간 뷰: 이벤트 뱃지 렌더링 확인
# 2. 날짜 클릭: DayDetailPanel 출력 확인
# 3. 주간/목록 뷰 토글 확인
# 4. 필터 칩 동작 (importance_min 변경 시 refetch) 확인
```

### 타입 체크
```bash
cd frontend && npx tsc --noEmit
```

---

## 8. 추후 고려 사항 (이번 범위 외)

| 항목 | 설명 |
|------|------|
| 다음 달 데이터 | 현재 DB는 6월만 존재. 월 탐색 시 빈 결과 = 정상 동작 |
| 국가 필터 추가 | `country` 값이 20+개 (TE 비표준 코드 포함) — 실용적인 KR/US/EU만 필터 칩으로 제공 가능 |
| affected_assets 교차 참조 | 현재 보유 ETF와 교차하여 "관련 이벤트" 강조 — `useActivePortfolio` + `affected_assets` 비교로 구현 가능 |
| 이벤트 상세 모달 | 단건 클릭 시 `useCalendarEvent(id)` 호출로 description/metadata까지 표시하는 모달 |
| CLAUDE.md 업데이트 | 구현 완료 후 `routers/calendar.py` 역할 및 `/market` route 상태를 CLAUDE.md에 반영 |
