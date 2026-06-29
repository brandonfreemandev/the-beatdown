# The Beatdown — Agent Handoff

**Last updated:** 2026-06-28  
**Status:** Sprint 3 complete — Arena + Leaderboard polished. Production-ready MVP.

---

## What This Is

Competitive web music sequencer. Users compose 60-second arrangements using a fixed 5-module palette (Drums, Bass, Pads, Synth, Arp), submit to blind 1-vs-1 Arena battles, and vote on each other's tracks. ELO ratings update after each resolved match.

**Stack:** Next.js 16 (App Router) · TypeScript · Supabase (Postgres + Auth + RLS) · Web Audio API · Zustand + zundo · Google Generative AI (Gemini 2.0 Flash)

---

## Architecture

### Signal Chain (Web Audio API)
```
Oscillator → BiquadFilter → GainNode → StereoPannerNode → Destination
Drums: AudioBufferSourceNode (WAV) → GainNode → Destination
```

### Store (`lib/store.ts`)
Zustand wrapped with `temporal` (zundo, 40-step undo) and `persist` (localStorage key `beatdown-session-v1`).  
Persisted: `grids`, `vaults`, `timeline`, `bpm`.  
Undo tracks: `grids`, `vaults`, `timeline`.

### Dual Transport (`lib/usePlayback.ts`)
- **Pattern PLAY** — loops active module's working grid only
- **PLAY ARR** — sequences timeline blocks; reads live working grid for active pattern, vault `pattern.grid` for others
- Mutually exclusive. All interval callbacks use refs to prevent stale closures.

### Pattern Instance Architecture
Timeline stores `{ patternId, moduleType, startSec, durationSec }` — ID references, not audio data. Vault patterns own the grids.

---

## Key Files

| Path | Purpose |
|------|---------|
| `lib/store.ts` | Zustand store — grids, vaults, timeline, BPM, undo, persist |
| `lib/usePlayback.ts` | Dual transport (pattern + arrangement playback) |
| `lib/audioEngine.ts` | Web Audio signal chain, drum samples, preview |
| `lib/useUndoShortcuts.ts` | Cmd/Ctrl+Z / Shift+Z undo/redo keyboard bindings |
| `components/BeatdownShell.tsx` | Main studio layout shell |
| `components/ModuleControls.tsx` | Knob row (Filter, Res, Pan, Vol, BPM, Play) |
| `components/VaultPanel.tsx` | Pattern vault — save/load/rename patterns |
| `components/ArrangementTimeline.tsx` | Timeline editor with draggable playhead |
| `components/ArenaPlayer.tsx` | Mini playback player for Arena match cards |
| `components/ProfileButton.tsx` | User dropdown (save/load session JSON, new session, sign out) |
| `components/SiteHeader.tsx` | Nav — Studio / Arena / Leaderboard |
| `app/arena/page.tsx` + `ArenaClient.tsx` | Arena page — match cards, voting, matchmaker trigger |
| `app/leaderboard/page.tsx` | ELO leaderboard — top-3 podium, stats header |
| `app/api/submit/route.ts` | Track submission (profile auto-create, Gatekeeper check) |
| `app/api/matchmaker/route.ts` | Gemini-powered matchmaker — pairs submissions |
| `app/api/vote/route.ts` | Vote casting |
| `app/auth/callback/route.ts` | Google OAuth callback |
| `supabase/schema.sql` | Full DB schema — tables, RLS, triggers, `resolve_match()` ELO fn |
| `public/samples/drums/` | 8 WAV drum samples (kick × 2, snare × 2, hat × 4) |

---

## Database Schema (Supabase)

Tables: `profiles`, `rounds`, `submissions`, `matches`, `votes`

Key logic:
- `resolve_match(match_id)` — Postgres function, applies ELO (K=32, start 1000)
- `handle_new_user()` trigger — creates profile on auth.users insert (may not fire on OAuth; submit route has explicit fallback)
- Gatekeeper: must have cast `ceil(entry_count / 2)` votes to submit

---

## Design System

**Mondrian-Brutalist.** Non-negotiable rules:
- Background: `#f9f9f7`
- Borders: `3px solid #000` everywhere, NO rounded corners, NO shadows, NO gradients
- Module colors: Drums `#e8212b`, Bass `#74b9f3`, Pads `#6abf3a`, Synth `#ffb300`, Arp `#9b59b6`
- Font: monospace throughout, ALL CAPS labels, tight letter-spacing

---

## Drum Sample Row Mapping

```
0: kick-soft   1: kick-hard
2: snare-1     3: snare-2
4: hat-ghost   5: hat-closed-1   6: hat-closed-2   7: hat-open
```

---

## Known Constraints

- **No WAV export** — intentional, ruled out as too complex for MVP
- **Time signatures fixed at 4/4, 16 steps** — variable GRID_STEPS deferred
- **Google OAuth** creates profiles via trigger; submit route has explicit check-then-insert fallback to handle cases where trigger doesn't fire
- **Credentials file** `docs/supabase and google oauth info.md` is `.gitignore`d — never commit it
- Service role key was rotated after a security incident; publishable key and Google AI key were left (low risk)

---

## What's Done

- [x] Step sequencer (16-step, 8-row, 5 modules)
- [x] Dual transport (pattern loop + arrangement playback)
- [x] Vault (save/load/rename patterns, auto-save)
- [x] Arrangement timeline (drag blocks, draggable playhead, loop toggle)
- [x] Undo/redo (Cmd+Z / Shift+Z, 40 steps)
- [x] Session persistence (localStorage) + JSON export/import
- [x] Web Audio signal chain with filter, resonance, pan, volume knobs
- [x] WAV drum samples via AudioBufferSourceNode
- [x] Google OAuth + Supabase Auth
- [x] Track submission with title + Gatekeeper vote gate
- [x] Arena: match display, voting, vote bar, stats panel
- [x] Leaderboard: ELO rankings, top-3 podium, stats header, tier badges
- [x] Gemini 2.0 Flash matchmaker
- [x] ELO rating system (Postgres `resolve_match()` function)

## Possible Next Steps

- Resolve matches automatically (cron or webhook) after N votes, calling `resolve_match()`
- Allow replaying arrangement from Arena player (currently plays flat grid, not full timeline sequence)
- Round management UI (open/close rounds)
- Push notifications or email on new match
