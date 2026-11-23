import { useEffect, useState } from "react";
import { X, Star, User } from "lucide-react";
import { api } from "../lib/api";
import { profileUrl } from "../lib/tmdb";

const GENRE_NAMES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western",
};

type CastMember = { name: string; character: string; profile_path: string | null };

type Props = {
  tmdbId: number;
  title: string;
  year: number | null;
  overview: string;
  genreIds: number[];
  voteAverage: number;
  onClose: () => void;
};

export function OverviewModal({ tmdbId, title, year, overview, genreIds, voteAverage, onClose }: Props) {
  const [cast, setCast] = useState<CastMember[] | null>(null);

  useEffect(() => {
    api<{ cast: CastMember[] }>(`/api/movies/${tmdbId}`)
      .then((d) => setCast(d.cast))
      .catch(() => setCast([]));
  }, [tmdbId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const genres = genreIds.map((id) => GENRE_NAMES[id]).filter(Boolean);
  const rating = voteAverage > 0 ? voteAverage.toFixed(1) : null;

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalSheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="modal-title">
        <button className="modalSheet__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <h2 id="modal-title" className="modalSheet__title">{title}</h2>

        <div className="modalSheet__subheader">
          {year !== null && <span className="modalSheet__year">{year}</span>}
          {rating && (
            <span className="modalSheet__rating">
              <Star size={12} fill="currentColor" />
              {rating}
            </span>
          )}
        </div>

        {genres.length > 0 && (
          <div className="modalSheet__genres">
            {genres.map((g) => (
              <span key={g} className="genreTag">{g}</span>
            ))}
          </div>
        )}

        <h3 className="modalSheet__sectionTitle">Cast</h3>
        <div className="castRow">
          {cast === null
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="castCard castCard--skeleton">
                  <div className="castCard__photo castCard__photo--skeleton" />
                  <span className="castCard__nameSkeleton" />
                  <span className="castCard__charSkeleton" />
                </div>
              ))
            : cast.map((member) => {
                const img = profileUrl(member.profile_path);
                return (
                  <div key={member.name} className="castCard">
                    <div className="castCard__photo">
                      {img
                        ? <img src={img} alt={member.name} loading="lazy" />
                        : <User size={24} />
                      }
                    </div>
                    <span className="castCard__name">{member.name}</span>
                    {member.character && (
                      <span className="castCard__character">{member.character}</span>
                    )}
                  </div>
                );
              })
          }
        </div>

        <h3 className="modalSheet__sectionTitle">Synopsis</h3>
        <p className="modalSheet__overview">{overview}</p>
      </div>
    </div>
  );
}
