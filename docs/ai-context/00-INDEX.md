# Project Knowledge Index

Persistent knowledge base for Movie Helper. Plain Markdown — readable by Claude Code,
Obsidian (open `docs/ai-context` as a vault), your editor, and Git.

## Core context

- [[01-PRODUCT]] — Purpose, the room/session flow and scoring rules the code enforces
- [[02-ARCHITECTURE]] — FastAPI + React, in-memory state, ports, run/deploy
- [[03-DECISIONS]] — Confirmed decisions (append-only)
- [[04-CURRENT-STATE]] — What exists now, verified
- [[05-NEXT-STEPS]] — Prioritised remaining work
- [[06-KNOWN-ISSUES]] — Bugs, limitations, technical debt

## Reading rules

Read 01, 02, 04 and 05 in full at the start of a session; **grep** 03 and 06 for the area you
are touching. Live repo facts come from `.claude/hooks/context_facts.py`, never from a doc.

## Detailed documentation (read on demand)

| Document | When to read it |
|---|---|
| `CLAUDE.md` | Conventions (Pydantic v2, uuid IDs, plain-CSS design system, TMDB attribution). Its "Top 3 by vote" description predates the phased flow — see [[06-KNOWN-ISSUES]] KI-001 |
| `README.md` | Setup and TMDB key; "How it works" is v2-era |
| `docs/superpowers/specs/2026-05-12-tmdb-integration-design.md` | v2 genre-swipe redesign spec: why the Wavelength mechanic was retired, Polaroid Stack design language. Its scoring (2/1/0) and rounds are superseded by code |
| `docs/superpowers/plans/2026-05-12-genre-swipe-redesign.md` | 12-task implementation plan (historical) |
| `deploy.py` docstring | the VPS deploy steps |

Plans are **historical records**, not specifications.

## Session history

`sessions/` holds dated notes — chronological records, **not specifications**. Read them only
to learn *why* something changed.
