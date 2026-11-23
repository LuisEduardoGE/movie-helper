# Product

## Purpose

Movie Helper helps a couple or small group decide what to watch tonight. Players join a room
by 5-character code, pick TMDB genres, swipe Tinder-style through TMDB movies
(like / maybe / dislike / already seen), resolve their "maybes" and a head-to-head, and get
a winner (with a Top 3 view and "Choose again"). Visual language: "Polaroid Stack" (cream
paper, Fraunces serif, rubber-stamp vote buttons). Rebuilt on 2026-05-12 from an earlier
Wavelength-style spectrum game.

## Users

Personal / friends app. No accounts or auth: a player is a name + avatar inside a room
(`backend/app/rooms.py:26-32`, name 1–32 chars). Anyone with the room code can join.

## Business rules (enforced in code)

**Rooms** — code = 5 chars from A–Z0–9, unique among live rooms (`rooms.py:44-49`); lookup is
case-insensitive (`rooms.py:53`). Everything is in memory — restarting the backend clears
all rooms and sessions.

**Session states** `picking_genres → swiping → revealed` (`backend/app/sessions.py:15`); a
new session can't start while one is unrevealed (`sessions.py:420`). Phases inside swiping:
`discovery → pairwise_maybes → narrow → head_to_head → revealed` (`sessions.py:16-22`).

**Genres** — candidates are fetched only once **every current room player** (including late
joiners) has locked their genres (`sessions.py:446-455`); the union of all picks drives TMDB
discover, 80 movies fetched and shuffled (`INITIAL_FETCH_COUNT`, `:30`); empty union → 400.

**Votes** — rejected unless state is `swiping` and the phase accepts stamp votes; "maybe" is
not allowed in every phase (`sessions.py:479-500`). A card advances only when all room
players voted on it (`_all_players_voted_on_card`, `:283`). The deck is **12 cards**
(`DECK_SIZE`, `:27`). After each card the unplayed pool is re-sorted by genre affinity
(liked/maybe genres up, disliked down; `:242`). Lobby `rounds` / `cards_per_round` are
accepted but **ignored** (`:90-93`).

**Seen** — any "seen" vote in any phase removes the movie from ranking and survival
(`sessions.py:142,236`).

**Pairwise maybes** — every movie any player marked maybe is shuffled into pairs; a lone
leftover becomes a like for those who maybe'd it (`sessions.py:317-338`).

**Scoring** (`_weighted_score`, `sessions.py:172`): discovery like 1.0, maybe 0.25,
unanimous discovery like +0.5, pairwise win +0.75, narrow-round like +2.0. Ties → higher TMDB
`vote_average`. Survivors = unseen with ≥ 1 like; > 3 survivors → `narrow` round; 2–3 →
head-to-head of the top two; ≤ 1 → reveal (`:367-392`).

**Redraw ("Choose again")** — resets to discovery with movies never shown in this room
(`sessions.py:575`).

**TMDB fallback** — without `TMDB_API_KEY` a curated genre/movie list is served
(`backend/app/tmdb.py:105-151`); `/api/health` reports `tmdb: key|fallback`. TMDB
attribution is required in the footer (`CLAUDE.md`).

**Image proxy** — `/api/proxy-image` only fetches `https` URLs on an allowlist of Wikimedia /
Wikipedia / TMDB image hosts, else 400 (SSRF guard, `backend/app/main.py:10-17,61-70`).
