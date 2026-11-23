# Current State

Last updated: 2026-11-23 — knowledge base bootstrapped from code; last code change 2026-07-22.

A **snapshot, not a changelog** — rewrite lines that changed; history goes in `sessions/`.
Never hand-write HEAD, ahead/behind or test-file counts (`.claude/hooks/context_facts.py`).

## Repository position

Single branch `main`, **no git remote** (local only). A leftover
`refs/original/refs/heads/main` (from a `git filter-branch` history rewrite) still exists.
Last commits 2026-07-22 (UI/backend updates; SSRF allowlist + TLS verify by default).
Working tree at bootstrap: only the ai-context install, uncommitted. Untracked/ignored local
clutter: root `*.png` screenshots, `debug/`, `.playwright-mcp/`, `.env` (ignored, never
committed — `git log --all -- .env` empty).

## Working (in code)

- Full flow: welcome (trending poster collage) → create/join room (invite modal + QR) →
  lobby → genre picker (waits for all players) → 12-card swipe with affinity reorder →
  pairwise maybes → narrow → head-to-head → reveal (Top 3, winner, "Choose again").
- Cast + Wikipedia-based avatars, overview "Read more" modal, image proxy with allowlist.
- TMDB key present locally: `/api/health` → `{"status":"ok","tmdb":"key"}` (2026-11-23).

## Production

The live instance moved to a different VPS on 2026-10-18 and now runs from `/srv/movie-helper`
(system user `moviehelper`, systemd `movie-helper-backend`, nginx :6040); host details are in the
git-ignored `docs/OPERATIONS.local.md`. `deploy.py` still writes the old layout (`/opt/movie-helper`,
as root) and reads its host from `DEPLOY_SSH_HOST` / `DEPLOY_PUBLIC_HOST`. The live backend
predates the proxy-image SSRF allowlist (verified 2026-11-23 by diffing the deployed source).

## Tests

| Suite | Command | Result | Date |
|---|---|---|---|
| Automated tests | — | none exist | — |
| Backend smoke | `python -c` + `TestClient`: `/api/health`, `/api/proxy-image` (disallowed host), `POST /api/rooms` | 200 / 400 / 200 (system Python, FastAPI 0.110 — not the pinned 0.115.6; no `backend/.venv` present) | 2026-11-23 |
| Frontend type-check | `cd frontend && npx tsc --noEmit` | exit 0 | 2026-11-23 |
