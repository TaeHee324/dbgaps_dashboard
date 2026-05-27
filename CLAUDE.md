# CLAUDE.md - DBGAPS Dashboard Harness

This repository builds the DBGAPS ETF portfolio automation dashboard.

DBGAPS is an internal financial operations dashboard for ETF portfolio review. It is read-only over generated `output/` files. It is not a marketing site, trading terminal, live market data app, or investment recommendation product.

## Required Context

Before changing calculation, data, or architecture:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `docs/data_schema.md`
- `docs/PROJECT_STATUS.md`

Before changing UI, UX, visual design, frontend copy, charts, tables, or any file under `frontend/`:

- `docs/DESIGN.md`
- `docs/DESIGN-LANGUAGE.md`
- `docs/design-tokens.json`
- `docs/QA_CHECKLIST.md`

Design authority order:

1. `docs/DESIGN.md` defines product character and visual direction.
2. `docs/DESIGN-LANGUAGE.md` defines design judgment rules and anti-patterns.
3. `docs/design-tokens.json` defines machine-readable visual tokens.
4. `docs/QA_CHECKLIST.md` is the final UI review checklist.

## Tech Stack

- Python 3.12
- pandas >= 2.0
- pykrx only for ETF price collection in `src/update_prices.py`
- FastAPI + uvicorn (백엔드 API 서버)
- Next.js 15 App Router + TypeScript + Tailwind CSS (프론트엔드)
- TanStack Query v5 (클라이언트 상태관리)
- TradingView Lightweight Charts v5 (차트)
- CSV files as the primary storage format for prices and trade history
- PostgreSQL (via Railway) for portfolio definitions; accessed through `db.py`
- psycopg2-binary + python-dotenv for database connectivity
- Railway 2개 서비스 (FastAPI 백엔드 + Next.js 프론트엔드)

## Requirements 관리

pandas, psycopg2-binary 버전 변경 시 루트 `requirements.txt`와 `api/requirements.txt` 동시 수정.

## Repository Layout

```text
data/                   Input CSV files managed in Git
portfolios/             Portfolio weight definitions (seed CSVs only; live data in PostgreSQL)
db.py                   Shared PostgreSQL module; imported by src/run_engine.py and api/routers/
src/                    Calculation engine
api/                    FastAPI 백엔드; output/ 및 data/ 읽기, PostgreSQL CRUD
frontend/               Next.js 프론트엔드 (App Router + TypeScript)
output/                 Generated results; do not manually edit for UI convenience
tests/                  pytest suite
docs/                   Architecture, ADR, schema, UI guide, design files, project status
scripts/                Harness and execution utilities
```

Key scripts:
- `execute.py`: 단계적 자동 실행 (phase plan runner)
- `reset_and_setup_demo.py`: DB 초기화 + 데모 데이터 세팅
- `insert_demo_trade_log.py`: 데모 trade_log 삽입
- `update_changelog.py`: 변경이력 자동 갱신

Expected `src/` roles:

- `metrics.py`: CAGR, MDD, alpha, beta, volatility, win rate, Sharpe, Calmar
- `backtest.py`: portfolio backtest and benchmark NAV logic
- `portfolio.py`: current holdings evaluation from trades and prices
- `rules.py`: ETF and risk-asset rule checks
- `turnover.py`: turnover checks
- `update_prices.py`: pykrx data collection only
- `report_builder.py`: Markdown report generation

Expected `api/` roles:

- `main.py`: FastAPI app, CORS middleware, router registration
- `routers/dashboard.py`: output/ 및 data/ CSV 읽기 엔드포인트
- `routers/portfolios.py`: PostgreSQL CRUD + POST /api/backtest (src/ import 허용 예외)
- `routers/trades.py`: PostgreSQL DB `trade_log` 테이블 CRUD (`data/trade_log.json`은 존재하지 않음)
- `schemas.py`: Pydantic 응답 모델

## Frontend Routes

