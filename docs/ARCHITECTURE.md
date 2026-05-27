# ARCHITECTURE — DBGAPS 포트폴리오 자동화 대시보드

## 디렉토리 구조

```
dbgaps_dashboard/
├── data/                        # 입력 CSV + CHANGELOG.json (Git 관리)
│   ├── etf_master.csv           # ETF 마스터 (188개 종목)
│   ├── prices_daily.csv         # 일별 종가 (pykrx 업데이트)
│   ├── trades.csv               # 매매일지 (run_engine.py / conftest.py 사용)
│   ├── CHANGELOG.json           # git 히스토리 기반 자동 생성 (update_changelog.py)
│   ├── sample_etf_master.csv    # 테스트용 샘플
│   └── sample_prices_daily.csv  # 테스트용 샘플
├── portfolios/                  # 포트폴리오 비중 시드 CSV (PostgreSQL 초기 시딩용)
│   ├── base.csv
│   ├── aggressive.csv
│   └── conservative.csv
├── src/                         # 계산 엔진 (pandas만 의존)
│   ├── __init__.py
│   ├── metrics.py               # 성과지표 순수 함수
│   ├── backtest.py              # 백테스트 실행 및 요약
│   ├── portfolio.py             # 매매일지 → 현재 보유 평가
│   ├── rules.py                 # 대회 규칙 체크
│   ├── turnover.py              # 회전율 계산
│   ├── update_prices.py         # 데이터 수집 전용 (pykrx)
│   ├── report_builder.py        # Markdown 월간보고서 생성
│   ├── run_engine.py            # 실제 데이터 전체 엔진 실행 → output/
│   └── run_sample_engine.py     # 샘플 데이터 엔진 실행 (개발/테스트용)
├── api/                         # FastAPI 백엔드
│   ├── main.py                  # 앱 초기화, CORS, 라우터 4개 등록
│   ├── schemas.py               # Pydantic v2 응답 모델
│   └── routers/
│       ├── dashboard.py         # output/ CSV + trade_log DB 기반 엔드포인트 (21개)
│       ├── portfolios.py        # PostgreSQL CRUD + POST /api/backtest
│       ├── trades.py            # PostgreSQL trade_log 테이블 CRUD (4개)
│       └── risk.py              # HHI, 데이터헬스, ETF별 위험 분석 (2개)
├── frontend/                    # Next.js 15 App Router
│   ├── app/                     # 라우트별 page.tsx
│   ├── components/
│   │   ├── charts/              # TradingView Lightweight Charts v5 래퍼
│   │   └── ui/                  # 공통 UI 컴포넌트
│   ├── lib/
│   │   ├── api.ts               # fetch 래퍼 (get, post, del)
│   │   ├── hooks/               # TanStack Query v5 훅
│   │   └── utils/metrics.ts     # 순수 계산 유틸 (프론트엔드 KPI 계산)
│   └── railway.toml             # 프론트엔드 Railway 배포 설정
├── output/                      # 계산 결과물 (수동 편집 금지, Railway는 Git에서 읽음)
│   ├── portfolio_summary.csv
│   ├── backtest_nav.csv
│   ├── current_holdings.csv
│   ├── monthly_returns.csv
│   ├── rule_individual_etf.csv
│   ├── rule_risk_asset.csv
│   ├── turnover_initial/weekly/monthly.csv
│   ├── comparison/              # 멀티 포트폴리오 비교 결과
│   └── report_YYYYMM.md
├── tests/                       # pytest
├── docs/                        # 설계 문서
├── scripts/                     # 유틸리티 스크립트
│   ├── execute.py               # Phase plan runner
│   └── update_changelog.py      # git 기반 CHANGELOG.json 생성
├── db.py                        # PostgreSQL 공유 모듈 (api/ + src/ 양측에서 사용)
├── railway.toml                 # 백엔드 Railway 배포 설정
└── requirements.txt             # Python 의존성
```

## 모듈 인터페이스

### src/metrics.py

```python
# 순수 함수, NAV Series → 지표 float / None
cumulative_return(nav: pd.Series) -> float
cagr(nav: pd.Series, periods_per_year=252) -> float
mdd(nav: pd.Series) -> float
drawdown_series(nav: pd.Series) -> pd.Series
annual_volatility(values, periods_per_year=252) -> float
win_rate(values) -> float
beta(portfolio_returns, benchmark_returns) -> float | None
alpha(portfolio_returns, benchmark_returns, risk_free_rate=0.0) -> float | None
sharpe_ratio(values, risk_free_rate=0.0, periods_per_year=252) -> float | None
calmar_ratio(nav, periods_per_year=252) -> float | None
sortino_ratio(returns) -> float | None
mdd_duration(nav) -> int | None
monthly_returns(backtest_result) -> pd.DataFrame
summarize_performance(nav, benchmark_nav=None, risk_free_rate=0.0) -> MetricsSummary
```

