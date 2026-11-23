import { useEffect, useState } from "react";
import { Loader2, Plus, Send } from "lucide-react";
import { api } from "../lib/api";
import type { AvatarOption, Candidate, Player, Room } from "../lib/api";
import { posterUrl } from "../lib/tmdb";

const AVATAR_KEY = "movie-helper-avatar";
const FALLBACK_AVATAR_ID = "iron_man";

type Props = {
  avatarOptions: AvatarOption[];
  onJoined: (room: Room, player: Player) => void;
  onError: (message: string) => void;
};

type TrendingResponse = { results: Pick<Candidate, "tmdb_id" | "title" | "poster_path" | "year">[] };

const COLLAGE_SLOTS = 7;

export function WelcomeScreen({ avatarOptions, onJoined, onError }: Props) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [posters, setPosters] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string>(
    () => localStorage.getItem(AVATAR_KEY) ?? FALLBACK_AVATAR_ID
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("join");
    if (code) {
      setJoinCode(code.toUpperCase().slice(0, 5));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    api<TrendingResponse>("/api/trending")
      .then((d) => {
        const withPosters = d.results
          .map((m) => posterUrl(m.poster_path, "md"))
          .filter((u): u is string => Boolean(u));
        for (let i = withPosters.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [withPosters[i], withPosters[j]] = [withPosters[j], withPosters[i]];
        }
        setPosters(withPosters.slice(0, COLLAGE_SLOTS));
      })
      .catch(() => undefined);
  }, []);

  const pickAvatar = (id: string) => {
    setAvatar(id);
    localStorage.setItem(AVATAR_KEY, id);
  };

  const guarded = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); }
    catch (e) { onError(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  };

  const createRoom = () =>
    guarded(async () => {
      const data = await api<{ room: Room; player: Player }>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), avatar }),
      });
      onJoined(data.room, data.player);
    });

  const joinRoom = () =>
    guarded(async () => {
      const code = joinCode.trim().toUpperCase();
      if (code.length !== 5) { onError("Room code must be exactly 5 characters"); return; }
      const cleanName = name.trim();
      if (!cleanName) { onError("Enter your name first"); return; }
      const data = await api<{ room: Room; player: Player }>(
        `/api/rooms/${code}/join`,
        { method: "POST", body: JSON.stringify({ name: cleanName, avatar }) }
      );
      onJoined(data.room, data.player);
    });

  return (
    <section className="welcome">
      <div className="welcome__collage" aria-hidden="true">
        {posters.map((src, i) => (
          <div key={i} className={`welcome__poster welcome__poster--${i}`}>
            <img src={src} alt="" loading="lazy" />
          </div>
        ))}
      </div>

      <div className="welcome__hero">
        <span className="welcome__kicker">Movie Helper</span>
        <h1 className="welcome__title">
          What should we<br />
          <em>watch tonight?</em>
        </h1>
        <p className="welcome__lede">
          Pick movies together. Swipe, debate, eliminate.
          End up with one you actually want to watch.
        </p>

        <div className="welcome__card">
          <div className="avatarPicker">
            <span className="avatarPicker__label">Pick your character</span>
            {avatarOptions.length > 0 ? (
              <div className="avatarPicker__grid">
                {avatarOptions.map((opt) => {
                  const photoUrl = opt.image_url ?? null;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`avatarBtn ${opt.id === avatar ? "avatarBtn--selected" : ""}`}
                      onClick={() => pickAvatar(opt.id)}
                      aria-label={`${opt.label} (${opt.actor})`}
                      aria-pressed={opt.id === avatar}
                      title={`${opt.label} · ${opt.actor}`}
                    >
                      {photoUrl ? (
                        <img src={photoUrl} alt={opt.label} />
                      ) : (
                        <span className="avatarBtn__initial">
                          {opt.label.slice(0, 1)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="avatarPicker__loading">
                <Loader2 className="spin" size={16} />
              </div>
            )}
          </div>

          <label className="field">
            <span className="field__label">Your name</span>
            <input
              autoFocus
              className="field__input"
              maxLength={32}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Luis"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && !busy) createRoom();
              }}
            />
          </label>

          <button
            className="pillButton welcome__primary"
            disabled={!name.trim() || busy}
            onClick={createRoom}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Start a new room
          </button>

          <div className="welcome__divider"><span>or join with a code</span></div>

          <div className="welcome__joinRow">
            <input
              className="codeField__input"
              maxLength={5}
              placeholder="CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && joinCode.length === 5 && !busy) joinRoom();
              }}
            />
            <button
              className="pillButton pillButton--ghost"
              disabled={!name.trim() || joinCode.length < 5 || busy}
              onClick={joinRoom}
            >
              <Send size={15} />
              Join
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
