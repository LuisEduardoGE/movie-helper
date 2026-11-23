import { useState } from "react";
import { Film } from "lucide-react";
import { posterUrl } from "../lib/tmdb";

type Props = {
  posterPath: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
};

export function PosterImage({ posterPath, alt, size = "md" }: Props) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const url = posterUrl(posterPath, size);

  if (!url || errored) {
    return (
      <div className="polaroid__placeholder">
        <Film size={48} />
      </div>
    );
  }
  return (
    <>
      {!loaded && <div className="posterSkeleton" aria-hidden />}
      <img
        src={url}
        alt={alt}
        className={loaded ? "posterImg--loaded" : "posterImg--loading"}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </>
  );
}
