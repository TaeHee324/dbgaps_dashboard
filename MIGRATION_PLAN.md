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
| 상태 관리 | TanStack Query v5 (React Query) |
| 백엔드 | FastAPI + uvicorn |
| 배포 | Railway 두 서비스 (FastAPI + Next.js) |

## 목표 디렉토리 구조

```
dbgaps_dashboard/
├── src/               ← 변경 없음 (계산 엔진)
├── data/              ← 변경 없음
├── output/            ← 변경 없음 (FastAPI가 읽음)
├── db.py              ← 변경 없음 (FastAPI가 import)
├── api/               ← 신규: FastAPI 백엔드
│   ├── main.py
│   ├── routers/
│   │   ├── dashboard.py   # output/ CSV 엔드포인트
│   │   ├── portfolios.py  # PostgreSQL CRUD + 실시간 백테스트
│   │   └── trades.py      # trade_log.json CRUD
│   ├── schemas.py
│   └── requirements.txt
├── frontend/          ← 신규: Next.js 앱
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── providers.tsx             # QueryClientProvider 'use client' wrapper
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
│   │   ├── api.ts          # fetch wrapper (NEXT_PUBLIC_API_URL 기반)
│   │   └── hooks/
│   │       ├── dashboard.ts   # 운용현황·홈 관련 hooks
│   │       ├── portfolio.ts   # ETF·포트폴리오 관련 hooks
│   │       └── trades.ts      # 매매일지 관련 hooks
│   └── package.json
├── web/               ← Phase 4에서 삭제
├── railway.toml       ← Phase 4에서 FastAPI 서비스용으로 교체
└── tests/             ← 기존 유지 + API 경계 테스트 교체
```

## 아키텍처 경계

| 기존 규칙 | 신규 동등 규칙 |
|----------|--------------|
| `web/`는 `src/` import 금지 | `frontend/`는 `api/`를 통해서만 데이터 접근 |
| `web/`는 pykrx 금지 | `api/`도 pykrx 금지 (`src/`만 허용) |
| `output/`는 계약 | `output/`는 계약 (동일) |
| `db.py`는 `web/`에서 import 가능 | `db.py`는 `api/`에서 import 가능 |
| `web/1_ETF_포트폴리오.py` Architecture exception: `src/` 직접 import | `api/routers/portfolios.py` Architecture exception: `src/backtest`, `src/metrics`, `src/rules` import 허용 (실시간 백테스트 전용) |

---

## 전체 엔드포인트 목록 (Pre-Phase 0에서 CONTRACT.md로 확정)

### dashboard.py (output/ 읽기)

| Method | Path | 대응 함수 | 응답 shape |
|--------|------|-----------|-----------|
| GET | `/api/portfolio-summary` | `load_portfolio_summary()` | `{cumulative_return, cagr, mdd, alpha, beta, annual_volatility, win_rate, sharpe, calmar}` or `null` |
| GET | `/api/holdings` | `load_current_holdings()` | `[{code, name, quantity, avg_price, cost_basis, price_date, current_price, market_value, unrealized_pnl, unrealized_return, current_weight, risk_type, asset_class}]` |
| GET | `/api/backtest-nav` | `load_backtest_nav()` | `[{date: "YYYY-MM-DD", portfolio_value, daily_return, cumulative_return, drawdown}]` |
| GET | `/api/monthly-returns` | `load_monthly_returns()` | `[{year, month, monthly_return}]` |
| GET | `/api/comparison/summary` | `load_comparison_summary()` | `[{portfolio_name, cagr, mdd, sharpe, calmar}]` |
| GET | `/api/comparison/nav` | `load_comparison_nav()` | `{"base": [{date, portfolio_value, cumulative_return}], "aggressive": [...], ...}` |
| GET | `/api/rules` | `load_rule_results()` | `{"individual": [{code, name, current_weight, limit, excess, passed}], "risk_asset": {rule, risky_weight, limit, excess, passed}}` |
| GET | `/api/turnover` | `load_turnover()` | `{"initial": {traded_value, turnover, turnover_source, limit, passed}, "weekly": [{date, traded_value, turnover, turnover_source, limit, passed}], "monthly": [...]}` |
| GET | `/api/report` | `load_report()` | `{"content": "...", "filename": "report_202605.md"}` or `null` |
| GET | `/api/data-date` | `get_data_date()` | `{"date": "2026-05-22 10:00"}` |
| GET | `/api/etf-list` | prices_daily.csv + etf_master.csv 병합 | `[{code, name}]` |
| GET | `/api/etf-prices/{code}` | prices_daily.csv 필터 | `[{date: "YYYY-MM-DD", close}]` |
| GET | `/api/trade-log` | trade_log.json 읽기 | `[{date, action, etf_code, etf_name, weight_before, weight_after, reason, note}]` |

