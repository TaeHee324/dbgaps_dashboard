# 다음 세션 메모 — DBGAPS 대시보드

작성일: 2026-05-22
보강일: 2026-05-22

## 현재 프로젝트 상태

- 프로젝트: DB GAPS 대회용 ETF 포트폴리오 자동화 대시보드
- 위치: `C:\Users\PC\Desktop\dbgaps_dashboard`
- 현재 구조는 계산 엔진과 웹 UI를 분리하는 방향으로 이미 잡혀 있음.
- 핵심 규칙은 `CLAUDE.md`에 있음.
  - 웹 대시보드는 `src/`를 직접 import하지 않는다.
  - 웹 대시보드는 `output/`의 CSV/PNG/JSON 산출물만 읽는다.
  - `pykrx`와 네트워크 수집은 `src/update_prices.py`에만 둔다.
  - 계산 모듈은 pandas 기반으로 테스트 가능해야 한다.
- 현재 `docs/UI_GUIDE.md`는 TODO 상태이고, `DESIGN.md`는 아직 없음.
- 현재 `tests/`에는 `conftest.py`만 있어 계산 엔진·산출물 계약·import 경계 테스트가 비어 있음.

## 먼저 정정할 점: Railway vs Streamlit

어제 메모의 “Railway가 아니라 Streamlit”이라는 표현은 정확히는 비교 축이 다르다.

| 항목 | 역할 | 이 프로젝트에서의 의미 |
|---|---|---|
| Streamlit | 대시보드 앱 프레임워크 | Python으로 KPI, 표, 차트, CSV 기반 화면을 빠르게 구현 |
| Railway | 배포/호스팅 플랫폼 | 완성된 Streamlit 앱을 외부 URL로 띄우는 실행 환경 후보 |
| FastAPI + HTML/React | 웹 앱 아키텍처 | 인증, API, 복잡한 라우팅, 다중 사용자 운영이 필요할 때 검토 |

따라서 권장 방향은 “Railway 대신 Streamlit”이 아니라 **“1차 MVP는 Streamlit으로 만들고, 배포는 Railway 또는 Streamlit Community Cloud 중 선택한다”**가 맞다.

## 왜 1차 MVP는 Streamlit인가

이 프로젝트는 현재 “대회용 ETF 포트폴리오 산출물을 팀이 확인하는 내부 운영 대시보드”에 가깝다. 이 조건에서는 Streamlit이 과한 웹 프레임워크보다 효율적이다.

### Streamlit을 추천하는 이유

1. 현재 데이터 흐름과 맞다.
   - 이미 계산 결과가 `output/*.csv`로 떨어진다.
   - Streamlit은 pandas DataFrame, CSV, matplotlib/plotly 차트를 바로 화면에 올리기 쉽다.
   - 별도 API 서버를 만들지 않아도 읽기 전용 대시보드가 가능하다.

2. `src/` import 금지 규칙을 지키기 쉽다.
   - `web/data_loader.py`가 `output/`만 읽도록 만들면 계산 엔진과 UI 경계가 명확하다.
   - UI가 계산을 다시 수행하지 않으므로 `pykrx`, 네트워크, 데이터 수집 의존성이 웹 앱으로 번지지 않는다.

3. 대회용 MVP 속도에 유리하다.
   - KPI 카드, 표, 탭, 사이드바 필터, 차트가 기본 기능으로 충분하다.
   - “먼저 팀이 매일 확인할 수 있는 화면”을 만드는 데 필요한 코드량이 적다.

4. 금융 대시보드의 핵심은 화려한 프론트엔드보다 검증된 숫자다.
   - 위키의 `financial-ai-workflow.md` 기준으로 이 프로젝트는 자동매매가 아니라 Advisory / Assisted Ops 단계다.
   - 따라서 화면보다 중요한 것은 데이터 기준일, 규칙 위반 여부, 계산 산출물 계약, 판단 로그다.

### Streamlit의 한계도 명시

Streamlit은 다음 요구가 커지면 한계가 생긴다.

- 사용자별 로그인/권한이 필요하다.
- 팀별 포트폴리오를 DB에 저장하고 수정해야 한다.
- 주문 티켓, 승인 워크플로우, 댓글, 알림처럼 상호작용이 많아진다.
- 대시보드를 외부 사용자에게 제품처럼 제공해야 한다.
- 복잡한 라우팅, URL 상태 관리, 디자인 커스터마이징이 중요해진다.

이 경우 2차 구조는 `FastAPI + React/Next.js` 또는 `FastAPI + Jinja/HTMX`로 전환을 검토한다. 단, 지금 단계에서 바로 이 구조로 가면 계산 엔진 안정화보다 웹앱 구조 설계에 시간을 많이 쓰게 된다.

## 배포 선택지

