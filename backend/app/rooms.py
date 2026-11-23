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
    avatar: str = ""


class Room(BaseModel):
    code: str
    players: list[Player] = []
    session_id: str | None = None
    created_at: str


class CreateRoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    avatar: str = Field(default="", max_length=8)


class JoinRoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    avatar: str = Field(default="", max_length=8)


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
    player = Player(id=str(uuid4()), name=payload.name.strip(), avatar=payload.avatar)
    room = Room(code=make_code(), players=[player], created_at=now_iso())
    rooms[room.code] = room
    return {"room": room.model_dump(), "player": player}


@router.post("/api/rooms/{code}/join")
def join_room(code: str, payload: JoinRoomRequest) -> dict:
    from .sessions import GenreChoice, sessions_store
    room = get_room_or_404(code)
    player = Player(id=str(uuid4()), name=payload.name.strip(), avatar=payload.avatar)
    room.players.append(player)
    # If a genre-picking session is in progress, register the new player so
    # the all-locked transition waits for their vote too.
    if room.session_id and room.session_id in sessions_store:
        session = sessions_store[room.session_id]
        if session.state == "picking_genres" and player.id not in session.choices:
            session.choices[player.id] = GenreChoice(player_id=player.id)
    return {"room": room.model_dump(), "player": player}


@router.get("/api/rooms/{code}")
def read_room(code: str) -> dict:
    from .sessions import public_session, sessions_store
    room = get_room_or_404(code)
    session_payload = None
    if room.session_id and room.session_id in sessions_store:
        session_payload = public_session(sessions_store[room.session_id])
    return {"room": room.model_dump(), "session": session_payload}
