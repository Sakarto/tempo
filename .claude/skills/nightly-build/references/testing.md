# Testing that actually proves something

## Discover the stack first
Read package.json / pyproject.toml / go.mod / Cargo.toml / Makefile and the CI workflow. Use the repo's own
focused-test command during the loop and its full-suite command before committing. Prefer checked-in wrappers
(`./gradlew`, `make test`) over global tools.

## The loop
RED (write a failing test, confirm it fails for the right reason) → GREEN (minimum code to pass) → REFACTOR
(clean up with tests green) → run the full suite.

## Bugs: Prove-It
Write a test that reproduces the bug and fails. Then fix the root cause. The test must fail without the fix and
pass with it. Before editing a shared function, grep every caller.

## What good tests look like
- Assert outcomes (state, output), not which internal methods were called.
- One concept per test; names read like a spec: `rejects empty titles`, not `test 3`.
- DAMP over DRY: each test should be readable on its own.
- Real implementation > fake > stub > mock. Mock only slow, nondeterministic, or side-effecting boundaries
  (external APIs, email, clocks).
- Cover the edges that actually break things: empty, zero, one, many, last item, unicode, time zones, rounding,
  concurrent calls, network failure.
- Pyramid: mostly small fast unit tests, some integration, a few end-to-end tests for the critical user flows.

## Checking the tests themselves
- **Mutation spot-check:** invert one condition you just added (`>` → `>=`, drop a `!`), run the suite, then
  restore the file. If nothing fails, a test is missing — add it.
- **Independent oracle:** the review subagent writes its own black-box checks from the acceptance steps without
  seeing your tests (see review.md). A large gap between "my tests pass" and "its checks pass" means your tests
  are fitted to your code, not the spec.
- Where inputs are open-ended (parsers, math, money), add a property or randomized test (e.g. fast-check,
  Hypothesis) so the implementation can't pass by memorizing examples.

## End-to-end for web apps
Use Playwright (or the session's browser tool): load the page, perform each acceptance step, assert on visible
text, take a screenshot per step into `evidence/` (gitignored unless the report needs it), and check that the
console has zero errors. Note the limit: native `alert()`/`confirm()` dialogs may be invisible to automation —
avoid them in UI design.

## Red flags
- "All tests pass" but no test command output in the transcript
- A new test passed on its first run
- Tests skipped, deleted, or loosened in the same commit as a fix
- Re-running an unchanged suite "to be sure" (adds no information)
