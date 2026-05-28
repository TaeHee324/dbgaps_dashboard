# DBGAPS Dashboard 수정 계획서

작성일: 2026-05-28  
상태: 미착수

---

## 전체 수정 범위 요약

| 번호 | 탭 | 이슈 | 수정 파일 |
|------|-----|------|-----------|
| A-1 | 매매일지 | 숫자 입력 필드 천단위 콤마 | `frontend/app/trades/page.tsx` |
| A-2 | 매매일지 | 입력 카드 UI 개선 (비중 필드 제거 + 종가/NAV 자동 표시) | `frontend/app/trades/page.tsx` |
| A-3 | 매매일지 | 이력카드 비중 전/후 자동 계산 (백엔드) | `api/routers/trades.py` |
| A-4 | 매매일지 | 기존 레코드 비중 일괄 재계산 스크립트 | `scripts/recalc_trade_weights.py` (신규) |
| B-1 | 리스크 관리 | 목표 비중 소스를 active 포트폴리오로 변경 | `api/routers/risk.py`, `api/routers/portfolios.py`, `api/schemas.py` |
| B-2 | 리스크 관리 | 포트폴리오 페이지에 "운용 중 지정" UI 추가 | `frontend/app/portfolio/page.tsx` |
| B-3 | 리스크 관리 | DB 스키마 변경 (is_active 컬럼) | Railway 콘솔 SQL 직접 실행 |
| C-1 | 포트폴리오 비교 | 현재 운용 행 지표 누락 수정 | `frontend/app/comparison/page.tsx` |
| D-1 | 리스크 관리 | 데이터 헬스·KPI 전체가 stale CSV를 읽음 → DB로 교체 | `api/routers/risk.py` |

---

## A. 매매일지 탭 수정

### A-1: 숫자 필드 천단위 콤마 표시

**현재 문제**  
입력 필드가 `type="number"` 로 되어 있어 콤마 표시 불가.  
예) 단가 `50000`, 총자산 `100000000` → 가독성 없음

**수정 방법**  
`type="number"` → 커스텀 텍스트 입력으로 교체.  
내부 state는 숫자(`number | null`), 표시용은 콤마 포맷 문자열로 이원화.

**대상 필드**
- 매수/매도 단가(원)
- 거래금액(원) — readonly 이지만 표시 포맷 수정
- 역산 계산기 총자산(원)

**구현 패턴**
```typescript
// 포맷 헬퍼 함수 (page.tsx 상단에 추가)
function formatComma(n: number | null): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("ko-KR");
}

function parseComma(s: string): number | null {
  const cleaned = s.replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// 입력 필드 예시 (단가)
<input
  type="text"
  inputMode="numeric"
  value={priceDisplay}           // "50,000" 형태 문자열
  onChange={(e) => {
    const raw = e.target.value.replace(/,/g, "");
    if (/^\d*$/.test(raw)) {
      const n = raw ? Number(raw) : null;
      setPriceDisplay(n ? formatComma(n) : raw);
      setForm(prev => ({ ...prev, price: n, amount: n && form.quantity ? Math.round(n * form.quantity) : null }));
    }
  }}
/>
```

**수정 파일**: `frontend/app/trades/page.tsx`

---

### A-2: 입력 카드 UI 개선

**현재 문제**  
- 비중 이전/이후 입력 필드가 있으나 사용자가 직접 입력하는 구조 → 항상 0 저장
- 역산 계산기에 종가가 표시되지만 날짜 기준이 아닌 최신 종가 고정
- 매수/매도 단가 기본값이 없어 매번 직접 입력

**수정 내용**

1. **비중 이전/이후 입력 필드 완전 제거** (A-3에서 서버 자동 계산으로 대체)

2. **날짜 기준 종가 자동 표시**
   - `useEtfPrices(code)`가 전체 이력을 반환하므로 프론트에서 `form.date`에 해당하는 날짜 매핑
   - 역산 계산기 섹션에 "기준가: {종가}원 ({날짜} 종가)" 문구 표시
   - 현재 `latestPrice`(전체 이력 마지막 값) → `form.date` 기준으로 변경

