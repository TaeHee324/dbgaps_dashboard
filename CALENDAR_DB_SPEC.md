# 달비 캘린더 DB 스펙 — 웹사이트 구현용

> DB GAPS 대회용 ETF 포트폴리오 AI 비서 '달비'가 관리하는 경제지표·시장 이벤트 캘린더.
> 이 문서는 웹사이트에서 캘린더 UI를 구현하는 데 필요한 모든 정보를 담고 있다.

---

## 1. DB 연결

| 항목 | 값 |
|---|---|
| 플랫폼 | Railway PostgreSQL |
| 연결 문자열 | `.env` 파일의 `DATABASE_URL` 참조 |
| 형식 | `postgresql://{user}:{password}@{host}:{port}/{database}` |
| 주요 테이블 | `calendar_events` |
| 뷰 | `calendar_weekly_summary` |

---

## 2. 테이블 스키마: `calendar_events`

### 전체 컬럼 정의

```sql
CREATE TABLE calendar_events (
    -- PK
    id                SERIAL PRIMARY KEY,

    -- 날짜/시간
    event_date        DATE        NOT NULL,       -- 이벤트 날짜
    event_date_end    DATE,                        -- 복수일 이벤트 종료일 (NULL이면 단일일)
    event_time        TIME,                        -- 발표 시각 (NULL이면 시간 미정)
    timezone          TEXT,                        -- 시각 기준 타임존 (예: 'America/New_York', 'Asia/Seoul', 'UTC')

    -- 분류
    title             TEXT        NOT NULL,        -- 이벤트/지표명
    event_type        TEXT        NOT NULL,        -- 이벤트 유형 (아래 Enum 참조)
    category          TEXT        NOT NULL,        -- 대분류 (아래 Enum 참조)
    country           CHAR(2),                     -- 국가코드 (US, KR, EU, JP, CN)

    -- 중요도
    importance        SMALLINT    DEFAULT 2,       -- 1=참고, 2=주의, 3=핵심

    -- 지표 기간 (경제지표 전용)
    period            TEXT,                        -- 데이터 대상 기간 (예: '2026-05', '2026-Q1')
    period_type       TEXT,                        -- monthly / quarterly / annual / weekly
    release_type      TEXT,                        -- flash(속보) / preliminary(잠정) / revised / final(최종)
    measurement       TEXT,                        -- YoY / MoM / QoQ / index / level

    -- 수치 데이터 (경제지표/실적 전용)
    unit              TEXT,                        -- 단위 (예: '%', 'K명', 'B USD', 'bps')
    previous          TEXT,                        -- 전기 실제값
    previous_revised  BOOLEAN     DEFAULT FALSE,   -- 이전값 수정 여부
    consensus         TEXT,                        -- 시장 컨센서스 (TE 무료에서 대부분 NULL)
    forecast          TEXT,                        -- Trading Economics 모델 예측값
    actual            TEXT,                        -- 발표 후 실제값 (발표 전은 NULL)
    surprise_dir      SMALLINT,                    -- +1(호조) / 0(부합) / -1(부진) / NULL(미발표)

    -- 상태
    status            TEXT        DEFAULT 'scheduled', -- scheduled / released / revised / cancelled

    -- 설명
    description       TEXT,                        -- AI용 맥락 메모 (달비가 읽는 설명)

    -- 포트폴리오 연관 (달비 전용)
    affected_assets   TEXT[],                      -- 영향받는 ETF 코드 배열 (예: {'SPY','TLT','GLD'})
    portfolio_note    TEXT,                        -- 포트폴리오 관점 메모

    -- 확장 데이터
    metadata          JSONB       DEFAULT '{}',    -- 이벤트 유형별 추가 데이터

    -- 관리
    source            TEXT        DEFAULT 'manual', -- manual(수동입력) / te(Trading Economics 파싱)
    source_key        TEXT,                         -- TE 이벤트 고유 식별자 (te_{country}_{date}_{slug})
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Enum 값 목록

### `event_type` (이벤트 유형)

| 값 | 의미 | UI 표시 예시 |
|---|---|---|
| `economic_release` | CPI, GDP, 고용보고서 등 경제지표 발표 | 📊 |
| `central_bank` | FOMC, BOJ, BOK 등 중앙은행 회의/결정 | 🏦 |
| `earnings` | 기업 실적발표 (NVDA, AAPL 등) | 💼 |
| `index_change` | 코스피200/코스닥150 정기변경, MSCI 리뷰 | 📋 |
| `options_expiry` | 선물·옵션 동시만기일 | ⏰ |
| `market_holiday` | 증시 휴장일 | 🚫 |
| `tech_conference` | WWDC, COMPUTEX, MS Build 등 | 💻 |
| `medical_conf` | ADA, EULAR 등 의학 학회 | 🔬 |
| `summit` | G7, EU 정상회의 등 | 🌐 |

### `category` (대분류)

| 값 | 의미 |
|---|---|
| `macro_us` | 미국·유로존·일본·중국 거시지표 |
| `macro_kr` | 한국 거시지표 |
| `earnings` | 기업 실적 |
| `market` | 시장 구조 이벤트 (만기일, 지수변경, 컨퍼런스, 휴장) |
| `dbgaps` | DB GAPS 대회 전용 일정 (추후 추가 예정) |

### `importance` (중요도)

| 값 | 의미 | UI 색상 권장 |
|---|---|---|
| `3` | 핵심 — 시장 방향성에 직접 영향 | 🔴 빨강 |
| `2` | 주의 — 섹터/자산별 영향 | 🟡 노랑 |
| `1` | 참고 — 부가 정보 | ⚪ 회색 |

### `status` (상태)

| 값 | 의미 |
|---|---|
| `scheduled` | 발표 예정 (actual = NULL) |
| `released` | 발표 완료 (actual 채워짐) |
| `revised` | 수정치 발표 |
| `cancelled` | 취소/연기 |

### `country` (국가코드)

`US`, `KR`, `EU`, `JP`, `CN`

---

## 4. 특수 필드 상세

### `event_date_end` — 복수일 이벤트

`event_date_end`가 있으면 해당 기간 동안 진행되는 이벤트다.

```
애플 WWDC 2026: event_date=2026-06-08, event_date_end=2026-06-12
FOMC:          event_date=2026-06-16, event_date_end=2026-06-17
G7 정상회의:   event_date=2026-06-15, event_date_end=2026-06-17
```

UI에서 해당 날짜 범위 전체에 이벤트 바를 표시해야 한다.

### `timezone` & `event_time` — 시각 처리

- `event_time`은 해당 `timezone` 기준 시각이다.
- 한국 사용자용 KST 변환: `event_time AT TIME ZONE timezone AT TIME ZONE 'Asia/Seoul'`
- TE에서 파싱된 이벤트(`source='te'`)는 `timezone='UTC'`로 저장됨.

```sql
-- KST로 변환해서 표시
SELECT
    title,
    event_date,
    to_char(event_time AT TIME ZONE timezone AT TIME ZONE 'Asia/Seoul', 'HH24:MI') AS kst_time
