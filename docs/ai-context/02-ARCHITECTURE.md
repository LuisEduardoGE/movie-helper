# Architecture

## Stack

- **Backend** — FastAPI 0.115.6, uvicorn 0.32.1, httpx 0.27.2, truststore 0.10.0
  (`backend/requirements.txt`, pinned); Pydantic v2 via FastAPI. **No database** — module-level
  dicts (`rooms.rooms`, `sessions.sessions_store`).
- **Frontend** — React 19 + Vite 6 + TypeScript 5.7, `lucide-react`, `qrcode.react` (invite
  QR). Plain CSS design system in `frontend/src/styles.css`; no Tailwind (by convention).
- **External** — TMDB API v3 (`api.themoviedb.org/3`, 4 s timeout, in-process cache 300 s
  TTL / 256 entries; `backend/app/tmdb.py:59-63`), TMDB image CDN, Wikipedia REST summaries
  (cast photos / avatar options).

## Components

| Path | Role |
|---|---|
| `backend/app/main.py` | App, CORS (localhost/127.0.0.1:5173), `/api/health`, `/api/genres`, `/api/trending`, `/api/movies/{id}` (cast), `/api/avatar-options`, `/api/proxy-image` |
| `backend/app/rooms.py` | `POST /api/rooms`, `POST /api/rooms/{code}/join`, `GET /api/rooms/{code}` (room + session — the polling endpoint) |
| `backend/app/sessions.py` | Session state machine + scoring; `POST /api/rooms/{code}/session` (start), `/genres`, `/vote`, `/pairwise`, `/h2h`, `/winner`, `/redraw`; `DELETE …/session`; `GET …/session/top` |
| `backend/app/tmdb.py` | TMDB client, `.env` loader (repo root, `backend/`, CWD), curated fallback, truststore TLS (`MOVIE_HELPER_INSECURE_TLS=1` opt-out for intercepting proxies) |
| `frontend/src/main.tsx` | App root and session-state router; polls `GET /api/rooms/{code}` every 2.5 s, 1.5 s while swiping (`main.tsx:49`) |
| `frontend/src/components/` | `WelcomeScreen`, `LobbyScreen`, `InviteModal`, `GenrePicker`, `SwipeDeck`, `PairwiseMaybes`, `HeadToHead`, `RevealTop3`, `PolaroidCard`, `VoteStamps`, `OverviewModal`, `MovieAvatars`, `PosterImage`, `RoomHeader` |
| `frontend/src/lib/` | `api.ts` (fetch helper), `tmdb.ts` (`posterUrl`), `grain.ts`, `utils.ts` |

Single server-side `cursor` per session: every client renders the same current card; the
backend session is the source of truth on reload.

## Ports

| Where | Service | Port |
|---|---|---|
| Local | uvicorn backend | 127.0.0.1:8000 |
| Local | Vite dev (proxies `/api` → 8000) | 127.0.0.1:5173 |
| the VPS | uvicorn (systemd `movie-helper-backend`) | 127.0.0.1:6030 (`deploy.py:35`) |
| the VPS | nginx site `movie-helper` (static dist + `/api/` proxy), raw IP | 6040 (`deploy.py:36`) |

## Run, test, deploy

```bash
python run.py                 # repo root: backend (uvicorn :8000) + Vite (:5173); npm install if missing
cd frontend && npx tsc --noEmit   # type-check (package script: npm run typecheck)
cd frontend && npm run build
python deploy.py              # → the VPS /opt/movie-helper
```

No automated tests exist (no `tests/`, no test runner in `package.json`).

`deploy.py`: builds Vite locally, streams source + `dist` via `tar | ssh` to
`/opt/movie-helper`, **overwrites the server `.env` with the local `.env`**, refreshes
`backend/.venv`, writes the systemd unit + nginx site, `ufw allow 6040`, restarts, smoke-tests.
Requires the `the VPS` SSH alias.