3. **매수/매도 단가 기본값 = 해당 날짜 종가**
   - ETF 선택 + 날짜 변경 시 단가 필드에 해당 종가 자동 pre-fill
   - 수동 수정 가능

4. **역산 계산기 총자산 기본값 = 현재 포트폴리오 NAV**
   - `useLiveHoldings()`에서 `total_value` 합산 또는 별도 훅으로 NAV 조회
   - `calcTotalAssets` 초기값으로 세팅 (수동 수정 가능)

**구현 패턴**
```typescript
// 날짜 기준 종가 찾기
const priceOnDate = useMemo(() => {
  if (!etfPrices.length || !form.date) return 0;
  const match = etfPrices.find(p => p.date === form.date);
  if (match) return match.close;
  // form.date 이전 가장 가까운 종가 (ffill 방식)
  const before = etfPrices.filter(p => p.date <= form.date);
  return before.length > 0 ? before[before.length - 1].close : 0;
}, [etfPrices, form.date]);

// ETF 또는 날짜 변경 시 단가 자동 세팅
useEffect(() => {
  if (priceOnDate > 0 && form.price === null) {
    setForm(prev => ({ ...prev, price: priceOnDate }));
  }
}, [priceOnDate]);
```

**수정 파일**: `frontend/app/trades/page.tsx`

---

### A-3: 이력카드 비중 전/후 자동 계산 (백엔드)

**현재 문제**  
`weight_before`, `weight_after`가 사용자 수동 입력에 의존해 항상 0으로 저장됨.  
이력카드에서 매도 시 비중 전 = 0%, 비중 후 = 0%로 표시.

**수정 방법**  
POST/PUT 핸들러에서 payload의 weight 값을 무시하고 서버에서 직접 계산해 저장.

**계산 로직** (`api/routers/trades.py` 내 헬퍼 함수 `_calc_weights()` 추가)

