# PROJECT_STATUS — DBGAPS 포트폴리오 자동화 대시보드

최종 업데이트: 2026-05-24

---

## 배포 정보

| 항목 | 내용 |
|---|---|
| **GitHub** | https://github.com/TaeHee324/dbgaps_dashboard |
| **백엔드 (Railway)** | FastAPI + uvicorn, 루트 `railway.toml` |
| **프론트엔드 (Railway)** | Next.js 15, `frontend/railway.toml`, Root Directory = `frontend/` |
| **백엔드 시작 명령** | `python src/run_sample_engine.py && uvicorn api.main:app --host 0.0.0.0 --port $PORT` |
| **프론트엔드 시작 명령** | `npm start` |

### 환경변수

| 변수 | 서비스 | 내용 |
|---|---|---|
| `DATABASE_URL` | 백엔드 | Railway PostgreSQL external TCP proxy URL |
| `ALLOWED_ORIGINS` | 백엔드 | 프론트엔드 Railway URL (콤마 구분) |
| `NEXT_PUBLIC_API_URL` | 프론트엔드 | 백엔드 Railway public URL |

---

## 아키텍처

```
pykrx → src/update_prices.py → data/prices_daily.csv
data/*.csv + portfolios/*.csv → src/ 엔진 → output/
output/*.csv → api/ FastAPI → frontend/ Next.js
PostgreSQL ↔ api/routers/portfolios.py (포트폴리오 CRUD)
```

### 핵심 경계 규칙

1. `api/`는 `src/`를 import하지 않는다 — `output/` CSV만 읽는다  
   (예외: `api/routers/portfolios.py`의 POST /api/backtest 핸들러만 허용)
2. `api/`는 pykrx·네트워크 수집을 하지 않는다 — `src/update_prices.py` 전용
3. `output/`은 생성 산출물이다 — 직접 편집 금지

---

## 계산 엔진 (`src/`)

| 파일 | 내용 |
|---|---|
| `metrics.py` | CAGR, MDD, Alpha, Beta, 연간변동성, 승률, 샤프, 칼마 |
| `backtest.py` | 포트폴리오 백테스트 (드리프트 / 주기 리밸런싱) |
| `portfolio.py` | 매매일지 기반 현재 보유 평가 (평가금액, 비중, 미실현손익) |
| `rules.py` | 규칙 체크 (개별 ETF 20%, 위험자산 70%) |
| `turnover.py` | 회전율 (초기 80%, 주간/월간 10%) |
| `update_prices.py` | pykrx → prices_daily.csv 증분 업데이트 (수집 전용) |
| `run_engine.py` | 실제 데이터 기반 전체 엔진 실행 → output/ 생성 |
| `run_sample_engine.py` | 샘플 데이터 기반 전체 엔진 실행 (테스트·Railway 초기화용) |
| `report_builder.py` | 월간보고서 Markdown 자동 생성 → output/report_YYYYMM.md |

---

## API (`api/`)

| 파일 | 내용 |
|---|---|
| `main.py` | FastAPI 앱, CORS 미들웨어 (`ALLOWED_ORIGINS` 환경변수) |
| `schemas.py` | Pydantic v2 응답 모델 전체 |
| `routers/dashboard.py` | output/ CSV 읽기 엔드포인트 (12개) |
| `routers/portfolios.py` | PostgreSQL CRUD + POST /api/backtest (src/ import 허용 예외) |
| `routers/trades.py` | data/trade_log.json CRUD |
| `CONTRACT.md` | API 전체 계약 문서 (엔드포인트 18개, TypeScript 타입, 에러 규칙) |

---

## 프론트엔드 (`frontend/`)

| 라우트 | 내용 |
|---|---|
| `/` | 홈 — 전략 요약 KPI, NAV+Drawdown 차트, 매매일지 마커 |
| `/operations` | 운용 현황 — 전체 섹션 (KPI, 차트, 회전율, 규칙, 월별수익률, 비교, 보유현황) |
| `/portfolio` | ETF 탐색기 + 포트폴리오 빌더 + 백테스트 + CRUD |
| `/comparison` | 멀티 포트폴리오 비교 (기간 필터, NAV 차트, 지표 테이블) |
| `/trades` | 매매일지 입력 + 이력 조회 |
| `/report` | 월간보고서 Markdown 렌더링 |
| `/market` | 시장 현황 — 준비 중 |

---

## 테스트 (`tests/`)

| 파일 | 내용 |
|---|---|
| `conftest.py` | 공통 픽스처 |
| `test_smoke_engine.py` | backtest, portfolio, rules, turnover smoke test |
| `test_boundaries.py` | pykrx는 update_prices.py에만, api/는 src/ import 금지 확인 |
| `test_output_schema.py` | output/ CSV 컬럼 계약 검증 |
| `test_metrics.py` | 개별 지표 함수 단위 테스트 |

---

## 실제 데이터

| 항목 | 내용 |
|---|---|
| `data/prices_daily.csv` | 317,630행, 2015-01-02 ~ 2026-05-22, 189개 종목 |
| 벤치마크 | 069500 (KODEX 200) |
| 백테스트 기간 | 2021-12-15 ~ 2026-05-22 (약 4.4년) |

## 포트폴리오 (`portfolios/` + PostgreSQL)

| 이름 | CAGR | MDD | 샤프 |
|---|---|---|---|
| `base` | 18.5% | -13.1% | 1.62 |
| `conservative` | 9.7% | -2.8% | 2.53 |
| `aggressive` | 27.3% | -23.6% | 1.34 |

---

## output/ 파일 계약

| 파일 | 용도 |
|---|---|
| `portfolio_summary.csv` | KPI (CAGR, MDD, 샤프, 칼마, Alpha, Beta 등) |
| `backtest_nav.csv` | 일별 NAV, 누적수익률, Drawdown |
| `monthly_returns.csv` | 월별 수익률 (year, month, monthly_return) |
| `current_holdings.csv` | 현재 보유 종목 평가 |
| `rule_individual_etf.csv` | 개별 ETF 20% 상한 규칙 체크 |
| `rule_risk_asset.csv` | 위험자산 70% 상한 규칙 체크 |
| `turnover_initial.csv` | 초기 누적 회전율 |
| `turnover_weekly.csv` | 주간 회전율 |
| `turnover_monthly.csv` | 월간 회전율 |
| `comparison/summary.csv` | 멀티 포트폴리오 지표 비교 |
| `comparison/*_nav.csv` | 포트폴리오별 NAV 시계열 |
| `report_YYYYMM.md` | 월간보고서 Markdown |

---

## 개발 명령어

```bash
# 가격 수집 (pykrx, 네트워크 필요)
python src/update_prices.py

# 전체 엔진 실행 (output/ 생성)
python src/run_engine.py

# 샘플 데이터 엔진 실행 (테스트용)
python src/run_sample_engine.py

# FastAPI 개발 서버
uvicorn api.main:app --reload

# Next.js 개발 서버
cd frontend && npm run dev

# 전체 테스트
python -m pytest tests/ -q
```

---

## 다음 과제

- [ ] `python src/update_prices.py && python src/run_engine.py` Railway Cron 자동화
- [ ] `/market` 시장 현황 페이지 구현
- [ ] `ALLOWED_ORIGINS` 환경변수를 실제 프론트엔드 URL로 설정 확인
