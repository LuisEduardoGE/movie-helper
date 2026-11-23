/**
 * Flat SVG portraits of 12 famous movie characters.
 * Each uses a 48×48 canvas with 2-4 iconic visual elements — enough to
 * be recognisable at 40 px while still looking good at 160 px in the lobby.
 */

type SvgProps = { width?: number | string; height?: number | string };

const bg = (color: string) => (
  <rect width="48" height="48" fill={color} />
);

/* ─── 1. Darth Vader ─────────────────────────────────────────────────── */
const DarthVader = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#0d0d1e")}
    {/* dome */}
    <ellipse cx="24" cy="17" rx="13" ry="14" fill="#111" />
    {/* face plate */}
    <path d="M14 25 L34 25 L31 42 L17 42 Z" fill="#1a1a1a" />
    {/* eye visor housing */}
    <rect x="12" y="21" width="24" height="6" rx="2" fill="#060606" />
    {/* left eye */}
    <rect x="14" y="22.5" width="8" height="3" rx="1.5" fill="#cc1100" />
    {/* right eye */}
    <rect x="26" y="22.5" width="8" height="3" rx="1.5" fill="#cc1100" />
    {/* grille */}
    <rect x="17" y="30" width="14" height="1.5" rx="0.75" fill="#333" />
    <rect x="17" y="33" width="14" height="1.5" rx="0.75" fill="#333" />
    <rect x="17" y="36" width="14" height="1.5" rx="0.75" fill="#333" />
  </svg>
);

/* ─── 2. Yoda ─────────────────────────────────────────────────────────── */
const Yoda = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#1e4018")}
    {/* big ears */}
    <ellipse cx="5" cy="21" rx="5" ry="10" fill="#5a8a38" />
    <ellipse cx="43" cy="21" rx="5" ry="10" fill="#5a8a38" />
    {/* face */}
    <ellipse cx="24" cy="28" rx="14" ry="12" fill="#6a9a42" />
    {/* eyes */}
    <circle cx="19" cy="25" r="3" fill="#f5e680" />
    <circle cx="29" cy="25" r="3" fill="#f5e680" />
    <circle cx="19.8" cy="25.5" r="1.5" fill="#2a4018" />
    <circle cx="29.8" cy="25.5" r="1.5" fill="#2a4018" />
    {/* wrinkled brow */}
    <path d="M15 21 Q19 19 24 20 Q29 19 33 21" stroke="#4a7a28" fill="none" strokeWidth="1.5" />
    {/* smile */}
    <path d="M18 33 Q24 38 30 33" stroke="#3a6a1a" fill="none" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/* ─── 3. Iron Man ─────────────────────────────────────────────────────── */
const IronMan = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#6e0000")}
    {/* helmet top */}
    <path d="M11 22 Q11 7 24 7 Q37 7 37 22 Z" fill="#c8281c" />
    {/* face plate */}
    <path d="M11 22 L37 22 L34 42 L14 42 Z" fill="#c8a000" />
    {/* face plate seam */}
    <line x1="24" y1="22" x2="24" y2="42" stroke="#a08000" strokeWidth="1" />
    {/* left eye */}
    <polygon points="11,22 22,19 22,26 11,25" fill="#60b8ff" />
    <polygon points="12,22.5 21,20 21,25.5 12,24" fill="#a8d8ff" opacity="0.6" />
    {/* right eye */}
    <polygon points="37,22 26,19 26,26 37,25" fill="#60b8ff" />
    <polygon points="36,22.5 27,20 27,25.5 36,24" fill="#a8d8ff" opacity="0.6" />
    {/* chin */}
    <rect x="18" y="36" width="12" height="4" rx="2" fill="#a08000" />
    {/* arc reactor */}
    <circle cx="24" cy="14" r="4" fill="#0a4488" />
    <circle cx="24" cy="14" r="2.5" fill="#4ab4ff" />
    <circle cx="24" cy="14" r="1.2" fill="#c8ecff" />
  </svg>
);

