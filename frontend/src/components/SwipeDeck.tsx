import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Candidate, Player, Room, Session, VoteValue } from "../lib/api";
import { PolaroidCard, type LeavingDirection } from "./PolaroidCard";
import { VoteStamps } from "./VoteStamps";

type Props = {
  room: Room;
  player: Player;
  session: Session;
  onUpdated: (session: Session) => void;
  onError: (message: string) => void;
};

const DIRECTIONS: Record<VoteValue, LeavingDirection> = {
  dislike: "left",
  maybe: "up",
  like: "right",
  seen: "down",
};

const SWIPE_DURATION_MS = 280;

const PHASE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  narrow: "Narrow it down",
};

export function SwipeDeck({ room, player, session, onUpdated, onError }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState<LeavingDirection>(null);
  const lastDirectionRef = useRef<LeavingDirection>(null);

  const candidatesById = useMemo(() => {
    const map = new Map<number, Candidate>();
    for (const c of session.candidates) map.set(c.tmdb_id, c);
    return map;
  }, [session.candidates]);

  const currentTmdbId = session.pool[session.cursor];

  const [displayedTmdbId, setDisplayedTmdbId] = useState<number | undefined>(currentTmdbId);
  const displayed = displayedTmdbId !== undefined ? candidatesById.get(displayedTmdbId) : undefined;

  // Peek cards anchored to displayed index to avoid the pre-animation twitch.
  const displayedIndex = useMemo(() => {
    if (displayedTmdbId === undefined) return -1;
    return session.pool.indexOf(displayedTmdbId);
  }, [session.pool, displayedTmdbId]);

  const next = displayedIndex >= 0 ? candidatesById.get(session.pool[displayedIndex + 1]) : undefined;
  const next2 = displayedIndex >= 0 ? candidatesById.get(session.pool[displayedIndex + 2]) : undefined;

  useEffect(() => {
    if (currentTmdbId === displayedTmdbId) return;
    if (displayedTmdbId === undefined) { setDisplayedTmdbId(currentTmdbId); return; }
    if (!session.pool.includes(displayedTmdbId)) {
      setDisplayedTmdbId(currentTmdbId);
      setLeaving(null);
      lastDirectionRef.current = null;
      return;
    }
    const direction = lastDirectionRef.current ?? "right";
    setLeaving(direction);
    const t = window.setTimeout(() => {
      setDisplayedTmdbId(currentTmdbId);
      setLeaving(null);
      lastDirectionRef.current = null;
    }, SWIPE_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [currentTmdbId, displayedTmdbId, session.pool]);

  const myPhaseVotes = displayed?.phase_votes?.[session.phase] ?? {};
  const myVote = myPhaseVotes[player.id];
  const pendingPlayers = useMemo(() => {
    if (!displayed) return [];
    return room.players.filter((p) => !myPhaseVotes[p.id]);
  }, [room.players, displayed, myPhaseVotes]);

  const submitVote = async (value: VoteValue) => {
    if (!displayed || submitting || myVote) return;
    lastDirectionRef.current = DIRECTIONS[value];
    setSubmitting(true);
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/vote`,
        { method: "POST", body: JSON.stringify({ player_id: player.id, value }) }
      );
      onUpdated(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Vote failed");
      lastDirectionRef.current = null;
    } finally {
      setSubmitting(false);
    }
  };

  if (!displayed) {
    return <section className="deck"><p>Loading…</p></section>;
  }

  const phaseLabel = PHASE_LABELS[session.phase] ?? session.phase;
  const showMaybe = session.phase === "discovery";

  // Progress through the fixed deck (discovery only).
  const deckSize = session.deck_size ?? 12;
  const cardNumber = session.phase === "discovery"
    ? Math.min(session.cursor + 1, deckSize)
    : null;

  return (
    <section className="deck">
      <div className="deck__status">
        <span className="deck__round">{phaseLabel}</span>
        {cardNumber !== null && (
          <div className="deckProgress">
            <div
              className="deckProgress__bar"
              style={{ width: `${(session.cursor / deckSize) * 100}%` }}
            />
            <span className="deckProgress__label">{cardNumber} / {deckSize}</span>
          </div>
        )}
        {myVote && pendingPlayers.length > 0 && (
          <span className="deck__waiting">
            Waiting for {pendingPlayers.map((p) => p.name).join(", ")}…
          </span>
        )}
      </div>

      <div className="deck__stack">
        {next2 && <PolaroidCard key={`n2-${next2.tmdb_id}`} candidate={next2} layer="next2" />}
        {next && <PolaroidCard key={`n-${next.tmdb_id}`} candidate={next} layer="next" />}
        <PolaroidCard
          key={`a-${displayed.tmdb_id}`}
          candidate={displayed}
          layer="active"
          leaving={leaving}
          onSeen={() => submitVote("seen")}
          seenDisabled={Boolean(myVote) || submitting}
          phase={session.phase}
          players={room.players}
        />
      </div>

      <VoteStamps
        onVote={submitVote}
        disabled={Boolean(myVote) || submitting}
        seenDisabled={Boolean(myVote) || submitting}
        showMaybe={showMaybe}
      />
    </section>
  );
}