```python
def _calc_weights(
    trade_date: str,
    etf_code: str,
    action: str,       # 매수 / 매도 / 리밸런싱
    quantity: float,
    price: float,
    exclude_trade_id: int | None = None,  # PUT 시 기존 레코드 제외
) -> tuple[float, float]:
    """
    weight_before, weight_after 계산.
    1. trade_log에서 trade_date 이전까지 ETF별 누적 포지션 계산 (FIFO)
    2. prices_daily에서 해당 날짜(없으면 그 이전 최근일) 종가 조회
    3. 총 NAV = Σ(ETF수량 × 종가) + 현금
    4. weight_before = 해당 ETF 시가 / 총 NAV
    5. 거래 적용 후 weight_after 계산
    """
    INITIAL_CAPITAL = 1_000_000_000

    # 1. 이 거래 날짜 이전(exclusive) 포지션 집계
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT action, etf_code, quantity, price
                FROM trade_log
                WHERE date < %s
                  AND quantity IS NOT NULL AND price IS NOT NULL
            """
            params = [trade_date]
            if exclude_trade_id is not None:
                query += " AND id != %s"
                params.append(exclude_trade_id)
            query += " ORDER BY date ASC, id ASC"
            cur.execute(query, params)
            rows = cur.fetchall()

    positions: dict[str, dict] = {}
    total_buy = 0.0
    total_sell = 0.0

    for r in rows:
        code = str(r["etf_code"])
        qty = float(r["quantity"])
        p = float(r["price"])
        act = str(r["action"])
        if code not in positions:
            positions[code] = {"qty": 0.0, "cost": 0.0}
        pos = positions[code]
        if act in ("매수", "리밸런싱"):
            pos["qty"] += qty
            pos["cost"] += qty * p
            total_buy += qty * p
        elif act == "매도" and pos["qty"] > 0:
            avg = pos["cost"] / pos["qty"]
            sold = min(qty, pos["qty"])
            pos["qty"] -= sold
            pos["cost"] -= avg * sold
            total_sell += sold * p

    # 2. 해당 날짜 이전 최근 종가 조회 (prices_daily DB)
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            all_codes = list(positions.keys())
            if etf_code not in all_codes:
                all_codes.append(etf_code)
            # 각 코드에 대해 trade_date 이하 최근 종가
            cur.execute(
                """
                SELECT DISTINCT ON (code) code, close
                FROM prices_daily
                WHERE code = ANY(%s) AND date <= %s
                ORDER BY code, date DESC
                """,
                (all_codes, trade_date),
            )
            price_rows = cur.fetchall()

    prices_map: dict[str, float] = {str(r["code"]): float(r["close"]) for r in price_rows}
    # 전달받은 price로 보완 (당일 종가와 다를 수 있으나 없는 경우 대비)
    if etf_code not in prices_map:
        prices_map[etf_code] = price

    # 3. 총 NAV (before 기준)
    etf_market_value = sum(
        pos["qty"] * prices_map.get(code, 0.0)
        for code, pos in positions.items()
        if pos["qty"] > 0
    )
    cash_before = INITIAL_CAPITAL - total_buy + total_sell
    total_nav_before = etf_market_value + cash_before

    # 4. weight_before
    etf_qty_before = positions.get(etf_code, {}).get("qty", 0.0)
    etf_val_before = etf_qty_before * prices_map.get(etf_code, price)
    weight_before = etf_val_before / total_nav_before if total_nav_before > 0 else 0.0

    # 5. 거래 적용 후 weight_after
    trade_amount = quantity * price
    if action in ("매수", "리밸런싱"):
        etf_qty_after = etf_qty_before + quantity
        cash_after = cash_before - trade_amount
    elif action == "매도":
        etf_qty_after = max(0.0, etf_qty_before - quantity)
        cash_after = cash_before + trade_amount
    else:
        etf_qty_after = etf_qty_before
        cash_after = cash_before

    etf_val_after = etf_qty_after * prices_map.get(etf_code, price)
    # NAV 변화: 매수는 현금↓ETF↑(총액 동일), 매도는 현금↑ETF↓
    total_nav_after = total_nav_before  # 거래 후 총 NAV는 이론상 동일 (거래비용 0 가정)
    # 단, 매도 시 ETF 시가 변화분만큼 차이 발생 가능. 단순화: 당일 기준 재계산
    other_etf_val = etf_market_value - etf_val_before
    total_nav_after = other_etf_val + etf_val_after + cash_after
    weight_after = etf_val_after / total_nav_after if total_nav_after > 0 else 0.0

    return float(weight_before), float(weight_after)
```

**POST 핸들러 수정**
```python
@router.post("/trade-log", response_model=schemas.TradeLogEntry)
def add_trade(payload: schemas.AddTradeRequest):
    # weight 자동 계산 (quantity, price가 있을 때만)
    weight_before = 0.0
    weight_after = 0.0
    if payload.quantity and payload.price:
        weight_before, weight_after = _calc_weights(
            payload.date, payload.etf_code, payload.action,
            payload.quantity, payload.price
        )
    # 이후 기존 INSERT 로직 동일, weight_before/weight_after 덮어씀
    ...
```

**수정 파일**: `api/routers/trades.py`

---

### A-4: 기존 레코드 비중 일괄 재계산 스크립트 (선택)

현재 DB에 0으로 저장된 기존 레코드들을 일괄 갱신.

**파일**: `scripts/recalc_trade_weights.py` (신규 작성)

**실행 방법**:
```bash
python scripts/recalc_trade_weights.py
```

**주의**: 실행 전 DB 백업 권장. 한 번만 실행.

---

## B. 리스크 관리 탭 — 목표 비중 수정 (방향 B: 구조적)

### 문제 정의

`_get_target_weights()` (risk.py:135)가 ETF별 최신 `weight_after`를 목표 비중으로 사용.  
→ 2026-05-26 매도 기록의 `weight_after = 0.0`이 411060(금현물)의 목표 비중으로 사용됨.  
→ 목표 0%, 현재 7.8% → 이탈폭 +7.8p 오표시.

