# PROJECT_STATUS — DBGAPS 포트폴리오 자동화 대시보드

최종 업데이트: 2026-05-22

---

## 배포 정보

- **GitHub**: https://github.com/TaeHee324/dbgaps_dashboard
- **Railway**: 배포 완료 (port 8080, Streamlit)
- **시작 명령**: `python src/run_engine.py && streamlit run web/app.py --server.address=0.0.0.0 --server.port=$PORT`

---

## 완료된 것

### 계산 엔진 (`src/`)

| 파일 | 내용 |
|---|---|
| `metrics.py` | CAGR, MDD, Alpha, Beta, 연간변동성, 승률, 샤프, 칼마 (엣지케이스 방어 포함) |
| `backtest.py` | 포트폴리오 백테스트 (드리프트 / 주기 리밸런싱) |
| `portfolio.py` | 매매일지 기반 현재 보유 평가 (평가금액, 비중, 미실현손익) |
| `rules.py` | 대회 규칙 체크 (개별 ETF 20%, 위험자산 70%) |
| `turnover.py` | 회전율 (초기 80%, 주간/월간 10%) — actual_trades 소스 명시 |
| `update_prices.py` | pykrx → prices_daily.csv 증분 업데이트 (수집 전용) |
| `run_sample_engine.py` | 샘플 데이터 기반 전체 엔진 실행 (테스트용 유지) |
| `run_engine.py` | 실제 데이터 기반 전체 엔진 실행 → output/ 생성 |
| `report_builder.py` | 월간보고서 Markdown 자동 생성 → output/report_YYYYMM.md |

### 테스트 (`tests/`)

| 파일 | 내용 |
|---|---|
| `conftest.py` | 공통 픽스처 (sample_prices, sample_etf_master, sample_trades) |
| `test_smoke_engine.py` | backtest, portfolio, rules, turnover smoke test |
| `test_boundaries.py` | pykrx는 update_prices.py에만, web/은 src/ import 금지 |
| `test_output_schema.py` | output/ CSV 컬럼 계약 검증 (data_loader 읽는 전 파일 커버) |

현재 결과: **25 passed, 0 skipped**

### 실제 데이터

| 항목 | 내용 |
|---|---|
| `data/prices_daily.csv` | 317,630행, 2015-01-02 ~ 2026-05-22, 189개 종목 |
| 벤치마크 | 069500 (KODEX 200) 포함 |
| 백테스트 기간 | 2021-12-15 ~ 2026-05-22 (약 4.4년) |

### 포트폴리오 (`portfolios/`)

| 파일 | 설명 |
|---|---|
| `base.csv` | 기본 포트폴리오 — CAGR 18.5%, MDD -13.1%, 샤프 1.62 |
| `conservative.csv` | 안정형 — CAGR 9.7%, MDD -2.8%, 샤프 2.53 |
| `aggressive.csv` | 위험형 — CAGR 27.3%, MDD -23.6%, 샤프 1.34 |

### output/ 파일 계약

| 파일 | 용도 |
|---|---|
| `portfolio_summary.csv` | KPI (CAGR, MDD, 샤프, 칼마, Alpha, Beta 등) |
| `backtest_nav.csv` | 일별 NAV, 누적수익률, Drawdown |
| `monthly_returns.csv` | 월별 수익률 (year, month, monthly_return) |
| `current_holdings.csv` | 현재 보유 종목 평가 |
| `rule_individual_etf.csv` | 개별 ETF 20% 상한 규칙 체크 |
| `rule_risk_asset.csv` | 위험자산 70% 상한 규칙 체크 |
| `turnover_initial.csv` | 초기 누적 회전율 (actual_trades 기준) |
| `turnover_weekly.csv` | 주간 회전율 (actual_trades 기준) |
| `turnover_monthly.csv` | 월간 회전율 (actual_trades 기준) |
| `comparison/summary.csv` | 멀티 포트폴리오 지표 비교 |
| `comparison/*_nav.csv` | 포트폴리오별 NAV 시계열 |
| `report_YYYYMM.md` | 월간보고서 Markdown |

