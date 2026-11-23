# Movie Helper v2 — Genre-Swipe Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Movie Helper around a Tinder-style genre-filtered swipe over TMDB candidates, wrapped in a distinctive "Polaroid Stack" visual language.

**Architecture:** Backend splits `main.py` into `main / rooms / sessions / tmdb` modules; a new `Session` state machine (`lobby → picking_genres → swiping → revealed`) drives the round flow. Frontend rewrites the SPA around per-screen components (`WelcomeScreen / LobbyScreen / GenrePicker / SwipeDeck / RevealTop3`) and a new CSS design system on cream paper with Fraunces/Inter Tight/Caveat type. State sync stays poll-based but tightens to 1.5s during active swiping.

**Tech Stack:** FastAPI 0.115 + Pydantic v2, `httpx` 0.27 (new), in-memory state. React 19 + Vite 6 + TypeScript 5.7, hand-rolled UI, CSS variables, Google Fonts (`Fraunces`, `Inter Tight`, `Caveat`, `JetBrains Mono`), lucide-react icons. No test framework yet — verification is manual via the live app.

**Reference:** `docs/superpowers/specs/2026-05-12-tmdb-integration-design.md` is the source of truth for behavior and visuals.

---

## File map

### Backend (`backend/app/`)

| Path | Action | Responsibility |
|---|---|---|
| `main.py` | Rewrite | FastAPI app, CORS, router mounting, `/api/health`, `/api/genres` |
| `rooms.py` | Create | `Room`, `Player` models, in-memory store, room create/join/read routes |
| `sessions.py` | Create | `Session`, `Candidate`, `Vote`, `GenreChoice` models, all session routes, scoring helper |
| `tmdb.py` | Create | `httpx.AsyncClient`, LRU cache (5 min × 256), env-var read, `fetch_genres()`, `discover_movies(genre_ids, count)`, curated fallback |
| `requirements.txt` | Modify | Add `httpx==0.27.2` |
| `.env.example` | Create (repo root) | `TMDB_API_KEY=` placeholder |

### Frontend (`frontend/src/`)

| Path | Action | Responsibility |
|---|---|---|
| `main.tsx` | Rewrite | App + session-state polling + screen routing |
| `styles.css` | Rewrite | Polaroid Stack design system |
| `index.html` | Modify | Google Fonts + favicon |
| `public/favicon.svg` | Create | Tiny film-reel SVG |
| `lib/api.ts` | Create | `api<T>()` helper + shared TS types |
| `lib/tmdb.ts` | Create | `posterUrl(path, size)` helper + TMDB image base |
| `lib/grain.ts` | Create | Inline SVG noise data URI |
| `components/WelcomeScreen.tsx` | Create | Single polaroid + name input + new/join buttons |
| `components/LobbyScreen.tsx` | Create | Player polaroids + session config (rounds × cards) + Start button |
| `components/GenrePicker.tsx` | Create | Genre chip grid + per-player lock-in |
| `components/SwipeDeck.tsx` | Create | The polaroid stack + waiting-for state + card-advance polling |
| `components/PolaroidCard.tsx` | Create | One card: poster + title + year + tilt + tape + flip-for-overview |
| `components/VoteStamps.tsx` | Create | 4 rubber-stamp buttons + keyboard 1/2/3/4 |
| `components/RevealTop3.tsx` | Create | Podium reveal + tap-to-declare-winner |
| `components/RoomHeader.tsx` | Create | Thin top bar: code + leave + player chips |
| `components/PosterImage.tsx` | Create | `<img>` wrapper with onError fallback to film icon |
| `components/ui/*` | Delete | Old shadcn-style components (Button/Card/Badge/Input/Label/Slider) no longer used |

### Docs

| Path | Action |
|---|---|
| `README.md` | Rewrite |
| `CLAUDE.md` | Rewrite |

---

## Task ordering rationale

Backend first (clean foundation), then the design system (CSS + fonts so we see results immediately), then per-screen frontend components in the order of the user flow (welcome → lobby → genre → swipe → reveal). Each task is independently verifiable in the browser.

---

## Task 1 — Backend: TMDB module + httpx

**Files:**
- Create: `backend/app/tmdb.py`
- Modify: `backend/requirements.txt`
- Create: `.env.example`

- [ ] **Step 1.1:** Add `httpx==0.27.2` to `backend/requirements.txt` (append after the existing two lines).

- [ ] **Step 1.2:** Install httpx into the active environment.

```bash
python -m pip install httpx==0.27.2
```

Expected: `Successfully installed httpx-0.27.2`.

- [ ] **Step 1.3:** Create `.env.example` at repo root:

```
TMDB_API_KEY=
```

- [ ] **Step 1.4:** Create `backend/app/tmdb.py`:

```python
from __future__ import annotations

import asyncio
import os
import time
from typing import Any

import httpx
from pydantic import BaseModel

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "").strip()
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_TIMEOUT_SECONDS = 4.0
CACHE_TTL_SECONDS = 300
CACHE_MAX_ENTRIES = 256


class Genre(BaseModel):
    id: int
    name: str


class MovieDTO(BaseModel):
    tmdb_id: int
    title: str
    year: int | None
    poster_path: str | None
    overview: str


_cache: dict[tuple, tuple[float, Any]] = {}
_cache_lock = asyncio.Lock()


async def _cache_get(key: tuple) -> Any | None:
    async with _cache_lock:
        entry = _cache.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if expires_at < time.time():
            _cache.pop(key, None)
            return None
        return value


async def _cache_set(key: tuple, value: Any) -> None:
    async with _cache_lock:
        if len(_cache) >= CACHE_MAX_ENTRIES:
            oldest = min(_cache.items(), key=lambda kv: kv[1][0])[0]
            _cache.pop(oldest, None)
        _cache[key] = (time.time() + CACHE_TTL_SECONDS, value)


CURATED_GENRES: list[Genre] = [
    Genre(id=28, name="Action"),
    Genre(id=12, name="Adventure"),
    Genre(id=16, name="Animation"),
    Genre(id=35, name="Comedy"),
    Genre(id=80, name="Crime"),
    Genre(id=99, name="Documentary"),
    Genre(id=18, name="Drama"),
    Genre(id=10751, name="Family"),
    Genre(id=14, name="Fantasy"),
    Genre(id=36, name="History"),
    Genre(id=27, name="Horror"),
    Genre(id=10402, name="Music"),
    Genre(id=9648, name="Mystery"),
    Genre(id=10749, name="Romance"),
    Genre(id=878, name="Science Fiction"),
    Genre(id=53, name="Thriller"),
    Genre(id=10752, name="War"),
    Genre(id=37, name="Western"),
]

CURATED_MOVIES: list[MovieDTO] = [
    MovieDTO(tmdb_id=0, title=title, year=None, poster_path=None, overview="")
    for title in [
        "Arrival", "Before Sunrise", "Blade Runner 2049",
        "Everything Everywhere All at Once", "Fantastic Mr. Fox",
        "Good Time", "Heat", "Her", "In Bruges", "Mad Max: Fury Road",
        "Moonlight", "Nope", "Palm Springs", "Parasite", "Past Lives",
        "Portrait of a Lady on Fire", "Sing Street",
        "The Grand Budapest Hotel", "The Nice Guys", "Zodiac",
    ]
]


def has_key() -> bool:
    return bool(TMDB_API_KEY)


async def fetch_genres() -> list[Genre]:
    if not has_key():
        return CURATED_GENRES
    cached = await _cache_get(("genres",))
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=TMDB_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"{TMDB_BASE}/genre/movie/list",
                params={"api_key": TMDB_API_KEY, "language": "en-US"},
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError):
        return CURATED_GENRES
    genres = [Genre(id=g["id"], name=g["name"]) for g in data.get("genres", [])]
    await _cache_set(("genres",), genres)
    return genres


def _movie_from_tmdb(raw: dict) -> MovieDTO | None:
    if not raw.get("title") or not raw.get("id"):
        return None
    release = raw.get("release_date") or ""
    year = int(release[:4]) if release[:4].isdigit() else None
    return MovieDTO(
        tmdb_id=int(raw["id"]),
        title=str(raw["title"]),
        year=year,
        poster_path=raw.get("poster_path"),
        overview=str(raw.get("overview", "")),
    )


async def discover_movies(genre_ids: list[int], count: int) -> list[MovieDTO]:
    if not has_key() or not genre_ids:
        return CURATED_MOVIES[:count]
    sorted_ids = sorted(set(genre_ids))
    key = ("discover", tuple(sorted_ids))
    cached = await _cache_get(key)
    if cached is None:
        results: list[MovieDTO] = []
        try:
            async with httpx.AsyncClient(timeout=TMDB_TIMEOUT_SECONDS) as client:
                for page in (1, 2, 3, 4):
                    response = await client.get(
                        f"{TMDB_BASE}/discover/movie",
                        params={
                            "api_key": TMDB_API_KEY,
                            "language": "en-US",
                            "sort_by": "popularity.desc",
                            "vote_count.gte": 500,
                            "primary_release_date.gte": "2000-01-01",
                            "with_genres": "|".join(str(g) for g in sorted_ids),
                            "page": page,
                            "include_adult": "false",
                        },
                    )
                    response.raise_for_status()
                    page_data = response.json()
                    for raw in page_data.get("results", []):
                        movie = _movie_from_tmdb(raw)
                        if movie:
                            results.append(movie)
                    if not page_data.get("results"):
                        break
        except (httpx.HTTPError, ValueError):
            return CURATED_MOVIES[:count]
        await _cache_set(key, results)
        cached = results
    return cached[:count]
```

