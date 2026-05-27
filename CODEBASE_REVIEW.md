# DBGAPS Dashboard — 코드베이스 전체 구조 리뷰

> Streamlit → FastAPI + Next.js 마이그레이션 이후 작성. 2026-05-27 기준.

---

## 전체 아키텍처 요약

```
pykrx → src/update_prices.py → data/prices_daily.csv
                                         ↓
portfolios/*.csv → db.py(PostgreSQL) → src/ 계산 엔진 → output/
                                                               ↓
                                               api/ FastAPI (읽기 전용 + DB 직접 접근)
                                                               ↓
                                               frontend/ Next.js (표시)
```

마이그레이션 결과: Streamlit 단일 프로세스 → Python 계산 엔진 + FastAPI 서버 + Next.js 클라이언트로 명확하게 3-tier 분리됨.

---

## 루트 레벨 파일

| 파일 | 역할 | 비고 |
|------|------|------|
| `db.py` | PostgreSQL 공유 모듈. `api/`와 `src/` 양쪽에서 `import db`로 임포트 | 루트 고정 필수 |
| `railway.toml` | 백엔드 Railway 배포 설정 | 루트 고정 필수 |
| `requirements.txt` | pandas, pykrx, psycopg2-binary, fastapi, uvicorn 등 | 루트 고정 필수 |
| `.env` / `.env.example` | `DATABASE_URL` 환경변수 설정. 외부 TCP proxy URL 사용 | 루트 고정 필수 |
| `CLAUDE.md` | Claude Code 프로젝트 지침 | 루트 고정 필수 |
| `AGENTS.md` | Claude Code 에이전트 지침 (frontend/CLAUDE.md에서 import) | 루트 고정 (CLAUDE.md와 동급) |

---

## `db.py` 세부 명세

**역할:** PostgreSQL 포트폴리오 + 매매일지 테이블의 단일 진입점.

| 함수 | 입/출력 | 주의사항 |
|------|---------|---------|
| `get_connection()` | psycopg2 연결 반환. `DATABASE_URL` 없으면 RuntimeError | `postgres://` → `postgresql://` 자동 변환 포함 |
| `init_db()` | `portfolios` 테이블 생성 + `base/aggressive/conservative` CSV 시딩 | `ON CONFLICT DO NOTHING`으로 중복 시딩 방지 |
| `init_trade_log_table()` | `trade_log` 테이블 생성 | `api/routers/trades.py` 및 `api/routers/dashboard.py` 시작 시 호출 |
| `list_portfolios()` | `[{name, is_protected}]` — protected 먼저 정렬 | |
| `get_portfolio(name)` | `[{code, weight}]` 또는 `None` | holdings는 JSONB로 저장 |
| `upsert_portfolio(name, holdings)` | INSERT OR UPDATE. `is_protected=FALSE` 고정 | protected 포트폴리오의 holdings도 덮어씀 — 주의 |
| `delete_portfolio(name)` | is_protected=TRUE면 `ValueError` | |

---

## `api/` — FastAPI 백엔드

### `api/main.py`

앱 초기화 전담. **라우터 4개** 등록 (`dashboard`, `portfolios`, `trades`, `risk`), CORS 미들웨어 설정.
`ALLOWED_ORIGINS` 환경변수로 허용 origin 제어 (기본값: `http://localhost:3000`).

### `api/schemas.py`

Pydantic 모델 집합. API 응답 계약 정의.