/* ─── 4. Hermione Granger ────────────────────────────────────────────── */
const Hermione = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#4a2c0a")}
    {/* bushy hair left */}
    <ellipse cx="11" cy="22" rx="9" ry="14" fill="#7a4810" />
    {/* bushy hair right */}
    <ellipse cx="37" cy="22" rx="9" ry="14" fill="#7a4810" />
    {/* hair top */}
    <ellipse cx="24" cy="12" rx="13" ry="8" fill="#7a4810" />
    {/* face */}
    <ellipse cx="24" cy="26" rx="11" ry="13" fill="#f5d9b8" />
    {/* eyes */}
    <ellipse cx="19.5" cy="24" rx="2.5" ry="2" fill="#4a2800" />
    <ellipse cx="28.5" cy="24" rx="2.5" ry="2" fill="#4a2800" />
    {/* brows */}
    <path d="M17 21 Q19.5 20 22 21" stroke="#5a3000" fill="none" strokeWidth="1.2" />
    <path d="M26 21 Q28.5 20 31 21" stroke="#5a3000" fill="none" strokeWidth="1.2" />
    {/* wand + spark */}
    <line x1="36" y1="38" x2="44" y2="30" stroke="#8b6914" strokeWidth="2" strokeLinecap="round" />
    <circle cx="44" cy="30" r="2.5" fill="#ffe866" opacity="0.9" />
    <line x1="44" y1="27" x2="46" y2="24" stroke="#ffe866" strokeWidth="1" />
    <line x1="46" y1="29" x2="48" y2="28" stroke="#ffe866" strokeWidth="1" />
  </svg>
);

/* ─── 5. Jack Sparrow ────────────────────────────────────────────────── */
const JackSparrow = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#0f1e3a")}
    {/* face */}
    <ellipse cx="24" cy="28" rx="11" ry="13" fill="#d4a070" />
    {/* hat brim */}
    <rect x="8" y="18" width="32" height="4" rx="1" fill="#1a1a1a" />
    {/* hat dome */}
    <path d="M14 18 Q14 6 24 6 Q34 6 34 18 Z" fill="#111" />
    {/* hat band */}
    <rect x="8" y="16" width="32" height="3" fill="#8b1a10" />
    {/* dreadlocks left */}
    <rect x="10" y="20" width="3" height="18" rx="1.5" fill="#4a3010" />
    <rect x="14" y="20" width="2.5" height="16" rx="1.2" fill="#3a2808" />
    {/* dreadlocks right */}
    <rect x="35" y="20" width="3" height="18" rx="1.5" fill="#4a3010" />
    <rect x="31.5" y="20" width="2.5" height="14" rx="1.2" fill="#3a2808" />
    {/* eyes */}
    <circle cx="20" cy="27" r="2.5" fill="#1a0a00" />
    <circle cx="28" cy="27" r="2.5" fill="#1a0a00" />
    {/* kohl (eyeliner) */}
    <path d="M17 26 Q20 24.5 23 26" stroke="#111" fill="none" strokeWidth="1" />
    <path d="M25 26 Q28 24.5 31 26" stroke="#111" fill="none" strokeWidth="1" />
    {/* beard stubble */}
    <path d="M18 36 Q24 40 30 36" stroke="#6a4820" fill="none" strokeWidth="1.5" />
    {/* small goatee */}
    <ellipse cx="24" cy="39" rx="3" ry="2" fill="#5a3818" />
  </svg>
);