- [ ] **Step 1.5:** Verify the module imports cleanly.

```bash
python -c "from backend.app import tmdb; print('has_key=', tmdb.has_key()); print('genres=', len(tmdb.CURATED_GENRES))"
```

Expected: prints `has_key= False` (or True if you've set the env var) and `genres= 18`.

- [ ] **Step 1.6:** Commit.

```bash
git add backend/app/tmdb.py backend/requirements.txt .env.example
git commit -m "feat(backend): add TMDB client with LRU cache and curated fallback"
```

---

## Task 2 — Backend: rooms module

**Files:**
- Create: `backend/app/rooms.py`

- [ ] **Step 2.1:** Create `backend/app/rooms.py`:

```python
from __future__ import annotations

from datetime import datetime, timezone
from random import randint
from string import ascii_uppercase, digits
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


class Player(BaseModel):
    id: str
    name: str


class Room(BaseModel):
    code: str
    players: list[Player] = []
    session_id: str | None = None
    created_at: str


class CreateRoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)


class JoinRoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)


rooms: dict[str, Room] = {}

router = APIRouter()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_code() -> str:
    alphabet = ascii_uppercase + digits
    while True:
        code = "".join(alphabet[randint(0, len(alphabet) - 1)] for _ in range(5))
        if code not in rooms:
            return code


def get_room_or_404(code: str) -> Room:
    room = rooms.get(code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.post("/api/rooms")
def create_room(payload: CreateRoomRequest) -> dict:
    player = Player(id=str(uuid4()), name=payload.name.strip())
    room = Room(code=make_code(), players=[player], created_at=now_iso())
    rooms[room.code] = room
    return {"room": room.model_dump(), "player": player}


@router.post("/api/rooms/{code}/join")
def join_room(code: str, payload: JoinRoomRequest) -> dict:
    room = get_room_or_404(code)
    player = Player(id=str(uuid4()), name=payload.name.strip())
    room.players.append(player)
    return {"room": room.model_dump(), "player": player}


@router.get("/api/rooms/{code}")
def read_room(code: str) -> dict:
    from .sessions import public_session, sessions_store
    room = get_room_or_404(code)
    session_payload = None
    if room.session_id and room.session_id in sessions_store:
        session_payload = public_session(sessions_store[room.session_id])
    return {"room": room.model_dump(), "session": session_payload}
```

- [ ] **Step 2.2:** Commit (the import from `sessions` is forward-declared — it will resolve in the next task).

```bash
git add backend/app/rooms.py
git commit -m "feat(backend): extract rooms module with router"
```

---

## Task 3 — Backend: sessions module

**Files:**
- Create: `backend/app/sessions.py`

- [ ] **Step 3.1:** Create `backend/app/sessions.py`:

```python
from __future__ import annotations

import random
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import tmdb
from .rooms import get_room_or_404, now_iso


SessionState = Literal["picking_genres", "swiping", "revealed"]
VoteValue = Literal["like", "maybe", "dislike", "seen"]


class GenreChoice(BaseModel):
    player_id: str
    genres: list[int] = []
    locked: bool = False


class Vote(BaseModel):
    value: VoteValue
    created_at: str


class Candidate(BaseModel):
    tmdb_id: int
    title: str
    year: int | None
    poster_path: str | None
    overview: str
    votes: dict[str, Vote] = Field(default_factory=dict)


class Session(BaseModel):
    id: str
    room_code: str
    rounds: int
    cards_per_round: int
    state: SessionState
    choices: dict[str, GenreChoice] = Field(default_factory=dict)
    candidates: list[Candidate] = []
    cursor: int = 0
    winner_tmdb_id: int | None = None
    created_at: str
    revealed_at: str | None = None


class StartSessionRequest(BaseModel):
    rounds: int = Field(ge=1, le=10)
    cards_per_round: int = Field(ge=3, le=15)


class GenreSelectionRequest(BaseModel):
    player_id: str
    genres: list[int]
    locked: bool


class VoteRequest(BaseModel):
    player_id: str
    value: VoteValue


class WinnerRequest(BaseModel):
    tmdb_id: int


sessions_store: dict[str, Session] = {}

router = APIRouter()


def public_session(session: Session) -> dict:
    data = session.model_dump()
    if session.state != "revealed":
        data["winner_tmdb_id"] = None
    return data


def aggregate_scores(session: Session) -> list[tuple[Candidate, int]]:
    POINTS = {"like": 2, "maybe": 1, "dislike": 0}
    scored: list[tuple[Candidate, int]] = []
    for candidate in session.candidates:
        if any(v.value == "seen" for v in candidate.votes.values()):
            continue
        total = sum(POINTS.get(v.value, 0) for v in candidate.votes.values())
        scored.append((candidate, total))
    scored.sort(
        key=lambda pair: (
            -pair[1],
            -sum(1 for v in pair[0].votes.values() if v.value == "like"),
        )
    )
    return scored


@router.post("/api/rooms/{code}/session")
async def start_session(code: str, payload: StartSessionRequest) -> dict:
    room = get_room_or_404(code)
    if room.session_id and sessions_store.get(room.session_id):
        existing = sessions_store[room.session_id]
        if existing.state != "revealed":
            raise HTTPException(status_code=409, detail="Session already active")
    session = Session(
        id=str(uuid4()),
        room_code=room.code,
        rounds=payload.rounds,
        cards_per_round=payload.cards_per_round,
        state="picking_genres",
        choices={p.id: GenreChoice(player_id=p.id) for p in room.players},
        created_at=now_iso(),
    )
    sessions_store[session.id] = session
    room.session_id = session.id
    return {"session": public_session(session)}


@router.post("/api/rooms/{code}/session/genres")
async def set_genres(code: str, payload: GenreSelectionRequest) -> dict:
    room = get_room_or_404(code)
    session = sessions_store.get(room.session_id or "")
    if not session or session.state != "picking_genres":
        raise HTTPException(status_code=400, detail="No genre-picking session")
    if payload.player_id not in session.choices:
        session.choices[payload.player_id] = GenreChoice(player_id=payload.player_id)
    session.choices[payload.player_id].genres = list(set(payload.genres))[:5]
    session.choices[payload.player_id].locked = payload.locked

    if session.choices and all(c.locked for c in session.choices.values()):
        union: set[int] = set()
        for c in session.choices.values():
            union.update(c.genres)
        target = session.rounds * session.cards_per_round
        movies = await tmdb.discover_movies(sorted(union), target)
        if not movies:
            raise HTTPException(status_code=502, detail="No candidates available")
        if len(movies) < target:
            # downscale evenly so every round is the same size
            new_per_round = max(3, len(movies) // session.rounds)
            session.cards_per_round = new_per_round
            movies = movies[: session.rounds * new_per_round]
        random.shuffle(movies)
        session.candidates = [
            Candidate(
                tmdb_id=m.tmdb_id,
                title=m.title,
                year=m.year,
                poster_path=m.poster_path,
                overview=m.overview,
            )
            for m in movies
        ]
        session.cursor = 0
        session.state = "swiping"
    return {"session": public_session(session)}


@router.post("/api/rooms/{code}/session/vote")
async def submit_vote(code: str, payload: VoteRequest) -> dict:
    room = get_room_or_404(code)
    session = sessions_store.get(room.session_id or "")
    if not session or session.state != "swiping":
        raise HTTPException(status_code=400, detail="No swiping session")
    if payload.player_id not in {p.id for p in room.players}:
        raise HTTPException(status_code=400, detail="Player not in room")
    if session.cursor >= len(session.candidates):
        raise HTTPException(status_code=400, detail="Session already finished")

    current = session.candidates[session.cursor]
    current.votes[payload.player_id] = Vote(value=payload.value, created_at=now_iso())

    if all(p.id in current.votes for p in room.players):
        session.cursor += 1
        if session.cursor >= len(session.candidates):
            session.state = "revealed"
            session.revealed_at = now_iso()
    return {"session": public_session(session)}


@router.post("/api/rooms/{code}/session/winner")
async def declare_winner(code: str, payload: WinnerRequest) -> dict:
    room = get_room_or_404(code)
    session = sessions_store.get(room.session_id or "")
    if not session or session.state != "revealed":
        raise HTTPException(status_code=400, detail="Session not revealed")
    top = [c for c, _ in aggregate_scores(session)[:3]]
    if payload.tmdb_id not in {c.tmdb_id for c in top}:
        raise HTTPException(status_code=400, detail="Winner must be one of the Top 3")
    session.winner_tmdb_id = payload.tmdb_id
    return {"session": public_session(session)}


@router.delete("/api/rooms/{code}/session")
async def abandon_session(code: str) -> dict:
    room = get_room_or_404(code)
    if room.session_id:
        sessions_store.pop(room.session_id, None)
        room.session_id = None
    return {"session": None}


@router.get("/api/rooms/{code}/session/top")
async def get_top(code: str) -> dict:
    room = get_room_or_404(code)
    session = sessions_store.get(room.session_id or "")
    if not session or session.state != "revealed":
        raise HTTPException(status_code=400, detail="Session not revealed")
    top = aggregate_scores(session)[:3]
    return {
        "top": [
            {**c.model_dump(), "score": score}
            for c, score in top
        ]
    }
```

- [ ] **Step 3.2:** Commit.

```bash
git add backend/app/sessions.py
git commit -m "feat(backend): add session state machine with vote scoring"
```

---

## Task 4 — Backend: rewrite main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 4.1:** Overwrite `backend/app/main.py`:

```python
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import rooms, sessions, tmdb


app = FastAPI(title="Movie Helper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(sessions.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "tmdb": "key" if tmdb.has_key() else "fallback"}


@app.get("/api/genres")
async def list_genres() -> dict:
    return {"genres": [g.model_dump() for g in await tmdb.fetch_genres()]}
```

- [ ] **Step 4.2:** Restart the backend (kill `byrp3qtec` and re-run).

```bash
curl http://127.0.0.1:8000/api/health
```

Expected: `{"status":"ok","tmdb":"fallback"}` (or `"key"` if env var set).

- [ ] **Step 4.3:** Verify genres endpoint.

```bash
curl http://127.0.0.1:8000/api/genres
```

Expected: JSON object with a `genres` array of 18+ entries.

- [ ] **Step 4.4:** Commit.

```bash
git add backend/app/main.py
git commit -m "feat(backend): rewrite main.py as router host with /api/genres"
```

---

## Task 5 — Frontend: fonts + favicon + index.html

**Files:**
- Modify: `frontend/index.html`
- Create: `frontend/public/favicon.svg`

- [ ] **Step 5.1:** Overwrite `frontend/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
    />
    <title>Movie Helper</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5.2:** Create the public folder and favicon.

```bash
mkdir -p frontend/public
```

- [ ] **Step 5.3:** Create `frontend/public/favicon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect x="2" y="3" width="20" height="18" rx="2" fill="#1a1612"/>
  <rect x="5" y="6" width="2" height="2" fill="#f4ead5"/>
  <rect x="5" y="10" width="2" height="2" fill="#f4ead5"/>
  <rect x="5" y="14" width="2" height="2" fill="#f4ead5"/>
  <rect x="17" y="6" width="2" height="2" fill="#f4ead5"/>
  <rect x="17" y="10" width="2" height="2" fill="#f4ead5"/>
  <rect x="17" y="14" width="2" height="2" fill="#f4ead5"/>
  <circle cx="12" cy="12" r="3.5" fill="#ffc857"/>
</svg>
```

- [ ] **Step 5.4:** Reload the browser at http://127.0.0.1:5173 — favicon should now be a small film reel; no console 404.

- [ ] **Step 5.5:** Commit.

```bash
git add frontend/index.html frontend/public/favicon.svg
git commit -m "feat(frontend): add Google Fonts and favicon"
```

---

## Task 6 — Frontend: design system rewrite (styles.css)

**Files:**
- Rewrite: `frontend/src/styles.css`
- Create: `frontend/src/lib/grain.ts`

- [ ] **Step 6.1:** Create `frontend/src/lib/grain.ts`:

```ts
// Tileable SVG noise data URI for paper-grain overlays.
export const grainUrl =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0 0.05 0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\")";
```

- [ ] **Step 6.2:** Overwrite `frontend/src/styles.css`:

```css
:root {
  color-scheme: light;
  --paper: #f4ead5;
  --paper-deep: #e8dcc0;
  --paper-card: #fffaf0;
  --ink: #1a1612;
  --ink-soft: #5a4f44;
  --ink-faint: #8a7e6f;
  --stamp-no: #c43c2a;
  --stamp-maybe: #d99524;
  --stamp-yes: #2f7a44;
  --stamp-seen: #2a4a7a;
  --highlight: #ffc857;
  --shadow-soft: rgba(26, 22, 18, 0.18);
  --shadow-deep: rgba(26, 22, 18, 0.35);
  --tape: rgba(247, 232, 196, 0.85);
  --radius-sm: 6px;
  --radius-md: 14px;
  font-family: "Inter Tight", system-ui, sans-serif;
  color: var(--ink);
  background: var(--paper);
}

* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(ellipse at top left, rgba(255, 200, 87, 0.12), transparent 60%),
    radial-gradient(ellipse at bottom right, rgba(196, 60, 42, 0.08), transparent 55%),
    var(--paper);
  background-attachment: fixed;
}
body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0 0.05 0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/></svg>");
  opacity: 0.18;
  mix-blend-mode: multiply;
  z-index: 1;
}
#root { position: relative; z-index: 2; }

