import { createClient } from '@/lib/supabase/server';
import ArenaClient from './ArenaClient';

export const dynamic = 'force-dynamic';

export default async function ArenaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, votes_a, votes_b, status,
      track_a:submissions!matches_track_a_id_fkey(id, title, arrangement),
      track_b:submissions!matches_track_b_id_fkey(id, title, arrangement)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10) as { data: any[] | null; error: unknown };

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
      .single() as { data: any; error: unknown };
    profile = data;
  }

  return (
    <ArenaClient
      user={user}
      profile={profile}
      matches={matches ?? []}
      userVotes={userVotes}
    />
  );
}
