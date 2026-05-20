# Step 1: monthly-returns

## 읽어야 할 파일

- `src/charts.py` — step 0 산출물 (plot_cumulative_return, plot_drawdown)
- `src/backtest.py` — run_backtest 반환 컬럼: date, daily_return

## 이전 step 산출물

- step 0: src/charts.py 생성 완료 (plot_cumulative_return, plot_drawdown)

## 작업

`src/charts.py`에 `plot_monthly_returns` 함수를 추가한다.

### 함수 시그니처

```python
def plot_monthly_returns(
    backtest_result: pd.DataFrame,
    output_path: str | Path | None = None,
    title: str = "월별 수익률",
) -> plt.Figure:
    """
    backtest_result: run_backtest() 반환값 (date, daily_return 컬럼)
    월별 수익률을 계산해 히트맵으로 표시 (행: 연도, 열: 월)
    output_path: 지정 시 PNG로 저장
    """
    ...
```

### 구현 요구사항

- daily_return을 월 단위로 집계: `(1 + r).prod() - 1`
- 히트맵 형태로 표시 (행: 연도, 열: 1~12월)
- 양수는 초록, 음수는 빨간 색상
- 각 셀에 수익률 숫자 표시 (예: `+2.3%`)
- 데이터가 없는 셀은 비워두기

### tests/test_charts.py 업데이트

기존 test_charts.py에 `plot_monthly_returns` 테스트 추가:
- Figure 반환 확인
- output_path 지정 시 파일 생성 확인

## Acceptance Criteria

```bash
python -m pytest tests/test_charts.py -v
python -c "
from src.backtest import load_prices, load_weights, run_backtest
from src.charts import plot_monthly_returns
import pathlib
prices = load_prices('data/sample_prices_daily.csv')
weights = load_weights('portfolios/base.csv')
result = run_backtest(prices, weights)
plot_monthly_returns(result, output_path=pathlib.Path('output/charts/monthly_returns.png'))
print('monthly returns chart ok')
"
```

`output/charts/monthly_returns.png` 생성 확인.

## 금지사항

- `plt.show()`를 호출하지 마라.
- `plot_cumulative_return`, `plot_drawdown` 함수를 수정하지 마라.
  이유: 이미 완성된 함수에 의도치 않은 변경이 생기면 안 된다.
