import { useState } from "react";
import { Eye, Star } from "lucide-react";
import type { Candidate, Player, VoteValue } from "../lib/api";
import { PosterImage } from "./PosterImage";
import { OverviewModal } from "./OverviewModal";

const GENRE_NAMES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western",
};

type Layer = "active" | "next" | "next2";
export type LeavingDirection = "left" | "right" | "up" | "down" | null;

type Props = {
  candidate: Candidate;
  layer: Layer;
  leaving?: LeavingDirection;
  onSeen?: () => void;
  seenDisabled?: boolean;
  hideSeen?: boolean;
  phase?: string;
  players?: Player[];
};

const VOTE_LABEL: Record<VoteValue, string> = {
  like: "Yes", maybe: "Maybe", dislike: "No", seen: "Seen",
};
const VOTE_CLASS: Record<VoteValue, string> = {
  like: "voteBadge--yes", maybe: "voteBadge--maybe",
  dislike: "voteBadge--no", seen: "voteBadge--seen",
};

export function PolaroidCard({
  candidate, layer, leaving = null, onSeen,
  seenDisabled = false, hideSeen = false, phase, players,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const classes = [
    "polaroid",
    `polaroid--${layer}`,
    leaving && "polaroid--leaving",
    leaving && `polaroid--leaving-${leaving}`,
  ].filter(Boolean).join(" ");

  const phaseVotes = phase ? candidate.phase_votes?.[phase] ?? {} : {};
  const badges =
    layer === "active" && players
      ? players.map((p) => ({ player: p, vote: phaseVotes[p.id] })).filter((b) => Boolean(b.vote))
      : [];

  const genres = (candidate.genre_ids ?? []).map((id) => GENRE_NAMES[id]).filter(Boolean).slice(0, 2);
  const rating = (candidate.vote_average ?? 0) > 0 ? (candidate.vote_average).toFixed(1) : null;

  return (
    <>
      <div className={classes}>
        <div className="polaroid__poster">
          <PosterImage posterPath={candidate.poster_path} alt={candidate.title} size="lg" />
        </div>

        {layer === "active" && !hideSeen && onSeen && (
          <button
            className="polaroid__seenStamp"
            onClick={onSeen}
            disabled={seenDisabled}
            aria-label="Already seen — exclude from Top 3"
            title="Already seen"
          >
            <Eye size={18} />
            <span>Seen</span>
          </button>
        )}

        {badges.length > 0 && (
          <div className="polaroid__voteBadges">
            {badges.map(({ player, vote }) => (
              <span
                key={player.id}
                className={`voteBadge ${VOTE_CLASS[vote!.value]}`}
                title={`${player.name}: ${VOTE_LABEL[vote!.value]}`}
              >
                {player.name.slice(0, 1).toUpperCase()} · {VOTE_LABEL[vote!.value]}
              </span>
            ))}
          </div>
        )}

        <div className="polaroid__caption">
          <div className="polaroid__captionTop">
            <h3 className="polaroid__title">{candidate.title}</h3>
            <span className="polaroid__year">{candidate.year ?? "—"}</span>
          </div>

          <div className="polaroid__meta">
            {rating && (
              <span className="polaroid__rating">
                <Star size={11} fill="currentColor" />
                {rating}
              </span>
            )}
            {genres.map((g) => (
              <span key={g} className="genreTag genreTag--sm">{g}</span>
            ))}
          </div>

          {candidate.overview && (
            <>
              <p className="polaroid__overview">{candidate.overview}</p>
              {layer === "active" && (
                <button
                  type="button"
                  className="polaroid__readMore"
                  onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
                >
                  Read more
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {modalOpen && (
        <OverviewModal
          tmdbId={candidate.tmdb_id}
          title={candidate.title}
          year={candidate.year}
          overview={candidate.overview}
          genreIds={candidate.genre_ids ?? []}
          voteAverage={candidate.vote_average ?? 0}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
