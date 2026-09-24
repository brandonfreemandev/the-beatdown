/** Collapse leaderboard rows that share the same display name (e.g. two Google accounts). */
export interface RankedProfile {
  id: string;
  username: string | null;
  elo_rating: number;
  votes_received: number;
  track: unknown;
}

function baseUsername(name: string | null): string {
  return (name ?? 'Anonymous').replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase();
}

function scoreForKeep(p: RankedProfile): number {
  let score = 0;
  if (p.track) score += 1000;
  if (!/\([^)]+\)/.test(p.username ?? '')) score += 100;
  score += p.votes_received * 10 + p.elo_rating;
  return score;
}

export function dedupeRankings<T extends RankedProfile>(rankings: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rankings) {
    const key = baseUsername(row.username);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const kept: T[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    kept.push([...group].sort((a, b) => scoreForKeep(b) - scoreForKeep(a))[0]);
  }

  return kept.sort((a, b) => b.elo_rating - a.elo_rating);
}