| 경로 | 파일 | 상태 | 설명 |
|------|------|------|------|
| `/` | `app/page.tsx` | 구현됨 | 운용현황 대시보드 (메인) |
| `/risk` | `app/risk/page.tsx` | 구현됨 | 리스크 관리 (HHI, MDD, ETF별 분석) |
| `/operations` | `app/operations/page.tsx` | redirect → `/` | `redirect("/")` 래퍼, 직접 수정 금지 |
| `/comparison` | `app/comparison/page.tsx` | 구현됨 | 포트폴리오 비교 백테스트 탭 |
| `/portfolio` | `app/portfolio/page.tsx` | 구현됨 | ETF 포트폴리오 관리 |
| `/trades` | `app/trades/page.tsx` | 구현됨 | 매매 거래내역 |
| `/report` | `app/report/page.tsx` | 구현됨 | Markdown 월별 리포트 뷰어 |
| `/changelog` | `app/changelog/page.tsx` | 구현됨 | 변경이력 |
| `/market` | `app/market/page.tsx` | 준비중 | 시황 (플레이스홀더) |
| `/rules` | `app/rules/page.tsx` | 준비중 | 대회 룰 (플레이스홀더) |
| `/research` | `app/research/page.tsx` | 준비중 | 리서치 (플레이스홀더) |

Expected `frontend/` roles:

- `app/`: Next.js App Router 페이지 (page.tsx per route)
- `components/`: 재사용 UI 컴포넌트 (charts, tables, badges)
- `lib/api.ts`: fetch 래퍼 (get, post, del)
- `lib/hooks/`: TanStack Query 훅 (dashboard.ts, portfolio.ts, trades.ts)
- `lib/utils/metrics.ts`: 순수 계산 유틸 (`computeActualOpsMetrics`, `computeStrategyMetrics`)

## Critical Boundaries

### CRITICAL-1: `api/` must not import `src` (except portfolios.py)

`api/routers/portfolios.py`의 `POST /api/backtest` 핸들러에서만 `src/backtest`, `src/metrics`, `src/rules` import 허용.
다른 모든 `api/` 파일은 `src/` import 금지. `output/` CSV를 읽는 방식으로 대신한다.
Exception: `api/` 전체에서 `db` (root-level `db.py`) import 허용.

Reason: calculation and API must remain deployable and testable independently.

파생 규칙: `dashboard.py`에서 기간별 메트릭(CAGR/MDD/Sharpe)을 동적 재계산해야 할 때는
`/api/comparison/nav` nav 시계열을 그대로 내려보내고 프론트엔드 JS에서 계산할 것.

### CRITICAL-2: `api/` must not import `pykrx` or fetch live data

`src/update_prices.py` is the only place where pykrx and network data collection belong.

Reason: the API server must stay read-only, lightweight, and deterministic.

Note: `api/requirements.txt`에 pykrx가 설치됨 — `_run_refresh()` subprocess 실행을 위해 필요. import 금지 원칙과 무관 (모듈 import ≠ subprocess 실행).

### CRITICAL-3: Generated outputs are contracts

`output/` files are generated artifacts. Do not manually edit them to make the UI look right. Fix the engine or schema instead.

### CRITICAL-4: UI work must follow design harness files

Any UI or UX work must read the design files listed above before editing. Do not rely on generic "make it pretty" behavior.

## Design Rules

- Keep the dashboard calm, dense, and auditable.
- Do not create a marketing hero page, pricing section, decorative gradient page, or CTA-heavy layout.
- Do not copy Stripe branding, assets, copy, or layouts. Only borrow restrained fintech principles.
- Use white/light surfaces, deep navy text, sparse indigo accents, and tabular numerals.
- Avoid pure black text, nested cards, decorative gradients, vague labels, and repeated generic cards.
- Tables, charts, rules, turnover, benchmark context, and data freshness are first-class UI.
- Fix garbled labels when editing nearby UI code.
- Do not add trading actions, live orders, or investment advice language.

## Data Flow

```text
pykrx -> src/update_prices.py -> data/prices_daily.csv
data/*.csv + portfolios/*.csv -> src/ calculation engine -> output/
output/*.csv -> api/ FastAPI -> frontend/ Next.js
```

## Defaults

- Benchmark code: `069500` KODEX 200
- Risk-free rate: `0.0`
- Initial capital: `1_000_000_000`
- Individual ETF limit: `20%`
- Risk asset limit: `70%`
- Initial turnover minimum: `80%` (하한 — 미달 시 위반; `passed = turnover >= 0.80`)
- Monthly turnover minimum: `10%` (하한 — 미달 시 위반; `passed = turnover >= 0.10`)

## Environment Setup

Copy `.env.example` to `.env` and set `DATABASE_URL` to the Railway external (TCP proxy) URL:

```bash
cp .env.example .env
# Edit .env: DATABASE_URL=postgresql://postgres:<password>@monorail.proxy.rlwy.net:<port>/railway
# Find the external URL in: Railway console → PostgreSQL service → Connect → Public Network
```

Without `DATABASE_URL`, `run_engine.py` and the ETF portfolio page will fail.

## Development Commands

```bash
pip install -r requirements.txt
cp .env.example .env              # then fill in DATABASE_URL
uvicorn api.main:app --reload     # FastAPI 개발 서버
cd frontend && npm install && npm run dev  # Next.js 개발 서버
python src/update_prices.py
python src/run_engine.py          # production engine (real data → output/)
python src/run_sample_engine.py   # sample data engine — 로컬 테스트 전용; Railway startCommand에 포함 금지
python -m pytest tests/ -q
python scripts/execute.py <phase-dir>
```
## Changelog Automation

`/changelog` displays `data/CHANGELOG.json` through `GET /api/update-log`.
Keep that file generated from git history; do not hand-edit entries.

Install repository hooks once per clone:

```bash
git config core.hooksPath .githooks
```

The `pre-push` hook checks whether `data/CHANGELOG.json` is current. If stale,
it generates the file, creates a dedicated `chore: update changelog` commit, and
stops the push. Run `git push` again after that hook-created commit.

Manual refresh:

```bash
python scripts/update_changelog.py
git add data/CHANGELOG.json
git commit -m "chore: update changelog"
```

## Sync Rules (Critical)

### SYNC-1: 메트릭 필드 추가 시 반드시 6곳 동시 수정

`MetricsSummary`에 필드를 추가하거나 `portfolio_summary.csv` 컬럼을 늘릴 때:

1. `src/metrics.py` — `MetricsSummary` 데이터클래스 + `as_dict()`
2. `src/run_engine.py` — 포트폴리오 요약 섹션 **AND** `run_comparison_backtests()` rows dict
3. `api/schemas.py` — `PortfolioSummary` + `ComparisonSummaryItem` Pydantic 모델
4. `api/routers/dashboard.py` — `portfolio_summary()` 엔드포인트 `base_columns`/`extra_columns` 목록 (하드코딩)
5. `frontend/lib/hooks/dashboard.ts` — `PortfolioSummary` + `ComparisonSummaryItem` TS 타입
6. `tests/test_output_schema.py` — `OUTPUT_SCHEMAS["portfolio_summary.csv"]` 컬럼 목록

누락 시 증상: CSV에 데이터 있는데 API가 `null` 반환, UI에서 `—` 표시, 또는 pytest 실패.

### SYNC-2: 비교 CSV는 두 경로에서 독립 생성됨

`output/comparison/*.csv`는 두 곳에서 독립적으로 작성된다:
- `src/run_engine.py::run_comparison_backtests()` — 엔진 전체 실행 시
- `api/routers/portfolios.py` POST `/api/portfolios` 핸들러 — 포트폴리오 저장 시

한쪽 스키마를 바꾸면 (컬럼 추가, 컬럼명 변경 등) 반드시 두 경로 모두 수정.
누락 시 증상: 포트폴리오 저장 후에는 데이터 없고 엔진 실행 후에만 데이터 생김 (또는 반대).

### SYNC-3: `output/` 파일 커밋 필수

Railway 백엔드는 `output/*.csv`를 git에서 직접 읽는다. 엔진 실행 후 output/ 변경분을 커밋·푸시하지 않으면 배포된 서비스에 반영되지 않는다.