| 모델 | 대응 엔드포인트 | 필드 수 |
|------|---------------|---------|
| `PortfolioSummary` | `/api/portfolio-summary` | 15개 (CAGR, MDD, Sharpe, Sortino, information_ratio, mdd_duration, win_rate_monthly, var_95, tail_ratio 포함) |
| `Holding` | `/api/holdings` | 13개 (code, name, 수량, 평단가, PnL 등) |
| `NavPoint` | `/api/backtest-nav`, `/api/actual-nav` | 5개 (date, value, return, drawdown) + `cash: float \| None` |
| `MonthlyReturn` | `/api/monthly-returns` | 3개 |
| `ComparisonSummaryItem` | `/api/comparison/summary` | 8개 (CAGR, MDD, Sharpe, Calmar, Sortino, annual_volatility, win_rate 포함) |
| `ComparisonNavPoint` | `/api/comparison/nav` | 3–4개 (drawdown optional) |
| `IndividualRule` / `RiskAssetRule` / `RulesResponse` | `/api/rules`, `/api/live-rules` | 규칙 pass/fail 정보 |
| `TurnoverBase` / `TurnoverWithDate` / `TurnoverResponse` | `/api/turnover` | 초기/주간/월간 |
| `BacktestRequest` / `BacktestResponse` | `POST /api/backtest` | 온디맨드 백테스트 요청/응답 |
| `TradeLogEntry` / `AddTradeRequest` / `UpdateTradeRequest` / `AddTradeResponse` | `/api/trade-log` | 매매일지 CRUD |
| `Portfolio` / `PortfolioHolding` / `PortfolioUpsertRequest` | `/api/portfolios` | CRUD |
| `LiveHolding` | `/api/live-holdings` | 13개 (trade_log DB 기반 실시간 보유종목) |
| `ReportListItem` | `/api/reports` | 3개 (filename, title, period) |
| `DataHealth` | (RiskPortfolioResponse 내부) | 데이터 최신성 상태 |
| `RiskPortfolioResponse` | `/api/risk/portfolio` | HHI + DataHealth |
| `EtfRiskItem` | `/api/risk/etf-analysis` | ETF별 위험 분석 결과 |

---

### `api/routers/dashboard.py`

**역할:** `output/` CSV 읽기 + trade_log DB 기반 라우터. `src/` import 없음. **엔드포인트 21개**.

**내부 유틸리티 함수:**

| 함수 | 역할 |
|------|------|
| `_read_csv(path)` | 파일 없거나 오류시 빈 DataFrame 반환 (안전 처리) |
| `_normalize_code(value)` | ETF 코드 6자리 zero-padding (`69500` → `069500`) |
| `_clean_scalar(value)` | NaN → 0.0 or "" 변환, numpy scalar → Python 기본형 변환 |
| `_format_date(value)` | pandas Timestamp → `YYYY-MM-DD` 문자열 |
| `_clean_bool(value)` | CSV의 `"True"/"False"` 문자열 → Python bool |
| `_records(df, columns, date_columns)` | DataFrame → `list[dict]` 변환 (위 유틸 적용) |
| `_calc_live_holdings()` | trade_log DB FIFO 보유 계산 (src/ 없이 인라인) |

**엔드포인트 목록:**

| 경로 | 읽는 파일/소스 | 반환 타입 |
|------|----------|----------|
| `GET /api/portfolio-summary` | `output/portfolio_summary.csv` | `PortfolioSummary \| None` |
| `GET /api/holdings` | `output/current_holdings.csv` | `list[Holding]` (레거시) |
| `GET /api/backtest-nav` | `output/backtest_nav.csv` | `list[NavPoint]` |
| `GET /api/monthly-returns` | `output/monthly_returns.csv` | `list[MonthlyReturn]` |
| `GET /api/comparison/summary` | `output/comparison/summary.csv` | `list[ComparisonSummaryItem]` |
| `GET /api/comparison/nav` | `output/comparison/*_nav.csv` (glob) | `dict[str, list[ComparisonNavPoint]]` |
| `GET /api/rules` | `output/rule_individual_etf.csv` + `rule_risk_asset.csv` | `RulesResponse \| None` (레거시) |
| `GET /api/turnover` | `output/turnover_initial/weekly/monthly.csv` | `TurnoverResponse \| None` |
| `GET /api/data-date` | `output/*.csv` 파일 mtime 최신값 | `DataDateResponse` |
| `GET /api/report` | `output/report_*.md` 최신 파일 | `ReportResponse \| None` |
| `GET /api/actual-nav` | trade_log DB + prices_daily.csv | `list[ActualNavPoint]` (cash 포함) |
| `GET /api/live-holdings` | trade_log DB FIFO 계산 | `list[LiveHolding]` |
| `GET /api/live-rules` | live-holdings 기반 직접 규칙 체크 (src/ 없음) | `RulesResponse \| None` |
| `GET /api/portfolio-etfs` | live-holdings fallback | `list[{code, name}]` |
| `GET /api/reports` | `output/report_*.md` glob 목록 | `list[ReportListItem]` |
| `GET /api/report/{filename}` | `output/report_{filename}.md` | `ReportResponse \| None` |
| `GET /api/report-image/{filename}` | `output/{filename}` 이미지 파일 | `FileResponse` |
| `POST /api/refresh-prices` | `update_prices.py` + `run_engine.py` 백그라운드 실행 | `{status}` |
| `GET /api/refresh-status` | 갱신 상태 조회 | `{status, last_updated}` |
| `GET /api/update-log` | `data/CHANGELOG.json` | `list[dict]` |
| `GET /api/etf-list` | `data/prices_daily.csv` + `data/etf_master.csv` | `list[EtfItem]` |

