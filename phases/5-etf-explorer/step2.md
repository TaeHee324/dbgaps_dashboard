# Step 2: etf-price-chart

## 읽어야 할 파일

- `data/prices_daily.csv` — 컬럼: date, code, close (317,630행, 188 종목, 2015~2026)
- `data/etf_master.csv` — ETF명 조인용
- `web/pages/1_ETF_탐색기.py` — step1 산출물, 기존 코드에 차트 섹션 추가
- `web/components.py` — render_nav_chart 스타일 참고
- `DESIGN.md`, `DESIGN-LANGUAGE.md`, `docs/UI_GUIDE.md`, `design-tokens.json`, `QA_CHECKLIST.md`

## 이전 step 산출물

- step1: `web/pages/1_ETF_탐색기.py` (ETF 리스트 테이블)

## 작업

`web/pages/1_ETF_탐색기.py`에 ETF 개별 주가 차트 섹션을 추가한다.

### 기능 명세

1. **ETF 선택**: 리스트 테이블에서 selectbox로 ETF 코드 선택
2. **기간 선택**: radio 또는 segmented control — `1M` / `3M` / `6M` / `1Y` / `전체`
3. **주가 차트**: 선택한 ETF의 종가 시계열 (Plotly Scatter, 선형)
   - x축: 날짜, y축: 종가(원)
   - 차트 타이틀: `{ETF명} ({코드})`
4. **요약 지표** (차트 아래 1행):
   - 기간 수익률, 기간 중 최고가, 최저가, 현재가

### 성능 주의

- `prices_daily.csv` 전체(317,630행)를 매 인터랙션마다 읽지 말 것
- `@st.cache_data(ttl=600)` 로 전체 로드 후 메모리에서 필터링

### 파일 수정

- `web/pages/1_ETF_탐색기.py` (step1 파일에 추가)

## Acceptance Criteria

```bash
streamlit run web/app.py
# ETF 탐색기 → 테이블에서 "360750" (TIGER 미국S&P500) 선택
# 기간 "1Y" 선택 → 2025-05 ~ 2026-05 주가 차트 표시
# 기간 "전체" 선택 → 2015-01 ~ 2026-05 전체 차트 표시
# 기간 수익률, 현재가 수치 표시 확인
python -m pytest tests/test_boundaries.py -v
```

## 금지사항

- `src/` 모듈을 import하지 마라.
- `pykrx`, `requests` 등 네트워크 요청 코드를 넣지 마라.
- 가격 데이터를 매번 전체 재로드하지 마라 (캐시 필수).
- 벤치마크 비교선을 이 step에서 추가하지 마라 (scope 밖).
