import { createServiceClient } from '@/lib/supabase/server';
import { evaluateResolveEligibility, BATTLE_DEADLINE_HOURS } from './resolveRules';
import type { Match } from '@/lib/supabase/types';

// The resolve rule itself lives in lib/resolveRules.ts (client-safe, so the
// UI can render the same rule the resolver obeys). Re-exported here for
// server callers.
export {
  MIN_LIVE_HOURS,
  MIN_VOTES_TO_RESOLVE,
  BATTLE_DEADLINE_HOURS,
  evaluateResolveEligibility,
  guaranteeLine,
} from './resolveRules';

/**
 * Lazy battle lifecycle, run on every read/vote path (no cron needed):
 * 1. past the 48h deadline — current leader wins, a tie (incl. 0-0) is a draw
 *    with no ELO change;
 * 2. inside the deadline — a fight resolves only when the shared predicate
 *    says so: 3+ non-tied votes AND the 6h live guarantee elapsed.
 * Callers fire-and-forget with a catch.
 */
export async function resolveExpiredMatches(): Promise<void> {
  const service = createServiceClient();
  const now = Date.now();
  const { data: active } = await service
    .from('matches')
    .select('id, created_at, track_a_id, track_b_id, votes_a, votes_b')
    .eq('status', 'active') as unknown as { data: Pick<Match, 'id' | 'created_at' | 'track_a_id' | 'track_b_id' | 'votes_a' | 'votes_b'>[] | null };

  let resolved = 0;
  for (const m of active ?? []) {
    let error: { message: string } | null = null;
    let attempted = false;
    if (now >= new Date(m.created_at).getTime() + BATTLE_DEADLINE_HOURS * 3_600_000) {
      const decided = m.votes_a !== m.votes_b && m.votes_a + m.votes_b > 0;
      ({ error } = decided
        ? await (service.rpc as any)('resolve_match', {
            p_match_id: m.id,
            p_winner_id: m.votes_a > m.votes_b ? m.track_a_id : m.track_b_id,
          })
        : await (service.rpc as any)('resolve_match_draw', { p_match_id: m.id }));
      attempted = true;
    } else {
      const elig = evaluateResolveEligibility(m, now);
      if (elig.canResolve) {
        ({ error } = await (service.rpc as any)('resolve_match', {
          p_match_id: m.id,
          p_winner_id: elig.leaderId,
        }));
        attempted = true;
      }
    }
    if (error) {
      console.error(`expire match ${m.id} failed:`, error.message);
      continue;
    }
    if (attempted) resolved++;
  }

  // Freed tracks can re-enter the pool — same as a vote-resolved match.
  if (resolved > 0) {
    const { pairOpenRound } = await import('@/lib/pairUnmatched');
    await pairOpenRound(service).catch((e) => console.error('Post-expiry pairing failed:', e));
    console.log(`resolveExpiredMatches: closed ${resolved} stale battle(s)`);
  }
}
