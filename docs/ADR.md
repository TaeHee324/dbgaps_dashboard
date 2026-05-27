# ADR — Architecture Decision Records

## 철학

- 대회 기간 내 빠른 구현과 운용이 최우선
- 외부 서비스 의존성 최소화 (가격 수집 제외)
- 팀이 직접 파일을 열어보고 수정할 수 있는 투명성 유지

---

## ADR-001: 저장소를 CSV로 선택

**결정**: 1차 구현에서 모든 데이터를 CSV 파일로 저장한다.

**선택 이유**:
- Git으로 변경 이력 추적 가능
- 팀원이 Excel/메모장으로 직접 열어볼 수 있음
- 별도 DB 서버 없이 Railway 배포 가능
- 현재 데이터 규모(ETF 188개, 일별 종가)에서 성능 문제 없음

**트레이드오프**:
- 데이터 정합성, 중복 제거, 쿼리 기능이 약함
- 동시 쓰기 불가 (팀원 동시 수정 시 Git 충돌 가능)

**재검토 조건**: 가격 데이터가 수십만 행을 넘거나, 웹에서 직접 매매일지를 수정해야 하는 경우 SQLite 또는 Railway PostgreSQL 검토.

**갱신 (2026-05-27)**: PostgreSQL 부분 도입 완료. portfolios 테이블(포트폴리오 비중 정의) 및 trade_log 테이블(매매 내역)은 Railway PostgreSQL로 이전됨. 가격 데이터(`prices_daily.csv`)와 엔진 산출물(`output/*.csv`)은 여전히 CSV 유지. `db.py`가 공유 PostgreSQL 모듈 역할.

---

## ADR-002: 가격 데이터 수집에 pykrx 사용

**결정**: ETF 일별 종가 수집에 pykrx를 사용한다.

**선택 이유**:
- 국내 ETF 한국거래소(KRX) 데이터에 특화
- `stock.get_etf_ohlcv_by_date()` API로 일별 OHLCV 바로 수집 가능
- 무료, 설치 간단 (`pip install pykrx`)

**트레이드오프**:
- 비공식 라이브러리이므로 KRX 서버 정책 변경 시 중단 가능
- 장중 실시간 데이터 미지원 (일별 종가만 사용)
- 대량 수집 시 서버 부하를 줄이기 위해 속도 제한 필요

**제약**: pykrx는 `update_prices.py`에만 import한다 (CRITICAL-2).

---

## ADR-003: 계산 엔진과 웹 UI를 파일 기반으로 분리

**결정**: 웹 대시보드는 `src/`를 import하지 않고 `output/` CSV/JSON만 읽는다.

**선택 이유**:
- Railway 배포 시 계산 엔진 없이 UI 컨테이너만 경량 동작 가능
- 계산 결과를 파일로 남기면 디버깅이 쉽고 재현 가능
- UI 기술스택 변경 시 계산 엔진 수정 불필요

**트레이드오프**:
- 실시간 계산이 불가능 (사용자 요청 시 즉시 재계산 어려움)
- output/ 파일이 최신 상태인지 별도 관리 필요

---

## ADR-004: 배포 플랫폼으로 Railway 선택

**결정**: 웹 대시보드는 Railway에 배포한다.

**선택 이유**:
- GitHub 연동으로 자동 배포 가능
- Python 웹 앱 배포 지원 (Flask, FastAPI, Streamlit 모두 가능)
- 소규모 팀 내부 도구에 적합한 가격

**트레이드오프**:
- 무료 플랜 sleep 문제 (유료 플랜 필요할 수 있음)
- 파일 기반 CSV는 Railway 재시작 시 휘발 → 데이터는 Git에서 관리하거나 Volume 마운트 필요

**결정됨 (2026-05-27)**: FastAPI + Next.js 15 App Router + TypeScript + Tailwind CSS로 완료. "Flask, FastAPI, Streamlit 모두 가능"이라는 미결정 상태는 해소됨. Railway 2개 서비스(백엔드 FastAPI + 프론트엔드 Next.js)로 배포 중. PostgreSQL은 Railway 추가 서비스로 운영.

---

## ADR-005: 그래프는 matplotlib 정적 PNG로 먼저 구현

**결정**: phase-2에서 그래프를 matplotlib으로 정적 PNG로 구현한다.

**선택 이유**:
- 웹 대시보드 기술스택이 미결정인 상태에서 라이브러리 중립적
- 보고서에 PNG로 직접 첨부 가능
- 추후 plotly/altair 인터랙티브로 교체 용이

**트레이드오프**:
- 인터랙티브 기능 없음 (hover, zoom 불가)

**갱신 (2026-05-27)**: TradingView Lightweight Charts v5로 교체 완료. `output/charts/` PNG 파일 및 `src/charts.py`는 더 이상 사용하지 않음. 차트 렌더링이 프론트엔드(`frontend/components/charts/`)에서 전담. NavChart, DrawdownChart, ComparisonChart, MonthlyBarChart, PieChart 컴포넌트 구현됨.