h1, h2, h3, h4, p { margin: 0; }
h1, h2, h3 { font-family: "Fraunces", Georgia, serif; font-weight: 700; letter-spacing: -0.01em; }
h1 { font-size: clamp(2.4rem, 5vw, 3.6rem); line-height: 1.02; }
h2 { font-size: clamp(1.4rem, 2.4vw, 1.9rem); line-height: 1.1; }
h3 { font-size: 1.05rem; line-height: 1.25; }
p { line-height: 1.45; color: var(--ink-soft); }

button { font: inherit; cursor: pointer; border: none; background: transparent; color: inherit; }
input { font: inherit; }
button:focus-visible, input:focus-visible {
  outline: 2px solid var(--highlight);
  outline-offset: 3px;
}

/* App shell */
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 24px clamp(16px, 4vw, 56px) 40px;
  gap: 32px;
}
.app__loading {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
}
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Room header */
.roomHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.roomHeader__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: "Fraunces", Georgia, serif;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.01em;
}
.roomHeader__mark {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--ink);
  color: var(--paper);
  display: grid;
  place-items: center;
}
.roomHeader__right { display: flex; align-items: center; gap: 10px; }
.roomHeader__players { display: flex; gap: 6px; }
.playerChip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 100px;
  background: var(--paper-deep);
  font-family: "Caveat", cursive;
  font-size: 18px;
  color: var(--ink);
}
.playerChip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--stamp-yes);
}
.roomCode {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--paper-card);
  border: 1px solid var(--paper-deep);
  font-family: "JetBrains Mono", monospace;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--ink);
}
.iconButton {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--ink-soft);
}
.iconButton:hover { background: var(--paper-deep); color: var(--ink); }

