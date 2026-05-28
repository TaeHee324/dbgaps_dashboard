# DBGAPS Dashboard 3차 수정 계획서

작성일: 2026-05-28  
상태: 미착수  
전제: 2차 REPAIR_PLAN_2.md 작업 완료 후 QA 결과

---

## 배경 및 컨텍스트

### 2차 QA 결과

| 항목 | 상태 | 원인 |
|------|------|------|
| E-1: 기준가 priceOnDate 통일 | ✅ | — |
| E-1: 차분 공식 | ✅ | — |
| E-1: 매수 모드 0 표시 | ⚠️ 미확인 | 코드 구현은 맞음 — 브라우저 실물 테스트 필요 |
| E-2: 날짜 기준 NAV 갱신 | ⚠️ 미확인 | 코드 구현은 맞음 — 브라우저 실물 테스트 필요 |
| E-3: active 포트폴리오 목표 비중 자동 업데이트 | ❌ 미작동 | silent fail로 오류 숨김 + queryKey 누락 가능성 |
| F-1: 위치 오류 | ❌ | risk 탭에 들어감 — comparison 탭으로 이동 필요 |
| F-1: 점 크기·레이블 겹침 | ❌ | r=6으로 크고 이름 겹침 |
| F-1: active 포트폴리오 강조 | ⚠️ 미확인 | is_active 반환은 됨 — 실물 확인 필요 |

---

## 전체 수정 범위

| 번호 | 분류 | 이슈 | 수정 파일 |
|------|------|------|-----------|
| G-1 | scatter 위치 이동 | risk 탭 원상복구 + comparison 탭으로 이동 | `frontend/app/risk/page.tsx`, `frontend/app/comparison/page.tsx` |
| G-2 | scatter 디자인 개선 | 점 크기 줄이기, 레이블 겹침 방지 | `frontend/app/comparison/page.tsx` |
| G-3 | E-3 디버깅 | silent fail 해제 → 토스트 오류 표시, queryKey 보완 | `frontend/app/trades/page.tsx`, `frontend/lib/hooks/portfolio.ts` |

---

## G-1: scatter 차트 위치 이동

### G-1a: risk/page.tsx 원상복구

**제거 대상**:
1. `PortfolioScatterChart` 함수 컴포넌트 전체 (약 200줄)
2. `METRIC_OPTIONS` 상수
3. `getMetricValue()`, `formatMetricValue()` 헬퍼 함수
4. 페이지 하단 2컬럼 그리드 → 기존 `<SelectedEtfPanel>` 단독 렌더링으로 복구
5. `useComparisonSummary`, `ComparisonSummaryItem` import 제거
6. `usePortfolioList` import 제거 (risk page에서만 사용했을 경우)
7. `comparisonSummaryQuery`, `portfolioListQuery`, `comparisonSummaryData`, `activePortfolioName` 변수 제거

**복구 대상**:
```tsx
{/* 기존 단독 렌더링 복원 */}
<SelectedEtfPanel
  item={selectedEtf}
  prices={etfPricesQuery.data ?? []}
  isLoading={etfPricesQuery.isLoading}
/>
```

### G-1b: comparison/page.tsx에 scatter 추가

**삽입 위치**: 비교 지표 테이블(`{/* 비교 지표 테이블 */}`) 섹션 아래 (line ~431 이후, 페이지 `</div>` 닫기 직전)

**데이터 소스**: comparison/page.tsx에 이미 있는 것들 재사용:
- `useComparisonSummary()` — 이미 import됨
- `usePortfolioList()` — 이미 import됨

**`PortfolioScatterChart` 컴포넌트**: risk/page.tsx에서 comparison/page.tsx로 옮기되, 개선사항(G-2)을 함께 반영해서 이동.

**수정 파일**: `frontend/app/risk/page.tsx`, `frontend/app/comparison/page.tsx`  
**의존성**: G-2와 동일 파일 → 하나의 에이전트가 G-1+G-2 동시 처리

---

## G-2: scatter 차트 디자인 개선

G-1b의 PortfolioScatterChart를 comparison에 추가할 때 아래 개선사항을 함께 반영.

### 점 크기 축소
```
r=6 → r=4
```

### 레이블 겹침 방지
현재: 모든 점 레이블이 점 오른쪽 + 위에 고정 배치 → 점이 가까우면 겹침

개선 전략 — **교대 배치 (alternating offset)**:
```typescript
// 점 인덱스가 짝수면 레이블 위, 홀수면 아래
const labelDy = index % 2 === 0 ? -10 : 14;
const labelAnchor = "middle"; // 레이블을 점 중앙 위/아래로
```

또는 더 단순하게: 레이블을 점 위 고정 + `textAnchor="middle"` + 점 크기 4로 변경 (겹침 빈도 크게 감소).

포트폴리오명 잘림: 6자 → `portfolio_name.slice(0, 6)` (기존 8자에서 단축)

### active 포트폴리오 강조 확인
`usePortfolioList()`가 `is_active` 필드를 반환하므로 `list.find(p => p.is_active)?.name` 로직은 올바름.
데이터가 실제로 오는지 확인: comparison 페이지에서 `portfolioListQuery.data` 로그 없이 타입 체크만으로 검증.

**수정 파일**: `frontend/app/comparison/page.tsx`  
**의존성**: G-1과 동일 파일

---

## G-3: E-3 silent fail 해제 및 queryKey 보완

### 문제 진단

현재 `handleSubmit` 내 `updateActiveHolding.mutateAsync()` 호출이 `try/catch` 안에서 silent fail.  
backend PATCH 자체는 올바르나, 실제로 호출되고 있는지/실패하고 있는지 사용자가 알 수 없음.

