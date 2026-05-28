# DBGAPS Dashboard 4차 수정 계획서

작성일: 2026-05-28  
상태: 미착수  
전제: 3차 REPAIR_PLAN_3.md 작업 완료

---

## 배경 및 컨텍스트

### 3차 QA 결과

| 항목 | 상태 | 원인 |
|------|------|------|
| F-1: scatter 위치 (비교 탭) | ❌ | 비교 지표 테이블 아래 단독으로 들어감 — NAV 차트와 2컬럼으로 나란히 배치해야 함 |
| E-3: active 포트폴리오 목표 비중 자동 업데이트 | ❌ | **근본 원인: HTTP 메서드 불일치** + 발동 조건 제한 |

---

## 문제 상세 분석

### H-1: comparison 탭 레이아웃 오류

**원하는 구조** (스크린샷 기준):
```
기간 필터 (1M 3M 6M 1Y 전체)

NAV 비교 (누적수익률)              NAV | Drawdown 토글
┌────────────────────────────────┬──────────────────────┐
│  체크박스 목록                   │  PortfolioScatter     │
│  ComparisonChart               │  Chart               │
│  * 주석                         │                      │
└────────────────────────────────┴──────────────────────┘

비교 지표 테이블 (full width)
```

**현재 구조** (comparison/page.tsx):
- L599-653: `<section className="space-y-3">` — NAV 차트 섹션 (full width)
- L655-841: `<section>` — 비교 지표 테이블 (full width)
- L843-847: `<PortfolioScatterChart>` — **맨 아래 단독 (잘못된 위치)**

**변경 내용**:
- `<section className="space-y-3">` 내부에서 헤더(제목+토글) 아래에 `<div className="grid grid-cols-2 gap-6">` 추가
- 왼쪽 열: 체크박스 + ComparisonChart + 주석
- 오른쪽 열: `<PortfolioScatterChart>`
- L843-847의 단독 `<PortfolioScatterChart>` 블록 제거

---

### H-2: E-3 미작동 — 근본 원인: HTTP 메서드 불일치 (버그)

#### 원인 1 (치명적): `lib/api.ts`에 `patch()` 함수 없음

`frontend/lib/api.ts` 에는 `get`, `post`, `put`, `del` 만 존재. `patch` 없음.

`useUpdateActiveHolding` (portfolio.ts L114):
```typescript
mutationFn: ({ code, weight }) =>
  post(`/api/portfolios/active/holdings`, { code, weight }),  // ← HTTP POST
```

백엔드 (portfolios.py L100):
```python
@router.patch("/portfolios/active/holdings", ...)  # ← HTTP PATCH 기대
```

**결과**: 프론트엔드가 POST로 보내면 FastAPI는 405 Method Not Allowed 반환 → `catch` 블록에서 묻힘 → E-3 항상 실패.

#### 원인 2: 발동 조건 과도하게 제한됨

기존 조건: `calcTargetWeight > 0` (역산 계산기에 값 입력한 경우만)  
사용자가 역산 계산기를 쓰지 않으면 `calcTargetWeight === 0` → PATCH 미호출.

**개선**: 백엔드가 거래 저장 시 `weight_after`를 자동 계산해 반환(`TradeLogEntry.weight_after: number`, 0.0~1.0 소수)하므로, 이 값도 활용.

---

## 전체 수정 범위

| 번호 | 분류 | 수정 파일 |
|------|------|-----------|
| H-1 | comparison 탭 레이아웃 — NAV 차트와 scatter 2컬럼 | `frontend/app/comparison/page.tsx` |
| H-2a | E-3 버그 수정 — `patch()` 함수 추가 | `frontend/lib/api.ts` |
| H-2b | E-3 버그 수정 — `post` → `patch` 교체 | `frontend/lib/hooks/portfolio.ts` |
| H-2c | E-3 발동 조건 확장 — `weight_after` 기반 | `frontend/app/trades/page.tsx` |

---

## H-1: comparison 탭 2컬럼 레이아웃

