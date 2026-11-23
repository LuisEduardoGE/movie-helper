# Next Steps

## Agreed order

No plan or TODO list exists in the repo beyond what's shipped. Suggested order, **to be
confirmed with the user**:

1. NS-001 — Bring `CLAUDE.md` / `README.md` in line with the phased flow (KI-001).
2. NS-002 — Decide what the lobby's rounds / cards-per-round controls should do (KI-002):
   wire them to `DECK_SIZE` or remove them.
3. NS-003 — Add backend tests for the session state machine and `_weighted_score` (no
   tests exist; the scoring has already been "fixed" once, commit 2026-05-13).
4. NS-004 — Redeploy to the live `/srv/movie-helper` layout (it lacks the SSRF fix); update
   `deploy.py` to that layout first, or deploy by hand per `docs/OPERATIONS.local.md`.

## Backlog

- NS-005 — Delete `refs/original/` and the local root screenshots / `debug/` (housekeeping;
  ask first).
- NS-006 — Persistence (rooms survive restarts) — only if the app gets real use.
