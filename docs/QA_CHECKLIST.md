# QA_CHECKLIST.md - DBGAPS UI Review

Use this checklist before shipping dashboard design or UX changes.

## Product Fit

- [ ] The screen reads as an internal financial operations dashboard.
- [ ] There is no marketing hero, pricing section, or decorative landing-page pattern.
- [ ] The page does not imply automated investment advice or trading execution.

## Data Integrity

- [ ] Data freshness is visible near the top.
- [ ] Benchmark labels include the benchmark code when shown.
- [ ] KPI units are visible and unambiguous.
- [ ] Rule badges show current value, limit, and pass/warn/fail state.
- [ ] Missing data is shown as `N/A` or a quiet empty state, not as misleading zeroes.

## Visual Quality

- [ ] No pure black `#000000` is used for text.
- [ ] Indigo is used sparingly.
- [ ] Cards are not nested.
- [ ] The page is not dominated by a single hue family.
- [ ] Spacing creates hierarchy without wasting vertical space.
- [ ] Shadows are subtle and rare.

## Typography And Labels

- [ ] No garbled Korean or broken labels remain.
- [ ] Financial terms are specific and concise.
- [ ] Numeric values use tabular figures where possible.
- [ ] Long labels do not overflow their containers.

## Charts

- [ ] NAV is normalized to 100 when compared with benchmark.
- [ ] Drawdown is shown below zero.
- [ ] Legends are meaningful and not vague.
- [ ] Axis labels and units are clear.
- [ ] No decorative 3D, animation, or chart clutter is present.

## Tables

- [ ] ETF code is visually distinct, preferably monospace.
- [ ] Numeric columns are right-aligned or clearly formatted.
- [ ] Tables remain readable at desktop width.
- [ ] Tables can scroll horizontally on mobile without breaking surrounding layout.

## Responsive Behavior

- [ ] Desktop layout uses columns only where they improve comparison.
- [ ] Mobile layout stacks without overlap.
- [ ] Text inside cards, buttons, and badges does not overflow.
- [ ] Chart legends do not cover chart content.

## Architecture

- [ ] `frontend/` does not import `src`.
- [ ] `frontend/` does not import `pykrx`.
- [ ] Dashboard reads from `output/` only (via FastAPI).
- [ ] Calculation logic stays outside the UI.
