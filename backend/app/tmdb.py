from __future__ import annotations

import asyncio
import os
import ssl
import time
from pathlib import Path
from typing import Any

import httpx
import truststore
from pydantic import BaseModel

# Use the OS native trust store so corporate proxies / Windows certs work.
_SSL_CONTEXT = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


def _client(timeout: float) -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=timeout, verify=_SSL_CONTEXT)


# Verify TLS by default. Some local environments (TLS-intercepting proxies) can't
# validate certain public CDN certs; opt out only there with MOVIE_HELPER_INSECURE_TLS=1.
_INSECURE_TLS = os.environ.get("MOVIE_HELPER_INSECURE_TLS") == "1"


def open_verify():
    """TLS verification value for public-CDN clients (truststore unless opted out)."""
    return False if _INSECURE_TLS else _SSL_CONTEXT


def _open_client(timeout: float) -> httpx.AsyncClient:
    """Client for public CDNs (Wikimedia). Verifies TLS unless MOVIE_HELPER_INSECURE_TLS=1."""
    return httpx.AsyncClient(timeout=timeout, verify=open_verify())


def _load_dotenv() -> None:
    candidates = [
        Path(__file__).resolve().parents[2] / ".env",
        Path(__file__).resolve().parents[1] / ".env",
        Path.cwd() / ".env",
    ]
    for env_path in candidates:
        if not env_path.is_file():
            continue
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_dotenv()
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
    genre_ids: list[int] = []
    vote_average: float = 0.0


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


CURATED_GENRE_IDS: set[int] = {28, 12, 16, 35, 18, 27, 10749, 878, 53}

CURATED_GENRES: list[Genre] = [
    Genre(id=28, name="Action"),
    Genre(id=12, name="Adventure"),
    Genre(id=16, name="Animation"),
    Genre(id=35, name="Comedy"),
    Genre(id=18, name="Drama"),
    Genre(id=27, name="Horror"),
    Genre(id=10749, name="Romance"),
    Genre(id=878, name="Science Fiction"),
    Genre(id=53, name="Thriller"),
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
        async with _client(TMDB_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"{TMDB_BASE}/genre/movie/list",
                params={"api_key": TMDB_API_KEY, "language": "en-US"},
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError):
        return CURATED_GENRES
    genres = [
        Genre(id=g["id"], name=g["name"])
        for g in data.get("genres", [])
        if g["id"] in CURATED_GENRE_IDS
    ]
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
        genre_ids=[int(g) for g in raw.get("genre_ids", [])],
        vote_average=float(raw.get("vote_average") or 0.0),
    )


async def trending_movies(count: int = 12) -> list[MovieDTO]:
    if not has_key():
        return CURATED_MOVIES[:count]
    cached = await _cache_get(("trending",))
    if cached is None:
        try:
            async with _client(TMDB_TIMEOUT_SECONDS) as client:
                response = await client.get(
                    f"{TMDB_BASE}/trending/movie/week",
                    params={"api_key": TMDB_API_KEY, "language": "en-US"},
                )
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError):
            return CURATED_MOVIES[:count]
        results = [m for raw in data.get("results", []) if (m := _movie_from_tmdb(raw))]
        await _cache_set(("trending",), results)
        cached = results
    return cached[:count]


class CastMember(BaseModel):
    name: str
    character: str
    profile_path: str | None


class AvatarOption(BaseModel):
    id: str
    label: str       # character name shown in UI
    actor: str       # actor name shown as subtitle
    image_url: str | None  # fully-qualified URL regardless of source


# avatar_id, character label, actor label, Wikipedia article title, TMDB person_id.
# Wikipedia is the primary source for character images: article lead images are
# specifically chosen to represent the character (in costume/makeup), not just
# the actor at a photoshoot.  TMDB person profile is the fallback.
_CHARACTER_ROSTER: list[tuple[str, str, str, str, int]] = [
    ("iron_man",     "Iron Man",      "Robert Downey Jr.",     "Iron_Man",                                    3223),
    ("hermione",     "Hermione",      "Emma Watson",           "Hermione_Granger",                           10990),
    ("jack_sparrow", "Jack Sparrow",  "Johnny Depp",           "Jack_Sparrow",                                  85),
    ("indy",         "Indiana Jones", "Harrison Ford",         "Indiana_Jones_(character)",                      3),
    ("joker",        "The Joker",     "Joaquin Phoenix",       "Joker_(2019_film)",                          73421),
    ("gandalf",      "Gandalf",       "Ian McKellen",          "Gandalf",                                     1327),
    ("bond",         "James Bond",    "Daniel Craig",          "James_Bond",                                  8784),
    ("katniss",      "Katniss",       "Jennifer Lawrence",     "Katniss_Everdeen",                           72129),
    ("terminator",   "Terminator",    "Arnold Schwarzenegger", "Terminator_(character)",                      1100),
    ("neo",          "Neo",           "Keanu Reeves",          "Neo_(The_Matrix)",                            6384),
    ("black_widow",  "Black Widow",   "Scarlett Johansson",    "Natasha_Romanoff_(Marvel_Cinematic_Universe)", 1245),
    ("ethan_hunt",   "Ethan Hunt",    "Tom Cruise",            "Mission:_Impossible_%E2%80%93_Fallout",        500),
]

