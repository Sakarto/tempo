# Progress

Newest run first. Keep each run under ~15 lines; roll runs older than ~10 into "Earlier" as one line each.

## Current state
- Passing features: 3/13 · Next up: F04 · Blocked: none
- Start: `./init.sh` · Baseline at last run: tests ✅ build ✅ lint ✅ types ✅

## Assumptions (owner can overrule)
- Stack: React+Vite+Vitest, no PWA plugin; see SPEC.md (2026-11-03)
- Scheduler keeps placed tasks in priority order in time; oversized tasks overflow while smaller later ones may still fill gaps (2026-11-03)
- features.json F01 is a pure-logic feature, so evidence is unit tests + independent black-box review, not a browser run (2026-11-03)

## Runs
### 2026-11-03 — F03: Estimate learning
- Did: `src/core/estimates.ts` (median multiplier per category, n>=3, snapped to 15-min blocks)
- Evidence: `npm test` 19 pass; typecheck/lint/build/guard clean
- Review: none by subagent (small pure function, 6 tests incl. even-count median and ignored bad rows); self-review only
- Next: F04 parsers

### 2026-11-03 — F02: Re-flow after extension
- Did: `src/core/reflow.ts` `extendCurrent` pins running task, extends it, re-schedules the rest after it
- Evidence: `npm test` 13 pass; typecheck/lint/build/guard clean
- Review: no subagent (10-line composition of the reviewed `schedule`); self-review only
- Next: F03 estimate learning

### 2026-11-03 — F01: Scheduler
- Did: first-run init (SPEC, features.json, CI, skeleton) + src/core/scheduler.ts
- Evidence: `npm test` 9 pass; scheduler.ts 100% lines; typecheck/lint/build/audit/guard clean
- Review: 1 cycle; 2 should-fix input-validation findings fixed + tested. Invalid duration throws rather than overflowing (accepted)
- Blockers: none
- Noticed, not touched: none
- Next: F02 re-flow after extension

## Earlier
