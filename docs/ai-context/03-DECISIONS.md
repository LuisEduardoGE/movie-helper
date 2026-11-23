# Decisions

Append-only. To change a decision, add a new entry and mark the old one
`Superseded by DEC-nnn` — never edit an accepted entry in place. Only decisions that
constrain future work belong here. Dates are from git history.

## DEC-001 — Retire the Wavelength mechanic for a genre-swipe flow (2026-05-12)
**Context:** The spectrum/target game didn't help people decide what to watch
(`docs/superpowers/specs/2026-05-12-tmdb-integration-design.md`).
**Decision:** Rooms + join-by-code kept; rounds/spectrum/target removed; TMDB genre-filtered
swipe deck with like/maybe/dislike/seen.

## DEC-002 — In-memory state, polling, single server-side cursor (2026-05-12)
**Decision:** No DB; clients poll `GET /api/rooms/{code}` (2.5 s, 1.5 s while swiping); one
cursor per session so every client shows the same card.
**Consequences:** Backend restart (or deploy) wipes live rooms; single process only.

## DEC-003 — Votes rejected outside `swiping` (2026-05-12)
**Decision:** The state machine must reject votes when state ≠ `swiping` — `CLAUDE.md`:
"don't loosen it".

## DEC-004 — Plain CSS "Polaroid Stack" design system (2026-05-12)
**Decision:** CSS variables in `frontend/src/styles.css`; no Tailwind / styled-components.

## DEC-005 — Phased elimination + head-to-head finale, weighted scoring (2026-05-12/13)
**Context:** Commits "multi-phase elimination + head-to-head finale" and "genre yes/no
swipe, pairwise maybes, fixed scoring".
**Decision:** Fixed 12-card deck, pairwise maybes, narrow round, head-to-head; weighted
scores in `_weighted_score`. Supersedes the spec's 2/1/0 scoring and configurable rounds.

## DEC-006 — TLS: OS trust store by default, insecure only by explicit opt-out (2026-05-12, 2026-07-22)
**Decision:** truststore for TMDB and CDNs; `MOVIE_HELPER_INSECURE_TLS=1` is the only way to
disable verification. Image proxy restricted to an allowlist (SSRF).
