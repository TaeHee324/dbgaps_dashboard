# DBGAPS — Streamlit → React/Next.js + FastAPI 마이그레이션 계획

## 목표

Streamlit 단일 앱을 FastAPI 백엔드 + Next.js 프론트엔드로 분리한다.  
계산 엔진(`src/`), 데이터 계약(`output/`), PostgreSQL(`db.py`)은 변경하지 않는다.

## 확정 기술 스택

| 항목 | 결정 |
|------|------|
| 프론트엔드 | Next.js 15 (App Router) + TypeScript |
| 스타일링 | Tailwind CSS (`design-tokens.json` → `tailwind.config.ts`) |
| 차트 | TradingView Lightweight Charts v5 |
| 상태 관리 | TanStack Query (React Query v5) |
| 백엔드 | FastAPI + uvicorn |
| 배포 | Railway 두 서비스 (FastAPI + Next.js) |

## 목표 디렉토리 구조

```
dbgaps_dashboard/
├── src/               ← 변경 없음 (계산 엔진)
├── data/              ← 변경 없음
├── output/            ← 변경 없음 (API가 읽음)
├── db.py              ← 변경 없음 (FastAPI가 import)
├── api/               ← 신규: FastAPI 백엔드
│   ├── main.py
│   ├── routers/
│   │   ├── dashboard.py   # output/ CSV 엔드포인트
│   │   └── portfolios.py  # PostgreSQL CRUD
│   ├── schemas.py
│   └── requirements.txt
├── frontend/          ← 신규: Next.js 앱
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # 홈
│   │   ├── operations/page.tsx       # 운용현황
│   │   ├── portfolio/page.tsx        # ETF 포트폴리오
│   │   ├── comparison/page.tsx       # 포트폴리오 비교
│   │   ├── trades/page.tsx           # 매매일지
│   │   ├── market/page.tsx           # 시황
│   │   └── report/page.tsx           # 운용보고서
│   ├── components/
│   │   ├── charts/
│   │   │   ├── NavChart.tsx
│   │   │   ├── DrawdownChart.tsx
│   │   │   ├── MonthlyBarChart.tsx
│   │   │   └── ComparisonChart.tsx
│   │   └── ui/
│   │       ├── KpiStrip.tsx
│   │       ├── RuleBadge.tsx
│   │       ├── TurnoverRow.tsx
│   │       ├── HoldingsTable.tsx
│   │       └── StatusBar.tsx
│   ├── lib/
│   │   ├── api.ts       # fetch wrapper (NEXT_PUBLIC_API_URL 기반)
│   │   └── hooks.ts     # React Query hooks
│   └── package.json
├── web/               ← Phase 4에서 삭제
└── tests/             ← 기존 유지 + API 테스트 추가
```

## 아키텍처 경계 (불변)

| 기존 규칙 | 신규 동등 규칙 |
|----------|--------------|
| `web/`는 `src/` import 금지 | `frontend/`는 `api/`를 통해서만 데이터 접근 |
| `web/`는 pykrx 금지 | `api/`도 pykrx 금지 (`src/`만 허용) |
| `output/`는 계약 | `output/`는 계약 (동일) |
| `db.py`는 `web/`에서 import 가능 | `db.py`는 `api/`에서 import 가능 |

---

## 의존성 그래프

```
Pre-Phase 0: API Contract 문서 작성 (오케스트레이터 직접)
                        │
         ┌──────────────┴──────────────┐
      [병렬]                         [병렬]
Phase 1A: FastAPI 구현          Phase 1B: Next.js 골격
                └──────────────┬──────────────┘
                               │
                          [병렬 2개]
          Phase 2A: 차트 컴포넌트    Phase 2B: UI 컴포넌트
                               │
                          [병렬 3개]
        Phase 3A            Phase 3B            Phase 3C
      홈 + 운용현황       ETF포트폴리오        매매일지 + 시황
                        + 포트폴리오비교       + 운용보고서
                               │
                    Phase 4: 통합 검증 + Railway 배포
```

---

## Phase별 상세

### Pre-Phase 0 — API Contract 문서 (오케스트레이터 직접 작성)

**출력물:** `api/CONTRACT.md`

- 전체 엔드포인트 목록과 HTTP method
- 각 엔드포인트의 request/response JSON shape (TypeScript 타입 병기)
- 에러 처리 규약: 빈 데이터 → 빈 배열/null, 500 에러 금지
- CORS 설정 방침 (Next.js dev 서버 허용)

---

### Phase 1A — FastAPI 백엔드 (세션 1)

**전제:** Pre-Phase 0 완료  
**참고 파일:** `web/data_loader.py`, `db.py`, `api/CONTRACT.md`