### portfolios.py (PostgreSQL CRUD + 백테스트)

| Method | Path | 대응 함수 |
|--------|------|-----------|
| GET | `/api/portfolios` | `db.list_portfolios()` |
| GET | `/api/portfolios/{name}` | `db.get_portfolio(name)` → `[{code, weight}]` or 404 |
| POST | `/api/portfolios` | `db.upsert_portfolio()` |
| DELETE | `/api/portfolios/{name}` | `db.delete_portfolio()` |
| POST | `/api/backtest` | `src/backtest.py` 직접 실행 (Architecture exception) → `{nav: [...], summary: {...}, monthly: [...]}` |

### trades.py (매매일지 CRUD)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/trade-log` | trade_log.json 읽기 |
| POST | `/api/trade-log` | 새 매매 기록 추가 → trade_log.json append |

> **영속성 주의**: `data/trade_log.json`은 파일시스템 쓰기. Railway 컨테이너는 ephemeral이므로 재배포 시 쓰기 데이터가 사라짐. 현재 단계에서는 git 커밋된 파일 기반으로 동작하고, PostgreSQL 이전은 향후 과제로 남김.

### 공통 제약

- CSV 파일 없으면 빈 배열/null 반환 (500 에러 금지)
- `src/` import는 `POST /api/backtest` 라우터에만 허용 (pykrx 금지)
- date 컬럼은 `YYYY-MM-DD` 문자열로 직렬화 (TradingView LightweightCharts 호환)
- CORS: `ALLOWED_ORIGINS` 환경변수로 관리 (개발: `http://localhost:3000`, 프로덕션: Railway Next.js public URL)

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

- 위 엔드포인트 목록 전체와 HTTP method
- 각 엔드포인트의 request/response JSON shape (TypeScript 타입 병기)
- 에러 처리 규약: 빈 데이터 → 빈 배열/null, 500 에러 금지
- CORS 설정 방침: `ALLOWED_ORIGINS` 환경변수 기반
- `POST /api/backtest` Architecture exception 명시
- date 필드 직렬화 규약: `YYYY-MM-DD` 문자열

---

### Phase 1A — FastAPI 백엔드 (세션 1)

**전제:** Pre-Phase 0 완료  
**참고 파일:** `web/data_loader.py`, `db.py`, `api/CONTRACT.md`, `src/backtest.py`, `src/metrics.py`, `src/rules.py`, `data/trade_log.json`

**생성 파일:**
- `api/main.py` — FastAPI 앱, CORS(`ALLOWED_ORIGINS` 환경변수), 라우터 등록
- `api/routers/dashboard.py` — `output/` CSV + `data/` 파일 → JSON 엔드포인트
- `api/routers/portfolios.py` — PostgreSQL CRUD + `POST /api/backtest`
- `api/routers/trades.py` — trade_log.json GET/POST
- `api/schemas.py` — Pydantic 응답 모델
- `api/requirements.txt` — fastapi, uvicorn, pandas, psycopg2-binary, python-dotenv (pykrx·streamlit·plotly 제외)

**세부 구현 주의사항:**

