import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { evaluateResolveEligibility, guaranteeLine } from '@/lib/resolveRules';

export const dynamic = 'force-dynamic';
export const contentType = 'image/png';

// GET /api/og/battle/[matchId] — the fight-card image Discord/X see when a
// battle link is shared: both sides with their real sequencer patterns,
// live score, call to action.
const MODULES = ['drum', 'bass', 'pad', 'synth', 'arp'] as const;
const LABELS: Record<string, string> = { drum: 'DRUMS', bass: 'BASS', pad: 'PADS', synth: 'SYNTH', arp: 'ARP' };
const COLORS: Record<string, string> = { drum: '#74b9f3', bass: '#ffb300', pad: '#e8212b', synth: '#6abf3a', arp: '#00a693' };

// Static-card pattern pick: the first timeline block's pattern for the lane,
// else the vault's active/first pattern, else the flat grid. Mirrors how the
// sequencer previews resolve rich arrangements.
function laneGrid(arrangement: any, mod: string): boolean[][] | null {
  const vault = arrangement?.vaults?.[mod];
  if (vault?.patterns?.length) {
    const block = (arrangement.timeline ?? []).find((b: any) => b.moduleType === mod);
    const pid = block?.patternId ?? vault.activePatternId ?? vault.patterns[0].id;
    return vault.patterns.find((p: any) => p.id === pid)?.grid ?? vault.patterns[0].grid;
  }
  const g = arrangement?.grids?.[mod];
  if (Array.isArray(g) && Array.isArray(g[0])) return g;
  if (Array.isArray(g?.patterns) && g.patterns.length) return g.patterns[0].grid;
  return null;
}

function GridBlock({ arrangement }: { arrangement: any }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
      {MODULES.map((mod) => {
        const grid = laneGrid(arrangement, mod);
        return (
          <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 58, fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#9a9a94', flexShrink: 0 }}>
              {LABELS[mod]}
            </div>
            <div style={{ display: 'flex', flex: 1, gap: 2 }}>
              {Array.from({ length: 16 }, (_, ci) => {
                const on = grid?.some((row: boolean[]) => row[ci]);
                return (
                  <div key={ci} style={{
                    flex: 1, height: 20,
                    background: on ? COLORS[mod] : '#3a3a38',
                    marginLeft: ci > 0 && ci % 4 === 0 ? 5 : 0,
                  }} />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: match } = await supabase
    .from('matches')
    .select(`
      id, votes_a, votes_b, status, winner_id, created_at,
      track_a:submissions!matches_track_a_id_fkey(id, title, arrangement, profiles(username)),
      track_b:submissions!matches_track_b_id_fkey(id, title, arrangement, profiles(username))
    `)
    .eq('id', matchId)
    .maybeSingle() as unknown as { data: any | null };

  if (!match?.track_a || !match?.track_b) {
    return new Response('Not found', { status: 404 });
  }

  const resolved = match.status === 'resolved';
  const winnerIsA = match.winner_id != null && match.winner_id === match.track_a.id;
  // During the live guarantee the right footer shows the promise instead of
  // the domain — the one clock string the council asked for on the card.
  const elig = resolved ? null : (() => {
    try {
      return evaluateResolveEligibility({
        created_at: match.created_at,
        votes_a: match.votes_a,
        votes_b: match.votes_b,
        track_a_id: match.track_a.id,
        track_b_id: match.track_b.id,
      });
    } catch {
      return null;
    }
  })();
  const inGuarantee = !!elig && !elig.windowElapsed;
  const titleA = match.track_a.title.toUpperCase();
  const titleB = match.track_b.title.toUpperCase();
  const userA = (match.track_a.profiles?.username ?? 'UNKNOWN').toUpperCase();
  const userB = (match.track_b.profiles?.username ?? 'UNKNOWN').toUpperCase();
  const bpmA = match.track_a.arrangement?.bpm ?? 120;
  const bpmB = match.track_b.arrangement?.bpm ?? 120;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

  const banner = resolved
    ? (match.winner_id ? `FINAL · ${match.votes_a} : ${match.votes_b}` : `DRAW · ${match.votes_a} : ${match.votes_b}`)
    : `LIVE · ${match.votes_a} : ${match.votes_b} · VOTE NOW`;

  const side = (which: 'a' | 'b') => {
    const track = which === 'a' ? match.track_a : match.track_b;
    const color = which === 'a' ? '#74b9f3' : '#ffb300';
    const isWinner = which === 'a' ? winnerIsA : match.winner_id != null && !winnerIsA;
    const align = which === 'a' ? 'left' : 'right';
    const items = which === 'a' ? 'flex-start' : 'flex-end';
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '24px 30px', gap: 16, background: '#202020',
        borderTop: `6px solid ${color}`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: items }}>
          <div style={{ fontSize: 17, letterSpacing: 3, fontWeight: 700, color: '#9a9a94' }}>
            {`SIDE ${which.toUpperCase()} · ${track.profiles?.username?.toUpperCase() ?? 'UNKNOWN'}`}
          </div>
          <div style={{
            fontSize: 38, fontWeight: 900, lineHeight: 1.05,
            color: isWinner ? color : '#f9f9f7', textAlign: align as any,
          }}>
            {track.title.toUpperCase().slice(0, 44) + (isWinner ? ' 🏆' : '')}
          </div>
        </div>
        <GridBlock arrangement={track.arrangement} />
        <div style={{ fontSize: 17, letterSpacing: 2, color: '#9a9a94', textAlign: align as any }}>
          {`${track.arrangement?.bpm ?? 120} BPM`}
        </div>
      </div>
    );
  };

  try {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: '#161614', color: '#f9f9f7', fontFamily: 'sans-serif',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 30px', background: '#000000',
            fontSize: 24, letterSpacing: 8, fontWeight: 700,
          }}>
            <span>THE BEATDOWN</span>
            <span style={{ color: resolved ? '#f9f9f7' : '#e8212b' }}>{resolved ? 'RESOLVED' : '● LIVE BATTLE'}</span>
          </div>

          <div style={{ display: 'flex', flex: 1, gap: 6, padding: 6 }}>
            {side('a')}
            <div style={{
              width: 74, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#000', color: '#e8212b', fontSize: 44, fontWeight: 900, flexShrink: 0,
            }}>
              VS
            </div>
            {side('b')}
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 30px', background: '#000',
            fontSize: 27, fontWeight: 700, letterSpacing: 3,
          }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{banner}</span>
            <span style={{ color: '#9a9a94', fontSize: 21 }}>
              {inGuarantee && elig ? guaranteeLine(elig.windowOpensAt) : site.replace('https://', '')}
            </span>
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=120' } },
    );
  } catch (e) {
    console.error('OG image failed:', (e as Error).message);
    return new Response('OG render failed', { status: 500 });
  }
}
