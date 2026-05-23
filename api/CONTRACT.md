# api/CONTRACT.md — DBGAPS API Contract

FastAPI 백엔드가 구현해야 할 모든 엔드포인트와 응답 형식 계약.  
**Phase 1A 세션**은 이 파일을 구현 기준으로 삼고, **Phase 4**에서 실제 응답과 대조한다.

---

## 공통 규약

### Date 직렬화
- 모든 `date` 필드: **`"YYYY-MM-DD"` 문자열** (예: `"2026-05-23"`)
- TradingView LightweightCharts v5가 이 형식을 요구함
- pandas Timestamp → `ts.strftime("%Y-%m-%d")`

### 에러 처리
| 상황 | 응답 |
|------|------|
| CSV/JSON 파일 없음 | 빈 배열 `[]` 또는 `null` (엔드포인트별 명세 따름) |
| 존재하지 않는 리소스 | `404 {"detail": "not found"}` |
| 유효성 오류 | `422` (FastAPI 기본) |
| 500 에러 | **금지** — 파일 없음 등 예측 가능한 오류는 모두 빈 값으로 처리 |

### CORS
```python
# api/main.py 구현 예시
import os
from fastapi.middleware.cors import CORSMiddleware

origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
- 개발: `ALLOWED_ORIGINS=http://localhost:3000`
- 프로덕션: Railway Next.js public URL (예: `https://frontend-xxxx.up.railway.app`)

### Architecture Exception
`api/routers/portfolios.py`의 `POST /api/backtest` 핸들러에서만 `src/backtest`, `src/metrics`, `src/rules` import 허용.  
`api/` 내 다른 모든 파일에서 `src/` import 및 `pykrx` import 금지.

---

## 엔드포인트 명세

### Router: dashboard.py — `output/` 및 `data/` 읽기

#### GET /api/portfolio-summary

`output/portfolio_summary.csv` → 단일 행 직렬화.

```typescript
type PortfolioSummaryResponse = {
  cumulative_return: number    // 예: 0.1534
  cagr: number
  mdd: number                  // 최대낙폭 (음수, 예: -0.0823)
  alpha: number
  beta: number
  annual_volatility: number
  win_rate: number
  sharpe: number
  calmar: number
} | null                       // 파일 없으면 null
```

---

#### GET /api/holdings

`output/current_holdings.csv` → 배열 직렬화.  
(`output/portfolio_holdings.csv`는 Phase 4에서 삭제 예정인 중복 파일 — 이 엔드포인트에서 사용하지 않음)

```typescript
type Holding = {
  code: string
  name: string
  quantity: number
  avg_price: number
  cost_basis: number
  price_date: string           // "YYYY-MM-DD"
  current_price: number
  market_value: number
  unrealized_pnl: number
  unrealized_return: number
  current_weight: number
  risk_type: string
  asset_class: string
}
type HoldingsResponse = Holding[]  // 파일 없으면 []
```

---

#### GET /api/backtest-nav

`output/backtest_nav.csv` → 배열 직렬화.

```typescript
type NavPoint = {
  date: string                 // "YYYY-MM-DD"
  portfolio_value: number
  daily_return: number
  cumulative_return: number
  drawdown: number             // 음수 (예: -0.052)
  // benchmark_value: 현재 CSV에 없음 → 필드 포함하지 않음
}
type BacktestNavResponse = NavPoint[]  // 파일 없으면 []
```

---

#### GET /api/monthly-returns

`output/monthly_returns.csv` → 배열 직렬화.

```typescript
type MonthlyReturn = {
  year: number
  month: number
  monthly_return: number
}
type MonthlyReturnsResponse = MonthlyReturn[]  // 파일 없으면 []
```

---

#### GET /api/comparison/summary

`output/comparison/summary.csv` → 배열 직렬화.

```typescript
type ComparisonSummaryItem = {
  portfolio_name: string
  cagr: number
  mdd: number
  sharpe: number
  calmar: number
}
type ComparisonSummaryResponse = ComparisonSummaryItem[]  // 파일 없으면 []
```

---

#### GET /api/comparison/nav

`output/comparison/` 디렉토리 동적 스캔 → `{portfolio_name}_nav.csv` 패턴 읽기.  
파일이 추가돼도 코드 수정 없이 자동 반영.

```typescript
type ComparisonNavPoint = {
  date: string                 // "YYYY-MM-DD"
  portfolio_value: number
  cumulative_return: number
}
// key: 파일명에서 추출한 portfolio_name (예: "base", "aggressive")
type ComparisonNavResponse = Record<string, ComparisonNavPoint[]>
// 예: { "base": [...], "aggressive": [...] }
// 디렉토리 없거나 파일 없으면 {}
```

---

#### GET /api/rules

`output/rule_individual_etf.csv` + `output/rule_risk_asset.csv` → 병합 직렬화.

```typescript
type IndividualRule = {
  code: string
  name: string
  current_weight: number
  limit: number                // 예: 0.20
  excess: number               // current_weight - limit (음수면 규칙 준수)
  passed: boolean
}
type RiskAssetRule = {
  rule: string
  risky_weight: number
  limit: number                // 예: 0.70
  excess: number
  passed: boolean
}
type RulesResponse = {
  individual: IndividualRule[]
  risk_asset: RiskAssetRule
} | null                       // 파일 없으면 null
```

---

#### GET /api/turnover

`output/turnover_initial.csv`, `output/turnover_weekly.csv`, `output/turnover_monthly.csv` → 병합.

