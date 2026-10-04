import type { SupabaseClient } from '@supabase/supabase-js';

/** Council spec: exactly one live battle site-wide. Raise to run more concurrently. */
export const MAX_CONCURRENT_BATTLES = 1;
import type { Database, Match } from './supabase/types';

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/** How many times each unordered pair has already fought, across all rounds. */
export function buildPairHistory(
  matches: Pick<Match, 'track_a_id' | 'track_b_id'>[],
): Map<string, number> {
  const history = new Map<string, number>();
  for (const m of matches) {
    const k = pairKey(m.track_a_id, m.track_b_id);
    history.set(k, (history.get(k) ?? 0) + 1);
  }
  return history;
}

/**
 * Greedy pairing with rematch avoidance: walk the ELO-sorted tracks, and give
 * each one the opponent it has fought the FEWEST times (ELO distance breaks
 * ties). With an empty history this reduces to adjacent ELO pairing. When only
 * two tracks remain, a rematch is unavoidable — that's a small-roster grudge
 * match, and it's allowed.
 */
export function greedyPair(
  sorted: { id: string; elo: number }[],
  history: Map<string, number>,
): Array<[string, string]> {
  const pool = [...sorted];
  const pairs: Array<[string, string]> = [];
  while (pool.length >= 2) {
    const a = pool.shift()!;
    let bestIdx = 0;
    let bestCount = Infinity;
    let bestDist = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const count = history.get(pairKey(a.id, pool[i].id)) ?? 0;
      const dist = Math.abs(a.elo - pool[i].elo);
      if (count < bestCount || (count === bestCount && dist < bestDist)) {
        bestIdx = i;
        bestCount = count;
        bestDist = dist;
      }
    }
    pairs.push([a.id, pool[bestIdx].id]);
    pool.splice(bestIdx, 1);
  }
  return pairs;
}

/** Pair unmatched submissions in the open round into active 1-vs-1 battles (ELO-sorted, rematch-aware). */
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

  // Buffer floor (FR-5): a pairing consumes the last two free tracks, so it
  // would leave the queue empty. Hold them in the buffer instead — the site
  // shows no live battle rather than advancing into one.
  const BUFFER_FLOOR = 3;
  if (unmatched.length - 2 < BUFFER_FLOOR) return 0;

  // Council spec (2026-10-04): exactly one live battle site-wide. New pairing
  // is blocked at the cap, so the ladder winds down to a single headline fight
  // instead of fanning out across the roster. Raise to run more concurrently.
  const activeCount = (matched ?? []).length;
  if (activeCount >= MAX_CONCURRENT_BATTLES) return 0;

  const userIds = [...new Set(unmatched.map((s) => s.user_id))];
  const { data: profiles } = await service
    .from('profiles')
    .select('id, elo_rating')
    .in('id', userIds);

  const eloMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.elo_rating]));
  const sorted = [...unmatched].sort(
    (a, b) => (eloMap[a.user_id] ?? 1000) - (eloMap[b.user_id] ?? 1000),
  );

  // Rematch history across all rounds, so simultaneous resolutions don't
  // rebuild the exact same fights.
  const { data: past } = await service
    .from('matches')
    .select('track_a_id, track_b_id');
  const history = buildPairHistory(past ?? []);

  // Respect the cap on THIS creation burst too — after a full drain,
  // greedyPair would otherwise re-fill the board in one shot.
  const slots = Math.max(0, MAX_CONCURRENT_BATTLES - activeCount);
  const pairs = greedyPair(
    sorted.map((s) => ({ id: s.id, elo: eloMap[s.user_id] ?? 1000 })),
    history,
  ).slice(0, slots);

  let created = 0;
  for (const [aId, bId] of pairs) {
    const { error } = await service.from('matches').insert({
      round_id: roundId,
      track_a_id: aId,
      track_b_id: bId,
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
