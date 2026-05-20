# Step 0: report-builder

## 읽어야 할 파일

- `src/backtest.py` — summarize_backtest 반환 dict 키 확인
- `src/portfolio.py` — evaluate_holdings 반환 컬럼 확인
- `src/rules.py` — check_portfolio_rules 반환 구조 확인
- `src/turnover.py` — check_turnover_limits 반환 구조 확인
- `src/charts.py` — step-2 산출물, 그래프 함수
- `data/sample_prices_daily.csv`, `data/trades.csv`, `portfolios/base.csv` — 테스트용

## 이전 step 산출물

- phase-2 step 1: src/charts.py 완성 (plot_cumulative_return, plot_drawdown, plot_monthly_returns)

## 작업

`src/report_builder.py`를 새로 만든다.

### 함수 시그니처

```python
from pathlib import Path
import pandas as pd

def build_monthly_report(
    prices_path: str | Path,
    portfolio_path: str | Path,
    trades_path: str | Path,
    etf_master_path: str | Path,
    output_dir: str | Path,
    as_of: str | None = None,
    benchmark_code: str = "069500",
    capital_base: float = 100_000_000,
    risk_free_rate: float = 0.0,
) -> Path:
    """
    월간보고서 Markdown을 생성하고 경로를 반환한다.
    출력 파일명: output_dir/monthly_report_YYYYMM.md (as_of 기준)
    """
    ...
```

### 보고서 구조 (Markdown)

```markdown
# DBGAPS 월간보고서 — YYYY년 MM월

## 1. 포트폴리오 성과 요약
| 지표 | 값 |
| CAGR | X% |
| MDD | X% |
| 샤프지수 | X.XX |
...

## 2. 현재 포트폴리오 현황
| ETF | 비중 | 평가금액 | 미실현손익 |
...

## 3. 대회 규칙 체크
| 항목 | 결과 |
| 개별 ETF 20% 상한 | ✅/❌ |
| 위험자산 70% 상한 | ✅/❌ |
| 초기 회전율 80% | ✅/❌ |
...

## 4. 이번 달 매매 내역
(as_of 기준 당월 매매 요약)

## 5. 첨부 그래프
- 누적수익률: charts/cumulative_return.png
- MDD: charts/drawdown.png
- 월별수익률: charts/monthly_returns.png
```

### tests/test_report_builder.py

```python
# sample 데이터로 build_monthly_report 실행
# 반환된 Path가 존재하는지 확인
# Markdown 파일을 열어 핵심 섹션 제목이 포함됐는지 확인
```

## Acceptance Criteria

```bash
python -m pytest tests/test_report_builder.py -v
python -c "
from src.report_builder import build_monthly_report
import pathlib
p = build_monthly_report(
    prices_path='data/sample_prices_daily.csv',
    portfolio_path='portfolios/base.csv',
    trades_path='data/trades.csv',
    etf_master_path='data/sample_etf_master.csv',
    output_dir='output',
    as_of='2026-01-16',
)
print('report:', p)
assert p.exists()
print('ok')
"
```

`output/monthly_report_202601.md` 생성 확인.

## 금지사항

- 웹 렌더링(HTML/PDF 변환) 기능을 추가하지 마라. 이유: Markdown 출력이 1차 목표이다.
- `src/backtest.py`, `src/portfolio.py`, `src/rules.py`, `src/turnover.py`를 수정하지 마라.
- 보고서에 실제 계좌번호, 증권사 계정 등 민감 정보를 포함하지 마라.
