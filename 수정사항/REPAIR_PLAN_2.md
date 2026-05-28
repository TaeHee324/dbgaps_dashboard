# DBGAPS Dashboard 2차 수정 계획서

작성일: 2026-05-28  
상태: 미착수  
전제: 1차 REPAIR_PLAN.md의 모든 항목 완료 + Railway DB에 `is_active` 컬럼 추가 완료

---

## 배경 및 컨텍스트

### 1차 수정 완료 상태 (REPAIR_PLAN.md)
- A-1: 단가 콤마 포맷 ✅
- A-2: 날짜 기준 종가 auto-fill, 비중 입력 필드 제거 ✅
- A-3: 백엔드 weight_before/after 자동 계산 (`_calc_weights()`) ✅
- A-4: `scripts/recalc_trade_weights.py` 신규 생성 ✅
- B-1: `risk.py _get_target_weights()` → active 포트폴리오 기반으로 교체 ✅
- B-2: `GET /portfolios/active`, `POST /portfolios/{name}/activate` 추가 ✅
- B-3: 포트폴리오 페이지 "운용 중 지정" 버튼 추가 ✅
- C-1: 비교 탭 "현재 운용" 행 실제 지표 계산 ✅
- D-1: `risk.py` CSV → `db.load_prices_from_db()` 교체 (3곳) ✅

### 2차 수정 배경
1차 QA 결과 남은 버그 2개 + 신규 기능 요구사항 2개.

---

## 전체 수정 범위

| 번호 | 분류 | 이슈 | 수정 파일 |
|------|------|------|-----------|
| E-1 | 역산 계산기 | 필요수량 계산 공식 오류 (현재가 사용, 차분 미적용) | `frontend/app/trades/page.tsx` |
| E-2 | 역산 계산기 | 총자산 기본값이 현재 NAV → 당시 날짜 NAV로 교체 | `frontend/app/trades/page.tsx` |
| E-3 | 포트폴리오 연동 | 거래 저장 시 active 포트폴리오 목표 비중 자동 업데이트 | `api/routers/portfolios.py`, `api/schemas.py`, `frontend/app/trades/page.tsx`, `frontend/lib/hooks/portfolio.ts` |
| F-1 | 리스크 탭 | 포트폴리오 2D scatter 차트 추가 (2컬럼 레이아웃) | `frontend/app/risk/page.tsx` |

---

## E-1: 역산 계산기 수량 공식 수정

### 문제 정의

**파일**: `frontend/app/trades/page.tsx:101-104`

```typescript
// 현재 코드 (잘못됨)
const calcNeededQty =
  latestPrice > 0 && effectiveTotalAssets > 0 && calcTargetWeight > 0
    ? Math.floor((effectiveTotalAssets * (calcTargetWeight / 100)) / latestPrice)
    : null;
```

**버그 1 — 가격 불일치**  
`latestPrice`(현재가)를 쓰지만 헤더에는 `priceOnDate`(기준가 YYYY-MM-DD 종가)를 표시. 이미지에서 빨간 동그라미 표시된 "현재가 51,025원 기준"이 이 문제.  
→ `latestPrice` → `priceOnDate` 통일

**버그 2 — 공식 오류 (핵심)**  
공식 `(총자산 × 목표비중%) / 단가`는 "목표비중에 해당하는 금액만큼 전량 매수/매도하는 수량"을 계산함.  
실제 의도: **현재 보유량과의 차분** (예: 금 15% 보유 → 목표 10% → 5%만큼 매도)

```
올바른 계산:
  목표금액 = 총자산 × 목표비중%
  현재금액 = 현재보유수량 × priceOnDate
  필요수량 = |목표금액 - 현재금액| / priceOnDate
  
  - 매수: 목표금액 > 현재금액 → 추가 매수 수량
  - 매도: 목표금액 < 현재금액 → 매도 수량
```

### 수정 방법

`liveHoldings`에서 현재 ETF 보유 수량 조회 → 차분 계산:

