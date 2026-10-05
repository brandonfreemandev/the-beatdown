/** The single source of resolve truth for The Beatdown's ladder (council
 * locked 2026-10-04): ONE predicate decides whether an active battle may
 * resolve. The vote path and the lazy sweep obey it, and UI surfaces read the
 * same rule — so a card's promise and a sweep's decision cannot drift. The
 * claim-close guard inside resolve_match is deliberately NOT a second rule:
 * it carries no time/count logic, just `WHERE status='active'` idempotency.
 * Client-safe: no server imports (BattleCard renders the guarantee from it). */

export const MIN_VOTES_TO_RESOLVE = 3;
/** A fight cannot end before this, however fast votes land — shares need a
 * guaranteed audience window (a hot Discord drop used to settle a fight in
 * minutes, killing its own link). */
export const MIN_LIVE_HOURS = 6;
/** Hard ceiling — past this the sweep closes the fight (leader or draw). */
export const BATTLE_DEADLINE_HOURS = 48;

export interface ResolveEligibilityInput {
  created_at: string;
  votes_a: number;
  votes_b: number;
  track_a_id: string;
  track_b_id: string;
}

export interface ResolveEligibility {
  /** thresholdMet && windowElapsed — the ONLY resolve trigger. */
  canResolve: boolean;
  /** Enough non-tied votes to decide; the guarantee may still be running. */
  thresholdMet: boolean;
  /** now >= created_at + MIN_LIVE_HOURS. */
  windowElapsed: boolean;
  /** ISO instant the guarantee ends — the "GUARANTEED OPEN UNTIL" clock. */
  windowOpensAt: string;
  /** Current leader when thresholdMet; recomputed at resolve time so
   * late-window flips are honored, never frozen at first threshold hit. */
  leaderId: string | null;
}

export function evaluateResolveEligibility(
  match: ResolveEligibilityInput,
  now: number = Date.now(),
): ResolveEligibility {
  const windowOpensAt = new Date(
    new Date(match.created_at).getTime() + MIN_LIVE_HOURS * 3_600_000,
  ).toISOString();
  const total = match.votes_a + match.votes_b;
  const thresholdMet = total >= MIN_VOTES_TO_RESOLVE && match.votes_a !== match.votes_b;
  const windowElapsed = now >= new Date(windowOpensAt).getTime();
  return {
    canResolve: thresholdMet && windowElapsed,
    thresholdMet,
    windowElapsed,
    windowOpensAt,
    leaderId: thresholdMet
      ? match.votes_a > match.votes_b ? match.track_a_id : match.track_b_id
      : null,
  };
}

/** The one clock string the UI shows. Wording is load-bearing: the guarantee
 * is a floor, not a close time — if votes never arrive the fight stays open
 * past this instant, so it must never read as "closes at". */
export function guaranteeLine(windowOpensAt: string): string {
  return `GUARANTEED OPEN UNTIL ~${windowOpensAt.slice(11, 16)} UTC`;
}