/* Welcome */
.welcome {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 24px 0 80px;
}
.welcome__inner { max-width: 520px; width: 100%; display: flex; flex-direction: column; gap: 28px; align-items: center; }
.welcomePolaroid {
  width: 360px;
  background: var(--paper-card);
  padding: 28px 28px 56px;
  box-shadow: 0 22px 40px -12px var(--shadow-soft), 0 8px 12px -6px rgba(0,0,0,0.12);
  transform: rotate(-2.2deg);
  position: relative;
}
.welcomePolaroid::before, .welcomePolaroid::after {
  content: "";
  position: absolute;
  width: 70px;
  height: 22px;
  background: var(--tape);
  top: -10px;
  transform: rotate(-6deg);
}
.welcomePolaroid::before { left: 20px; }
.welcomePolaroid::after { right: 20px; transform: rotate(6deg); }
.welcomePolaroid__art {
  height: 220px;
  border-radius: var(--radius-sm);
  background:
    radial-gradient(circle at 30% 40%, rgba(255, 200, 87, 0.7), transparent 60%),
    radial-gradient(circle at 70% 65%, rgba(196, 60, 42, 0.5), transparent 55%),
    linear-gradient(135deg, #2a4a7a 0%, #1a1612 100%);
}
.welcomePolaroid__caption {
  margin-top: 18px;
  font-family: "Caveat", cursive;
  font-size: 28px;
  color: var(--ink);
  text-align: center;
  line-height: 1.05;
}
.welcomeForm {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}
.welcomeForm__row { display: flex; gap: 10px; align-items: stretch; }
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field__label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-faint); font-weight: 600; }
.field__input, .codeField__input {
  background: var(--paper-card);
  border: 1px solid var(--paper-deep);
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  color: var(--ink);
  font-size: 16px;
  width: 100%;
}
.codeField__input { text-transform: uppercase; letter-spacing: 0.18em; font-family: "JetBrains Mono", monospace; }
.field__input:focus, .codeField__input:focus { border-color: var(--ink); }

.pillButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 18px;
  border-radius: 100px;
  background: var(--ink);
  color: var(--paper);
  font-weight: 600;
  font-size: 15px;
  transition: transform 100ms ease, box-shadow 100ms ease;
}
.pillButton:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 18px -10px var(--shadow-deep); }
.pillButton:disabled { opacity: 0.4; cursor: not-allowed; }
.pillButton--ghost { background: var(--paper-card); color: var(--ink); border: 1px solid var(--paper-deep); }
.pillButton--ghost:hover:not(:disabled) { background: var(--paper-deep); }

/* Lobby */
.lobby {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 40px;
  align-items: start;
}
.lobby__players {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding: 12px 0;
}
.lobbyPolaroid {
  width: 200px;
  background: var(--paper-card);
  padding: 16px 16px 32px;
  box-shadow: 0 14px 24px -10px var(--shadow-soft);
}
.lobbyPolaroid--filled { transform: rotate(-1.8deg); }
.lobbyPolaroid--empty { transform: rotate(2deg); opacity: 0.5; }
.lobbyPolaroid__face {
  height: 200px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--paper-deep), var(--paper));
  display: grid;
  place-items: center;
  font-family: "Fraunces", Georgia, serif;
  font-weight: 700;
  font-size: 48px;
  color: var(--ink);
}
.lobbyPolaroid__name {
  margin-top: 12px;
  font-family: "Caveat", cursive;
  font-size: 24px;
  color: var(--ink);
  text-align: center;
}
.configCard {
  background: var(--paper-card);
  border: 1px solid var(--paper-deep);
  border-radius: var(--radius-md);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.configCard__title { font-family: "Fraunces", Georgia, serif; font-weight: 700; font-size: 22px; }
.slider { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; background: var(--paper-deep); border-radius: 4px; outline: none; }
.slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; background: var(--ink); border-radius: 50%; cursor: pointer; }
.slider::-moz-range-thumb { width: 22px; height: 22px; background: var(--ink); border-radius: 50%; border: none; cursor: pointer; }
.sliderRow { display: flex; align-items: baseline; justify-content: space-between; }
.sliderRow strong { font-family: "Fraunces", Georgia, serif; font-size: 28px; }

/* Genre picker */
.genrePicker { display: flex; flex-direction: column; gap: 24px; }
.genrePicker__title { display: flex; align-items: baseline; gap: 12px; }
.genrePicker__hint { color: var(--ink-soft); font-family: "Caveat", cursive; font-size: 22px; }
.genreGrid { display: flex; flex-wrap: wrap; gap: 12px; }
.genreChip {
  padding: 10px 16px;
  background: var(--paper-card);
  border: 1px solid var(--paper-deep);
  border-radius: 100px;
  font-family: "Fraunces", Georgia, serif;
  font-weight: 600;
  font-size: 15px;
  color: var(--ink);
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.genreChip:hover { transform: translateY(-1px); }
.genreChip--on {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
  box-shadow: 0 6px 14px -8px var(--shadow-deep);
}
.genrePicker__status { display: flex; gap: 18px; flex-wrap: wrap; }
.lockChip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 100px; background: var(--paper-card); border: 1px solid var(--paper-deep); font-family: "Caveat", cursive; font-size: 20px; }
.lockChip--locked { background: var(--stamp-yes); color: var(--paper); border-color: var(--stamp-yes); }

/* Swipe deck */
.deck {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}
.deck__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.deck__round { font-family: "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: 0.18em; color: var(--ink-faint); font-size: 12px; }
.deck__waiting { font-family: "Caveat", cursive; font-size: 22px; color: var(--ink-soft); }
.deck__stack {
  position: relative;
  width: 360px;
  height: 540px;
}
.polaroid {
  position: absolute;
  inset: 0;
  background: var(--paper-card);
  padding: 18px 18px 64px;
  box-shadow: 0 22px 40px -12px var(--shadow-soft), 0 8px 12px -6px rgba(0,0,0,0.12);
  transition: transform 300ms ease, opacity 300ms ease;
}
.polaroid--active { transform: rotate(1.6deg) translateY(0); z-index: 3; }
.polaroid--next { transform: rotate(-3deg) translateY(6px) scale(0.97); z-index: 2; opacity: 0.85; }
.polaroid--next2 { transform: rotate(2.4deg) translateY(12px) scale(0.94); z-index: 1; opacity: 0.6; }
.polaroid--leaving { transform: translateX(80px) rotate(8deg); opacity: 0; }
.polaroid__poster {
  height: 420px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--paper-deep), var(--ink-faint));
  overflow: hidden;
  display: grid;
  place-items: center;
}
.polaroid__poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
.polaroid__placeholder { color: var(--ink-soft); }
.polaroid__caption { padding-top: 14px; }
.polaroid__title { font-family: "Fraunces", Georgia, serif; font-weight: 700; font-size: 22px; line-height: 1.1; }
.polaroid__year { font-size: 13px; color: var(--ink-soft); margin-top: 4px; letter-spacing: 0.04em; }
.polaroid__overview {
  position: absolute;
  inset: 18px 18px 64px;
  background: var(--paper-card);
  padding: 18px;
  border-radius: var(--radius-sm);
  font-family: "Inter Tight", sans-serif;
  font-size: 14px;
  line-height: 1.45;
  color: var(--ink);
  overflow-y: auto;
}
.polaroid__flip {
  position: absolute;
  top: 28px;
  right: 28px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  display: grid;
  place-items: center;
  color: var(--ink);
}

