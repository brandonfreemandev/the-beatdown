import { createClient } from '@/lib/supabase/server';
import LeaderboardClient from './LeaderboardClient';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [{ data: rankings }, { data: { user } }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, elo_rating, votes_cast, submissions_count, is_admin')
      .order('elo_rating', { ascending: false })
      .limit(50) as unknown as Promise<{ data: any[] | null }>,
    supabase.auth.getUser(),
  ]);

  const profileIds = (rankings ?? []).map((p) => p.id);

  // Each producer's most recent submission — used to power the play button per row.
  const tracksByUser = new Map<string, { title: string; arrangement: any }>();
  if (profileIds.length > 0) {
    const { data: submissions } = await supabase
      .from('submissions')
      .select('user_id, title, arrangement, created_at')
      .in('user_id', profileIds)
      .order('created_at', { ascending: false }) as unknown as { data: any[] | null };

    for (const s of submissions ?? []) {
      if (!tracksByUser.has(s.user_id)) {
        tracksByUser.set(s.user_id, { title: s.title, arrangement: s.arrangement });
      }
    }
  }

  const rankingsWithTracks = (rankings ?? []).map((p) => ({
    ...p,
    track: tracksByUser.get(p.id) ?? null,
  }));

  const myProfile = rankings?.find((p) => p.id === user?.id) ?? null;

  return (
    <LeaderboardClient
      rankings={rankingsWithTracks}
      user={user}
      myProfile={myProfile}
    />
  );
}