| 선택지 | 추천 상황 | 비고 |
|---|---|---|
| 로컬 실행 | 개발·팀 내부 확인 | `streamlit run web/app.py` |
| Streamlit Community Cloud | GitHub 공개/교육용 공유 | Streamlit 공식 배포 흐름이 단순함 |
| Railway | 외부 공유 URL, 환경변수, 장기 실행 서비스 | Streamlit 앱도 Railway에 배포 가능. 포트 설정 필요 |
| Render/Fly.io/VPS | Railway 대안 | 운영 취향과 비용 기준으로 선택 |

Railway를 쓴다면 Streamlit 앱 실행 명령은 대략 다음 형태가 된다.

```bash
streamlit run web/app.py --server.address=0.0.0.0 --server.port=$PORT
```

Railway는 “웹 앱을 띄우는 곳”이고, Streamlit은 “웹 앱을 만드는 방식”이다.

## 대시보드 기술스택 권장안

1차 MVP:

```text
Python + Streamlit + pandas + Plotly 또는 matplotlib PNG 재사용
```

권장 웹 구조:

```text
web/
├── app.py              # Streamlit entry
├── data_loader.py      # output/*.csv, output/charts/*.png, output/*.json만 읽음
├── components.py       # KPI, chart, table, badge 렌더링
└── style.py            # 색상 토큰, Streamlit CSS 최소 주입
```

금지:

```text
web/에서 src/ import 금지
web/에서 pykrx import 금지
web/에서 data/*.csv 직접 수정 금지
web/에서 가격 업데이트 실행 금지
```

## 대시보드 화면 구성

추천 첫 화면은 “성과 → 리스크 → 규칙 → 보유 → 보고서” 순서가 좋다.

1. 상태 바
   - 데이터 기준일
   - 마지막 계산 시간
   - 벤치마크 코드: `069500` KODEX 200
   - 규칙 위반 여부 요약

2. 상단 KPI
   - 누적수익률
   - CAGR
   - MDD
   - 연간변동성
   - 샤프지수
   - 벤치마크 대비 초과수익

3. 메인 차트
   - 포트폴리오 NAV vs KODEX 200
   - 가능하면 기준값 100으로 정규화

4. 리스크 차트
   - drawdown
   - 월별 수익률 bar 또는 heatmap

5. 규칙 체크
   - 개별 ETF 20% 상한
   - 위험자산 70% 상한
   - 초기/주간/월간 회전율 제한
   - 위반/주의/정상 badge 표시

6. 현재 보유 현황
   - ETF명, 코드, 수량, 평가금액, 비중, 미실현손익, 위험자산 여부
   - 비중 내림차순 정렬
   - 규칙 위반 행 강조

7. 월간보고서 섹션
   - 보고서에 복사 가능한 요약 문장
   - 성과/리스크/매매 요약 표
   - 이번 달 판단 로그 링크 또는 `run_card` 표시

## 디자인 톤

이 프로젝트는 금융 SaaS 내부 운영 도구에 가깝다.

권장:
- 조밀하지만 읽기 쉬운 정보 밀도
- 흰색/연회색 배경, 짙은 네이비/차콜 텍스트
- 수익/정상은 녹색, 손실/위반은 빨강, 주의는 amber 계열
- KPI는 1행 4~6개로 빠르게 스캔
- 표는 핵심이고, 차트는 판단을 돕는 보조 수단
- 데이터 기준일과 규칙 위반 여부를 항상 상단에 노출

피해야 할 것:
- 랜딩페이지식 히어로 섹션
- 큰 그라디언트 배경
- 장식용 카드 남발
- 숫자보다 설명 문구가 많은 화면
- 금융 도구인데 “AI가 알아서 추천”처럼 보이는 문구

## 참고할 GitHub / 디자인 자료

아래는 그대로 복제할 대상이 아니라, 화면 패턴과 에이전트용 디자인 규칙을 참고할 자료다.

| 자료 | URL | 가져올 점 |
|---|---|---|
| Streamlit 공식 repo | https://github.com/streamlit/streamlit | Streamlit 기본 컴포넌트와 앱 구조 감각 |
| Streamlit docs | https://github.com/streamlit/docs | 배포, 설정, secrets, requirements 구성 참고 |
| Railway Streamlit template | https://railway.com/deploy/SyDUOJ | Railway에서 Streamlit 실행할 때 필요한 포트/런타임 감각 |
| Railway Streamlit template repo | https://github.com/markgzhou/railway-streamlit | Railway용 최소 Streamlit 앱 구조 참고 |
| Streamlit Financial Dashboard 예시 | https://github.com/hinashussain/Streamlit-Financial-Dashboard | 금융 KPI/차트/표 배치 아이디어만 참고. 실시간 수집 구조는 이 프로젝트에는 맞지 않음 |
| Portfolio analyzer 예시 | https://github.com/kbberendsen/portfolio-analyzer | 보유 비중, 성과 분석 화면 구성 참고 |
| Open Design | https://github.com/nexu-io/open-design | `DESIGN.md`와 디자인 시스템 기반 AI UI 생성 흐름 참고 |
| awesome-design-md | https://github.com/VoltAgent/awesome-design-md | 에이전트가 읽는 디자인 규칙 파일 형식 참고 |

