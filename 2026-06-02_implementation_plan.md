# 구현 계획 — 2026-06-02

## 작업 목록 (5개)

| # | 작업 | 파일 수 | 비고 |
|---|------|---------|------|
| T1 | ETF 행 입력 UI 순서 반전 | 1 | `portfolio/page.tsx` |
| T2 | 자산군 한도 계산 버그 수정 | 1 | `portfolio/page.tsx` (T1과 동일 파일, 별개 라인) |
| T3 | pykrx → yfinance 교체 | 3 | `update_prices.py`, 루트 `requirements.txt`, `api/requirements.txt` |
| T4 | 갱신 버튼 데이터 출처 표기 | 1 | `app/page.tsx` |
| T5 | 비교 탭 그룹 관리 드롭다운 | 5 | `db.py`, `schemas.py`, `portfolios.py`, `portfolio.ts`, `comparison/page.tsx` |

> **순서 의존성**: T1·T2는 독립. T3·T4는 독립. T5는 독립.  
> T1·T2는 같은 파일이므로 한 번에 편집.

---

## T1: ETF 행 입력 UI 순서 반전 (방향 A)

### 변경 파일
`frontend/app/portfolio/page.tsx`

### 현재 구조 (406~445줄)
```
<div className="space-y-0.5">
  <div className="flex gap-2">            ← 코드·비중·X 입력 행
    ...
  </div>
  {row.name && (                          ← ETF명·구분 보조 정보
    <div className="flex items-center gap-1.5 pl-1">
      ...
    </div>
  )}
</div>
```

### 변경 후 구조
```
<div className="space-y-0.5">
  {row.name && (                          ← ETF명·구분 먼저
    <div className="flex items-center gap-1.5 pl-1">
      ...
    </div>
  )}
  <div className="flex gap-2">            ← 코드·비중·X 입력 행 아래
    ...
  </div>
</div>
```

### 범위
- `{row.name && ...}` 블록을 `flex gap-2` div **위로** 이동.
- 내용(className, 텍스트, 로직) 변경 없음.

### 검증
- ETF 코드 미입력 상태: 첫 줄 없이 코드·비중 인풋만 표시됨 (`row.name` falsy → 렌더링 안 됨)
- ETF 코드 입력 후: 이름+구분 뱃지가 위, 코드+비중 인풋이 아래

---

## T2: 자산군 한도 계산 버그 수정

### 변경 파일
`frontend/app/portfolio/page.tsx`

### 변경 위치
138줄 (`assetClassStatus` useMemo 내부)

### 현재 코드
```ts
const base = totalWeight > 0 ? totalWeight : 100;
```

### 변경 후 코드
```ts
const base = 100;
```

### 이유
한도 체크는 "포트폴리오 순자산 100% 대비 절대 비중" 기준이어야 함.  
현재 코드는 `totalWeight`(예: 90%)로 나누어 모든 자산군 비중이 부풀려짐.

예시 (총합 90% 시):
- 수정 전: 국내주식_지수 30% 입력 → `30/90 = 33.3%` → 30% 한도 **초과 오판정**
- 수정 후: `30/100 = 30%` → 30% 한도 **통과 정상**

### 검증
- 비중 합계 90%에서 각 자산군이 정확히 한도 비중 이하이면 "통과" 표시되어야 함
- 실제로 한도를 초과한 경우만 "초과" 표시

---

## T3: pykrx → yfinance 교체

### 변경 파일 3개

#### 1. `requirements.txt` (루트)
```
# 변경 전
pykrx>=1.0.0

# 변경 후
yfinance>=0.2.0
```

#### 2. `api/requirements.txt`
```
# 변경 전
pykrx

# 변경 후
yfinance
```
> CLAUDE.md Note: "api/requirements.txt에 pykrx가 설치됨 — `_run_refresh()` subprocess 실행을 위해 필요"  
> 이유가 동일하게 yfinance로 이전됨. api/ 내 import 금지 원칙은 그대로 유지.

#### 3. `src/update_prices.py`

**제거:**
- `from pykrx import stock` import 블록 (30~36줄)
- `compact_day()` 함수 (49~51줄) — pykrx 전용 YYYYMMDD 포맷, yfinance는 불필요
- `fetch_daily_close()` 함수 본문 전체 (82~105줄)
- `PYKRX_IMPORT_ERROR` 참조

