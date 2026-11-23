import { Clapperboard, LogOut } from "lucide-react";
import type { AvatarOption, Player, Room } from "../lib/api";

type Props = {
  room: Room | null;
  player: Player | null;
  avatarOptions: AvatarOption[];
  onCopy: () => void;
  onLeave: () => void;
};

export function RoomHeader({ room, player, avatarOptions, onLeave }: Props) {
  const getPhoto = (avatarId: string): string | null =>
    avatarOptions.find((o) => o.id === avatarId)?.image_url ?? null;

  return (
    <header className="roomHeader">
      <div className="roomHeader__brand">
        <span className="roomHeader__mark">
          <Clapperboard size={18} />
        </span>
        Movie Helper
      </div>

      {room && player && (
        <div className="roomHeader__right">
          <div className="roomHeader__players">
            {room.players.map((p) => {
              const photo = p.avatar ? getPhoto(p.avatar) : null;
              return (
                <span className="playerChip" key={p.id}>
                  <span className="playerChip__avatar">
                    {photo ? (
                      <img src={photo} alt={p.name} />
                    ) : (
                      <span className="playerChip__dot" />
                    )}
                  </span>
                  {p.name}
                </span>
              );
            })}
          </div>

          <button className="iconButton" onClick={onLeave} aria-label="Leave room">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </header>
  );
}
