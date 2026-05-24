# DBGAPS Dashboard — 코드베이스 전체 구조 리뷰

> Streamlit → FastAPI + Next.js 마이그레이션 이후 작성. 2026-05-25 기준.

---

## 전체 아키텍처 요약

```
pykrx → src/update_prices.py → data/prices_daily.csv
                                         ↓
portfolios/*.csv → db.py(PostgreSQL) → src/ 계산 엔진 → output/
                                                               ↓
                                               api/ FastAPI (읽기 전용)
                                                               ↓
                                               frontend/ Next.js (표시)
```

마이그레이션 결과: Streamlit 단일 프로세스 → Python 계산 엔진 + FastAPI 서버 + Next.js 클라이언트로 명확하게 3-tier 분리됨.

---

## 루트 레벨 파일

| 파일 | 역할 | 비고 |
|------|------|------|
| `db.py` | PostgreSQL 공유 모듈. `api/`와 `src/` 양쪽에서 `import db`로 임포트 | 루트 고정 필수 |
| `railway.toml` | Railway 배포 설정 (백엔드/프론트엔드 2 서비스) | 루트 고정 필수 |
| `requirements.txt` | pandas, pykrx, psycopg2-binary, fastapi, uvicorn 등 | 루트 고정 필수 |
| `.env` / `.env.example` | `DATABASE_URL` 환경변수 설정. 외부 TCP proxy URL 사용 | 루트 고정 필수 |
| `CLAUDE.md` | Claude Code 프로젝트 지침 | 루트 고정 필수 |
| `AGENTS.md` | Claude Code 에이전트 지침 (frontend/CLAUDE.md에서 import) | 루트 고정 (CLAUDE.md와 동급) |

---

## `db.py` 세부 명세

**역할:** PostgreSQL 포트폴리오 테이블의 단일 진입점.

| 함수 | 입/출력 | 주의사항 |
|------|---------|---------|
| `get_connection()` | psycopg2 연결 반환. `DATABASE_URL` 없으면 RuntimeError | `postgres://` → `postgresql://` 자동 변환 포함 |
| `init_db()` | `portfolios` 테이블 생성 + `base/aggressive/conservative` CSV 시딩 | `ON CONFLICT DO NOTHING`으로 중복 시딩 방지 |
| `list_portfolios()` | `[{name, is_protected}]` — protected 먼저 정렬 | |
| `get_portfolio(name)` | `[{code, weight}]` 또는 `None` | holdings는 JSONB로 저장 |
| `upsert_portfolio(name, holdings)` | INSERT OR UPDATE. `is_protected=FALSE` 고정 | protected 포트폴리오의 holdings도 덮어씀 — 주의 |
| `delete_portfolio(name)` | is_protected=TRUE면 `ValueError` | |

---

## `api/` — FastAPI 백엔드

### `api/main.py`

앱 초기화 전담. 라우터 3개 등록, CORS 미들웨어 설정.
`ALLOWED_ORIGINS` 환경변수로 허용 origin 제어 (기본값: `http://localhost:3000`).

### `api/schemas.py`

Pydantic 모델 집합. API 응답 계약 정의.

| 모델 | 대응 엔드포인트 | 필드 수 |
|------|---------------|---------|
| `PortfolioSummary` | `/api/portfolio-summary` | 9개 (CAGR, MDD, Sharpe 등) |
| `Holding` | `/api/holdings` | 13개 (code, name, 수량, 평단가, PnL 등) |
| `NavPoint` | `/api/backtest-nav` | 5개 (date, value, return, drawdown) |
| `MonthlyReturn` | `/api/monthly-returns` | 3개 |
| `ComparisonSummaryItem` | `/api/comparison/summary` | 5개 |
| `ComparisonNavPoint` | `/api/comparison/nav` | 3개 |
| `IndividualRule` / `RiskAssetRule` / `RulesResponse` | `/api/rules` | 규칙 pass/fail 정보 |
| `TurnoverBase` / `TurnoverWithDate` / `TurnoverResponse` | `/api/turnover` | 초기/주간/월간 |
| `BacktestRequest` / `BacktestResponse` | `POST /api/backtest` | 온디맨드 백테스트 요청/응답 |
| `TradeLogEntry` / `AddTradeRequest` / `AddTradeResponse` | `/api/trade-log` | 8개 |
| `Portfolio` / `PortfolioHolding` / `PortfolioUpsertRequest` | `/api/portfolios` | CRUD |