FROM calendar_events
WHERE event_time IS NOT NULL;
```

### `affected_assets` — TEXT 배열

```
{SPY,TLT,GLD}        → PostgreSQL 배열 형식
```

JavaScript에서 받으면 일반 문자열 배열로 파싱된다:
```json
["SPY", "TLT", "GLD"]
```

### `metadata` — JSONB 확장 데이터

이벤트 유형별로 구조가 다르다:

```json
// earnings
{"ticker": "NVDA", "timing": "after_market", "sector": "semiconductor"}

// central_bank (FOMC)
{"dot_plot": true, "press_conference": true, "expected": "hold"}

// index_change
{"indexes": ["KOSPI200", "KOSDAQ150"]}

// tech_conference
{"organizer": "Apple", "end_label": "~6/12"}

// options_expiry
{"market": "KRX"}
{"type": "quarterly_triple_witching"}
```

### `source` & `source_key` — 데이터 출처

| 값 | 의미 |
|---|---|
| `source='manual'`, `source_key=NULL` | 수동 입력 (달비 또는 관리자가 직접 추가) |
| `source='te'`, `source_key='te_US_2026-06-05_non-farm-payrolls'` | Trading Economics에서 자동 파싱 |
| `source='daol'`, `source_key=NULL` | 다올투자증권 캘린더 기반 수동 입력 |

---

## 5. 현재 데이터 현황 (2026-06-05 기준)

```
총 이벤트 수: 34건
기간: 2026-06-01 ~ 2026-06-30 (6월 전체)
상태: 전체 scheduled (아직 발표 전)
```

### 분류별 현황

| category | event_type | 건수 |
|---|---|---|
| macro_us | economic_release | 11 |
| macro_us | central_bank | 4 |
| macro_us | summit | 2 |
| macro_kr | economic_release | 3 |
| macro_kr | central_bank | 1 |
| earnings | earnings | 4 |
| market | options_expiry | 2 |
| market | index_change | 2 |
| market | tech_conference | 2 |
| market | medical_conf | 2 |
| market | market_holiday | 1 |

### 중요도별 현황

| importance | 건수 |
|---|---|
| 3 (핵심) | 7 |
| 2 (주의) | 21 |
| 1 (참고) | 6 |

### importance=3 핵심 이벤트

| 날짜 | 이벤트 |
|---|---|
| 2026-06-05 | 미국 5월 비농업고용 NFP |
| 2026-06-05 | 미국 5월 실업률 |
| 2026-06-09 | 한국 1분기 GDP (잠정) |
| 2026-06-10 | 미국 5월 CPI |
| 2026-06-16~17 | FOMC 금리결정 |
| 2026-06-23 | MSCI 연례 시장 분류 리뷰 |
| 2026-06-25 | 미국 5월 PCE 물가지수 |

---

## 6. 뷰: `calendar_weekly_summary`

주간 요약 정보를 미리 집계한 뷰. 캘린더 헤더/주간 뷰에 활용.

```sql
SELECT * FROM calendar_weekly_summary;
```

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `week_start` | DATE | 해당 주 월요일 |
| `week_end` | DATE | 해당 주 금요일 |
| `total_events` | INT | 이번 주 전체 이벤트 수 |
| `critical_count` | INT | importance=3 이벤트 수 |
| `major_count` | INT | importance=2 이벤트 수 |
| `key_events` | TEXT[] | importance=3 이벤트 제목 배열 |

현재 데이터:

| week_start | week_end | total | critical | key_events |
|---|---|---|---|---|
| 2026-06-01 | 2026-06-05 | 13 | 2 | NFP, 실업률 |
| 2026-06-08 | 2026-06-12 | 6 | 2 | 한국 GDP, 미국 CPI |
| 2026-06-15 | 2026-06-19 | 6 | 1 | FOMC |
| 2026-06-22 | 2026-06-26 | 7 | 2 | MSCI, PCE |
| 2026-06-29 | 2026-07-03 | 2 | 0 | — |

---

## 7. 웹사이트 구현용 쿼리 모음

### 월간 캘린더 (특정 월 전체)

```sql
SELECT
    id,
    event_date,
    event_date_end,
    title,
    event_type,
    category,
    country,
    importance,
    status,
    actual,
    surprise_dir,
    affected_assets,
    to_char(
        event_time AT TIME ZONE COALESCE(timezone, 'UTC') AT TIME ZONE 'Asia/Seoul',
        'HH24:MI'
    ) AS kst_time
