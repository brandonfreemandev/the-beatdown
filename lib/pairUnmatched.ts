import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Match } from './supabase/types';

/** Pair unmatched submissions in the open round into active 1-vs-1 battles (ELO-sorted). */
export async function pairUnmatched(
  service: SupabaseClient<Database>,
  roundId: string,
): Promise<number> {
  const { data: matched } = await service
    .from('matches')
    .select('track_a_id, track_b_id')
    .eq('round_id', roundId)
    .eq('status', 'active');

  const matchedIds = new Set(
    (matched ?? []).flatMap((m) => [m.track_a_id, m.track_b_id]),
  );

  const { data: subs } = await service
    .from('submissions')
    .select('id, user_id')
    .eq('round_id', roundId);

  const unmatched = (subs ?? []).filter((s) => !matchedIds.has(s.id));
  if (unmatched.length < 2) return 0;

  const userIds = [...new Set(unmatched.map((s) => s.user_id))];
  const { data: profiles } = await service
    .from('profiles')
    .select('id, elo_rating')
    .in('id', userIds);

  const eloMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.elo_rating]));
  const sorted = [...unmatched].sort(
    (a, b) => (eloMap[a.user_id] ?? 1000) - (eloMap[b.user_id] ?? 1000),
  );

  let created = 0;
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const { error } = await service.from('matches').insert({
      round_id: roundId,
      track_a_id: sorted[i].id,
      track_b_id: sorted[i + 1].id,
    } as never);
    if (!error) created++;
  }
  return created;
}

/** Convenience: pair in the current open round. Returns matches created (0 if none). */
export async function pairOpenRound(service: SupabaseClient<Database>): Promise<number> {
  const { data: round } = await service
    .from('rounds')
    .select('id')
    .eq('status', 'open')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!round) return 0;
  return pairUnmatched(service, round.id);
}

export type { Match };