---

### `api/routers/dashboard.py`

**역할:** `output/` CSV를 읽어 JSON으로 반환하는 읽기 전용 라우터. `src/` import 없음.

**내부 유틸리티 함수:**

| 함수 | 역할 |
|------|------|
| `_read_csv(path)` | 파일 없거나 오류시 빈 DataFrame 반환 (안전 처리) |
| `_normalize_code(value)` | ETF 코드 6자리 zero-padding (`69500` → `069500`) |
| `_clean_scalar(value)` | NaN → 0.0 or "" 변환, numpy scalar → Python 기본형 변환 |
| `_format_date(value)` | pandas Timestamp → `YYYY-MM-DD` 문자열 |
| `_clean_bool(value)` | CSV의 `"True"/"False"` 문자열 → Python bool |
| `_records(df, columns, date_columns)` | DataFrame → `list[dict]` 변환 (위 유틸 적용) |

**엔드포인트 목록:**

| 경로 | 읽는 파일 | 반환 타입 |
|------|----------|----------|
| `GET /api/portfolio-summary` | `output/portfolio_summary.csv` | `PortfolioSummary \| None` |
| `GET /api/holdings` | `output/current_holdings.csv` | `list[Holding]` |
| `GET /api/backtest-nav` | `output/backtest_nav.csv` | `list[NavPoint]` |
| `GET /api/monthly-returns` | `output/monthly_returns.csv` | `list[MonthlyReturn]` |
| `GET /api/comparison/summary` | `output/comparison/summary.csv` | `list[ComparisonSummaryItem]` |
| `GET /api/comparison/nav` | `output/comparison/*_nav.csv` (glob) | `dict[str, list[ComparisonNavPoint]]` |
| `GET /api/rules` | `output/rule_individual_etf.csv` + `rule_risk_asset.csv` | `RulesResponse \| None` |
| `GET /api/turnover` | `output/turnover_initial/weekly/monthly.csv` | `TurnoverResponse \| None` |
| `GET /api/data-date` | `output/*.csv` 파일 mtime 최신값 | `DataDateResponse` |
| `GET /api/etf-list` | `data/prices_daily.csv` + `data/etf_master.csv` | `list[EtfItem]` |
| `GET /api/etf-prices/{code}` | `data/prices_daily.csv` | `list[EtfPricePoint]` |
| `GET /api/report` | `output/report_*.md` 최신 파일 | `ReportResponse \| None` |

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

**역할:** `data/trade_log.json` CRUD. 단순한 JSON 파일 읽기/쓰기.

| 엔드포인트 | 역할 |
|-----------|------|
| `GET /api/trade-log` | JSON 파일 전체 반환 |
| `POST /api/trade-log` | 새 항목 추가 후 전체 파일 재저장 |

---

## `src/` — 계산 엔진

### `src/metrics.py` (258줄)

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

### `src/backtest.py` (129줄)

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

### `src/run_engine.py` (164줄)

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
| `turnover.py` | 초기/주간/월간 회전율 계산. `check_turnover_limits()` 반환값: `{initial, weekly, monthly}` |
| `update_prices.py` | pykrx로 ETF 가격 수집 → `data/prices_daily.csv` 갱신. **네트워크 접근 유일한 파일** |
| `run_sample_engine.py` | 샘플 데이터로 엔진 실행 (개발/테스트용) |
| `report_builder.py` | Markdown 월간 리포트 생성 → `output/report_YYYYMM.md` |

---

## `frontend/` — Next.js 프론트엔드

### `frontend/lib/api.ts`

`get<T>`, `post<T>`, `del` 3개 함수. `NEXT_PUBLIC_API_URL` 환경변수 기반 (기본 `http://localhost:8000`). 에러 시 `Error` throw.

