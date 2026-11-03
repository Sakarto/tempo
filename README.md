# Project template

Starting point for projects built overnight by Claude Code with the nightly-build skill.

## Start a new project
1. Click **Use this template → Create a new repository** (private is fine).
2. In the new repo, edit `IDEA.md` and replace every `<FILL IN …>`.
3. Create a scheduled task at claude.ai/code/scheduled for the new repo (environment: Default, daily at an
   off-the-hour time) with this prompt:

   ```text
   Use the nightly-build skill in .claude/skills/nightly-build. Work in this repo until the current feature is
   verified, reviewed, committed, and a pull request with the report is open. Then continue with the next feature
   only if the tree is clean and green. Do not stop to ask questions.
   ```
4. Each morning, read the pull request, try the preview link, and merge or redirect.

## Steering a project
- `QUEUE.md` — add `- [ ] something` lines; the top unchecked one is built first.
- `SPEC.md` — written on the first night; edit it to change direction.
- `.claude/skills/nightly-build/SKILL.md` → "Lessons" — add a line when a run repeats a mistake.

Full guide: `.claude/skills/nightly-build/SETUP.md`.