### 현재 → 변경 후 JSX 구조

**현재** (L599-653, L843-847):
```tsx
{/* NAV 비교 차트 */}
<section className="space-y-3">
  <div className="flex items-center justify-between">  {/* 헤더 */}
    <h2>NAV 비교 (누적수익률)</h2>
    <div>NAV | Drawdown 토글</div>
  </div>
  {/* 체크박스 */}
  <ComparisonChart ... />
  <p>* 주석</p>
</section>
{/* 비교 지표 테이블 */}
<section>...</section>
<PortfolioScatterChart ... />   ← 여기서 제거
```

**변경 후**:
```tsx
{/* NAV 비교 차트 */}
<section className="space-y-3">
  <div className="flex items-center justify-between">  {/* 헤더 — 그대로 유지 */}
    <h2>NAV 비교 (누적수익률)</h2>
    <div>NAV | Drawdown 토글</div>
  </div>
  <div className="grid grid-cols-2 gap-6">           {/* 2컬럼 그리드 신규 추가 */}
    <div className="space-y-2">                       {/* 왼쪽: NAV 차트 */}
      {/* 체크박스 */}
      <ComparisonChart ... />
      <p>* 주석</p>
    </div>
    <PortfolioScatterChart ... />                    {/* 오른쪽: scatter (위치 이동) */}
  </div>
</section>
{/* 비교 지표 테이블 */}
<section>...</section>
{/* ← 기존 단독 <PortfolioScatterChart> 블록 삭제 */}
```

**변경 범위**: `<section className="space-y-3">` 내부 구조만 수정 + L843-847 제거.  
`PortfolioScatterChart` 컴포넌트 코드 자체는 변경 없음.

**수정 파일**: `frontend/app/comparison/page.tsx`

---

## H-2a: `lib/api.ts` — `patch()` 함수 추가

```typescript
export async function patch<T>(path: string, body: unknown): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${normalizedPath} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
```

`post()` (L14-23) 바로 아래에 삽입. `get`, `post`, `patch`, `del`, `put` 순서.

**수정 파일**: `frontend/lib/api.ts`

---

## H-2b: `portfolio.ts` — `post` → `patch` 교체

**현재**:
```typescript
import { usePortfolioList, useBacktest, useUpsertPortfolio, useDeletePortfolio, useActivatePortfolio, useUpdateActiveHolding } from "@/lib/hooks/portfolio";
// 또는 내부 import:
import { del, post, put } from "@/lib/api";
```

**변경**:
```typescript
import { del, patch, post, put } from "@/lib/api";
```

**`useUpdateActiveHolding` mutationFn 수정**:
```typescript
// 변경 전
mutationFn: ({ code, weight }: { code: string; weight: number }) =>
  post(`/api/portfolios/active/holdings`, { code, weight }),

// 변경 후
mutationFn: ({ code, weight }: { code: string; weight: number }) =>
  patch<{ updated: string; weight: number }>(`/api/portfolios/active/holdings`, { code, weight }),
```

**수정 파일**: `frontend/lib/hooks/portfolio.ts`

---

## H-2c: `trades/page.tsx` — `weight_after` 기반 조건 확장