### `frontend/lib/hooks/`

| 파일 | 포함 훅 |
|------|---------|
| `dashboard.ts` | `usePortfolioSummary`, `useBacktestNav`, `useMonthlyReturns`, `useCurrentHoldings`, `useTurnover`, `useRules`, `useDataDate`, `useReport`, `useComparisonSummary`, `useComparisonNav`, `useTradeLog`, `usePortfolioDetail` (12개) |
| `portfolio.ts` | `usePortfolios`, `useRunBacktest` (포트폴리오 목록 + 온디맨드 백테스트) |
| `trades.ts` | `useAddTrade` (거래 추가 mutation) |

모든 훅은 TanStack Query v5 기반. `queryKey` 배열로 캐시 키 관리.

---

### `frontend/app/` — 페이지 라우트

| 경로 | 파일 크기 | 주요 기능 |
|------|----------|---------|
| `/` | 5.4KB | 홈 대시보드. KPI 스트립, NAV 차트, 보유 테이블 |
| `/portfolio` | **19.8KB** | 포트폴리오 상세. 가장 복잡한 페이지. ETF 구성, 백테스트 실행, 규칙/회전율 확인 |
| `/comparison` | 4.8KB | 다중 포트폴리오 비교 차트 + 성과 요약 테이블 |
| `/operations` | 8.9KB | 리밸런싱 운영 페이지. 규칙 배지 + 회전율 행 |
| `/trades` | 8.4KB | 거래 로그 테이블 + 신규 거래 입력 폼 |
| `/market` | 0.3KB | ETF 시장 가격 조회 (미완성) |
| `/report` | 1.0KB | 최신 Markdown 리포트 렌더링 |

---

### `frontend/components/`

