# First run: from raw idea to a working skeleton

Use when the repo has no SPEC.md or features.json. The input is whatever the owner left: a line in QUEUE.md,
an IDEA.md, an issue, or the scheduled-task prompt. Nobody will answer questions, so you decide and record why.

**If IDEA.md still contains the template placeholders (`<FILL IN`) and nothing else gives you an idea, do not
invent a project.** Commit nothing, and end the run with a one-line message that IDEA.md needs filling in.

## Checklist

```
- [ ] A. Sharpen the idea (IDEA.md)
- [ ] B. Write SPEC.md
- [ ] C. Write features.json (every feature failing)
- [ ] D. Create CLAUDE.md, CONSTRAINTS.md, PROGRESS.md, init.sh from templates/
- [ ] E. Skeleton that builds, runs, and has one passing smoke test + CI workflow
- [ ] F. Commit "chore: initialize project", then continue with the normal run at step 2
```

## A. Sharpen the idea (10 minutes, written to IDEA.md)

1. Restate it as one "How might we …" sentence: who it's for and what changes for them.
2. Generate 5 variations quickly using these lenses: 10x simpler · opposite approach · different audience ·
   combine with an adjacent idea · what a domain expert would find obvious.
3. Pick one direction. Judge on: user value (painkiller or vitamin?), feasibility tonight, what makes it different.
4. Write:
   - **Recommended direction** (2–3 sentences, and why)
   - **MVP scope**: the smallest version that tests the core bet
   - **Not doing (and why)**: the most valuable section; at least 3 items
   - **Assumptions to confirm**: each with how the owner can check it in one line
   - **Goal beyond the goal**: what this is ultimately for (portfolio piece, real users, competition, learning) and
     what quality bar that implies

## B. SPEC.md (one page)

```markdown
# Spec: <name>
## Objective        — who uses it, what it does for them, what success looks like
## Stack            — language, framework, versions (prefer boring, well-documented tools; justify any dependency)
## Commands         — exact install / dev / test / build / lint commands
## Structure        — where source, tests, and docs live
## Acceptance       — 3–7 checkable statements ("`npm test` exits 0", "search returns results in < 2 s")
## Boundaries       — Always: … | Prepare, never do: … (see SKILL.md hard limits) | Never: commit secrets, weaken checks
## Assumptions      — every decision made without the owner, so they can overrule it
```

Turn vague goals into numbers: "fast" → "first load < 2.5 s, interaction < 200 ms"; "works on mobile" →
"usable at 375px width, no horizontal scroll".

## C. features.json

JSON, not Markdown: agents are less likely to rewrite structured data by accident. Every feature starts failing.
Later runs may only flip `passes` and append new features — never edit or delete existing steps.

```json
{
  "features": [
    {
      "id": "F01",
      "category": "core",
      "priority": 1,
      "description": "User can paste a song title and get 5 recommendations",
      "steps": [
        "Open the home page",
        "Type 'Hotline Bling' in the search box and press Enter",
        "Exactly 5 results appear within 2 seconds, each with a title and a reason"
      ],
      "passes": false
    }
  ]
}
```

Make each feature one capability a user would notice (≤ ~5 files, ≤ 3 acceptance steps) — not a setup step, a
single function, or "write tests for X": scaffolding, wiring, and tests belong inside the feature that needs them.
Don't over-split: a good night finishes several features, so the full v1 should take a few nights, not weeks.
Order by priority with the riskiest unknown early. Typical MVP: 8–25 features.

## D. Project files

Copy from `${CLAUDE_SKILL_DIR}/templates/` and fill in: `CLAUDE.md` (≤60 lines: commands, conventions,
gotchas — nothing Claude can infer from code), `CONSTRAINTS.md`, `PROGRESS.md`, `init.sh`. Make `init.sh`
idempotent: install deps if missing, start the dev server in the background, wait until it responds.

## E. Skeleton

- Scaffold with the stack's official generator, not by hand.
- Add one smoke test that proves the app starts and the main page/command responds.
- Add `.github/workflows/ci.yml` running install + test + build on every push and PR, so checks run outside
  the agent too.
- Add `.gitignore` before the first commit; never commit `.env` or keys (create `.env.example` instead).