**생성 파일:**
- `api/main.py` — FastAPI 앱, CORS, 라우터 등록
- `api/routers/dashboard.py` — `output/` CSV → JSON 엔드포인트
- `api/routers/portfolios.py` — PostgreSQL CRUD
- `api/schemas.py` — Pydantic 응답 모델
- `api/requirements.txt`

**엔드포인트 목록:**

| Method | Path | 대응 함수 |
|--------|------|-----------|
| GET | `/api/portfolio-summary` | `load_portfolio_summary()` |
| GET | `/api/holdings` | `load_current_holdings()` |
| GET | `/api/backtest-nav` | `load_backtest_nav()` |
| GET | `/api/monthly-returns` | `load_monthly_returns()` |
| GET | `/api/comparison/summary` | `load_comparison_summary()` |
| GET | `/api/comparison/nav` | `load_comparison_nav()` |
| GET | `/api/rules` | `load_rule_results()` |
| GET | `/api/turnover` | `load_turnover()` |
| GET | `/api/report` | `load_report()` |
| GET | `/api/data-date` | `get_data_date()` |
| GET | `/api/portfolios` | `db.list_portfolios()` |
| POST | `/api/portfolios` | `db.upsert_portfolio()` |
| DELETE | `/api/portfolios/{name}` | `db.delete_portfolio()` |

**제약:**
- `src/` import 금지
- `output/` 읽기 전용
- CSV 파일 없으면 빈 배열/null 반환 (절대 500 에러 금지)

**검증 기준:**
```bash
uvicorn api.main:app --reload
curl localhost:8000/api/portfolio-summary  # [] 또는 파싱된 JSON
curl localhost:8000/api/portfolios         # DB 목록
```

---

### Phase 1B — Next.js 골격 (세션 2, 1A와 병렬)

**전제:** Pre-Phase 0 완료  
**참고 파일:** `api/CONTRACT.md`, `design-tokens.json`, `web/app.py` (라우팅 구조)

**작업 내용:**
- `npx create-next-app@latest frontend --typescript --tailwind --app`
- `tailwind.config.ts` — `design-tokens.json` 색상/폰트 토큰 이식
- `app/layout.tsx` — 사이드바 내비게이션 (7개 페이지)
- `lib/api.ts` — `NEXT_PUBLIC_API_URL` 기반 fetch wrapper
- `lib/hooks.ts` — React Query hooks (이 단계에서는 mock 데이터 반환)
- 7개 라우트 빈 shell 페이지 생성

**제약:**
- 이 단계에서 실제 API 연결 없음 (mock 반환)
- 페이지 내용 구현 없음 (Phase 3에서)

**검증 기준:**
```bash
cd frontend && npm run dev
# 7개 라우트 모두 200 응답
# Tailwind 색상 토큰 적용 확인 (navy, indigo 등)
```

---

### Phase 2A — 차트 컴포넌트 (세션 3)

**전제:** Phase 1B 완료  
**참고 파일:** `web/components.py` (Plotly 로직 참고), `design-tokens.json`

**생성 컴포넌트:**

| 파일 | 입력 props | TradingView 시리즈 타입 |
|------|-----------|----------------------|
| `NavChart.tsx` | `data[]`, `tradeMarkers[]` | LineSeries + setMarkers (매수▲ 초록, 매도▼ 빨강) |
| `DrawdownChart.tsx` | `data[]` | AreaSeries (음수 영역, 빨강 반투명 fill) |
| `MonthlyBarChart.tsx` | `data[]` | HistogramSeries (양수 파랑, 음수 빨강) |
| `ComparisonChart.tsx` | `Record<string, data[]>` | 복수 LineSeries, 색상 팔레트 순환 |

**제약:**
- 모든 차트 컴포넌트에 `'use client'` + dynamic import 필수 (Next.js SSR 이슈)
- 빈 배열 전달 시 "데이터 없음" 문구 표시 (에러 throw 금지)

**검증 기준:**
- 4개 컴포넌트 mock 데이터로 `/dev-charts` 임시 페이지에서 렌더링 확인
- 빈 props 전달 시 에러 없이 fallback 렌더링

---

### Phase 2B — UI 컴포넌트 (세션 4, 2A와 병렬)

**전제:** Phase 1B 완료  
**참고 파일:** `web/components.py`, `design-tokens.json`

**생성 컴포넌트:**

| 파일 | 대응 Streamlit 함수 |
|------|-------------------|
| `KpiStrip.tsx` | `render_kpi_strip()` — 7개 지표 |
| `RuleBadge.tsx` | `render_rule_badges()` — passed/failed 색상 뱃지 |
| `TurnoverRow.tsx` | `render_turnover_section()` — 3열 |
| `HoldingsTable.tsx` | `render_holdings_table()` — 숫자 포맷, 정렬 |
| `StatusBar.tsx` | `render_status_bar()` — 데이터 기준일 |

