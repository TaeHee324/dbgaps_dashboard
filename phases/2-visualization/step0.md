# Step 0: cumulative-and-drawdown

## 읽어야 할 파일

- `src/backtest.py` — run_backtest 반환 컬럼: date, portfolio_value, daily_return, cumulative_return, drawdown
- `src/metrics.py` — drawdown_series
- `data/sample_prices_daily.csv` — 테스트용
- `portfolios/base.csv` — 테스트용

## 작업

`src/charts.py`를 새로 만든다. 다음 두 함수를 구현한다.

### 함수 시그니처

```python
import matplotlib.pyplot as plt
import pandas as pd
from pathlib import Path

def plot_cumulative_return(
    backtest_result: pd.DataFrame,
    benchmark: pd.Series | None = None,
    output_path: str | Path | None = None,
    title: str = "누적 수익률",
) -> plt.Figure:
    """
    backtest_result: run_backtest() 반환값 (date, portfolio_value, cumulative_return 컬럼)
    benchmark: benchmark_nav() 반환값 (pd.Series, index=date, values=nav)
    output_path: 지정 시 PNG로 저장
    """
    ...

def plot_drawdown(
    backtest_result: pd.DataFrame,
    output_path: str | Path | None = None,
    title: str = "Drawdown",
) -> plt.Figure:
    """
    backtest_result: run_backtest() 반환값 (date, drawdown 컬럼)
    output_path: 지정 시 PNG로 저장
    """
    ...
```

### 구현 요구사항

- x축: 날짜, y축: 비율 (%)
- 누적수익률 그래프에서 benchmark가 있으면 같은 axes에 점선으로 표시
- drawdown 그래프는 음수 영역을 빨간색으로 채움 (fill_between)
- output_path가 지정되면 `output_path.parent.mkdir(parents=True, exist_ok=True)` 후 저장
- Figure를 반환해야 함 (plt.show() 호출 금지)

### tests/test_charts.py

```python
# plot_cumulative_return, plot_drawdown 각각 호출해서 Figure 반환 확인
# output_path 지정 시 파일 생성 확인
# sample_prices_daily.csv + base.csv로 run_backtest 실행 후 charts 함수에 전달
```

## Acceptance Criteria

```bash
python -m pytest tests/test_charts.py -v
python -c "
from src.backtest import load_prices, load_weights, run_backtest
from src.charts import plot_cumulative_return, plot_drawdown
import pathlib
prices = load_prices('data/sample_prices_daily.csv')
weights = load_weights('portfolios/base.csv')
result = run_backtest(prices, weights)
plot_cumulative_return(result, output_path=pathlib.Path('output/charts/cumulative_return.png'))
plot_drawdown(result, output_path=pathlib.Path('output/charts/drawdown.png'))
print('charts ok')
"
```

`output/charts/cumulative_return.png`, `output/charts/drawdown.png` 생성 확인.

## 금지사항

- `plt.show()`를 호출하지 마라. 이유: 서버 환경에서 GUI 창이 열리면 실행이 중단된다.
- plotly, seaborn 등 다른 라이브러리를 사용하지 마라.
  이유: ADR-005 — phase-2는 matplotlib 정적 PNG로 구현한다.
- `src/backtest.py`, `src/metrics.py`를 수정하지 마라.