```typescript
// 현재 선택한 ETF의 보유 수량 (liveHoldings는 이미 훅으로 로드됨)
const currentHoldingQty = useMemo(() => {
  const h = liveHoldings.find((h) => h.etf_code === form.etf_code);
  return h?.quantity ?? 0;
}, [liveHoldings, form.etf_code]);

const calcNeededQty = useMemo(() => {
  if (priceOnDate <= 0 || effectiveTotalAssets <= 0 || calcTargetWeight <= 0) return null;
  const targetValue = effectiveTotalAssets * (calcTargetWeight / 100);
  const currentValue = currentHoldingQty * priceOnDate;
  const diff = targetValue - currentValue;
  
  if (form.action === "매수" && diff > 0) {
    return Math.floor(diff / priceOnDate);
  } else if (form.action === "매도" && diff < 0) {
    return Math.floor(-diff / priceOnDate);
  } else if (form.action === "리밸런싱") {
    return Math.abs(diff) > priceOnDate ? Math.round(Math.abs(diff) / priceOnDate) : 0;
  }
  return 0;
}, [priceOnDate, effectiveTotalAssets, calcTargetWeight, currentHoldingQty, form.action]);
```

역산 계산기 표시 텍스트도 "현재가 기준" → "priceOnDate 기준"으로 변경.

**수정 파일**: `frontend/app/trades/page.tsx`  
**의존성**: 없음 (독립)

---

## E-2: 역산 계산기 총자산 기본값 → 당시 NAV

### 문제 정의

현재 `calcTotalAssets` 기본값: `liveNavTotal` = 지금 이 순간의 포트폴리오 total_value  
필요: `form.date` 기준 시점의 NAV

역산 계산기 사용 목적 = "특정 날짜에 목표 비중을 맞추기 위해 몇 주 거래할지" → 그 날짜 기준 총자산이 있어야 올바른 수량 계산.

### 수정 방법

`useActualNav()`는 이미 trades/page.tsx에 없지만 `useLiveHoldings()`처럼 import 가능. `ActualNavPoint`의 `portfolio_value`를 날짜 lookup.

```typescript
// import 추가
import { useActualNav } from "@/lib/hooks/dashboard";

// 훅 호출 (컴포넌트 최상단)
const { data: actualNav = [] } = useActualNav();

// form.date 기준 NAV 조회 (ffill 방식 — priceOnDate와 동일 패턴)
const navOnDate = useMemo(() => {
  if (!actualNav.length || !form.date) return liveNavTotal;
  const candidates = actualNav.filter((p) => p.date <= form.date);
  if (!candidates.length) return liveNavTotal;
  return candidates[candidates.length - 1].portfolio_value;
}, [actualNav, form.date, liveNavTotal]);

// 기존 liveNavTotal useEffect 대체: calcTotalAssets를 navOnDate로 자동 갱신
// form.date 변경 시도 갱신 (단, 사용자가 수동 수정한 경우는 덮어쓰지 않음)
```

`calcTotalAssets` 초기화 useEffect를 `liveNavTotal` 기준 → `navOnDate` 기준으로 교체.  
`form.date` 변경 시 `calcTotalAssets`를 `navOnDate`로 리셋 (단, 사용자가 이미 수동 수정한 경우 덮어쓰지 않도록 ref 플래그 관리).

**수정 파일**: `frontend/app/trades/page.tsx`  
**의존성**: E-1과 동일 파일. 하나의 에이전트가 E-1+E-2 동시 처리.

---

## E-3: 거래 저장 시 active 포트폴리오 목표 비중 자동 업데이트

### 배경 및 의도

리스크 탭 "목표 비중" = active 포트폴리오 `holdings[code].weight`.  
거래(특히 리밸런싱/매도)가 일어나면 active 포트폴리오 목표 비중을 수동으로 다시 설정해야 리스크 탭이 정확해짐.