**추가 (import):**
```python
try:
    import yfinance as yf
except ImportError as exc:
    yf = None
    YFINANCE_IMPORT_ERROR = exc
else:
    YFINANCE_IMPORT_ERROR = None
```

**변경: `fetch_daily_close()` 함수 본문**
```python
def fetch_daily_close(code: str, start: date, end: date) -> pd.DataFrame:
    if yf is None:
        raise RuntimeError(
            "yfinance is required. Install with `pip install yfinance`."
        ) from YFINANCE_IMPORT_ERROR
    if start > end:
        return pd.DataFrame(columns=PRICE_COLUMNS)

    ticker = f"{code}.KS"
    # yfinance end는 exclusive이므로 +1일
    df = yf.download(
        ticker,
        start=start.isoformat(),
        end=(end + timedelta(days=1)).isoformat(),
        progress=False,
        auto_adjust=True,
    )
    if df.empty:
        return pd.DataFrame(columns=PRICE_COLUMNS)

    df = df[["Close"]].reset_index()
    df.columns = ["date", "close"]
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    df["code"] = code
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    return df[PRICE_COLUMNS].dropna(subset=["date", "close"])
```

**파일 상단 docstring 수정:**  
"pykrx" 참조를 "yfinance" 로 교체. 티커 형식 `.KS` 언급 추가.

### 주의사항 (구현 시 확인 필요)

1. **KOSPI/KOSDAQ 구분**: 현재 포트폴리오 ETF는 전부 KOSPI 상장이므로 `.KS` 접미사 동작.  
   KOSDAQ 상장 ETF가 추가될 경우 `.KQ` 필요 — 지금 범위 밖, 주석으로 명시.

2. **yfinance 다중 컬럼 형식 변경**: yfinance >= 0.2.x는 멀티인덱스 컬럼 반환 가능.  
   `df[["Close"]]` 접근 시 `df.columns.get_level_values(0)` 처리 필요 여부를 구현 시 확인.

3. **`compact_day()` 제거**: 이 함수를 호출하는 곳이 `fetch_daily_close()` 외에 없는지 파일 내 확인 후 제거.

4. **`--dry-run` 경로**: `update_prices()` 함수의 `dry_run=True` 경로는 `load_existing_prices()`(CSV)를 쓰는데 `fetch_daily_close()`를 공유하므로 변경 없이 동작.

### 검증
- `python src/update_prices.py --code 069500 --dry-run` 실행 시 종가 행이 반환되어야 함
- 종가값이 pykrx와 유사한 수준인지 확인

---

## T4: 갱신 버튼 데이터 출처 표기

### 변경 파일
`frontend/app/page.tsx`

### 변경 내용
갱신 버튼 아래(또는 옆)에 작은 텍스트로 데이터 출처 표기.

**추가 위치**: `handleRefresh` 버튼 렌더링 블록 직후 (현재 약 340~350줄)

```tsx
{/* 현재 운용 갱신 버튼 */}
<button ... >{refreshLabel}</button>

{/* 출처 표기 (신규 추가) */}
<span style={{ fontSize: 10, color: "#8595A6", fontFamily: "JetBrains Mono, monospace" }}>
  Yahoo Finance
</span>
```

### 레이아웃
버튼과 같은 flex container 안에 두거나, 버튼 바로 아래 `mt-0.5` 줄로 배치.  
기존 `refreshing` 상태 표시(`1/2 가격 수집 중...` 텍스트)와 겹치지 않도록 배치 확인 필요.

### 검증
- 갱신 중(`refreshing=true`)과 아닐 때 모두 "Yahoo Finance" 텍스트가 표시됨
- 기존 에러 메시지(`refreshError`) 표시와 겹치지 않음

---

## T5: 포트폴리오 비교 탭 그룹 관리 드롭다운

### 현재 상태 분석
- DB `portfolios` 테이블에 `group_name TEXT` 컬럼 이미 존재 (Railway 콘솔 SQL 불필요)
- `db.upsert_portfolio()` → `group_name` 저장 이미 구현
- `list_portfolios()` → `group_name` 반환 이미 구현
- `schemas.py` → `Portfolio.group_name: str | None` 이미 존재
- `portfolios.py` → `GET /api/portfolios` 이미 `group_name` 반환
- **누락**: `group_name`만 단독으로 바꾸는 PATCH 엔드포인트 없음 → UI에서 변경 불가 → 모두 "기타"로 고정

