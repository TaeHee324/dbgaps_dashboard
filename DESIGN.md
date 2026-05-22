# DESIGN.md — DBGAPS Dashboard

## 1. Product Character

내부 금융 운영 도구. 외부 공개 마케팅 페이지가 아니다.

- **Dense**: 한 화면에 KPI·포지션·규칙 상태를 동시에 표시
- **Calm**: 경보가 아닌 정보. 색상은 의미를 전달할 때만 사용
- **Auditable**: 모든 수치에 기준일·데이터 소스 표시 필수
- **Data-first**: 비주얼 장식보다 수치 가독성 우선

## 2. Visual Theme

Light financial SaaS. 다음 패턴은 사용하지 않는다.

- 마케팅용 히어로 섹션
- 장식용 그라디언트 카드
- 애니메이션 배너·스피너 (로딩 제외)
- 아이콘 중심 레이아웃

## 3. Semantic Colors

| 역할 | Hex | 사용처 |
|------|-----|--------|
| Background | `#F8FAFC` | 페이지 배경 |
| Surface | `#FFFFFF` | 카드·테이블 배경 |
| Border | `#E2E8F0` | 구분선 |
| Text Primary | `#0F172A` | 제목·수치 |
| Text Secondary | `#64748B` | 레이블·주석 |
| Success | `#16A34A` | 규칙 통과, 양의 수익 |
| Warning | `#D97706` | 경계치 근접 (80% 이상) |
| Danger | `#DC2626` | 규칙 위반, 음의 수익 |
| Neutral | `#94A3B8` | 비활성 상태 |

## 4. Typography

- **숫자**: 오른쪽 정렬, `font-variant-numeric: tabular-nums`
- **ETF 코드** (예: `069500`): `font-family: monospace`
- **퍼센트**: `+12.34 %` 형식 (부호 명시, 소수점 2자리, 공백 후 %)
- **금액**: `₩1,234,567` 형식 (천 단위 콤마, 원화 기호)
- **날짜**: `YYYY-MM-DD` 고정 (로케일 의존 없음)

## 5. Layout

- **데스크톱** (`≥ 1024px`): 2–3열 그리드
  - 좌: KPI strip + 규칙 상태
  - 중·우: 차트·테이블
- **태블릿** (`768px–1023px`): 2열
- **모바일** (`< 768px`): 단일 열 세로 스택
- **표**: 컨테이너 너비 초과 시 가로 스크롤 허용 (`overflow-x: auto`), 헤더 고정

## 6. Components

### KPI Strip
- 1행, 4–6개 지표 (NAV, CAGR, MDD, 샤프, Alpha, 회전율)
- 각 셀: 레이블(상단 소문자) + 수치(하단 굵게) + 기준일(우하단 회색)
- 배경 `Surface`, 테두리 `Border`

### Rule Status Badge
- 텍스트 뱃지: `통과` (Success) / `경고` (Warning) / `위반` (Danger)
- 배경은 색상 10% 투명도, 텍스트는 색상 100%
- 규칙명·현재값·한도값을 뱃지 옆에 표시

### Holdings Table
컬럼: ETF 코드 | ETF명 | 수량 | 평균단가 | 현재가 | 평가금액 | 비중(%) | 미실현손익(%)

- 코드 컬럼: monospace
- 숫자 컬럼: 우측 정렬
- 미실현손익: Success/Danger 색 적용

### NAV Chart
- 단순 선 그래프 (포트폴리오 vs 벤치마크)
- X축: 날짜, Y축: 누적 수익률(%)
- 기준일·벤치마크 종목 코드 차트 하단 캡션 필수
- 범례: 포트폴리오(진파랑) / 벤치마크(회색)

### Drawdown Chart
- 영역 그래프, MDD 수평선 표시
- Y축: 음수(%) 형식
- 데이터 없는 구간은 표시하지 않음 (공백 처리)

## 7. Forbidden Patterns

다음은 코드 리뷰에서 반드시 차단한다.

| 금지 패턴 | 이유 |
|-----------|------|
| `web/`에서 `src/` import | 계산 엔진·UI 분리 필수 (CLAUDE.md CRITICAL-1) |
| `web/`에서 `pykrx` import | 네트워크 의존성 UI 진입 금지 (CLAUDE.md CRITICAL-2) |
| "AI 추천", "매수 신호", "매도 신호" | 자동투자 조언 문구 — 법적·운영 리스크 |
| 데이터 기준일 숨김 | 모든 수치는 기준일 표시 필수 |
| 랜딩페이지 히어로 섹션 | 내부 도구에 마케팅 UI 불필요 |
| 장식용 그라디언트 카드 | 의미 없는 시각 노이즈 |

## 8. Accessibility

- **색 대비**: WCAG AA 이상 (텍스트 4.5:1, 대형 텍스트 3:1)
- **색 단독 의존 금지**: Success/Danger 구분은 색 + 텍스트(통과/위반) 병행
- **표 접근성**: `<th scope="col/row">` 마크업, 정렬 방향 명시
- **모바일 오버플로우**: 테이블 컨테이너에 `overflow-x: auto` 적용, 수평 스크롤바 표시
- **폰트 크기**: 최소 `14px` (차트 레이블 포함)
