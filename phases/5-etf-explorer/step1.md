# Step 1: etf-list-table

## 읽어야 할 파일

- `data/etf_master.csv` — 컬럼: raw_ticker, code, name, aum_억원, benchmark, risk_type, asset_class
- `web/pages/0_운용현황.py` — 참고용 (동일 스타일 유지)
- `web/components.py` — 기존 컴포넌트 스타일 확인
- `DESIGN.md`, `DESIGN-LANGUAGE.md`, `docs/UI_GUIDE.md`, `design-tokens.json`, `QA_CHECKLIST.md`

## 이전 step 산출물

- step0: `web/pages/` 구조, `web/pages/0_운용현황.py`

## 작업

`web/pages/1_ETF_탐색기.py`를 신규 생성한다.

### 기능 명세

1. **검색바**: ETF명 또는 코드로 실시간 필터링 (`st.text_input`)
2. **필터**:
   - 자산군 (`asset_class`) 멀티셀렉트
   - 위험구분 (`risk_type`) — 위험 / 안전
3. **ETF 리스트 테이블**: 필터링 결과를 `st.dataframe`으로 표시
   - 표시 컬럼: 코드, ETF명, 자산군, 위험구분, AUM(억원), 벤치마크
   - AUM 기준 내림차순 정렬 (기본값)
4. **선택**: 테이블에서 ETF 하나 선택 → step2 차트 섹션으로 전달

### 데이터 읽기 규칙

- `data/etf_master.csv` 직접 읽기 — `output/` 파일 없음, CRITICAL-1 위반 아님
- `src/` 모듈 import 금지

### 파일 생성

- `web/pages/1_ETF_탐색기.py`

## Acceptance Criteria

```bash
streamlit run web/app.py
# 사이드바에 "ETF 탐색기" 페이지 표시
# 검색창에 "나스닥" 입력 → 나스닥 관련 ETF만 필터링
# 자산군 필터 "해외주식_지수" 선택 → 해당 ETF만 표시
# AUM 내림차순 정렬 확인
python -m pytest tests/test_boundaries.py -v
```

## 금지사항

- `src/` 모듈을 import하지 마라.
- `pykrx`, `requests` 등 네트워크 요청 코드를 넣지 마라.
- `output/` 폴더에 의존하지 마라 (data/ 직접 읽기).
- 화려한 카드 UI, 그래디언트, hero 레이아웃을 추가하지 마라.
