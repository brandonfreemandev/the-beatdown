import { createClient } from '@/lib/supabase/server';
import { resolveExpiredMatches } from '@/lib/battleLifecycle';
import RefereeClient from '@/components/RefereeClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

// /referee — the evergreen funnel: whatever battle is live RIGHT NOW, one tap
// to vote. Per-battle links rot as fights settle; this destination can't.

export function generateMetadata(): Metadata {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  return {
    title: 'You are the referee — The Beatdown',
    description: 'My robots are fighting. You are the referee. Listen to both sides of the live AI beat battle and vote — one tap, no account.',
    openGraph: {
      title: 'You are the referee — The Beatdown',
      description: 'My robots are fighting. You are the referee. Listen and vote on the live AI beat battle — one tap, no account.',
      url: `${site}/referee`,
      siteName: 'The Beatdown',
      type: 'website',
      images: [{ url: `${site}/api/og/referee`, width: 1200, height: 630, alt: 'You are the referee — The Beatdown' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'You are the referee — The Beatdown',
      description: 'My robots are fighting. You are the referee. Listen and vote on the live AI beat battle.',
      images: [`${site}/api/og/referee`],
    },
  };
}

export default async function RefereePage() {
  // Time-box: viewing resolves expired battles, so "the current fight" is honest.
  await resolveExpiredMatches().catch(() => {});
  const supabase = await createClient();

  const [matchResult, championResult, lastFightResult] = await Promise.all([
    supabase
      .from('matches')
      .select(`
        id, votes_a, votes_b, status, winner_id, created_at,
        track_a:submissions!matches_track_a_id_fkey(id, title, arrangement, profiles(username)),
        track_b:submissions!matches_track_b_id_fkey(id, title, arrangement, profiles(username))
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1) as unknown as Promise<{ data: any[] | null }>,
    supabase
      .from('profiles')
      .select('username, elo_rating')
      .order('elo_rating', { ascending: false })
      .limit(1) as unknown as Promise<{ data: { username: string; elo_rating: number }[] | null }>,
    // The fight a late referral most likely came for — shown read-only in the
    // gap state (council: result yes, voting chrome never, CTA always).
    supabase
      .from('matches')
      .select(`
        id, votes_a, votes_b, winner_id, created_at,
        track_a:submissions!matches_track_a_id_fkey(title),
        track_b:submissions!matches_track_b_id_fkey(title)
      `)
      .eq('status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(1) as unknown as Promise<{ data: any[] | null }>,
  ]);

  const match = matchResult.data?.[0] ?? null;
  const cardMatch = match?.track_a && match?.track_b ? {
    id: match.id,
    votes_a: match.votes_a,
    votes_b: match.votes_b,
    status: match.status as 'active' | 'resolved',
    winner_id: match.winner_id,
    created_at: match.created_at,
    track_a: { id: match.track_a.id, title: match.track_a.title, arrangement: match.track_a.arrangement },
    track_b: { id: match.track_b.id, title: match.track_b.title, arrangement: match.track_b.arrangement },
  } : null;

  const champion = championResult.data?.[0] ?? null;

  const lastFightRow = lastFightResult.data?.[0] ?? null;
  const lastFight = lastFightRow?.track_a && lastFightRow?.track_b ? {
    aTitle: lastFightRow.track_a.title,
    bTitle: lastFightRow.track_b.title,
    votesA: lastFightRow.votes_a,
    votesB: lastFightRow.votes_b,
    winnerTitle: lastFightRow.winner_id === lastFightRow.track_a.id
      ? lastFightRow.track_a.title
      : lastFightRow.winner_id === lastFightRow.track_b.id ? lastFightRow.track_b.title : null,
  } : null;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bd-bg)', display: 'flex', flexDirection: 'column', fontFamily: 'monospace' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 24px', borderBottom: '3px solid var(--bd-ink)',
        fontWeight: 700, fontSize: 11, letterSpacing: 4,
      }}>
        <span>THE BEATDOWN</span>
        <span style={{ color: 'var(--bd-red)' }}>● LIVE</span>
      </div>

      <div className="page-scroll" style={{ flex: '1 1 0', overflowY: 'auto' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '8px 24px 64px' }}>
          <RefereeClient match={cardMatch} champion={champion} lastFight={lastFight} />
        </div>
      </div>
    </div>
  );
}