**CRITICAL**: `railway.toml`(`frontend/railway.toml`도 동일) startCommand에 `run_sample_engine.py`를 포함하면 `data/sample_prices_daily.csv`(2026-01 11행 샘플)로 `output/` CSV를 덮어씌워 커밋된 데이터가 무효화된다.
올바른 백엔드 startCommand: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`

Railway 설정 파일 위치:
- 백엔드: `railway.toml`
- 프론트엔드: `frontend/railway.toml`

엔진 실행 후 체크리스트:

```bash
git add output/
git commit -m "chore: regenerate output CSVs"
git push
```

### SYNC-4: `summarize_backtest()` DatetimeIndex 변환 필수

`src/backtest.py::summarize_backtest()`에서 nav 인덱스를 DatetimeIndex로 변환해야 `win_rate_monthly` 등 월별 메트릭이 동작한다. 변환 없이 문자열 인덱스면 해당 메트릭이 `None` 반환.

```python
nav.index = pd.to_datetime(nav.index, errors="coerce")
```

### SYNC-5: 현황 페이지 보유종목은 LiveHolding 사용

`/api/holdings` (output/current_holdings.csv 기반)와 `/api/live-holdings` (trade_log DB 기반) 두 엔드포인트가 존재한다. 운용현황 페이지는 `useLiveHoldings()` 사용. `useCurrentHoldings()`는 레거시; 신규 UI에서 사용 금지.

### SYNC-6: 규칙 체크는 live holdings 기반 엔드포인트 사용

`/api/rules`는 엔진 마지막 실행 시점의 `output/*.csv`를 읽는다(stale).
운용현황 페이지의 규칙 카드는 `useLiveHoldings()`와 동일한 시점 데이터를 보여야 한다.
신규 규칙 엔드포인트는 `dashboard.py` 내에서 `src/` import 없이 직접 비중 체크로 구현.
`useRules()` → `/api/rules`는 레거시; 운용현황 페이지 규칙 카드에서 사용 금지.

### SYNC-7: 회전율 기준은 하한(이상)이며 상한(이하)이 아님

`src/turnover.py` `check_turnover_limits()`의 `passed` 판정은 반드시 `>=`.
초기 80%, 월별 10%는 **최소 요건(하한)**이므로 `<=`(초과 시 위반)로 구현하면 통과/위반이 완전 반전된다.
UI 레이블도 "한도"(상한 뉘앙스) 대신 "최소"를 사용할 것.

### SYNC-8: 현재가 갱신은 update_prices → run_engine 순서 필수

`/api/refresh-prices` 갱신 플로우는 두 단계가 모두 실행되어야 화면에 반영됨:
1. `src/update_prices.py` → `data/prices_daily.csv` 갱신
2. `src/run_engine.py` → `output/` CSV 재생성

`update_prices.py`만 실행하면 prices CSV만 바뀌고 dashboard output은 stale 상태 유지.

### SYNC-9: `actual_nav()` NAV = ETF시가 + 현금

`api/routers/dashboard.py::actual_nav()`가 반환하는 `portfolio_value` 필드 = ETF시가 합계 + 현금잔고(total_value).
`daily_return`·`cumulative_return`·`drawdown` 모두 total_value 기준으로 계산됨.
`price_pivot`에 `.ffill()` 필수 — 누락 시 국경일·거래중단 ETF가 0으로 계산되어 NAV 가짜 급락 발생.
변경 시 `prev_total_value` 추적 패턴 유지할 것 (`prev_value`로 되돌리면 매도 당일 NAV 폭락 버그 재발).

### SYNC-10: 운용현황 KPI는 두 스트립으로 이원화됨

`/` 페이지 KPI는 성격이 다른 두 섹션으로 분리됨:
- `ActualOpsKpiStrip` ← `computeActualOpsMetrics(actualNav)`: 누적수익률·MDD·일간승률·변동성·MDD기간 (실제 거래 기반)
- `StrategyKpiStrip` ← `computeStrategyMetrics(strategyPoints)`: CAGR·샤프·칼마·소르티노·월별승률·VaR95% (백테스트, 기간 필터 후 전달)

`usePortfolioSummary()` 및 `computeMetricsFromNav()`는 운용현황 페이지에서 사용 금지 (레거시 제거됨).
`computeStrategyMetrics()`에서 백테스트 nav의 `cumulative_return`·`drawdown` 필드를 그대로 쓰면 안 됨 — 전체 역사 고점 기준이므로 기간 필터 후 `portfolio_value`로 구간 내 직접 재계산해야 함 (metrics.ts 구현 참조).

## DB Schema Changes

별도 마이그레이션 프레임워크 없음. 컬럼 추가·변경 시:
1. Railway 콘솔 또는 psql로 SQL 직접 실행 (예: `ALTER TABLE portfolios ADD COLUMN group_name TEXT;`)
2. `api/schemas.py` Pydantic 모델 동시 수정
3. 해당 라우터(`portfolios.py` 등) 쿼리 동시 수정

## Validation

For Python code changes:

- Run `python -m pytest tests/ -q` when feasible.
- If tests are not run, state why.

For UI changes:

- Check `docs/QA_CHECKLIST.md`.
- Preserve `tests/test_boundaries.py` expectations.
- Confirm `api/` (portfolios.py 제외) remains output-driven and src/ import-free.
