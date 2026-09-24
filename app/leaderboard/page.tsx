import { createClient } from '@/lib/supabase/server';
import { votesRequired } from '@/lib/gatekeeper';
import { dedupeRankings } from '@/lib/dedupeRankings';
import LeaderboardClient from './LeaderboardClient';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [{ data: rankings }, { data: { user } }, { data: round }, { count: activeBattles }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, elo_rating, votes_cast, submissions_count, is_admin')
      .order('elo_rating', { ascending: false })
      .limit(50) as unknown as Promise<{ data: any[] | null }>,
    supabase.auth.getUser(),
    supabase.from('rounds').select('entry_count').eq('status', 'open').order('started_at', { ascending: false }).limit(1).maybeSingle() as unknown as Promise<{ data: { entry_count: number } | null }>,
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'active') as unknown as Promise<{ count: number | null }>,
  ]);

  const profileIds = (rankings ?? []).map((p) => p.id);

  const [{ data: submissions }, { data: voteRows }] = await Promise.all([
    supabase
      .from('submissions')
      .select('id, user_id, title, arrangement, created_at')
      .order('created_at', { ascending: false }) as unknown as { data: any[] | null },
    supabase.from('votes').select('voted_for_id') as unknown as { data: { voted_for_id: string }[] | null },
  ]);

  const subOwner = new Map((submissions ?? []).map((s) => [s.id, s.user_id]));
  const votesReceived = new Map<string, number>();
  for (const v of voteRows ?? []) {
    const owner = subOwner.get(v.voted_for_id);
    if (owner) votesReceived.set(owner, (votesReceived.get(owner) ?? 0) + 1);
  }

  // Each producer's most recent submission — used to power the play button per row.
  const tracksByUser = new Map<string, { title: string; arrangement: any }>();
  for (const s of submissions ?? []) {
    if (!tracksByUser.has(s.user_id)) {
      tracksByUser.set(s.user_id, { title: s.title, arrangement: s.arrangement });
    }
  }

  const rankingsWithTracks = dedupeRankings(
    (rankings ?? []).map((p) => ({
      ...p,
      votes_received: votesReceived.get(p.id) ?? 0,
      track: tracksByUser.get(p.id) ?? null,
    })),
  );

  const myProfile = rankings?.find((p) => p.id === user?.id) ?? null;

  return (
    <LeaderboardClient
      rankings={rankingsWithTracks}
      user={user}
      myProfile={myProfile}
      votesRequired={votesRequired(round?.entry_count ?? 4, activeBattles ?? 0)}
    />
  );
}
