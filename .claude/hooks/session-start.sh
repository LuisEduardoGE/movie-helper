#!/usr/bin/env bash
# SessionStart hook (ai-context kit, ported from House Hunter).
#
# Puts live repo facts into context so no session trusts a sha or count typed into a doc
# days ago. With the argument "compact" it also asks for a docs/ai-context sync: after a
# compaction the summary is all that is left, so the sync is done from it. (A PreCompact
# hook cannot do this - Claude Code discards its output.)
#
# FAILS OPEN: prints nothing rather than erroring.

cat >/dev/null 2>&1   # drain the hook input
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" 2>/dev/null || exit 0
[ -d docs/ai-context ] || exit 0

PY=$(command -v python 2>/dev/null || command -v python3 2>/dev/null) || exit 0
"$PY" .claude/hooks/context_facts.py 2>/dev/null

cat <<'EOF'

This repo keeps persistent memory in docs/ai-context. Before planning or editing, read
00-INDEX, 01-PRODUCT, 02-ARCHITECTURE, 04-CURRENT-STATE and 05-NEXT-STEPS; grep 03-DECISIONS
and 06-KNOWN-ISSUES for the area you touch.
EOF

if [ "$1" = "compact" ]; then
  cat <<'EOF'

The conversation was just compacted. Before continuing, check whether this session changed
anything docs/ai-context should record; if so, run the /sync-context workflow from the summary
above. Record only what the summary shows was confirmed - never reconstruct test results or
production state.
EOF
fi
exit 0