**해결책**: 역산 계산기의 `calcTargetWeight`를 거래 저장 시 active 포트폴리오에 자동 반영.  
조건: `calcTargetWeight > 0`인 경우에만 (역산 계산기를 사용한 거래에만 적용).

### 백엔드 수정 — `api/routers/portfolios.py`

신규 엔드포인트 `PATCH /api/portfolios/active/holdings` 추가:

```python
class UpdateActiveHoldingRequest(BaseModel):
    code: str        # ETF 코드 (6자리)
    weight: float    # 새 목표 비중 (0.0 ~ 1.0)

@router.patch("/portfolios/active/holdings", status_code=200)
def update_active_holding(payload: UpdateActiveHoldingRequest):
    """active 포트폴리오의 특정 ETF 목표 비중을 업데이트. 없으면 추가."""
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, holdings FROM portfolios WHERE is_active = TRUE LIMIT 1"
            )
            row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="운용 중 포트폴리오가 없습니다.")
        
        holdings = row["holdings"]
        if isinstance(holdings, str):
            import json
            holdings = json.loads(holdings)
        
        # 해당 code 업데이트 또는 추가
        code = _normalize_code(payload.code)
        updated = False
        for h in holdings:
            if str(h.get("code", "")).zfill(6) == code:
                h["weight"] = payload.weight
                updated = True
                break
        if not updated:
            holdings.append({"code": code, "weight": payload.weight})
        
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE portfolios SET holdings = %s::jsonb WHERE name = %s",
                (json.dumps(holdings), row["name"]),
            )
        conn.commit()
    return {"updated": code, "weight": payload.weight}
```

**주의**: 라우트 순서 — `PATCH /portfolios/active/holdings`는 `GET /portfolios/active` 및 `POST /portfolios/{name}/activate`와 다른 메서드/경로이므로 충돌 없음.

### `api/schemas.py` 수정

```python
class UpdateActiveHoldingRequest(BaseModel):
    code: str
    weight: float
```

### 프론트엔드 수정 — `frontend/lib/hooks/portfolio.ts`

```typescript
export function useUpdateActiveHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, weight }: { code: string; weight: number }) =>
      post(`/api/portfolios/active/holdings`, { code, weight }),
    onSuccess: () => {
      // 리스크 탭 목표 비중이 즉시 반영되도록 risk 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["risk-portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["etf-risk-analysis"] });
    },
  });
}
```

### 프론트엔드 수정 — `frontend/app/trades/page.tsx`

`handleSubmit` 완료 후 조건부로 `useUpdateActiveHolding` 호출:

```typescript
const updateActiveHolding = useUpdateActiveHolding();

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  // 기존 저장 로직 (불변)
  const payload = { ... };
  if (editId !== null) {
    await updateTrade.mutateAsync({ id: editId, data: payload });
  } else {
    await addTrade.mutateAsync(payload);
  }

  // 역산 계산기 목표 비중이 있을 때 active 포트폴리오 자동 업데이트
  if (calcTargetWeight > 0 && form.etf_code) {
    try {
      await updateActiveHolding.mutateAsync({
        code: form.etf_code,
        weight: calcTargetWeight / 100,  // % → 소수 변환
      });
    } catch {
      // 포트폴리오 업데이트 실패는 거래 저장에 영향 주지 않음 (silent fail)
    }
  }

  // 기존 초기화 로직 (불변)
  setForm(makeDefaultForm());
  setEditId(null);
  ...
}
```

**수정 파일**: `api/routers/portfolios.py`, `api/schemas.py`, `frontend/lib/hooks/portfolio.ts`, `frontend/app/trades/page.tsx`

---

## F-1: 리스크 탭 포트폴리오 2D scatter 차트

### 배경

참고 이미지: `OneDrive/옵시디언/Startegy_Investment/img/Pasted image 20260404143522.png`  
(각 점 = 포트폴리오/전략, x/y = 선택 가능한 수치 지표, 추세선 포함)

