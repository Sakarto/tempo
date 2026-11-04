# Spec: Tempo
## Objective
Local-first day planner for Avy (student) and later people with ADHD. Lays tasks into the free gaps around fixed events,
runs a timer on the current block, checks in at block end (done / +15 / +30 / stuck), re-flows the rest of the day
instantly, logs every session, and learns a per-category estimate multiplier (median actual ÷ estimate, n ≥ 3).
Research basis (verify before citing in UI): planning fallacy (Buehler, Griffin & Ross 1994); reference-class forecasting (Kahneman & Tversky; Flyvbjerg).
## Stack
TypeScript + React 19 + Vite 8, Vitest + Testing Library, `idb` for IndexedDB, vite-plugin-pwa for offline. No backend.
## Commands
install `npm ci` · dev `./init.sh` (port 5173) · test `npm test` · build `npm run build` · lint `npm run lint` · types `npm run typecheck`
## Structure
`src/core/*` pure logic (scheduler, ics, csv, stats) with tests beside it · `src/store/*` IndexedDB · `src/ui/*` React · `e2e/` browser checks
## Acceptance
1. `npm test`, `npm run lint`, `npm run build` exit 0.
2. 5 tasks + an `.ics` import produce a day plan; overflow shown, no task shortened.
3. At check-in, +15 shifts every later task 15 min later and overflow appears when the day runs out.
4. Reload mid-session keeps plan, timer and logs (IndexedDB).
5. Works offline (service worker precache) and usable at 375px.
6. After 3 sessions in a category the stats page shows ratio and new estimates get the suggestion.
7. One-click JSON/CSV export; CSV time-log import with the documented columns.
## Boundaries
Always: data stays on device; fixed events never move; durations never compress. Prepare, never do: accounts, payments, deploys, API keys. Never: commit secrets, weaken checks.
## Assumptions
- Working day window 09:00–22:00, single day ("today") planned at a time; unfinished work carries to tomorrow's queue.
- Estimates snap to 15/30/60/90 minutes.
- Times are minutes since local midnight; events crossing midnight are clipped to the day.
- Boring stack chosen over alternatives because it is the most documented for offline PWAs.
