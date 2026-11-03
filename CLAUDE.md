# Tempo

Local-first day planner that auto re-flows your day after each check-in; first user is Avy. Spec: SPEC.md · Features: features.json · Log: PROGRESS.md

## Commands
- Start (installs + dev server): `./init.sh`
- Test (all): `npm test` · Test (one file): `npx vitest run src/core/scheduler.test.ts`
- Build: `npm run build` · Types: `npm run typecheck` · Lint: `npm run lint`

## Rules
- Use the nightly-build skill for any unattended or "build the next feature" work.
- Read CONSTRAINTS.md before writing code. IMPORTANT: never weaken it, a test, or features.json steps to make a change pass.
- Never commit `.env` or secrets.

## Conventions
- Pure logic in `src/core/` (minutes since midnight as integers); no DOM or storage there. Copy patterns from `src/core/scheduler.ts`.
- Task durations never shrink; fixed events never move.

## Gotchas
- tsconfig has `erasableSyntaxOnly`: no enums or parameter properties.

## When compacting
Preserve: the current feature id, files changed this run, test commands and their last results, open blockers.