현재 리스크 탭 ETF 차트(`SelectedEtfPanel` 내 `EtfRiskLineChart`)가 기간이 길어 변화가 잘 안 보임.  
→ 그 옆에 포트폴리오 비교 scatter chart를 2컬럼으로 배치.

### 데이터 소스

`useComparisonSummary()` 훅 — 이미 `frontend/lib/hooks/dashboard.ts:244`에 존재:
```typescript
ComparisonSummaryItem = {
  portfolio_name: string;
  cagr: number;
  mdd: number;
  sharpe: number;
  calmar: number;
  sortino?: number | null;
  annual_volatility?: number | null;
  win_rate?: number | null;
}
```

risk page에서 이 훅만 추가 import하면 됨.

### 레이아웃 변경

현재 `SelectedEtfPanel` 바깥 렌더링 구조 (risk/page.tsx 하단):
```
<page>
  <header>
  <KPI cards (4개)>
  <HHI + 데이터헬스 패널>
  <ETF 리스크 분석 테이블>
  <SelectedEtfPanel>   ← 여기가 "ETF 차트 영역"
</page>
```

변경 후:
```
<page>
  <header>
  <KPI cards (4개)>
  <HHI + 데이터헬스 패널>
  <ETF 리스크 분석 테이블>
  <2컬럼 그리드>
    <왼쪽: SelectedEtfPanel>   ← 기존 (ETF 선택 시 차트)
    <오른쪽: PortfolioScatterChart>  ← 신규
  </2컬럼 그리드>
</page>
```

### 차트 스펙

**컴포넌트명**: `PortfolioScatterChart` (risk/page.tsx 내 인라인 또는 별도 컴포넌트)

**x/y 선택 지표**:
```
CAGR (cagr)
MDD (mdd)
샤프 (sharpe)
칼마 (calmar)
소르티노 (sortino)
연간변동성 (annual_volatility)
월별승률 (win_rate)
```

기본값: x = `annual_volatility`, y = `cagr` (위험-수익 scatter이 가장 직관적)

**렌더링 방식**: SVG 직접 구현 (외부 라이브러리 없음)

```typescript
// 핵심 구현 패턴
function PortfolioScatterChart({ data }: { data: ComparisonSummaryItem[] }) {
  const [xKey, setXKey] = useState<keyof ComparisonSummaryItem>("annual_volatility");
  const [yKey, setYKey] = useState<keyof ComparisonSummaryItem>("cagr");
  
  // SVG 좌표 변환 (데이터 범위 → 픽셀)
  // 각 점: circle + text 레이블 (portfolio_name)
  // active 포트폴리오: 다른 색 (indigo) + 굵은 테두리로 강조
  // hover tooltip: 포트폴리오명, x값, y값
}
```

**active 포트폴리오 강조**: `usePortfolios()`에서 `is_active: true`인 포트폴리오 이름 확인 → scatter에서 해당 점 색상 강조 (indigo, 나머지는 slate)

**디자인 준수**: white surface, navy text, indigo accent, PANEL 스타일 적용.

**수정 파일**: `frontend/app/risk/page.tsx`  
**의존성**: 없음 (독립)

---

## 파일별 충돌 분석

| 파일 | 관련 항목 | 충돌 여부 |
|------|-----------|-----------|
| `frontend/app/trades/page.tsx` | E-1, E-2, E-3 프론트 | **동일 파일 → 하나의 에이전트가 모두 처리** |
| `frontend/lib/hooks/portfolio.ts` | E-3 훅 | 독립, 다른 파일 작업 에이전트와 무관 |
| `api/routers/portfolios.py` | E-3 백엔드 | 1차 수정에서 activate 엔드포인트 추가됨. 새 PATCH 엔드포인트 추가이므로 충돌 없음 |
| `api/schemas.py` | E-3 스키마 | 1차에서 is_active, PortfolioDetail 추가됨. 새 Request 모델 추가이므로 충돌 없음 |
| `frontend/app/risk/page.tsx` | F-1 | 독립, 다른 파일 건드리지 않음 |

---