### src/backtest.py

```python
load_prices(path) -> pd.DataFrame
load_weights(path) -> pd.Series            # code → weight (정규화됨)
price_matrix(prices, codes=None) -> pd.DataFrame
run_backtest(prices, weights, initial_value=1_000_000_000, rebalance=None) -> pd.DataFrame
benchmark_nav(prices, benchmark_code, initial_value=1_000_000_000) -> pd.Series
summarize_backtest(result, benchmark=None, risk_free_rate=0.0) -> dict
export_backtest_summary(prices_path, portfolio_path, output_path, ...) -> pd.DataFrame
```

### src/portfolio.py

```python
load_trades(path) -> pd.DataFrame
evaluate_holdings(trades, prices, etf_master=None, as_of=None) -> pd.DataFrame
# → code, name, quantity, avg_price, cost_basis, current_price, market_value,
#   unrealized_pnl, unrealized_return, current_weight, risk_type, asset_class
```

### src/rules.py

```python
check_individual_etf_limit(portfolio, limit=0.20) -> pd.DataFrame
check_risk_asset_limit(portfolio, limit=0.70, risk_col="risk_type") -> dict
check_portfolio_rules(portfolio, individual_limit=0.20, risk_limit=0.70) -> dict
```

### src/turnover.py

```python
initial_turnover(trades, capital_base, start_date=None, end_date=None) -> dict
weekly_turnover(trades, capital_base) -> pd.DataFrame
monthly_turnover(trades, capital_base) -> pd.DataFrame
check_turnover_limits(trades, capital_base, initial_limit=0.80, period_limit=0.10, ...) -> dict
```

## 데이터 흐름

```
[데이터 수집]
  pykrx → src/update_prices.py → data/prices_daily.csv

[계산 레이어 — src/]
  data/prices_daily.csv + PostgreSQL 포트폴리오 → backtest.py → output/backtest_nav.csv, monthly_returns.csv, portfolio_summary.csv
  data/trades.csv + data/prices_daily.csv       → portfolio.py → output/current_holdings.csv
  output/current_holdings.csv                   → rules.py     → output/rule_*.csv
  data/trades.csv                               → turnover.py  → output/turnover_*.csv
  output/ 전체                                   → report_builder.py → output/report_YYYYMM.md

[API 레이어 — api/]
  output/*.csv                    → dashboard.py → JSON (읽기 전용)
  PostgreSQL trade_log            → dashboard.py → /actual-nav, /live-holdings, /live-rules, /portfolio-etfs
  PostgreSQL portfolios           → portfolios.py → CRUD + 온디맨드 백테스트
  trade_log DB + prices_daily.csv → risk.py       → /risk/portfolio, /risk/etf-analysis

[표시 레이어 — frontend/]
  FastAPI JSON → TanStack Query 훅 → React 컴포넌트 → 브라우저
```

## 설계 패턴

- **계산 모듈은 순수 함수 기반**: 파일 I/O와 계산 로직을 분리. 계산 함수는 DataFrame을 받아 DataFrame/dict를 반환.
- **데이터 수집은 update_prices.py에만**: 네트워크 의존성을 한 곳에 격리 (CRITICAL-2).
- **api/는 src/ import 금지**: output/ CSV 읽기 또는 DB 직접 접근만 허용 (CRITICAL-1). 예외: `portfolios.py`의 POST /api/backtest.
- **live 데이터는 DB에서 직접**: live-holdings, actual-nav, live-rules, risk 분석은 trade_log PostgreSQL FIFO 계산. src/ import 없이 인라인 구현.
- **Railway 배포 시 run_sample_engine.py 금지**: startCommand에 포함 시 output/ CSV를 샘플 데이터로 덮어씌움 (SYNC-3).
- **output/ 변경 후 커밋 필수**: Railway 백엔드는 output/*.csv를 Git에서 직접 읽음 (SYNC-3).
- **테스트는 sample 데이터로**: 실 데이터 없이도 tests/가 통과해야 함.
