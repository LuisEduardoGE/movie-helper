from __future__ import annotations

from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import rooms, sessions, tmdb

# Only these public image CDNs may be fetched by /api/proxy-image (SSRF guard).
_PROXY_ALLOWED_HOSTS = {
    "upload.wikimedia.org",
    "upload.m.wikimedia.org",
    "commons.wikimedia.org",
    "en.wikipedia.org",
    "image.tmdb.org",
}


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


@app.get("/api/trending")
async def list_trending() -> dict:
    return {"results": [m.model_dump() for m in await tmdb.trending_movies(12)]}


@app.get("/api/movies/{tmdb_id}")
async def get_movie_details(tmdb_id: int) -> dict:
    cast = await tmdb.fetch_cast(tmdb_id)
    return {"tmdb_id": tmdb_id, "cast": cast}


@app.get("/api/avatar-options")
async def get_avatar_options() -> dict:
    options = await tmdb.fetch_avatar_options()
    return {"options": [o.model_dump() for o in options]}


@app.get("/api/proxy-image")
async def proxy_image(url: str) -> Response:
    """Proxy allowlisted public image CDNs that block browser hot-linking."""
    from fastapi import Response
    import httpx
    # SSRF guard: only https URLs to a fixed set of public image CDNs.
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in _PROXY_ALLOWED_HOSTS:
        return Response(status_code=400)
    async with httpx.AsyncClient(verify=tmdb.open_verify(), timeout=8.0) as client:
        try:
            r = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; MovieHelper/1.0)",
                "Referer": "https://en.wikipedia.org/",
            })
            return Response(
                content=r.content,
                media_type=r.headers.get("content-type", "image/jpeg"),
                headers={"Cache-Control": "public, max-age=86400"},
            )
        except Exception:
            return Response(status_code=404)
