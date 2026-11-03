# Independent review

The agent that wrote the code is the worst judge of it: it carries its own assumptions. The reviewer gets a
fresh context, the contract, and the artifact — never your reasoning or your claim that it works.

## When
Every feature that adds branching logic, crosses a module/service boundary, touches input/auth/data/money/LLM
calls, or claims something a compiler can't check (ordering, idempotence, "this scales"). Skip for pure renames,
formatting, or copy changes.

## Reviewer prompt (copy, fill in the brackets, spawn one subagent)

Subagents don't load this skill, so everything they need must be in the prompt.

```text
You are an adversarial reviewer. Assume the author is overconfident. Do NOT validate or summarize.

CONTRACT (what must be true):
[paste the feature's description and acceptance steps from features.json, plus the relevant SPEC.md section]

ARTIFACT:
Branch [branch name] in this repo. Diff: run `git diff [merge-base]...HEAD`.
App start command: [command]. Test command: [command].

Do these in order:
1. Without reading the author's tests, write your own black-box checks for each acceptance step (in a scratch
   directory outside the source tree) and run them against the running app or public interfaces. Report which
   pass and which fail, with the command and output.
2. Read the diff and the code it touches (callers, called functions). Look for: wrong results on edge cases
   (empty, zero, last item, unicode, time zones, rounding), broken callers, errors swallowed, data loss, injection
   or missing input validation, secrets in code, races, work that only grows, missing tests for risky logic.
3. Report ONLY issues that violate the contract or correctness/security. Each finding needs:
   - Title and file:line
   - Problem: the concrete input or situation and the wrong result it causes
   - Fix: the smallest change that fixes it
   - Severity: must-fix / should-fix
   No style opinions, no "consider", no speculative hardening. If you find nothing after a real attempt, say so.
```

## Reconcile (you remain responsible)
Re-read the code against each finding before acting. Classify in this order — first match wins:
1. **Contract misread** — the spec you gave was unclear. Fix the spec, then re-check.
2. **Valid and actionable** — fix it, add a test that would have caught it, re-run the review.
3. **Valid trade-off** — real, but fixing costs more than it's worth tonight. Record it in the report.
4. **Noise** — wrong given context the reviewer lacked. Note why in one line.

Stop when a cycle returns only trivial or already-handled findings, or after **3 cycles**. If substantive findings
remain after 3, the feature isn't ready: mark it not passing and explain in the report. If across 2+ cycles you
classified zero substantive findings as actionable, you are rubber-stamping — say so in the report.

## Final self-review before the PR (five axes, fast)
- **Correctness:** matches the acceptance steps; edge and error paths handled.
- **Readability:** names say what things are; no dead code, debug prints, or commented-out blocks.
- **Architecture:** follows existing patterns; feature logic not leaking into shared modules; no abstraction with
  one user.
- **Security:** see security.md.
- **Performance:** no query-per-item, unbounded lists, or blocking calls in hot paths.
Prefer findings that delete code. Every unrequested option, wrapper, or config is future work for someone.
