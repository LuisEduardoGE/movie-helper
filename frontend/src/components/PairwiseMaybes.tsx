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

export function PairwiseMaybes({ room, player, session, onUpdated, onError }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const candidatesById = useMemo(() => {
    const m = new Map<number, Candidate>();
    for (const c of session.candidates) m.set(c.tmdb_id, c);
    return m;
  }, [session.candidates]);

  const pair = session.pairwise_maybes[session.pairwise_cursor];
  const totalPairs = session.pairwise_maybes.length;
  const currentIndex = session.pairwise_cursor + 1;

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
        <h1>Pair missing</h1>
      </section>
    );
  }

  const myPick = pair.picks[player.id];
  const pendingPlayers = room.players.filter((p) => !(p.id in pair.picks));

  const choose = async (chosen: number) => {
    if (submitting || myPick !== undefined) return;
    setSubmitting(true);
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/pairwise`,
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

  const renderCard = (c: Candidate, picked: boolean) => (
    <button
      className={`h2hCard ${picked ? "h2hCard--picked" : ""} ${myPick !== undefined && !picked ? "h2hCard--unpicked" : ""}`}
      onClick={() => choose(c.tmdb_id)}
      disabled={myPick !== undefined || submitting}
      aria-label={`Choose ${c.title}`}
    >
      <div className="h2hCard__poster">
        <PosterImage posterPath={c.poster_path} alt={c.title} size="lg" />
      </div>
      <div className="h2hCard__caption">
        <h3 className="h2hCard__title">{c.title}</h3>
        <span className="h2hCard__year">{c.year ?? "—"}</span>
      </div>
      {picked && <div className="h2hCard__stamp">Picked</div>}
    </button>
  );

  return (
    <section className="h2h">
      <div className="h2h__header">
        <div className="deck__round">
          <Swords size={14} style={{ verticalAlign: "middle" }} /> Decide your maybes · {currentIndex} / {totalPairs}
        </div>
        <h1 className="h2h__title">Which one would you actually pick?</h1>
        {myPick !== undefined && pendingPlayers.length > 0 && (
          <span className="deck__waiting">
            Waiting for {pendingPlayers.map((p) => p.name).join(", ")}…
          </span>
        )}
      </div>

      <div className="h2h__arena">
        {renderCard(a, myPick === a.tmdb_id)}
        <div className="h2h__vs">vs</div>
        {renderCard(b, myPick === b.tmdb_id)}
      </div>
    </section>
  );
}
