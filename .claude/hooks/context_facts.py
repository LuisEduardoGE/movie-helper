"""Print the volatile repo facts that docs/ai-context must never hand-write.

HEAD, branch position, working-tree state and test-file counts go stale within days when
typed into Markdown. This prints them live; the SessionStart hook injects the output and
/sync-context calls it. Stdlib only, offline, never raises (prints "unknown" instead).

    python .claude/hooks/context_facts.py
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
TEST_FILE = re.compile(
    r"(^|/)(test_[^/]+\.py|[^/]+_test\.(py|go)|[^/]+\.(test|spec)\.[cm]?[jt]sx?|[^/]+Tests?\.(java|kt|cs))$"
)


def git(*args: str) -> str:
    try:
        out = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return out.stdout.strip() if out.returncode == 0 else ""


def main() -> None:
    branch = git("branch", "--show-current") or "(detached)"
    head = git("log", "-1", "--format=%h %cs %s") or "unknown"
    upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    if upstream:
        counts = git("rev-list", "--left-right", "--count", f"{upstream}...HEAD").split()
        position = f"{counts[1]} ahead / {counts[0]} behind {upstream}" if len(counts) == 2 else "unknown"
    else:
        position = "no upstream" + ("" if git("remote") else " (repo has no remote)")
    dirty = [line for line in git("status", "--porcelain").splitlines() if line.strip()]
    ctx_last = git("log", "-1", "--format=%h %cs", "--", "docs/ai-context") or "never committed"
    since = git("rev-list", "--count", "HEAD", "--not", ctx_last.split()[0]) if ctx_last[0].isalnum() and " " in ctx_last else "?"
    tests = sum(1 for p in git("ls-files").splitlines() if TEST_FILE.search(p))

    print("## Live repo facts (from git - these outrank anything written in docs)")
    print(f"- branch: {branch}")
    print(f"- HEAD: {head}")
    print(f"- position: {position}")
    print(f"- working tree: {len(dirty)} dirty path(s)")
    print(f"- docs/ai-context last committed: {ctx_last} ({since} commit(s) since)")
    print(f"- tracked test files: {tests}")


if __name__ == "__main__":
    try:
        main()
    except Exception:  # never break session start
        print("## Live repo facts: unknown (context_facts.py failed)")
