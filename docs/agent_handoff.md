# The Beatdown — Agent Handoff

**Last updated:** 2026-06-29  
**Status:** Sprint 3 complete. MVP ready for first real users.

---

## What This Is

Competitive web music sequencer. Users compose 60-second arrangements using a fixed 5-module palette (Drums, Bass, Pads, Synth, Arp), submit to blind 1-vs-1 Arena battles, and vote on each other's tracks. ELO ratings update automatically after matches resolve.

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
Persisted: `grids`, `vaults`, `timeline`, `bpm`, `moduleSettings`.  
Undo tracks: `grids`, `vaults`, `timeline`.

### Dual Transport (`lib/usePlayback.ts`)
- **Pattern PLAY** — loops active module's working grid only
- **PLAY ARR** — sequences timeline blocks; reads live working grid for active pattern, vault `pattern.grid` for others
- Mutually exclusive. All interval callbacks use refs to prevent stale closures.

### Pattern Instance Architecture
Timeline stores `{ patternId, moduleType, startSec, durationSec }` — ID references, not audio data. Vault patterns own the grids.

### Per-Module Settings
`moduleSettings: Record<ModuleType, { res: number, pan: number }>` in Zustand store. Each module tab has independent res/pan that persists across tab switches and page reloads.

---

## Key Files

| Path | Purpose |
|------|---------|
| `lib/store.ts` | Zustand store — grids, vaults, timeline, BPM, moduleSettings, undo, persist |
| `lib/usePlayback.ts` | Dual transport (pattern + arrangement playback) |
| `lib/audioEngine.ts` | Web Audio signal chain, drum samples, preview |
| `lib/useUndoShortcuts.ts` | Cmd/Ctrl+Z / Shift+Z undo/redo keyboard bindings |
| `lib/supabase/types.ts` | All DB types — Profile, Round, Submission, Match, Vote, ArrangementData |
| `components/BeatdownShell.tsx` | Main studio layout shell — fetches user + isAdmin |
| `components/TransportBar.tsx` | Studio top bar — nav, submit button, profile dropdown |
| `components/ModuleControls.tsx` | Knob row (Filter, Res, Pan, Vol, BPM, Play) — all per-module |
| `components/VaultPanel.tsx` | Pattern vault — add/delete/duplicate/rename, auto-save |
| `components/ArrangementTimeline.tsx` | Timeline editor with draggable playhead, loop toggle |
| `components/ArenaPlayer.tsx` | Mini playback player for Arena match cards |
| `components/ProfileButton.tsx` | User dropdown — save/load session JSON, new session, sign out, admin panel |
| `components/SiteHeader.tsx` | Nav header for Arena/Leaderboard pages |
| `app/page.tsx` | Studio (client-only, BeatdownShell dynamic import) |
| `app/arena/page.tsx` + `ArenaClient.tsx` | Arena — match cards, voting, vote bar, matchmaker trigger |
| `app/leaderboard/page.tsx` | ELO leaderboard — top-3 podium, stats header, tier badges |
| `app/api/submit/route.ts` | Track submission — profile auto-create, Gatekeeper vote gate |
| `app/api/matchmaker/route.ts` | Gemini 2.0 Flash matchmaker — pairs submissions into matches |
| `app/api/vote/route.ts` | Vote casting — auto-resolves match + updates ELO at 3 votes |
| `app/api/admin/route.ts` | Admin API — open/close rounds, toggle user admin status |
| `app/auth/callback/route.ts` | Google OAuth callback |
| `supabase/schema.sql` | Full DB schema — tables, RLS, triggers, `resolve_match()` ELO fn |
| `public/samples/drums/` | 8 WAV drum samples (kick × 2, snare × 2, hat × 4) |

---

## Database Schema (Supabase)

Tables: `profiles`, `rounds`, `submissions`, `matches`, `votes`

Key columns:
- `profiles.is_admin` — boolean, default false. Added manually. Set via admin panel.
- `profiles.elo_rating` — starts 1000, updated by `resolve_match()`
- `rounds.status` — `'open' | 'matching' | 'closed'`