**근본 원인**: 매도는 목표 비중을 변경하는 행위가 아님에도 `weight_after`를 목표로 읽는 구조.

### B-1: DB 스키마 변경

Railway 콘솔 SQL 직접 실행:

```sql
-- portfolios 테이블에 is_active 컬럼 추가
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

-- 기존 데이터 중 하나를 active로 지정 (초기값; 나중에 UI로 변경 가능)
-- UPDATE portfolios SET is_active = TRUE WHERE name = '포트폴리오명';
```

### B-2: API 수정

**`api/routers/portfolios.py`에 activate 엔드포인트 추가**

```python
@router.post("/portfolios/{name}/activate", status_code=200)
def activate_portfolio(name: str):
    """지정한 포트폴리오를 운용 중(active)으로 설정. 기존 active는 해제."""
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            # 전체 해제
            cur.execute("UPDATE portfolios SET is_active = FALSE")
            # 지정 포트폴리오 활성화
            cur.execute(
                "UPDATE portfolios SET is_active = TRUE WHERE name = %s RETURNING name",
                (name,)
            )
            row = cur.fetchone()
        conn.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="포트폴리오를 찾을 수 없습니다.")
    return {"activated": name}

@router.get("/portfolios/active", response_model=schemas.PortfolioDetail)
def get_active_portfolio():
    """현재 active 포트폴리오 반환."""
    with db.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, holdings, is_active FROM portfolios WHERE is_active = TRUE LIMIT 1"
            )
            row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="운용 중 포트폴리오가 없습니다.")
    return {"name": row["name"], "holdings": row["holdings"]}
```

**`api/routers/risk.py` — `_get_target_weights()` 수정**

```python
def _get_target_weights() -> dict[str, float]:
    """active 포트폴리오의 holdings에서 ETF별 목표 비중 반환."""
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT holdings FROM portfolios WHERE is_active = TRUE LIMIT 1"
                )
                row = cur.fetchone()
        if row is None:
            return {}
        holdings = row["holdings"]
        if isinstance(holdings, str):
            import json
            holdings = json.loads(holdings)
        # holdings = [{"code": "069500", "weight": 0.20}, ...]
        return {str(h["code"]): float(h["weight"]) for h in holdings}
    except Exception:
        return {}
```

**`api/schemas.py` 수정**

```python
class Portfolio(BaseModel):
    name: str
    group_name: Optional[str] = None
    is_active: bool = False

class PortfolioDetail(BaseModel):
    name: str
    holdings: list[PortfolioHolding]
```

### B-3: 프론트엔드 — 포트폴리오 페이지 "운용 중 지정" UI

**`frontend/app/portfolio/page.tsx`에 activate 버튼 추가**

```typescript
// 각 포트폴리오 카드에 "운용 중 지정" 버튼 추가
// active 상태인 포트폴리오에는 "운용 중" 배지 표시

function ActivateButton({ name, isActive }: { name: string; isActive: boolean }) {
  const activate = useActivatePortfolio(); // 새 mutation 훅
  if (isActive) {
    return <span className="badge-green">운용 중</span>;
  }
  return (
    <button onClick={() => activate.mutate(name)}>
      운용 중 지정
    </button>
  );
}
```

**`frontend/lib/hooks/portfolio.ts`에 훅 추가**

```typescript
export function useActivatePortfolio() {
  return useMutation({
    mutationFn: (name: string) => post(`/api/portfolios/${name}/activate`, {}),
  });
}
```

**수정 파일**: `frontend/lib/hooks/portfolio.ts`, `frontend/app/portfolio/page.tsx`

---

## C. 포트폴리오 비교 탭 — 현재 운용 지표 누락

### 문제 정의

`buildLiveRow()` (comparison/page.tsx:105-113)가 모든 지표를 0으로 하드코딩.  
렌더링(line 474-478)에서 "현재 운용" 행의 모든 지표를 "—"로 고정 표시.  
`useActualNav()` 데이터가 전혀 연결되지 않은 상태.

