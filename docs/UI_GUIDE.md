# UI_GUIDE.md - DBGAPS Streamlit Implementation Guide

This guide translates `DESIGN.md` and `DESIGN-LANGUAGE.md` into the current Streamlit dashboard implementation.

## Stack

- Python
- Streamlit
- Plotly
- pandas
- Data source: generated files under `output/`

The dashboard must not import `src/`, import `pykrx`, fetch live data, or recalculate portfolio metrics.

## File Responsibilities

```text
web/
  app.py          # Page composition and layout order
  components.py   # KPI, status, chart, badge, and table renderers
  data_loader.py  # Reads output/ files only
  style.py        # CSS injection, tokens, formatting helpers
```

Rules:
- `app.py` should stay small and orchestration-focused.
- `components.py` should not read files.
- `data_loader.py` should not calculate metrics.
- `style.py` should not load data.

## Page Structure

Preferred order:

```text
1. Compact status bar
2. KPI strip
3. NAV vs benchmark chart and drawdown chart
4. Rules and turnover section
5. Holdings table
6. Monthly report summary, when available
```

## Status Bar

Show:
- Data freshness.
- Whether outputs are sample or real data when known.
- Benchmark code when available.
- Quiet warning only if required files are missing.

Avoid:
- Large `st.info` blocks for normal state.
- Vague copy such as "Data loaded".

## KPI Strip

Recommended KPIs:
- Cumulative return
- CAGR
- MDD
- Sharpe
- Annual volatility
- Benchmark excess return, when available

Rendering rules:
- Use compact custom metric cards.
- Values use tabular numerals.
- Percentages use consistent precision.
- Missing values render as `N/A`.
- Risk metrics explain direction where needed.

## Charts

NAV chart:
- Normalize portfolio and benchmark to 100.
- Use portfolio as primary indigo line.
- Use benchmark as muted dashed or secondary line.
- Include benchmark code in legend.

Drawdown chart:
- Show negative drawdown below zero.
- Use restrained danger fill.
- Avoid large chart titles inside the Plotly frame; prefer surrounding section labels.

Monthly returns:
- Use bar or heatmap only after monthly return output exists.
- Do not calculate monthly returns inside `web/` if the engine can export them.

## Rules And Turnover

Rules:
- Individual ETF 20% limit.
- Risk asset 70% limit.
- Initial turnover 80% limit.
- Weekly turnover 10% limit.
- Monthly turnover 10% limit.

Display each item with:
- Name.
- Current value.
- Limit.
- Status: pass, warning, fail, or no data.

Turnover labels must distinguish:
- Actual trade turnover.
- Rebalance turnover.
- Cumulative turnover.
- Period turnover.

## Holdings Table

Required behavior:
- Keep ETF code visible.
- Format quantities, prices, market value, unrealized PnL, return, and current weight.
- Use concise column names.
- Avoid garbled labels.
- Allow horizontal scroll on narrow screens.

Preferred column order:

```text
code, name, quantity, avg_price, current_price, market_value,
current_weight, unrealized_pnl, unrealized_return, risk_type, asset_class
```

## CSS And Tokens

Use `design-tokens.json` as the source for:
- Colors.
- Radius.
- Spacing.
- Shadows.
- Numeric typography.

`web/style.py` should expose:
- `inject_global_style()`
- color constants or token lookup helpers
- formatting helpers for percent, amount, ratio, and date labels

## Responsive Rules

Desktop:
- KPI strip can use 5 or 6 columns.
- NAV and drawdown can sit side by side.
- Rules and turnover may sit side by side.

Tablet/mobile:
- Stack charts vertically.
- Use one or two KPI columns depending on width.
- Tables may scroll horizontally.
- Avoid long status text in badges.

## Implementation Guardrails

- Do not add new UI dependencies before proving Streamlit + Plotly cannot handle the job.
- Do not introduce React, Tailwind, or shadcn into this Streamlit app.
- Do not copy Stripe or StyleSeed components directly.
- Do not use live data requests in the dashboard.
- Do not modify `output/` manually to make UI examples work.

## Done Criteria

- The UI follows `DESIGN.md`.
- The UI passes `QA_CHECKLIST.md`.
- Boundary tests continue to pass.
- The dashboard remains read-only and output-driven.
