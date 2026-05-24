# DESIGN-LANGUAGE.md - DBGAPS Design Judgment Rules

This file adapts the StyleSeed idea of design judgment to this Streamlit financial dashboard. It exists to stop generic AI UI from drifting into pretty but weak interfaces.

## Core Judgment

Good DBGAPS UI is calm, dense, readable, and auditable.

If a design choice makes the screen look more impressive but makes the portfolio state harder to scan, reject it.

## Anti-Patterns To Catch

- Using `#000` for text.
- Using the same heading size everywhere.
- Filling the page with blue or purple gradients.
- Making every section a card.
- Adding decorative cards inside other cards.
- Using large marketing copy above operational data.
- Hiding source dates, benchmark codes, limits, or units.
- Showing status only through color.
- Making charts visually rich but analytically unclear.
- Letting Streamlit default alerts dominate the hierarchy.
- Adding UI controls that imply the dashboard can trade, edit, or fetch live data.
- Keeping garbled Korean strings or unclear labels.

## Hierarchy Rules

1. Data freshness comes first.
2. Portfolio performance comes second.
3. Risk and rules come beside or immediately after performance.
4. Holdings detail comes after summary context.
5. Reports and narrative summaries come after raw dashboard evidence.

The user should understand this in under ten seconds:
- What data is this based on?
- How did the portfolio perform?
- How bad was the drawdown?
- Did any rule fail?
- What holdings explain the state?

## Density Rules

- Dense does not mean cramped.
- Use compact labels, consistent spacing, and predictable alignment.
- Prefer one strong table over many weak mini-cards.
- Prefer a compact status row over a large alert box.
- Keep whitespace purposeful: separate decisions, not decoration.

## Component Variation Rules

KPI cards should vary by semantic role:
- Return/performance: neutral with positive/negative value coloring.
- Risk: quiet but explicit, danger only when threshold is breached.
- Rule status: pass/warn/fail pill with value and limit.
- Data state: muted, timestamp-focused.

Do not create six identical cards if their meanings differ.

## Numeric Rules

- Use tabular numerals.
- Percentages should show a sign when direction matters.
- Amounts should use thousands separators.
- Ratios should use consistent decimal precision.
- Missing values should show `N/A`, not blank cells or misleading zeroes.

## Color Rules

- Text: deep navy, never pure black.
- Primary accent: indigo, used sparingly.
- Success/warning/danger: semantic only.
- Backgrounds: white or very light blue-gray.
- Do not create a page that reads as all-blue, all-purple, all-beige, or all-gray.

## Chart Rules

- Every chart needs a title or clear surrounding label.
- Every line needs a meaningful legend.
- Benchmark labels should include the code.
- Drawdown belongs below zero.
- Avoid 3D, animated, or decorative effects.
- Use color to clarify comparison, not to decorate.

## Table Rules

- Tables must remain readable on desktop and scrollable on mobile.
- ETF codes use monospace.
- Numeric columns align right.
- Important status columns should not be hidden.
- Conditional styling should be subtle and semantic.

## Mobile Rules

- Collapse multi-column charts into one column.
- Do not force complex dashboard mockups onto small screens.
- KPI cards may become a two-column grid or vertical stack.
- Tables may scroll horizontally, but surrounding text must not overflow.

## AI Review Loop

For any UI change, perform this review mentally even if no external StyleSeed tool is installed:

1. `ss-review`: Does the screen hierarchy match the dashboard job?
2. `ss-lint`: Are there generic AI UI artifacts such as repeated cards, random colors, or vague labels?
3. `ss-a11y`: Is contrast, text size, status labeling, and mobile behavior acceptable?
4. `ss-data`: Are source date, benchmark, units, and rule limits visible?

Stop and revise if any answer is weak.