FROM calendar_events
WHERE event_date >= DATE_TRUNC('month', '2026-06-01'::date)
  AND event_date <  DATE_TRUNC('month', '2026-06-01'::date) + INTERVAL '1 month'
  AND status != 'cancelled'
ORDER BY event_date, importance DESC, event_time;
```

### 주간 뷰 (이번 주)

```sql
SELECT
    id,
    event_date,
    event_date_end,
    title,
    event_type,
    category,
    country,
    importance,
    period,
    unit,
    previous,
    consensus,
    forecast,
    actual,
    surprise_dir,
    status,
    affected_assets,
    portfolio_note,
    to_char(
        event_time AT TIME ZONE COALESCE(timezone, 'UTC') AT TIME ZONE 'Asia/Seoul',
        'HH24:MI'
    ) AS kst_time
FROM calendar_events
WHERE event_date BETWEEN DATE_TRUNC('week', CURRENT_DATE)
                     AND DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '4 days'
  AND status != 'cancelled'
ORDER BY event_date, importance DESC;
```

### 일별 상세 (특정 날짜)

```sql
SELECT
    id,
    event_date,
    title,
    event_type,
    category,
    country,
    importance,
    period,
    measurement,
    unit,
    previous,
    consensus,
    forecast,
    actual,
    surprise_dir,
    status,
    description,
    affected_assets,
    portfolio_note,
    metadata,
    to_char(
        event_time AT TIME ZONE COALESCE(timezone, 'UTC') AT TIME ZONE 'Asia/Seoul',
        'HH24:MI'
    ) AS kst_time
