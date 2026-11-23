from __future__ import annotations

import random
from collections import Counter
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import tmdb
from .rooms import get_room_or_404, now_iso


SessionState = Literal["picking_genres", "swiping", "revealed"]
PhaseType = Literal[
    "discovery",
    "pairwise_maybes",
    "narrow",
    "head_to_head",
    "revealed",
]
VoteValue = Literal["like", "maybe", "dislike", "seen"]

# Fixed number of cards shown per session. Everyone votes on exactly this many
# movies; the deck ends when the cursor reaches this count.
DECK_SIZE = 12
# Fetch a much larger pool up front so the affinity reorder has plenty of
# candidates to surface the best matches as voting progresses.
INITIAL_FETCH_COUNT = 80


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
    genre_ids: list[int] = []
    vote_average: float = 0.0
    # phase_votes[phase][player_id] = Vote
    phase_votes: dict[str, dict[str, Vote]] = Field(default_factory=dict)


class PairwiseMaybe(BaseModel):
    a: int  # tmdb_id
    b: int  # tmdb_id
    # player_id -> tmdb_id they preferred
    picks: dict[str, int] = Field(default_factory=dict)


class HeadToHeadPair(BaseModel):
    a: int
    b: int
    votes: dict[str, int] = Field(default_factory=dict)


class Session(BaseModel):
    id: str
    room_code: str
    state: SessionState
    phase: PhaseType = "discovery"
    choices: dict[str, GenreChoice] = Field(default_factory=dict)
    candidates: list[Candidate] = []
    pool: list[int] = []
    cursor: int = 0
    pairwise_maybes: list[PairwiseMaybe] = []
    pairwise_cursor: int = 0
    pairs: list[HeadToHeadPair] = []
    pair_cursor: int = 0
    winner_tmdb_id: int | None = None
    # Accumulated tmdb_ids that have appeared in any prior run of this
    # session (across redraws). Used to keep showing fresh movies.
    previously_shown_ids: list[int] = []
    created_at: str
    revealed_at: str | None = None


class StartSessionRequest(BaseModel):
    # Kept for backward compat with the existing frontend lobby; ignored.
    rounds: int = Field(default=3, ge=1, le=10)
    cards_per_round: int = Field(default=10, ge=3, le=15)


class GenreSelectionRequest(BaseModel):
    player_id: str
    genres: list[int]
    locked: bool


class VoteRequest(BaseModel):
    player_id: str
    value: VoteValue


class PairwiseChoiceRequest(BaseModel):
    player_id: str
    chosen: int


class HeadToHeadVoteRequest(BaseModel):
    player_id: str
    chosen: int


class WinnerRequest(BaseModel):
    tmdb_id: int


sessions_store: dict[str, Session] = {}

router = APIRouter()


# ---------------------------------------------------------------------------
# Vote / scoring helpers


def public_session(session: Session) -> dict:
    data = session.model_dump()
    if session.state != "revealed":
        data["winner_tmdb_id"] = None
    data["deck_size"] = DECK_SIZE
    return data


def _candidate(session: Session, tmdb_id: int) -> Candidate | None:
    return next((c for c in session.candidates if c.tmdb_id == tmdb_id), None)


def _is_seen(candidate: Candidate) -> bool:
    for votes in candidate.phase_votes.values():
        if any(v.value == "seen" for v in votes.values()):
            return True
    return False


def _yes_voters(candidate: Candidate) -> set[str]:
    """Set of player_ids who voted YES on this candidate at least once (any phase)."""
    voters: set[str] = set()
    for votes in candidate.phase_votes.values():
        for pid, vote in votes.items():
            if vote.value == "like":
                voters.add(pid)
    return voters



def _player_maybe_movies(session: Session, player_id: str) -> set[int]:
    """tmdb_ids the player has voted MAYBE on in the discovery phase."""
    ids: set[int] = set()
    for c in session.candidates:
        if _is_seen(c):
            continue
        vote = c.phase_votes.get("discovery", {}).get(player_id)
        if vote and vote.value == "maybe":
            ids.add(c.tmdb_id)
    return ids


