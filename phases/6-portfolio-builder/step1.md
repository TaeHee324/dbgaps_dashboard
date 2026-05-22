# Step 1: backtest-and-metrics

## 읽어야 할 파일

- `src/backtest.py` — run_backtest, summarize_backtest, load_prices, load_weights
- `src/metrics.py` — monthly_returns
- `web/pages/2_포트폴리오_빌더.py` — step0 산출물, UI 코드
- `web/components.py` — render_kpi_strip, render_nav_chart, render_drawdown_chart 재사용 참고
- `DESIGN.md`, `DESIGN-LANGUAGE.md`, `docs/UI_GUIDE.md`, `design-tokens.json`, `QA_CHECKLIST.md`

## 이전 step 산출물

- step0: `web/pages/2_포트폴리오_빌더.py` (입력 UI)

## 작업

`web/pages/2_포트폴리오_빌더.py`에 백테스트 실행 + 결과 표시 섹션을 추가한다.

### 기능 명세

1. **백테스트 실행**: 버튼 클릭 시
   - `data/prices_daily.csv` 로드 → 선택 기간 슬라이싱
   - 선택된 ETF + 비중으로 `run_backtest` 실행
   - `summarize_backtest` 로 KPI 계산

2. **KPI 표시** (5개, 1행):
   - 누적수익률, CAGR, MDD, 샤프지수, 연간변동성

3. **차트** (2열):
   - 왼쪽: NAV 차트 (포트폴리오 기준 100)
   - 오른쪽: Drawdown 차트

4. **월별 수익률 bar 차트**: `monthly_returns` 함수 결과 시각화

5. **대회 규칙 빠른 체크** (KPI 아래):
   - 개별 ETF 비중이 20% 초과인 항목 강조 (경고)
   - 위험자산 합계 70% 초과 여부 (경고)
   - 이건 UI 경고 표시만 — rules.py 직접 호출 가능

### 성능 주의

- `@st.cache_data(ttl=600)`으로 prices_daily.csv 전체 캐시
- 백테스트는 버튼 클릭 시에만 실행 (자동 재실행 없음)

### 파일 수정

- `web/pages/2_포트폴리오_빌더.py` (step0 파일에 추가)

## Acceptance Criteria

```bash
streamlit run web/app.py
# 포트폴리오 빌더 → ETF 3개 선택, 비중 합계 100% 입력
# 기간 "1년" 선택
# "백테스트 실행" 클릭 → KPI 5개 표시
# NAV 차트 + Drawdown 차트 표시
# 월별 수익률 bar 차트 표시
# 개별 ETF 비중 20% 초과 시 경고 표시
python -m pytest tests/test_boundaries.py -v
# pykrx import 금지 규칙 통과
```

## 금지사항

- `pykrx`, `requests` 등 네트워크 요청 코드를 넣지 마라.
- `output/` 폴더에 아무것도 쓰지 마라 (빌더 결과는 메모리에서만 처리).
- 실시간 자동 재계산(버튼 없이 인터랙션마다 실행)을 구현하지 마라.
- `components.py` 내부를 수정하지 마라 (재사용 또는 인라인 구현).