### 수정 방법

1. `useActualNav()` import 추가
2. 기간 필터 적용 후 `computeMetrics()` 로 CAGR, MDD, 샤프, 칼마 계산
3. `buildLiveRow()` 제거 → 인라인으로 actual nav 기반 계산
4. 소르티노, 연간변동성, 승률도 actual nav에서 계산

**구현**

```typescript
// comparison/page.tsx 수정

// 1. import 추가
import { useActualNav } from "@/lib/hooks/dashboard";

// 2. actual nav 데이터 가져오기
const { data: actualNav = [] } = useActualNav();

// 3. 기간 필터 적용
const filteredActualNav = useMemo(() => {
  if (!cutoffDate) return actualNav;
  return actualNav.filter(p => p.date >= cutoffDate);
}, [actualNav, cutoffDate]);

// 4. 메트릭 계산 (computeMetrics는 portfolio_value, date만 사용하므로 호환)
const liveMetrics = useMemo(
  () => computeMetrics(filteredActualNav),
  [filteredActualNav]
);

// 5. 소르티노 / 변동성 / 승률 추가 계산
const liveExtraMetrics = useMemo(() => {
  if (filteredActualNav.length < 2) return { sortino: null, vol: null, winRate: null };
  const returns = filteredActualNav.map(p => p.daily_return).filter(r => Number.isFinite(r));
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const downReturns = returns.filter(r => r < 0);
  const downStd = downReturns.length > 1
    ? Math.sqrt(downReturns.reduce((s, r) => s + r * r, 0) / downReturns.length) * Math.sqrt(252)
    : null;
  const sortino = downStd && downStd > 0 ? (mean * 252) / downStd : null;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const vol = Math.sqrt(variance * 252);
  const wins = returns.filter(r => r > 0).length;
  const winRate = returns.length > 0 ? wins / returns.length : null;
  return { sortino, vol, winRate };
}, [filteredActualNav]);

// 6. 렌더링 — 현재 운용 행
<tr className="border-b border-border bg-blue-50/40 hover:bg-blue-50/60">
  <td>현재 운용</td>
  <td>{fmtPct(liveMetrics.cagr)}</td>
  <td>{fmtPct(liveMetrics.mdd)}</td>
  <td>{fmtDec(liveMetrics.sharpe)}</td>
  <td>{fmtDec(liveMetrics.calmar)}</td>
  <td>{fmtDec(liveExtraMetrics.sortino)}</td>
  <td>{fmtPct(liveExtraMetrics.vol)}</td>
  <td>{fmtPct(liveExtraMetrics.winRate)}</td>
  <td>—</td>   {/* 데이터 시작 */}
  <td>—</td>   {/* 삭제 버튼 없음 */}
</tr>
```

**수정 파일**: `frontend/app/comparison/page.tsx`

---

## 작업 의존성 및 실행 순서

```
[B-3: DB is_active 컬럼 추가]  ← Railway 콘솔에서 SQL 직접 실행
         ↓
[A-3: 백엔드 비중 자동 계산]   ← 핵심 선행 작업
         ↓
[B-2: API activate 엔드포인트] ← B-3 완료 후
         ↓
[A-1: 콤마 포맷] [A-2: UI 개선] [B-3: portfolio 페이지 activate UI] [C-1: 비교 탭]
(이 4개는 서로 독립적이므로 병렬 작업 가능)
         ↓
[A-4: 기존 레코드 재계산 스크립트 실행]  ← 선택적, 최후
```

---

## 검증 체크리스트

작업 완료 후 순서대로 확인:

