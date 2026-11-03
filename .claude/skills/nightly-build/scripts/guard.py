#!/usr/bin/env python3
"""Floor guard: flags changes that lower the quality bar instead of meeting it.

Compares the working tree (committed, staged, unstaged and untracked) against the merge base with the main
branch and reports the location of each problem (never the matched secret).

Exit codes: 0 = clean, 1 = at least one violation, 2 = could not run (never treat 2 as clean).
Usage: python3 guard.py [--base <ref>]
Standard library only.
"""
import json
import os
import re
import subprocess
import sys

CODE_EXT = (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".kt", ".rb",
            ".php", ".cs", ".swift", ".vue", ".svelte", ".c", ".cc", ".cpp", ".h", ".scala", ".dart")
SKIP_PREFIXES = (".claude/skills/", "node_modules/", "vendor/", "dist/", "build/", ".venv/")

SUPPRESSIONS = re.compile(
    r"@ts-ignore|@ts-nocheck|@ts-expect-error|eslint-disable|#\s*noqa|#\s*type:\s*ignore|"
    r"istanbul ignore|c8 ignore|pragma:\s*no cover|nosemgrep|gitleaks:allow|Stryker disable|"
    r"#\[allow\(|@SuppressWarnings|//\s*nolint")
SKIPPED_TESTS = re.compile(
    r"\b(it|test|describe|context)\.(skip|only|todo)\s*\(|\b(xit|xdescribe|xtest)\s*\(|"
    r"@pytest\.mark\.(skip|xfail)|pytest\.skip\(|@unittest\.skip|\bt\.Skip\(|#\[ignore\]|@Disabled\b|@Ignore\b")
STUBS = re.compile(
    r"Not implemented|NotImplementedError|\btodo!\(|\bunimplemented!\(|"
    r"catch\s*(\([^)]*\))?\s*\{\s*\}|except[^:\n]*:\s*pass\s*$")
