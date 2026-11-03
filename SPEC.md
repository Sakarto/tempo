# Spec: Tempo
## Objective
Local-first day planner for one person (first user: Avy, a student). Add tasks + fixed events; Tempo lays the day out
in free gaps, runs a timer per block, checks in at block end (Done / +15 / +30 / Stuck / break), re-flows the rest of
the day instantly, logs every session, and learns personal estimate multipliers per category.
Success = IDEA.md "Done means" section.

## Stack
TypeScript + React 19 + Vite 8 (boring, well documented), Vitest for tests, IndexedDB for storage (via the native API;
no extra dependency), PWA via a hand-written service worker + manifest (no plugin). Dependencies added only if needed.

## Commands
- Install: `npm ci` · Dev: `npm run dev` (port 5173) · Test: `npm test` · Coverage: `npm run test:cov`
- Types: `npm run typecheck` · Lint: `npm run lint` · Build: `npm run build`

## Structure
- `src/core/` pure logic (scheduler, estimates, ics/csv parsing) — no DOM, no I/O, fully unit-tested
- `src/storage/` IndexedDB wrappers · `src/ui/` React components · `src/main.tsx` entry
- Tests sit beside code as `*.test.ts(x)`.

## Acceptance (v1)
1. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all exit 0.
2. Scheduler: fixed events never move; task durations never shrink; tasks that don't fit are returned as overflow.
3. After a check-in extension of N min, every later task starts N min later (overflow if the day ends).
4. Reload mid-session restores plan, timer and logs; works offline.
5. After ≥3 logged sessions in a category, the suggested estimate = estimate × median(actual/estimate).
6. CSV time-log import and JSON/CSV export work. Keyboard: Space start/pause, D done, E extend.
7. Usable at 375px wide with no horizontal scroll.

## Boundaries
- Always: keep data on-device; never shrink tasks; tests for scheduling logic.
- Prepare, never do: production deploy, accounts, paid APIs.
- Never: commit secrets, weaken checks.

## Assumptions
- Standard blocks: 15/30/60/90 min. Working day window default 09:00–22:00 (configurable later).
- Times are minutes since local midnight within one day; "tomorrow" push is represented by overflow in v1.
- Priority order = user's list order (lower number first); ties keep insertion order.
- Research claims (planning fallacy, implementation intentions, micro-breaks) are cited in IDEA.md; not hardcoded in code.