def _weighted_score(candidate: Candidate, player_ids: set[str]) -> float:
    """Phase-weighted score for a candidate.

    Points per action:
      discovery like        → 1.0
      discovery maybe       → 0.25  (partial credit even if never elevated)
      pairwise_maybes like  → +0.75 (bonus for winning the head-to-head; total 1.0 with the maybe)
      narrow like           → 2.0   (survived a harder round)
      unanimous discovery   → +0.5  (all players loved it)

    Tiebreaker: TMDB vote_average (higher-rated film wins ties).
    """
    score = 0.0

    discovery = candidate.phase_votes.get("discovery", {})
    discovery_yes: set[str] = set()
    for pid, vote in discovery.items():
        if pid not in player_ids:
            continue
        if vote.value == "like":
            score += 1.0
            discovery_yes.add(pid)
        elif vote.value == "maybe":
            score += 0.25

    # Unanimous discovery bonus
    if player_ids and discovery_yes == player_ids:
        score += 0.5

    for pid, vote in candidate.phase_votes.get("pairwise_maybes", {}).items():
        if pid in player_ids and vote.value == "like":
            score += 0.75

    for pid, vote in candidate.phase_votes.get("narrow", {}).items():
        if pid in player_ids and vote.value == "like":
            score += 2.0

    return score


def aggregate_scores(session: Session, player_ids: set[str] | None = None) -> list[tuple[Candidate, float]]:
    """Top-3 ranking using phase-weighted scores.

    Falls back to collecting all voter IDs from the session when player_ids
    is not supplied (e.g. called from routes that don't pass room.players).
    Tiebreaker: TMDB vote_average descending (better-rated film wins ties).
    """
    if player_ids is None:
        player_ids = set()
        for c in session.candidates:
            for phase_votes in c.phase_votes.values():
                player_ids.update(phase_votes.keys())

    scored: list[tuple[Candidate, float]] = []
    for candidate in session.candidates:
        if _is_seen(candidate):
            continue
        s = _weighted_score(candidate, player_ids)
        if s > 0:
            scored.append((candidate, s))
    scored.sort(key=lambda pair: (-pair[1], -pair[0].vote_average))
    return scored


def _is_survivor(candidate: Candidate) -> bool:
    if _is_seen(candidate):
        return False
    return len(_yes_voters(candidate)) > 0


def _reorder_pool_by_affinity(session: Session) -> None:
    """Reorder the unplayed tail of the pool so movies matching liked/maybe
    genres surface first; movies matching disliked genres sink to the bottom.
    Called after each card advance so preferences accumulate naturally."""
    if session.cursor >= len(session.pool):
        return

    yes_genres: Counter[int] = Counter()
    no_genres: Counter[int] = Counter()
    for c in session.candidates:
        votes = c.phase_votes.get("discovery", {})
        for vote in votes.values():
            for g in c.genre_ids:
                if vote.value in ("like", "maybe"):
                    yes_genres[g] += 1
                elif vote.value == "dislike":
                    no_genres[g] += 1

    if not yes_genres and not no_genres:
        return

    remaining = session.pool[session.cursor:]

    def _score(tmdb_id: int) -> float:
        c = _candidate(session, tmdb_id)
        if not c:
            return 0.0
        s = 0.0
        for g in c.genre_ids:
            s += yes_genres[g]
            s -= no_genres[g] * 1.5  # dislike carries more weight than a like
        return s

    remaining.sort(key=_score, reverse=True)
    session.pool[session.cursor:] = remaining


# ---------------------------------------------------------------------------
# Phase transitions


def _all_players_voted_on_card(candidate: Candidate, phase: str, room_players) -> bool:
    votes = candidate.phase_votes.get(phase, {})
    return all(p.id in votes for p in room_players)



