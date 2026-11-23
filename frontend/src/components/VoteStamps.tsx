import { useEffect } from "react";
import type { VoteValue } from "../lib/api";

type Props = {
  onVote: (value: VoteValue) => void;
  disabled?: boolean;
  seenDisabled?: boolean;
  showMaybe?: boolean;
};

const ALL_STAMPS: { value: VoteValue; label: string; className: string; hotkey: string }[] = [
  { value: "dislike", label: "No", className: "stamp--no", hotkey: "1" },
  { value: "maybe", label: "Maybe", className: "stamp--maybe", hotkey: "2" },
  { value: "like", label: "Yes", className: "stamp--yes", hotkey: "3" },
];

const KEY_TO_VOTE: Record<string, VoteValue> = {
  "1": "dislike",
  "2": "maybe",
  "3": "like",
  "4": "seen",
};

export function VoteStamps({
  onVote,
  disabled = false,
  seenDisabled = false,
  showMaybe = true,
}: Props) {
  const stamps = showMaybe ? ALL_STAMPS : ALL_STAMPS.filter((s) => s.value !== "maybe");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const value = KEY_TO_VOTE[event.key];
      if (!value) return;
      if (value === "seen" && seenDisabled) return;
      if (value === "maybe" && !showMaybe) return;
      if (value !== "seen" && disabled) return;
      onVote(value);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onVote, disabled, seenDisabled, showMaybe]);

  return (
    <div className="stamps">
      {stamps.map((stamp) => (
        <button
          key={stamp.value}
          className={`stamp ${stamp.className}`}
          onClick={() => onVote(stamp.value)}
          disabled={disabled}
          aria-label={stamp.label}
        >
          <span>{stamp.label}</span>
          <span className="stamp__hot">{stamp.hotkey}</span>
        </button>
      ))}
    </div>
  );
}