- `uvicorn api.main:app`을 루트에서 실행하므로 `import db`는 정상 동작
- `api/requirements.txt`는 루트 `requirements.txt`와 별도 독립 파일; pandas·psycopg2-binary 버전 중복 관리 주의
- `POST /api/backtest`: `sys.path`에 `src/` 추가 후 `backtest`, `metrics`, `rules` import (Architecture exception)
- `GET /api/comparison/nav`: `output/comparison/` 디렉토리를 동적 스캔, `{portfolio_name: [{date, portfolio_value, cumulative_return}]}` 형태로 직렬화
- `GET /api/etf-list`: `data/prices_daily.csv`의 고유 code + `data/etf_master.csv` name 병합
- `GET /api/etf-prices/{code}`: prices_daily.csv에서 해당 code 필터
- date 컬럼 전부 `YYYY-MM-DD` 문자열로 직렬화 (pandas Timestamp.strftime)
- `GET /api/backtest-nav` 응답에 benchmark 컬럼 없음 (현재 backtest_nav.csv에 benchmark_value 없음); 프론트엔드는 없을 때 단일 선만 렌더링

**검증 기준:**
```bash
uvicorn api.main:app --reload
curl localhost:8000/api/portfolio-summary   # {} 또는 파싱된 JSON
curl localhost:8000/api/portfolios          # DB 목록
curl localhost:8000/api/rules               # {"individual": [...], "risk_asset": {...}}
curl localhost:8000/api/turnover            # {"initial": {...}, "weekly": [...], "monthly": [...]}
curl localhost:8000/api/etf-list            # [{code, name}]
curl localhost:8000/api/trade-log           # [] (빈 파일이면 빈 배열)
```

---

### Phase 1B — Next.js 골격 (세션 2, 1A와 병렬)

**전제:** Pre-Phase 0 완료  
**참고 파일:** `api/CONTRACT.md`, `design-tokens.json`, `web/app.py` (라우팅 구조)

**작업 내용:**

```bash
# 대화형 입력 없이 실행 (--yes 필수)
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
cd frontend
npm install @tanstack/react-query @tanstack/react-query-devtools
```

- `tailwind.config.ts` — `design-tokens.json` 색상/폰트/간격 토큰 이식
- `app/providers.tsx` — `'use client'` + `QueryClientProvider` wrapper (layout.tsx는 Server Component라 직접 불가)
- `app/layout.tsx` — `<Providers>` import + 사이드바 내비게이션 (7개 페이지)
- `lib/api.ts` — `NEXT_PUBLIC_API_URL` 기반 fetch wrapper; 미설정 시 `http://localhost:8000` fallback
- `lib/hooks/dashboard.ts` — 운용현황·홈 관련 React Query hooks (이 단계에서는 mock 반환)
- `lib/hooks/portfolio.ts` — ETF·포트폴리오 관련 React Query hooks (mock)
- `lib/hooks/trades.ts` — 매매일지 관련 React Query hooks (mock)
- 7개 라우트 빈 shell 페이지 생성
- `package.json` start 스크립트: `"start": "next start -p ${PORT:-3000}"` (Railway PORT 환경변수 대응)

**제약:**
- 실제 API 연결 없음 (mock 반환)
- 페이지 내용 구현 없음 (Phase 3에서)
- hooks를 3개 파일로 분리해야 Phase 3 병렬 작업 시 git 충돌 없음

**검증 기준:**
```bash
cd frontend && npm run dev
# 7개 라우트 모두 200 응답
# Tailwind 색상 토큰 적용 확인 (navy, indigo 등)
# TypeScript 빌드 오류 없음
```

---

### Phase 2A — 차트 컴포넌트 (세션 3)

**전제:** Phase 1B 완료  
**참고 파일:** `web/components.py` (Plotly 로직 참고), `design-tokens.json`, `api/CONTRACT.md`

**생성 컴포넌트:**