### 변경 파일 5개

---

#### 1. `db.py` — `update_portfolio_group()` 함수 추가

기존 `upsert_portfolio()` 뒤에 추가:

```python
def update_portfolio_group(name: str, group_name: str | None) -> None:
    """포트폴리오의 group_name만 업데이트."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE portfolios SET group_name = %s, updated_at = NOW() WHERE name = %s",
                (group_name, name),
            )
        conn.commit()
```

---

#### 2. `api/schemas.py` — `PortfolioGroupRequest` 모델 추가

기존 `PortfolioUpsertResponse` 뒤에 추가:

```python
class PortfolioGroupRequest(BaseModel):
    group_name: str | None = None
```

---

#### 3. `api/routers/portfolios.py` — PATCH 엔드포인트 추가

`DELETE /api/portfolios/{name}` 앞에 추가:

```python
@router.patch("/portfolios/{name}/group", status_code=200)
def update_portfolio_group(name: str, payload: schemas.PortfolioGroupRequest):
    if not _ensure_db():
        raise HTTPException(status_code=503, detail="DB unavailable")
    db.update_portfolio_group(name, payload.group_name or None)
    return {"name": name, "group_name": payload.group_name or None}
```

**라우트 충돌 확인:**
- 기존: `PATCH /api/portfolios/active/holdings` → `active`가 리터럴 세그먼트
- 신규: `PATCH /api/portfolios/{name}/group` → `{name}`이 와일드카드
- FastAPI는 리터럴 경로를 와일드카드보다 우선 매칭하므로 `active/holdings`는 안전하게 유지됨

---

#### 4. `frontend/lib/hooks/portfolio.ts` — `useUpdatePortfolioGroup` 훅 추가

```ts
export function useUpdatePortfolioGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, groupName }: { name: string; groupName: string | null }) =>
      patch(`/api/portfolios/${encodeURIComponent(name)}/group`, { group_name: groupName }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["portfolio-list"] });
    },
  });
}
```

> `patch()`는 `lib/api.ts`에 이미 존재하는지 확인 필요. 없으면 `put()` 또는 `post()` 대신 사용.

---

#### 5. `frontend/app/comparison/page.tsx` — 그룹 드롭다운 UI 추가

**추가 state:**
```ts
const [newGroupInput, setNewGroupInput] = useState<Record<string, string>>({});
```

**기존 그룹 목록 도출:**
```ts
const existingGroups = useMemo(
  () => [...new Set((portfolioList ?? []).map((p) => p.group_name).filter(Boolean) as string[])].sort(),
  [portfolioList],
);
```

**테이블 내 포트폴리오명 셀 변경 (819줄 부근):**

현재:
```tsx
<td className="px-4 py-3 font-medium text-ink">
  {item.portfolio_name}
</td>
```

변경 후:
```tsx
<td className="px-4 py-3 font-medium text-ink">
  <div className="flex flex-col gap-0.5">
    <span>{item.portfolio_name}</span>
    <GroupSelect
      portfolioName={item.portfolio_name}
      currentGroup={groupMap[item.portfolio_name] ?? null}
      existingGroups={existingGroups}
      onUpdate={updateGroupMutation.mutate}
    />
  </div>
</td>
```

**`GroupSelect` 컴포넌트 (comparison/page.tsx 상단 또는 별도 파일):**

