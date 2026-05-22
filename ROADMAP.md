# DBGAPS 대시보드 개선 로드맵

최종 업데이트: 2026-05-23

> **새 세션 시작 시 읽어야 할 파일**: 이 파일(ROADMAP.md) → CLAUDE.md → PROJECT_STATUS.md

---

## 현재 구현 완료 상태

- 계산 엔진(`src/`): CAGR, MDD, 샤프, 알파, 베타, 변동성, 회전율, 규칙 체크 완료
- 웹 탭 3개 운영 중: 운용 현황(`0_운용현황.py`), ETF 탐색기(`1_ETF_탐색기.py`), 포트폴리오 빌더(`2_포트폴리오_빌더.py`)
- 데이터: `data/prices_daily.csv` (317,630행, 2015-01-02~2026-05-22, 189개 종목)
- 포트폴리오 3개 저장됨: `base`, `conservative`, `aggressive`
- Railway 배포 완료

---

## 알려진 문제

| 문제 | 원인 | 해결 방법 |
|---|---|---|
| 운용 현황 데이터 기준일이 1월 16일 | `output/backtest_nav.csv`가 1월에 생성된 정적 파일 | `python src/run_engine.py` 재실행으로 갱신 |
| 첫 번째 "APP" 탭이 내용 없음 | `web/app.py`가 사실상 빈 파일 | Phase A에서 홈 페이지로 구현 |

---

## Phase A — 탭 구조 전면 개편

**목표**: 탭 이름·수·내용을 사용자 관점에서 재정의

### 최종 탭 구성

| 번호 | 파일 | 탭명 | 상태 |
|---|---|---|---|
| — | `web/app.py` | **홈** | 구현 필요 |
| 0 | `pages/0_운용현황.py` | **운용 현황** | 기준일 설명 개선 |
| 1 | `pages/1_ETF_포트폴리오.py` | **ETF & 포트폴리오** | 통합 재작성 |
| 2 | `pages/2_포트폴리오_비교.py` | **포트폴리오 비교** | 신규 구현 |
| 3 | `pages/3_매매일지.py` | **매매일지** | 신규 구현 (Phase B) |
| 4 | `pages/4_시황.py` | **시황** | 미구현 배너 |
| 5 | `pages/5_운용보고서.py` | **운용보고서** | 미구현 배너 |

### 기존 파일 처리

- `pages/1_ETF_탐색기.py` → 삭제 (1_ETF_포트폴리오.py로 대체)
- `pages/2_포트폴리오_빌더.py` → 삭제 (1_ETF_포트폴리오.py로 통합)

### 홈(app.py) 구성 요소

1. 운용 KPI 요약 (CAGR, MDD, 샤프 — 숫자 크게)
2. NAV + Drawdown 차트 (2열)
3. 투데이 시황 섹션 (미구현 배너)
4. 운용 전략 개요 (base 포트폴리오 구성 텍스트 요약)

### ETF & 포트폴리오 통합 탭 레이아웃

```
[왼쪽 패널 40%]          [오른쪽 패널 60%]
- ETF 검색/필터           - 선택 ETF 주가 차트
- ETF 리스트 테이블        - 라인 / 캔들 토글 (Phase C)
- "포트폴리오에 추가" 버튼  - 포트폴리오 구성 (비중 입력)
                          - 백테스트 실행 → KPI + 차트
                          - 포트폴리오 저장
```

### 포트폴리오 비교 탭

- `portfolios/` 디렉토리 스캔 → 저장된 포트폴리오 전체 자동 감지
- 각 포트폴리오 백테스트 실행 후 지표 비교 테이블 표시
- 컬럼: 포트폴리오명 | CAGR | MDD | 샤프 | 칼마 | 알파 | 베타 | 누적수익률 | 변동성
- NAV 비교 선 그래프 (여러 포트폴리오 겹쳐서 표시)
- 기간 선택(1년/3년/5년/전체) 공통 적용

---

## Phase B — 매매일지 시스템

**목표**: 매매 기록 저장 + NAV 차트 위에 이벤트 마커 표시

### 데이터 파일: `data/trade_log.json`

```json
[
  {
    "date": "2025-03-15",
    "action": "buy",
    "etf_code": "379810",
    "etf_name": "TIGER 미국나스닥100",
    "weight_before": 0.0,
    "weight_after": 0.15,
    "reason": "나스닥 조정 후 분할매수 진입",
    "note": "연준 피벗 기대감, 기술주 저점 판단"
  }
]
```