```typescript
type TurnoverBase = {
  traded_value: number
  turnover: number
  turnover_source: string
  limit: number
  passed: boolean
}
type TurnoverWithDate = TurnoverBase & {
  date: string                 // "YYYY-MM-DD"
}
type TurnoverResponse = {
  initial: TurnoverBase        // turnover_initial.csv — date 필드 없음
  weekly: TurnoverWithDate[]
  monthly: TurnoverWithDate[]
} | null                       // 파일 없으면 null
```

---

#### GET /api/data-date

`output/` 내 CSV 파일들 중 가장 최근 수정 시각 반환.

```typescript
type DataDateResponse = {
  date: string                 // "YYYY-MM-DD HH:MM" (예: "2026-05-22 10:00")
}
```

---

#### GET /api/etf-list

`data/prices_daily.csv`의 고유 code + `data/etf_master.csv`의 name 병합.

```typescript
type EtfItem = {
  code: string                 // 예: "069500"
  name: string                 // 예: "KODEX 200"
}
type EtfListResponse = EtfItem[]
```

---

#### GET /api/etf-prices/{code}

`data/prices_daily.csv`에서 code 필터링.

```typescript
// Path param: code (예: "069500")
type EtfPricePoint = {
  date: string                 // "YYYY-MM-DD"
  close: number
}
type EtfPricesResponse = EtfPricePoint[]
// code 미존재 또는 데이터 없으면 []  (404 반환하지 않음)
```

---

#### GET /api/report

`output/report_*.md` glob → 파일명 기준 최신 파일 반환.

```typescript
type ReportResponse = {
  content: string              // Markdown 전문
  filename: string             // 예: "report_202605.md"
} | null                       // 파일 없으면 null
```

---

### Router: portfolios.py — PostgreSQL CRUD + 실시간 백테스트

#### GET /api/portfolios

```typescript
type Portfolio = {
  name: string                 // 예: "base", "aggressive"
}
type PortfoliosResponse = Portfolio[]
```

---

#### GET /api/portfolios/{name}

```typescript
// Path param: name (예: "base")
type PortfolioHolding = {
  code: string
  weight: number               // 0.0 ~ 1.0
}
type PortfolioDetailResponse = PortfolioHolding[]
// 미존재 시: 404 {"detail": "not found"}
```

---

#### POST /api/portfolios

```typescript
// Request body
type PortfolioUpsertRequest = {
  name: string
  holdings: { code: string; weight: number }[]
}
// Response: 저장된 포트폴리오
type PortfolioUpsertResponse = {
  name: string
  holdings: { code: string; weight: number }[]
}
```

---

#### DELETE /api/portfolios/{name}

```
// Path param: name
// 성공: 204 No Content
// 미존재: 404 {"detail": "not found"}
```

---

#### POST /api/backtest

> **Architecture Exception** — 이 핸들러에서만 `src/backtest`, `src/metrics`, `src/rules` import 허용.

```typescript
// Request body
type BacktestRequest = {
  holdings: { code: string; weight: number }[]
  start_date?: string          // "YYYY-MM-DD". 없으면 데이터 전체 기간 시작
  end_date?: string            // "YYYY-MM-DD". 없으면 데이터 전체 기간 끝
}
// Response
type BacktestResponse = {
  nav: NavPoint[]              // /api/backtest-nav와 동일 shape
  summary: {                   // /api/portfolio-summary와 동일 shape (null 아님)
    cumulative_return: number
    cagr: number
    mdd: number
    alpha: number
    beta: number
    annual_volatility: number
    win_rate: number
    sharpe: number
    calmar: number
  }
  monthly: MonthlyReturn[]     // /api/monthly-returns와 동일 shape
  rules: RulesResponse         // /api/rules와 동일 shape
}
```

---

### Router: trades.py — 매매일지 CRUD

#### GET /api/trade-log

`data/trade_log.json` 읽기.

```typescript
type TradeLogEntry = {
  date: string                 // "YYYY-MM-DD"
  action: string               // 예: "매수", "매도", "리밸런싱"
  etf_code: string
  etf_name: string
  weight_before: number
  weight_after: number
  reason: string
  note: string
}
type TradeLogResponse = TradeLogEntry[]  // 파일 없거나 빈 배열이면 []
```

---

#### POST /api/trade-log

`data/trade_log.json`에 항목 append.

```typescript
// Request body
type AddTradeRequest = {
  date: string                 // "YYYY-MM-DD"
  action: string
  etf_code: string
  etf_name: string
  weight_before: number
  weight_after: number
  reason: string
  note: string
}
// Response: 추가된 항목
type AddTradeResponse = TradeLogEntry
```

> **영속성 주의**: `data/trade_log.json`은 파일시스템 쓰기. Railway 컨테이너는 재배포 시 초기화되므로 git 커밋된 상태로 돌아감. 현재 단계에서는 허용 — PostgreSQL 이전은 향후 과제.

---

## 구현 체크리스트 (Phase 1A 세션용)

- [ ] 모든 GET: 파일 없으면 `[]` 또는 `null` 반환, 500 에러 없음
- [ ] 모든 date 필드: `YYYY-MM-DD` 문자열 직렬화
- [ ] `ALLOWED_ORIGINS` 환경변수 기반 CORS
- [ ] `POST /api/backtest`만 `src/` import, 나머지 `api/` 파일 `src/` import 금지
- [ ] `api/` 전체 `pykrx` import 없음
- [ ] `GET /api/comparison/nav`: `output/comparison/` 동적 스캔
- [ ] `GET /api/report`: `output/report_*.md` glob 최신 파일
- [ ] `GET /api/holdings`: `output/current_holdings.csv` 사용 (`portfolio_holdings.csv` 사용 금지)
- [ ] `uvicorn api.main:app` 루트 실행 기준으로 `import db` 동작 확인