async def _ensure_more_candidates(session: Session) -> bool:
    """If the pool is exhausted, try fetching more from TMDB. Returns True
    if new candidates were added. Respects previously_shown_ids (from
    earlier redraws of this session) so the user never re-sees them."""
    if session.cursor < len(session.pool):
        return False
    union: set[int] = set()
    for c in session.choices.values():
        union.update(c.genres)
    if not union:
        return False
    existing_ids = {c.tmdb_id for c in session.candidates}
    blocked_ids = existing_ids | set(session.previously_shown_ids)
    target = len(blocked_ids) + 40
    movies = await tmdb.discover_movies(sorted(union), target)
    fresh = [m for m in movies if m.tmdb_id not in blocked_ids]
    if not fresh:
        return False
    for m in fresh:
        session.candidates.append(Candidate(
            tmdb_id=m.tmdb_id, title=m.title, year=m.year,
            poster_path=m.poster_path, overview=m.overview,
            genre_ids=m.genre_ids, vote_average=m.vote_average,
        ))
        session.pool.append(m.tmdb_id)
    return True


def _build_pairwise_maybes(session: Session, room_players) -> list[PairwiseMaybe]:
    """Collect unique maybe-voted candidates (by any player) and pair them."""
    union: set[int] = set()
    for p in room_players:
        union.update(_player_maybe_movies(session, p.id))
    ids = sorted(union)
    random.shuffle(ids)
    pairs: list[PairwiseMaybe] = []
    for i in range(0, len(ids) - 1, 2):
        pairs.append(PairwiseMaybe(a=ids[i], b=ids[i + 1]))
    # If odd number, the last one falls through unpaired (gets auto-converted to like).
    if len(ids) % 2 == 1:
        leftover = ids[-1]
        c = _candidate(session, leftover)
        if c is not None:
            # auto-convert the lone maybe to a like for the player(s) who marked it maybe
            for p in room_players:
                if leftover in _player_maybe_movies(session, p.id):
                    c.phase_votes.setdefault("pairwise_maybes", {})[p.id] = Vote(
                        value="like", created_at=now_iso()
                    )
    return pairs


def _resolve_pairwise_maybes(session: Session, room_players) -> None:
    """After all pairwise picks are in, translate them into like/dislike votes
    on the underlying candidates."""
    for pair in session.pairwise_maybes:
        for p in room_players:
            chosen = pair.picks.get(p.id)
            if chosen is None:
                # player didn't pick (shouldn't happen, but be defensive)
                continue
            for tid in (pair.a, pair.b):
                c = _candidate(session, tid)
                if c is None:
                    continue
                value: VoteValue = "like" if tid == chosen else "dislike"
                c.phase_votes.setdefault("pairwise_maybes", {})[p.id] = Vote(
                    value=value, created_at=now_iso()
                )


async def _transition(session: Session, room) -> None:
    """Move to revealed after the discovery deck is finished."""
    session.phase = "revealed"
    session.state = "revealed"
    session.revealed_at = now_iso()


def _advance_to_narrow_or_h2h_or_reveal(session: Session) -> None:
    player_ids: set[str] = set()
    for c in session.candidates:
        for phase_votes in c.phase_votes.values():
            player_ids.update(phase_votes.keys())
    survivors = [c for c in session.candidates if _is_survivor(c)]
    survivors.sort(key=lambda c: (-_weighted_score(c, player_ids), -c.vote_average))

    if len(survivors) > 3:
        session.phase = "narrow"
        session.pool = [c.tmdb_id for c in survivors]
        session.cursor = 0
        return

    if len(survivors) >= 2:
        top_two = survivors[:2]
        session.phase = "head_to_head"
        session.pairs = [HeadToHeadPair(a=top_two[0].tmdb_id, b=top_two[1].tmdb_id)]
        session.pair_cursor = 0
        return

    session.phase = "revealed"
    session.state = "revealed"
    session.revealed_at = now_iso()
    if survivors:
        session.winner_tmdb_id = survivors[0].tmdb_id


def _head_to_head_winner(session: Session) -> int | None:
    if not session.pairs:
        return None
    pair = session.pairs[-1]
    counts: dict[int, int] = {pair.a: 0, pair.b: 0}
    for chosen in pair.votes.values():
        counts[chosen] = counts.get(chosen, 0) + 1
    if counts[pair.a] == counts[pair.b]:
        a = _candidate(session, pair.a)
        b = _candidate(session, pair.b)
        if a and b:
            return pair.a if len(_yes_voters(a)) >= len(_yes_voters(b)) else pair.b
        return pair.a
    return pair.a if counts[pair.a] > counts[pair.b] else pair.b