| 파일 | 입력 props | TradingView 시리즈 타입 |
|------|-----------|----------------------|
| `NavChart.tsx` | `data: {time: string, value: number}[]`, `tradeMarkers?: TradeMarker[]` | LineSeries + setMarkers (매수▲ 초록, 매도▼ 빨강) |
| `DrawdownChart.tsx` | `data: {time: string, value: number}[]` | AreaSeries (음수 영역, 빨강 반투명 fill); `drawdown` 컬럼을 API에서 그대로 수신 |
| `MonthlyBarChart.tsx` | `data: {time: string, value: number}[]` | HistogramSeries (양수 파랑, 음수 빨강) |
| `ComparisonChart.tsx` | `series: Record<string, {time: string, value: number}[]>` | 복수 LineSeries, 색상 팔레트 순환 |

**구현 주의사항:**

- 모든 컴포넌트에 `'use client'` + `dynamic import` 필수 (Next.js SSR에서 window 객체 참조 오류 방지)
- `time` 필드는 `YYYY-MM-DD` 문자열 (LightweightCharts v5 호환, API 응답과 동일 형식)
- `NavChart`에서 benchmark 선: props에 benchmark 데이터 없으면 조용히 생략 (현재 API 응답에 없음)
- 빈 배열 전달 시 "데이터 없음" 문구 표시 (에러 throw 금지)

**검증 기준:**
- 4개 컴포넌트 mock 데이터로 `/dev-charts` 임시 페이지에서 렌더링 확인
- 빈 props 전달 시 에러 없이 fallback 렌더링
- TypeScript strict 오류 없음

---

### Phase 2B — UI 컴포넌트 (세션 4, 2A와 병렬)

**전제:** Phase 1B 완료  
**참고 파일:** `web/components.py`, `design-tokens.json`, `api/CONTRACT.md`

**생성 컴포넌트:**

| 파일 | 대응 Streamlit 함수 | props 타입 |
|------|-------------------|-----------|
| `KpiStrip.tsx` | `render_kpi_strip()` | `PortfolioSummary` (7개 지표); 홈 페이지에서는 CAGR·MDD·샤프 3개만 표시, 운용현황에서 7개 전체 표시 |
| `RuleBadge.tsx` | `render_rule_badges()` | `/api/rules` 응답 shape 기반 (individual 배열 + risk_asset 객체) |
| `TurnoverRow.tsx` | `render_turnover_section()` | `/api/turnover` 응답 shape 기반; initial은 date 없음, weekly/monthly는 배열 |
| `HoldingsTable.tsx` | `render_holdings_table()` | 숫자 포맷, 정렬 |
| `StatusBar.tsx` | `render_status_bar()` | 데이터 기준일 문자열 |

**검증 기준:**
- TypeScript strict 에러 없음
- 각 컴포넌트 mock props로 렌더링 확인
- `RuleBadge`, `TurnoverRow`의 props 타입이 CONTRACT.md shape과 일치

---

### Phase 3A — 홈 + 운용현황 페이지 (세션 5)

**전제:** Phase 1A + 2A + 2B 완료  
**참고 파일:** `web/홈.py`, `web/pages/0_운용현황.py`  
**수정 파일:** `lib/hooks/dashboard.ts` (mock → 실제 API 교체)

**작업 내용:**

- `app/page.tsx` (홈):
  - KpiStrip 3개 (CAGR·MDD·샤프)
  - NavChart + DrawdownChart (trade markers 포함, `/api/trade-log` 연결)
  - 운용 전략 테이블 (`/api/portfolios/base` 연결)
  - 시황 섹션: "준비 중" 안내 문구 (현재 `web/홈.py`와 동일)

- `app/operations/page.tsx` (운용현황):
  - StatusBar + KpiStrip (7개 전체)
  - NavChart + DrawdownChart (trade markers 포함)
  - TurnoverRow + RuleBadge
  - MonthlyBarChart
  - 포트폴리오 비교 섹션 (`ComparisonChart` + 비교 테이블, `0_운용현황.py`의 expander 대응)
  - HoldingsTable
  - 운용보고서 섹션: **완전 제거** (사이드바 '운용보고서' 페이지 링크로 충분, 0_운용현황.py의 보고서 expander 미이식)