주의: 외부 금융 대시보드 예시는 대부분 실시간 yfinance/외부 API 호출을 UI 안에 넣는다. 이 프로젝트는 `CLAUDE.md` 규칙상 웹 UI가 `output/`만 읽어야 하므로, **화면 구조만 참고하고 데이터 수집 방식은 가져오지 않는다.**

## `docs/UI_GUIDE.md` 보강안

다음 세션 첫 작업으로 `docs/UI_GUIDE.md`를 실제 UI 가이드로 채운다.

포함할 내용:

1. 선택 기술스택
   - Streamlit MVP
   - `output/` 읽기 전용
   - Plotly 우선, 기존 matplotlib PNG가 있으면 재사용 가능

2. 색상 토큰
   - Background: `#F8FAFC`
   - Surface: `#FFFFFF`
   - Text Primary: `#0F172A`
   - Text Secondary: `#64748B`
   - Border: `#E2E8F0`
   - Success: `#16A34A`
   - Danger: `#DC2626`
   - Warning: `#D97706`
   - Info: `#2563EB`

3. KPI 카드 규칙
   - 숫자 우선, 설명 최소화
   - 전월 대비/벤치마크 대비 delta는 색상으로 표시
   - MDD, 규칙 위반 수는 낮을수록 좋은 지표로 처리

4. 표 스타일
   - 숫자는 우측 정렬
   - 비중/수익률은 퍼센트 포맷
   - 위반 행은 danger 배경 또는 badge
   - ETF 코드는 monospace

5. badge 규칙
   - 정상: green
   - 주의: amber
   - 위반: red
   - 데이터 없음: gray

6. 차트 규칙
   - NAV는 기준값 100 정규화
   - drawdown은 음수 영역을 red 계열로 표시
   - 차트마다 데이터 기준일 표기
   - 과도한 3D/애니메이션 금지

7. 반응형 규칙
   - 데스크톱 기준 2열 또는 3열
   - 좁은 화면에서는 KPI와 차트를 세로 스택
   - 표는 가로 스크롤 허용

## `DESIGN.md` 추가 추천

위키의 `design-workflow.md` 기준으로, 이 프로젝트에는 루트 `DESIGN.md`가 필요하다.

목적:
- Codex/Claude가 UI를 만들 때 디자인 방향이 흔들리지 않게 고정
- “금융 내부 운영 도구”라는 톤을 유지
- 외부 레퍼런스를 복제하지 않고 필요한 패턴만 가져오게 함

추천 파일:

```text
DESIGN.md
```

주요 섹션:

```markdown
# DESIGN.md — DBGAPS Dashboard

## Product Character
- Internal financial operations dashboard
- Dense, calm, auditable, data-first

## Visual Theme
- Light financial SaaS
- No marketing hero
- No decorative gradients

## Semantic Colors
...

## Typography
...

## Layout
...

## Components
- KPI strip
- Rule status badge
- Holdings table
- NAV chart
- Drawdown chart
- Report summary block

## Forbidden Patterns
- Do not import from src in web UI
- Do not show AI investment recommendation language
- Do not hide data date
- Do not use decorative card-heavy layout

## Accessibility Checks
- Contrast
- Table readability
- Mobile overflow
```

## 테스트와 하네스 보강

현재 `tests/`에는 `conftest.py`만 있고 실제 `test_*.py`가 없다. UI 만들기 전에 최소 테스트를 추가하는 것이 좋다.

우선순위:

1. 샘플 데이터 기반 계산 smoke test
   - `backtest`
   - `portfolio`
   - `rules`
   - `turnover`

2. import 경계 테스트
   - `pykrx`는 `src/update_prices.py`에만 있어야 한다.
   - 웹 폴더가 생기면 `web/`은 `src/`를 import하면 안 된다.

3. output schema 테스트
   - `portfolio_summary.csv`
   - `current_holdings.csv`
   - `rule_individual_etf.csv`
   - `rule_risk_asset.csv`
   - `turnover_*.csv`

테스트 목적:
- UI 만들기 전에 계산 산출물 계약을 고정
- 대시보드가 읽을 파일 구조를 안정화
- AI 에이전트가 웹 구현 중 계산 엔진 경계를 깨는 실수를 방지

## 금융 도메인 설계 원칙

