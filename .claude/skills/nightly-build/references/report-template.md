# PR description = morning report

Use this exact structure. Plain words, short lines; the owner reads it on a phone. Lead with what matters.
Omit a section only if it is truly empty.

```markdown
## Shipped
<one sentence: what a user can now do> · <preview/deploy link if one exists>

## Done criteria
| Feature | Step | Result | Evidence |
|---|---|---|---|
| F07 | Search returns 5 results < 2 s | ✅ | `e2e/search.spec.ts` · evidence/f07-results.png |
| F07 | Empty search shows a hint | ❌ | reviewer check #2 failed: blank screen (see Broken) |

Checks run: `<test cmd>` ✅ · `<build cmd>` ✅ · `<lint/type cmd>` ✅ · guard.py ✅ · reviewer cycles: 2

## Broken or stubbed
1. **<short title>** (`path:line`) — Problem: <input/situation → wrong result>. Why not fixed: <reason>.

## Needs you (≤ 3, each answerable in one line)
1. <decision or action only the owner can take, e.g. "Add a STRIPE_TEST_KEY secret to enable checkout tests">

## Assumptions I made
- <decision made without you> — overrule by <how>

## Shortcuts taken
- `path:line` shortcut: <limit>, <when to upgrade>

## Not checked
<anything that mattered and couldn't be verified tonight, e.g. "real iOS Safari", "behavior under 100+ users">

## Next run should
<the single most valuable next step>
```

Rollback is always "close the PR" or `git revert <merge commit>`; say so if the change touched data or config.
