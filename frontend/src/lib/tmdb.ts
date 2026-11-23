const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(
  path: string | null,
  size: "sm" | "md" | "lg" = "md"
): string | null {
  if (!path) return null;
  const sizeMap = { sm: "w92", md: "w342", lg: "w500" } as const;
  return `${TMDB_IMAGE_BASE}/${sizeMap[size]}${path}`;
}

export function profileUrl(path: string | null): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/w185${path}`;
}
