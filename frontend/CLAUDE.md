@AGENTS.md

## Commands

```bash
npm run dev      # 개발 서버 (port 3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npx tsc --noEmit # 타입 체크
```

## Components

- `components/charts/`: TradingView Lightweight Charts v5 래퍼
- `components/ui/`: 공통 UI 컴포넌트 (badge, table, card 등)

## Routes

구현된 라우트: `/`, `/risk`, `/comparison`, `/portfolio`, `/trades`, `/report`, `/changelog`  
플레이스홀더(준비중): `/market`, `/rules`, `/research`  
`/operations` → `redirect("/")` 래퍼

## Patterns

- 데이터 훅은 `lib/hooks/` 사용 (`dashboard.ts`, `portfolio.ts`, `trades.ts`)
- 운용현황 페이지는 반드시 `useLiveHoldings()` 사용 (`useCurrentHoldings()` 레거시)
- `fetch()` 직접 사용 금지 — `lib/api.ts`의 `get()`/`post()` 또는 `NEXT_PUBLIC_API_URL` 접두어 사용. 상대 URL `/api/...`은 Next.js 서버로 라우팅되어 FastAPI에 도달하지 못함.

## KPI 계산 패턴

`/` 페이지 KPI는 `lib/utils/metrics.ts`의 두 함수로 분리됨:
- `computeActualOpsMetrics(actualNav)` → `ActualOpsKpiStrip`: 실제 거래 기반 (누적수익률, MDD, 일간승률)
- `computeStrategyMetrics(strategyPoints)` → `StrategyKpiStrip`: 백테스트 기반 (CAGR, 샤프, 칼마)

`computeStrategyMetrics()`에 백테스트 nav의 `cumulative_return`/`drawdown`을 그대로 쓰지 말 것 — 기간 필터 후 `portfolio_value`로 구간 내 직접 재계산 필요.