/* Vote stamps */
.stamps { display: flex; gap: 18px; }
.stamp {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 3px solid currentColor;
  background: var(--paper-card);
  display: grid;
  place-items: center;
  text-align: center;
  font-family: "Fraunces", Georgia, serif;
  font-weight: 900;
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transform: rotate(-4deg);
  transition: transform 120ms ease, box-shadow 120ms ease;
  position: relative;
}
.stamp:hover { transform: rotate(-2deg) translateY(-2px); }
.stamp:active { transform: rotate(-4deg) scale(0.96); }
.stamp--no { color: var(--stamp-no); }
.stamp--maybe { color: var(--stamp-maybe); transform: rotate(3deg); }
.stamp--yes { color: var(--stamp-yes); transform: rotate(-2deg); }
.stamp--seen { color: var(--stamp-seen); transform: rotate(5deg); }
.stamp--maybe:hover { transform: rotate(5deg) translateY(-2px); }
.stamp--yes:hover { transform: rotate(0deg) translateY(-2px); }
.stamp--seen:hover { transform: rotate(7deg) translateY(-2px); }
.stamp[disabled] { opacity: 0.4; cursor: not-allowed; }
.stamp__hot {
  position: absolute;
  top: -8px;
  right: -8px;
  background: var(--ink);
  color: var(--paper);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
}

/* Reveal Top 3 */
.reveal { display: flex; flex-direction: column; align-items: center; gap: 28px; padding: 24px 0; }
.podium {
  display: grid;
  grid-template-columns: 200px 240px 200px;
  gap: 28px;
  align-items: end;
}
.podium__slot { display: flex; flex-direction: column; align-items: center; gap: 10px; cursor: pointer; }
.podium__slot--first { order: 2; }
.podium__slot--second { order: 1; }
.podium__slot--third { order: 3; }
.podium__poster {
  background: var(--paper-card);
  padding: 14px 14px 36px;
  box-shadow: 0 18px 30px -12px var(--shadow-soft);
  transition: transform 220ms ease;
}
.podium__poster img { width: 100%; height: 280px; object-fit: cover; border-radius: var(--radius-sm); }
.podium__slot--first .podium__poster { transform: rotate(-1deg); }
.podium__slot--second .podium__poster { transform: rotate(2deg); padding-bottom: 26px; }
.podium__slot--third .podium__poster { transform: rotate(-2deg); padding-bottom: 26px; }
.podium__slot:hover .podium__poster { transform: rotate(0) translateY(-4px); }
.podium__rank { font-family: "Caveat", cursive; font-size: 28px; }
.podium__title { font-family: "Fraunces", Georgia, serif; font-weight: 700; text-align: center; }
.watchingStamp {
  font-family: "Fraunces", Georgia, serif;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--stamp-no);
  border: 3px solid currentColor;
  padding: 8px 14px;
  transform: rotate(-6deg);
  margin-top: 12px;
}

/* Toasts */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--paper);
  padding: 12px 18px;
  border-radius: 100px;
  font-family: "Caveat", cursive;
  font-size: 20px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  z-index: 50;
}
.toast--error { background: var(--stamp-no); }

/* Footer */
.footer {
  margin-top: auto;
  text-align: center;
  font-size: 12px;
  font-style: italic;
  color: var(--ink-faint);
}

@media (max-width: 760px) {
  .lobby { grid-template-columns: 1fr; }
  .deck__stack { width: min(86vw, 320px); height: calc(min(86vw, 320px) * 1.5); }
  .podium { grid-template-columns: 1fr; gap: 18px; }
  .podium__slot--first, .podium__slot--second, .podium__slot--third { order: 0; }
}
```

- [ ] **Step 6.3:** Verify the page in the browser — at this point `main.tsx` still references the old component files, so it will be broken. That's expected. Don't worry about it until Task 12.

- [ ] **Step 6.4:** Commit.

```bash
git add frontend/src/styles.css frontend/src/lib/grain.ts
git commit -m "feat(frontend): Polaroid Stack design system in styles.css"
```

---

## Task 7 — Frontend: api + tmdb helpers

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/tmdb.ts`

- [ ] **Step 7.1:** Create `frontend/src/lib/api.ts`:

```ts
export type Player = { id: string; name: string };

export type Room = {
  code: string;
  players: Player[];
  session_id: string | null;
};

export type Genre = { id: number; name: string };

export type Vote = { value: VoteValue; created_at: string };
export type VoteValue = "like" | "maybe" | "dislike" | "seen";

export type Candidate = {
  tmdb_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
  overview: string;
  votes: Record<string, Vote>;
};

export type GenreChoice = {
  player_id: string;
  genres: number[];
  locked: boolean;
};

export type SessionState = "picking_genres" | "swiping" | "revealed";

export type Session = {
  id: string;
  room_code: string;
  rounds: number;
  cards_per_round: number;
  state: SessionState;
  choices: Record<string, GenreChoice>;
  candidates: Candidate[];
  cursor: number;
  winner_tmdb_id: number | null;
};

export type Top3Entry = Candidate & { score: number };

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed");
  }
  return response.json();
}
```

- [ ] **Step 7.2:** Create `frontend/src/lib/tmdb.ts`:

```ts
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(
  path: string | null,
  size: "sm" | "md" | "lg" = "md"
): string | null {
  if (!path) return null;
  const sizeMap = { sm: "w92", md: "w342", lg: "w500" } as const;
  return `${TMDB_IMAGE_BASE}/${sizeMap[size]}${path}`;
}
```

- [ ] **Step 7.3:** Commit.

```bash
git add frontend/src/lib/api.ts frontend/src/lib/tmdb.ts
git commit -m "feat(frontend): api helper, TMDB image URL helper, shared types"
```

---

## Task 8 — Frontend: PosterImage + PolaroidCard + VoteStamps + RoomHeader

**Files:**
- Create: `frontend/src/components/PosterImage.tsx`
- Create: `frontend/src/components/PolaroidCard.tsx`
- Create: `frontend/src/components/VoteStamps.tsx`
- Create: `frontend/src/components/RoomHeader.tsx`

- [ ] **Step 8.1:** Create `frontend/src/components/PosterImage.tsx`:

```tsx
import { useState } from "react";
import { Film } from "lucide-react";
import { posterUrl } from "../lib/tmdb";

type Props = {
  posterPath: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
};

export function PosterImage({ posterPath, alt, size = "md" }: Props) {
  const [errored, setErrored] = useState(false);
  const url = posterUrl(posterPath, size);

  if (!url || errored) {
    return (
      <div className="polaroid__placeholder">
        <Film size={48} />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}
```

- [ ] **Step 8.2:** Create `frontend/src/components/PolaroidCard.tsx`:

```tsx
import { useState } from "react";
import { Info } from "lucide-react";
import type { Candidate } from "../lib/api";
import { PosterImage } from "./PosterImage";

type Layer = "active" | "next" | "next2";

type Props = {
  candidate: Candidate;
  layer: Layer;
  leaving?: boolean;
};

export function PolaroidCard({ candidate, layer, leaving = false }: Props) {
  const [flipped, setFlipped] = useState(false);
  const classes = [
    "polaroid",
    `polaroid--${layer}`,
    leaving && "polaroid--leaving",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <div className="polaroid__poster">
        <PosterImage
          posterPath={candidate.poster_path}
          alt={candidate.title}
          size="lg"
        />
      </div>
      <div className="polaroid__caption">
        <h3 className="polaroid__title">{candidate.title}</h3>
        <div className="polaroid__year">
          {candidate.year ?? "Year unknown"}
        </div>
      </div>
      {layer === "active" && candidate.overview && (
        <button
          className="polaroid__flip"
          onClick={() => setFlipped((v) => !v)}
          aria-label="Toggle overview"
        >
          <Info size={16} />
        </button>
      )}
      {flipped && (
        <div className="polaroid__overview">
          <p>{candidate.overview}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8.3:** Create `frontend/src/components/VoteStamps.tsx`:

```tsx
import { useEffect } from "react";
import type { VoteValue } from "../lib/api";

type Props = {
  onVote: (value: VoteValue) => void;
  disabled?: boolean;
};

const STAMPS: { value: VoteValue; label: string; className: string; hotkey: string }[] = [
  { value: "dislike", label: "No", className: "stamp--no", hotkey: "1" },
  { value: "maybe", label: "Maybe", className: "stamp--maybe", hotkey: "2" },
  { value: "like", label: "Yes", className: "stamp--yes", hotkey: "3" },
  { value: "seen", label: "Seen", className: "stamp--seen", hotkey: "4" },
];

