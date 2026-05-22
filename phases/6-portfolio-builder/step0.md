# Step 0: etf-selector-and-weights

## 읽어야 할 파일

- `data/etf_master.csv` — ETF 목록 (code, name, asset_class, risk_type)
- `data/prices_daily.csv` — 기간 범위 확인용
- `src/backtest.py` — load_weights, run_backtest 시그니처 확인
- `src/metrics.py` — 반환 키 확인
- `portfolios/base.csv` — 기본값 예시
- `DESIGN.md`, `DESIGN-LANGUAGE.md`, `docs/UI_GUIDE.md`, `design-tokens.json`, `QA_CHECKLIST.md`

## 이전 step 산출물

- phase-5 step0: `web/pages/` multipage 구조

## 작업

`web/pages/2_포트폴리오_빌더.py`를 신규 생성한다.

이 step에서는 **입력 UI만** 구현한다. 계산은 step1에서 추가.

### 기능 명세

1. **ETF 선택**: `st.multiselect` — ETF명(코드) 형태로 표시, 최대 10개
2. **비중 입력**: 선택한 ETF별 `st.number_input` (0~100, 소수점 1자리)
   - 실시간 합계 표시: `현재 합계: XX.X% / 100%`
   - 합계 != 100% 이면 경고 표시, 백테스트 버튼 비활성화
3. **기간 선택**: selectbox — `1년` / `3년` / `5년` / `전체`
4. **백테스트 실행 버튼**: `st.button("백테스트 실행")` — 합계 100%일 때만 활성

### 데이터 읽기

- `data/etf_master.csv` 직접 읽기 (CRITICAL-1 위반 아님)
- `src/backtest.py`, `src/metrics.py` import — CRITICAL-1 예외 (계산 없이 동작 불가, CRITICAL-2는 유지)

### 파일 생성

- `web/pages/2_포트폴리오_빌더.py`

## Acceptance Criteria

```bash
streamlit run web/app.py
# 사이드바에 "포트폴리오 빌더" 페이지 표시
# ETF 멀티셀렉트에서 3개 선택
# 비중 입력 후 합계 100% → 백테스트 버튼 활성화
# 비중 합계 != 100% → 경고 메시지 + 버튼 비활성화
python -m pytest tests/test_boundaries.py -v
# web/이 pykrx import하지 않는 규칙만 유지 (src/ import 예외 허용)
```

## 금지사항

- `pykrx`, `requests` 등 네트워크 요청 코드를 넣지 마라.
- 이 step에서 백테스트 계산 코드를 작성하지 마라 (step1 담당).
- ETF를 10개 초과 선택하도록 허용하지 마라.
- 화려한 카드 UI, 그래디언트, hero 레이아웃을 추가하지 마라.
