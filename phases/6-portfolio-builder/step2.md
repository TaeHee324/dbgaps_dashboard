# Step 2: benchmark-and-compare

## 읽어야 할 파일

- `src/backtest.py` — benchmark_nav 함수
- `web/pages/2_포트폴리오_빌더.py` — step1 산출물
- `web/components.py` — render_comparison_nav_chart 재사용 참고
- `DESIGN.md`, `DESIGN-LANGUAGE.md`, `docs/UI_GUIDE.md`, `design-tokens.json`, `QA_CHECKLIST.md`

## 이전 step 산출물

- step1: `web/pages/2_포트폴리오_빌더.py` (백테스트 + KPI + 차트)

## 작업

포트폴리오 빌더의 NAV 차트에 벤치마크(069500 KODEX 200) 비교선을 추가하고,
완성된 포트폴리오를 `portfolios/` 폴더에 저장하는 기능을 추가한다.

### 기능 명세

1. **벤치마크 비교선**: NAV 차트에 KODEX 200(069500) 점선 추가
   - `benchmark_nav` 함수 호출
   - 벤치마크 데이터 없으면 조용히 생략 (에러 아님)

2. **포트폴리오 저장**: "이 포트폴리오 저장" 버튼
   - 포트폴리오 이름 입력 (`st.text_input`)
   - 클릭 시 `portfolios/{이름}.csv` 에 code, weight 저장
   - 저장 후 성공 메시지 표시
   - 저장 이름이 base/conservative/aggressive이면 덮어쓰기 경고

3. **Alpha / Beta 표시**: KPI strip에 Alpha, Beta 추가 (6개 → 7개)
   - `summarize_backtest`가 이미 반환하는 값 활용

### 파일 수정

- `web/pages/2_포트폴리오_빌더.py` (step1 파일에 추가)

## Acceptance Criteria

```bash
streamlit run web/app.py
# 포트폴리오 빌더 → 백테스트 실행 → NAV 차트에 벤치마크 점선 표시
# Alpha, Beta KPI 표시 확인
# 이름 입력 후 "저장" → portfolios/my_test.csv 생성 확인
# base 이름으로 저장 시도 → 경고 메시지 표시
python -m pytest tests/test_boundaries.py -v
```

## 금지사항

- `pykrx`, `requests` 등 네트워크 요청 코드를 넣지 마라.
- 벤치마크 없을 때 에러 메시지를 표시하지 마라 (조용히 생략).
- 저장된 포트폴리오를 `output/` 폴더에 쓰지 마라 (`portfolios/` 전용).
