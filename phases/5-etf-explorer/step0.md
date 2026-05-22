# Step 0: multipage-structure

## 읽어야 할 파일

- `web/app.py` — 현재 단일 페이지 구조
- `web/components.py` — 렌더링 함수 목록
- `web/data_loader.py` — 로더 함수 목록
- `DESIGN.md`, `DESIGN-LANGUAGE.md`, `docs/UI_GUIDE.md` — 디자인 제약

## 작업

`web/app.py` 기준 단일 페이지 앱을 Streamlit multipage 구조로 전환한다.

### 변경 내용

1. `web/app.py` → 진입점 역할만 유지. sidebar 네비게이션 제거 (Streamlit이 pages/ 자동 감지).
2. `web/pages/` 폴더 생성.
3. 현재 `app.py`의 페이지 본문을 `web/pages/0_운용현황.py`로 이동.
4. `app.py`는 `st.set_page_config`만 설정하거나 비워도 무방.

### 파일 변경 대상

- `web/app.py` 수정 (진입점 최소화)
- `web/pages/0_운용현황.py` 신규 생성

### 구조 결과

```
web/
├── app.py              # set_page_config + 진입점
├── data_loader.py
├── components.py
└── pages/
    ├── 0_운용현황.py   # 기존 app.py 본문 이동
    ├── 1_ETF_탐색기.py # step1에서 추가
    └── 2_포트폴리오_빌더.py  # phase-6에서 추가
```

## Acceptance Criteria

```bash
streamlit run web/app.py
# 왼쪽 사이드바에 페이지 목록(운용현황) 표시
# 0_운용현황 페이지가 기존과 동일하게 표시
# 모든 기존 섹션(KPI, NAV 차트, 회전율, 규칙 badge 등) 정상 표시
python -m pytest tests/test_boundaries.py -v
# 통과 (web/가 src/ import하지 않는 규칙 유지)
```

## 금지사항

- `components.py`, `data_loader.py` 내부를 수정하지 마라. 이동만 한다.
- 기존 운용현황 페이지 레이아웃·순서를 바꾸지 마라.
- 새 페이지 파일을 이 step에서 미리 만들지 마라 (step1, phase-6에서 추가).
