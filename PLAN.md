# DBGAPS 개발 계획

최종 업데이트: 2026-05-22

---

## 현재 상태 한 줄 요약

계산 엔진·테스트·배포 설정은 완료. 대시보드 UI 코드도 완성됐으나,
`output/` 일부 파일이 없어 NAV 차트·월별수익률·포트폴리오 비교 섹션이 비어 있음.
ETF 탐색기와 포트폴리오 빌더(백테스터)는 미구현.

---

## 즉시 실행 — 대시보드 데이터 채우기

**담당**: 단독 실행 가능 (다른 작업과 무관)

```bash
python src/run_engine.py
streamlit run web/app.py
```

### 무엇이 생기나

| 생성 파일 | 효과 |
|---|---|
| `output/backtest_nav.csv` | NAV 차트 + Drawdown 차트 표시 |
| `output/monthly_returns.csv` | 월별 수익률 bar 차트 표시 |
| `output/comparison/summary.csv` | 포트폴리오 비교 표 표시 |
| `output/comparison/*_nav.csv` | 포트폴리오 비교 NAV 차트 표시 |
| `output/report_202605.md` | 월간보고서 섹션 표시 |

### 현재 한계 (대회 시작 전이라 정상)

- `data/trades.csv`가 테스트 데이터(6행)라 보유현황·규칙 체크가 실제와 다름
- 대회 첫날 실제 매수 주문 후 `trades.csv`에 기입하면 해소됨

---

## Phase 5 — ETF 탐색기

**목표**: 188개 ETF 전체 목록 열람 + 개별 주가 차트 (포트폴리오 구성 연구용)

**병렬 가능**: Phase 6과 동시 진행 가능 (공유 파일 없음)

**선행 조건**: Step 0 (multipage 구조 전환)이 먼저 완료되어야 Step 1, 2 진행 가능

```
phases/5-etf-explorer/
├── step0.md  — app.py → pages/ 구조 전환 (선행)
├── step1.md  — ETF 리스트 테이블 (검색/필터)
└── step2.md  — ETF 선택 → 주가 차트 (1M/3M/6M/1Y/전체)
```

### Step별 산출물

| Step | 파일 | 내용 |
|---|---|---|
| 0 | `web/pages/0_운용현황.py` | 기존 app.py 본문 이동 |
| 1 | `web/pages/1_ETF_탐색기.py` | ETF 리스트 테이블 |
| 2 | `web/pages/1_ETF_탐색기.py` 수정 | 주가 차트 섹션 추가 |

### 아키텍처 메모

- `data/etf_master.csv`, `data/prices_daily.csv` 직접 읽기 — CRITICAL-1 위반 아님
- `src/` 모듈 import 없음
- `pykrx` 절대 금지

---

## Phase 6 — 포트폴리오 빌더

**목표**: ETF 직접 선택 + 비중 입력 → 실시간 백테스트 → 지표·차트 시각화

**병렬 가능**: Phase 5와 동시 진행 가능 (공유 파일 없음)

**선행 조건**: Phase 5 Step 0 (multipage 구조)

```
phases/6-portfolio-builder/
├── step0.md  — ETF 선택 + 비중 입력 UI (합계 100% 검증)
├── step1.md  — 백테스트 실행 → KPI + NAV + Drawdown + 월별수익률
└── step2.md  — 벤치마크 비교선 + Alpha/Beta + 포트폴리오 저장
```

### Step별 산출물

| Step | 파일 | 내용 |
|---|---|---|
| 0 | `web/pages/2_포트폴리오_빌더.py` | 입력 UI |
| 1 | `web/pages/2_포트폴리오_빌더.py` 수정 | 백테스트 + 결과 시각화 |
| 2 | `web/pages/2_포트폴리오_빌더.py` 수정 | 벤치마크 비교 + 저장 |

### 아키텍처 예외 (CRITICAL-1 부분 완화)

포트폴리오 빌더는 실시간 백테스트가 핵심이라 `src/backtest.py`와 `src/metrics.py` 직접 import가 불가피하다.

**허용**: `web/pages/2_포트폴리오_빌더.py` 에서 `src/backtest.py`, `src/metrics.py`, `src/rules.py` import

**유지**: CRITICAL-2 (`pykrx`, 네트워크 요청 금지)는 이 예외에서도 엄격히 유지

`tests/test_boundaries.py`는 pykrx 금지 기준으로 업데이트 필요 (src/ import 금지 조건은 포트폴리오 빌더 페이지에 대해서만 예외 처리).

---

## 병렬 실행 구조

```
[즉시] python src/run_engine.py          ─── 독립 실행 가능
         │
         └─ 대시보드에 데이터 채워짐

[선행] Phase 5 Step 0: multipage 구조 전환
         │
         ├── [병렬 A] Phase 5 Step 1 → Step 2
         │           ETF 탐색기 리스트 → 차트
         │
         └── [병렬 B] Phase 6 Step 0 → Step 1 → Step 2
                     포트폴리오 빌더 입력 → 백테스트 → 벤치마크
```

두 에이전트가 Phase 5 Step 1~2와 Phase 6 Step 0~2를 동시에 작업 가능.
단, 두 브랜치 모두 Phase 5 Step 0이 먼저 머지되어야 한다.

---

## 이후 선택적 작업

| 항목 | 설명 | 우선순위 |
|---|---|---|
| `src/charts.py` 구현 | 정적 PNG 출력 (월간보고서 첨부용) | 낮음 |
| `update_prices.py` 자동화 | GitHub Actions 또는 Railway 스케줄러 | 중간 |
| 대회 규칙 위반 해소 | trades.csv 실제 데이터 기반으로 포트폴리오 재검토 | 대회 시작 후 |
| `backtest_nav.csv`에 벤치마크 컬럼 추가 | 운용현황 페이지 NAV 차트에 벤치마크 선 표시 | 낮음 |

---

## 완료 기준 (대회 준비)

- [ ] `run_engine.py` 실행 → 대시보드 전 섹션 표시
- [ ] ETF 탐색기 — 188개 ETF 검색·필터·차트 동작
- [ ] 포트폴리오 빌더 — 비중 입력 후 백테스트 결과 표시
- [ ] 대회 첫날 매수 주문 → `trades.csv` 기입 → `run_engine.py` 재실행 → 현황 반영
