# Progress

Newest run first. Keep each run under ~15 lines; roll runs older than ~10 into "Earlier" as one line each.

## Current state
- Passing features: 2/11 · Next up: F03 · Blocked: none
- Start: `./init.sh` · Baseline at last run: tests ✅ build ✅

## Assumptions (owner can overrule)
- Branch is claude/amazing-lamport-far17c (assigned by the harness), not nightly/<date> (run 2026-11-04)
- See SPEC.md Assumptions for product decisions (run 2026-11-04)

## Runs
### 2026-11-04 — F02: plan-today UI + IndexedDB
- Did: src/App.tsx, src/store/db.ts; save/load errors surfaced, events limited to 09:00–22:00, long titles wrap.
- Evidence: `npm test` 13 passed; Playwright run (5 tasks+event, reload, 375px, no console errors); evidence/f02-*.png (gitignored).
- Review: 1 cycle; fixed 2 must-fix (375px overflow with long titles, silent IDB failures, re-verified in browser) + out-of-window events + category display. Accepted: multi-tab last-write-wins (whole-blob save); empty event title becomes "Event".
- Next: F03 .ics import

### 2026-11-04 — F01: scheduler
- Did: first-run setup (SPEC, features.json, Vite+React+TS, vitest, CI); src/core/scheduler.ts + tests.
- Evidence: `npm test` 9 passed; lint/typecheck/build exit 0; guard clean.
- Review: 1 cycle, fresh subagent; 0 must-fix; fixed 3 should-fix (negative/zero/NaN estimate, NaN `from`) with tests. Accepted: first-fit lets a small low-priority task take an earlier gap.
- Blockers: none
- Next: F02 plan-today UI + IndexedDB

## Earlier