위키의 `financial-ai-workflow.md` 기준으로 이 프로젝트는 자동매매가 아니라 Advisory / Assisted Ops 단계로 유지한다.

권장:
- 자동 투자 추천보다 리서치/보고/감사 로그 중심
- 사람 승인 없는 실거래 권한 부여 금지
- 데이터 기준일, 계산 과정, 포트폴리오 변경 사유 기록
- “추천”보다 “검증”, “위반”, “요약”, “보고”라는 표현 사용

추가하면 좋은 기능:

1. `run_card.json` 또는 `run_card.md`
   - 백테스트 기간
   - ETF 목록과 비중
   - 벤치마크
   - 리밸런싱 방식
   - 데이터 기준일
   - 주요 결과 지표
   - 규칙 위반 여부

2. 월간보고서 판단 로그
   - 이번 달 수익률
   - 벤치마크 대비 성과
   - 리스크 위반 여부
   - 매매/리밸런싱 사유
   - 다음 점검 항목

3. 데이터 신선도 표시
   - `prices_daily.csv` 최신 날짜
   - 마지막 계산 시간
   - 벤치마크 코드

## 비판적 보완 포인트

현재 노트의 방향은 대체로 맞지만, 다음 리스크를 보완해야 한다.

| 리스크 | 설명 | 보완 |
|---|---|---|
| Streamlit에 계산 로직이 섞일 위험 | 빠르게 만들다 보면 `web/app.py`에서 `src`를 import하기 쉬움 | `tests/test_boundaries.py`로 import 금지 자동 검증 |
| `output/` 산출물 스키마 불안정 | UI가 읽을 CSV 컬럼이 바뀌면 대시보드가 깨짐 | `docs/data_schema.md`와 output schema test 연결 |
| 차트 생성 책임 혼선 | `src/charts.py` PNG 생성 vs Streamlit Plotly 생성이 섞일 수 있음 | MVP에서는 CSV 기반 Plotly, 기존 PNG는 보조로만 사용 |
| 배포 시 데이터 최신성 오해 | Railway에 올린 화면이 최신 가격을 자동 수집한다고 오해 가능 | 상단에 데이터 기준일/마지막 계산 시간 표시 |
| 금융 표현 리스크 | “추천”, “매수/매도 신호”처럼 보이면 대회/운영 목적과 어긋남 | “검증”, “리스크 체크”, “보고서 초안” 중심 문구 사용 |
| 디자인 과장 | AI가 대시보드를 랜딩페이지처럼 만들 수 있음 | `DESIGN.md`에 금지 패턴 명시 |

## 다음 세션 추천 작업 순서

1. `docs/UI_GUIDE.md`를 실제 Streamlit MVP UI 가이드로 작성한다.
2. 루트에 `DESIGN.md`를 추가한다.
3. `tests/test_boundaries.py`를 추가해 `pykrx` import 경계와 웹 import 경계를 검증한다.
4. `tests/test_output_schema.py`를 추가해 `output/` CSV 컬럼 계약을 고정한다.
5. `tests/test_smoke_engine.py`를 추가해 샘플 데이터 기반 계산 smoke test를 만든다.
6. `web/` 폴더를 만들고 Streamlit MVP를 구현한다.
7. `output/` 파일을 읽어 KPI, 차트, 보유현황, 규칙 체크를 표시한다.
8. 가능하면 `run_card` 생성 기능을 phase-3 또는 phase-4에 포함한다.

## 참고할 위키 페이지

- `wiki/harness-engineering.md`
  - docs/CLAUDE/hooks/tests 기반 하네스 원칙
- `wiki/design-workflow.md`
  - DESIGN.md, 디자인 브리프, 대시보드 레퍼런스 흐름
- `wiki/financial-ai-workflow.md`
  - Advisory / Assisted Ops, run_card, 결정 로그, 사람 승인 게이트
- `wiki/data-apis.md`
  - yfinance/API/JSON/Webhook 기반 데이터 연결 기초

## 다음 세션 시작 프롬프트 예시

```text
C:\Users\PC\Desktop\dbgaps_dashboard 프로젝트에서 NEXT_SESSION_NOTES.md를 읽고 이어서 진행해줘.
먼저 Railway와 Streamlit 역할 구분을 유지해서 docs/UI_GUIDE.md와 DESIGN.md를 작성해줘.
그 다음 tests/test_boundaries.py, tests/test_output_schema.py, tests/test_smoke_engine.py를 추가해줘.
웹 대시보드는 Streamlit MVP 방향으로 하되, CLAUDE.md의 src import 금지 규칙을 반드시 지켜줘.
외부 금융 대시보드 예시는 화면 구조만 참고하고, 데이터 수집/계산 로직은 web/에 넣지 마.
```
