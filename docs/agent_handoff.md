# The Beatdown — Agent Handoff

**Last updated:** 2026-09-24  
**Status:** MVP live on Cloudflare Workers (via OpenNext). Arena bootstrapped with 7 bot tracks, gatekeeper v2 (capped at 3 votes, aware of active battles), auto-pairing after submit/resolve, leaderboard dedupe, hardened OAuth callback. Hosting docs: `docs/deploy-cloudflare.md`.

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
| `lib/useTrackPlayback.ts` | Shared playback hook for submitted arrangements (ArenaPlayer + leaderboard rows) |
| `lib/audioEngine.ts` | Web Audio signal chain, drum samples, preview |
| `lib/knobMapping.ts` | Knob 0–1 value → engine parameter mappings (shared by UI + track playback) |
| `lib/demoTrack.ts` | Bundled demo arrangement ("Block Party") — Load Demo Track menu item |
| `lib/sonnetTrack.ts` | Claude Sonnet 5 bot submission (simpler single-block layout) |
| `lib/fableTrack.ts` | Re-exports `DEMO_TRACK` for Cursor Fable 5's Arena submission |
| `lib/composerTrack.ts` | Cursor Composer 2.5 Fast bot — "Sidechain City" (108 BPM, multi-pattern) |
| `lib/sparkTrack.ts` | Neon Drift bot — "Neon Drift" (94 BPM lo-fi, 4th matchmaking entrant) |
| `lib/gatekeeper.ts` | `votesRequired(entryCount, activeBattleCount?)` — shared submit gate, mirrors submit API. Capped at 3 votes; when battle count is passed, never exceeds votable active battles (0 battles → 0 required) |
| `lib/pairUnmatched.ts` | ELO-sorted pairing of unmatched submissions in the open round; called after submit + after match auto-resolve |
| `lib/dedupeRankings.ts` | Collapses leaderboard rows sharing a display name (duplicate Google accounts); keeps best-scored row |
| `lib/authSignIn.ts` | Google OAuth sign-in helper — validates public Supabase config, redirects via `authCallbackUrl()` |
| `lib/siteUrl.ts` | `authCallbackUrl()` — browser origin on client, `NEXT_PUBLIC_SITE_URL` on server |
| `middleware.ts` | Supabase session refresh. **Legacy `middleware` convention, kept intentionally** — OpenNext does not support Next 16 `proxy.ts` yet (build shows a deprecation warning; expected) |
| `wrangler.jsonc` / `open-next.config.ts` | Cloudflare Workers config — see `docs/deploy-cloudflare.md` |
| `lib/ensureProfile.ts` | Creates profile on first vote/submit if OAuth trigger missed; disambiguates duplicate display names |
| `lib/useUndoShortcuts.ts` | Cmd/Ctrl+Z / Shift+Z undo/redo keyboard bindings |
| `lib/supabase/types.ts` | All DB types — Profile, Round, Submission, Match, Vote, ArrangementData |
| `components/BeatdownShell.tsx` | Main studio layout — fetches user, isAdmin, votesCast |
| `components/SiteNav.tsx` | Shared nav bar — logo, links, dynamic gatekeeper threshold |
| `components/ModuleControls.tsx` | Knob row (Vol, Cutoff, Decay, Attack, Res, Pan) + BPM/play + vault dropdown |
| `components/VaultPanel.tsx` | Pattern vault — add/delete/duplicate/rename, auto-save |
| `components/ArrangementTimeline.tsx` | Timeline editor — drag blocks, clickable ruler, draggable playhead, loop toggle |
| `components/ArenaPlayer.tsx` | Mini playback player for Arena match cards — plays the real timeline sequence |
| `components/ProfileButton.tsx` | User dropdown — submit, save/load session, demo track, dark mode toggle, admin panel, sign out |
| `app/page.tsx` | Studio (client-only, BeatdownShell dynamic import) |
| `app/layout.tsx` | Root layout — `data-theme` attribute + pre-paint theme script (no flash) |
| `app/arena/page.tsx` + `ArenaClient.tsx` | Arena — How It Works card, match cards, voting, vote bar, matchmaker |
| `app/leaderboard/page.tsx` + `LeaderboardClient.tsx` | ELO leaderboard — podium, stats, tier badges, per-row track playback, collapsible rows that expand into a live sequencer preview (`SequencerPreview`), **WON** column (arena votes received) |
| `scripts/seed-bot.ts` | Seeds all 4 bot users/submissions (reads `.env.local`, update-in-place; does not reset ELO/stats on re-run) |
| `scripts/bootstrap-arena.ts` | Seeds bots, clears resolved matches in open round, ELO-pairs unmatched subs into active battles |
| `scripts/repair-profile-stats.ts` | Syncs `submissions_count` + `votes_cast` from source tables after bot re-seeds |
| `scripts/validate-demo.ts` | Structural validation for all bundled/bot track files |
| `app/api/submit/route.ts` | Track submission — `ensureProfile`, dynamic Gatekeeper vote gate |
| `app/api/vote/route.ts` | Vote casting — `ensureProfile`, re-reads match counts, auto-resolves + ELO at 3 votes |
| `app/api/matchmaker/route.ts` | Gemini 2.0 Flash matchmaker — pairs submissions into matches |
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
- `profiles.votes_cast` — incremented by trigger on each vote **cast** (gatekeeper stat, shown in Arena)
- `rounds.status` — `'open' | 'matching' | 'closed'`