- [x] A-1: 단가 입력 시 콤마 자동 삽입, 제출 후 DB에 숫자로 저장됨
- [x] A-2: ETF 선택 + 날짜 변경 시 단가 필드에 해당일 종가 자동 세팅
- [x] A-2: 비중 이전/이후 입력 필드 사라짐
- [x] A-3: 매수 저장 후 이력카드에서 비중 전/후가 0%가 아닌 실제 값으로 표시 
- [ ] A-3: 매도 저장 후 비중 전 = 매도 전 해당 ETF 비중, 비중 후 = 매도 후 비중 **비중 후 -> 기준이 매도 당시 기준이 되어야 함(현재를 반영하면 x)**
- [x] B-1: portfolios 테이블에 is_active 컬럼 존재 확인 (Railway 콘솔)
- [x] B-2: 포트폴리오 페이지에서 "운용 중 지정" 클릭 → 해당 포트폴리오 active 표시
- [x] B-2: 리스크 탭 목표 비중이 0%가 아닌 active 포트폴리오의 비중으로 표시
- [ ] B-2: 금현물 반 매도 후에도 목표 비중 = active 포트폴리오 설정값 (변경 없음)
- [x] C-1: 비교 탭 "현재 운용" 행에 CAGR, MDD, 샤프 등 지표가 "—" 대신 실제 값 표시
- [x] C-1: 기간 필터(1M/3M/6M/1Y) 변경 시 현재 운용 지표도 함께 재계산됨

매매일지 탭에서 목표비중 역산을 사용할때 (당시) 총자산 과 (당시) 매도단가 를 이용해서 계산이 되어야 함. 이렇게 되고 있다면 내가 목표로 하는 비중을 팔겠다 -> 라는 의미로 활용되고 있음
목표비중으로 포트폴리오를 조절하는것을 베이스로 하고 할때마타 active 포트폴리오 비중에 반영이 되어야 함. 리스크 관리탭에서 목표비중이 바뀌지 않아서 관심종목으로 표시되게 됨.

리스크 관리 탭 수정 - C:\Users\김태희\OneDrive\옵시디언\Startegy_Investment\img\Pasted image 20260404143522.png 사진처럼 2차원 평면에 x축 y축에 각 지표중 토클로 선택해서 배치하고 포트폴리오의 위치를 2차원 평면위의 점으로 표시하는 차트가 있으면 좋겠음. 현재 nav와 drawdown 차트가 너무 길어서 변화가 잘 안 보임. 때문에 그 차트 옆에 2차원 평면 차트를 넣는게 좋을 것 같음. 두개의 컬럼을 쓰는것이라고 생각하면 됨.

---

---

## D. 리스크 관리 탭 — 데이터 헬스 및 KPI 전체 stale 문제

### 문제 정의

리스크 탭 데이터 헬스가 **2026-05-22** (3 영업일 경과, "오류")를 표시하지만  
실제 DB의 prices_daily에는 **2026-05-27**까지 데이터가 들어있음.

**영향 범위**: 데이터 헬스 날짜뿐 아니라 리스크 탭의 모든 지표가 stale:
- HHI 집중도 (stale 가격으로 시가 계산)
- 개별 ETF MDD, 현재낙폭, 20일 변동성
- 위험기여도 분해

### 근본 원인

`risk.py` 내 3곳 모두 `data/prices_daily.csv` (정적 CSV 파일)를 읽음.  
이 CSV는 2026-05-22이 마지막 갱신이고, 이후 prices는 PostgreSQL DB에만 저장됨.

```
src/update_prices.py → PostgreSQL prices_daily  ← dashboard.py 사용 (최신)
                     ↛ data/prices_daily.csv     ← risk.py 사용 (stale)
```

`db.py`에 `load_prices_from_db()` 함수가 이미 있음에도 `risk.py`만 이를 사용하지 않음.

### 영향 라인 (risk.py)

| 라인 | 함수 | 용도 |
|------|------|------|
| 87 | `_get_fifo_holdings()` | ETF 현재가 조회 → HHI, 시가, 비중 계산 |
| 168 | `risk_portfolio()` | 데이터 헬스 날짜 계산 |
| 206 | `etf_analysis()` | 가격 이력 pivot → MDD/변동성/위험기여도 |

### 수정 방법

세 곳의 CSV 읽기를 `db.load_prices_from_db()`로 교체.

