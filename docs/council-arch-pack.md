# I'm here because I want to build a project but a… — Council Documents

> Prepared by a three-seat agent council for an agent builder to implement from.
> 7 of 7 documents drafted · Exported 2026-10-04T16:32:05.484Z

## Council

- **Sol** — Systems Architect (`muse-spark-1.3-contributor-free`) · owns `architecture`, `data-model`, `api-contracts`
- **Mira** — Product & Scope (`ling-3.1-flash-free`) · owns `overview`, `requirements`, `implementation-plan`
- **Vera** — Risk & Feasibility (`nemotron-3-ultra-free`) · owns `risks`

## Documents

| # | Document | Owner | Status |
| --- | --- | --- | --- |
| 1 | [Project Overview](01-project-overview.md) | Mira | rev 2 · Mira · 2026-10-04 16:28 UTC |
| 2 | [Requirements](02-requirements.md) | Mira | rev 2 · Mira · 2026-10-04 16:28 UTC |
| 3 | [System Architecture](03-system-architecture.md) | Sol | rev 1 · Sol · 2026-10-04 16:25 UTC |
| 4 | [Data Model](04-data-model.md) | Sol | rev 1 · Sol · 2026-10-04 16:25 UTC |
| 5 | [Interface Contracts](05-interface-contracts.md) | Sol | rev 1 · Sol · 2026-10-04 16:25 UTC |
| 6 | [Implementation Plan](06-implementation-plan.md) | Mira | rev 1 · Mira · 2026-10-04 16:28 UTC |
| 7 | [Risks & Open Questions](07-risks-and-open-questions.md) | Vera | rev 1 · Vera · 2026-10-04 16:29 UTC |

## How to read this pack

1. Start at **Project Overview**, then **Requirements**.
2. **System Architecture**, **Data Model**, and **Interface Contracts** define the shape to build.
3. **Implementation Plan** gives the ordered slices and their done criteria.
4. **Risks & Open Questions** lists what could invalidate the plan — read before committing.

Unresolved items are written as `TBD` rather than guessed. Treat every `TBD` as a question to resolve before coding that slice.


---

<!-- 01-project-overview.md -->

# Project Overview

> Council of Agents — I'm here because I want to build a project but a…
> Owner: **Mira** · Revision 2 · Updated 2026-10-04 16:28 UTC

## Summary
The Beatdown is a competitive 60-second music battle site. Bots and humans submit short arrangements; the site pairs them into 1v1 battles; blind human visitors vote by tapping. Exactly one live battle exists site-wide at any moment. Next.js front end, Supabase Postgres for all durable state, arrangement JSON played client-side (no server render). Live at the-beatdown.brandonfreeman-dev.workers.dev.

## Problem
Every participation path so far asked the newcomer to do work before anyone was on the other side: a schema posted in a forum produced one bot and zero humans. The second failure mode was unbounded choice — with many battles listed at once, visitors asked "which one's happening" and voting order drifted. The 1v1 is the attention boundary and the name; a leaderboard with one entry is a broken UI.

## Goals
- One live, votable 1v1 battle at any moment, site-wide, with strict open → voting → closed lifecycle enforced server-side.
- A stranger lands, hears two previews, and votes within ten seconds, no reading required.
- Bot-vs-bot battles seed the queue so the site is never empty; humans join as voters without needing to create anything.
- Lifecycle, votes, and ELO survive a restart — durable in Postgres, never frontend state.
- A buffer of three validated-but-unpaired submissions, so nothing auto-advances into an empty site.

## Non-Goals
- Whole-pool poll / vote-for-everything (needs ranking that does not exist yet).
- Sybil-proof ranked voting (cookie + voterkey identity is Sybil-soft; fine for tap-votes, not for ranked play).
- Cron-based match closer (lazy 48h expiry is the chosen tradeoff — no scheduler to operate).
- Server-side audio render (invalid submissions are rejected at POST, so a failed render is a rejected submission, not an empty site).
- Multiple simultaneous live battles or an always-on multi-battle arena view.
- GLM-5.3-Flash roster addition — Brandon's call, deferred.

## Key Constraints
- Existing stack only: Next.js + Supabase Postgres. No new store, no scheduler.
- Arrangement format: 8×16 grids, 60.5-second cap, validated by `normalizeArrangement` in `lib/botSubmissions.ts`; played client-side.
- Match lifetime: 48 hours, lazy expiry from the read and vote paths (`lib/battleLifecycle.ts`, called from `app/arena/page.tsx` and `app/api/vote/route.ts`).
- Bot contract already proven end-to-end: `GET /api/bots/spec` (public, CORS, no auth) → `POST /api/bots/submit`; minimal payloads get server-side synthesis; botSecret returned once per bot.
- Active-match cap `MAX_CONCURRENT_BATTLES = 1` enforced in `lib/pairUnmatched.ts` and the matchmaker route (shipped).
- `resolve_match` idempotent via `WHERE status='active'` claim before ELO math (shipped).

## Success Criteria
- Rows in `matches` with `status='active'` never exceed one.
- A second `resolve_match` call on a resolved match scores zero rows changed.
- Stranger-vote test passes on a bot-vs-bot battle: fresh visitor → two previews → vote row inserted in under 10 seconds (baseline already held: 23+ votes, 9 distinct cookie identities).
- Buffer query shows ≥3 validated unpaired submissions in steady state; auto-advance blocked whenever it would empty the buffer.
- The six in-flight battles at the time of the cap fix wind down on their own 48h clocks with no manual close.

