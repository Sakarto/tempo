# Tempo

Local-first day planner that re-flows your day after every check-in. Spec: SPEC.md · Features: features.json · Log: PROGRESS.md

## Commands
- Start (installs + dev server): `./init.sh`
- Test (all): `npm test` · one file: `npx vitest run src/core/x.test.ts`
- Build: `npm run build` · Lint: `npm run lint` · Types: `npm run typecheck`

## Rules
- Use the nightly-build skill for any unattended or "build the next feature" work.
- Read CONSTRAINTS.md before writing code. IMPORTANT: never weaken it, a test, or features.json steps to make a change pass.
- Never commit `.env` or secrets; add new variables to `.env.example`.

## Conventions
Pure logic in src/core (times = minutes since midnight). Copy patterns from src/core/scheduler.ts.

## Gotchas
- vitest uses jsdom + fake-indexeddb (src/test-setup.ts).

## When compacting
Preserve: the current feature id, files changed this run, test commands and their last results, open blockers.
