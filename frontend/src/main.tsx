import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, Loader2, Sparkles } from "lucide-react";
import { api } from "./lib/api";
import type { AvatarOption, Player, Room, Session } from "./lib/api";
import { RoomHeader } from "./components/RoomHeader";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { GenrePicker } from "./components/GenrePicker";
import { SwipeDeck } from "./components/SwipeDeck";
import { PairwiseMaybes } from "./components/PairwiseMaybes";
import { HeadToHead } from "./components/HeadToHead";
import { RevealTop3 } from "./components/RevealTop3";
import "./styles.css";

type Toast = { kind: "success" | "error"; message: string };

function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [booting, setBooting] = useState(true);
  const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([]);

  useEffect(() => {
    // Fetch avatar options in parallel with session restore.
    api<{ options: AvatarOption[] }>("/api/avatar-options")
      .then((d) => setAvatarOptions(d.options))
      .catch(() => undefined);

    const stored = localStorage.getItem("movie-helper-session");
    if (!stored) { setBooting(false); return; }
    try {
      const { roomCode, player: p } = JSON.parse(stored);
      api<{ room: Room; session: Session | null }>(`/api/rooms/${roomCode}`)
        .then((d) => { setRoom(d.room); setPlayer(p); setSession(d.session); })
        .catch(() => localStorage.removeItem("movie-helper-session"))
        .finally(() => setBooting(false));
    } catch {
      localStorage.removeItem("movie-helper-session");
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    if (!room) return;
    const activeSwipe = session?.state === "swiping";
    const intervalMs = activeSwipe ? 1500 : 2500;
    const stop = session?.state === "revealed" && session?.winner_tmdb_id !== null;
    if (stop) return;
    const timer = window.setInterval(() => {
      api<{ room: Room; session: Session | null }>(`/api/rooms/${room.code}`)
        .then((d) => { setRoom(d.room); setSession(d.session); })
        .catch(() => undefined);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [room?.code, session?.state, session?.winner_tmdb_id]);

  const persist = (nextRoom: Room, nextPlayer: Player) => {
    setRoom(nextRoom); setPlayer(nextPlayer);
    localStorage.setItem(
      "movie-helper-session",
      JSON.stringify({ roomCode: nextRoom.code, player: nextPlayer })
    );
  };

  const leave = () => {
    localStorage.removeItem("movie-helper-session");
    setRoom(null); setPlayer(null); setSession(null);
  };

  const onJoined = (r: Room, p: Player) => persist(r, p);
  const onSessionStarted = (s: Session) => setSession(s);
  const onSessionUpdated = (s: Session) => setSession(s);
  const onError = (message: string) => setToast({ kind: "error", message });

  const screen = useMemo(() => {
    if (!room || !player) return "welcome";
    if (!session) return "lobby";
    if (session.state === "picking_genres") return "genres";
    if (session.phase === "pairwise_maybes") return "pairwise";
    if (session.phase === "head_to_head") return "h2h";
    if (session.state === "swiping") return "swipe";
    if (session.state === "revealed") return "reveal";
    return "lobby";
  }, [room, player, session]);

  if (booting) {
    return (
      <main className="app app__loading">
        <Loader2 className="spin" size={28} />
      </main>
    );
  }

  return (
    <main className="app">
      <RoomHeader
        room={room}
        player={player}
        avatarOptions={avatarOptions}
        onCopy={async () => {
          if (!room) return;
          await navigator.clipboard.writeText(room.code);
          setToast({ kind: "success", message: "Room code copied" });
        }}
        onLeave={leave}
      />

      {screen === "welcome" && (
        <WelcomeScreen avatarOptions={avatarOptions} onJoined={onJoined} onError={onError} />
      )}
      {screen === "lobby" && room && (
        <LobbyScreen room={room} avatarOptions={avatarOptions} onStarted={onSessionStarted} onError={onError} />
      )}
      {screen === "genres" && room && player && session && (
        <GenrePicker
          room={room}
          player={player}
          session={session}
          onUpdated={onSessionUpdated}
          onError={onError}
        />
      )}
      {screen === "swipe" && room && player && session && (
        <SwipeDeck
          room={room}
          player={player}
          session={session}
          onUpdated={onSessionUpdated}
          onError={onError}
        />
      )}
      {screen === "pairwise" && room && player && session && (
        <PairwiseMaybes
          room={room}
          player={player}
          session={session}
          onUpdated={onSessionUpdated}
          onError={onError}
        />
      )}
      {screen === "h2h" && room && player && session && (
        <HeadToHead
          room={room}
          player={player}
          session={session}
          onUpdated={onSessionUpdated}
          onError={onError}
        />
      )}
      {screen === "reveal" && room && session && (
        <RevealTop3
          room={room}
          session={session}
          onUpdated={onSessionUpdated}
          onError={onError}
        />
      )}

      <footer className="footer">Movie data by TMDB · made for movie night</footer>

      {toast && (
        <div className={`toast ${toast.kind === "error" ? "toast--error" : ""}`}>
          {toast.kind === "success" ? <Check size={16} /> : <Sparkles size={16} />}
          {toast.message}
          <button
            className="iconButton"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            style={{ color: "inherit", width: 24, height: 24 }}
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
