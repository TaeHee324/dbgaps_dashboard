# Harness Workflow Guide

Use this guide when creating or updating project phases under `phases/`.

## Required Reading

For any phase:

- `/CLAUDE.md`
- `/docs/PRD.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/data_schema.md`
- `/PROJECT_STATUS.md`

For any UI, UX, dashboard, Streamlit, chart, table, frontend-copy, or visual-design phase, also read:

- `/DESIGN.md`
- `/DESIGN-LANGUAGE.md`
- `/docs/UI_GUIDE.md`
- `/design-tokens.json`
- `/QA_CHECKLIST.md`

## Workflow

### A. Explore

Read the required project documents and identify the relevant module boundaries.

For UI work, explicitly record which design files apply and what constraints they impose.

### B. Clarify

Resolve implementation decisions before writing steps.

Important questions:

- Does this change touch calculation, data collection, generated outputs, or dashboard rendering?
- Does this change require an output schema update?
- Does this change preserve `web/` reading from `output/` only?
- For UI work, does the change follow `DESIGN.md` and `DESIGN-LANGUAGE.md`?

### C. Step Design

Each step should:

- Be small and independently executable.
- Name the files it expects to read.
- Name the files it may edit.
- Include acceptance criteria.
- Include forbidden actions with reasons.
- Include validation commands where possible.

For UI steps, acceptance criteria must include:

- Relevant `QA_CHECKLIST.md` items.
- No `web/` import from `src`.
- No `web/` import from `pykrx`.
- No live data fetching from dashboard code.
- No garbled labels in edited UI areas.

### D. File Generation

Create or update:

- `phases/index.json`
- `phases/{phase-dir}/index.json`
- `phases/{phase-dir}/step{N}.md`

### E. Execution

Run phases with:

```bash
python scripts/execute.py <phase-dir>
python scripts/execute.py <phase-dir> --push
```

## Review Gate

Before considering a phase complete:

- Run or document relevant tests.
- Check architecture boundaries.
- For UI work, check `QA_CHECKLIST.md`.
- Update `PROJECT_STATUS.md` if the phase changes roadmap state.