```tsx
function GroupSelect({
  portfolioName,
  currentGroup,
  existingGroups,
  onUpdate,
}: {
  portfolioName: string;
  currentGroup: string | null;
  existingGroups: string[];
  onUpdate: (args: { name: string; groupName: string | null }) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newVal, setNewVal] = useState("");

  const allOptions = ["기타", ...existingGroups.filter((g) => g !== "기타")];

  if (showNew) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          className="w-24 rounded border border-border px-1.5 py-0.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary/30"
          placeholder="그룹명 입력"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newVal.trim()) {
              onUpdate({ name: portfolioName, groupName: newVal.trim() });
              setShowNew(false);
              setNewVal("");
            }
            if (e.key === "Escape") { setShowNew(false); setNewVal(""); }
          }}
        />
        <button onClick={() => { setShowNew(false); setNewVal(""); }}
          className="text-xs text-inkMuted hover:text-ink">취소</button>
      </div>
    );
  }

  return (
    <select
      value={currentGroup ?? "기타"}
      onChange={(e) => {
        const val = e.target.value;
        if (val === "__new__") { setShowNew(true); return; }
        onUpdate({ name: portfolioName, groupName: val === "기타" ? null : val });
      }}
      className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-inkSecondary focus:outline-none focus:ring-1 focus:ring-primary/30"
    >
      {allOptions.map((g) => (
        <option key={g} value={g}>{g}</option>
      ))}
      <option value="__new__">+ 새 그룹</option>
    </select>
  );
}
```

**`updateGroupMutation` 추가:**
```ts
const updateGroupMutation = useUpdatePortfolioGroup();
```

---

## 충돌·누락 점검 체크리스트

| 항목 | 상태 |
|------|------|
| T1·T2 같은 파일 — 라인 138 vs 436~445, 독립적 | ✅ 충돌 없음 |
| T3 `compact_day()` 제거 — 호출처 `fetch_daily_close()` 안에만 있음 | ✅ 안전 |
| T3 `--dry-run` 경로: `load_existing_prices()` CSV 경로 영향 없음 | ✅ 안전 |
| T4 `refreshing` 상태 텍스트와 "Yahoo Finance" 표기 겹침 여부 | ⚠️ 배치 확인 필요 |
| T5 `PATCH /api/portfolios/{name}/group` vs `PATCH /api/portfolios/active/holdings` 충돌 | ✅ FastAPI 리터럴 우선 매칭으로 안전 |
| T5 `patch()` 함수 `lib/api.ts` 존재 여부 | ⚠️ 구현 전 확인 필요 |
| T5 그룹 변경 시 `comparison-nav` 쿼리 invalidate 불필요 (nav 데이터 변경 없음) | ✅ `portfolio-list`만 invalidate로 충분 |
| T5 DB `group_name` 컬럼 — 이미 존재, Railway SQL 추가 불필요 | ✅ 마이그레이션 없음 |
| CLAUDE.md `pykrx only for ETF price collection` 문구 — T3 완료 후 yfinance로 수정 필요 | ⚠️ 별도 CLAUDE.md 수정 |
| CLAUDE.md CRITICAL-2 `api/ must not import pykrx` → `yfinance` 로 업데이트 필요 | ⚠️ 별도 CLAUDE.md 수정 |
| `api/requirements.txt` 주석 "pykrx 설치됨" 관련 CLAUDE.md Note 업데이트 필요 | ⚠️ CLAUDE.md 수정 |

---

## 변경 파일 전체 목록

| 파일 | 작업 |
|------|------|
| `frontend/app/portfolio/page.tsx` | T1 (UI 순서) + T2 (버그 수정) |
| `frontend/app/page.tsx` | T4 (출처 표기) |
| `frontend/app/comparison/page.tsx` | T5 (그룹 드롭다운 UI) |
| `frontend/lib/hooks/portfolio.ts` | T5 (훅 추가) |
| `src/update_prices.py` | T3 (yfinance 교체) |
| `requirements.txt` | T3 (의존성 교체) |
| `api/requirements.txt` | T3 (의존성 교체) |
| `api/schemas.py` | T5 (`PortfolioGroupRequest` 추가) |
| `api/routers/portfolios.py` | T5 (PATCH 엔드포인트 추가) |
| `db.py` | T5 (`update_portfolio_group()` 추가) |
| `CLAUDE.md` | T3 완료 후 pykrx→yfinance 문구 3곳 업데이트 |

**총 11개 파일 변경, 신규 파일 없음**

---

## 구현 순서 권장

1. T2 (버그 수정, 1줄) — 단순, 먼저 처리
2. T1 (UI 순서) — T2와 같은 파일, 이어서 처리
3. T3 (yfinance 교체) — 독립, 테스트 가능
4. T4 (출처 표기) — 단순 UI 추가
5. T5 (그룹 관리) — 가장 많은 파일, 마지막 처리
6. CLAUDE.md 업데이트 — 모든 T3 완료 후