Key logic:
- `resolve_match(p_match_id, p_winner_id)` — Postgres fn, K=32 ELO, marks match resolved
- `handle_new_user()` trigger — creates profile on auth.users insert (may not fire on OAuth; `ensureProfile()` in vote + submit routes)
- **Gatekeeper** — user must cast `votesRequired(entry_count, active_battles)` votes before submitting: `min(ceil(entry_count / 2), 3, active_battles)`; 0 when no active battles exist. Wired via `lib/gatekeeper.ts` in SiteNav, BeatdownShell, Arena, Leaderboard, and submit API. Active-battle count is a `matches` head-count query (`status = 'active'`) on Arena, Leaderboard, BeatdownShell (global) and submit API (round-scoped).
- **Auto-pairing** — `lib/pairUnmatched.ts` runs after every submission and after match auto-resolve, so freed tracks re-enter the pool without running the matchmaker by hand.
- **Bootstrap** — `scripts/bootstrap-arena.ts` seeds **seven** bots and reports the same capped gatekeeper number.
- **Auto-resolve** — vote route re-reads match counts after insert, then calls `resolve_match()` once total votes ≥ 3 with a clear leader
- **Service client** — `createServiceClient()` uses `@supabase/supabase-js` directly (SSR wrapper blocked profile writes)

---

## Gatekeeper UX

**⏸ Temporarily disabled for onboarding** — `GATEKEEPER_ENABLED = false` in `lib/gatekeeper.ts`
(submit open to everyone, gate UI hidden). To reinstate: flip it to `true` and `npm run deploy`.

The vote requirement is surfaced in two places so users aren't surprised:

1. **SUBMIT TRACK item** in the ProfileButton dropdown — goes grey with a `VOTE n/m FIRST TO UNLOCK` sub-label when `votesCast < votesRequired(entry_count)`. Threshold fetched from open round in BeatdownShell / SiteNav.
2. **HOW IT WORKS card** on Arena page — step 2 uses dynamic vote count. Collapsed by default so battles are visible without scrolling.

To change the gatekeeper formula: update `votesRequired()` in `lib/gatekeeper.ts` (submit API imports it). Match auto-resolve threshold is separate: `MIN_VOTES_TO_RESOLVE` in `app/api/vote/route.ts`.

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
- NO rounded corners, NO shadows, NO gradients
- 3px borders for primary frames, 2px for internal elements
- Module colors: Drums `#e8212b`, Bass `#74b9f3`, Pads `#6abf3a`, Synth `#ffb300`, Arp `#00a693`
- Arena track colors: A `#74b9f3`, B `#ffb300`
- Font: monospace throughout, ALL CAPS labels, tight letter-spacing

### Theming (light/dark)

All colors are semantic CSS variables defined in `app/globals.css` under `:root` (light)
and `[data-theme='dark']`. **Never hardcode a hex** in components — use the tokens:

| Token | Meaning |
|---|---|
| `--bd-bg` / `--bd-bg-alt` | Page background / zebra rows (`#f9f9f7` light, `#161614` dark) |
| `--bd-ink` | What used to be black — borders, text, solid blocks (flips to near-white in dark) |
| `--bd-on-ink` / `--bd-on-ink-muted` | Text sitting on ink-colored blocks |
| `--bd-muted` / `--bd-faint` / `--bd-hint` | Secondary/tertiary/inactive text |
| `--bd-ink-wash` | Hover/active wash (`rgba` in both themes) |
| `--bd-red` | Mondrian red accent (same in both themes) |
| `--bd-field`, `--bd-cell`, `--bd-cell-head`, `--bd-hairline`, `--bd-line`, `--bd-grid-line` | Inputs, mini-grid cells, light rules |

Rules of thumb:
- **Fixed accents don't flip**: module colors, red, medal golds, tier badges stay identical
  in both themes, and text placed on them stays literal `#000`/`#fff` (see module tabs,
  timeline blocks, vote buttons, podium rows for the pattern).