FROM calendar_events
WHERE event_date = '2026-06-10'
  AND status != 'cancelled'
ORDER BY importance DESC, event_time;
```

### 이벤트 상세 단건 조회

```sql
SELECT * FROM calendar_events WHERE id = $1;
```

### 미발표 + 오늘 이후 예정 이벤트 (importance >= 2)

```sql
SELECT
    event_date,
    title,
    event_type,
    importance,
    previous,
    forecast,
    affected_assets
FROM calendar_events
WHERE event_date >= CURRENT_DATE
  AND actual IS NULL
  AND importance >= 2
  AND status = 'scheduled'
ORDER BY event_date, importance DESC
LIMIT 20;
```

### 발표 완료 이벤트 (서프라이즈 필터)

```sql
-- 예상 상회한 핵심 이벤트
SELECT event_date, title, previous, forecast, actual, surprise_dir
FROM calendar_events
WHERE status = 'released'
  AND surprise_dir = 1
  AND importance = 3
ORDER BY event_date DESC;
```

---

## 8. UI 구현 시 주의사항

### 복수일 이벤트 렌더링
`event_date_end`가 있는 경우, 해당 기간 전체 날짜 칸에 연결 바(span bar)를 표시해야 한다.

```
6/8  6/9  6/10 6/11 6/12
[────── 애플 WWDC ──────]
```

### 발표 시각 없는 이벤트
`event_time`이 NULL인 이벤트는 "시간 미정" 또는 하루 종일 이벤트로 처리.

### 타임존 변환
모든 시각은 KST(Asia/Seoul, UTC+9)로 변환해서 표시. 서버사이드에서 변환 권장.

### 수치 표시 규칙
| 상태 | previous | forecast | actual | 표시 방법 |
|---|---|---|---|---|
| 발표 전 | 있음 | 있음 | NULL | 이전값 / 예상: forecast |
| 발표 전 | 있음 | NULL | NULL | 이전값 / 예상: 미발표 |
| 발표 완료 | 있음 | 있음 | 있음 | 이전값 / 예상: forecast / 실제: actual |

### surprise_dir 시각화
```
+1  → 📈 초록 배지 "예상 상회"
 0  → ➡️ 회색 배지 "예상 부합"
-1  → 📉 빨강 배지 "예상 하회"
NULL → 표시 없음
```

### 데이터 갱신 주기
- 수동 입력 이벤트: 수시 (달비 또는 관리자)
- TE 파싱 이벤트: 매일 07:30 KST (월~목), 09:10 KST (금~일) 크론으로 자동 갱신

---

## 9. 관련 테이블 (참고)

### `portfolios`
현재 운용 중인 포트폴리오. `affected_assets`와 교차 참조해서 "보유 ETF에 영향 있는 이벤트" 필터링 가능.

```sql
-- 현재 활성 포트폴리오 보유 ETF 목록
SELECT jsonb_object_keys(holdings) AS etf_code
FROM portfolios
WHERE is_active = TRUE;
```

### `prices_daily`
ETF 일별 종가. 이벤트 발생일 전후 가격 변동 차트 구현 시 활용.

```sql
-- 특정 ETF 최근 가격
SELECT date, close
FROM prices_daily
WHERE code = 'SPY'
ORDER BY date DESC
LIMIT 30;
```

---

## 10. 인덱스 목록

| 인덱스명 | 컬럼 | 용도 |
|---|---|---|
| `calendar_events_pkey` | id | PK |
| `idx_cal_date` | event_date | 날짜 범위 조회 |
| `idx_cal_category` | category, event_date | 카테고리 필터 |
| `idx_cal_importance` | importance DESC, event_date | 중요도 정렬 |
| `idx_cal_status` | status, event_date | 상태 필터 |
| `idx_cal_metadata` | metadata (GIN) | JSONB 검색 |
| `idx_cal_assets` | affected_assets (GIN) | ETF 배열 검색 |
| `idx_cal_source_key` | source_key (UNIQUE, PARTIAL) | TE UPSERT |