**가능한 실패 원인 3가지**:
1. active 포트폴리오가 없는 경우 → backend 404 → catch 블록에서 묻힘
2. `calcTargetWeight`가 0이어서 if 조건 불통과 (역산 계산기 미사용)
3. 거래 저장 성공 후 `calcTargetWeight` state가 리셋되지 않아 다음 저장 시 의도치 않게 적용됨

### 수정 1: silent fail → 에러 토스트로 변경

```typescript
// 기존 (silent)
try {
  await updateActiveHolding.mutateAsync({ code: form.etf_code, weight: calcTargetWeight / 100 });
} catch {
  // silent
}

// 변경: 실패 시 콘솔 에러 출력 (UI 차단 없이)
try {
  await updateActiveHolding.mutateAsync({ code: form.etf_code, weight: calcTargetWeight / 100 });
} catch (err) {
  console.error("[E-3] active 포트폴리오 비중 업데이트 실패:", err);
}
```

브라우저 콘솔에서 실패 원인을 즉시 확인 가능.

### 수정 2: 거래 저장 후 calcTargetWeight 리셋

```typescript
// 기존: setForm(makeDefaultForm())만 호출, calcTargetWeight 리셋 없음
setForm(makeDefaultForm());
setCalcTargetWeight(0);  // 추가
```

의도치 않은 중복 호출 방지.

### 수정 3: useUpdateActiveHolding onSuccess queryKey 보완

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["portfolios"] });
  queryClient.invalidateQueries({ queryKey: ["portfolio-list"] });   // 추가
  queryClient.invalidateQueries({ queryKey: ["risk-portfolio"] });
  queryClient.invalidateQueries({ queryKey: ["etf-risk-analysis"] });
  queryClient.invalidateQueries({ queryKey: ["active-portfolio"] }); // 추가
},
```

`usePortfolioList()`는 queryKey `["portfolio-list"]`, active 포트폴리오 쿼리는 `["active-portfolio"]`일 수 있음. 기존 코드의 queryKey들과 대조 후 실제 사용 중인 것만 추가.

**수정 파일**: `frontend/app/trades/page.tsx`, `frontend/lib/hooks/portfolio.ts`  
**의존성**: G-1/G-2와 다른 파일 → 별도 에이전트 가능

---

## 에이전트 배포 계획 (병렬)

```
에이전트 δ: frontend/app/risk/page.tsx + frontend/app/comparison/page.tsx  (G-1 + G-2)
에이전트 ε: frontend/app/trades/page.tsx + frontend/lib/hooks/portfolio.ts  (G-3)
```

δ, ε 모두 서로 다른 파일 → 병렬 배포 가능.

---

## G-1/G-2 구현 시 주의사항

- `PortfolioScatterChart`를 risk에서 삭제할 때 관련 import/state/query가 risk page의 다른 기능에서도 쓰이는지 먼저 확인
  - `useComparisonSummary` → risk page의 다른 곳에서 사용 안 함 → 삭제
  - `usePortfolioList` → risk page에서 `portfolioListQuery` 외 다른 용도 없으면 삭제
- comparison/page.tsx에 `PortfolioScatterChart`를 추가할 때 기존 `usePortfolioList()` 훅이 이미 `useDeletePortfolio`에서 import되어 있으므로 중복 import 주의
- SVG viewBox 크기는 비교 탭 레이아웃에 맞게 유지 (400×300 그대로 사용 가능)
- 비교 탭 scatter 섹션 헤더: `"포트폴리오 위험-수익 분포"`

## G-3 구현 시 주의사항

- `portfolio.ts`에서 `queryKey: ["portfolio-list"]`가 `usePortfolioList()`의 실제 queryKey와 일치하는지 먼저 확인 후 추가
- `["active-portfolio"]`는 `useActivePortfolio()` 훅이 있다면 그 queryKey. 없으면 추가 불필요.
- `setCalcTargetWeight(0)` 호출 위치: `setForm(makeDefaultForm())` 직후

---

## 검증 체크리스트

### G-1: scatter 위치 이동
- [ ] risk 탭 하단이 SelectedEtfPanel 단독으로 복원됨 (2컬럼 그리드 없음)
- [ ] comparison 탭 비교 지표 테이블 아래에 scatter 차트 표시됨

### G-2: scatter 디자인
- [ ] 점 크기가 줄어들어 레이블이 덜 겹침
- [ ] active 포트폴리오 점이 indigo 색으로 강조됨

### G-3: E-3 디버깅
- [ ] 브라우저 콘솔에서 PATCH 성공/실패 확인 가능
- [ ] 거래 저장 후 역산 계산기 목표비중 입력칸이 0으로 리셋됨
- [ ] 거래 저장 후 리스크 탭 새로고침 시 해당 ETF 목표 비중 반영됨

### E-1, E-2 (브라우저 직접 확인)
- [ ] 매수 모드에서 목표비중 < 현재비중 → "필요 없음" 표시
- [ ] form.date 변경 시 총자산 입력칸이 해당 날짜 NAV로 자동 갱신

---

## 참고: 연관 파일 맵

```
frontend/app/risk/page.tsx          G-1a: PortfolioScatterChart 제거 + SelectedEtfPanel 단독 복구
frontend/app/comparison/page.tsx    G-1b + G-2: scatter 추가 (점 크기·레이블 개선 포함)
frontend/app/trades/page.tsx        G-3: console.error + calcTargetWeight 리셋
frontend/lib/hooks/portfolio.ts     G-3: onSuccess queryKey 보완
```