WIKIPEDIA_REST = "https://en.wikipedia.org/api/rest_v1/page/summary"


async def fetch_cast(tmdb_id: int, count: int = 5) -> list[CastMember]:
    """Top `count` cast members with name, character, and profile image."""
    if not has_key():
        return []
    cached = await _cache_get(("cast", tmdb_id))
    if cached is not None:
        return cached
    try:
        async with _client(TMDB_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"{TMDB_BASE}/movie/{tmdb_id}/credits",
                params={"api_key": TMDB_API_KEY, "language": "en-US"},
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError):
        return []
    members = [
        CastMember(
            name=m["name"],
            character=m.get("character", ""),
            profile_path=m.get("profile_path"),
        )
        for m in data.get("cast", [])[:count]
        if m.get("name")
    ]
    await _cache_set(("cast", tmdb_id), members)
    return members


async def fetch_avatar_options() -> list[AvatarOption]:
    """Fetch TMDB actor profile photos for the character roster in parallel."""
    cached = await _cache_get(("avatar_options",))
    if cached is not None:
        return cached

    if not has_key():
        return [
            AvatarOption(id=av_id, label=label, actor=actor, image_url=None)
            for av_id, label, actor, _, person_id in _CHARACTER_ROSTER
        ]

    async def _fetch_one(client: httpx.AsyncClient, entry: tuple) -> AvatarOption:
        av_id, label, actor, _wiki, person_id = entry
        image_url: str | None = None
        try:
            r = await client.get(
                f"{TMDB_BASE}/person/{person_id}/images",
                params={"api_key": TMDB_API_KEY},
            )
            r.raise_for_status()
            profiles = r.json().get("profiles", [])
            if profiles:
                profiles.sort(
                    key=lambda x: x.get("vote_average", 0) * max(x.get("vote_count", 0), 1),
                    reverse=True,
                )
                image_url = f"https://image.tmdb.org/t/p/w500{profiles[0]['file_path']}"
        except (httpx.HTTPError, ValueError):
            pass

        if not image_url:
            try:
                r2 = await client.get(
                    f"{TMDB_BASE}/person/{person_id}",
                    params={"api_key": TMDB_API_KEY},
                )
                r2.raise_for_status()
                path = r2.json().get("profile_path")
                if path:
                    image_url = f"https://image.tmdb.org/t/p/w500{path}"
            except (httpx.HTTPError, ValueError):
                pass

        return AvatarOption(id=av_id, label=label, actor=actor, image_url=image_url)

    async with _client(TMDB_TIMEOUT_SECONDS * 3) as client:
        options = list(await asyncio.gather(*[
            _fetch_one(client, entry) for entry in _CHARACTER_ROSTER
        ]))

    async with _cache_lock:
        _cache[("avatar_options",)] = (time.time() + 86400, options)
    return options


async def discover_movies(genre_ids: list[int], count: int) -> list[MovieDTO]:
    """Fetch `count` distinct popular movies matching any of `genre_ids`.

    Cache is incremental: if we already cached N movies but the caller wants
    more, we keep paging through TMDB until we have enough (or run out)."""
    if not has_key() or not genre_ids:
        return CURATED_MOVIES[:count]
    sorted_ids = sorted(set(genre_ids))
    key = ("discover", tuple(sorted_ids))
    cached: list[MovieDTO] | None = await _cache_get(key)
    if cached is None:
        cached = []
    if len(cached) >= count:
        return cached[:count]

    results: list[MovieDTO] = list(cached)
    seen_ids = {m.tmdb_id for m in results}
    # We've already consumed full pages worth of results, so resume on the next.
    start_page = (len(results) // 20) + 1
    try:
        async with _client(TMDB_TIMEOUT_SECONDS) as client:
            for page in range(start_page, start_page + 12):  # cap at 12 more pages
                if len(results) >= count:
                    break
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
                page_results = page_data.get("results", [])
                if not page_results:
                    break
                for raw in page_results:
                    movie = _movie_from_tmdb(raw)
                    if movie and movie.tmdb_id not in seen_ids:
                        results.append(movie)
                        seen_ids.add(movie.tmdb_id)
    except (httpx.HTTPError, ValueError):
        return cached[:count] if cached else CURATED_MOVIES[:count]
    await _cache_set(key, results)
    return results[:count]
