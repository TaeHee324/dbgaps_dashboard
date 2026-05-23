# CLAUDE.md - DBGAPS Dashboard Harness

This repository builds the DBGAPS ETF portfolio automation dashboard.

DBGAPS is an internal financial operations dashboard for ETF portfolio review. It is read-only over generated `output/` files. It is not a marketing site, trading terminal, live market data app, or investment recommendation product.

## Required Context

Before changing calculation, data, or architecture:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `docs/data_schema.md`
- `PROJECT_STATUS.md`

Before changing UI, UX, visual design, frontend copy, charts, tables, or any file under `frontend/`:

- `DESIGN.md`
- `DESIGN-LANGUAGE.md`
- `design-tokens.json`
- `QA_CHECKLIST.md`

Design authority order:

1. `DESIGN.md` defines product character and visual direction.
2. `DESIGN-LANGUAGE.md` defines design judgment rules and anti-patterns.
3. `design-tokens.json` defines machine-readable visual tokens.
4. `QA_CHECKLIST.md` is the final UI review checklist.

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
docs/                   Architecture, ADR, schema, UI guide
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

## Validation

For Python code changes:

- Run `python -m pytest tests/ -q` when feasible.
- If tests are not run, state why.

For UI changes:

- Check `QA_CHECKLIST.md`.
- Preserve `tests/test_boundaries.py` expectations.
- Confirm `api/` (portfolios.py 제외) remains output-driven and src/ import-free.
