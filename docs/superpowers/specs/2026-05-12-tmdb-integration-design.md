# Movie Helper v2 — Genre-Swipe Redesign

**Status:** Awaiting user approval
**Date:** 2026-05-12
**Owner:** Luis Eduardo
**Supersedes:** the earlier "TMDB integration v1" draft on this same date — the mechanic itself has changed, so this spec replaces it rather than extending it.

## Problem

The current Movie Helper is a clever Wavelength clone — pick a movie, place it on a spectrum, hope you're closest to a hidden target. It's a *game*, but it doesn't actually help two people **decide what to watch tonight**. There's no curated movie set to choose from, no posters, no aggregation of preferences.

We're rebuilding the core loop around a Tinder-style swipe over a TMDB-filtered movie list. The Wavelength heritage stays as inspiration (categories shape the candidate pool), but the spectrum/target mechanic is retired.

## Goals (v2)

1. Two players join a room and each pick TMDB genres they're up for.
2. The room runs N rounds (player-configured) of ~10 movie cards each, shown one at a time.
3. For each card, every player votes: 👍 Like (2pts), 🤔 Maybe (1pt), 👎 Dislike (0pts), or 👁️ Already seen (excludes movie from final ranking).
4. A movie advances to scoring only once every player in the room has voted.
5. After the last round, surface a **Top 3** by aggregate score.
6. Wrap it all in a distinctive **Polaroid Stack** visual language — posters as physical artifacts, warm cream paper background, rubber-stamp vote buttons.

## What we keep, what we kill

| Keep | Replace / kill |
|---|---|
| Room creation + 5-char code | `Round` (spectrum + clue + target) |
| Join-by-code flow | `MoviePick` (title + position + note) |
| Player + name model | `axisPresets` |
| 2.5s polling (tightened to 1.5s in active session) | Spectrum bar, target reveal, slider |
| `localStorage` session | Hardcoded curated seed list |
| FastAPI + in-memory architecture | `/api/movie-seeds`, `/api/rooms/.../rounds`, `/api/.../picks`, `/api/.../reveal` |

## New mechanic — game loop

