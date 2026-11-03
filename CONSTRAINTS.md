# Constraints

The quality bar for this repo. Tightening is fine; loosening needs the owner's sign-off in a commit of its own.

## Floor (always)
- No new suppression comments (`@ts-ignore`, `eslint-disable`, `# noqa`, `istanbul ignore`)
- No skipped, deleted, or weakened tests; no assertions removed
- No unimplemented stubs or empty `catch {}` blocks left in shipped code
- No secrets in source; no edits to features.json steps (only `passes` may change)
- Checked by: `python3 .claude/skills/nightly-build/scripts/guard.py`

## Enforced
| Dimension | Rule | Command | Why this number |
|---|---|---|---|
| Tests | All pass | `npm test` | Broken tests block everything |
| Build | Succeeds | `npm run build` | Must stay mergeable |
| Types/lint | Zero errors | `npm run typecheck && npm run lint` | Cheap, catches real bugs |
| Coverage of `src/core` | >= 90% lines | `npm run test:cov` | Scheduling logic is the product |
| Dependencies | No high/critical advisories | `npm audit --audit-level=high` | External check |
| Accessibility (UI features) | Zero critical/serious axe violations | added with F13 | WCAG |

## Measured, must not get worse (ratchet)
| Metric | Last value | Direction |
|---|---|---|
| Project test coverage | see test:cov (scheduler 100%) | must not fall by > 0.5% |

## Exceptions
| Rule | Path | Reason | Expires |
|---|---|---|---|
