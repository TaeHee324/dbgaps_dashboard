# AGENTS.md - DBGAPS Dashboard Agent Instructions

This file governs the entire repository.

## Project Role

DBGAPS is an internal ETF portfolio operations dashboard. It is a read-only dashboard over generated `output/` files, not a marketing site, trading terminal, or investment recommendation product.

## Mandatory UI Design Context

For any work involving UI, UX, visual design, frontend copy, charts, tables, or files under `frontend/`, read these files first:

- `docs/DESIGN.md`
- `docs/DESIGN-LANGUAGE.md`
- `docs/UI_GUIDE.md`
- `docs/design-tokens.json`
- `docs/QA_CHECKLIST.md`

Follow this authority order:

1. `docs/DESIGN.md` for product character and visual direction.
2. `docs/DESIGN-LANGUAGE.md` for design judgment and anti-patterns.
3. `docs/UI_GUIDE.md` for UI implementation rules.
4. `docs/design-tokens.json` for visual tokens.
5. `docs/QA_CHECKLIST.md` for final UI review.

## Architecture Boundaries

- `api/` must not import `src/` (except `routers/portfolios.py` for backtest).
- `api/` must not import `pykrx` or fetch live data.
- `api/` reads from `output/` only (except portfolios router).
- Calculation logic belongs in `src/`.
- Data collection belongs in `src/update_prices.py`.
- `output/` is generated and should not be manually edited for UI convenience.

## UI Rules

- Keep the product feeling like a calm internal financial operations dashboard.
- Do not create a marketing hero page, pricing section, or decorative landing-page rhythm.
- Do not copy Stripe branding, copy, logos, or assets.
- Use Stripe-inspired restraint only: white/light surfaces, deep navy text, sparse indigo accents, precise numeric typography.
- Avoid pure black text, decorative gradient blobs, nested cards, vague labels, and repeated generic cards.
- Tables, charts, rules, turnover, benchmark context, and data freshness are first-class UI.
- Fix garbled UI labels when editing nearby UI code.

## Validation

- For UI work, check `docs/QA_CHECKLIST.md` before final response.
- For Python code changes, run `python -m pytest tests/ -q` when feasible.
- If tests are not run, state why.
