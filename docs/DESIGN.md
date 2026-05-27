# DESIGN.md - DBGAPS Dashboard

## Role

This file is the source of truth for the product's visual direction. Any AI or human editing the dashboard UI should read this before changing `frontend/` or frontend-facing text.

DBGAPS is an internal financial operations dashboard for ETF portfolio review. It is not a marketing site, landing page, trading signal product, or consumer investment app.

## Design Position

The visual direction is Stripe-inspired fintech restraint, adapted for an internal dashboard.

Borrow:
- White canvas with very light blue-gray surfaces.
- Deep navy text instead of pure black.
- Sparse indigo accents for active state, benchmark emphasis, and primary status.
- Precise tabular numerals for prices, returns, weights, and KPIs.
- Fine borders, subtle shadows, and tight but readable spacing.
- Clean dashboard mockup discipline: panels should look measured and operational.

Do not borrow:
- Marketing hero sections.
- Pricing/CTA page rhythm.
- Large atmospheric gradient mesh as a dominant background.
- Brand assets, logos, copy, or layout from Stripe.
- Decorative product mockups that do not show real dashboard state.

StyleSeed is used as the design judgment layer: prevent generic AI UI patterns, enforce hierarchy, and validate accessibility, density, and component variation.

References:
- https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/stripe/DESIGN.md
- https://github.com/bitjaru/styleseed

## Product Character

- Dense: show portfolio status, risk, rules, turnover, benchmark context, and holdings without forcing unnecessary navigation.
- Calm: avoid alarm-heavy visuals unless a rule is actually violated.
- Auditable: every major value should make its source date or calculation context discoverable.
- Data-first: tables, numbers, and charts are primary UI, not decoration.
- Read-only by default: the dashboard displays generated outputs; it does not edit portfolios or fetch live data.

## Visual Language

### Color

Use a light financial SaaS palette:

| Role | Token | Hex |
|---|---|---|
| Page background | `background` | `#F8FAFC` |
| Surface | `surface` | `#FFFFFF` |
| Muted surface | `surfaceMuted` | `#F6F9FC` |
| Cream band, rare | `surfaceCream` | `#FFF8ED` |
| Primary text | `ink` | `#0D253D` |
| Secondary text | `inkSecondary` | `#64748B` |
| Muted text | `inkMuted` | `#94A3B8` |
| Border | `border` | `#E2E8F0` |
| Primary accent | `primary` | `#533AFD` |
| Primary pressed | `primaryPressed` | `#4434D4` |
| Success | `success` | `#16A34A` |
| Warning | `warning` | `#D97706` |
| Danger | `danger` | `#DC2626` |

Rules:
- Do not use pure black `#000000`.
- Indigo is an accent, not a theme wash.
- Red is reserved for loss, drawdown, or rule violation.
- Green is reserved for passing status or positive performance.
- Avoid one-note blue/purple pages. Use neutral surfaces and semantic colors.

### Typography

- Use system UI fonts for reliability.
- Use deep navy for primary text.
- Use tabular numerals for all KPIs, percentages, quantities, prices, and money.
- Keep dashboard headings compact. Do not use marketing-scale hero typography.
- Do not make every section title the same size. Create hierarchy by role:
  - Page title: product/context.
  - Section title: view area.
  - Metric label: small and muted.
  - Metric value: tabular and prominent.

### Layout

Preferred desktop order:

```text
Status bar
KPI strip
NAV and drawdown charts
Rules and turnover
Holdings table
Report summary, when available
```

Rules:
- Information density should increase as the user scrolls.
- Use full-width bands or clean sections, not nested decorative cards.
- Use cards only for repeated metric tiles, rule statuses, or framed data modules.
- Keep card radius at 8px by default; 12px is acceptable for larger framed panels.
- Use subtle borders before shadows. Shadows must be light and rare.
- Mobile layout collapses into one column; complex chart/table panels stack vertically.

### Components

KPI cards:
- Show label, value, unit, and optional context.
- Use tabular numerals.
- Negative risk metrics such as MDD should not look like ordinary "badges"; make the semantic meaning explicit.
- Avoid oversized cards. Five or six KPI cards should fit comfortably on desktop.

Status bar:
- Always show data freshness.
- Show whether outputs are sample or real data when that is known.
- Use a quiet, compact treatment.

Rule badges:
- Use compact status pills or rows.
- Include rule name, current value, limit, and status.
- Do not rely on color alone.

Charts:
- NAV chart should normalize to 100 when comparing portfolio vs benchmark.
- Drawdown chart should use negative territory and a restrained danger fill.
- Axes and legends must be clear. No decorative 3D, animation, or chart clutter.
- Include benchmark code in the legend when applicable.

Tables:
- Tables are first-class UI.
- ETF code columns should use monospace.
- Numeric columns should be right-aligned and formatted.
- Avoid hiding important columns for visual cleanliness unless there is a clear alternate detail path.

## Forbidden Patterns

- Marketing hero page for the dashboard.
- Decorative gradient blobs, orbs, or bokeh backgrounds.
- Full-screen purple/blue gradient treatment.
- Overusing cards for every section.
- Pure black text.
- Generic labels such as "Data", "Chart", "Info" when specific financial labels are available.
- Broken or garbled Korean labels.
- AI investment advice language such as "buy signal", "sell signal", "recommendation", or "AI pick".
- `frontend/` importing from `src/`.
- `frontend/` importing `pykrx` or fetching live market data.
- Dashboard code recalculating metrics instead of reading `output/` (via API).

## Implementation Contract

- `frontend/app/`: Next.js App Router 페이지 (page.tsx per route).
- `frontend/components/`: 재사용 UI 컴포넌트 (charts/, ui/).
- `frontend/lib/api.ts`: fetch 래퍼 (get, post, del).
- `frontend/lib/hooks/`: TanStack Query 훅 (dashboard.ts, portfolio.ts, trades.ts).
- `frontend/lib/utils/metrics.ts`: 순수 계산 유틸 (computeActualOpsMetrics, computeStrategyMetrics).
- `docs/design-tokens.json`: machine-readable design tokens.
- `docs/DESIGN-LANGUAGE.md`: design judgment rules and anti-pattern checks.
- `docs/QA_CHECKLIST.md`: visual and UX review checklist before shipping UI changes.

## Review Standard

Before a UI change is considered done:
- Run boundary tests if code changed.
- Verify no `frontend/` import from `src`.
- Check desktop and mobile layout.
- Confirm no text overflow.
- Confirm all financial values have labels and units.
- Confirm data freshness is visible.
- Confirm the UI still reads as an internal operations dashboard, not a marketing page.