- `lib/hooks/dashboard.ts`: mock → 실제 API 연결
  - `usePortfolioSummary`, `useBacktestNav`, `useMonthlyReturns`, `useCurrentHoldings`
  - `useTurnover`, `useRules`, `useComparisonSummary`, `useComparisonNav`
  - `useTradeLog`, `useDataDate`, `useReport`, `usePortfolioDetail("base")`

**검증 기준:**
- FastAPI 실행 + `output/` 데이터 있을 때 실제 데이터 렌더링
- 데이터 없을 때 warning/skeleton 상태 (에러 없음)
- TradeMarkers 있을 때 NavChart에 ▲▼ 표시

---

### Phase 3B — ETF 포트폴리오 + 포트폴리오 비교 (세션 6, 3A와 병렬)

**전제:** Phase 1A + 2A + 2B 완료  
**참고 파일:** `web/pages/1_ETF_포트폴리오.py`, `web/pages/2_포트폴리오_비교.py`, `db.py`  
**수정 파일:** `lib/hooks/portfolio.ts` (mock → 실제 API 교체)

**작업 내용:**

- `app/portfolio/page.tsx` (ETF & 포트폴리오):
  - ETF 탐색 패널: 검색 input + ETF 목록 테이블 (`/api/etf-list`)
  - 주가 차트: 선택 ETF의 가격 시계열 (`/api/etf-prices/{code}`), 기간 필터 (1M/3M/6M/1Y/전체), KPI 4개 (기간수익률·현재가·최고가·최저가)
  - 포트폴리오 구성 패널: 코드·비중 입력 rows, 비중 합계 표시
  - 백테스트 실행: `POST /api/backtest` 연결, 결과 KPI 7개 + 규칙 체크 + NavChart
  - 포트폴리오 저장/불러오기/삭제 CRUD (`/api/portfolios`, `/api/portfolios/{name}`)

- `app/comparison/page.tsx` (포트폴리오 비교):
  - 기간 필터 라디오 (1Y/3Y/5Y/전체) — 클라이언트 사이드 필터링 (전체 데이터 수신 후 cutoff 적용)
  - 비교 지표 테이블 (`/api/comparison/summary`)
  - ComparisonChart (`/api/comparison/nav`)

- `lib/hooks/portfolio.ts`: mock → 실제 API 연결
  - `useEtfList`, `useEtfPrices`, `usePortfolioList`, `usePortfolioDetail`
  - `useBacktest` (mutation), `useComparisonSummary`, `useComparisonNav`

**검증 기준:**
- ETF 검색 → 주가 차트 렌더링
- 포트폴리오 구성 → 백테스트 실행 → KPI + 차트 표시
- 포트폴리오 저장 → DB 반영 → 목록 갱신 사이클
- 비교 차트 기간 필터 동작

---

### Phase 3C — 매매일지 + 시황 + 운용보고서 (세션 7, 3A·3B와 병렬)

**전제:** Phase 1A + 2B 완료 (차트 불필요)  
**참고 파일:** `web/pages/3_매매일지.py`, `web/pages/4_시황.py`, `web/pages/5_운용보고서.py`  
**수정 파일:** `lib/hooks/trades.ts` (mock → 실제 API 교체)

**작업 내용:**

- `app/trades/page.tsx` (매매일지):
  - 매매 기록 입력 form (날짜·매수/매도·ETF코드·ETF명·비중전후·이유·메모)
  - form 제출 시 `POST /api/trade-log` 연결
  - 이력 테이블 (날짜 내림차순, 정렬/필터) + 상세 expander

- `app/market/page.tsx` (시황): "준비 중" 안내

- `app/report/page.tsx` (운용보고서):
  - `react-markdown`으로 MD 렌더링 (`/api/report`)
  - 없을 때 안내 문구

- `lib/hooks/trades.ts`: mock → 실제 API 연결
  - `useTradeLog` (query), `useAddTrade` (mutation)

**검증 기준:**
- 매매 기록 form 제출 → trade_log.json 추가 → 테이블 갱신
- 운용보고서 MD → HTML 렌더링 (없을 때 안내 문구)

---

