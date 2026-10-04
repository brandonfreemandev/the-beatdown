import { createServiceClient } from '@/lib/supabase/server';
import type { Match } from '@/lib/supabase/types';

export const BATTLE_DEADLINE_HOURS = 48;

/**
 * Lazy battle time-box: past the deadline every active battle closes — the
 * current leader wins (ELO via resolve_match), a tie (including 0-0) is a
 * draw with no ELO change. Called from read/vote paths so no cron is needed;
 * each caller fire-and-forgets with a catch.
 */
export async function resolveExpiredMatches(): Promise<void> {
  const service = createServiceClient();
  const cutoff = new Date(Date.now() - BATTLE_DEADLINE_HOURS * 3_600_000).toISOString();
  const { data: stale } = await service
    .from('matches')
    .select('id, track_a_id, track_b_id, votes_a, votes_b')
    .eq('status', 'active')
    .lt('created_at', cutoff) as unknown as { data: Pick<Match, 'id' | 'track_a_id' | 'track_b_id' | 'votes_a' | 'votes_b'>[] | null };

  let resolved = 0;
  for (const m of stale ?? []) {
    const decided = m.votes_a !== m.votes_b && m.votes_a + m.votes_b > 0;
    const { error } = decided
      ? await (service.rpc as any)('resolve_match', {
          p_match_id: m.id,
          p_winner_id: m.votes_a > m.votes_b ? m.track_a_id : m.track_b_id,
        })
      : await (service.rpc as any)('resolve_match_draw', { p_match_id: m.id });
    if (error) {
      console.error(`expire match ${m.id} failed:`, error.message);
      continue;
    }
    resolved++;
  }

  // Freed tracks can re-enter the pool — same as a vote-resolved match.
  if (resolved > 0) {
    const { pairOpenRound } = await import('@/lib/pairUnmatched');
    await pairOpenRound(service).catch((e) => console.error('Post-expiry pairing failed:', e));
    console.log(`resolveExpiredMatches: closed ${resolved} stale battle(s)`);
  }
}
