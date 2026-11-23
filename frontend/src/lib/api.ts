export type Player = { id: string; name: string; avatar: string };

export type Room = {
  code: string;
  players: Player[];
  session_id: string | null;
};

export type Genre = { id: number; name: string };

export type VoteValue = "like" | "maybe" | "dislike" | "seen";
export type Vote = { value: VoteValue; created_at: string };

export type PhaseType = "discovery" | "pairwise_maybes" | "narrow" | "head_to_head" | "revealed";

export type PairwiseMaybe = {
  a: number;
  b: number;
  picks: Record<string, number>;
};

export type Candidate = {
  tmdb_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
  overview: string;
  genre_ids: number[];
  vote_average: number;
  // phase_votes[phase][player_id] = Vote
  phase_votes: Record<string, Record<string, Vote>>;
};

export type HeadToHeadPair = {
  a: number;
  b: number;
  votes: Record<string, number>;  // player_id -> chosen tmdb_id
};

export type GenreChoice = {
  player_id: string;
  genres: number[];
  locked: boolean;
};

export type SessionState = "picking_genres" | "swiping" | "revealed";

export type Session = {
  id: string;
  room_code: string;
  state: SessionState;
  phase: PhaseType;
  choices: Record<string, GenreChoice>;
  candidates: Candidate[];
  pool: number[];
  cursor: number;
  pairwise_maybes: PairwiseMaybe[];
  pairwise_cursor: number;
  pairs: HeadToHeadPair[];
  pair_cursor: number;
  winner_tmdb_id: number | null;
  previously_shown_ids: number[];
  deck_size: number;
};

export type Top3Entry = Candidate & { score: number };

export type AvatarOption = {
  id: string;
  label: string;
  actor: string;
  image_url: string | null;  // fully-qualified URL from Wikipedia or TMDB
};

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed");
  }
  return response.json();
}