### 현재 handleSubmit (L213-246):
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const payload = { ...form, weight_before: form.weight_before / 100, weight_after: form.weight_after / 100 };
  if (editId !== null) {
    await updateTrade.mutateAsync({ id: editId, data: payload });
  } else {
    await addTrade.mutateAsync(payload);
  }
  // 기존 조건: calcTargetWeight > 0만 발동
  if (calcTargetWeight > 0 && form.etf_code) { ... }
  setCalcTargetWeight(0);
  ...
}
```

### 변경 후:
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const payload = { ...form, weight_before: form.weight_before / 100, weight_after: form.weight_after / 100 };

  // 반환값 수신 (TradeLogEntry — weight_after: 0.0~1.0 소수 포함)
  let savedTrade: TradeLogEntry;
  if (editId !== null) {
    savedTrade = await updateTrade.mutateAsync({ id: editId, data: payload });
  } else {
    savedTrade = await addTrade.mutateAsync(payload);
  }

  // active 포트폴리오 목표 비중 업데이트
  // 역산 계산기 사용 시 calcTargetWeight 우선, 없으면 백엔드 계산 weight_after 사용
  const weightToApply =
    calcTargetWeight > 0
      ? calcTargetWeight / 100          // % → 소수 변환 필요
      : savedTrade.weight_after > 0
      ? savedTrade.weight_after         // 이미 0.0~1.0 소수 — 변환 불필요
      : null;

  if (weightToApply !== null && form.etf_code) {
    try {
      await updateActiveHolding.mutateAsync({
        code: form.etf_code,
        weight: weightToApply,
      });
    } catch (err) {
      console.error("[E-3] active 포트폴리오 비중 업데이트 실패:", err);
    }
  }

  setForm(makeDefaultForm());
  setCalcTargetWeight(0);
  setEditId(null);
  ...
}
```

**타입 안전성**:
- `TradeLogEntry`는 이미 L5에서 `type TradeLogEntry`로 import됨 — 추가 import 불필요
- TypeScript는 if/else 양 분기 모두 `savedTrade`를 할당하므로 definite assignment 오류 없음
- `weight_after`는 `number` 타입 (0.0~1.0) — `/ 100` 변환 불필요

**수정 파일**: `frontend/app/trades/page.tsx`

---

## 에이전트 배포 계획 (병렬)

```
에이전트 ζ: frontend/app/comparison/page.tsx                (H-1 레이아웃)
에이전트 η: frontend/lib/api.ts
            frontend/lib/hooks/portfolio.ts
            frontend/app/trades/page.tsx                    (H-2a + H-2b + H-2c)
```

ζ와 η는 다른 파일 → 병렬 배포 가능.  
η 내부에서 api.ts → portfolio.ts → trades.tsx 순서 의존성 있으나 같은 에이전트가 처리.

---

## 파일별 변경 요약

| 파일 | 변경 내용 | 라인 수 |
|------|-----------|---------|
| `frontend/app/comparison/page.tsx` | `grid grid-cols-2` 래퍼 추가 + scatter 위치 이동 | +4 / -4 |
| `frontend/lib/api.ts` | `patch<T>()` 함수 추가 | +8 |
| `frontend/lib/hooks/portfolio.ts` | import에 `patch` 추가, `post` → `patch` 교체 | +2 / -1 |
| `frontend/app/trades/page.tsx` | `savedTrade` 반환값 수신 + `weightToApply` 분기 로직 | +10 / -5 |

---

## 검증 체크리스트

### H-1: 레이아웃
- [ ] 비교 탭에서 NAV 차트와 scatter 차트가 좌/우로 나란히 표시됨
- [ ] NAV/Drawdown 토글, 기간 필터가 정상 동작
- [ ] 비교 지표 테이블은 그 아래 full width로 유지됨
- [ ] scatter 차트가 비교 지표 테이블 아래에 단독으로 표시되지 않음

### H-2: E-3
- [ ] 브라우저 콘솔에서 405 에러 더 이상 안 나옴 (HTTP 메서드 불일치 해소)
- [ ] 역산 계산기 미사용으로 거래 저장 → 리스크 탭 목표 비중 = `weight_after`로 업데이트됨
- [ ] 역산 계산기 사용으로 거래 저장 → 리스크 탭 목표 비중 = `calcTargetWeight / 100`으로 업데이트됨
- [ ] `weight_after === 0`인 거래 → PATCH 미호출 (의도적)

---

## 참고: 연관 파일 맵

```
frontend/lib/api.ts                 H-2a: patch() 함수 추가
frontend/lib/hooks/portfolio.ts     H-2b: post → patch 교체 (import 포함)
frontend/app/trades/page.tsx        H-2c: savedTrade.weight_after 기반 로직
frontend/app/comparison/page.tsx    H-1: 2컬럼 그리드 재구성
```
