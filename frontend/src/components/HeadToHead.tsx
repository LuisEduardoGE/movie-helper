import { useMemo, useState } from "react";
import { Swords } from "lucide-react";
import { api } from "../lib/api";
import type { Candidate, Player, Room, Session } from "../lib/api";
import { PosterImage } from "./PosterImage";

type Props = {
  room: Room;
  player: Player;
  session: Session;
  onUpdated: (session: Session) => void;
  onError: (message: string) => void;
};

export function HeadToHead({ room, player, session, onUpdated, onError }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const candidatesById = useMemo(() => {
    const m = new Map<number, Candidate>();
    for (const c of session.candidates) m.set(c.tmdb_id, c);
    return m;
  }, [session.candidates]);

  const pair = session.pairs[session.pair_cursor];
  if (!pair) {
    return (
      <section className="reveal">
        <h1>Tallying…</h1>
      </section>
    );
  }

  const a = candidatesById.get(pair.a);
  const b = candidatesById.get(pair.b);
  if (!a || !b) {
    return (
      <section className="reveal">
        <h1>Pair missing.</h1>
      </section>
    );
  }

  const myChoice = pair.votes[player.id];
  const pendingPlayers = room.players.filter((p) => !(p.id in pair.votes));

  const choose = async (chosen: number) => {
    if (submitting || myChoice !== undefined) return;
    setSubmitting(true);
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/h2h`,
        {
          method: "POST",
          body: JSON.stringify({ player_id: player.id, chosen }),
        }
      );
      onUpdated(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Choice failed");
    } finally {
      setSubmitting(false);
    }
  };

  const renderCard = (c: Candidate, isPicked: boolean) => (
    <button
      className={`h2hCard ${isPicked ? "h2hCard--picked" : ""} ${myChoice !== undefined && !isPicked ? "h2hCard--unpicked" : ""}`}
      onClick={() => choose(c.tmdb_id)}
      disabled={myChoice !== undefined || submitting}
      aria-label={`Choose ${c.title}`}
    >
      <div className="h2hCard__poster">
        <PosterImage posterPath={c.poster_path} alt={c.title} size="lg" />
      </div>
      <div className="h2hCard__caption">
        <h3 className="h2hCard__title">{c.title}</h3>
        <span className="h2hCard__year">{c.year ?? "—"}</span>
      </div>
      {isPicked && <div className="h2hCard__stamp">Picked</div>}
    </button>
  );

  return (
    <section className="h2h">
      <div className="h2h__header">
        <div className="deck__round">
          <Swords size={14} style={{ verticalAlign: "middle" }} /> Final round · Head-to-head
        </div>
        <h1 className="h2h__title">Which would you actually watch?</h1>
        {myChoice !== undefined && pendingPlayers.length > 0 && (
          <span className="deck__waiting">
            Waiting for {pendingPlayers.map((p) => p.name).join(", ")}…
          </span>
        )}
      </div>

      <div className="h2h__arena">
        {renderCard(a, myChoice === a.tmdb_id)}
        <div className="h2h__vs">vs</div>
        {renderCard(b, myChoice === b.tmdb_id)}
      </div>
    </section>
  );
}