# ---------------------------------------------------------------------------
# Routes


@router.post("/api/rooms/{code}/session")
def start_session(code: str, payload: StartSessionRequest) -> dict:
    room = get_room_or_404(code)
    if room.session_id and sessions_store.get(room.session_id):
        existing = sessions_store[room.session_id]
        if existing.state != "revealed":
            raise HTTPException(status_code=409, detail="Session already active")
    session = Session(
        id=str(uuid4()),
        room_code=room.code,
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
    session.choices[payload.player_id].genres = list(set(payload.genres))
    session.choices[payload.player_id].locked = payload.locked

    # Wait for EVERY current room player (including anyone who joined after
    # the session was created) to be in choices AND locked.
    all_locked = (
        len(room.players) > 0
        and all(
            p.id in session.choices and session.choices[p.id].locked
            for p in room.players
        )
    )
    if all_locked:
        union: set[int] = set()
        for c in session.choices.values():
            union.update(c.genres)
        if not union:
            raise HTTPException(status_code=400, detail="Pick at least one genre between you")
        movies = await tmdb.discover_movies(sorted(union), INITIAL_FETCH_COUNT)
        if not movies:
            raise HTTPException(status_code=502, detail="No candidates available")
        random.shuffle(movies)
        session.candidates = [
            Candidate(
                tmdb_id=m.tmdb_id, title=m.title, year=m.year,
                poster_path=m.poster_path, overview=m.overview,
                genre_ids=m.genre_ids, vote_average=m.vote_average,
            )
            for m in movies
        ]
        session.phase = "discovery"
        session.pool = [c.tmdb_id for c in session.candidates]
        session.cursor = 0
        session.state = "swiping"
    return {"session": public_session(session)}


@router.post("/api/rooms/{code}/session/vote")
async def submit_vote(code: str, payload: VoteRequest) -> dict:
    room = get_room_or_404(code)
    session = sessions_store.get(room.session_id or "")
    if not session or session.state != "swiping":
        raise HTTPException(status_code=400, detail="No swiping session")
    if session.phase not in ("discovery", "narrow"):
        raise HTTPException(status_code=400, detail="Current phase doesn't accept stamp votes")
    if payload.player_id not in {p.id for p in room.players}:
        raise HTTPException(status_code=400, detail="Player not in room")
    if session.cursor >= len(session.pool):
        raise HTTPException(status_code=400, detail="Phase already finished")
    if payload.value == "maybe" and session.phase != "discovery":
        raise HTTPException(status_code=400, detail="Maybe not allowed in this phase")

    current_tmdb_id = session.pool[session.cursor]
    candidate = _candidate(session, current_tmdb_id)
    if not candidate:
        raise HTTPException(status_code=500, detail="Candidate missing")

    phase_key = session.phase
    candidate.phase_votes.setdefault(phase_key, {})[payload.player_id] = Vote(
        value=payload.value, created_at=now_iso()
    )

    if _all_players_voted_on_card(candidate, phase_key, room.players):
        session.cursor += 1
        if session.phase == "discovery":
            _reorder_pool_by_affinity(session)
            # Deck ends after DECK_SIZE cards (or earlier if pool is exhausted).
            if session.cursor >= min(DECK_SIZE, len(session.pool)):
                await _transition(session, room)
        elif session.cursor >= len(session.pool):
            await _transition(session, room)
    return {"session": public_session(session)}


@router.post("/api/rooms/{code}/session/pairwise")
async def submit_pairwise(code: str, payload: PairwiseChoiceRequest) -> dict:
    room = get_room_or_404(code)
    session = sessions_store.get(room.session_id or "")
    if not session or session.phase != "pairwise_maybes":
        raise HTTPException(status_code=400, detail="Not in pairwise phase")
    if payload.player_id not in {p.id for p in room.players}:
        raise HTTPException(status_code=400, detail="Player not in room")
    if session.pairwise_cursor >= len(session.pairwise_maybes):
        raise HTTPException(status_code=400, detail="Pairwise phase finished")

    pair = session.pairwise_maybes[session.pairwise_cursor]
    if payload.chosen not in (pair.a, pair.b):
        raise HTTPException(status_code=400, detail="Chosen movie not in this pair")
    pair.picks[payload.player_id] = payload.chosen

    if all(p.id in pair.picks for p in room.players):
        session.pairwise_cursor += 1
        if session.pairwise_cursor >= len(session.pairwise_maybes):
            await _transition(session, room)
    return {"session": public_session(session)}


@router.post("/api/rooms/{code}/session/h2h")
async def submit_h2h_vote(code: str, payload: HeadToHeadVoteRequest) -> dict:
    room = get_room_or_404(code)
    session = sessions_store.get(room.session_id or "")
    if not session or session.phase != "head_to_head":
        raise HTTPException(status_code=400, detail="Not in head-to-head phase")
    if payload.player_id not in {p.id for p in room.players}:
        raise HTTPException(status_code=400, detail="Player not in room")
    if session.pair_cursor >= len(session.pairs):
        raise HTTPException(status_code=400, detail="Head-to-head finished")

    pair = session.pairs[session.pair_cursor]
    if payload.chosen not in (pair.a, pair.b):
        raise HTTPException(status_code=400, detail="Chosen movie not in this pair")
    pair.votes[payload.player_id] = payload.chosen

    if all(p.id in pair.votes for p in room.players):
        session.pair_cursor += 1
        if session.pair_cursor >= len(session.pairs):
            await _transition(session, room)
    return {"session": public_session(session)}


@router.post("/api/rooms/{code}/session/winner")
async def declare_winner(code: str, payload: WinnerRequest) -> dict:
    room = get_room_or_404(code)
    session = sessions_store.get(room.session_id or "")
    if not session or session.state != "revealed":
        raise HTTPException(status_code=400, detail="Session not revealed")
    top = [c for c, _ in aggregate_scores(session, {p.id for p in room.players})[:3]]
    if payload.tmdb_id not in {c.tmdb_id for c in top}:
        raise HTTPException(status_code=400, detail="Winner must be one of the Top 3")
    session.winner_tmdb_id = payload.tmdb_id
    return {"session": public_session(session)}


@router.post("/api/rooms/{code}/session/redraw")
async def redraw_session(code: str) -> dict:
    """Reset the session back to discovery with a fresh batch of movies
    that haven't appeared in this room before."""
    room = get_room_or_404(code)
    session = sessions_store.get(room.session_id or "")
    if not session:
        raise HTTPException(status_code=404, detail="No session to redraw")

    # Remember every tmdb_id that has appeared so far (this run + prior runs).
    exclusions: set[int] = set(session.previously_shown_ids)
    exclusions.update(c.tmdb_id for c in session.candidates)

    union: set[int] = set()
    for c in session.choices.values():
        union.update(c.genres)
    if not union:
        raise HTTPException(status_code=400, detail="No genres set on this session")

    # Ask TMDB for a big batch so the exclusions still leave us enough.
    bulk = await tmdb.discover_movies(
        sorted(union), len(exclusions) + INITIAL_FETCH_COUNT + 20
    )
    fresh = [m for m in bulk if m.tmdb_id not in exclusions]
    if len(fresh) < 5:
        raise HTTPException(
            status_code=400,
            detail="Not enough new movies left for these genres. Try a different genre mix.",
        )
    fresh = fresh[:INITIAL_FETCH_COUNT]
    random.shuffle(fresh)

    session.previously_shown_ids = list(exclusions)
    session.candidates = [
        Candidate(
            tmdb_id=m.tmdb_id, title=m.title, year=m.year,
            poster_path=m.poster_path, overview=m.overview,
            genre_ids=m.genre_ids, vote_average=m.vote_average,
        )
        for m in fresh
    ]
    session.phase = "discovery"
    session.state = "swiping"
    session.pool = [c.tmdb_id for c in session.candidates]
    session.cursor = 0
    session.pairwise_maybes = []
    session.pairwise_cursor = 0
    session.pairs = []
    session.pair_cursor = 0
    session.winner_tmdb_id = None
    session.revealed_at = None
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
    player_ids = {p.id for p in room.players}
    top = aggregate_scores(session, player_ids)[:3]
    return {
        "top": [
            {**c.model_dump(), "score": round(score, 2)}
            for c, score in top
        ]
    }
