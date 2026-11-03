# Progress

Newest run first. Keep each run under ~15 lines; roll runs older than ~10 into "Earlier" as one line each.

## Current state
- Passing features: 8/13 · Next up: F09 · Blocked: none
- Start: `./init.sh` · Baseline at last run: tests ✅ build ✅ lint ✅ types ✅

## Assumptions (owner can overrule)
- Stack: React+Vite+Vitest, no PWA plugin; see SPEC.md (2026-11-03)
- Scheduler keeps placed tasks in priority order in time; oversized tasks overflow while smaller later ones may still fill gaps (2026-11-03)
- features.json F01 is a pure-logic feature, so evidence is unit tests + independent black-box review, not a browser run (2026-11-03)

## Runs
### 2026-11-03 — F06+F07+F08: plan screen, focus timer, check-in
- Did: `src/core/{plan,day}.ts`, `src/ui/*`, `src/App.tsx`; scheduler made generic
- Evidence: `npm test` 67 pass (core coverage 98%); Playwright in real Chromium with a fake clock (add 5 tasks + .ics, start/pause, reload mid-session, check-in, +15 re-flow, Done+reward, Stuck, 375px, no console errors); screenshots in evidence/ (untracked)
- Review: 1 cycle; must-fix (late +15 gave no extra time, actual overcounted) + stale-day timer, start-when-overflow, import wiping events, long titles, 2-tab timer clobber, focus after Done: fixed and re-verified in browser
- Changed assertion on purpose: finish() actual is now capped at block length (idle wait at check-in isn't work), so one test expects 45 not 50
- Trade-offs: Stuck discards elapsed time (nothing logged); two tabs can still disagree on task order (timer fixed); started task may run past 22:00 via extensions
- Next: F09 keyboard shortcuts

### 2026-11-03 — F05: IndexedDB persistence
- Did: `src/storage/db.ts` (tasks/events/sessions/meta), `src/core/timer.ts` (wall-clock stopwatch)
- Evidence: `npm test` 52 pass; real Chromium via Playwright: wrote task+timer, reloaded, data present and elapsed 5s→7s, no console errors (evidence/f05-reload.png, untracked)
- Review: 1 cycle, 3 should-fix (version-change hang, non-idempotent upgrade, double rejection) fixed + tested
- Noticed, not touched: db/timer not wired into UI yet (F06/F07); no navigator.storage.persist()
- Fixed: scaffold had overwritten original .gitignore (secrets/coverage); restored
- Next: F06 plan screen

### 2026-11-03 — F04: Parsers (.ics, CSV time log)
- Did: `src/core/ics.ts`, `src/core/csvlog.ts`
- Evidence: `npm test` 36 pass (also under TZ=America/Chicago, Asia/Kolkata); typecheck/lint/build/audit/guard clean
- Review: 1 cycle, reviewer found 2 must-fix (unterminated quote lost later rows; 2026-02-31 accepted) + should-fix (VALARM overwrite, CANCELLED, RRULE silent, DURATION, bad dates, case, huge numbers); all fixed with tests. Cycle 2: reviewer found 3 must-fix (DST DURATION end, duplicate-id collisions, stray quotes mid-field/recursion) + unclosed events + P1W; all fixed with tests. Not re-reviewed after cycle-2 fixes (cap reached by design: further cycles would be a third).
- Noticed, not touched: CSV export must escape cells starting with = + - @ (do in F11); DST gap times (02:30) untested; recurring events are reported, not expanded
- Next: F05 IndexedDB persistence

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
