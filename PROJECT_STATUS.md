# PROJECT_STATUS — DBGAPS 포트폴리오 자동화 대시보드

최종 업데이트: 2026-05-22

---

## 배포 정보

- **GitHub**: https://github.com/TaeHee324/dbgaps_dashboard
- **Railway**: 배포 완료 (port 8080, Streamlit)
- **시작 명령**: `python src/run_sample_engine.py && streamlit run web/app.py --server.address=0.0.0.0 --server.port=$PORT`

---

## 완료된 것

### 계산 엔진 (`src/`)

| 파일 | 내용 |
|---|---|
| `metrics.py` | CAGR, MDD, Alpha, Beta, 연간변동성, 승률, 샤프, 칼마 |
| `backtest.py` | 포트폴리오 백테스트 (드리프트 / 주기 리밸런싱) |
| `portfolio.py` | 매매일지 기반 현재 보유 평가 (평가금액, 비중, 미실현손익) |
| `rules.py` | 대회 규칙 체크 (개별 ETF 20%, 위험자산 70%) |
| `turnover.py` | 회전율 (초기 80%, 주간/월간 10%) |
| `update_prices.py` | pykrx → prices_daily.csv 증분 업데이트 (수집 전용) |
| `run_sample_engine.py` | 샘플 데이터 기반 전체 엔진 실행 → output/ 생성 |

### 테스트 (`tests/`)

| 파일 | 내용 |
|---|---|
| `conftest.py` | 공통 픽스처 (sample_prices, sample_etf_master, sample_trades) |
| `test_smoke_engine.py` | backtest, portfolio, rules, turnover smoke test |
| `test_boundaries.py` | pykrx는 update_prices.py에만, web/은 src/ import 금지 |
| `test_output_schema.py` | output/ CSV 컬럼 계약 검증 |

현재 결과: **14 passed, 0 skipped**

### 웹 대시보드 (`web/`)

| 파일 | 내용 |
|---|---|
| `app.py` | Streamlit 진입점, 레이아웃 조립 |
| `data_loader.py` | output/ CSV 전담 읽기 (@st.cache_data ttl=300) |
| `components.py` | KPI strip, NAV 차트, Drawdown 차트, 규칙 badge, 보유현황 표 |

현재 화면: 상태바 → KPI 5개 → NAV/Drawdown 2열 차트 → 규칙 badge → 보유현황 표

### 설계 문서

| 파일 | 내용 |
|---|---|
| `CLAUDE.md` | 핵심 규칙 (src import 금지, 계산-수집 분리) |
| `DESIGN.md` | 디자인 시스템, 색상 토큰, 금지 패턴 |
| `docs/UI_GUIDE.md` | Streamlit MVP 화면 구성, 컴포넌트 규칙 |
| `docs/data_schema.md` | output/ CSV 스키마 정의 |

---

## 남은 것

### 1순위 — 실제 데이터 수집

현재 대시보드는 `data/sample_*.csv` 기반 2주치 데이터만 사용 중.
이 때문에 CAGR 190%, 샤프 24.8 같은 왜곡된 연율화 수치가 표시됨.

- [ ] `python src/update_prices.py` 실행해서 실제 KRX 가격 수집
- [ ] `data/prices_daily.csv`에 실제 데이터 채워넣기
- [ ] `run_sample_engine.py`를 실제 데이터 기반으로 교체하거나 별도 `run_engine.py` 작성

### 2순위 — 대시보드 보강

- [ ] **회전율 섹션** 추가: 초기/주간/월간 회전율 badge + 수치 표시 (데이터는 있으나 화면 없음)
- [ ] **월별 수익률 차트** 추가: bar 또는 heatmap (`sample_backtest.csv`의 daily_return → 월별 집계)
- [ ] **벤치마크 선** 추가: NAV 차트에 KODEX 200 비교선 (현재 포트폴리오 선만 있음, 벤치마크 데이터 없음)

### 3순위 — `src/charts.py` 구현

CLAUDE.md에 phase-2 예정으로 기재됨. 현재는 dashboard에서 Plotly로 직접 그림.

- [ ] `src/charts.py` 구현: 누적수익률, MDD, 월별수익률 그래프 생성
- [ ] output/charts/ 에 PNG 저장
- [ ] dashboard에서 PNG 재사용 또는 Plotly 유지 결정

### 4순위 — 월간보고서 (`src/report_builder.py`)

CLAUDE.md에 phase-3 예정으로 기재됨.

- [ ] `src/report_builder.py` 구현
- [ ] 성과/매매/리스크 요약 Markdown 자동 생성
- [ ] `output/report_YYYYMM.md` 출력
- [ ] 대시보드에 보고서 섹션 추가 (복사 가능한 요약 문장)

### 5순위 — 여러 포트폴리오 비교

- [ ] `portfolios/` 에 여러 비중 파일 추가
- [ ] 백테스트 결과를 나란히 비교하는 화면 구성

---

## 아키텍처 핵심 규칙 (변경 금지)

1. `web/`은 `src/`를 절대 import하지 않는다 — `output/`만 읽는다
2. `update_prices.py`에만 pykrx와 네트워크 요청이 있다
3. `output/`은 gitignore 대상 — Railway 시작 시 자동 생성
4. 계산 모듈은 pandas만으로 동작해야 한다

---

## 개발 명령어

```bash
# 실제 가격 데이터 수집 (pykrx, 네트워크 필요)
python src/update_prices.py

# 전체 엔진 실행 (output/ 생성)
python src/run_sample_engine.py

# 대시보드 로컬 실행
streamlit run web/app.py

# 전체 테스트
python -m pytest tests/ -q
```

