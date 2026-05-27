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

구현된 라우트: `/`, `/comparison`, `/portfolio`, `/trades`, `/report`, `/changelog`  
플레이스홀더(준비중): `/market`, `/rules`, `/research`  
`/operations` → `redirect("/")` 래퍼

## Patterns

- 데이터 훅은 `lib/hooks/` 사용 (`dashboard.ts`, `portfolio.ts`, `trades.ts`)
- 운용현황 페이지는 반드시 `useLiveHoldings()` 사용 (`useCurrentHoldings()` 레거시)
- `fetch()` 직접 사용 금지 — `lib/api.ts`의 `get()`/`post()` 또는 `NEXT_PUBLIC_API_URL` 접두어 사용. 상대 URL `/api/...`은 Next.js 서버로 라우팅되어 FastAPI에 도달하지 못함.
