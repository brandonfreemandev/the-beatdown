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
npm run preview    # local preview in Workers runtime (needs .dev.vars)
npm run deploy     # build + deploy to Cloudflare Workers
```

See **`docs/deploy-cloudflare.md`** for hosting setup (secrets, OAuth redirects, custom domain).

Supabase and Google OAuth credentials go in `.env.local` for local dev (never committed). Copy `.dev.vars.example` → `.dev.vars` for `npm run preview`. The studio works signed-out as a guest; auth is required for Arena voting and submissions.

### Bot tracks & Arena bootstrap

Four bot producers seed the Arena when human traffic is low (bootstrap seeds seven bots; unmatched submissions pair ELO-sorted):

| Bot | Track file | Submission |
|-----|------------|------------|
| Claude Sonnet 5 | `lib/sonnetTrack.ts` | Hot Jam |
| Cursor Fable 5 | `lib/fableTrack.ts` | Block Party |
| Cursor Composer 2.5 Fast | `lib/composerTrack.ts` | Sidechain City |
| Neon Drift | `lib/sparkTrack.ts` | Neon Drift |
| Gridlock | `lib/demoTrack.ts` | Concrete Floors |
| Pulse Unit | `lib/sonnetTrack.ts` | Afterimage |
| ZCode GLM 5.3 | `lib/zcodeTrack.ts` | Ship It |

```bash
npx tsx scripts/validate-demo.ts      # validate all track JSON shape
npx tsx scripts/seed-bot.ts           # seed/update bot submissions
npx tsx scripts/bootstrap-arena.ts    # seed bots + pair active battles
npx tsx scripts/repair-profile-stats.ts  # fix submissions_count / votes_cast drift
```

**Load Demo Track** (profile dropdown) loads `lib/demoTrack.ts` — "Block Party", a human-style session with named vault patterns per module and a 48s arrangement of 4s blocks.

## Design

Mondrian-Brutalist: rectangles only, no rounded corners, no shadows, no gradients,
monospace everywhere. Light and dark themes are driven by semantic CSS variables in
`app/globals.css` (`--bd-ink`, `--bd-bg`, …) — never hardcode a color; see the theming
section in `docs/agent_handoff.md`. Custom Bauhaus scrollbars on scrollable regions.

## Docs

- `docs/agent_handoff.md` — **the living engineering handoff** (architecture, key files, DB schema, theming rules, next steps)
- `docs/VISION.md` — high-level product scope
- `docs/council-transcript.md` — design council decisions (source of truth for aesthetics)
- `docs/HANDOFF.md` — historical Sprint 1–2 snapshot (superseded)
