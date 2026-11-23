#!/usr/bin/env bash
# Stop hook: never let work sit uncommitted at the end of a session.
#
# Why this exists (ported from House Hunter): on 2026-09-08 a 980-line UI pass was left
# in the working tree for 15 days, on a branch named for unrelated work. That is the
# failure this hook is meant to make impossible.
#
# Fires at most ONCE per distinct dirty state: a fingerprint of `git status` is
# kept in SENTINEL, so "these changes are disposable" is respected until the tree
# changes again.
#
# It deliberately does NOT short-circuit on stop_hook_active. Both Stop hooks run in
# parallel; when sync-context-check.sh makes Claude write docs, that continuation
# ends with stop_hook_active=true and those fresh doc edits must still be caught.
# The fingerprint (plus Claude Code's own consecutive-block cap) prevents loops.
#
# FAILS OPEN: any error, missing git, or non-repo state allows the stop.
# Disable: remove the uncommitted-check entry from .claude/settings.json.

SENTINEL=".claude/.uncommitted-nudged"

allow() { exit 0; }

cat >/dev/null 2>&1   # drain the hook input; nothing in it is needed

# Resolve from the repo root - the Bash tool cwd persists between calls (e.g. after
# `cd backend`), so this
# hook routinely fires from a subdirectory.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" 2>/dev/null || allow

command -v git >/dev/null 2>&1 || allow
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || allow

DIRTY=$(git status --porcelain 2>/dev/null) || allow
if [ -z "$DIRTY" ]; then
  rm -f "$SENTINEL" 2>/dev/null
  allow
fi

FINGERPRINT=$( { git rev-parse HEAD; git status --porcelain; git diff; } 2>/dev/null | git hash-object --stdin 2>/dev/null) || allow
[ "$(cat "$SENTINEL" 2>/dev/null)" = "$FINGERPRINT" ] && allow
printf '%s' "$FINGERPRINT" > "$SENTINEL" 2>/dev/null

COUNT=$(printf '%s\n' "$DIRTY" | grep -c .)
FILES=$(printf '%s\n' "$DIRTY" | head -12 | sed 's/^/  /')
[ "$COUNT" -gt 12 ] && FILES="${FILES}
  ... and $((COUNT - 12)) more"

BRANCH=$(git branch --show-current 2>/dev/null)
[ -z "$BRANCH" ] && BRANCH="(detached HEAD)"

# Built here, with real newlines, so neither encoder below needs escape sequences.
REASON="There are ${COUNT} uncommitted path(s) on branch ${BRANCH}:

${FILES}

Commit them before finishing (no Claude/AI mention in the message - global rule).
If the branch name no longer matches the work, cut a new branch first. If the
changes are genuinely disposable, say so in one line and stop - this check will
not fire again until the working tree changes."
MSG="${COUNT} uncommitted path(s) on ${BRANCH} - prompting Claude to commit."

# Encode with whatever is available; each encoder does its own escaping, so the
# file list can never break the JSON. Values travel by env, never interpolated
# into code.
if command -v jq >/dev/null 2>&1; then
  HOOK_REASON="$REASON" HOOK_MSG="$MSG" jq -n \
    '{decision:"block", reason:env.HOOK_REASON, systemMessage:env.HOOK_MSG}' && exit 0
fi

PY=$(command -v python 2>/dev/null || command -v python3 2>/dev/null)
if [ -n "$PY" ]; then
  HOOK_REASON="$REASON" HOOK_MSG="$MSG" "$PY" -c 'import json,os;print(json.dumps({"decision":"block","reason":os.environ["HOOK_REASON"],"systemMessage":os.environ["HOOK_MSG"]}))' && exit 0
fi

# Neither encoder present: a fixed, file-list-free message rather than risk
# emitting malformed JSON.
printf '{"decision":"block","reason":"There are %s uncommitted path(s) on branch %s. Commit them before finishing, or say in one line why they are disposable - this check will not fire again until the working tree changes.","systemMessage":"%s uncommitted path(s)."}\n' \
  "$COUNT" "$BRANCH" "$COUNT"