1. **Welcome** → create or join a room (unchanged).
2. **Lobby** → players gather; **any player** can configure + start the session (rounds, cards per round). There is no formal host role — the room creator has no special powers. The first player to hit "Start" commits the config.
3. **Genre picker** → each player picks 1–3 TMDB genres. Players vote to commit; once everyone's locked in, the union of all selections becomes the genre filter.
4. **Session start** (server-side) → backend hits TMDB `/discover/movie?with_genres=<a>|<b>|<c>&sort_by=popularity.desc&vote_count.gte=500&primary_release_date.gte=2000-01-01` (pipe-separated genre IDs = TMDB's OR / union syntax; comma-separated would be AND) and fetches `rounds × cardsPerRound` candidates, shuffles them, and stores them ordered. If TMDB returns fewer candidates than requested (e.g. obscure genre intersection), the session is created with whatever was available and `cards_per_round` is recomputed downwards so all rounds stay equal.
5. **Swipe loop** → each round shows N cards in sequence. Per card: each player picks Like / Maybe / Dislike / Already seen. Card advances to the next when **all players have voted**. While waiting, each player sees "Waiting for *Other*…".
6. **Reveal** → after the final round, show the Top 3 by aggregate score (any movie marked "Already seen" by anyone is filtered out before ranking).
7. **Pick a winner** → players can tap one of the three to declare "we're watching this." Decision logged on the session.

### Edge rules (locked)

- **Union genres** — pool = movies in *any* selected genre.
- **Any "Already seen" → eliminates the movie** from the Top 3 entirely (the card is still shown so the player can express their vote, but the movie can't win). This matches "I've seen it, find me something else."
- **Ties in Top 3** broken first by total Likes, then by earlier appearance in the shuffled order (stable).

## Data model

```python
class Player(BaseModel):
    id: str
    name: str

class Room(BaseModel):
    code: str
    players: list[Player]
    session: Session | None = None   # populated once the session starts
    created_at: str

class Session(BaseModel):
    id: str
    genres: list[int]                # TMDB genre IDs (union across players)
    rounds: int                      # configured count (1..10)
    cards_per_round: int             # default 10
    candidates: list[Candidate]      # length == rounds * cards_per_round
    cursor: int                      # index of the card currently being voted on
    state: Literal["lobby", "picking_genres", "swiping", "revealed"]
    revealed_at: str | None
    winner_tmdb_id: int | None       # set when someone hits "watch this"

class Candidate(BaseModel):
    tmdb_id: int
    title: str
    year: int | None
    poster_path: str | None
    overview: str
    votes: dict[str, Vote]           # player_id -> Vote

class Vote(BaseModel):
    value: Literal["like", "maybe", "dislike", "seen"]
    created_at: str

class GenreChoice(BaseModel):        # per-player intent during picking_genres
    player_id: str
    genres: list[int]
    locked: bool                     # True once they hit "Lock in"
```

The `Session.cursor` is the *current card index*. The frontend doesn't trust its own state — it always renders `candidates[cursor]`. As soon as every player has voted on that card, the backend advances `cursor`. This sidesteps race conditions with multiple simultaneous voters.

## Endpoints

Unchanged: `POST /api/rooms`, `POST /api/rooms/{code}/join`, `GET /api/rooms/{code}` (now includes session if active), `GET /api/health`.

New:

```
GET  /api/genres                                 -> { "genres": [ { id, name } ] }   (cached TMDB genre list)
POST /api/rooms/{code}/session                   { rounds, cards_per_round } -> starts session in "picking_genres"
POST /api/rooms/{code}/session/genres            { player_id, genres, locked } -> sets/updates that player's pick
                                                  side effect: when all players are `locked: true`, server transitions
                                                  to "swiping" and fetches candidates from TMDB
POST /api/rooms/{code}/session/vote              { player_id, value } -> records vote on candidates[cursor];
                                                  if every player has voted, advances cursor; if cursor == end,
                                                  transitions state to "revealed"
POST /api/rooms/{code}/session/winner            { tmdb_id } -> records the winning movie
DELETE /api/rooms/{code}/session                 -> abandon session; room goes back to lobby
```

Removed (replaced by the above): `/api/movie-seeds`, `/api/rooms/{code}/rounds`, `/api/rooms/{code}/rounds/{round_id}/picks`, `/api/rooms/{code}/rounds/{round_id}/reveal`.

`GET /api/rooms/{code}` returns a sanitized session — `winner_tmdb_id` is only included when state == "revealed".

## Backend module layout

`backend/app/main.py` becomes too big to keep as one file. Split:

```
backend/app/
  main.py        FastAPI app, CORS, route mounting, /api/health, /api/genres
  rooms.py       Room + Player models, in-memory store, create/join/read room routes
  sessions.py    Session/Candidate/Vote models, all session routes, scoring helper
  tmdb.py        httpx async client, in-memory LRU cache (5 min, max 256 entries),
                 search-by-genres, genre catalog, env-var read, curated fallback
```

`backend/requirements.txt` gains `httpx==0.27.2`.

TMDB key read from env var `TMDB_API_KEY`. If unset: `/api/genres` returns a small static genre list, `tmdb.discover()` returns a hand-curated 30-movie list (no posters, year-only metadata). The app stays playable for setup/demo.

## Frontend architecture

`src/main.tsx` is rewritten — the spectrum components are gone. New layout:

```
src/main.tsx                   App + session state + polling + api()
src/components/WelcomeScreen.tsx
src/components/LobbyScreen.tsx              waiting room + session config
src/components/GenrePicker.tsx              chip-grid genre selector + "lock in"
src/components/SwipeDeck.tsx                the polaroid stack (hero component)
src/components/PolaroidCard.tsx             one card (poster + caption + tilt + shadow)
src/components/VoteStamps.tsx               4 rubber-stamp buttons
src/components/RevealTop3.tsx               final reveal screen with podium
src/components/PosterImage.tsx              tmdb poster_path -> <img> w/ fallback
src/components/RoomHeader.tsx               thin top bar (code, leave, player chips)
src/lib/api.ts                              the api() helper + types (moved out of main.tsx)
src/lib/tmdb.ts                             posterUrl(path, size)
src/styles.css                              new design system (Polaroid Stack)
```

### Polling cadence

- Lobby + genre picker: poll `GET /api/rooms/{code}` every 2.5s.
- Active swiping: 1.5s (we want the next card to appear fast once the partner votes).
- Revealed: stop polling (no further state changes).

### Optimistic vote

When a player taps a stamp, the UI immediately marks their vote locally + shows a "Waiting for *Partner*…" sub-message. The next poll either confirms (vote registered server-side) or shows an error toast and reverts.

## Visual language — "Polaroid Stack"

Aesthetic: **warm cream paper, posters as physical objects, hand-touched details.** A movie night with a friend, not a SaaS dashboard.

### Palette (CSS variables, replacing the current `:root`)

```
--paper:        #f4ead5     /* warm cream background */
--paper-deep:   #e8dcc0     /* card backs / dividers */
--ink:          #1a1612     /* near-black text */
--ink-soft:     #5a4f44     /* secondary text */
--stamp-no:     #c43c2a     /* dislike */
--stamp-maybe:  #d99524     /* maybe (amber) */
--stamp-yes:    #2f7a44     /* like (forest green) */
--stamp-seen:   #2a4a7a     /* already seen (ink blue) */
--highlight:    #ffc857     /* honey accent for selection/active states */
--shadow-soft:  rgba(26, 22, 18, 0.18)
```

### Typography (Google Fonts — no licensing issues)

- **Display:** `Fraunces` — variable serif with optical sizing; used for headlines and movie titles. Weights 600–800.
- **Body:** `Inter Tight` — neutral, modern, more refined than Inter. Weight 400 + 600.
- **Accent (handwritten):** `Caveat` — used sparingly for "polaroid captions" (e.g. clue under poster, "Waiting for Luis…" toasts).
- **Mono (room code):** `JetBrains Mono` weight 500, letter-spacing 0.08em.

### The Polaroid card

A `PolaroidCard` is a `~480 × 640` panel with:

- White `#fffaf0` background (slightly warmer than pure white)
- 24px padding all around the poster, except 80px at the bottom (the "caption strip")
- 2 ° random tilt on the active card; next card peeks at -3 ° behind it; the 3rd peeks further behind
- Drop shadow: `0 22px 40px -12px var(--shadow-soft), 0 8px 12px -6px rgba(0,0,0,0.12)`
- Subtle paper texture overlay (SVG fiber noise at ~6% opacity)
- Poster image: 4:6 aspect, full bleed inside the inner border
- Caption strip: movie title (Fraunces 700, 22px) + year (Inter Tight 500, 14px, --ink-soft); on hover, a small `i` button flips the card to show a 2-line overview

The "stack" effect: render the next two cards behind the active one at different z-indices, slightly rotated and offset, so swipes feel like dealing.

### Vote buttons — rubber stamps

Four circular "stamp" buttons arranged horizontally below the deck. Each:

- 64 × 64 px circle with a 3px ring in the stamp color
- Stamp-style label inside (Fraunces 800, all caps, slightly rotated like a real stamp impression)
- Hover: tilt + drop the stamp 2px like it's being pressed
- Click: a "stamp" animation — quick scale-down + a brief opacity flash on the card (the chosen stamp color tints the corner)
- Keyboard: 1 / 2 / 3 / 4 trigger the four stamps (Dislike / Maybe / Like / Seen)

Order left-to-right: `👎 NO`, `🤔 MAYBE`, `👍 YES`, `👁️ SEEN`.

### Layout per screen

- **Welcome:** A single polaroid floats centered with the headline written on it in Caveat. Form below — only the name input + two buttons. The current giant headline is replaced.
- **Lobby:** Two/three polaroid placeholders representing players, hand-written names. Host gets a small "Configure session" panel with two sliders (rounds 1–10, cards per round 5–15).
- **Genre picker:** Chips arranged loosely (like stickers on paper) — each genre is a small rounded rectangle in --paper-deep with the genre name in Fraunces. Selected chips pop forward with a stronger shadow + honey ring. A "Lock in" button at the bottom flips a status row above into ✓ for that player.
- **Swipe deck:** The polaroid stack centered, vote stamps below, partner status row above ("Waiting for Alex… 🤔" once you've voted). Round indicator top-left ("Round 2 / 3 · Card 4 / 10"). Room code top-right.
- **Reveal Top 3:** Three polaroids on a podium (#1 center+higher, #2 left, #3 right), each with their score stamp on the corner. A big "Tap to choose" prompt — tapping declares the winner; that card grows + tilts upright + gets a "WATCHING TONIGHT" stamp.

### Motion (use CSS only — keep the dep tree clean)

- Card enter: 200ms ease-out from `translateY(40px) scale(0.95) rotate(0deg)` to its tilted resting state.
- Stamp press: 120ms scale-down + 200ms color flash on the active card corner.
- Card exit (next card): 300ms `translateX(40px)` + fade — feels like a swipe even when the user clicks a button.
- Top 3 reveal: each polaroid staggers in with a 120ms delay (left, right, center last).
- Hover on stamp: 100ms tilt + 2px translate.

### Decorative atmosphere

- Subtle paper grain (SVG noise) tiled across the body.
- A few "tape pieces" pinning the active card to the imaginary cork — small skewed rectangles in `--paper-deep` at the corners.
- Footer line: small "Movie data by TMDB" in Inter Tight 12px italic.

## Configuration

- `TMDB_API_KEY` env var.
- `.env.example` at repo root.
- README rewritten — explain the new genre-swipe mechanic, optional TMDB key, run flow.
- CLAUDE.md updated to reflect the new architecture (module split, session state machine, polling cadences).

## Acceptance criteria

1. Two players in two browsers can create a room, both pick genres, lock in, and the session transitions to swiping with real TMDB movies + posters.
2. Every card waits for both players' votes before advancing.
3. "Already seen" excludes the movie from the Top 3 even with otherwise high scores.
4. After the last card, the Top 3 reveal renders with three polaroids and correct ranking.
5. Tapping a Top 3 poster locks in the winner; both players' views reflect it.
6. Without `TMDB_API_KEY`: the curated fallback list runs end-to-end without errors (no posters).
7. `npm run typecheck` passes; backend boots without errors.
8. Visual: the Polaroid Stack aesthetic is unmistakable on every screen — cream paper, Fraunces serif, rubber-stamp buttons.

## Risks and watch-items

- **TMDB rate limit:** generous, but each session fetches ~30+ candidates. With the 5-min LRU cache keyed on (sorted genre tuple + page), repeated sessions in the same genres are free.
- **Polling rather than push:** with 1.5s cadence in active swiping, the partner sees your vote with ~1–1.5s lag. Acceptable for v2 — a follow-up can move to SSE.
- **State transitions:** the session state machine (`lobby → picking_genres → swiping → revealed`) is small but critical. The backend must reject votes when state ≠ "swiping". Unit tests would help; deferred since the codebase has none today.
- **Reload mid-session:** localStorage already persists the room code + player. On reload, the session state lives on the server, so the UI just re-renders into the correct screen based on the polled `Session.state`.
- **Card stack rendering on smaller widths:** the polaroid is 480px wide; on mobile we'll scale to viewport width minus 32px and reduce tilt to 1°.

## Non-goals (deferred)

- WebSocket / SSE — polling stays.
- SQLite or any persistence — rooms still in-memory.
- Automated tests — codebase has none; introducing pytest + vitest is its own decision.
- Watch providers (where-to-stream) — natural follow-up; needs region setting.
- Trailers / cast info / search across all movies.
- Wavelength role enforcement (psychic-can't-pick) — the spectrum mechanic is gone, so this is moot.
- More than 2–3 simultaneous players — the spec works for any N, but the UX (polaroid stack, "waiting for…" copy) is tuned for couples / small groups.

## Follow-up tracks (out of scope here)

- SSE for instant vote sync.
- "I want to watch alone" single-player mode.
- Watch providers per region.
- A persistent "watchlist" — movies you marked Like across sessions.
- TMDB trailer embedding on the reveal screen.
