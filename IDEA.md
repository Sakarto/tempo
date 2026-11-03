Tempo (working name) — a local-first productivity app that runs your day for you: you add tasks, it builds the day around your fixed events, runs a timer on the current task, checks in when the block ends ("done / keep going / stuck"), offers a break you can skip, and instantly reshuffles the rest of the day. Every session is logged, so its time estimates learn how long your tasks actually take.

Who it's for and why
First user: me (Avy), a full-time student juggling classes, gym, clubs, and side projects. Today I do this by hand across Todoist + Google Calendar, and rescheduling after one task runs long eats the time I saved.
Then: students and people with ADHD who want to stop planning and just do the next thing. Best first market for a $5–12/mo subscription later.
For me this is: a real product I use daily, a portfolio/transfer-application piece, and the base for a data-science study on how people actually spend their days (planning fallacy, estimate calibration).
Quality bar: I will use it every day, so it must be fast, never lose data, and work offline.
Must do (v1)
Plan today: add tasks with an estimate snapped to standard blocks (15 / 30 / 60 / 90 min) and a category; add or import fixed events (.ics file exported from Google Calendar). The app lays tasks into the free gaps, in priority order, and shows anything that doesn't fit as overflow (never shrinks a task to make it fit).
Focus session: big countdown for the current block plus a stopwatch of real time spent on the task.
Check-in at block end: buttons for Done, +15 / +30 min, Stuck / switch, then Break (5–10 min) or Skip break. Whatever I pick, the rest of today re-flows immediately and overflow is shown honestly.
It learns me + shows my stats: every session is saved locally (task, category, estimate, actual, extensions, breaks skipped). Stats page: estimate-vs-actual by category, focus minutes per day, streak. New estimates are auto-adjusted by my personal multiplier per category (median of actual ÷ estimate), shown as a suggestion I can accept or override.
Rewards: optionally attach a reward to a task ("10 min YouTube"); when I finish it, the check-in reminds me to take it.
Done means
On my laptop I can open the app, add 5 tasks + import my Google Calendar .ics, and see a full day plan in under 1 minute of clicking.
I can run a task, hit +15 at the check-in, and every later task moves 15 min later (overflow appears if the day runs out) without me touching anything.
I can close the browser mid-session, reopen it, and the timer, plan, and logs are all still there.
With wifi off, everything still works (installable PWA).
After 3 logged sessions in one category, the stats page shows that category's estimate-vs-actual ratio and new estimates in that category get the adjusted suggestion.
I can export all my data as CSV/JSON in one click.
Constraints
Free tools only, no paid APIs.
Local-first and private: all data stays on my device (IndexedDB). No accounts, no server database, no analytics. Static site, so the preview deploy holds no user data.
Laptop-first (≥1024px), but still usable at 375px wide.
Installable PWA that works fully offline.
Must work with keyboard only (Space = start/pause, D = done, E = extend) so I never break focus reaching for a mouse.
Scheduling rules to respect: fixed events never move; a task's duration never compresses to fit a gap; unfinished work pushes forward (later today first, then tomorrow's top of queue).
Must be able to import a CSV time log with columns date,task,category,estimate_min,actual_min,extended_min,distracted,energy_1to5,note (I'm already logging in this format), so the learning has history from day one.
Tech I'd like to learn: TypeScript + React (or whatever is most boring and well-documented for an offline PWA).
Not doing yet
Accounts, cloud sync, multiple devices (local-first first; sync is a later, opt-in feature).
Live Todoist / Google Calendar API sync (v1 uses .ics and CSV import; API connectors come after the core loop is proven).
The lessons library, blog/community posts, featured entries, and AI search over lessons.
Reflection journal and notes space (v2, see QUEUE.md).
Anonymous research data donation (needs a consent flow and an IRB-style protocol first).
Native mobile apps, notifications on phone, payments.
Notes (optional)

The core bet: people don't fail at planning, they fail at re-planning after the first thing runs long. Tempo's whole job is making the re-plan cost zero seconds.

Research to build on (verify each in SPEC.md, cite sources, don't hardcode folklore):

Planning fallacy — people reliably underestimate task time even when they know past tasks ran long (Buehler, Griffin & Ross, 1994). Fix used here: reference-class forecasting (Kahneman & Tversky; Flyvbjerg) — base the estimate on my own logged history for that category, not on the gut number.
Implementation intentions — "When X happens, I will do Y" plans raise follow-through (Gollwitzer 1999; meta-analysis Gollwitzer & Sheeran 2006). Use as the "first physical cue / first 2-minute step" field on a task (v2).
Breaks — short micro-breaks improve vigor and reduce fatigue (meta-analysis: Albulescu et al., 2022, PLOS ONE). The popular "90-minute ultradian cycle" for work is weakly supported, so default block lengths come from my data, not from that claim.
What already works for me: start really small, time my work, keep durations honest and padded.

Learning model (v1 is deliberately simple): for category $c$ with logged ratios $r_i = \text{actual}_i / \text{estimate}_i$, suggested estimate $= \text{estimate} \times \operatorname{median}(r_i)$ once $n \ge 3$. Later upgrade: a Bayesian log-normal model per category, so the suggestion comes with an 80% interval and gets sharper as data grows.

Existing tools, and the gap: Reclaim / Motion / Sunsama auto-schedule and reshuffle, but they're cloud-only and meeting-focused, with no in-session check-ins and no learning from my actual vs. estimated time. Toggl / Clockify time work but don't plan. Nobody combines the live check-in loop, re-planning, local-first privacy, and personal estimate calibration.

Full vision and later features: see QUEUE.md.
