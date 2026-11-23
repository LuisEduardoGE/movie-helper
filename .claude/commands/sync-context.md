---
description: Sync docs/ai-context with what changed this session
---

Synchronize the persistent project context in `docs/ai-context/`.

Work through these in order. Skip a file only if genuinely nothing changed for it,
and say which ones you skipped and why.

## 1. `04-CURRENT-STATE.md`

Update to describe what exists **now**. It is a **snapshot, not a changelog**:
rewrite the lines that changed; never append a dated "landed on…" section. How we got here
belongs in the session note.

- Run `python .claude/hooks/context_facts.py` first. Do **not** copy `HEAD`, ahead/behind or
  test-file counts into 04 — the script and the `SessionStart` hook print them live. Only facts git
  cannot tell (e.g. the production deploy sha and date) are written down.
- Test status — keep **one** table, newest results only. Only report a suite you actually ran
  this session (or a CI run you looked up), with real numbers, sha and date. If you didn't run
  it, keep the previous row and its date rather than presenting it as fresh.
- Move anything that shipped from "In progress" / "Merged, not yet in production" to "Working".
- `Last updated:` is a date plus one sentence — never a run-on history.

## 2. `05-NEXT-STEPS.md`

- Remove work that got done (delete the entry; a done entry that leaves follow-ups keeps only
  the follow-ups).
- Add work that got discovered.
- Preserve the *Agreed order* section and its reasoning. If this session's findings
  genuinely invalidate that order, don't silently rewrite it — say so and ask.

## 3. `03-DECISIONS.md`

Append a `DEC-nnn` entry **only** for a decision that will constrain future work:
context / decision / consequences, dated, with the next free number.

This file is append-only. To change an accepted decision, add a new entry and mark the
old one `Superseded by DEC-nnn`. Never edit an accepted entry in place.

Not a decision: something you tried once, a preference with no consequences, or anything
still under discussion.

## 4. `06-KNOWN-ISSUES.md`

- Add newly discovered problems, with the evidence that proves them (command output,
  `file:line`) — not a suspicion.
- **Delete entries that were fixed.** The fix lives in git history; a resolved issue left
  in this file is noise that costs the next reader time.

## 5. `02-ARCHITECTURE.md` / `01-PRODUCT.md`

Only if the structure or the business rules actually changed. These are the slowest-moving
files — if you're editing them every session, something is being recorded at the wrong
altitude.

## 6. Session note

Write `docs/ai-context/sessions/YYYY-MM-DD.md` (use today's real date; append to it if it
already exists) covering:

- What changed, and which files
- Commands run and their **actual** output — especially tests
- Findings worth remembering, with evidence
- Decisions taken, and any left open
- The recommended starting point for the next session

## Rules

- **Verify before writing.** Read the git state and run the checks. Do not describe the
  repo from memory of this conversation — that is how these files go stale.
- **Record what was confirmed**, not what was discussed, planned, or speculated about.
- **Never mention Claude or AI** in any commit this produces (global rule).
- **Never write secrets** — passwords, tokens, keys, connection strings, production
  credentials.
- **Never assert production state you did not verify.** Say "unverified" instead.
- **Prune.** 00, 01, 02, 04 and 05 are read at the start of every session; length is a real
  cost. Removing something obsolete is as valuable as adding something new. Keep 04 short
  (≈ 200 lines); if it grows, history is leaking into it.

When done, report which files you changed and what the next session should start with.
