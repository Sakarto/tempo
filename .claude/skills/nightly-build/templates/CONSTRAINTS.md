# Constraints

The quality bar for this repo. Tightening is fine; loosening needs the owner's sign-off in a commit of its own.

## Floor (always)
- No new suppression comments (`@ts-ignore`, `eslint-disable`, `# noqa`, `# type: ignore`, `istanbul ignore`, `nosemgrep`)
- No skipped, deleted, or weakened tests; no assertions removed
- No unimplemented stubs or empty `catch {}` blocks left in shipped code
- No secrets in source; no edits to features.json steps (only `passes` may change)
- Checked by: `python3 .claude/skills/nightly-build/scripts/guard.py`

## Enforced
| Dimension | Rule | Command | Why this number |
|---|---|---|---|
| Tests | All pass | `<test cmd>` | Broken tests block everything |
| Build | Succeeds | `<build cmd>` | Must stay mergeable |
| Types/lint | Zero errors | `<lint/type cmd>` | Cheap, catches real bugs |
| Coverage of changed lines | ≥ 80% | `<coverage cmd>` | Forces a test, allows config lines |
| Dependencies | No high/critical advisories | `npm audit --audit-level=high` / `pip-audit` | Below that is mostly noise |
| Accessibility (web) | Zero critical/serious axe violations | `<axe cmd>` | External standard (WCAG) |
| Performance (web) | LCP ≤ 2500 ms, CLS ≤ 0.1 | `<lighthouse cmd>` | Core Web Vitals "good" thresholds |

At least one row must be checked by something other than this project's own tests (audit, axe, Lighthouse),
so the bar isn't only the agent agreeing with itself.

## Measured, must not get worse (ratchet)
| Metric | Last value | Direction |
|---|---|---|
| Project test coverage | <measure on first run> | must not fall by > 0.5% |

## Exceptions
| Rule | Path | Reason | Expires |
|---|---|---|---|