> **레거시 주의**: `/api/holdings` → `useLiveHoldings()` 사용 권장. `/api/rules` → `useLiveRules()` 사용 권장.

---

### `api/routers/portfolios.py`

**역할:** PostgreSQL CRUD + 온디맨드 백테스트. **유일하게 `src/` import가 허용된 라우터.**

| 엔드포인트 | 역할 |
|-----------|------|
| `GET /api/portfolios` | DB에서 포트폴리오 목록 반환 |
| `GET /api/portfolios/{name}` | 특정 포트폴리오 holdings 반환 |
| `POST /api/portfolios` | 포트폴리오 생성/업데이트 (upsert) |
| `DELETE /api/portfolios/{name}` | 포트폴리오 삭제 (protected 거부) |
| `POST /api/backtest` | `holdings` 받아 즉시 백테스트 실행 후 결과 반환 |

`POST /api/backtest` 내부 흐름:
1. `src/backtest` 동적 import (`sys.path.insert`)
2. `prices_daily.csv` 로드 → 날짜 범위 필터
3. weights 정규화 (합계 1.0)
4. `run_backtest()` → `summarize_backtest()` → `monthly_returns()`
5. `_rules_for_holdings()` 호출 → `src/rules` 동적 import로 규칙 검증
6. 4개 섹션 (nav, summary, monthly, rules) 반환

---

### `api/routers/trades.py`

**역할:** PostgreSQL `trade_log` 테이블 CRUD. **엔드포인트 4개.**

| 엔드포인트 | 역할 |
|-----------|------|
| `GET /api/trade-log` | trade_log 테이블 전체 반환 |
| `POST /api/trade-log` | 새 항목 추가 |
| `PUT /api/trade-log/{id}` | 기존 항목 수정 |
| `DELETE /api/trade-log/{id}` | 항목 삭제 |

`db.init_trade_log_table()` 사용. `data/trade_log.json`은 더 이상 사용하지 않음.

---

### `api/routers/risk.py`

**역할:** 리스크 분석 전용 라우터. `src/` import 없음. FIFO 인라인, DB+CSV 직접 읽기.

| 엔드포인트 | 역할 |
|-----------|------|
| `GET /api/risk/portfolio` | HHI 분산도 + 데이터 헬스 상태 |
| `GET /api/risk/etf-analysis` | ETF별 MDD/변동성/위험기여도 |

내부 구현: trade_log DB에서 FIFO 보유 현황 계산, prices_daily.csv에서 최신 종가·이력 조회, numpy로 공분산 기반 위험기여도 계산.

---

## `src/` — 계산 엔진

### `src/metrics.py`

순수 함수 모음. pandas Series 입력 → float/None 반환. 외부 의존 없음.

| 함수 | 계산 내용 |
|------|---------|
| `cumulative_return(nav)` | (최종값/초기값) - 1 |
| `cagr(nav)` | 연환산 수익률. `(최종/초기)^(1/years) - 1` |
| `mdd(nav)` | 최대낙폭. `min(nav / cummax - 1)` |
| `drawdown_series(nav)` | 일별 낙폭 시계열 |
| `annual_volatility(values)` | 일수익률 stddev × √252 |
| `win_rate(values)` | 수익이 양인 날의 비율 |
| `beta(portfolio_returns, benchmark_returns)` | cov(p, b) / var(b) |
| `alpha(portfolio_returns, benchmark_returns)` | 연환산 젠센 알파 |
| `sharpe_ratio(values)` | (초과수익률 평균 / stddev) × √252 |
| `calmar_ratio(cagr, mdd)` | CAGR / abs(MDD) |
| `sortino_ratio(returns)` | 하방편차 기준 Sharpe |
| `mdd_duration(nav)` | 피크 → 회복 일수 |
| `monthly_returns(backtest_result)` | 일 수익률 → 월별 복리 수익률 집계 |
| `summarize_performance(nav, benchmark_nav)` | `MetricsSummary` dataclass 반환 |

---

### `src/backtest.py`