Key logic:
- `resolve_match(p_match_id, p_winner_id)` — Postgres function, K=32 ELO, marks match resolved
- `handle_new_user()` trigger — creates profile on auth.users insert (may not fire on OAuth; submit route has explicit fallback check-then-insert)
- Gatekeeper: must have cast `ceil(entry_count / 2)` votes before submitting
- Auto-resolve: vote route calls `resolve_match()` once total votes ≥ 3 with a clear leader

---

## Admin Panel

Accessible only to `is_admin = true` users via the profile dropdown (⚙ ADMIN).

Features:
- **Open New Round** — closes any open round first, then opens a new one
- **Close Round** — manually closes the current open round
- **Admin toggles** — promote/demote any user to admin. Your own row is disabled (can't self-demote).

To grant admin to a new user, run in Supabase SQL Editor:
```sql
UPDATE profiles SET is_admin = true WHERE username = 'Their Name';
```
Or use the admin panel toggle once you're logged in as admin.

---

## Design System

**Mondrian-Brutalist.** Non-negotiable rules:
- Background: `#f9f9f7`
- Borders: `3px solid #000` everywhere, NO rounded corners, NO shadows, NO gradients
- Module colors: Drums `#e8212b`, Bass `#74b9f3`, Pads `#6abf3a`, Synth `#ffb300`, Arp `#00a693`
- Arena track colors: A `#74b9f3`, B `#ffb300`
- Font: monospace throughout, ALL CAPS labels, tight letter-spacing

---

## Drum Sample Row Mapping

```
0: kick-soft   1: kick-hard
2: snare-1     3: snare-2
4: hat-ghost   5: hat-closed-1   6: hat-closed-2   7: hat-open
```
WAV files in `public/samples/drums/`.

---

## Known Constraints & Decisions

- **No WAV export** — intentional, ruled out as too complex for MVP
- **Time signatures fixed at 4/4, 16 steps** — variable GRID_STEPS deferred
- **3-vote auto-resolve** — low threshold for early testing, easy to raise in `app/api/vote/route.ts` (`MIN_VOTES_TO_RESOLVE`)
- **Google OAuth** creates profiles via trigger; submit route has explicit check-then-insert fallback
- **Credentials file** `docs/supabase and google oauth info.md` is `.gitignore`d — never commit it
- Service role key was rotated after a security incident; publishable key and Google AI key were left (low risk, user decision)
- **Both panels open by default** for new sessions (vault + arrangement timeline) — returning users keep their last state via localStorage

---

## What's Done

- [x] Step sequencer (16-step, 8-row, 5 modules)
- [x] Dual transport (pattern loop + arrangement playback)
- [x] Vault (save/load/rename/duplicate patterns, auto-save on switch)
- [x] Arrangement timeline (drag blocks, draggable playhead, loop toggle)
- [x] Undo/redo (Cmd+Z / Shift+Z, 40 steps)
- [x] Session persistence (localStorage) + JSON export/import via profile dropdown
- [x] Web Audio signal chain with filter, resonance, pan, volume knobs — all per-module
- [x] WAV drum samples via AudioBufferSourceNode
- [x] Google OAuth + Supabase Auth
- [x] Track submission with title + Gatekeeper vote gate
- [x] Arena: match cards, voting, colored vote bar, post-vote percentages, resolved state with winner highlight
- [x] Auto-resolve matches at 3 votes — ELO updates automatically
- [x] Leaderboard: ELO rankings, top-3 podium (🥇🥈🥉), stats header, tier badges
- [x] Gemini 2.0 Flash matchmaker
- [x] ELO rating system (Postgres `resolve_match()` function, K=32)
- [x] Admin panel in profile dropdown — round management + user admin toggle
- [x] Per-module pan + res stored in Zustand, persisted to localStorage

## Possible Next Steps

- **ArenaPlayer full arrangement playback** — currently plays the flat grid loop, not the actual timeline sequence the producer composed. Would need to ship `timeline` data inside the `arrangement` JSON on submit.
- **Raise vote threshold** — change `MIN_VOTES_TO_RESOLVE = 3` in `app/api/vote/route.ts` once real traffic arrives
- **Round auto-close** — cron job or Supabase scheduled function to close rounds after N days
- **Push notifications / email** — notify producers when they get a new match or a result
- **First-time user onboarding** — both panels open by default is in place; a single "?" help overlay (one modal, no state) would cover discoverability without a full tour