`load_prices_from_db()`가 이미 반환하는 형식:
- `date`: datetime (pd.to_datetime 완료)
- `code`: str, zfill(6) 완료
- `close`: numeric

기존 코드가 CSV 읽은 후 적용하던 `_normalize_code()`, `pd.to_datetime()` 처리가 DB 함수에서 이미 완료되므로 교체 후 해당 처리 라인 제거 가능.

**수정 전/후 패턴**

```python
# ─── 수정 전 (3곳 동일 패턴) ───
prices_df = _read_csv(DATA_DIR / "prices_daily.csv", dtype={"code": "string"})
if not prices_df.empty and {"code", "date", "close"}.issubset(prices_df.columns):
    prices_df["code"] = prices_df["code"].map(_normalize_code)
    prices_df["date"] = pd.to_datetime(prices_df["date"], errors="coerce")
    # ... 이후 처리

# ─── 수정 후 ───
prices_df = db.load_prices_from_db()
if not prices_df.empty:
    # code, date, close 이미 정규화됨 — 이후 처리 동일
```

**데이터 헬스 계산 부분 추가 수정** (`risk_portfolio()` 내)

```python
# 수정 전: prices_df["date"].max() 로 최신일 계산
# 수정 후: get_max_date_by_code()도 활용 가능하나, load_prices_from_db()로 통일

prices_df = db.load_prices_from_db()
if not prices_df.empty:
    latest_ts = prices_df["date"].max()
    latest_price_date = latest_ts.strftime("%Y-%m-%d")
    today = pd.Timestamp.today().normalize()
    stale = len(pd.bdate_range(latest_ts + pd.Timedelta(days=1), today))
    business_days_stale = int(stale)
    health_status = "정상" if stale <= 1 else ("주의" if stale == 2 else "오류")
```

**성능 고려**: `etf_analysis()`에서 전체 가격 이력을 pivot하는 용도로 사용 시, DB에서 전체 조회가 필요. 데이터 규모에 따라 최근 1년치만 조회하는 최적화 가능:

```python
# 선택적 최적화: 최근 252일치만 조회
prices_df = db.load_prices_from_db()  # 현재는 전체; 향후 날짜 필터 추가 가능
```

**수정 파일**: `api/routers/risk.py`  
**수정 범위**: 총 3곳의 CSV 읽기 → DB 읽기 교체, 중복 정규화 코드 제거

---

## 참고: 연관 파일 맵

```
api/routers/trades.py       A-3 비중 계산 로직 추가
api/routers/risk.py         B-1 _get_target_weights() 수정 + D-1 CSV→DB 교체 (3곳)
api/routers/portfolios.py   B-2 activate 엔드포인트 추가
api/schemas.py              B-2 Portfolio 스키마에 is_active 추가
frontend/app/trades/page.tsx           A-1, A-2
frontend/app/portfolio/page.tsx        B-3 activate UI
frontend/lib/hooks/portfolio.ts        B-3 useActivatePortfolio 훅
frontend/app/comparison/page.tsx       C-1
scripts/recalc_trade_weights.py        A-4 (신규)
```

---

## 작업 의존성 업데이트 (D 포함)

```
[B-3: DB is_active 컬럼 추가]  ← Railway 콘솔 SQL 직접 실행 (선행)
         ↓
[A-3: 백엔드 비중 자동 계산]   ← 핵심 선행 작업
[D-1: risk.py CSV→DB 교체]     ← 독립적, 병렬 가능 ★ 가장 빠른 효과
         ↓
[B-1+B-2: API activate 엔드포인트 + risk.py _get_target_weights() 수정]
         ↓
[A-1, A-2, B-3 UI, C-1]  ← 서로 독립적, 병렬 가능
         ↓
[A-4: 기존 레코드 재계산 스크립트 실행]  ← 선택적, 최후
```

**D-1은 risk.py 한 파일만 수정하는 독립 작업으로, 다른 작업과 무관하게 가장 먼저 처리 가능.**
