# Known Issues

Evidence-backed only (command output, `file:line`) — not suspicions. **Delete entries once
fixed**; the fix lives in git history.

## KI-001 — CLAUDE.md / README / spec describe the old v2 flow
**Evidence:** `CLAUDE.md` and `README.md` say the session ends with a Top 3 by aggregate
vote and that the lobby configures rounds and cards-per-round; the spec scores like 2 /
maybe 1. Code: fixed `DECK_SIZE = 12` (`backend/app/sessions.py:27`), phases
`pairwise_maybes → narrow → head_to_head` (`:16-22`), weights 1.0 / 0.25 / +0.5 / +0.75 /
+2.0 (`:172-209`). `CLAUDE.md` also calls the `tmdb.py` cache "LRU"; it is a TTL dict that
evicts the earliest-expiring entry when full, i.e. insertion order, not recency
(`tmdb.py:62-63,97-102`).
**Impact:** Anyone working from the docs will misread the scoring and flow.

## KI-002 — Lobby round settings are ignored
**Evidence:** `StartSessionRequest.rounds` / `cards_per_round` — "Kept for backward compat
with the existing frontend lobby; ignored." (`backend/app/sessions.py:90-93`).
**Impact:** UI controls that do nothing.

## KI-003 — No player authentication inside a room
**Evidence:** vote / genre / pairwise / h2h requests carry a plain `player_id` in the body
(`sessions.py:96-114`) and only check membership in the room.
**Impact:** Anyone with the room code and a player id can vote as that player. Acceptable for
a friends app; matters if exposed publicly.

## KI-004 — State is lost on restart / deploy
**Evidence:** rooms and sessions are module-level dicts (`rooms.py:35` `rooms`,
`sessions.py:121` `sessions_store`); README: "restarting the backend clears them".
**Impact:** Every `deploy.py` run ends all live rooms.
