# CLAUDE.md

Notes for Claude Code when working in this repo.

<!-- ai-context:start -->
## Project persistent context

This project keeps its long-lived knowledge in **`docs/ai-context`** (plain Markdown;
Obsidian-compatible). Ported from House Hunter's system.

**At the start of every session:** a `SessionStart` hook prints live repo facts
(`.claude/hooks/context_facts.py`) — they outrank any sha or count in a doc. Then read in full:
`docs/ai-context/00-INDEX.md`, `01-PRODUCT.md`, `02-ARCHITECTURE.md`, `04-CURRENT-STATE.md`,
`05-NEXT-STEPS.md`. **Grep, don't read end to end:** `03-DECISIONS.md` before changing behaviour
in an area, `06-KNOWN-ISSUES.md` before debugging a module.

**Before completing a session:** run **`/sync-context`**. Two `Stop` hooks back it up — one when
source changed since `docs/ai-context` was last updated but the docs did not, one when the
working tree is dirty — each firing once per distinct state.

- `04-CURRENT-STATE.md` is a **snapshot**, never a changelog; history goes in `sessions/`.
- `03-DECISIONS.md` is append-only — supersede, don't edit.
- `06-KNOWN-ISSUES.md` needs evidence; delete entries once fixed.
- Record only what was verified; say "unverified" for unchecked production state. No secrets.
- **Code outranks all documentation.** When a doc contradicts the code, say so and fix the doc
  in the same change. Session notes are history, not specifications.
<!-- ai-context:end -->

## What this is

Movie Helper v2 — a Wavelength-inspired but rebuilt couples app for picking a movie. Players join a room, choose TMDB genres, swipe Tinder-style through fetched movies (👎 / 🤔 / 👍 / 👁️ seen), and the Top 3 reveals at the end. Visual language: "Polaroid Stack" (cream paper, Fraunces serif, rubber-stamp vote buttons).

## Stack

- **Backend**: FastAPI 0.115 + Pydantic v2 + `httpx` for TMDB. Split across `backend/app/{main,rooms,sessions,tmdb}.py`. In-memory storage (no DB).
- **Frontend**: React 19 + Vite 6 + TypeScript 5.7. Hand-rolled components in `frontend/src/components/`. Plain CSS in `frontend/src/styles.css`. Google Fonts: Fraunces / Inter Tight / Caveat / JetBrains Mono.
- **Dev orchestrator**: `run.py` boots both servers.

## Run

`python run.py` from repo root. Frontend at 127.0.0.1:5173; backend at 127.0.0.1:8000 (Vite proxies `/api/*`).

Set `TMDB_API_KEY` env var for real posters; otherwise the curated fallback runs.

## State machine

A `Session` belongs to a `Room` and moves through `picking_genres → swiping → revealed`. The session has a `cursor` (current candidate index). A card advances only when every player in the room has cast a `Vote`. "Already seen" votes exclude the movie from the Top 3 entirely.

Single server-side `cursor` (not per-player) ensures every client always renders the same "current card" — no reconciliation logic on the frontend.

## Polling cadence

- Lobby / genre picker: 2.5s
- Active swiping: 1.5s
- After winner declared: polling stops

## Conventions

- All Pydantic v2 models, `Field(min_length=…)` for input validation.
- IDs are `str(uuid4())`; room codes are 5-char A–Z / 0–9.
- ISO UTC timestamps everywhere.
- Don't introduce Tailwind / styled-components — the CSS variables in `styles.css` are the design system.
- Posters via TMDB's image CDN at `https://image.tmdb.org/t/p/<size><path>`. `lib/tmdb.ts` exposes `posterUrl(path, size)`.

## Things to watch

- TMDB rate limit is generous but the LRU cache in `tmdb.py` matters when running many sessions back-to-back.
- The session state machine MUST reject votes when state != "swiping" (already enforced; don't loosen it).
- Reload mid-session: the backend session state is the source of truth — UI re-renders into the correct screen from `Session.state`.
- TMDB attribution required (already in the footer).