| 함수 | 역할 |
|------|------|
| `load_prices(path)` | CSV 로드 → date/code/close 컬럼 검증 + 타입 변환 |
| `load_weights(path)` | 포트폴리오 CSV 로드 → 정규화된 `pd.Series` |
| `price_matrix(prices, codes)` | long 형식 → wide pivot (date × code) |
| `run_backtest(prices, weights, initial_value, rebalance)` | 백테스트 실행. `rebalance=None`이면 드리프트 방치, `"W"/"M"`이면 주기 리밸런싱 |
| `benchmark_nav(prices, code)` | 벤치마크(069500) NAV 시계열 |
| `summarize_backtest(result, benchmark)` | `summarize_performance()` 래퍼 → dict |
| `export_backtest_summary(...)` | 파일 경로 받아 전체 파이프라인 실행 후 CSV 저장 |

---

### `src/run_engine.py`

프로덕션 엔진 진입점. 아래 순서로 실행:

```
1. data/prices_daily.csv 로드
2. DB에서 포트폴리오 목록 조회 (discover_portfolios)
3. base 포트폴리오로 백테스트 실행
4. output/backtest_nav.csv, monthly_returns.csv, portfolio_summary.csv 저장
5. trades.csv + prices로 현재 보유 평가 → current_holdings.csv
6. 규칙 검증 → rule_individual_etf.csv, rule_risk_asset.csv
7. 회전율 검증 → turnover_*.csv
8. 모든 포트폴리오 비교 백테스트 → output/comparison/
9. 리포트 생성 → output/report_YYYYMM.md
```

---

### 기타 `src/` 파일

| 파일 | 역할 요약 |
|------|---------|
| `portfolio.py` | `load_trades(path)` + `evaluate_holdings(trades, prices, master)` — 거래 내역 기반 현재 보유량/평단가/미실현손익 계산 |
| `rules.py` | `check_individual_etf_limit(portfolio, 0.20)` + `check_risk_asset_limit(portfolio, 0.70)` — 비중 규칙 검증 |
| `turnover.py` | 초기/주간/월간 회전율 계산. `check_turnover_limits()` 반환값: `{initial, weekly, monthly}`. passed 기준: `turnover >= limit` (하한) |
| `update_prices.py` | pykrx로 ETF 가격 수집 → `data/prices_daily.csv` 갱신. **네트워크 접근 유일한 파일** |
| `run_sample_engine.py` | 샘플 데이터로 엔진 실행 (개발/테스트용). Railway startCommand에 포함 금지 (SYNC-3) |
| `report_builder.py` | Markdown 월간 리포트 생성 → `output/report_YYYYMM.md` |

---

## `frontend/` — Next.js 프론트엔드

### `frontend/lib/api.ts`

`get<T>`, `post<T>`, `del` 3개 함수. `NEXT_PUBLIC_API_URL` 환경변수 기반 (기본 `http://localhost:8000`). 에러 시 `Error` throw.
`fetch()` 직접 사용 금지 — 이 래퍼를 통해야 함.

### `frontend/lib/utils/metrics.ts`

프론트엔드 KPI 계산 유틸. 순수 함수.

| 함수 | 역할 |
|------|------|
| `computeActualOpsMetrics(points: ActualNavPoint[])` | 실제 운용 KPI: 누적수익률·MDD·일간승률·연간변동성·MDD기간 |
| `computeStrategyMetrics(points: NavPoint[])` | 전략 특성 KPI: CAGR·샤프·칼마·소르티노·월별승률·VaR95% (구간 필터 후 portfolio_value로 직접 재계산. 사전 계산된 drawdown 컬럼 사용 금지) |

### `frontend/lib/hooks/`

| 파일 | 포함 훅 |
|------|---------|
| `dashboard.ts` | `usePortfolioSummary`, `useBacktestNav`, `useMonthlyReturns`, `useCurrentHoldings`(레거시), `useTurnover`, `useRules`(레거시), `useDataDate`, `useReport`, `useReports`, `useReportDetail`, `useComparisonSummary`, `useComparisonNav`, `useTradeLog`, `usePortfolioDetail`, `useLiveHoldings`, `useActualNav`, `useLiveRules`, `usePortfolioEtfs`, `useRiskPortfolio`, `useEtfRiskAnalysis` (**20개**) |
| `portfolio.ts` | `usePortfolios`, `useRunBacktest` |
| `trades.ts` | `useAddTrade` |

> **레거시 훅 사용 금지**: `useCurrentHoldings()` → `useLiveHoldings()` 사용. `useRules()` → `useLiveRules()` 사용.

모든 훅은 TanStack Query v5 기반. `queryKey` 배열로 캐시 키 관리.

---

### `frontend/app/` — 페이지 라우트 (11개)

