import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ArenaPlayer from '@/components/ArenaPlayer';
import RenderWavButton from '@/components/RenderWavButton';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const TRACK_COLORS = { a: '#74b9f3', b: '#ffb300' };

interface Props {
  params: Promise<{ matchId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: match } = await supabase
    .from('matches')
    .select(`
      track_a:submissions!matches_track_a_id_fkey(title),
      track_b:submissions!matches_track_b_id_fkey(title)
    `)
    .eq('id', matchId)
    .maybeSingle() as unknown as { data: { track_a: { title: string } | null; track_b: { title: string } | null } | null };
  if (!match?.track_a || !match?.track_b) return { title: 'The Beatdown' };
  return { title: `${match.track_a.title} vs ${match.track_b.title} — The Beatdown` };
}

export default async function EmbedBattlePage({ params }: Props) {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: match } = await supabase
    .from('matches')
    .select(`
      id, votes_a, votes_b, status, winner_id,
      track_a:submissions!matches_track_a_id_fkey(id, title, arrangement, user_id, profiles(username)),
      track_b:submissions!matches_track_b_id_fkey(id, title, arrangement, user_id, profiles(username))
    `)
    .eq('id', matchId)
    .maybeSingle() as unknown as { data: {
      id: string; votes_a: number; votes_b: number; status: string; winner_id: string | null;
      track_a: { id: string; title: string; arrangement: any; user_id: string; profiles: { username: string } | null } | null;
      track_b: { id: string; title: string; arrangement: any; user_id: string; profiles: { username: string } | null } | null;
    } | null };

  if (!match?.track_a || !match?.track_b) notFound();

  const producerOf = (t: { profiles: { username: string } | null }) =>
    (t.profiles?.username ?? 'Unknown Producer').toUpperCase();
  const winnerIsA = match.winner_id === match.track_a.id;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bd-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: 'var(--bd-ink)', color: 'var(--bd-on-ink)', padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: 'monospace', fontWeight: 900, fontSize: 10, letterSpacing: 3,
      }}>
        <span>THE BEATDOWN · ARENA BATTLE {match.status === 'resolved' ? '· RESOLVED' : '· LIVE'}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: TRACK_COLORS.a }}>{match.votes_a}</span>
          {' : '}
          <span style={{ color: TRACK_COLORS.b }}>{match.votes_b}</span>
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', minHeight: 0 }}>
        <div style={{ flex: '1 1 480px', display: 'flex', minWidth: 0, position: 'relative' }}>
          <ArenaPlayer arrangement={match.track_a.arrangement} color={TRACK_COLORS.a} label={`SIDE A — ${producerOf(match.track_a)}`} title={match.track_a.title} />
          {match.status === 'resolved' && winnerIsA && <WinnerBadge />}
        </div>
        <div style={{ flex: '1 1 480px', display: 'flex', minWidth: 0, position: 'relative', borderLeft: '3px solid var(--bd-ink)' }}>
          <ArenaPlayer arrangement={match.track_b.arrangement} color={TRACK_COLORS.b} label={`SIDE B — ${producerOf(match.track_b)}`} title={match.track_b.title} />
          {match.status === 'resolved' && match.winner_id && !winnerIsA && <WinnerBadge />}
        </div>
      </div>

      <div style={{
        background: 'var(--bd-ink)', color: 'var(--bd-on-ink)', padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, fontWeight: 700, flexWrap: 'wrap',
      }}>
        <span>LISTEN TO BOTH SIDES, THEN VOTE</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <RenderWavButton arrangement={match.track_a.arrangement} title={`${match.track_a.title} (Side A)`} />
          <RenderWavButton arrangement={match.track_b.arrangement} title={`${match.track_b.title} (Side B)`} />
          <Link href="/arena" style={{ color: '#fff', background: 'var(--bd-red)', padding: '4px 10px', textDecoration: 'none' }}>
            ▶ VOTE IN THE ARENA
          </Link>
        </span>
      </div>
    </div>
  );
}

function WinnerBadge() {
  return (
    <div style={{
      position: 'absolute', top: 10, right: 10, zIndex: 2,
      background: 'var(--bd-red)', color: '#fff', border: '2px solid #000',
      fontFamily: 'monospace', fontWeight: 900, fontSize: 9, letterSpacing: 2, padding: '3px 8px',
    }}>
      WINNER 🏆
    </div>
  );
}
