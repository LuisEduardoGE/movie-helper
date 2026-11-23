#!/usr/bin/env bash
# Stop hook (ai-context kit, ported from House Hunter): ask for a docs/ai-context sync when
# source changed and the docs did not.
#
# Baseline = the last commit that touched docs/ai-context (works with or without a remote,
# on any default-branch name). "Source changed" = any path outside docs/, *.md and .claude/
# differs from that baseline, committed, uncommitted or untracked. "Docs unchanged" =
# docs/ai-context has no edits since that baseline. Committing a sync moves the baseline.
#
# Fires at most ONCE per distinct state (fingerprint in SENTINEL), so "nothing material
# changed" is respected until the source changes again. Honours stop_hook_active.
#
# FAILS OPEN. Disable: remove the Stop hook from .claude/settings.json.

CTX_DIR="docs/ai-context"
SENTINEL=".claude/.sync-nudged"

allow() { exit 0; }

INPUT=$(cat 2>/dev/null)
printf '%s' "$INPUT" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && allow

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" 2>/dev/null || allow
[ -d "$CTX_DIR" ] || allow
command -v git >/dev/null 2>&1 || allow
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || allow

BASE=$(git log -1 --format=%H -- "$CTX_DIR" 2>/dev/null)
[ -n "$BASE" ] || BASE=HEAD

SRC_SPEC=(. ':(exclude)docs' ':(exclude)*.md' ':(exclude).claude' ':(exclude)*.lock' ':(exclude)package-lock.json')
SRC=$( { git diff --name-only "$BASE" -- "${SRC_SPEC[@]}"; git ls-files --others --exclude-standard -- "${SRC_SPEC[@]}"; } 2>/dev/null | sort -u)
[ -n "$SRC" ] || allow
DOCS=$( { git diff --name-only "$BASE" -- "$CTX_DIR"; git ls-files --others --exclude-standard -- "$CTX_DIR"; } 2>/dev/null)
[ -z "$DOCS" ] || allow

FINGERPRINT=$( { git rev-parse HEAD; printf '%s\n' "$SRC"; } | git hash-object --stdin 2>/dev/null) || allow
[ "$(cat "$SENTINEL" 2>/dev/null)" = "$FINGERPRINT" ] && allow
printf '%s' "$FINGERPRINT" > "$SENTINEL" 2>/dev/null

COUNT=$(printf '%s\n' "$SRC" | grep -c .)

cat <<EOF
{"decision":"block","reason":"${COUNT} source path(s) changed since docs/ai-context was last updated, but docs/ai-context did not. Run the /sync-context workflow now before finishing: rewrite 04-CURRENT-STATE.md as a snapshot (no changelog; git facts from .claude/hooks/context_facts.py, test results only from real runs), update 05-NEXT-STEPS.md preserving its Agreed order, append a DEC-nnn to 03-DECISIONS.md only for decisions that constrain future work, add evidence-backed entries to 06-KNOWN-ISSUES.md and delete fixed ones, and write docs/ai-context/sessions/YYYY-MM-DD.md. Record only what was confirmed. Never write secrets. If nothing materially changed, say so in one line and stop - this check will not fire again until the source changes.","systemMessage":"Source changed but docs/ai-context did not - prompting a sync."}
EOF
