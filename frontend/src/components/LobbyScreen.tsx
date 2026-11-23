import { useState } from "react";
import { Clipboard, Loader2, Play, QrCode } from "lucide-react";
import { api } from "../lib/api";
import type { AvatarOption, Room, Session } from "../lib/api";
import { InviteModal } from "./InviteModal";

const DECK_SIZE = 12;

type Props = {
  room: Room;
  avatarOptions: AvatarOption[];
  onStarted: (session: Session) => void;
  onError: (message: string) => void;
};

export function LobbyScreen({ room, avatarOptions, onStarted, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const data = await api<{ session: Session }>(
        `/api/rooms/${room.code}/session`,
        { method: "POST", body: JSON.stringify({ rounds: 3, cards_per_round: 10 }) }
      );
      onStarted(data.session);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(room.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const getPhoto = (avatarId: string): string | null =>
    avatarOptions.find((o) => o.id === avatarId)?.image_url ?? null;

  const placeholders = Math.max(0, 2 - room.players.length);

  return (
    <>
      <section className="lobby">
        <div className="lobby__left">
          <h1 className="lobby__heading">Pull up a chair.</h1>
          <p className="lobby__subtitle">
            Share the room code and wait for the others to join.
            When everyone's in, you'll each swipe through {DECK_SIZE} movies — then your Top 3 reveals.
          </p>

          <div className="lobby__players">
            {room.players.map((p, i) => {
              const photo = p.avatar ? getPhoto(p.avatar) : null;
              return (
                <div
                  className={`lobbyPolaroid lobbyPolaroid--filled lobbyPolaroid--tilt${i % 2 === 0 ? "L" : "R"}`}
                  key={p.id}
                >
                  <div className="lobbyPolaroid__face">
                    {photo ? (
                      <img src={photo} alt={p.name} />
                    ) : (
                      <span className="lobbyPolaroid__initial">
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="lobbyPolaroid__name">{p.name}</div>
                </div>
              );
            })}
            {Array.from({ length: placeholders }).map((_, i) => (
              <div className="lobbyPolaroid lobbyPolaroid--empty" key={`empty-${i}`}>
                <div className="lobbyPolaroid__face lobbyPolaroid__face--empty">?</div>
                <div className="lobbyPolaroid__name">waiting…</div>
              </div>
            ))}
          </div>
        </div>

        <div className="configCard">
          {/* ── Invite section ── */}
          <div className="configCard__invite">
            <div className="configCard__codeBlock">
              <span className="configCard__codeLabel">Room code</span>
              <span className="configCard__codeValue">{room.code}</span>
            </div>
            <div className="configCard__inviteActions">
              <button
                className="pillButton pillButton--ghost configCard__inviteBtn"
                onClick={copyCode}
                title="Copy code"
              >
                <Clipboard size={14} />
                {codeCopied ? "Copied!" : "Copy code"}
              </button>
              <button
                className="pillButton pillButton--ghost configCard__inviteBtn"
                onClick={() => setInviteOpen(true)}
                title="Show QR code"
              >
                <QrCode size={14} />
                QR invite
              </button>
            </div>
          </div>

          <div className="configCard__divider" />

          {/* ── How it works ── */}
          <div className="configCard__title">How it works</div>
          <ol className="configCard__steps">
            <li>Pick your genres together</li>
            <li>Each swipe through {DECK_SIZE} movies — yes, maybe, or no</li>
            <li>Your Top 3 matches reveal at the end</li>
            <li>Not feeling any of them? Redraw for a fresh batch</li>
          </ol>
          <button className="pillButton" disabled={busy} onClick={start}>
            {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
            Start picking
          </button>
        </div>
      </section>

      {inviteOpen && (
        <InviteModal roomCode={room.code} onClose={() => setInviteOpen(false)} />
      )}
    </>
  );
}