### 매매일지 탭 UI

1. **입력 폼** (상단)
   - 날짜 / 매수·매도 선택 / ETF 코드+명 / 비중 변화 전·후 / 이유(필수) / 메모(선택)
   - 저장 → `data/trade_log.json` append

2. **이력 테이블** (하단)
   - 날짜 역순 정렬
   - 행 클릭 → `st.expander`로 이유·메모 전체 표시

### NAV 차트 연동 (운용 현황 + 홈)

- NAV 라인 위에 매매 날짜 수직 점선 + 삼각형 마커 overlay
- 매수: 초록 ▲ / 매도: 빨간 ▼
- 호버 시 "ETF명 · 이유" 툴팁 표시
- `data/trade_log.json`이 없으면 조용히 마커 생략

---

## Phase C — ETF 캔들스틱 차트

**선행 조건**: `prices_daily.csv` 스키마 확장 필요

### 현재 문제

`prices_daily.csv`에 `close`만 있어 캔들 불가. pykrx는 OHLCV 제공 가능.

### 해결

1. `src/update_prices.py` 수정 → OHLCV 수집으로 확장
   - 컬럼: `date, code, open, high, low, close, volume`
2. `python src/update_prices.py` 재실행 → CSV 재수집
3. ETF 탐색기 차트에 **라인 / 캔들** 토글 추가
   - 캔들: `plotly.graph_objects.Candlestick`
   - 라인: 기존 `go.Scatter`

> 이 Phase는 가격 재수집이 전제이므로 다른 Phase와 독립적으로 진행.

---

## Phase D — 지표 확장 (QuantStats 참고)

**목표**: 현재 KPI에 실용적 지표 추가

### 추가할 지표 (`src/metrics.py` 확장)

| 지표 | 설명 | 적용 위치 |
|---|---|---|
| Calmar Ratio | CAGR / abs(MDD) | KPI 스트립, 포트폴리오 비교 |
| Sortino Ratio | 하방 변동성만 분모 | KPI 스트립, 포트폴리오 비교 |
| Max DD Duration | 최대 낙폭 회복 기간(일수) | KPI 스트립 |
| Win Rate (월) | 플러스 수익인 달 비율 | KPI 스트립 |

### 제외 (과도하게 학술적)

VaR, CVaR, Kurtosis, Skew, Ulcer Index — 운용 판단에 직결 안 됨

---

## 작업 우선순위

```
Phase A (탭 구조)
  └─ 1. app.py 홈 구현
  └─ 2. 미구현 탭 3개 (시황, 운용보고서 배너)
  └─ 3. ETF + 포트폴리오 통합 탭
  └─ 4. 포트폴리오 비교 탭

Phase B (매매일지)
  └─ 5. trade_log.json 스키마 + 입력 UI
  └─ 6. NAV 차트 매매 마커 연동

Phase D (지표)
  └─ 7. Calmar, Sortino, MDD Duration, Win Rate 추가

Phase C (캔들 차트)
  └─ 8. update_prices.py OHLCV 확장 + 캔들 토글
```

---

## 삭제 대상 (정리 완료 시 체크)

- [ ] `phases/` 폴더 전체 (Phase 0~6, 이미 완료됨)
- [ ] `PLAN.md` (Phase 5·6 계획, 이미 완료됨 — 이 파일로 대체)

---

## 아키텍처 핵심 규칙 (변경 금지)

1. `web/`은 `src/`를 import 금지 — `output/`만 읽는다
   - 예외: `pages/1_ETF_포트폴리오.py`에서 `src/backtest.py`, `src/metrics.py`, `src/rules.py` import 허용 (실시간 백테스트 불가피)
2. `update_prices.py`에만 pykrx와 네트워크 요청
3. `output/`은 gitignore 대상 — Railway 시작 시 자동 생성
4. `data/trade_log.json`은 Git 추적 대상 (사용자 기록 영구 보존)

---

## 개발 명령어

```bash
python src/update_prices.py        # 가격 데이터 수집 (pykrx)
python src/run_engine.py           # 전체 엔진 실행 → output/ 갱신
streamlit run web/app.py           # 대시보드 로컬 실행
python -m pytest tests/ -q         # 전체 테스트
```