/* ─── 6. Indiana Jones ───────────────────────────────────────────────── */
const IndianaJones = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#4a2a0a")}
    {/* face */}
    <ellipse cx="24" cy="30" rx="11" ry="12" fill="#d4a070" />
    {/* hat brim — wide */}
    <ellipse cx="24" cy="19" rx="18" ry="3.5" fill="#5a3810" />
    {/* hat dome */}
    <path d="M13 19 Q12 8 24 8 Q36 8 35 19 Z" fill="#6a4418" />
    {/* hat indent */}
    <path d="M15 13 Q24 11 33 13" stroke="#4a2c08" fill="none" strokeWidth="1.5" />
    {/* eyes */}
    <ellipse cx="20" cy="29" rx="2.2" ry="2" fill="#4a2800" />
    <ellipse cx="28" cy="29" rx="2.2" ry="2" fill="#4a2800" />
    {/* stubble */}
    <path d="M18 37 Q24 41 30 37" stroke="#8a6030" fill="none" strokeWidth="1.2" />
    {/* chin dimple */}
    <ellipse cx="24" cy="40" rx="2" ry="1.2" fill="#c09060" />
    {/* whip hint (curved line bottom right) */}
    <path d="M36 38 Q42 34 44 40 Q46 44 44 46" stroke="#7a5020" fill="none" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ─── 7. The Joker ───────────────────────────────────────────────────── */
const Joker = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#3a0060")}
    {/* green hair left sweep */}
    <ellipse cx="11" cy="16" rx="9" ry="12" fill="#2a8a1a" />
    {/* green hair right */}
    <ellipse cx="37" cy="16" rx="9" ry="12" fill="#2a8a1a" />
    {/* hair top */}
    <ellipse cx="24" cy="10" rx="14" ry="8" fill="#2a8a1a" />
    {/* white face */}
    <ellipse cx="24" cy="27" rx="12" ry="14" fill="#f0ede0" />
    {/* dark eyes */}
    <ellipse cx="19" cy="24" rx="3" ry="2.5" fill="#1a0a00" />
    <ellipse cx="29" cy="24" rx="3" ry="2.5" fill="#1a0a00" />
    {/* yellow teeth smile */}
    <path d="M14 33 Q24 42 34 33" fill="#cc0000" />
    <path d="M15 33 Q24 41 33 33" fill="#e8d828" />
    {/* smile scar lines */}
    <line x1="12" y1="30" x2="15" y2="35" stroke="#8a1a00" strokeWidth="1.5" />
    <line x1="36" y1="30" x2="33" y2="35" stroke="#8a1a00" strokeWidth="1.5" />
  </svg>
);

/* ─── 8. Gandalf ─────────────────────────────────────────────────────── */
const Gandalf = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#2a2a4a")}
    {/* tall hat */}
    <polygon points="24,1 15,20 33,20" fill="#888898" />
    {/* hat brim */}
    <ellipse cx="24" cy="20" rx="12" ry="2.5" fill="#6a6a7a" />
    {/* face */}
    <ellipse cx="24" cy="27" rx="9" ry="10" fill="#e8d8c0" />
    {/* bushy brows */}
    <path d="M15 22 Q19 20 23 22" stroke="#c8c8c8" fill="none" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M25 22 Q29 20 33 22" stroke="#c8c8c8" fill="none" strokeWidth="2.5" strokeLinecap="round" />
    {/* eyes — wise */}
    <circle cx="20" cy="25" r="2" fill="#4a6a20" />
    <circle cx="28" cy="25" r="2" fill="#4a6a20" />
    {/* beard — flowing white */}
    <path d="M15 32 Q10 38 12 48 L36 48 Q38 38 33 32 Q28 36 24 36 Q20 36 15 32 Z" fill="#e8e8e8" />
    {/* beard shadow */}
    <path d="M18 32 Q14 38 15 45" stroke="#ccc" fill="none" strokeWidth="1" />
    <path d="M30 32 Q34 38 33 45" stroke="#ccc" fill="none" strokeWidth="1" />
  </svg>
);

