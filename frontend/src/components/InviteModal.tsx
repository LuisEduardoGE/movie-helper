import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  roomCode: string;
  onClose: () => void;
};

export function InviteModal({ roomCode, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const inviteUrl =
    `${window.location.origin}${window.location.pathname}?join=${roomCode}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div
        className="modalSheet inviteModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Invite to room"
      >
        <button className="modalSheet__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <h2 className="inviteModal__title">Invite someone</h2>
        <p className="inviteModal__hint">
          Scan the QR code or share the link. They'll land straight in this room.
        </p>

        <div className="inviteModal__qr">
          <QRCodeSVG
            value={inviteUrl}
            size={192}
            bgColor="transparent"
            fgColor="var(--ink)"
            level="M"
          />
        </div>

        <div className="inviteModal__code">{roomCode}</div>

        <button className="pillButton inviteModal__copyBtn" onClick={copyLink}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied!" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}
