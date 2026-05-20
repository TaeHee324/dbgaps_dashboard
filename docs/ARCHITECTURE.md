# ARCHITECTURE — DBGAPS 포트폴리오 자동화 대시보드

## 디렉토리 구조

```
dbgaps_dashboard/
├── data/                        # 입력 데이터 (Git 관리)
│   ├── etf_master.csv           # ETF 마스터 (188개)
│   ├── prices_daily.csv         # 일별 종가 (pykrx 업데이트)
│   ├── trades.csv               # 매매일지
│   ├── sample_etf_master.csv    # 테스트용 샘플
│   └── sample_prices_daily.csv  # 테스트용 샘플
├── portfolios/
│   └── base.csv                 # 포트폴리오 비중 정의 (code, weight)
├── src/                         # 계산 엔진 (pandas만 의존)
│   ├── __init__.py
│   ├── metrics.py               # 성과지표 순수 함수
│   ├── backtest.py              # 백테스트 실행 및 요약
│   ├── portfolio.py             # 매매일지 → 현재 보유 평가
│   ├── rules.py                 # 대회 규칙 체크
│   ├── turnover.py              # 회전율 계산
│   ├── update_prices.py         # 데이터 수집 전용 (pykrx)
│   ├── charts.py                # 그래프 생성 (phase-2 산출물)
│   ├── report_builder.py        # 보고서 생성 (phase-3 산출물)
│   └── run_sample_engine.py     # 전체 파이프라인 통합 실행
├── output/                      # 계산 결과물 (Git 제외)
│   ├── portfolio_summary.csv
│   ├── sample_backtest.csv
│   ├── current_holdings.csv
│   ├── rule_individual_etf.csv
│   ├── rule_risk_asset.csv
│   ├── turnover_*.csv
│   └── charts/                  # PNG 그래프 (phase-2 산출물)
├── tests/                       # pytest
├── docs/                        # 설계 문서
├── phases/                      # Harness 실행 단계
└── scripts/
    ├── execute.py               # Harness 자동 실행 엔진
    └── test_execute.py
```

## 모듈 인터페이스

### metrics.py

```python
# 순수 함수, NAV Series → 지표 float
cumulative_return(nav: pd.Series) -> float
cagr(nav: pd.Series, periods_per_year=252) -> float
mdd(nav: pd.Series) -> float
drawdown_series(nav: pd.Series) -> pd.Series
annual_volatility(values, periods_per_year=252, input_type="nav") -> float
win_rate(values, input_type="nav") -> float
beta(portfolio_returns, benchmark_returns) -> float | None
alpha(portfolio_returns, benchmark_returns, risk_free_rate=0.0) -> float | None
sharpe_ratio(values, risk_free_rate=0.0, periods_per_year=252) -> float | None
calmar_ratio(nav, periods_per_year=252) -> float | None
summarize_performance(nav, benchmark_nav=None, risk_free_rate=0.0) -> MetricsSummary
```

### backtest.py

```python
load_prices(path) -> pd.DataFrame          # date, code, close
load_weights(path) -> pd.Series            # code → weight (정규화됨)
price_matrix(prices, codes=None) -> pd.DataFrame
run_backtest(prices, weights, initial_value=100_000_000, rebalance=None) -> pd.DataFrame
benchmark_nav(prices, benchmark_code, initial_value=100_000_000) -> pd.Series
summarize_backtest(backtest_result, benchmark=None, risk_free_rate=0.0) -> dict
export_backtest_summary(prices_path, portfolio_path, output_path, ...) -> pd.DataFrame
```

### portfolio.py

```python
load_trades(path) -> pd.DataFrame
current_holdings(trades) -> pd.DataFrame   # code, name, quantity, avg_price, cost_basis
latest_prices(prices, as_of=None) -> pd.DataFrame
evaluate_holdings(trades, prices, etf_master=None, as_of=None) -> pd.DataFrame
# → code, name, quantity, avg_price, cost_basis, current_price, market_value,
#   unrealized_pnl, unrealized_return, current_weight, [risk_type, asset_class]
```

### rules.py

```python
check_individual_etf_limit(portfolio, limit=0.20, weight_col=None) -> pd.DataFrame
check_risk_asset_limit(portfolio, limit=0.70, weight_col=None, risk_col="risk_type") -> dict
check_portfolio_rules(portfolio, individual_limit=0.20, risk_limit=0.70) -> dict
```

### turnover.py

```python
initial_turnover(trades, capital_base, start_date=None, end_date=None) -> dict
weekly_turnover(trades, capital_base) -> pd.DataFrame
monthly_turnover(trades, capital_base) -> pd.DataFrame
check_turnover_limits(trades, capital_base, initial_limit=0.80, period_limit=0.10, ...) -> dict
```

## 데이터 흐름

```
[사용자 입력]
  data/etf_master.csv     → update_prices.py → data/prices_daily.csv
  data/trades.csv         (수동 기록)
  portfolios/base.csv     (수동 설정)

[계산 레이어 — src/]
  prices_daily.csv + portfolios/*.csv → backtest.py → output/portfolio_summary.csv
  trades.csv + prices_daily.csv      → portfolio.py → output/current_holdings.csv
  current_holdings.csv               → rules.py     → output/rule_*.csv
  trades.csv                         → turnover.py  → output/turnover_*.csv
  backtest_result                    → charts.py    → output/charts/*.png

[출력 레이어]
  output/*.csv, output/charts/*.png → 웹 대시보드 (읽기 전용)
  output/                           → report_builder.py → output/monthly_report_YYYYMM.md
```

## 설계 패턴

- **계산 모듈은 순수 함수 기반**: 파일 I/O와 계산 로직을 분리. 계산 함수는 DataFrame을 받아 DataFrame/dict를 반환.
- **데이터 수집은 update_prices.py에만**: 네트워크 의존성을 한 곳에 격리.
- **웹은 output/ 읽기 전용**: CRITICAL-1 참고.
- **테스트는 sample 데이터로**: 실 데이터 없이도 tests/가 통과해야 함.