/* ─── 9. Shrek ───────────────────────────────────────────────────────── */
const Shrek = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#2a5008")}
    {/* ear stubs */}
    <circle cx="8" cy="20" r="6" fill="#6aaa28" />
    <circle cx="40" cy="20" r="6" fill="#6aaa28" />
    <circle cx="8" cy="20" r="3.5" fill="#4a8a10" />
    <circle cx="40" cy="20" r="3.5" fill="#4a8a10" />
    {/* head — big round */}
    <ellipse cx="24" cy="26" rx="17" ry="18" fill="#7ab82e" />
    {/* brow ridge */}
    <path d="M10 18 Q24 14 38 18" stroke="#5a9018" fill="none" strokeWidth="3" />
    {/* eyes */}
    <ellipse cx="18" cy="22" rx="4" ry="3.5" fill="#f5e880" />
    <ellipse cx="30" cy="22" rx="4" ry="3.5" fill="#f5e880" />
    <circle cx="18.5" cy="22.5" r="2.2" fill="#2a4008" />
    <circle cx="30.5" cy="22.5" r="2.2" fill="#2a4008" />
    {/* nose */}
    <ellipse cx="24" cy="29" rx="5" ry="3.5" fill="#5a9018" />
    <circle cx="21.5" cy="29" r="2" fill="#4a8010" />
    <circle cx="26.5" cy="29" r="2" fill="#4a8010" />
    {/* smile */}
    <path d="M15 36 Q24 43 33 36" stroke="#3a7008" fill="none" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/* ─── 10. James Bond ─────────────────────────────────────────────────── */
const JamesBond = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#0a0a22")}
    {/* face */}
    <ellipse cx="24" cy="20" rx="11" ry="13" fill="#d4b898" />
    {/* hair */}
    <path d="M13 15 Q13 6 24 6 Q35 6 35 15 Q29 12 24 13 Q19 12 13 15 Z" fill="#2a1a0a" />
    {/* eyes */}
    <ellipse cx="19.5" cy="19" rx="2.5" ry="2" fill="#2a1a0a" />
    <ellipse cx="28.5" cy="19" rx="2.5" ry="2" fill="#2a1a0a" />
    {/* tuxedo jacket */}
    <path d="M5 48 L5 38 Q13 32 24 34 Q35 32 43 38 L43 48 Z" fill="#111" />
    {/* white shirt */}
    <path d="M20 34 L24 40 L28 34 Q24 33 20 34 Z" fill="#eee" />
    {/* bow tie */}
    <polygon points="20,36 24,38 20,40" fill="#000" />
    <polygon points="28,36 24,38 28,40" fill="#000" />
    <circle cx="24" cy="38" r="1.5" fill="#1a1a1a" />
    {/* lapels */}
    <path d="M13 38 L20 34" stroke="#333" fill="none" strokeWidth="1.5" />
    <path d="M35 38 L28 34" stroke="#333" fill="none" strokeWidth="1.5" />
    {/* gun silhouette (small) */}
    <rect x="36" y="22" width="9" height="3.5" rx="1" fill="#555" />
    <rect x="38" y="25.5" width="2" height="3" rx="0.5" fill="#555" />
    <rect x="43" y="19" width="2" height="3.5" rx="0.5" fill="#555" />
  </svg>
);

/* ─── 11. Katniss Everdeen ───────────────────────────────────────────── */
const Katniss = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#1a2a08")}
    {/* hair — dark, parted in middle pulled back */}
    <ellipse cx="24" cy="16" rx="12" ry="10" fill="#1a1008" />
    {/* side braid going down left */}
    <rect x="9" y="18" width="4" height="24" rx="2" fill="#1a1008" />
    <rect x="9.5" y="20" width="3" height="3" rx="1" fill="#2a1a08" />
    <rect x="9.5" y="25" width="3" height="3" rx="1" fill="#2a1a08" />
    <rect x="9.5" y="30" width="3" height="3" rx="1" fill="#2a1a08" />
    <rect x="9.5" y="35" width="3" height="3" rx="1" fill="#2a1a08" />
    {/* face */}
    <ellipse cx="25" cy="24" rx="10" ry="12" fill="#d4b090" />
    {/* determined eyes */}
    <ellipse cx="21" cy="22" rx="2.5" ry="2" fill="#3a2010" />
    <ellipse cx="30" cy="22" rx="2.5" ry="2" fill="#3a2010" />
    {/* brow — serious */}
    <path d="M18 19 Q21 18 24 19" stroke="#2a1a08" fill="none" strokeWidth="1.5" />
    <path d="M27 19 Q30 18 33 19" stroke="#2a1a08" fill="none" strokeWidth="1.5" />
    {/* mockingjay pin */}
    <circle cx="38" cy="18" r="4" fill="#c8a000" />
    <path d="M36 16 Q38 14 40 16 Q42 17 40 19 Q38 21 36 19 Q34 17 36 16 Z" fill="#e8c000" />
    {/* bow arc */}
    <path d="M42 30 Q48 24 42 18" stroke="#5a3808" fill="none" strokeWidth="2" strokeLinecap="round" />
    {/* bowstring */}
    <line x1="42" y1="18" x2="42" y2="30" stroke="#8a6a3a" strokeWidth="0.8" />
  </svg>
);