- Inline styles consume the variables directly (`color: 'var(--bd-ink)'`) — no class needed.
- SVG presentation attributes can't take `var()`; use `currentColor` or a `style` prop.
- Theme state: `data-theme` on `<html>`, persisted to `localStorage.theme`. A synchronous
  inline script in `app/layout.tsx` applies it before first paint (no flash). Toggle lives
  in the ProfileButton dropdown (signed-in users only).
- **Scrollbars** — Bauhaus/Mondrian custom scrollbars on `.page-scroll`, `.seq-area`, `.bd-scroll` (square ink thumb, red hover, 3px track frame).
- **Arena / Leaderboard layout** — `.page-shell` (fixed `100dvh`) + `.page-scroll` (scrollable content below nav). Studio stays `100vh` + internal scroll.

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
- **Google OAuth** profile creation trigger may not fire; `lib/ensureProfile.ts` handles vote + submit (uses service-role client; disambiguates duplicate display names with email tag)
- **Leaderboard WON column** — counts arena votes **received** on a producer's submissions (not `votes_cast`). Bots show earned votes even though they never cast any.
- **Bot re-seed** — `seed-bot.ts` / `bootstrap-arena.ts` update username only on existing profiles; no longer zero out `elo_rating` / `submissions_count`. Run `repair-profile-stats.ts` if counts drift.
- **Dev server OOM** — if `next dev` burns CPU at idle and climbs to `JavaScript heap out of memory`, the `.next` Turbopack cache is corrupted (vicious cycle: OOM crash corrupts cache → next boot spins). `rm -rf .next` fixes it. The OpenNext dev initializer is gated behind `NEXT_DEV_CLOUDFLARE_BINDINGS=1` — app code never reads Cloudflare bindings in dev.
- **Credentials file** `docs/supabase and google oauth info.md` is `.gitignore`d — never commit it
- Service role key was rotated after a security incident; publishable + Google AI keys left (low risk, user decision)
- **Session load grid sync** — `ProfileButton.applySessionData` sets each module's working `grids[m]` from that vault's `activePatternId` before entering the store. `loadPatternToGrid` auto-saves the current grid into the active vault pattern on switch; if `grids` and `activePatternId` disagree (e.g. old demo snapshots), the first dropdown click would corrupt vault data and make patterns look identical
- **Demo / bot track shape** — `lib/demoTrack.ts` ("Block Party") uses multiple named 16-step patterns per module and standard 4s timeline blocks (`durationBeats: 8` @ 120 BPM). Bot tracks: `sonnetTrack`, `fableTrack` (demo re-export), `composerTrack`, `sparkTrack`. Non-120 BPM tracks use block-index ranges to avoid timeline overlap.

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
- [x] Full-fidelity arrangement playback — submissions carry `vaults` + `timeline` + `moduleSettings`, so Arena/leaderboard playback matches what the producer heard (older flat-grid submissions fall back gracefully)
- [x] Leaderboard per-row play buttons — hear any producer's latest track in place
- [x] Bundled demo track (`lib/demoTrack.ts`) — multi-pattern "Block Party" arrangement, Load Demo Track menu item
- [x] Bot submissions via `scripts/seed-bot.ts` — Sonnet 5, Fable 5, Composer 2.5 Fast, Neon Drift
- [x] Arena bootstrap script (`scripts/bootstrap-arena.ts`) — seed 4 bots, clear resolved matches, pair active battles
- [x] Session/vault grid sync on load — distinct patterns visible in vault dropdown after Load Demo Track
- [x] Dark mode — semantic CSS variable palette, dropdown toggle, localStorage persistence, no-flash inline script
- [x] Sequencer min-height row floor — short windows scroll instead of crushing rows
- [x] Arena/Leaderboard scroll — pinned nav, scrollable battle list, Mondrian scrollbars
- [x] Dynamic gatekeeper — `lib/gatekeeper.ts` synced across UI + submit API
- [x] OAuth profile bootstrap — `ensureProfile()` on vote + submit; service-role client fix
- [x] Leaderboard WON column — arena votes received per producer (bots tally correctly)
- [x] Vote resolution fix — re-read match counts post-trigger; surface `resolve_match` errors

---

## Possible Next Steps

- **Theme toggle for signed-out users** — the toggle lives in the profile dropdown, which only renders when signed in; a small standalone nav toggle would cover guests
- **Continue inline-style → class refactor** — colors are all tokenized now, but ~200 `style={{}}` blocks remain; `globals.css` shows the established pattern (static styling in classes, only dynamic values inline)
- **Raise vote threshold** — `MIN_VOTES_TO_RESOLVE` in `app/api/vote/route.ts`; gatekeeper formula in `lib/gatekeeper.ts`
- **Round auto-close** — cron or Supabase scheduled fn to close rounds after N days
- **Push notifications / email** — notify on new match or result
- **First-time Studio onboarding** — panels open by default is in place; a "?" help overlay would be the next step
