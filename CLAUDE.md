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
phases/                 Harness phase plans
scripts/                Harness and execution utilities
```

Expected `src/` roles:

- `metrics.py`: CAGR, MDD, alpha, beta, volatility, win rate, Sharpe, Calmar
- `backtest.py`: portfolio backtest and benchmark NAV logic
- `portfolio.py`: current holdings evaluation from trades and prices
- `rules.py`: ETF and risk-asset rule checks
- `turnover.py`: turnover checks
- `update_prices.py`: pykrx data collection only
- `charts.py`: static chart output when implemented
- `report_builder.py`: Markdown report generation when implemented

Expected `api/` roles:

- `main.py`: FastAPI app, CORS middleware, router registration
- `routers/dashboard.py`: output/ 및 data/ CSV 읽기 엔드포인트
- `routers/portfolios.py`: PostgreSQL CRUD + POST /api/backtest (src/ import 허용 예외)
- `routers/trades.py`: data/trade_log.json CRUD
- `schemas.py`: Pydantic 응답 모델

Expected `frontend/` roles:

- `app/`: Next.js App Router 페이지 (page.tsx per route)
- `components/`: 재사용 UI 컴포넌트 (charts, tables, badges)
- `lib/api.ts`: fetch 래퍼 (get, post, del)
- `lib/hooks/`: TanStack Query 훅 (dashboard.ts, portfolio.ts, trades.ts)

## Critical Boundaries

### CRITICAL-1: `api/` must not import `src` (except portfolios.py)

`api/routers/portfolios.py`의 `POST /api/backtest` 핸들러에서만 `src/backtest`, `src/metrics`, `src/rules` import 허용.
다른 모든 `api/` 파일은 `src/` import 금지. `output/` CSV를 읽는 방식으로 대신한다.
Exception: `api/` 전체에서 `db` (root-level `db.py`) import 허용.

Reason: calculation and API must remain deployable and testable independently.

### CRITICAL-2: `api/` must not import `pykrx` or fetch live data

`src/update_prices.py` is the only place where pykrx and network data collection belong.

Reason: the API server must stay read-only, lightweight, and deterministic.

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
- Initial capital: `100_000_000`
- Individual ETF limit: `20%`
- Risk asset limit: `70%`
- Initial turnover limit: `80%`
- Weekly/monthly turnover limit: `10%`

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
python src/run_sample_engine.py   # sample data engine (test/dev use)
python -m pytest tests/ -q
python scripts/execute.py <phase-dir>
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

## Validation

For Python code changes:

- Run `python -m pytest tests/ -q` when feasible.
- If tests are not run, state why.

For UI changes:

- Check `docs/QA_CHECKLIST.md`.
- Preserve `tests/test_boundaries.py` expectations.
- Confirm `api/` (portfolios.py 제외) remains output-driven and src/ import-free.
