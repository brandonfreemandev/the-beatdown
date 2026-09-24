import { createClient } from '@/lib/supabase/server';
import { votesRequired } from '@/lib/gatekeeper';
import ArenaClient from './ArenaClient';

export const dynamic = 'force-dynamic';

export default async function ArenaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: matches }, { data: round }, { count: activeBattles }] = await Promise.all([
    supabase
      .from('matches')
      .select(`
      id, votes_a, votes_b, status, winner_id,
      track_a:submissions!matches_track_a_id_fkey(id, title, arrangement),
      track_b:submissions!matches_track_b_id_fkey(id, title, arrangement)
    `)
      .in('status', ['active', 'resolved'])
      .order('created_at', { ascending: false })
      .limit(10) as unknown as Promise<{ data: any[] | null }>,
    supabase.from('rounds').select('entry_count').eq('status', 'open').order('started_at', { ascending: false }).limit(1).maybeSingle() as unknown as Promise<{ data: { entry_count: number } | null }>,
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'active') as unknown as Promise<{ count: number | null }>,
  ]);

  const voteThreshold = votesRequired(round?.entry_count ?? 4, activeBattles ?? 0);

  let userVotes: string[] = [];
  if (user) {
    const { data: votes } = await supabase
      .from('votes')
      .select('match_id')
      .eq('user_id', user.id) as { data: { match_id: string }[] | null; error: unknown };
    userVotes = (votes ?? []).map((v) => v.match_id);
  }

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle() as { data: any; error: unknown };
    profile = data;
  }

  return (
    <ArenaClient
      user={user}
      profile={profile}
      matches={matches ?? []}
      userVotes={userVotes}
      votesRequired={voteThreshold}
    />
  );
}