## 에이전트 배포 계획 (병렬)

```
에이전트 α: api/routers/portfolios.py + api/schemas.py  (E-3 백엔드)
에이전트 β: frontend/app/trades/page.tsx + lib/hooks/portfolio.ts  (E-1 + E-2 + E-3 프론트)
에이전트 γ: frontend/app/risk/page.tsx  (F-1)
```

α, β, γ 모두 서로 다른 파일을 수정하므로 병렬 배포 가능.

---

## 구현 시 주의사항

### E-1 주의
- `calcNeededQty`가 0이 되는 케이스(이미 목표 비중 달성) 구분해서 "필요 없음" 표시
- 리밸런싱은 매수/매도 방향 없이 절댓값 차분

### E-2 주의
- `useActualNav()`가 없는 날짜(거래 없는 날)는 ffill 방식으로 가장 가까운 이전 날짜 사용
- 사용자가 `calcTotalAssets`를 수동 수정한 후 날짜를 바꾸면 덮어쓸지 여부: **덮어씀** (날짜가 바뀌면 당시 NAV로 리셋이 자연스러움)

### E-3 주의
- `PATCH /portfolios/active/holdings`는 active 포트폴리오가 없으면 404 반환 → 프론트에서 silent fail 처리
- holdings JSONB 업데이트 시 기존 다른 ETF 비중은 변경하지 않음 (해당 code만 업데이트)
- `_normalize_code()`는 `portfolios.py`에 이미 있음 — 재사용
- `json.dumps` import: `import json` — `portfolios.py` 상단에 아직 없다면 추가

### F-1 주의
- `ComparisonSummaryItem` 데이터가 없으면(백테스트 미실행) 빈 scatter 표시 + 안내 메시지
- SVG viewBox는 고정 크기(예: 400×300) + responsive wrapper
- 포트폴리오명이 길면 레이블 잘림 처리 필요 (maxLength 또는 abbreviation)
- MDD, drawdown 계열은 음수 → scatter에서 절댓값으로 표시하고 축 레이블에 "절댓값" 표기

---

## 검증 체크리스트

작업 완료 후 순서대로 확인:

- [ ] E-1: 금 15% 보유, 총자산 1억, 목표비중 10% 입력 시 필요수량 = (15%-10%) × 1억 / 단가
- [ ] E-1: 기준가(priceOnDate)와 계산 기준 가격이 일치 (이미지 빨간 동그라미 해소)
- [ ] E-1: 매수 모드에서 목표비중 > 현재비중 → 양수 수량, 목표비중 < 현재비중 → 0 표시
- [ ] E-2: form.date 변경 시 총자산 기본값이 해당 날짜 NAV로 갱신
- [ ] E-3: 역산 계산기에 목표비중 입력 후 거래 저장 → 리스크 탭에서 해당 ETF 목표 비중이 즉시 변경됨
- [ ] E-3: 역산 계산기 없이 저장한 거래(calcTargetWeight = 0) → 포트폴리오 비중 변경 없음
- [ ] F-1: 리스크 탭 하단에 포트폴리오 scatter chart 표시
- [ ] F-1: x/y 드롭다운 변경 시 각 포트폴리오의 위치 재배치
- [ ] F-1: active 포트폴리오 점이 다른 색으로 강조됨
- [ ] F-1: 기존 ETF 차트(SelectedEtfPanel)가 왼쪽 컬럼에서 정상 동작

---

## 참고: 연관 파일 맵 (전체)

```
api/routers/portfolios.py      E-3 PATCH /portfolios/active/holdings 추가
api/schemas.py                 E-3 UpdateActiveHoldingRequest 추가
frontend/app/trades/page.tsx   E-1 공식 수정, E-2 navOnDate, E-3 handleSubmit 연동
frontend/lib/hooks/portfolio.ts  E-3 useUpdateActiveHolding 훅 추가
frontend/app/risk/page.tsx     F-1 2D scatter 차트 + 2컬럼 레이아웃
```
