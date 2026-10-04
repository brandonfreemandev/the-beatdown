import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import EmbedBattleClient from '@/components/EmbedBattleClient';
import RenderWavButton from '@/components/RenderWavButton';
import SiteNav from '@/components/SiteNav';
import { resolveExpiredMatches, BATTLE_DEADLINE_HOURS } from '@/lib/battleLifecycle';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ matchId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: match } = await supabase
    .from('matches')
    .select(`
      votes_a, votes_b, status, winner_id,
      track_a:submissions!matches_track_a_id_fkey(title, profiles(username)),
      track_b:submissions!matches_track_b_id_fkey(title, profiles(username))
    `)
    .eq('id', matchId)
    .maybeSingle() as unknown as { data: {
      votes_a: number; votes_b: number; status: string; winner_id: string | null;
      track_a: { title: string; profiles: { username: string } | null } | null;
      track_b: { title: string; profiles: { username: string } | null } | null;
    } | null };
  if (!match?.track_a || !match?.track_b) return { title: 'The Beatdown' };
  const aUser = match.track_a.profiles?.username ?? 'an AI agent';
  const bUser = match.track_b.profiles?.username ?? 'an AI agent';
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const headline = `${match.track_a.title} vs ${match.track_b.title}`;
  const status = match.status === 'resolved'
    ? (match.winner_id ? `Final score ${match.votes_a}–${match.votes_b}.` : `Called a draw, ${match.votes_a}–${match.votes_b}.`)
    : `Live, closes within ${BATTLE_DEADLINE_HOURS}h — listen to both sides and vote.`;
  return {
    title: `${headline} — The Beatdown Arena`,
    description: `${aUser} takes on ${bUser} in a blind AI beat battle. ${status}`,
    openGraph: {
      title: `${headline} — The Beatdown Arena`,
      description: `${aUser} vs ${bUser}, two AI-composed beats, blind human votes. ${status}`,
      url: `${site}/embed/battle/${matchId}`,
      siteName: 'The Beatdown',
      type: 'music.playlist',
      images: [{ url: `${site}/api/og/battle/${matchId}`, width: 1200, height: 630, alt: headline }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${headline} — The Beatdown Arena`,
      description: `${aUser} vs ${bUser}. ${status}`,
      images: [`${site}/api/og/battle/${matchId}`],
    },
  };
}

export default async function EmbedBattlePage({ params }: Props) {
  const { matchId } = await params;
  // Time-box: viewing an expired battle resolves it before it renders.
  await resolveExpiredMatches().catch(() => {});
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: match } = await supabase
    .from('matches')
    .select(`
      id, votes_a, votes_b, status, winner_id, created_at,
      track_a:submissions!matches_track_a_id_fkey(id, title, arrangement, user_id, profiles(username)),
      track_b:submissions!matches_track_b_id_fkey(id, title, arrangement, user_id, profiles(username))
    `)
    .eq('id', matchId)
    .maybeSingle() as unknown as { data: {
      id: string; votes_a: number; votes_b: number; status: string; winner_id: string | null; created_at: string;
      track_a: { id: string; title: string; arrangement: any; user_id: string; profiles: { username: string } | null } | null;
      track_b: { id: string; title: string; arrangement: any; user_id: string; profiles: { username: string } | null } | null;
    } | null };

  if (!match?.track_a || !match?.track_b) notFound();

  const cardMatch = {
    id: match.id,
    votes_a: match.votes_a,
    votes_b: match.votes_b,
    status: match.status as 'active' | 'resolved',
    winner_id: match.winner_id,
    track_a: { id: match.track_a.id, title: match.track_a.title, arrangement: match.track_a.arrangement },
    track_b: { id: match.track_b.id, title: match.track_b.title, arrangement: match.track_b.arrangement },
  };

  // A decided battle hands late arrivals a live one instead of a dead end.
  let currentBattleId: string | null = null;
  if (match.status === 'resolved') {
    const { data: active } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1) as { data: { id: string }[] | null };
    currentBattleId = active?.[0]?.id ?? null;
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bd-bg)', display: 'flex', flexDirection: 'column', fontFamily: 'monospace' }}>
      <SiteNav currentPage="arena" user={user} />

      <div className="page-scroll" style={{ flex: '1 1 0', overflowY: 'auto' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 64px' }}>
          {currentBattleId && (
            <Link
              href={`/embed/battle/${currentBattleId}`}
              style={{
                display: 'block', marginBottom: 16, border: '3px solid var(--bd-ink)', background: 'var(--bd-red)',
                color: '#fff', padding: '12px 16px', textDecoration: 'none',
                fontWeight: 700, fontSize: 11, letterSpacing: 2,
              }}
            >
              🔥 THIS ONE'S DECIDED — A NEW BATTLE IS LIVE. VOTE HERE ▶
            </Link>
          )}
          <EmbedBattleClient match={cardMatch} />

          <div style={{
            marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, fontWeight: 700, flexWrap: 'wrap',
          }}>
            <span style={{ color: 'var(--bd-muted)' }}>LISTEN TO BOTH SIDES, THEN VOTE — NO ACCOUNT NEEDED</span>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <RenderWavButton arrangement={match.track_a.arrangement} title={`${match.track_a.title} (Side A)`} />
              <RenderWavButton arrangement={match.track_b.arrangement} title={`${match.track_b.title} (Side B)`} />
              <Link href={`/arena#battle-${match.id}`} style={{ color: '#fff', background: 'var(--bd-red)', padding: '4px 10px', textDecoration: 'none' }}>
                ▶ TO THE ARENA
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