---

## Reference-Gated Roadmap

The next plan should use GitHub references as phase-specific validation inputs, not as frameworks to copy wholesale.
Each phase has a narrow reference target, an explicit adoption scope, and a stop condition.

### Phase 1 - Real Data Reliability

Reference:
- https://github.com/sharebook-kr/pykrx

Use for:
- KRX ETF OHLCV collection.
- Benchmark price collection, especially `069500` KODEX 200.
- Incremental update behavior for `data/prices_daily.csv`.
- Handling missing symbols, market holidays, and failed fetches.

Do not use for:
- Dashboard rendering.
- Metrics logic.
- Portfolio or rule logic.

Stop condition:
- `python src/update_prices.py` can populate real `data/prices_daily.csv`.
- The engine can run on real price data instead of `data/sample_*.csv`.
- Benchmark data is available through the same data pipeline.

### Phase 2 - Output Contract Stabilization

Reference:
- Current `docs/data_schema.md`
- Current `tests/test_output_schema.py`
- Long-term architecture reference only: https://github.com/OpenBB-finance/OpenBB

Use for:
- Locking CSV output schemas before expanding dashboard/report features.
- Keeping provider, calculation, report, and dashboard responsibilities separate.
- Deciding whether `sample_backtest.csv` should become a production-neutral name such as `backtest_nav.csv`.

Do not use for:
- Introducing OpenBB as a dependency.
- Expanding the project into a large plugin/provider framework.

Stop condition:
- Output schema tests cover all dashboard-read files.
- The dashboard reads only `output/` files.
- Production and sample output filenames are clearly distinguished or intentionally unified.

### Phase 3 - Rebalancing and Turnover Semantics

Reference:
- https://github.com/pmorissette/bt

Use for:
- Target-weight rebalance lifecycle.
- Monthly rebalance flow similar to `RunMonthly -> WeighSpecified -> Rebalance`.
- Separating turnover definitions.

Definitions to lock:
- `actual_trade_turnover`: turnover from real `data/trades.csv`.
- `rebalance_turnover`: theoretical turnover from target-weight backtest rebalancing.
- `cumulative_turnover`: cumulative turnover over a selected period.
- `period_turnover`: weekly/monthly rule-check turnover.

Do not use for:
- Replacing the current pandas engine with `bt`.
- Adding a generic strategy framework before the ETF MVP is stable.

Stop condition:
- Turnover CSVs and dashboard labels make the turnover source unambiguous.
- Weekly/monthly turnover rule checks use the correct turnover definition.
- Transaction-cost hooks can be added without redefining the backtest output contract.

### Phase 4 - Performance Metrics and Monthly Returns

Reference:
- https://github.com/ranaroussi/quantstats

Use for:
- Metric edge cases for CAGR, Sharpe, Calmar, MDD, and drawdown.
- Monthly return table conventions.
- Benchmark-relative performance summaries.

Do not use for:
- Importing QuantStats as a required runtime dependency.
- Copying the full report/tearsheet framework.

Stop condition:
- Metrics are stable on real data, short histories, flat NAV, and missing benchmark periods.
- Monthly returns are exported for dashboard/report use.
- Benchmark-relative values are either valid numbers or clearly marked unavailable.

### Phase 5 - Dashboard and Chart Outputs

Reference:
- https://github.com/streamlit/streamlit
- https://github.com/plotly/plotly.py

Decision:
- Keep Streamlit + Plotly for interactive dashboard charts.
- Use `src/charts.py` for report/static PNG outputs only, unless a later ADR changes this.

Use for:
- Turnover section.
- Monthly return bar/heatmap.
- Benchmark comparison in NAV chart.
- Clear status badges and data-date display.

Do not use for:
- Running calculations inside `web/`.
- Importing `src/` from dashboard code.
- Fetching data from the dashboard process.

Stop condition:
- Dashboard shows data date, benchmark comparison, turnover, monthly returns, rules, and holdings from `output/` only.
- `tests/test_boundaries.py` continues to prevent `web/` from importing `src/`.

### Phase 6 - Markdown Monthly Report

Reference:
- https://github.com/pallets/jinja
- Later export reference only: https://github.com/jupyter/nbconvert

Use for:
- Generating `output/report_YYYYMM.md` from stable CSV outputs.
- Creating a copyable monthly summary for performance, benchmark, drawdown, turnover, rule checks, and holdings.

Do not use for:
- Premature PDF/HTML export.
- Notebook-based execution as the primary pipeline.

Stop condition:
- `src/report_builder.py` creates a deterministic Markdown report from `output/`.
- The dashboard can display or link the generated report section without recalculating anything.

### Phase 7 - Multi-Portfolio Comparison

Reference:
- https://github.com/topics/portfolio-analysis

Use for:
- Comparing multiple `portfolios/*.csv` files.
- Designing comparison tables for CAGR, MDD, Sharpe, Calmar, benchmark excess return, and turnover.
- Designing NAV comparison views.

Do not use for:
- Efficient frontier or optimization features in the MVP.
- User-editable portfolio management in the dashboard.

Stop condition:
- Multiple portfolio files can be run through the same engine.
- Comparison outputs are written to `output/`.
- Dashboard comparison views remain read-only.

Recommended execution order:

```text
Phase 1: PyKRX real data + benchmark collection
Phase 2: output CSV contract stabilization
Phase 3: bt-inspired rebalancing/turnover semantics
Phase 4: QuantStats-inspired metric edge cases + monthly returns
Phase 5: Streamlit/Plotly dashboard expansion
Phase 6: Jinja2 Markdown monthly report
Phase 7: Multi-portfolio comparison
```