### Phase 4 — 통합 검증 + Railway 배포 (세션 8, sequential)

**전제:** Phase 3 전체 완료

**작업 내용:**

**1. 사전 정리**
- `output/sample_backtest.csv` 삭제 (`test_no_sample_prefixed_output_files()` 현재 실패 중)
- `output/portfolio_holdings.csv` 삭제 (`current_holdings.csv`와 동일한 중복 파일; `run_engine.py`가 둘 다 생성하는 코드도 `current_holdings.csv`만 쓰도록 수정)
- `/dev-charts` 임시 페이지 삭제

**2. 검증**
- `api/CONTRACT.md`와 실제 FastAPI 응답 shape 일치 확인
- `lib/hooks/` 3개 파일 모두 실제 API 연결 확인 (mock 반환 없음)
- FastAPI 실행 + `output/` 데이터 있을 때 전체 7개 페이지 E2E 확인

**3. 테스트 업데이트**
- `tests/test_output_schema.py`: `DATA_LOADER` 경로(`web/data_loader.py`)가 삭제되므로 FastAPI 라우터 응답 스키마 검증으로 교체 (또는 `web/` 삭제 후 skip 조건 유지)
- `tests/test_boundaries.py`:
  - `test_web_does_not_import_src()`: `web/` 삭제 후 → `api/` 디렉토리 검사로 교체
    - `api/routers/portfolios.py` 이외 파일에서 `src/` import 금지 검사
    - `sys.path` 조작 후 직접 import 패턴도 감지 (현재 `1_ETF_포트폴리오.py` 우회 방식)
  - `test_pykrx_only_in_update_prices()`: `api/` 디렉토리도 포함하여 검사

**4. Railway 배포**

Railway 두 서비스 분리는 Railway 콘솔에서 수동 작업:
1. Railway 콘솔 → 기존 Streamlit 서비스 배포 중단 (삭제 전 대기)
2. New Service → GitHub repo 연결 → FastAPI 서비스 설정:
   ```
   Root Directory: /
   Build:   pip install -r api/requirements.txt
   Start:   python src/run_sample_engine.py && uvicorn api.main:app --host 0.0.0.0 --port $PORT
   Env:     DATABASE_URL (기존 PostgreSQL 재사용)
            ALLOWED_ORIGINS=https://<nextjs-railway-url>
   ```
3. New Service → frontend 서비스 설정:
   ```
   Root Directory: /frontend
   Build:   npm ci && npm run build
   Start:   npm start
   Env:     NEXT_PUBLIC_API_URL=https://<fastapi-railway-url>  ← public URL (브라우저에서 호출)
   ```
4. FastAPI 정상 기동 확인 후 Streamlit 서비스 삭제
5. `railway.toml` 교체 (FastAPI 서비스 기준):
   ```toml
   [build]
   builder = "nixpacks"

   [deploy]
   startCommand = "python src/run_sample_engine.py && uvicorn api.main:app --host 0.0.0.0 --port $PORT"
   restartPolicyType = "on_failure"
   ```

**5. 코드 정리**
- `web/` 디렉토리 삭제
- `CLAUDE.md` 스택 섹션 업데이트 (Streamlit/Plotly 제거, FastAPI/Next.js/TanStack Query 추가)
- `CLAUDE.md` requirements.txt 이중 관리 규칙 추가: pandas·psycopg2-binary 버전 변경 시 루트 + `api/requirements.txt` 동시 수정

**검증 기준:**
- Railway 두 서비스 모두 정상 기동
- Next.js → FastAPI → output/ 데이터 E2E 확인
- `python -m pytest tests/ -q` 전체 통과

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

## 확정 결정 사항

1. **운용현황 페이지의 보고서 섹션**: 완전 제거. 사이드바 '운용보고서' 페이지 링크로 대체.
2. **`POST /api/backtest` Architecture exception 범위**: `api/routers/portfolios.py`에서만 `src/` import 허용.
3. **trade_log.json 영속성**: 파일 기반 유지, Railway 재배포 시 소실 허용. PostgreSQL 이전은 향후 과제.