ASSERTION = re.compile(r"\bexpect\s*\(|\bassert\w*\b|\.should\b|\bt\.(Error|Fatal|Fail)")
SECRETS = [
    ("AWS access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("API secret key", re.compile(r"\bsk-(?:live_|proj-|ant-)?[A-Za-z0-9_-]{20,}")),
    ("Stripe live key", re.compile(r"\b(?:rk|pk)_live_[A-Za-z0-9]{20,}")),
]
TEST_PATH = re.compile(r"(^|/)(tests?|__tests__|spec|e2e)/|\.(test|spec)\.[^/]+$|(^|/)test_[^/]+\.py$|_test\.(py|go)$")


def git(*args, ok_codes=(0,)):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    if r.returncode not in ok_codes:
        return None
    return r.stdout


def bail(msg):
    print(f"guard: cannot run: {msg}", file=sys.stderr)
    sys.exit(2)


def find_base(explicit):
    candidates = [explicit] if explicit else ["origin/main", "origin/master", "main", "master"]
    for ref in candidates:
        mb = git("merge-base", ref, "HEAD")
        if mb:
            return mb.strip(), ref
    bail("no merge base found (tried %s); pass --base <ref>" % ", ".join(candidates))


def parse_diff(diff_text):
    """Return (added, removed, deleted_files) from a unified diff with --unified=0."""
    added, removed, deleted = [], [], []
    path = old = ""
    in_header = False
    for line in diff_text.splitlines():
        if line.startswith("diff "):
            in_header = True
            continue
        if line.startswith("@@"):
            in_header = False
            continue
        if in_header:
            if line.startswith("--- "):
                old = re.sub(r"^[ab]/", "", line[4:])
            elif line.startswith("+++ "):
                new = re.sub(r"^[ab]/", "", line[4:])
                path = old if new == "/dev/null" else new
                if new == "/dev/null":
                    deleted.append(old)
            continue
        if line.startswith("+"):
            added.append((path, line[1:]))
        elif line.startswith("-"):
            removed.append((path, line[1:]))
    return added, removed, deleted


def is_code(path):
    return path.endswith(CODE_EXT) and not path.startswith(SKIP_PREFIXES)


def check_features(base):
    problems = []
    old_raw = git("show", f"{base}:features.json")
    if old_raw is None:
        return problems  # file is new on this branch, nothing to compare against
    try:
        new_raw = open("features.json", encoding="utf-8").read()
    except FileNotFoundError:
        return ["features.json was deleted"]
    try:
        old = {f["id"]: f for f in json.loads(old_raw).get("features", [])}
        new = {f["id"]: f for f in json.loads(new_raw).get("features", [])}
    except (ValueError, KeyError, TypeError, AttributeError) as e:
        return [f"features.json is not valid (each feature needs an id): {e}"]
    for fid, f in old.items():
        if fid not in new:
            problems.append(f"features.json: feature {fid} was removed")
            continue
        for key in set(f) | set(new[fid]):
            if key != "passes" and f.get(key) != new[fid].get(key):
                problems.append(f"features.json: {fid}.{key} was edited (only 'passes' may change)")
    return problems


def main():
    explicit = None
    if "--base" in sys.argv:
        i = sys.argv.index("--base")
        if i + 1 >= len(sys.argv):
            bail("--base needs a ref")
        explicit = sys.argv[i + 1]

    top = git("rev-parse", "--show-toplevel")
    if not top:
        bail("not inside a git work tree")
    os.chdir(top.strip())
    base, ref = find_base(explicit)

    tracked = git("diff", "--unified=0", "--no-color", "--no-ext-diff", base, "--")
    if tracked is None:
        bail(f"could not diff against {base}")
    untracked_list = git("ls-files", "--others", "--exclude-standard")
    if untracked_list is None:
        bail("could not list untracked files")
    chunks = [tracked]
    for f in filter(None, untracked_list.splitlines()):
        d = git("diff", "--no-index", "--unified=0", "--no-color", "/dev/null", f, ok_codes=(0, 1))
        if d is None:
            bail(f"could not diff untracked file {f}")
        chunks.append(d)
    added, removed, deleted = parse_diff("\n".join(chunks))

    problems = []
    prev = ("", "")
    for path, text in added:
        if path.startswith(SKIP_PREFIXES):
            continue
        if is_code(path) and prev[0] == path:
            # Error swallowed across two lines: `except ...:` + `pass`, or `catch (e) {` + `}`.
            if (re.match(r"\s*except\b[^:]*:\s*$", prev[1]) and re.match(r"\s*pass\s*$", text)) or \
               (re.search(r"catch\s*(\([^)]*\))?\s*\{\s*$", prev[1]) and re.match(r"\s*\}", text)):
                problems.append(f"{path}: unimplemented stub or empty error handler")
        prev = (path, text)
        if is_code(path):
            if SUPPRESSIONS.search(text):
                problems.append(f"{path}: new suppression comment silences a check")
            if SKIPPED_TESTS.search(text):
                problems.append(f"{path}: test skipped/focused/xfailed")
            if STUBS.search(text):
                problems.append(f"{path}: unimplemented stub or empty error handler")
        for name, rx in SECRETS:
            if rx.search(text):
                problems.append(f"{path}: possible {name} committed (value redacted)")
    for f in deleted:
        if TEST_PATH.search(f):
            problems.append(f"{f}: test file deleted")
        if f == "features.json":
            problems.append("features.json deleted")
    if any(p in (".env",) or p.endswith("/.env") for p, _ in added):
        problems.append(".env file added; use .env.example and keep real values out of git")

    # Assertions removed from test files that still exist.
    balance = {}
    for path, text in removed:
        if TEST_PATH.search(path) and path not in deleted and ASSERTION.search(text):
            balance[path] = balance.get(path, 0) - 1
    for path, text in added:
        if TEST_PATH.search(path) and ASSERTION.search(text) and path in balance:
            balance[path] += 1
    problems += [f"{p}: {-n} more assertion line(s) removed than added" for p, n in balance.items() if n < 0]

    if any(p == "CONSTRAINTS.md" for p, _ in removed):
        problems.append("CONSTRAINTS.md: lines removed or changed; loosening the bar needs the owner's sign-off")
    problems += check_features(base)

    if problems:
        print(f"guard: {len(problems)} problem(s) vs {ref} ({base[:8]}):")
        for p in dict.fromkeys(problems):
            print(f"  - {p}")
        print("Fix them honestly, or explain each deliberate one in the report.")
        sys.exit(1)
    print(f"guard: clean vs {ref} ({base[:8]})")
    sys.exit(0)


if __name__ == "__main__":
    main()
