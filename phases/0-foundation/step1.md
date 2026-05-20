# Step 1: smoke-tests

## 읽어야 할 파일

- `src/metrics.py` — MetricsSummary, 각 지표 함수
- `src/backtest.py` — load_prices, load_weights, run_backtest, summarize_backtest
- `src/portfolio.py` — load_trades, current_holdings, evaluate_holdings
- `src/rules.py` — check_individual_etf_limit, check_risk_asset_limit, check_portfolio_rules
- `src/turnover.py` — initial_turnover, weekly_turnover, monthly_turnover, check_turnover_limits
- `data/sample_prices_daily.csv` — 4개 ETF, 15거래일 샘플
- `data/sample_etf_master.csv`
- `data/trades.csv` — 초기 편입 4건 + 리밸런싱 2건
- `portfolios/base.csv` — 4개 ETF 비중
- `tests/conftest.py` — sample_prices, sample_etf_master, sample_trades, base_weights_path 픽스처

## 이전 step 산출물

- step 0: requirements.txt에 pytest 추가 완료

## 작업

다음 5개 테스트 파일을 작성한다. 각 파일은 해당 모듈의 핵심 함수를 smoke test한다.
실제 가격 데이터 없이 `sample_prices_daily.csv`로만 동작해야 한다.

### tests/test_metrics.py

```python
# 테스트할 함수: cagr, mdd, sharpe_ratio, calmar_ratio, summarize_performance
# 정상 NAV Series로 각 함수를 호출해 반환 타입과 범위를 검증
# summarize_performance가 MetricsSummary를 반환하고 .as_dict()가 dict를 반환하는지 확인
```

### tests/test_backtest.py

```python
# 테스트할 함수: load_prices, load_weights, run_backtest, summarize_backtest
# sample_prices_daily.csv + base.csv로 run_backtest 실행
# 결과 DataFrame에 date, portfolio_value, daily_return, cumulative_return, drawdown 컬럼 있는지 확인
# 첫날 portfolio_value가 initial_value와 같은지 확인
```

### tests/test_portfolio.py

```python
# 테스트할 함수: load_trades, current_holdings, evaluate_holdings
# trades.csv 로드 후 current_holdings 계산
# evaluate_holdings 결과에 market_value, current_weight 컬럼 있는지 확인
# current_weight 합계가 1.0에 가까운지 확인 (±0.01)
```

### tests/test_rules.py

```python
# 테스트할 함수: check_individual_etf_limit, check_risk_asset_limit, check_portfolio_rules
# evaluate_holdings 결과를 입력으로 사용
# check_individual_etf_limit 결과에 passed 컬럼 있는지 확인
# check_risk_asset_limit 결과에 passed 키 있는지 확인
```

### tests/test_turnover.py

```python
# 테스트할 함수: initial_turnover, weekly_turnover, monthly_turnover, check_turnover_limits
# trades.csv로 initial_turnover 계산 (capital_base=100_000_000)
# 결과 dict에 traded_value, turnover 키 있는지 확인
# check_turnover_limits 결과에 passed, initial, weekly, monthly 키 있는지 확인
```

## Acceptance Criteria

```bash
python -m pytest tests/ -v
```

모든 테스트가 PASSED여야 한다. FAILED나 ERROR가 없어야 한다.

## 금지사항

- `src/` 파일을 수정하지 마라. 이유: 테스트는 기존 코드를 검증하는 것이지 수정하는 것이 아니다.
- 실제 `prices_daily.csv`나 `etf_master.csv`를 테스트에서 사용하지 마라.
  이유: 실 데이터가 없는 환경에서도 테스트가 통과해야 한다.
- `pykrx`를 테스트 파일에서 import하지 마라.