| 경로 | 상태 | 주요 기능 |
|------|------|---------|
| `/` | 구현됨 | 운용현황 대시보드 (메인). `ActualOpsKpiStrip` + `StrategyKpiStrip`, NAV 차트, 보유종목, 규칙·회전율 |
| `/operations` | redirect | `redirect("/")` 래퍼. 직접 수정 금지 |
| `/risk` | 구현됨 | 리스크 관리. HHI 분산도, 데이터헬스, ETF별 MDD/변동성/위험기여도 |
| `/portfolio` | 구현됨 | ETF 포트폴리오 관리. ETF 구성, 백테스트, CRUD |
| `/comparison` | 구현됨 | 다중 포트폴리오 비교. 기간 필터, NAV 차트, 지표 테이블 |
| `/trades` | 구현됨 | 매매 거래내역. 입력·수정·삭제·이력 조회 |
| `/report` | 구현됨 | Markdown 월별 리포트 뷰어 |
| `/changelog` | 구현됨 | 변경이력 (`data/CHANGELOG.json`) |
| `/market` | 준비중 | 플레이스홀더 |
| `/rules` | 준비중 | 플레이스홀더 |
| `/research` | 준비중 | 플레이스홀더 |

---

### `frontend/components/`

**charts/**

| 컴포넌트 | 입력 props | 역할 |
|---------|-----------|------|
| `NavChart.tsx` | `NavPoint[]` | TradingView Lightweight Charts v5로 NAV 시계열 라인 차트 |
| `ComparisonChart.tsx` | `Record<string, ComparisonNavPoint[]>` | 다중 포트폴리오 누적수익률 비교 |
| `DrawdownChart.tsx` | `NavPoint[]` | 낙폭 히스토그램 |
| `MonthlyBarChart.tsx` | `MonthlyReturn[]` | 월별 수익률 막대 차트 |
| `PieChart.tsx` | — | 파이 차트 |

**ui/**

| 컴포넌트 | 역할 |
|---------|------|
| `ActualOpsKpiStrip.tsx` | 실제 운용 KPI: 누적수익률·MDD·일간승률·변동성·MDD기간 (`computeActualOpsMetrics` 소비) |
| `StrategyKpiStrip.tsx` | 전략 특성 KPI: CAGR·샤프·칼마·소르티노·월별승률·VaR95% (`computeStrategyMetrics` 소비) |
| `HoldingsCompositionPanel.tsx` | 보유종목 구성 패널 |
| `LivePortfolioSpec.tsx` | 실시간 포트폴리오 스펙 표시 |
| `MonthlyHeatmap.tsx` | 월별 수익률 히트맵 |
| `DailyHeatmap.tsx` | 일별 히트맵 |
| `HoldingsTable.tsx` | 보유 ETF 테이블 (code, name, 수량, 평단가, 평가손익) |
| `RuleBadge.tsx` | PASS/FAIL 배지 |
| `TurnoverRow.tsx` | 회전율 진행 바 + 최소 기준 표시 |
| `KpiStrip.tsx` | 레거시 — 운용현황 페이지에서 ActualOpsKpiStrip + StrategyKpiStrip으로 교체됨 |
| `StatusBar.tsx` | 데이터 최신화 시각 표시 |

---

## `data/` — 입력 데이터

| 파일 | 형식 | 역할 |
|------|------|------|
| `prices_daily.csv` | `date, code, close` | ETF 일별 종가. `update_prices.py`가 생성 |
| `etf_master.csv` | `code, name, risk_type, asset_class, ...` | ETF 메타데이터 |
| `trades.csv` | `date, code, action, quantity, price, amount` | 매매 내역. `portfolio.py`와 `run_engine.py`가 읽음 |
| `CHANGELOG.json` | JSON 배열 | git 히스토리 기반 변경이력. `GET /api/update-log`가 반환. `update_changelog.py`가 자동 생성 |
| `sample_*.csv` | 위와 동일 구조 | 개발/테스트용 샘플 |

---

## `output/` — 생성 산출물 (수동 편집 금지)

| 파일 | 생성처 | 소비처 |
|------|--------|--------|
| `backtest_nav.csv` | `run_engine.py` | `GET /api/backtest-nav` |
| `portfolio_summary.csv` | `run_engine.py` | `GET /api/portfolio-summary` |
| `current_holdings.csv` | `run_engine.py` | `GET /api/holdings` (레거시) |
| `monthly_returns.csv` | `run_engine.py` | `GET /api/monthly-returns` |
| `rule_individual_etf.csv` | `run_engine.py` | `GET /api/rules` (레거시) |
| `rule_risk_asset.csv` | `run_engine.py` | `GET /api/rules` (레거시) |
| `turnover_initial/weekly/monthly.csv` | `run_engine.py` | `GET /api/turnover` |
| `comparison/*_nav.csv` | `run_engine.py` + `portfolios.py` POST 핸들러 | `GET /api/comparison/nav` |
| `comparison/summary.csv` | `run_engine.py` + `portfolios.py` POST 핸들러 | `GET /api/comparison/summary` |
| `report_YYYYMM.md` | `report_builder.py` | `GET /api/report`, `GET /api/reports`, `GET /api/report/{filename}` |

---

## `portfolios/` — 포트폴리오 시드 파일

| 파일 | 역할 |
|------|------|
| `base.csv` | 기본 포트폴리오. `init_db()`에서 PostgreSQL에 시딩 |
| `aggressive.csv` | 공격형 포트폴리오 |
| `conservative.csv` | 보수형 포트폴리오 |

형식: `code, weight` 2컬럼 CSV. `is_protected=TRUE`로 삽입되어 삭제 불가.

---

## `tests/`

| 파일 | 테스트 대상 |
|------|-----------|
| `test_boundaries.py` | CRITICAL-1/2 위반 검사. `api/` 파일이 `src/` import하지 않는지, `pykrx` 없는지 AST 정적 분석 |
| `test_metrics.py` | `src/metrics.py` 순수 함수 단위 테스트 |
| `test_output_schema.py` | `output/*.csv` 컬럼 스키마 검증. `web/data_loader.py` 참조 테스트는 `@pytest.mark.skip` 처리됨 (무해) |
| `test_smoke_engine.py` | 샘플 데이터로 전체 엔진 실행 스모크 테스트 |
| `conftest.py` | pytest fixture 설정 (`sample_trades`, `sample_prices`, `base_weights_path` 등) |

---

## `docs/`

| 파일 | 역할 |
|------|------|
| `ARCHITECTURE.md` | 전체 아키텍처 문서 (디렉토리 구조, 모듈 인터페이스, 데이터 흐름) |
| `ADR.md` | 아키텍처 결정 레코드 |
| `PRD.md` | 제품 요구사항 문서 (역사적 참고용, 1~3차 완료) |
| `data_schema.md` | output/ CSV + 입력 파일 스키마 정의 |
| `DESIGN.md` | 제품 성격 및 시각 방향 정의 |
| `DESIGN-LANGUAGE.md` | 디자인 판단 규칙 및 안티패턴 |
| `design-tokens.json` | 색상/타이포 등 머신 가독 토큰 |
| `QA_CHECKLIST.md` | UI 최종 검토 체크리스트 |
| `PROJECT_STATUS.md` | 현재 배포 상태 요약 |

---

## 잠재적 이슈 / 검토 포인트

### 1. `db.py` 주석 잔재 (낮음)

`db.py` docstring에 `"Used by both web/ (Streamlit dashboard) and src/"` 라고 되어 있음.
현재 `web/`은 존재하지 않고 `api/`가 그 역할을 함. 주석만 업데이트하면 됨.

### 2. `run_engine.py` 하드코딩 날짜 (중간)

```python
check_turnover_limits(trades, capital_base=INITIAL_VALUE, initial_end_date="2026-01-02")
```

회전율 초기 구간 끝날짜가 소스코드에 박혀 있음. 운영 시 매년 변경 필요.

### 3. `upsert_portfolio`의 protected 덮어쓰기 가능성 (중간)

`db.upsert_portfolio()`는 `is_protected` 플래그는 유지하지만 `holdings`는 변경함.
`POST /api/portfolios`로 `base/aggressive/conservative`의 구성 비중을 API로 변경할 수 있음.

### 4. `/market`, `/rules`, `/research` 페이지 미완성 (낮음)

세 페이지 모두 플레이스홀더 상태. 기능 미구현.

### 5. `portfolio/page.tsx` 크기 (낮음)

다른 페이지 대비 크기가 큼. 컴포넌트 분리 검토 가능.

### 6. `test_output_schema.py` 레거시 참조 (낮음)

`DATA_LOADER = ROOT / "web" / "data_loader.py"` 변수 및 스킵된 테스트 함수가 남아 있음.
`@pytest.mark.skip`으로 처리되어 무해하나 기술 부채로 정리하면 좋음.
