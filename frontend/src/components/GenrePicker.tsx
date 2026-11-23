import { useEffect, useMemo, useState } from "react";
import {
  Flame, Compass, Sparkles, Laugh, BookOpen,
  Ghost, Heart, Rocket, Eye, Check,
} from "lucide-react";
import { api } from "../lib/api";
import type { Genre, Player, Room, Session } from "../lib/api";

/* ── Per-genre metadata ───────────────────────────────────────────────── */
type GenreMeta = {
  Icon: React.FC<{ size?: number; strokeWidth?: number }>;
  color: string;   // icon circle background
  examples: [string, string]; // two representative films
};

const GENRE_META: Record<number, GenreMeta> = {
  28:    { Icon: Flame,    color: "#c85020", examples: ["John Wick",           "Mad Max: Fury Road"]    },
  12:    { Icon: Compass,  color: "#7a5030", examples: ["Indiana Jones",       "Lord of the Rings"]     },
  16:    { Icon: Sparkles, color: "#7030a8", examples: ["Spider-Verse",        "Spirited Away"]         },
  35:    { Icon: Laugh,    color: "#b88010", examples: ["The Grand Budapest",  "Superbad"]              },
  18:    { Icon: BookOpen, color: "#2a6870", examples: ["Shawshank Redemption","Past Lives"]            },
  27:    { Icon: Ghost,    color: "#701818", examples: ["Get Out",             "Hereditary"]            },
  10749: { Icon: Heart,    color: "#b83070", examples: ["Before Sunrise",      "La La Land"]            },
  878:   { Icon: Rocket,   color: "#184888", examples: ["Blade Runner 2049",   "Arrival"]               },
  53:    { Icon: Eye,      color: "#3a3a5a", examples: ["Prisoners",           "No Country for Old Men"]},
};

type Props = {
  room: Room;
  player: Player;
  session: Session;
  onUpdated: (session: Session) => void;
  onError: (message: string) => void;
};

export function GenrePicker({ room, player, session, onUpdated, onError }: Props) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const myChoice = session.choices[player.id];

  useEffect(() => {
    api<{ genres: Genre[] }>("/api/genres")
      .then((d) => setGenres(d.genres))
      .catch((e) => onError(e instanceof Error ? e.message : "Could not load genres"));
  }, [onError]);

  useEffect(() => {
    if (myChoice?.locked && myChoice.genres.length > 0)
      setSelected(new Set(myChoice.genres));
  }, [myChoice?.locked]);

  const toggle = (id: number) => {
    if (myChoice?.locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const lockIn = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/genres`,
        { method: "POST", body: JSON.stringify({ player_id: player.id, genres: Array.from(selected), locked: true }) }
      );
      onUpdated(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not lock in");
    } finally {
      setSubmitting(false);
    }
  };

  const unlock = async () => {
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session/genres`,
        { method: "POST", body: JSON.stringify({ player_id: player.id, genres: Array.from(selected), locked: false }) }
      );
      onUpdated(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not unlock");
    }
  };

  const playerStatuses = useMemo(
    () => room.players.map((p) => ({
      player: p,
      locked: session.choices[p.id]?.locked ?? false,
      count: session.choices[p.id]?.genres.length ?? 0,
    })),
    [room.players, session.choices]
  );

  /* ── Locked-in state ─────────────────────────────────────────────────── */
  if (myChoice?.locked) {
    const pickedGenres = genres.filter((g) => myChoice.genres.includes(g.id));
    return (
      <section className="genrePicker genrePicker--locked">
        <div className="genrePicker__lockedHeader">
          <h1>Locked in.</h1>
          <p className="genrePicker__lockedSub">
            Waiting for everyone else to pick their genres.
          </p>
        </div>

        <div className="genrePicker__lockedChips">
          {pickedGenres.map((g) => {
            const meta = GENRE_META[g.id];
            return (
              <span key={g.id} className="genreLockedChip">
                {meta && (
                  <span className="genreLockedChip__dot" style={{ background: meta.color }}>
                    <meta.Icon size={11} strokeWidth={2.5} />
                  </span>
                )}
                {g.name}
              </span>
            );
          })}
        </div>

        <div className="genrePicker__status">
          {playerStatuses.map(({ player: p, locked, count }) => (
            <span className={`lockChip ${locked ? "lockChip--locked" : ""}`} key={p.id}>
              {locked ? "✓" : "…"} {p.name} {locked ? `(${count})` : ""}
            </span>
          ))}
        </div>

        <button className="pillButton pillButton--ghost" onClick={unlock}>
          Change my picks
        </button>
      </section>
    );
  }

  if (!genres.length) {
    return <section className="genrePicker"><p>Loading genres…</p></section>;
  }

  /* ── Picker ──────────────────────────────────────────────────────────── */
  return (
    <section className="genrePicker">
      <div className="genrePicker__header">
        <h1 className="genrePicker__heading">What's your vibe?</h1>
        <p className="genrePicker__sub">Pick as many genres as you'd like to watch tonight.</p>
      </div>

      <div className="genreGrid">
        {genres.map((g) => {
          const on = selected.has(g.id);
          const meta = GENRE_META[g.id];
          return (
            <button
              key={g.id}
              type="button"
              className={`genreCard ${on ? "genreCard--on" : ""}`}
              onClick={() => toggle(g.id)}
              aria-pressed={on}
            >
              {meta && (
                <span className="genreCard__icon" style={{ background: on ? "rgba(255,255,255,0.2)" : meta.color }}>
                  <meta.Icon size={18} strokeWidth={2} />
                </span>
              )}
              <span className="genreCard__name">{g.name}</span>
              {meta && (
                <span className="genreCard__examples">
                  {meta.examples[0]} · {meta.examples[1]}
                </span>
              )}
              {on && (
                <span className="genreCard__check">
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="genrePicker__footer">
        <div className="genrePicker__status">
          {playerStatuses.map(({ player: p, locked, count }) => (
            <span className={`lockChip ${locked ? "lockChip--locked" : ""}`} key={p.id}>
              {locked ? "✓" : "…"} {p.name} {locked ? `(${count})` : ""}
            </span>
          ))}
        </div>

        <button
          className="pillButton genrePicker__lockBtn"
          onClick={lockIn}
          disabled={selected.size === 0 || submitting}
        >
          <Check size={15} strokeWidth={2.5} />
          Lock in {selected.size > 0 ? `${selected.size} genre${selected.size === 1 ? "" : "s"}` : "genres"}
        </button>
      </div>
    </section>
  );
}