## Open Questions
- What keeps the queue topped up at three — manual seeding per model release, or an automated feeder? The council said "continuously" without naming the mechanism.
- GLM-5.3-Flash on the roster? Ash asked for it; the request is a demand signal, not a requirement.
- If ranked play is ever wanted, Sybil-proof identity is a prerequisite — not scoped now.
- Exact file path of the matchmaker route named in the cap gate — confirm before editing.


---

<!-- 02-requirements.md -->

# Requirements

> Council of Agents — I'm here because I want to build a project but a…
> Owner: **Mira** · Revision 2 · Updated 2026-10-04 16:28 UTC

## Functional Requirements

- **FR-1 — Single live battle.** The system must never hold more than one match with `status='active'`. *Acceptance: `SELECT count(*) FROM matches WHERE status='active'` returns ≤ 1 after any pairing operation; `pairOpenRound` and the matchmaker route refuse creation when the count is 1 (`MAX_CONCURRENT_BATTLES`).*
- **FR-2 — Server-side lifecycle.** Matches move open → voting → closed only through server paths; no client-side lifecycle state. *Acceptance: status transitions are visible in `rounds.status` / `matches`; a Worker restart mid-battle preserves state.*
- **FR-3 — Lazy 48h expiry.** Matches unresolved after 48 hours resolve via lazy expiry triggered from the arena read path and the vote path. *Acceptance: a match older than 48h is resolved on the next read or vote; no scheduler is invoked.*
- **FR-4 — Idempotent resolution.** `resolve_match` claims the row with `WHERE status='active'` before ELO math; the transaction that loses the row lock re-checks, finds zero rows, and returns unscored. *Acceptance: two concurrent resolve calls produce exactly one ELO application; `resolve_match_draw` behaves identically.*
- **FR-5 — Buffer.** The system holds a buffer of three validated-but-unpaired submissions; auto-advance is blocked whenever an advance would empty the buffer. *Acceptance: with insufficient queued submissions, no battle advances — the site holds rather than advancing into an empty queue; the buffer is observable as a query on validated unpaired submissions.*
- **FR-6 — Bot contract.** `GET /api/bots/spec` is public, CORS-enabled, unauthenticated, and returns the submission schema; `POST /api/bots/submit` accepts it; minimal payloads get server-side synthesis; a botSecret is returned once per bot. *Acceptance: a fresh bot with no prior state reads the spec and submits successfully (proven: GPT-6 Luna, Muse Spark 1.3, MiniMax-M3, and big-pickle 1.0 all entered through this contract).*
- **FR-7 — Submission validation.** `normalizeArrangement` enforces 8×16 grids and the 60.5s cap; invalid submissions are rejected at POST with no server render. *Acceptance: a malformed arrangement is rejected; a valid one becomes a Postgres row immediately.*
- **FR-8 — Anonymous voting.** Votes insert with `userid` null + `voterkey`; identity is the `bdvoter` cookie; `checkRateLimit` is in-memory per isolate; `MINVOTESTORESOLVE = 3`. *Acceptance: a fresh browser can vote; a returning cookie votes again; the 10-second stranger test passes.*
- **FR-9 — Greedy ELO pairing.** `lib/pairUnmatched.ts` pairs unmatched submissions into a match only when the active-match count is zero. *Acceptance: two unmatched submissions with no active match become one active match; further submissions wait while one is active.*
- **FR-10 — One-battle arena.** The arena page shows exactly one live battle with two previews, narrowed from the previous 10-active-plus-resolved list. *Acceptance: the arena displays one battle; voting order cannot drift (Ash's out-of-order complaint).*
- **FR-11 — No forced close.** In-flight battles resolve on their own 48h clocks; wind-down is gradual, not instant. *Acceptance: the six pre-cap in-flight battles close without manual intervention; cap enforcement never kills an already-active match.*

## Non-Functional Requirements

- **NFR-1 — Durability.** Lifecycle, votes, and ELO survive a Worker restart. *Acceptance: restart mid-battle; all state intact in Postgres.*
- **NFR-2 — Concurrency.** ELO is single-applied under READ COMMITTED races. *Acceptance: concurrent resolve storm produces zero double applications.*
- **NFR-3 — Vote-path latency.** The vote round-trip is fast enough to keep the stranger inside 10 seconds. *Acceptance: measured vote insert well under 10s end-to-end.*
- **NFR-4 — No scheduler operations.** No cron to deploy or monitor. *Acceptance: expiry occurs lazily from existing read/vote paths.*

## User Stories
- **Stranger:** I land on the site, hear two 60-second previews, and tap my pick in under ten seconds without reading anything.
- **Bot author:** I GET the spec, POST a minimal arrangement, and my model is entered; I receive a botSecret once.
- **Returning voter:** I vote again on the next battle with the same cookie.
- **Operator (Brandon):** I watch one live battle at a time, see the buffer, and add models to the roster when I choose.

## Acceptance Criteria
- **AC-1:** Active-match count never exceeds one (query-verified).
- **AC-2:** Concurrent double-resolve scores zero rows changed on the second call.
- **AC-3:** Stranger-vote test on bot-vs-bot: land → two previews → vote in <10s, with vote count and distinct identities recorded.
- **AC-4:** Buffer holds ≥3 validated unpaired submissions in steady state; advance blocked when it would empty.
- **AC-5:** Fresh bot goes spec → submit → paired with no human involvement.
- **AC-6:** Wind-down completes with zero manual closes.

## Explicitly Out of Scope
Whole-pool poll; Sybil-proof or ranked voting; cron closer; server render; multi-battle arena view; forced close of in-flight battles; GLM-5.3-Flash roster addition (pending Brandon's call); removing human submission (humans may still create — the experiment simply doesn't depend on it).


---

<!-- 03-system-architecture.md -->

# System Architecture

> Council of Agents — I'm here because I want to build a project but a…
> Owner: **Sol** · Revision 1 · Updated 2026-10-04 16:25 UTC

## Architecture Summary
The Beatdown is a 1v1 60-second jam battle site: exactly one live votable battle site-wide at a time, with strict `open → voting → closed` lifecycle enforced server-side and durable in Postgres. Bot-vs-bot submissions seed the queue; humans join as voters only. There is no server render — battles are arrangement JSON played client-side. Auto-advance is gated on Vera's buffer of three finished battles so one failure cannot blank the site. Success test: a stranger lands, hears two previews, and votes in <10s with no reading required.

## Components and Responsibilities
- **Arena UI (`app/arena/page.tsx`):** Reads lifecycle and vote state. Previously pulled 10 active+resolved ordered desc (source of Ash's "which one's happening"). Responsible for one-active query: `matches where status='active'` limit 1.
- **Vote path (`app/api/vote/route.ts`):** Inserts anonymous votes (`userid null + voterkey`). Calls lazy expiry. Enforces `MINVOTESTORESOLVE=3`.
- **Lifecycle (`lib/battleLifecycle.ts`):** Lazy expiry `resolveExpiredMatches` / 48h close. Called from read path (`app/arena/page.tsx`) and vote path (`app/api/vote/route.ts`). No scheduler.
- **Pairing (`lib/pairUnmatched.ts` + matchmaker route):** `pairOpenRound` pairs validated but unpaired submissions into `matches`. Now gated on `MAX_CONCURRENT_BATTLES=1` — refuses creation when one active exists.
- **Bot ingestion (`lib/botSubmissions.ts`):** `normalizeArrangement` validates POSTs at 8x16 grids and 60.5s cap. Rejection is the failure path; no render job.
- **Store (Supabase Postgres, `supabase/schema.sql` + `supabase/migrations/2026-09-29-anonymous-voting.sql`):** Durable `rounds.status`, `matches(status active/resolved, votesa/votesb)`, `votes`, `resolve_match()` / `resolve_match_draw`.
- **Bot contract (GET `/api/bots/spec` → POST `/api/bots/submit`):** Proven moltbook contract. Kept as-is; one bot proved it end-to-end.

## Data Flow
1. Bot fetches GET `/api/bots/spec`, POSTs arrangement JSON to POST `/api/bots/submit`.
2. `normalizeArrangement` validates (8x16, 60.5s cap). Valid → durable Postgres row (validated but unpaired = buffer). Invalid → rejected POST, site unaffected.
3. Buffer = query for validated but unpaired submissions; target depth 3.
4. `pairOpenRound` / matchmaker checks `count(matches where status='active')`. If >=1, no creation. If 0 and buffer non-empty, pairs one battle → `matches(status='active')`.
5. Stranger lands → arena shows the single active battle with two previews → votes via `app/api/vote/route.ts` → row in `votes`, increment `vot presently votesa/votesb`.
6. Lazy expiry: any read or vote triggers `resolveExpiredMatches`. After 48h or vote threshold, `resolve_match()` claims and resolves to `status='resolved'`, applies ELO to profiles.
7. Auto-advance blocked if it would empty the buffer. Six in-flight battles at cap-ship time wind down on own 48h clocks; no forced close.

## Technology Decisions
- **Supabase Postgres for lifecycle + votes, not frontend state, because** lifecycle must survive restart; frontend state certifies a wrong winner faster under auto-advance. Cost: every read/vote hits DB; accepted for single-active query scale.
- **Lazy 48h expiry in `lib/battleLifecycle.ts` over cron/Scheduled Worker, because** zero scheduler to operate for a one-live site. Cost: concurrent resolves from read + vote paths; covered by claim-close in `resolve_match()`.
- **Client-side playback of arrangement JSON over server render, because** there is no render pipeline to fail/queue/cost. Cost: client must implement playback faithfully; `normalizeArrangement` is the only gate.
- **App-level `MAX_CONCURRENT_BATTLES=1` gate in `pairOpenRound` + matchmaker over DB partial unique index, because** it shipped as single-function edits with no migration. Cost: TBD whether a DB-level guard exists; concurrent creators rely on app check.
- **Anonymous cookie + `voterkey` voting (userid nullable via 2026-09-29 migration) with in-memory `checkRateLimit`, because** it passes the 10-second stranger-vote test (observed: 23+ votes across 9 identities). Cost: Sybil-soft — cleared `bdvoter` cookie = new identity, rate limit lost on isolate restart.

## Alternatives Considered
- **Whole-pool poll (Ash's request):** Runner-up and deferred. Rejected for now because it needs ranking that does not exist yet, and unbounded choice recreates the unwatchable ordering bug.
- **Cron closer:** Cleaner ordering than lazy expiry. Rejected because it adds a new failure mode (scheduler) for no needed gain while claim-close holds.
- **Server render / pre-rendered WAVs:** Rejected — no evidence a render pipeline exists; arrangement JSON + client playback already satisfies 60-second battles.
- **Sybil-proof ranked voting:** Explicit non-goal for this phase. Accepted Sybil-soft at `MINVOTESTORESOLVE=3` for the vote test; not suitable for ranked play.

## Failure Modes
- **Bad bot POST:** Rejected by `normalizeArrangement` at submit time. Site never blanks. No retry machinery needed.
- **Concurrent lazy expiry double-applying ELO:** Fixed by moving status flip before ELO math with `WHERE status='active'` claim under READ COMMITTED. Loser of row lock re-checks, finds zero rows, returns unscored. A naive `IF status='resolved' RETURN` would still double-apply.
- **Unbounded actives recreating out-of-order list:** Fixed by `MAX_CONCURRENT_BATTLES=1` gate in `pairUnmatched` + matchmaker. Without it, seeding the buffer creates many live battles.
- **Isolate restart / cookie clear:** In-memory `checkRateLimit` resets; cleared `bdvoter` cookie = new identity. Accepted for vote test, not for ranked.
- **Wind-down:** Six in-flight battles at ship time resolve gradually on own clocks, not instantly. Arena must tolerate >1 active during wind-down and converge to 1.
- **Empty buffer + active resolving:** Auto-advance blocked rather than showing zero live battles.

## Scalability and Performance
- Steady state is one active row + one buffer query (depth 3) + vote inserts. No scaling concern at stranger-vote volume (tens of votes).
- No render latency/cost to size the buffer against, because validation is synchronous POST rejection.
- TBD: What is the peak vote-write rate `app/api/vote/route.ts` + `vot esa/votesb` increments must sustain before needing a counter table or transaction batching?
- TBD: Exact matchmaker route file path and whether `MAX_CONCURRENT_BATTLES` is config or hardcoded, for operator tuning.


---

<!-- 04-data-model.md -->

# Data Model

> Council of Agents — I'm here because I want to build a project but a…
> Owner: **Sol** · Revision 1 · Updated 2026-10-04 16:25 UTC

## Entity Overview
Durable Postgres is the system of record. Core entities are `rounds`, `matches`, `votes`, and ELO `profiles`. The buffer is not new machinery — it is a query for validated but unpaired submissions (durable rows the moment they arrive). One row in `matches` with `status='active'` site-wide is the live battle.

## Entities and Fields
- **`rounds`:**
  - `status` — lifecycle state. Converged lifecycle is `open → voting → closed` enforced server-side.
  - TBD: Exact column list for `rounds` (id, times, linkage to matches) — confirm in live `supabase/schema.sql`.
- **`matches`:**
  - `status` — `active` / `resolved` (verified in `supabase/schema.sql` line ~163 area).
  - `vot esa` / `votesb` — per-side counters (naming as `votesa`/`votesb` in code; spelling to confirm in schema).
  - Links two submissions / entrants for one 1v1.
  - TBD: Exact entrant FK columns (submission ids? profile ids? arrangement pointers) — read from live schema before codegen.
- **`votes`:**
  - `userid` — nullable (anonymous voting allowed via `supabase/migrations/2026-09-29-anonymous-voting.sql`; checked-in `schema.sql` still shows `not null` without `voterkey`).
  - `voterkey` — anonymous identity key added by migration, paired with `bdvoter` cookie.
  - One row per vote via `app/api/vote/route.ts`.
  - TBD: Exact columns (`match_id`, side, `created_at`, uniqueness) — read from migration file.
- **Profiles (ELO):**
  - Mutated by `resolve_match()` / `resolve_match_draw` on resolve.
  - TBD: Table name and columns (`elo`, `wins/losses`?) — ELO application confirmed, table shape not quoted in council.
- **Submissions (buffer rows):**
  - Validated arrangement JSON rows waiting unpaired; `normalizeArrangement` enforces 8x16 grids, 60.5s cap.
  - TBD: Staging table name and columns — `pairOpenRound` in `lib/pairUnmatched.ts` pairs "every unmatched submission"; confirm table/flag (e.g. `submissions` with `matched`/`match_id null` vs status enum).

## Relationships
- `rounds` 1—N `matches` (lifecycle grouping; exact FK TBD from schema).
- `matches` 1—N `votes` (votes reference their match + side).
- `matches` N—2 submissions/entrants (pairing output).
- `matches` resolve → writes to `profiles` (ELO delta for both sides; draw path via `resolve_match_draw`).

## Indexes and Constraints
- `matches(status)` — required for `where status='active'` one-live query and active-count gate. TBD: whether index exists.
- `votes(match_id, voterkey)` — needed to prevent trivial double-vote and to count toward `MINVOTESTORESOLVE=3`. TBD: whether unique constraint exists or Sybil-soft intentionally allows repeats.
- `MAX_CONCURRENT_BATTLES=1` — enforced in app (`lib/pairUnmatched.ts` + matchmaker route), not confirmed as DB partial unique index. TBD: add `CREATE UNIQUE INDEX ... WHERE status='active'` or explicitly accept app-only gate.
- `resolve_match()` idempotency — `WHERE status='active'` claim (status flip before ELO math; loser re-checks zero rows, returns unscored). Same pattern already in `resolve_match_draw`.
- `rounds.status`, `matches.status` check constraints for allowed values. TBD: present in schema or app-only.

## State Transitions
- Round/battle lifecycle: `open → voting → closed` (server-enforced). Maps to `matches.status: active → resolved` plus `rounds.status`.
- Creation: validated unpaired submission → paired when `active count = 0` → new `matches(status='active')`. Creation refused when `active count >= 1`.
- Voting: `votes` insert → `votesa`/`votesb` increment. Threshold `MINVOTESTORESOLVE=3` eligible for resolve (exact resolve trigger vs 48h expiry interaction TBD in `lib/battleLifecycle.ts`).
- Expiry: lazy `resolveExpiredMatches` (48h) from `app/arena/page.tsx` + `app/api/vote/route.ts` → `resolve_match()` claim → `status='resolved'` + ELO applied. Second concurrent call scores zero.
- Buffer: unpaired → paired (consumed). Auto-advance blocked if step would leave zero buffer + zero active.
- Wind-down (one-time): six pre-cap in-flight battles `active → resolved` on own 48h clocks; no forced transition.

## Migration Plan
- Shipped: `supabase/migrations/2026-09-29-anonymous-voting.sql` — `votes.userid` nullable + `voterkey` (reconciles checked-in `schema.sql` `not null` without `voterkey`).
- Shipped: active-match cap (`MAX_CONCURRENT_BATTLES=1` in `lib/pairUnmatched.ts` + matchmaker route).
- Shipped: claim-close in `resolve_match()` (`WHERE status='active'` flip-before-math); `resolve_match_draw` already guarded same way.
- Next: zcode agent to verify live DB has all three migrations applied; wind down six in-flight battles with no new migration.
- TBD: Is a DB-level active-cap (partial unique index) desired as follow-up, or is app-gate the permanent guard? Decide after wind-down verifies `active count never exceeds 1`.


---

<!-- 05-interface-contracts.md -->

# Interface Contracts

> Council of Agents — I'm here because I want to build a project but a…
> Owner: **Sol** · Revision 1 · Updated 2026-10-04 16:25 UTC

## Interface Overview
External surface is threefold: arena read (one live battle + previews), vote write (anonymous, <10s), and bot submission (proven moltbook contract GET spec → POST submit). All lifecycle enforcement is server-side; frontend state is display only. No auth, no scheduler, no render API.

## Endpoints
- `GET /arena` (`app/arena/page.tsx`): Returns the single live battle (query `matches where status='active'` limit 1) with two arrangement previews. Legacy behavior returned 10 active+resolved ordered desc — removed.
- `POST /api/vote` (`app/api/vote/route.ts`): Casts one vote for the live battle. Triggers lazy expiry. Threshold `MINVOTESTORESOLVE=3`.
- `GET /api/bots/spec`: Returns the proven bot submission spec (the schema the one moltbook bot followed end-to-end). Preserved as-is.
- `POST /api/bots/submit`: Accepts one 60-second arrangement. Validated by `normalizeArrangement` (8x16, 60.5s cap). Valid → durable buffer row; invalid → rejected POST.
- Internal: `pairOpenRound` (`lib/pairUnmatched.ts`) + matchmaker route — pairs buffer into `matches` gated on `MAX_CONCURRENT_BATTLES=1`.
- Internal: `resolveExpiredMatches` (`lib/battleLifecycle.ts`, 48h) — lazy close from arena read + vote write.
- TBD: Exact matchmaker route path (file/URL) — confirm before wiring runbooks.

## Request and Response Schemas
- `GET /arena` response: single active `match` { id, status:'active', entrant A arrangement pointer + preview, entrant B arrangement pointer + preview, `votesa`, `votesb`, round/lifecycle state } plus buffer-depth hint (for ops, not ranking). During pre-cap wind-down may briefly return >1 active with convergence note.
  - TBD: Exact JSON field names for entrants/previews — read from `app/arena/page.tsx` + API route.
- `POST /api/vote` request: { `matchId`: string, side: "a"|"b", `voterKey`?: string (server sets `bdvoter` cookie if absent) }.
  - Response success: { `matchId`, `votesa`, `votesb`, resolved: boolean }.
  - TBD: Exact side enum (`a`/`b` vs `0`/`1`) and cookie name casing (`bdvoter`) — confirm in `app/api/vote/route.ts`.
- `GET /api/bots/spec` response: the frozen submission schema (arrangement JSON shape, 8x16 grid definition, 60.5s cap, example payload).
  - TBD: Paste exact spec JSON into implementation-plan; do not paraphrase for bot authors.
- `POST /api/bots/submit` request: arrangement JSON per spec (8 voices x 16 steps referenced; 60.5s cap).
  - Response success: { submissionId, status: "queued" }.
  - Response invalid: 4xx with `normalizeArrangement` reason; no row written, site unaffected.

## Error Model
- Invalid arrangement: 4xx + machine-readable `reason` from `normalizeArrangement` (e.g. grid overflow, duration >60.5s). No retry by server; bot fixes POST.
- Vote for non-active/unknown match: 4xx/404, no `votes` row, no counter change.
- Creation refused by cap: `pairOpenRound`/matchmaker no-op when `active count >= 1` (not an error to surface; buffer stays queued).
- Double resolve: second concurrent `resolve_match()` returns unscored (zero ELO delta) by `WHERE status='active'` claim — not an error.
- Rate limit: in-memory `checkRateLimit` per isolate → 429 on abuse. Resets on isolate restart (accepted).
- Shape: { `error`: string, `reason`?: string, `matchId`?: string } — TBD: confirm actual error envelope in routes before client code.

## Events
- No event bus. Lifecycle advances via lazy evaluation on read + vote: `resolveExpiredMatches` → `resolve_match()` → `status='resolved'` + ELO write.
- Auto-advance event (logical): resolved → if buffer non-empty and `active count == 0`, pair next battle. Blocked whenever it would leave zero buffer + zero active.
- Wind-down (one-time): six pre-cap actives each fire their own resolve on 48h clock; no bulk-close event.

## Authentication and Authorization
- No login. Anonymous voting: `votes.userid null + voterkey`, `bdvoter` cookie as identity. Proven by stranger-vote test (23+ votes across 9 identities at `MINVOTESTORESOLVE=3`).
- `checkRateLimit` is in-memory per isolate only. Cleared cookie = new identity. Explicitly Sybil-soft; acceptable for the <10s vote test, not for ranked play.
- Bot submission: no auth change — keep the proven moltbook schema contract with validation-only gate.
- Deferred (non-goals): whole-pool poll, Sybil-proof ranked voting, cron closer, server render, GLM-5.3-Flash roster add (your call; Ash's ask is demand signal, not requirement).


---

<!-- 06-implementation-plan.md -->

# Implementation Plan

> Council of Agents — I'm here because I want to build a project but a…
> Owner: **Mira** · Revision 1 · Updated 2026-10-04 16:28 UTC

## Delivery Strategy
The two load-bearing fixes — the active-match cap and the claim-close idempotency — are reported implemented and deployed. This plan verifies them in the live Worker, then completes wind-down, the stranger-vote rerun, and queue top-up. Slices are ordered by dependency, then by risk: the verification slice that can invalidate everything else goes first.

## Phase 1 — Foundation
- **Slice 1.1 — Verify the cap.** Confirm `MAX_CONCURRENT_BATTLES = 1` is live in `lib/pairUnmatched.ts` and the matchmaker route (exact route path TBD — confirm before editing). *Done: pairing refuses creation while one active match exists.*
- **Slice 1.2 — Verify claim-close.** Confirm `resolve_match` in `supabase/schema.sql` flips status via `WHERE status='active'` before ELO math, and that the 2026-09-29 anonymous-voting migration is synced into `schema.sql`. *Done: concurrent resolves single-apply ELO.*
- *Why first:* every later phase builds on these two claims. If either is not actually live, the rest is built on sand.

## Phase 2 — Core Capability
- **Slice 2.1 — One-battle arena.** Narrow `app/arena/page.tsx` from 10 active+resolved ordered desc to one active battle site-wide, with two previews. *Done: a stranger sees exactly one battle.*
- **Slice 2.2 — Buffer as a query.** Surface validated-but-unpaired submissions as a query; block auto-advance whenever it would empty the buffer (target floor: three). *Done: the queue is observable and advance is safe.*
- **Slice 2.3 — Wind-down.** Observe the six in-flight battles resolving on their own 48h clocks; no forced close. *Done: steady state of one live battle reached with zero manual intervention.*

## Phase 3 — Integration
- **Slice 3.1 — Bot-vs-bot seeding.** Continue seeding through the proven contract (`GET /api/bots/spec` → `POST /api/bots/submit`). Current roster: GPT-6 Luna, Muse Spark 1.3, MiniMax-M3, big-pickle 1.0, Fork (GLM 5.3).
- **Slice 3.2 — Rerun the stranger-vote test** on a bot-vs-bot battle: land → previews → vote <10s; record vote count and distinct identities against the 23+ / 9 baseline.
- **Slice 3.3 — Roster addition (optional, Brandon's call).** Add GLM-5.3-Flash per Ash's request. Defer if Brandon declines; the demand signal is the ask itself.

## Phase 4 — Hardening
- **Slice 4.1 — Idempotency under load.** Run a concurrent resolve storm; verify zero double ELO applications.
- **Slice 4.2 — Queue top-up.** TBD: what keeps the buffer at three — manual seeding per model release, or an automated feeder? Blocked on the open question; do not build a feeder until Brandon decides.
- **Slice 4.3 — Post-mortem loop.** The observed culture — losing agent sends block-level critique, winner concedes, both revise for a rematch citing timestamps — is to be documented, not built. No features are specced from it.

## Dependencies
- Phase 1 gates everything.
- 2.2 depends on 1.1 (the cap is what makes the buffer meaningful).
- 3.2 depends on 2.1 (one-live is what makes the test observable).
- 4.2 is blocked on Brandon's decision about the feeder mechanism.

## Definition of Done
- One active match, always, verified by query.
- Zero double-applied ELO under concurrent resolve.
- Stranger-vote test passes on bot-vs-bot with recorded metrics.
- Buffer ≥3 maintained; no advance into an empty site.
- Wind-down complete with no manual closes.
- These documents match the live Worker — no drift between spec and code.


---

<!-- 07-risks-and-open-questions.md -->

# Risks & Open Questions

> Council of Agents — I'm here because I want to build a project but a…
> Owner: **Vera** · Revision 1 · Updated 2026-10-04 16:29 UTC

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|------------|--------|------------|--------|
| R1 | Unbounded active matches created by `pairOpenRound` | High (already occurred) | High — recreates Ash's "which one's happening" UX | Gate creation on `MAX_CONCURRENT_BATTLES = 1` in `pairUnmatched.ts` and matchmaker route | Shipped |
| R2 | Non-idempotent `resolve_match()` double-applies ELO under concurrent lazy expiry + vote | High (race exists) | High — corrupts leaderboard | Move status flip before ELO math with `WHERE status = 'active'` claim; losing transaction re-checks and returns unscored | Shipped (claim-close pattern) |
| R3 | Sybil-soft voting (in-memory rate limit + cookie identity) | Medium | Medium — acceptable for 10s stranger test at MINVOTESTORESOLVE=3; fails for ranked play | Accept for v1; defer Sybil-proof ranked voting to non-goal list | Accepted |
| R4 | Wind-down period leaves 6 in-flight battles resolving on individual 48h clocks | Certain | Low — gradual, no blank site | No forced close; creation stays gated at 1 | Accepted |
| R5 | Bot render pipeline latency/cost unknown — buffer sizing assumes client-side playback | Medium | Medium — if render >30s or costly, 3 queued submissions may need pre-warming | Document as dependency on `normalizeArrangement` validation (8×16 grid, 60.5s cap) — no server render exists | Documented |
| R6 | Anonymous vote migration (`2026-09-29-anonymous-voting.sql`) not synced into `schema.sql` | Low (now synced) | Medium — drift between local and prod schema | Sync complete; both guards in schema | Resolved |

---

## Technical Risks

### R1: Unbounded Active Matches (Shipped)
**What happened:** `pairOpenRound` in `lib/pairUnmatched.ts` paired every unmatched submission at once, creating multiple simultaneous active battles — exactly the "out of order" list Ash reported.

**Fix applied:** Added `MAX_CONCURRENT_BATTLES = 1` gate in both `pairUnmatched.ts` and the matchmaker route. Creation now refuses when `matches where status='active'` count ≥ 1.

**Residual risk:** Wind-down is gradual — the 6 in-flight battles resolve on their own 48h clocks in `lib/battleLifecycle.ts`. During wind-down, `active` count may briefly exceed 1 until each expires. No forced close; the gate prevents *new* battles.

### R2: Non-Idempotent Resolve (Shipped — Claim-Close Pattern)
**What happened:** `resolve_match()` in `supabase/schema.sql` (line 163) selects any status. Concurrent callers from lazy expiry (`lib/battleLifecycle.ts` → `app/arena/page.tsx` and `app/api/vote/route.ts`) both pass a naive `IF status = 'resolved' THEN return` check under READ COMMITTED, then both apply ELO.

**Fix applied:** Status flip moves before ELO math with `WHERE status = 'active'` claim. The transaction that loses the row lock re-checks, finds zero rows, and returns unscored. `resolve_match_draw` was already guarded the same way.

**Residual risk:** None identified — the claim-close pattern is idempotent under concurrent callers.

### R3: Client-Side Playback, No Server Render
**Architecture:** Battles are arrangement JSON played client-side. `normalizeArrangement` in `lib/botSubmissions.ts` validates at POST time (8×16 grid, 60.5s cap). A failed render = rejected POST, not an empty site.

**Risk:** If client playback diverges (browser audio context, timing), two voters hear different things. No server-side audio exists to audit.

**Mitigation:** Accept for v1. The 10-second stranger-vote test only requires *a* playable preview, not bit-identical playback.

---

## Security and Privacy

### R3: Sybil-Soft Voting (Accepted)
**Current state:** `app/api/vote/route.ts` uses in-memory `checkRateLimit` per isolate + `bdvoter` cookie + `voterkey` column. A cleared cookie = new identity.

**Threat model:** 
- 10-second stranger test at `MINVOTESTORESOLVE = 3`: Held (23+ votes, 9 distinct cookie identities, repeat voters across battles).
- Ranked play / ELO integrity: **Not protected**. A determined actor can rotate cookies/isolates.

**Decision:** Explicit non-goal for v1. Defer Sybil-proof voting to future ranked phase.

### Data Exposure
- `votes` table stores `voterkey` (cookie-derived) + `userid` (nullable, now `voterkey` for anonymous).
- No PII collected. `profiles` table holds ELO + display name only.
- Bot submissions include `botSecret` returned once per bot — treat as bearer token.

---

## Operational and Cost Risks

### R4: Wind-Down Period (Accepted)
Six in-flight battles resolve on individual 48h clocks. During this window:
- `active` count may exceed 1 (legacy battles finishing)
- New submissions queue as validated but unpaired rows
- Stranger-vote test still works — one live battle exists

**No forced close.** Let lazy expiry drain naturally. Creation gate holds at 1.

### R5: Render Pipeline Cost/Latency (Unknown)
**What we don't know:** The council never measured `normalizeArrangement` latency or cost because there is **no server render** — validation is pure JSON schema check.

**If server render is added later:** Buffer of 3 queued submissions may need pre-warming. Current architecture: zero server render cost, buffer is a query (`submissions where paired=false and validated=true`).

### Operational Burden
- **Zero scheduler:** Lazy 48h expiry in `lib/battleLifecycle.ts` called from read/vote paths. No cron, no Scheduled Worker.
- **Zero new store:** Postgres (Supabase) already holds rounds, matches, votes, submissions, profiles.
- **Migration management:** Anonymous-vote migration (`2026-09-29-anonymous-voting.sql`) now synced into `schema.sql`. Future migrations must sync both.

---

## Dependencies and Vendor Risk

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Supabase Postgres | Vendor lock-in; schema migrations must stay in sync | Keep schema in repo (`supabase/schema.sql` + migrations); use Supabase CLI for local dev |
| Next.js App Router | Framework churn (Server Actions, caching) | Pin versions; migration path exists via `wrangler` if moving to Workers |
| OpenCode model access (GLM-5.3, etc.) | Model availability / API changes | Bot contract is schema-bound (`GET /api/bots/spec` → `POST /api/bots/submit`); swap models without schema change |
| Browser AudioContext | Playback divergence across clients | Accept for v1; document as known gap |
| In-memory rate limit (`checkRateLimit`) | Per-isolate; resets on deploy/cold start | Accept for v1 stranger test; not for ranked |

**Single point of failure:** Supabase. No fallback auth/db. Acceptable for hobby scale.

---

## Open Questions

| Question | Blocking? | Owner | Notes |
|----------|-----------|-------|-------|
| **OQ1:** Exact `normalizeArrangement` validation spec (8×16 grid, 60.5s cap) — is this documented for bot authors? | No | zcode agent | Bot contract route `GET /api/bots/spec` should return this; verify it does |
| **OQ2:** `MINVOTESTORESOLVE = 3` — is this tunable per battle or global constant? | No | zcode agent | Currently in `lib/battleLifecycle.ts`; confirm single source of truth |
| **OQ3:** ELO formula parameters (K-factor, initial rating) — where defined? | No | zcode agent | In `resolve_match()` or `lib/elo.ts`? Document for reproducibility |
| **OQ4:** `MAX_CONCURRENT_BATTLES = 1` — is this a runtime env var or hardcoded? | No | zcode agent | Hardcoded in `pairUnmatched.ts` and matchmaker route; make configurable if needed |
| **OQ5:** Bot secret rotation / revocation — any mechanism? | No | zcode agent | `botSecret` returned once on submit; no rotation endpoint exists |
| **OQ6:** GLM-5.3-Flash roster addition — decision pending? | No | Human | Ash asked for it; council deferred to human call. Not in scope for v1 docs |

---

## Go / No-Go Conditions

### Go (All Met)
- ✅ Durable lifecycle in Postgres (`rounds.status`, `matches`, `votes`)
- ✅ Lazy 48h expiry working (`lib/battleLifecycle.ts`)
- ✅ Greedy ELO pairing exists (`lib/pairUnmatched.ts`)
- ✅ Proven bot contract (1 moltbot + 4 opencode-harness bots entered)
- ✅ Active-match cap shipped (`MAX_CONCURRENT_BATTLES = 1`)
- ✅ Resolved-guard shipped (claim-close pattern in `resolve_match()`)
- ✅ Stranger-vote test passed (23+ votes, 9 identities, <10s flow)
- ✅ Buffer = query on validated unpaired submissions (no new machinery)

### No-Go (Any Blocks)
- ❌ Active-match cap not enforced in both `pairUnmatched.ts` AND matchmaker route
- ❌ `resolve_match()` lacks `WHERE status = 'active'` claim (naive guard only)
- ❌ `schema.sql` and migrations out of sync (anonymous voting columns missing)
- ❌ Bot contract route (`GET /api/bots/spec` → `POST /api/bots/submit`) returns 404 or wrong payload
- ❌ `normalizeArrangement` rejects valid 8×16 / 60.5s arrangements (false negatives)

### Deferred (Explicit Non-Goals)
- Whole-pool poll (needs ranking infrastructure)
- Sybil-proof ranked voting
- Cron closer (lazy expiry sufficient)
- Server-side audio render / audit
- GLM-5.3-Flash roster add (human decision)
- Bot secret rotation

---

**Document status:** Complete. All risks from council conversation captured. Two shipped mitigations (R1, R2), one accepted (R3), one accepted with monitoring (R4), one documented dependency (R5), one resolved (R6). Six open questions for implementer clarification — none block v1.


---

## Implementer Notes (zcode · GLM 5.3 · 2026-10-01)

Answers to the open questions table, verified in code and deployed:

- **OQ1:** YES — `GET /api/bots/spec` returns the full validation rules (grid shape, 60.5s cap, module definitions, rules list) plus a minimal example. Bot authors self-serve from it; five bots have.
- **OQ2:** `MIN_VOTES_TO_RESOLVE = 3` is a single constant in `app/api/vote/route.ts` (line 8). Global, not per-battle.
- **OQ3:** ELO lives inside `resolve_match()` in `supabase/schema.sql`: K = 32, loser floor = 100 (`greatest(100, elo - delta)`), initial rating 1000 (profiles default). Expected score = `1/(1+10^((loser-winner)/400))`.
- **OQ4:** `MAX_CONCURRENT_BATTLES = 1` is a hardcoded exported constant in `lib/pairUnmatched.ts`, consumed by both the pairing path and the matchmaker route. One-line change to tune.
- **OQ5:** No rotation/revocation mechanism — `botSecret` is returned once per bot; treat as bearer token. A lost secret means the bot's identity can still be updated by re-POST under the same botName before... (no — updates require the secret). Lost secret = orphaned entry; delete via admin instead.
- **OQ6:** GLM-5.3-Flash roster add — deferred by Brandon; the chip makes it a 5-minute entry whenever called.

Also shipped since your review: FR-5 buffer floor (pairing holds when it would leave fewer than 3 validated unpaired submissions), FR-10 convergence is automatic (the arena shows all actives during wind-down, then exactly one at steady state), and the resolved-guard + cap from R1/R2 are live in the database and the deployed Worker.
