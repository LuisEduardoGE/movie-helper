# Movie Helper

**Pick a movie together, without the 40-minute debate.** Friends join a room, choose genres, vote on a short deck of movies, and the app narrows the votes down to one winner.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![TMDB](https://img.shields.io/badge/data-TMDB-01B4E4?style=flat-square&logo=themoviedatabase&logoColor=white)

![Welcome screen and a discovery card](docs/screenshot.jpg)

## How a session works

1. **Room**: one person starts a room and shares its 5-character code (or a QR invite); friends join with a name and a character avatar.
2. **Genres**: each player picks and locks the genres they are in the mood for; the deck waits until everyone has locked in.
3. **Discovery**: everyone votes on the same deck of 12 movies from TMDB: *like*, *maybe*, *dislike* or *seen*. The deck is drawn from a pool of 80 candidates and reordered by the group's affinity as votes come in, so the best matches surface early.
4. **Settle the maybes**: movies marked *maybe* are compared in pairs, each player choosing the one they prefer.
5. **Narrow**: the surviving movies go through a harder round.
6. **Head to head**: the strongest candidates face off until one is left.
7. **Reveal**: the winner is shown with its poster and details. Not happy? **Choose again** deals a fresh deck that skips every movie already shown.

Scoring is phase-weighted: a *like* in a later, harder round counts more than one in discovery, a *maybe* earns partial credit, a movie everyone liked gets a unanimity bonus, and ties go to the higher TMDB rating.

## Tech

| Layer | Choice |
|---|---|
| Back end | FastAPI 0.115 + Pydantic v2, `httpx` for TMDB with an in-process cache; rooms and sessions in memory (no database) |
| Front end | React 19 + Vite 6 + TypeScript, hand-written components and CSS design tokens |
| Sync | Clients poll the session (1.5 s while voting); a single server-side cursor keeps every player on the same card |
| Safety | Image proxy restricted to an allowlist of public CDNs (SSRF guard); TLS verified by default |

## Run locally

```bash
# one-time setup
cd backend && python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ../frontend && npm install && cd ..

# every time, from the repo root
cp .env.example .env               # optional: add a free TMDB key for real posters
python run.py                      # backend :8000, frontend http://127.0.0.1:5173
```

Without a TMDB key the app runs on a curated fallback list.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Health check (reports whether a TMDB key is set) |
| `GET /api/genres` · `/api/trending` · `/api/movies/{id}` | TMDB data |
| `POST /api/rooms` · `POST /api/rooms/{code}/join` · `GET /api/rooms/{code}` | Create, join and read a room |
| `POST /api/rooms/{code}/session` | Start a session |
| `POST /api/rooms/{code}/session/genres` · `/vote` · `/pairwise` · `/h2h` | Each voting phase |
| `POST /api/rooms/{code}/session/winner` · `/redraw` · `GET .../session/top` | Result, redraw and current ranking |

## Deploy

`python deploy.py` builds the front end and deploys both halves to a Linux VPS over SSH (systemd + nginx). Set `DEPLOY_SSH_HOST` and `DEPLOY_PUBLIC_HOST` in the environment or in a git-ignored `.env.deploy` (see `.env.deploy.example`).

## Credits

Movie data and images from [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

[MIT](LICENSE) © Luis Eduardo G. Espindola