**검증 기준:**
- TypeScript strict 에러 없음
- 각 컴포넌트 mock props로 렌더링 확인

---

### Phase 3A — 홈 + 운용현황 페이지 (세션 5)

**전제:** Phase 1A + 2A + 2B 완료  
**참고 파일:** `web/홈.py`, `web/pages/0_운용현황.py`

**작업 내용:**
- `app/page.tsx` (홈): KpiStrip + NavChart + DrawdownChart, 운용 전략 테이블
- `app/operations/page.tsx` (운용현황): TurnoverRow + RuleBadge + MonthlyBarChart + HoldingsTable + 운용보고서 섹션

**검증 기준:**
- FastAPI 실행 + `output/` 데이터 있을 때 실제 데이터 렌더링
- 데이터 없을 때 warning/skeleton 상태 (에러 없음)

---

### Phase 3B — ETF 포트폴리오 + 포트폴리오 비교 (세션 6, 3A와 병렬)

**전제:** Phase 1A + 2A + 2B 완료  
**참고 파일:** `web/pages/1_ETF_포트폴리오.py`, `web/pages/2_포트폴리오_비교.py`, `db.py`

**작업 내용:**
- `app/portfolio/page.tsx`: HoldingsTable + 포트폴리오 CRUD form (생성/삭제)
- `app/comparison/page.tsx`: ComparisonTable + ComparisonChart

**검증 기준:**
- 포트폴리오 생성 → DB 반영 → 목록 갱신 사이클 동작
- 비교 차트 다중 색상 팔레트 정상 표시

---

### Phase 3C — 매매일지 + 시황 + 운용보고서 (세션 7, 3A·3B와 병렬)

**전제:** Phase 1A + 2B 완료 (차트 불필요)  
**참고 파일:** `web/pages/3_매매일지.py`, `web/pages/4_시황.py`, `web/pages/5_운용보고서.py`

**작업 내용:**
- `app/trades/page.tsx`: 매매 내역 테이블 (정렬/필터)
- `app/market/page.tsx`: 준비중 안내
- `app/report/page.tsx`: `react-markdown`으로 MD 렌더링

**검증 기준:**
- 매매일지 테이블 정렬 동작
- 운용보고서 MD → HTML 렌더링 (없을 때 안내 문구)

---

### Phase 4 — 통합 검증 + Railway 배포 (세션 8, sequential)

**전제:** Phase 3 전체 완료

**작업 내용:**

1. `api/CONTRACT.md`와 실제 FastAPI 응답 일치 검증
2. `frontend/lib/hooks.ts` mock → 실제 API 연결 확인
3. Railway 서비스 설정:

```
Service 1 (FastAPI):
  Build:  pip install -r api/requirements.txt
  Start:  uvicorn api.main:app --host 0.0.0.0 --port $PORT
  Env:    DATABASE_URL (기존 PostgreSQL)

Service 2 (Next.js):
  Build:  cd frontend && npm ci && npm run build
  Start:  cd frontend && npm start
  Env:    NEXT_PUBLIC_API_URL = FastAPI 내부 Railway URL
```

4. `web/` 디렉토리 삭제
5. `CLAUDE.md` 스택 섹션 업데이트
6. `tests/test_boundaries.py` — `web/` → `frontend/`+`api/` 경계 재정의

**검증 기준:**
- Railway 두 서비스 모두 정상 기동
- Next.js → FastAPI → output/ 데이터 E2E 확인
- 기존 pytest 통과

---

## 오케스트레이터 역할

| 시점 | 역할 |
|------|------|
| Pre-Phase 0 | `api/CONTRACT.md` 직접 작성 |
| 각 Phase 시작 전 | 세션 프롬프트 작성 (전제 파일 + 제약 + 검증 기준 포함) |
| 각 Phase 완료 후 | 출력물 검토, 계약 일치 여부 확인, 다음 Phase 프롬프트 조정 |

## 세션 투입 타임라인

```
Day 1   [Pre-0] Contract 작성 (오케스트레이터)
        [1A] FastAPI 구현 ─────────────────────────────────┐
        [1B] Next.js 골격 ──────────────────────────────┐  │
Day 2                      [2A] 차트 컴포넌트 ──────┐   │  │
                           [2B] UI 컴포넌트 ─────┐  │   │  │
Day 3   [3A] 홈 + 운용현황 ──────────────────┐   │  │   │  │
        [3B] ETF + 비교 ──────────────────┐  │   │  │   │  │
        [3C] 매매일지 외 ──────────────┐  │  │   │  │   │  │
Day 4                                 └──┘  └──┘  └──┘   └──┘
        [4] 통합 + 배포
```

**총 세션 수:** 8개  
**최대 동시 실행:** 3개 (Phase 3)