export function VoteStamps({ onVote, disabled = false }: Props) {
  useEffect(() => {
    if (disabled) return;
    const handler = (event: KeyboardEvent) => {
      const stamp = STAMPS.find((s) => s.hotkey === event.key);
      if (stamp) onVote(stamp.value);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onVote, disabled]);

  return (
    <div className="stamps">
      {STAMPS.map((stamp) => (
        <button
          key={stamp.value}
          className={`stamp ${stamp.className}`}
          onClick={() => onVote(stamp.value)}
          disabled={disabled}
          aria-label={stamp.label}
        >
          <span>{stamp.label}</span>
          <span className="stamp__hot">{stamp.hotkey}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 8.4:** Create `frontend/src/components/RoomHeader.tsx`:

```tsx
import { Clapperboard, Clipboard, LogOut } from "lucide-react";
import type { Player, Room } from "../lib/api";

type Props = {
  room: Room | null;
  player: Player | null;
  onCopy: () => void;
  onLeave: () => void;
};

export function RoomHeader({ room, player, onCopy, onLeave }: Props) {
  return (
    <header className="roomHeader">
      <div className="roomHeader__brand">
        <span className="roomHeader__mark">
          <Clapperboard size={18} />
        </span>
        Movie Helper
      </div>
      {room && player && (
        <div className="roomHeader__right">
          <div className="roomHeader__players">
            {room.players.map((p) => (
              <span className="playerChip" key={p.id}>
                <span className="playerChip__dot" />
                {p.name}
              </span>
            ))}
          </div>
          <button className="roomCode" onClick={onCopy} aria-label="Copy room code">
            <Clipboard size={14} />
            {room.code}
          </button>
          <button className="iconButton" onClick={onLeave} aria-label="Leave room">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 8.5:** Commit.

```bash
git add frontend/src/components/PosterImage.tsx frontend/src/components/PolaroidCard.tsx frontend/src/components/VoteStamps.tsx frontend/src/components/RoomHeader.tsx
git commit -m "feat(frontend): core card + stamp + header components"
```

---

## Task 9 — Frontend: WelcomeScreen + LobbyScreen + GenrePicker

**Files:**
- Create: `frontend/src/components/WelcomeScreen.tsx`
- Create: `frontend/src/components/LobbyScreen.tsx`
- Create: `frontend/src/components/GenrePicker.tsx`

- [ ] **Step 9.1:** Create `frontend/src/components/WelcomeScreen.tsx`:

```tsx
import { useState } from "react";
import { Loader2, Plus, Send } from "lucide-react";
import { api } from "../lib/api";
import type { Player, Room } from "../lib/api";

type Props = {
  onJoined: (room: Room, player: Player) => void;
  onError: (message: string) => void;
};

export function WelcomeScreen({ onJoined, onError }: Props) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const guarded = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); }
    catch (e) { onError(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  };

  const createRoom = () => guarded(async () => {
    const data = await api<{ room: Room; player: Player }>("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ name: name.trim() }),
    });
    onJoined(data.room, data.player);
  });

  const joinRoom = () => guarded(async () => {
    const data = await api<{ room: Room; player: Player }>(
      `/api/rooms/${joinCode.trim().toUpperCase()}/join`,
      { method: "POST", body: JSON.stringify({ name: name.trim() }) }
    );
    onJoined(data.room, data.player);
  });

  return (
    <section className="welcome">
      <div className="welcome__inner">
        <div className="welcomePolaroid">
          <div className="welcomePolaroid__art" />
          <p className="welcomePolaroid__caption">
            What should we<br />watch tonight?
          </p>
        </div>
        <div className="welcomeForm">
          <label className="field">
            <span className="field__label">Your name</span>
            <input
              autoFocus
              className="field__input"
              maxLength={32}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Luis"
            />
          </label>
          <div className="welcomeForm__row">
            <button
              className="pillButton"
              disabled={!name.trim() || busy}
              onClick={createRoom}
            >
              {busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
              Start a new room
            </button>
          </div>
          <div className="welcomeForm__row">
            <input
              className="codeField__input"
              maxLength={5}
              placeholder="CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button
              className="pillButton pillButton--ghost"
              disabled={!name.trim() || joinCode.length < 5 || busy}
              onClick={joinRoom}
            >
              <Send size={16} />
              Join
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 9.2:** Create `frontend/src/components/LobbyScreen.tsx`:

```tsx
import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { api } from "../lib/api";
import type { Room, Session } from "../lib/api";

type Props = {
  room: Room;
  onStarted: (session: Session) => void;
  onError: (message: string) => void;
};

export function LobbyScreen({ room, onStarted, onError }: Props) {
  const [rounds, setRounds] = useState(3);
  const [cards, setCards] = useState(10);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session`,
        {
          method: "POST",
          body: JSON.stringify({ rounds, cards_per_round: cards }),
        }
      );
      onStarted(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const placeholders = Math.max(0, 2 - room.players.length);

  return (
    <section className="lobby">
      <div>
        <h1>Pull up a chair.</h1>
        <p style={{ marginTop: 10, maxWidth: 480 }}>
          Share the room code with whoever's watching with you.
          Once everyone's in, set the rounds and start picking.
        </p>
        <div className="lobby__players" style={{ marginTop: 28 }}>
          {room.players.map((p) => (
            <div className="lobbyPolaroid lobbyPolaroid--filled" key={p.id}>
              <div className="lobbyPolaroid__face">{p.name.slice(0, 1).toUpperCase()}</div>
              <div className="lobbyPolaroid__name">{p.name}</div>
            </div>
          ))}
          {Array.from({ length: placeholders }).map((_, i) => (
            <div className="lobbyPolaroid lobbyPolaroid--empty" key={`empty-${i}`}>
              <div className="lobbyPolaroid__face">?</div>
              <div className="lobbyPolaroid__name">waiting…</div>
            </div>
          ))}
        </div>
      </div>
      <div className="configCard">
        <div className="configCard__title">Session settings</div>
        <div className="field">
          <div className="sliderRow">
            <span className="field__label">Rounds</span>
            <strong>{rounds}</strong>
          </div>
          <input
            className="slider"
            type="range"
            min={1}
            max={10}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <div className="sliderRow">
            <span className="field__label">Cards per round</span>
            <strong>{cards}</strong>
          </div>
          <input
            className="slider"
            type="range"
            min={3}
            max={15}
            value={cards}
            onChange={(e) => setCards(Number(e.target.value))}
          />
        </div>
        <p style={{ fontSize: 13 }}>
          Total cards: <strong style={{ color: "var(--ink)" }}>{rounds * cards}</strong>
        </p>
        <button className="pillButton" disabled={busy} onClick={start}>
          {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
          Start picking
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 9.3:** Create `frontend/src/components/GenrePicker.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { api } from "../lib/api";
import type { Genre, Player, Room, Session } from "../lib/api";

type Props = {
  room: Room;
  player: Player;
  session: Session;
  onUpdated: (session: Session) => void;
  onError: (message: string) => void;
};

export function GenrePicker({ room, player, session, onUpdated, onError }: Props) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const myChoice = session.choices[player.id];
  const [selected, setSelected] = useState<number[]>(myChoice?.genres ?? []);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    api<{ genres: Genre[] }>("/api/genres")
      .then((d) => setGenres(d.genres))
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load genres"));
  }, [onError]);

  useEffect(() => {
    setSelected(session.choices[player.id]?.genres ?? []);
  }, [session.choices[player.id]?.locked]);

  const toggle = (id: number) => {
    if (myChoice?.locked) return;
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 5
        ? prev
        : [...prev, id]
    );
  };

  const lockIn = async () => {
    if (selected.length === 0) return;
    setLocking(true);
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/genres`,
        {
          method: "POST",
          body: JSON.stringify({
            player_id: player.id,
            genres: selected,
            locked: true,
          }),
        }
      );
      onUpdated(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLocking(false);
    }
  };

  const unlock = async () => {
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/genres`,
        {
          method: "POST",
          body: JSON.stringify({
            player_id: player.id,
            genres: selected,
            locked: false,
          }),
        }
      );
      onUpdated(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const playerStatuses = useMemo(
    () =>
      room.players.map((p) => ({
        player: p,
        locked: session.choices[p.id]?.locked ?? false,
      })),
    [room.players, session.choices]
  );

  return (
    <section className="genrePicker">
      <div className="genrePicker__title">
        <h1>What are we in the mood for?</h1>
      </div>
      <p className="genrePicker__hint">Pick up to 5. We'll mix everyone's picks together.</p>

      <div className="genreGrid">
        {genres.map((g) => (
          <button
            key={g.id}
            className={`genreChip ${selected.includes(g.id) ? "genreChip--on" : ""}`}
            onClick={() => toggle(g.id)}
            disabled={myChoice?.locked}
          >
            {g.name}
          </button>
        ))}
      </div>

      <div className="genrePicker__status">
        {playerStatuses.map(({ player: p, locked }) => (
          <span
            className={`lockChip ${locked ? "lockChip--locked" : ""}`}
            key={p.id}
          >
            {locked ? "✓" : "…"} {p.name}
          </span>
        ))}
      </div>

      <div>
        {myChoice?.locked ? (
          <button className="pillButton pillButton--ghost" onClick={unlock}>
            Change my picks
          </button>
        ) : (
          <button
            className="pillButton"
            disabled={selected.length === 0 || locking}
            onClick={lockIn}
          >
            <Lock size={16} />
            Lock in {selected.length} genre{selected.length === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 9.4:** Commit.

```bash
git add frontend/src/components/WelcomeScreen.tsx frontend/src/components/LobbyScreen.tsx frontend/src/components/GenrePicker.tsx
git commit -m "feat(frontend): welcome, lobby, and genre picker screens"
```

---

## Task 10 — Frontend: SwipeDeck + RevealTop3

**Files:**
- Create: `frontend/src/components/SwipeDeck.tsx`
- Create: `frontend/src/components/RevealTop3.tsx`

- [ ] **Step 10.1:** Create `frontend/src/components/SwipeDeck.tsx`:

```tsx
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Player, Room, Session, VoteValue } from "../lib/api";
import { PolaroidCard } from "./PolaroidCard";
import { VoteStamps } from "./VoteStamps";

type Props = {
  room: Room;
  player: Player;
  session: Session;
  onUpdated: (session: Session) => void;
  onError: (message: string) => void;
};

export function SwipeDeck({ room, player, session, onUpdated, onError }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const current = session.candidates[session.cursor];
  const next = session.candidates[session.cursor + 1];
  const next2 = session.candidates[session.cursor + 2];

  const totalCards = session.candidates.length;
  const cardIndex = session.cursor + 1;
  const roundSize = session.cards_per_round;
  const roundNumber = Math.min(
    session.rounds,
    Math.floor(session.cursor / roundSize) + 1
  );

  const myVote = current?.votes[player.id];
  const pendingPlayers = useMemo(() => {
    if (!current) return [];
    return room.players.filter((p) => !current.votes[p.id]);
  }, [room.players, current]);

  const submitVote = async (value: VoteValue) => {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/vote`,
        {
          method: "POST",
          body: JSON.stringify({ player_id: player.id, value }),
        }
      );
      onUpdated(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!current) {
    return <section className="deck"><p>Loading…</p></section>;
  }

  return (
    <section className="deck">
      <div className="deck__status">
        <span className="deck__round">
          Round {roundNumber} / {session.rounds} · Card {cardIndex} / {totalCards}
        </span>
        {myVote && pendingPlayers.length > 0 && (
          <span className="deck__waiting">
            Waiting for {pendingPlayers.map((p) => p.name).join(", ")}…
          </span>
        )}
      </div>

      <div className="deck__stack">
        {next2 && <PolaroidCard candidate={next2} layer="next2" />}
        {next && <PolaroidCard candidate={next} layer="next" />}
        <PolaroidCard candidate={current} layer="active" />
      </div>

      <VoteStamps
        onVote={submitVote}
        disabled={Boolean(myVote) || submitting}
      />
    </section>
  );
}
```

- [ ] **Step 10.2:** Create `frontend/src/components/RevealTop3.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "../lib/api";
import type { Room, Session, Top3Entry } from "../lib/api";
import { PosterImage } from "./PosterImage";

type Props = {
  room: Room;
  session: Session;
  onUpdated: (session: Session) => void;
  onError: (message: string) => void;
};

export function RevealTop3({ room, session, onUpdated, onError }: Props) {
  const [top, setTop] = useState<Top3Entry[]>([]);

  useEffect(() => {
    api<{ top: Top3Entry[] }>(`/api/rooms/${room.code}/session/top`)
      .then((d) => setTop(d.top))
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load Top 3"));
  }, [room.code, onError]);

  const declareWinner = async (tmdb_id: number) => {
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/winner`,
        { method: "POST", body: JSON.stringify({ tmdb_id }) }
      );
      onUpdated(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not set winner");
    }
  };

  if (top.length === 0) {
    return (
      <section className="reveal">
        <h1>Tallying votes…</h1>
      </section>
    );
  }

  if (top.length < 3) {
    return (
      <section className="reveal">
        <h1>Slim pickings</h1>
        <p>Only {top.length} movie{top.length === 1 ? "" : "s"} survived the votes. Try fewer "Already seen"s or a different genre next time.</p>
      </section>
    );
  }

  const [first, second, third] = top;
  const winner = session.winner_tmdb_id;

  const slot = (entry: Top3Entry, rank: 1 | 2 | 3) => {
    const isWinner = entry.tmdb_id === winner;
    const rankClass = rank === 1 ? "podium__slot--first" : rank === 2 ? "podium__slot--second" : "podium__slot--third";
    return (
      <div
        className={`podium__slot ${rankClass}`}
        onClick={() => !winner && declareWinner(entry.tmdb_id)}
      >
        <span className="podium__rank">#{rank} · {entry.score} pts</span>
        <div className="podium__poster">
          <PosterImage posterPath={entry.poster_path} alt={entry.title} size="md" />
        </div>
        <span className="podium__title">{entry.title}</span>
        {isWinner && <span className="watchingStamp">Watching tonight</span>}
      </div>
    );
  };

  return (
    <section className="reveal">
      <h1>The verdict</h1>
      <p className="genrePicker__hint">
        {winner ? "Locked in. Enjoy." : "Tap one to declare the winner."}
      </p>
      <div className="podium">
        {slot(second, 2)}
        {slot(first, 1)}
        {slot(third, 3)}
      </div>
      {!winner && (
        <p>
          <Sparkles size={14} style={{ verticalAlign: "middle" }} /> Any "Already seen" picks were filtered out.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 10.3:** Commit.

```bash
git add frontend/src/components/SwipeDeck.tsx frontend/src/components/RevealTop3.tsx
git commit -m "feat(frontend): swipe deck and Top 3 reveal screens"
```

---

## Task 11 — Frontend: rewrite main.tsx + delete old UI

**Files:**
- Rewrite: `frontend/src/main.tsx`
- Delete: `frontend/src/components/ui/*`

- [ ] **Step 11.1:** Delete the old shadcn-style components.

```bash
rm -rf frontend/src/components/ui
```

- [ ] **Step 11.2:** Overwrite `frontend/src/main.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, Loader2, Sparkles } from "lucide-react";
import { api } from "./lib/api";
import type { Player, Room, Session } from "./lib/api";
import { RoomHeader } from "./components/RoomHeader";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { GenrePicker } from "./components/GenrePicker";
import { SwipeDeck } from "./components/SwipeDeck";
import { RevealTop3 } from "./components/RevealTop3";
import "./styles.css";

type Toast = { kind: "success" | "error"; message: string };

function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("movie-helper-session");
    if (!stored) { setBooting(false); return; }
    try {
      const { roomCode, player: p } = JSON.parse(stored);
      api<{ room: Room; session: Session | null }>(`/api/rooms/${roomCode}`)
        .then((d) => { setRoom(d.room); setPlayer(p); setSession(d.session); })
        .catch(() => localStorage.removeItem("movie-helper-session"))
        .finally(() => setBooting(false));
    } catch {
      localStorage.removeItem("movie-helper-session");
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    if (!room) return;
    const activeSwipe = session?.state === "swiping";
    const intervalMs = activeSwipe ? 1500 : 2500;
    const stop = session?.state === "revealed" && session?.winner_tmdb_id !== null;
    if (stop) return;
    const timer = window.setInterval(() => {
      api<{ room: Room; session: Session | null }>(`/api/rooms/${room.code}`)
        .then((d) => { setRoom(d.room); setSession(d.session); })
        .catch(() => undefined);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [room?.code, session?.state, session?.winner_tmdb_id]);

  const persist = (nextRoom: Room, nextPlayer: Player) => {
    setRoom(nextRoom); setPlayer(nextPlayer);
    localStorage.setItem(
      "movie-helper-session",
      JSON.stringify({ roomCode: nextRoom.code, player: nextPlayer })
    );
  };

  const leave = () => {
    localStorage.removeItem("movie-helper-session");
    setRoom(null); setPlayer(null); setSession(null);
  };

  const onJoined = (r: Room, p: Player) => persist(r, p);
  const onSessionStarted = (s: Session) => setSession(s);
  const onSessionUpdated = (s: Session) => setSession(s);
  const onError = (message: string) => setToast({ kind: "error", message });

  const screen = useMemo(() => {
    if (!room || !player) return "welcome";
    if (!session) return "lobby";
    if (session.state === "picking_genres") return "genres";
    if (session.state === "swiping") return "swipe";
    if (session.state === "revealed") return "reveal";
    return "lobby";
  }, [room, player, session]);

  if (booting) {
    return (
      <main className="app app__loading">
        <Loader2 className="spin" size={28} />
      </main>
    );
  }

  return (
    <main className="app">
      <RoomHeader
        room={room}
        player={player}
        onCopy={async () => {
          if (!room) return;
          await navigator.clipboard.writeText(room.code);
          setToast({ kind: "success", message: "Room code copied" });
        }}
        onLeave={leave}
      />

      {screen === "welcome" && (
        <WelcomeScreen onJoined={onJoined} onError={onError} />
      )}
      {screen === "lobby" && room && (
        <LobbyScreen room={room} onStarted={onSessionStarted} onError={onError} />
      )}
      {screen === "genres" && room && player && session && (
        <GenrePicker
          room={room}
          player={player}
          session={session}
          onUpdated={onSessionUpdated}
          onError={onError}
        />
      )}
      {screen === "swipe" && room && player && session && (
        <SwipeDeck
          room={room}
          player={player}
          session={session}
          onUpdated={onSessionUpdated}
          onError={onError}
        />
      )}
      {screen === "reveal" && room && session && (
        <RevealTop3
          room={room}
          session={session}
          onUpdated={onSessionUpdated}
          onError={onError}
        />
      )}

      <footer className="footer">Movie data by TMDB · made for movie night</footer>

      {toast && (
        <div className={`toast ${toast.kind === "error" ? "toast--error" : ""}`}>
          {toast.kind === "success" ? <Check size={16} /> : <Sparkles size={16} />}
          {toast.message}
          <button
            className="iconButton"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            style={{ color: "inherit", width: 24, height: 24 }}
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 11.3:** Restart the frontend if hot-reload didn't pick it up; navigate to http://127.0.0.1:5173. You should see the cream paper Welcome screen with a tilted polaroid and "What should we watch tonight?".

- [ ] **Step 11.4:** Run typecheck.

```bash
cd frontend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 11.5:** Commit.

```bash
git add frontend/src/main.tsx
git rm -r frontend/src/components/ui
git commit -m "feat(frontend): rewrite App as session-state router, remove old UI primitives"
```

---

## Task 12 — End-to-end manual verification

- [ ] **Step 12.1:** Make sure `TMDB_API_KEY` is set in `backend/.env` or your shell environment.

```bash
# If using a .env file, source it manually before run.py — or export inline:
export TMDB_API_KEY="<your key>"
python run.py
```

Or on Windows PowerShell:

```powershell
$env:TMDB_API_KEY = "<your key>"
python run.py
```

- [ ] **Step 12.2:** Open http://127.0.0.1:5173 in two browsers (or two profiles). In both: enter a name → first creates a room → second joins with the code.

- [ ] **Step 12.3:** From either browser, click "Start picking" with rounds=2, cards=5 → both players land on the genre picker.

- [ ] **Step 12.4:** Each player picks 2–3 genres → click "Lock in" in both browsers. The app transitions to the swipe deck within ~1.5s.

- [ ] **Step 12.5:** Verify posters render. Use stamps (or keys 1/2/3/4) on each card. Mark one with "Already seen" to verify exclusion in the next step.

- [ ] **Step 12.6:** Vote all the way through all 10 cards (5 × 2 rounds). Top 3 reveal screen should appear, with three polaroid podiums and scores. The "Already seen" movie must NOT appear in the Top 3.

- [ ] **Step 12.7:** Tap one of the three to declare the winner. A "WATCHING TONIGHT" stamp appears. Other browser sees the same within ~2.5s.

- [ ] **Step 12.8:** Verify the page in mobile width (resize browser to ~400px) — the deck should fit and stamps stay clickable.

---

## Task 13 — Docs

**Files:**
- Rewrite: `README.md`
- Rewrite: `CLAUDE.md`

- [ ] **Step 13.1:** Overwrite `README.md`:

```markdown
# Movie Helper

A small couples / small-group web app: pick genres together, swipe through TMDB-fetched movies (👎 / 🤔 / 👍 / 👁️ already seen), and reveal a Top 3 to decide tonight's movie. Wavelength-inspired in spirit; Polaroid-styled in skin.

## Run

One-time per machine:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

cd ..\frontend
npm install
```

Every session, from repo root:

```bash
python run.py
```

Open http://127.0.0.1:5173.

## TMDB (recommended)

The app runs without an API key (curated fallback), but real posters need TMDB. Sign up free at https://www.themoviedb.org/settings/api, then set the key before starting:

```powershell
$env:TMDB_API_KEY = "<your key>"
python run.py
```

Or persist it in a local `.env`. The backend reads `TMDB_API_KEY` on import.

## How it works

1. Create or join a room (5-char code).
2. Lobby: configure rounds and cards-per-round.
3. Each player picks 1–5 TMDB genres and locks in.
4. App fetches movies matching the union of everyone's genres.
5. Vote on each card. The card advances only when all players have voted.
6. After the last card, the Top 3 reveals. Tap one to lock in the night's pick.

Rooms are in-memory, so restarting the backend clears them.
```

- [ ] **Step 13.2:** Overwrite `CLAUDE.md` with an updated map.

```markdown
# CLAUDE.md

Notes for Claude Code when working in this repo.

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

## Polling cadence

- Lobby / genre picker: 2.5s
- Active swiping: 1.5s
- After winner declared: polling stops

## Conventions

- All Pydantic v2 models, `Field(min_length=…)` for input validation.
- IDs are `str(uuid4())`; room codes are 5-char A–Z / 0–9.
- ISO UTC timestamps everywhere.
- Don't introduce Tailwind / styled-components — the CSS variables in `styles.css` are the design system.

## Things to watch

- TMDB rate limit is generous but the LRU cache in `tmdb.py` matters when running many sessions back-to-back.
- The session state machine MUST reject votes when state != "swiping" (already enforced; don't loosen it).
- Reload mid-session: the backend session state is the source of truth — UI re-renders into the correct screen from `Session.state`.
```

- [ ] **Step 13.3:** Commit.

```bash
git add README.md CLAUDE.md
git commit -m "docs: rewrite README and CLAUDE.md for v2"
```

---

## Self-review (run after writing the plan; not a step the engineer runs)

Spec coverage: every numbered goal in the spec maps to at least one task above. Backend module split (Task 1–4) ✓. Genre/discover endpoints (Task 1, 4) ✓. Session state machine + scoring + edge rules (Task 3) ✓. Polaroid Stack visual language (Task 6) ✓. Per-screen frontend components (Tasks 8–10) ✓. App router + polling cadence (Task 11) ✓. Manual verification (Task 12) ✓. Docs (Task 13) ✓.

No placeholders. All code is concrete. Type names match across tasks (`Session`, `Candidate`, `Vote`, `GenreChoice`, `Player`, `Room`). The frontend `api()` helper and types are defined in Task 7 and consumed unchanged by Tasks 8–11.

Risk: Task 6 leaves the app temporarily broken (new CSS classes, components not yet rewritten). Task 11 closes that loop. If executing in parts, finish through Task 11 before any user-facing verification.
