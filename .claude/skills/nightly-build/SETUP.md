# Setting up nightly builds (for the owner, not the agent)

## 1. Put the skill in each project repo
Copy this whole folder to `.claude/skills/nightly-build/` in the repo and commit it. Cloud runs start from a fresh
clone, so skills installed only on your computer won't be there; committed ones will.

## 2. Give the repo an idea or a queue
- New project: create the repo with an `IDEA.md` (a few sentences: what, who it's for, why). The first run turns it
  into SPEC.md, features.json, and a working skeleton.
- Existing project: optionally add `QUEUE.md` with your priorities, one per line (`- [ ] dark mode`). The top
  unchecked line wins over the agent's own ordering.

## 3. Create the scheduled task
At claude.ai/code/scheduled (or the desktop app's Schedule page): pick the repo, a time off the hour (e.g. 1:07 AM),
and paste this prompt:

```text
Use the nightly-build skill in .claude/skills/nightly-build. Work in this repo until the current feature is
verified, reviewed, committed, and a pull request with the report is open. Then continue with the next feature
only if the tree is clean and green. Do not stop to ask questions.
```

Optional, for longer runs: start the prompt with `/goal all features attempted tonight are either passing with
evidence in the PR or reported as blocked, and guard.py exits 0 — or stop after 40 turns`. A separate model then
checks that condition after every turn and keeps the run going until it holds.

## 4. Each morning (5 minutes)
Read the PR description. Merge if the done criteria have evidence, answer "Needs you", overrule any assumption
you disagree with by editing SPEC.md. If a run made a mistake you don't want repeated, add one line to the
"Lessons" section at the bottom of SKILL.md.

## What's in here
- `SKILL.md` — the run loop and the non-negotiable rules (kept short so it survives context compaction)
- `references/` — first run, testing, debugging, independent review, security, UI quality, report template
- `templates/` — CLAUDE.md, CONSTRAINTS.md, PROGRESS.md, init.sh copied into new projects
- `scripts/guard.py` — flags skipped/deleted/weakened tests, suppression comments, stubs, secrets,
  edited feature steps, and loosened constraints (exit 0 clean, 1 problems, 2 couldn't run)

## Built from
addyosmani/agent-skills (spec, TDD, incremental slices, doubt-driven review, constraints floor, definition of
done) · DietrichGebert/ponytail (reuse ladder, shortcut comments, finding format) · Graphify (never overwrite a
good artifact with a worse one; map before you search) · OmniRoute (compress noisy tool output; one source of
truth for agent rules) · Anthropic's long-running agent harness (features.json, progress log, init.sh, one
feature per session, baseline test on startup) · Claude Code best practices (verification, fresh-context review,
lean CLAUDE.md).
