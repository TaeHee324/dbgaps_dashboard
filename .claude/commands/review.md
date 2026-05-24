# Review Command

Review the project changes for correctness, architecture, tests, and UI quality.

Read first:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`

If any changed file is under `web/`, or if the change affects dashboard UI, UX, frontend copy, charts, tables, visual styling, or user-facing labels, also read:

- `/docs/DESIGN.md`
- `/docs/DESIGN-LANGUAGE.md`
- `/docs/UI_GUIDE.md`
- `/docs/design-tokens.json`
- `/docs/QA_CHECKLIST.md`

## Checklist

| Item | Result | Notes |
|------|--------|-------|
| Architecture alignment | PASS/FAIL | Does the change follow the documented directory and module boundaries? |
| ADR alignment | PASS/FAIL | Does the change respect existing architecture decisions? |
| Critical boundary rules | PASS/FAIL | Does `web/` avoid importing `src` or `pykrx`? |
| Tests | PASS/FAIL | Are relevant tests present and passing? |
| Output contract | PASS/FAIL | Are generated output schemas preserved or intentionally updated with tests/docs? |
| Design authority | PASS/FAIL/N/A | For UI work, does the change follow `docs/DESIGN.md` and `docs/DESIGN-LANGUAGE.md`? |
| UI guide | PASS/FAIL/N/A | For UI work, does the change follow `docs/UI_GUIDE.md` responsibilities? |
| UI QA checklist | PASS/FAIL/N/A | For UI work, were relevant `docs/QA_CHECKLIST.md` items checked? |
| Labels and financial context | PASS/FAIL/N/A | Are labels readable, non-garbled, and clear about units/source date? |

Flag architecture, data-integrity, and boundary violations before visual polish issues.

If there are findings, list them first with file and line references where possible. If no issues are found, say so and mention any remaining test or visual QA gaps.
