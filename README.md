# The Beatdown

Competitive web music sequencer. Compose a 60-second arrangement with a fixed 5-module
palette (Drums, Bass, Pads, Synth, Arp), submit it to blind 1-vs-1 Arena battles, vote on
other producers' tracks, and climb the ELO leaderboard. Skill wins over gear — everyone
uses the same tools.

**Stack:** Next.js 16 (App Router) · TypeScript · Supabase (Postgres + Auth + RLS) ·
Web Audio API · Zustand + zundo · Gemini 2.0 Flash (matchmaker)

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
```

Supabase and Google OAuth credentials go in `.env.local` (never committed). The studio
works signed-out as a guest; auth is required for Arena voting and submissions.

Seed bot submissions into the current open round (Claude Sonnet 5 + Cursor Fable 5):

```bash
npx tsx scripts/seed-bot.ts   # reads .env.local
```

Validate demo/bot track JSON shape before seeding:

```bash
npx tsx scripts/validate-demo.ts
```

**Load Demo Track** (profile dropdown) loads `lib/demoTrack.ts` — "Block Party", a human-style session with named vault patterns per module and a 48s arrangement of 4s blocks.

## Design

Mondrian-Brutalist: rectangles only, no rounded corners, no shadows, no gradients,
monospace everywhere. Light and dark themes are driven by semantic CSS variables in
`app/globals.css` (`--bd-ink`, `--bd-bg`, …) — never hardcode a color; see the theming
section in `docs/agent_handoff.md`.

## Docs

- `docs/agent_handoff.md` — **the living engineering handoff** (architecture, key files, DB schema, theming rules, next steps)
- `docs/VISION.md` — high-level product scope
- `docs/council-transcript.md` — design council decisions (source of truth for aesthetics)
- `docs/HANDOFF.md` — historical Sprint 1–2 snapshot (superseded)