/* ─── 12. The Terminator ─────────────────────────────────────────────── */
const Terminator = ({ width = 48, height = 48 }: SvgProps) => (
  <svg viewBox="0 0 48 48" width={width} height={height}>
    {bg("#111")}
    {/* skull base */}
    <ellipse cx="24" cy="22" rx="14" ry="16" fill="#2a2a2a" />
    {/* chrome/metal left half */}
    <path d="M10 22 Q10 6 24 6 L24 38 Q16 38 12 34 Q10 30 10 22 Z" fill="#888" />
    {/* metallic shine on left */}
    <path d="M13 10 Q11 16 12 22" stroke="#bbb" fill="none" strokeWidth="1" />
    {/* flesh right half */}
    <path d="M24 6 Q38 6 38 22 Q38 30 36 34 Q32 38 24 38 Z" fill="#c8885a" />
    {/* dividing scar line */}
    <line x1="24" y1="6" x2="24" y2="38" stroke="#555" strokeWidth="1.5" />
    {/* left red eye — glowing */}
    <circle cx="17" cy="22" r="4" fill="#880000" />
    <circle cx="17" cy="22" r="2.5" fill="#cc1100" />
    <circle cx="17" cy="22" r="1.2" fill="#ff4422" />
    {/* right human eye — with damage */}
    <ellipse cx="30" cy="22" rx="3" ry="2.5" fill="#2a1808" />
    <ellipse cx="30.5" cy="22.5" rx="1.5" ry="1.2" fill="#3a2a18" />
    {/* skull teeth row */}
    <rect x="16" y="34" width="3" height="4" rx="0.5" fill="#ccc" />
    <rect x="20" y="34" width="3" height="4" rx="0.5" fill="#bbb" />
    <rect x="24" y="34" width="3" height="4" rx="0.5" fill="#aaa" />
    <rect x="28" y="34" width="3" height="4" rx="0.5" fill="#bbb" />
  </svg>
);

/* ─── Registry ────────────────────────────────────────────────────────── */

export type MovieAvatar = {
  id: string;
  label: string;
  Component: React.FC<SvgProps>;
};

export const MOVIE_AVATARS: MovieAvatar[] = [
  { id: "darth_vader",  label: "Darth Vader",   Component: DarthVader },
  { id: "yoda",         label: "Yoda",           Component: Yoda },
  { id: "iron_man",     label: "Iron Man",        Component: IronMan },
  { id: "hermione",     label: "Hermione",        Component: Hermione },
  { id: "jack_sparrow", label: "Jack Sparrow",    Component: JackSparrow },
  { id: "indy",         label: "Indiana Jones",   Component: IndianaJones },
  { id: "joker",        label: "The Joker",       Component: Joker },
  { id: "gandalf",      label: "Gandalf",         Component: Gandalf },
  { id: "shrek",        label: "Shrek",           Component: Shrek },
  { id: "bond",         label: "James Bond",      Component: JamesBond },
  { id: "katniss",      label: "Katniss",         Component: Katniss },
  { id: "terminator",   label: "Terminator",      Component: Terminator },
];

export const DEFAULT_AVATAR_ID = MOVIE_AVATARS[0].id;

/** Renders the SVG for a given avatar ID. Falls back to the first avatar. */
export function AvatarSVG({ id, size = 48 }: { id: string; size?: number }) {
  const avatar = MOVIE_AVATARS.find((a) => a.id === id) ?? MOVIE_AVATARS[0];
  return <avatar.Component width={size} height={size} />;
}