**charts/**

| 컴포넌트 | 입력 props | 역할 |
|---------|-----------|------|
| `NavChart.tsx` | `NavPoint[]` | TradingView Lightweight Charts v5로 NAV 시계열 라인 차트 |
| `ComparisonChart.tsx` | `Record<string, ComparisonNavPoint[]>` | 다중 포트폴리오 누적수익률 비교 |
| `DrawdownChart.tsx` | `NavPoint[]` | 낙폭 히스토그램 |
| `MonthlyBarChart.tsx` | `MonthlyReturn[]` | 월별 수익률 막대 차트 |

**ui/**

| 컴포넌트 | 입력 props | 역할 |
|---------|-----------|------|
| `HoldingsTable.tsx` | `Holding[]` | 보유 ETF 테이블 (code, name, 수량, 평단가, 평가손익) |
| `RuleBadge.tsx` | `IndividualRule[]`, `RiskAssetRule` | PASS/FAIL 배지 |
| `TurnoverRow.tsx` | `TurnoverBase` | 회전율 진행 바 + 한도 표시 |
| `KpiStrip.tsx` | `PortfolioSummary` | CAGR/MDD/Sharpe 등 KPI 가로 스트립 |
| `StatusBar.tsx` | `date: string` | 데이터 최신화 시각 표시 |

---

## `data/` — 입력 데이터

| 파일 | 형식 | 역할 |
|------|------|------|
| `prices_daily.csv` | `date, code, close` | ETF 일별 종가. `update_prices.py`가 생성 |
| `etf_master.csv` | `code, name, risk_type, asset_class` | ETF 메타데이터 |
| `trades.csv` | `date, code, quantity, price, action` | 매매 내역. `portfolio.py`가 읽음 |
| `trade_log.json` | JSON 배열 | 리밸런싱 결정 로그. `trades.py` API가 관리 |
| `sample_*.csv` | 위와 동일 구조 | 개발/테스트용 샘플 |

---

## `output/` — 생성 산출물 (수동 편집 금지)

| 파일 | 생성처 | 소비처 |
|------|--------|--------|
| `backtest_nav.csv` | `run_engine.py` | `GET /api/backtest-nav` |
| `portfolio_summary.csv` | `run_engine.py` | `GET /api/portfolio-summary` |
| `current_holdings.csv` | `run_engine.py` | `GET /api/holdings` |
| `monthly_returns.csv` | `run_engine.py` | `GET /api/monthly-returns` |
| `rule_individual_etf.csv` | `run_engine.py` | `GET /api/rules` |
| `rule_risk_asset.csv` | `run_engine.py` | `GET /api/rules` |
| `turnover_initial/weekly/monthly.csv` | `run_engine.py` | `GET /api/turnover` |
| `comparison/*_nav.csv` | `run_engine.py` | `GET /api/comparison/nav` |
| `comparison/summary.csv` | `run_engine.py` | `GET /api/comparison/summary` |
| `report_YYYYMM.md` | `report_builder.py` | `GET /api/report` |

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
| `test_boundaries.py` | CRITICAL-1/2 위반 검사. `api/` 파일이 `src/` import하지 않는지, `pykrx` 없는지 확인 |
| `test_metrics.py` | `src/metrics.py` 순수 함수 단위 테스트 |
| `test_output_schema.py` | `output/*.csv` 컬럼 스키마 검증 |
| `test_smoke_engine.py` | 샘플 데이터로 전체 엔진 실행 스모크 테스트 |
| `conftest.py` | pytest fixture 설정 |

---

## `docs/`

| 파일 | 역할 |
|------|------|
| `ARCHITECTURE.md` | 전체 아키텍처 문서 |
| `ADR.md` | 아키텍처 결정 레코드 |
| `PRD.md` | 제품 요구사항 문서 |
| `data_schema.md` | output/ CSV 스키마 정의 |
| `UI_GUIDE.md` | UI 구현 가이드 |
| `DESIGN.md` | 제품 성격 및 시각 방향 정의 |
| `DESIGN-LANGUAGE.md` | 디자인 판단 규칙 및 안티패턴 |
| `design-tokens.json` | 색상/타이포 등 머신 가독 토큰 |
| `QA_CHECKLIST.md` | UI 최종 검토 체크리스트 |
| `PROJECT_STATUS.md` | 현재 진행 상태 요약 |

---

## 잠재적 이슈 / 검토 포인트

### 1. `db.py` 주석 잔재 (낮음)

`db.py` 1번 줄 docstring에 `"Used by both web/ (Streamlit dashboard) and src/"` 라고 되어 있음.
현재 `web/`은 존재하지 않고 `api/`가 그 역할을 함. 주석만 업데이트하면 됨.

### 2. `trades.py` DELETE 미구현 (중간)

`GET /api/trade-log`, `POST /api/trade-log`만 존재. 거래 기록 삭제 엔드포인트 없음.
오입력 정정이 불가능한 상태.

### 3. `run_engine.py` 하드코딩 날짜 (중간)

```python
check_turnover_limits(trades, capital_base=INITIAL_VALUE, initial_end_date="2026-01-02")
```

회전율 초기 구간 끝날짜가 소스코드에 박혀 있음. 운영 시 매년 변경 필요.

### 4. `upsert_portfolio`의 protected 덮어쓰기 가능성 (중간)

`db.upsert_portfolio()`는 `is_protected` 플래그는 유지하지만 `holdings`는 변경함.
`POST /api/portfolios`로 `base/aggressive/conservative`의 구성 비중을 API로 변경할 수 있음.

### 5. `/market` 페이지 미완성 (낮음)

`frontend/app/market/page.tsx`가 255 bytes로 내용이 거의 없음.

### 6. `portfolio/page.tsx` 크기 (낮음)

19.8KB로 다른 페이지 대비 4배 이상. 컴포넌트 분리 검토 가능.

### 7. `AGENTS.md` 내용 일부 구시대 (낮음)

`web/` 디렉토리, Streamlit 관련 내용이 남아 있음. 현재 구조(api/, frontend/)로 업데이트 필요.

### 8. `docs/UI_GUIDE.md` Streamlit 기반 (낮음)

UI_GUIDE.md가 Streamlit 구현 기준으로 작성되어 있음. Next.js 기준으로 재작성 필요.
