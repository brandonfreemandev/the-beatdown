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
`moduleSettings: Record<ModuleType, { res: number, pan: number }>` in Zustand. Each module tab has independent res/pan, persisted across tab switches and page reloads.

---

## Key Files

| Path | Purpose |
|------|---------|
| `lib/store.ts` | Zustand store — grids, vaults, timeline, BPM, moduleSettings, undo, persist |
| `lib/usePlayback.ts` | Dual transport (pattern + arrangement playback) |
| `lib/audioEngine.ts` | Web Audio signal chain, drum samples, preview |
| `lib/useUndoShortcuts.ts` | Cmd/Ctrl+Z / Shift+Z undo/redo keyboard bindings |
| `lib/supabase/types.ts` | All DB types — Profile, Round, Submission, Match, Vote, ArrangementData |
| `components/BeatdownShell.tsx` | Main studio layout — fetches user, isAdmin, votesCast |
| `components/TransportBar.tsx` | Studio top bar — nav, submit button (shows gatekeeper state), profile dropdown |
| `components/ModuleControls.tsx` | Knob row (Filter, Res, Pan, Vol, BPM, Play) — all per-module |
| `components/VaultPanel.tsx` | Pattern vault — add/delete/duplicate/rename, auto-save |
| `components/ArrangementTimeline.tsx` | Timeline editor — drag blocks, clickable ruler, draggable playhead, loop toggle |
| `components/ArenaPlayer.tsx` | Mini playback player for Arena match cards |
| `components/ProfileButton.tsx` | User dropdown — save/load session JSON, new session, sign out, admin panel |
| `components/SiteHeader.tsx` | Nav header for Arena/Leaderboard pages |
| `app/page.tsx` | Studio (client-only, BeatdownShell dynamic import) |
| `app/arena/page.tsx` + `ArenaClient.tsx` | Arena — How It Works card, match cards, voting, vote bar, matchmaker |
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
- `profiles.is_admin` — boolean, default false. Added manually via SQL. Managed via admin panel.
- `profiles.elo_rating` — starts 1000, updated by `resolve_match()`
- `profiles.votes_cast` — incremented by trigger on each vote insert
- `rounds.status` — `'open' | 'matching' | 'closed'`

Key logic:
- `resolve_match(p_match_id, p_winner_id)` — Postgres fn, K=32 ELO, marks match resolved
- `handle_new_user()` trigger — creates profile on auth.users insert (may not fire on OAuth; submit route has explicit fallback)
- **Gatekeeper** — user must cast `ceil(entry_count / 2)` votes before submitting. Currently effectively 3 votes (`MIN_VOTES_TO_RESOLVE = 3` in `app/api/vote/route.ts`).
- **Auto-resolve** — vote route calls `resolve_match()` once total votes ≥ 3 with a clear leader

---

## Gatekeeper UX

The vote requirement is surfaced in two places so users aren't surprised:

1. **SUBMIT button** in TransportBar — goes grey with `VOTE 0/3 FIRST` label when `votesCast < 3`. Tooltip shows exact count needed. Fetched from profiles in BeatdownShell.
2. **HOW IT WORKS card** on Arena page — step 2 explicitly says "Vote on 3 tracks to unlock submission."

To change the threshold: update `MIN_VOTES_TO_RESOLVE` in `app/api/vote/route.ts` and `VOTES_REQUIRED` in `components/TransportBar.tsx`.

---

## Admin Panel

In profile dropdown (⚙ ADMIN), visible only to `is_admin = true` users.

- Open/close rounds
- Promote/demote users to admin (own row is disabled — can't self-demote)

To grant admin via SQL:
```sql
UPDATE profiles SET is_admin = true WHERE username = 'Their Name';
```

---

## Design System

**Mondrian-Brutalist.** Non-negotiable:
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
- **3-vote auto-resolve** — low threshold for early testing, easy to raise
- **Both panels open by default** for new sessions — returning users keep localStorage state
- **Google OAuth** profile creation trigger may not fire; submit route has explicit fallback
- **Credentials file** `docs/supabase and google oauth info.md` is `.gitignore`d — never commit it
- Service role key was rotated after a security incident; publishable + Google AI keys left (low risk, user decision)

---

## What's Done

- [x] Step sequencer (16-step, 8-row, 5 modules)
- [x] Dual transport (pattern loop + arrangement playback)
- [x] Vault (save/load/rename/duplicate patterns, auto-save on switch)
- [x] Arrangement timeline (drag blocks, clickable ruler to seek, draggable playhead, loop toggle)
- [x] Undo/redo (Cmd+Z / Shift+Z, 40 steps)
- [x] Session persistence (localStorage) + JSON export/import
- [x] Web Audio signal chain — filter, res, pan, vol all per-module, persisted
- [x] WAV drum samples via AudioBufferSourceNode
- [x] Google OAuth + Supabase Auth
- [x] Gatekeeper — vote requirement surfaced on SUBMIT button + HOW IT WORKS card
- [x] Track submission with title
- [x] Arena — How It Works card, match cards, voting, colored vote bar, resolved state with winner
- [x] Auto-resolve matches at 3 votes — ELO updates automatically
- [x] Leaderboard — ELO rankings, top-3 podium, stats header, tier badges
- [x] Gemini 2.0 Flash matchmaker
- [x] ELO rating system (Postgres `resolve_match()`, K=32)
- [x] Admin panel — round management + user admin toggle, self-demotion guard
- [x] Per-module pan + res stored in Zustand, persisted

---

## Possible Next Steps

- **ArenaPlayer full arrangement playback** — currently plays flat grid, not the actual timeline sequence. Would need to ship `timeline` data inside the `arrangement` JSON on submit.
- **Raise vote threshold** — `MIN_VOTES_TO_RESOLVE` in `app/api/vote/route.ts` + `VOTES_REQUIRED` in `components/TransportBar.tsx`
- **Round auto-close** — cron or Supabase scheduled fn to close rounds after N days
- **Push notifications / email** — notify on new match or result
- **First-time Studio onboarding** — panels open by default is in place; a "?" help overlay would be the next step
