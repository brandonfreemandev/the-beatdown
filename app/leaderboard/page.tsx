import { createClient } from '@/lib/supabase/server';
import SiteHeader from '@/components/SiteHeader';

export const dynamic = 'force-dynamic';

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_BG = ['#ffd700', '#c0c0c0', '#cd7f32'];

const tierLabel = (elo: number) => {
  if (elo >= 1400) return { label: 'CHAMPION', color: '#ffb300' };
  if (elo >= 1200) return { label: 'VETERAN', color: '#6abf3a' };
  if (elo >= 1100) return { label: 'CONTENDER', color: '#74b9f3' };
  return { label: 'ROOKIE', color: '#ccc' };
};

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [{ data: rankings }, { data: { user } }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, elo_rating, votes_cast, submissions_count')
      .order('elo_rating', { ascending: false })
      .limit(50) as unknown as Promise<{ data: any[] | null }>,
    supabase.auth.getUser(),
  ]);

  const total = rankings?.length ?? 0;

  return (
    <div style={{ fontFamily: 'monospace', background: '#f9f9f7', minHeight: '100vh', color: '#000' }}>
      <SiteHeader currentPage="leaderboard" user={user} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

        {/* Stats header */}
        <div style={{ display: 'flex', border: '3px solid #000', marginBottom: 32 }}>
          {[
            { label: 'PRODUCERS', value: total },
            { label: 'TOP ELO', value: rankings?.[0]?.elo_rating ?? '—' },
            { label: 'FLOOR ELO', value: rankings?.[total - 1]?.elo_rating ?? '—' },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              flex: 1, padding: '14px 20px',
              borderRight: i < 2 ? '3px solid #000' : 'none',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#666', fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ border: '3px solid #000' }}>
          {/* Column header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '52px 1fr 90px 80px 110px',
            background: '#000', color: '#f9f9f7',
            padding: '10px 16px', fontSize: 9, letterSpacing: 2, fontWeight: 700,
          }}>
            <span>RANK</span>
            <span>PRODUCER</span>
            <span style={{ textAlign: 'right' }}>ELO</span>
            <span style={{ textAlign: 'right' }}>VOTES</span>
            <span style={{ textAlign: 'right' }}>TIER</span>
          </div>

          {(rankings ?? []).map((p: any, i: number) => {
            const { label, color } = tierLabel(p.elo_rating);
            const isMe = user?.id === p.id;
            const isPodium = i < 3;
            const medalBg = isPodium ? MEDAL_BG[i] : null;

            return (
              <div
                key={p.id}
                style={{
                  display: 'grid', gridTemplateColumns: '52px 1fr 90px 80px 110px',
                  padding: isPodium ? '16px' : '11px 16px',
                  borderBottom: '2px solid #000',
                  background: isMe ? '#000' : medalBg ?? (i % 2 === 0 ? '#f9f9f7' : '#f2f2f0'),
                  color: isMe ? '#f9f9f7' : '#000',
                  fontSize: 11,
                  fontWeight: isPodium || isMe ? 700 : 400,
                  borderLeft: isPodium ? `5px solid ${MEDAL_BG[i]}` : isMe ? '5px solid #000' : '5px solid transparent',
                }}
              >
                <span style={{ fontWeight: 900, fontSize: isPodium ? 14 : 11 }}>
                  {isPodium ? MEDALS[i] : i + 1}
                </span>
                <span style={{ letterSpacing: 1 }}>
                  {p.username ?? 'ANONYMOUS'}{isMe ? ' ←' : ''}
                </span>
                <span style={{ textAlign: 'right', fontWeight: 900, fontSize: isPodium ? 13 : 11 }}>
                  {p.elo_rating}
                </span>
                <span style={{ textAlign: 'right', color: isMe ? '#aaa' : '#666' }}>
                  {p.votes_cast}
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{
                    background: color, color: '#000',
                    padding: '2px 7px', fontSize: 8, fontWeight: 900, letterSpacing: 1,
                  }}>
                    {label}
                  </span>
                </span>
              </div>
            );
          })}

          {(!rankings || rankings.length === 0) && (
            <div style={{ padding: '64px 32px', textAlign: 'center', fontSize: 11, color: '#666', letterSpacing: 2 }}>
              NO RANKINGS YET
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