### 웹 대시보드 (`web/`)

| 파일 | 내용 |
|---|---|
| `app.py` | Streamlit 진입점, 레이아웃 조립 |
| `data_loader.py` | output/ CSV 전담 읽기 (@st.cache_data ttl=300) |
| `components.py` | KPI strip, NAV 차트, Drawdown 차트, 회전율 섹션, 규칙 badge, 월별수익률 bar, 보유현황 표, 포트폴리오 비교, 보고서 섹션 |

현재 화면 순서:
1. 상태바 (데이터 기준일 — backtest_nav.csv 마지막 date 기준)
2. KPI 5개 (누적수익률, CAGR, MDD, 샤프, 연간변동성)
3. NAV 차트 + Drawdown 차트 (2열)
4. 회전율 섹션 (초기/주간/월간 badge)
5. 규칙 badge (개별 ETF 상한 / 위험자산 상한)
6. 월별 수익률 bar 차트
7. 포트폴리오 비교 (비교표 + NAV 비교 차트)
8. 보유현황 표
9. 월간보고서 섹션 (Markdown + 복사 가능)

---

## 남은 것

### 즉시 (독립 실행)

- [ ] `python src/run_engine.py` 실행 → output/backtest_nav.csv 등 생성 → 대시보드 NAV·월별수익률·비교 섹션 표시
- [ ] 대회 첫날 실제 매수 후 `data/trades.csv` 기입 → `run_engine.py` 재실행

### Phase 5 — ETF 탐색기 (미구현)

- [ ] Step 0: app.py → `web/pages/` multipage 구조 전환
- [ ] Step 1: `web/pages/1_ETF_탐색기.py` — 188개 ETF 검색/필터 테이블
- [ ] Step 2: ETF 선택 → 주가 차트 (1M/3M/6M/1Y/전체)

### Phase 6 — 포트폴리오 빌더 (미구현, Phase 5와 병렬 가능)

- [ ] Step 0: `web/pages/2_포트폴리오_빌더.py` — ETF 선택 + 비중 입력 UI
- [ ] Step 1: 백테스트 실행 → KPI + NAV + Drawdown + 월별수익률
- [ ] Step 2: 벤치마크 비교선 + Alpha/Beta + 포트폴리오 저장

→ 상세 계획: `PLAN.md`

### 운영 관련

- [ ] Railway 배포 시작 명령을 `run_engine.py` 기반으로 업데이트 확인
- [ ] `python src/update_prices.py` 를 Railway 스케줄 또는 GitHub Actions 로 자동화
- [ ] 대회 규칙 위반 항목 해소 (실제 포트폴리오 확정 후 재검토)

### 선택적 개선

- [ ] NAV 차트 벤치마크 선: backtest_nav.csv 에 benchmark_value 컬럼 추가 시 자동 표시
- [ ] `src/charts.py` 구현: 정적 PNG 출력 (월간보고서 첨부용)

---

## 아키텍처 핵심 규칙 (변경 금지)

1. `web/`은 `src/`를 절대 import하지 않는다 — `output/`만 읽는다
2. `update_prices.py`에만 pykrx와 네트워크 요청이 있다
3. `output/`은 gitignore 대상 — Railway 시작 시 자동 생성
4. 계산 모듈은 pandas만으로 동작해야 한다
5. 회전율 규칙 체크는 actual_trades 소스 기준

---

## 개발 명령어

```bash
# 실제 가격 데이터 수집 (pykrx, 네트워크 필요)
python src/update_prices.py

# 전체 엔진 실행 (output/ 생성 + 보고서 생성)
python src/run_engine.py

# 샘플 데이터 엔진 실행 (테스트용)
python src/run_sample_engine.py

# 대시보드 로컬 실행
streamlit run web/app.py

# 전체 테스트
python -m pytest tests/ -q
```
