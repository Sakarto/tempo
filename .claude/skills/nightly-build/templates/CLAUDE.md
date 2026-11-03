# <Project name>

<One sentence: what this is and who it's for.> Spec: SPEC.md · Features: features.json · Log: PROGRESS.md

## Commands
- Start (installs + dev server): `./init.sh`
- Test (all): `<cmd>` · Test (one file): `<cmd>`
- Build: `<cmd>` · Lint/types: `<cmd>`

## Rules
- Use the nightly-build skill for any unattended or "build the next feature" work.
- Read CONSTRAINTS.md before writing code. IMPORTANT: never weaken it, a test, or features.json steps to make a change pass.
- Never commit `.env` or secrets; add new variables to `.env.example`.

## Conventions
<Only things Claude can't infer from the code: naming rules that differ from defaults, where new modules go,
the one example file to copy patterns from.>

## Gotchas
<Non-obvious behavior that has bitten a previous run. Add a line each time one does.>

## When compacting
Preserve: the current feature id, files changed this run, test commands and their last results, open blockers.
