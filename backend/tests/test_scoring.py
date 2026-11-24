from app.sessions import Candidate, Session, Vote, _weighted_score, aggregate_scores

TS = "2026-01-01T00:00:00+00:00"


def candidate(tmdb_id, votes, vote_average=0.0):
    """votes: {phase: {player_id: value}}"""
    return Candidate(
        tmdb_id=tmdb_id,
        title=f"Movie {tmdb_id}",
        year=2020,
        poster_path=None,
        overview="",
        vote_average=vote_average,
        phase_votes={
            phase: {pid: Vote(value=value, created_at=TS) for pid, value in by_player.items()}
            for phase, by_player in votes.items()
        },
    )


PLAYERS = {"p1", "p2"}


def test_discovery_like_and_maybe_weights():
    c = candidate(1, {"discovery": {"p1": "like", "p2": "maybe"}})
    assert _weighted_score(c, PLAYERS) == 1.25


def test_unanimous_discovery_bonus():
    c = candidate(1, {"discovery": {"p1": "like", "p2": "like"}})
    assert _weighted_score(c, PLAYERS) == 2.5


def test_later_phases_weigh_more():
    c = candidate(1, {
        "discovery": {"p1": "maybe"},
        "pairwise_maybes": {"p1": "like"},
        "narrow": {"p1": "like"},
    })
    assert _weighted_score(c, PLAYERS) == 0.25 + 0.75 + 2.0


def test_votes_from_players_outside_the_room_are_ignored():
    c = candidate(1, {"discovery": {"stranger": "like"}})
    assert _weighted_score(c, PLAYERS) == 0.0


def test_aggregate_ranks_by_score_then_rating_and_drops_seen_and_zero():
    session = Session(
        id="s",
        room_code="ABCDE",
        state="swiping",
        created_at=TS,
        candidates=[
            candidate(1, {"discovery": {"p1": "like"}}, vote_average=6.0),
            candidate(2, {"discovery": {"p1": "like"}}, vote_average=8.0),
            candidate(3, {"discovery": {"p1": "like", "p2": "like"}}),
            candidate(4, {"discovery": {"p1": "like", "p2": "seen"}}),
            candidate(5, {"discovery": {"p1": "dislike"}}),
        ],
    )
    ranked = [c.tmdb_id for c, _ in aggregate_scores(session, PLAYERS)]
    assert ranked == [3, 2, 1]
