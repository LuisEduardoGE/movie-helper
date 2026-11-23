import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import type { Room, Session, Top3Entry } from "../lib/api";
import { PosterImage } from "./PosterImage";

type Props = {
  room: Room;
  session: Session;
  onUpdated: (session: Session) => void;
  onError: (message: string) => void;
};

const RANK_LABEL: Record<number, string> = { 1: "#1", 2: "#2", 3: "#3" };

export function RevealTop3({ room, session, onUpdated, onError }: Props) {
  const [top, setTop] = useState<Top3Entry[]>([]);
  const [redrawing, setRedrawing] = useState(false);

  useEffect(() => {
    api<{ top: Top3Entry[] }>(`/api/rooms/${room.code}/session/top`)
      .then((d) => setTop(d.top))
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load Top 3"));
  }, [room.code, onError]);

  const declareWinner = async (tmdb_id: number) => {
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/winner`,
        { method: "POST", body: JSON.stringify({ tmdb_id }) }
      );
      onUpdated(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not set winner");
    }
  };

  const redraw = async () => {
    if (redrawing) return;
    setRedrawing(true);
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/redraw`,
        { method: "POST" }
      );
      onUpdated(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not redraw");
    } finally {
      setRedrawing(false);
    }
  };

  if (top.length === 0) {
    return (
      <section className="reveal">
        <h1 className="reveal__heading">Tallying votes…</h1>
      </section>
    );
  }

  const winner = session.winner_tmdb_id;

  if (top.length === 0) {
    return (
      <section className="reveal">
        <h1 className="reveal__heading">Nothing matched</h1>
        <p className="reveal__sub">No movies got a positive vote.</p>
        <button className="pillButton" onClick={redraw} disabled={redrawing}>
          {redrawing ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          Try different movies
        </button>
      </section>
    );
  }

  const fmtScore = (s: number) =>
    Number.isInteger(s) ? `${s}` : s.toFixed(2).replace(/\.?0+$/, "");

  return (
    <section className="reveal">
      <div className="reveal__header">
        <h1 className="reveal__heading">The verdict</h1>
        <p className="reveal__sub">
          {winner ? "Locked in. Enjoy the movie." : "Tap one to lock it in for tonight."}
        </p>
      </div>

      <div className="rankList">
        {top.map((entry, i) => {
          const rank = (i + 1) as 1 | 2 | 3;
          const isWinner = entry.tmdb_id === winner;
          return (
            <div
              key={entry.tmdb_id}
              className={[
                "rankCard",
                `rankCard--rank${rank}`,
                isWinner ? "rankCard--winner" : "",
                !winner ? "rankCard--selectable" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => !winner && declareWinner(entry.tmdb_id)}
              role={!winner ? "button" : undefined}
              tabIndex={!winner ? 0 : undefined}
              onKeyDown={(e) => { if (!winner && (e.key === "Enter" || e.key === " ")) declareWinner(entry.tmdb_id); }}
            >
              <span className="rankBadge">{RANK_LABEL[rank]}</span>

              <div className="rankCard__poster">
                <PosterImage posterPath={entry.poster_path} alt={entry.title} size="sm" />
              </div>

              <div className="rankCard__info">
                <span className="rankCard__title">{entry.title}</span>
                <span className="rankCard__meta">
                  {entry.year ?? "—"}
                  {entry.vote_average > 0 && ` · ★ ${entry.vote_average.toFixed(1)}`}
                  {` · ${fmtScore(entry.score)} pts`}
                </span>
              </div>

              {isWinner && (
                <span className="watchingStamp watchingStamp--inline">Tonight</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="reveal__actions">
        <button
          className="pillButton pillButton--ghost"
          onClick={redraw}
          disabled={redrawing}
        >
          {redrawing ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
          {winner ? "Pick again with different movies" : "None of these — try again"}
        </button>
      </div>
    </section>
  );
}
