import { createClient } from '@/lib/supabase/server';
import SiteHeader from '@/components/SiteHeader';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: rankings } = await supabase
    .from('profiles')
    .select('id, username, elo_rating, votes_cast, submissions_count')
    .order('elo_rating', { ascending: false })
    .limit(50) as { data: any[] | null; error: unknown };

  const { data: { user } } = await supabase.auth.getUser();

  const tierLabel = (elo: number) => {
    if (elo >= 1400) return { label: 'CHAMPION', color: '#ffb300' };
    if (elo >= 1200) return { label: 'VETERAN', color: '#6abf3a' };
    if (elo >= 1100) return { label: 'CONTENDER', color: '#74b9f3' };
    return { label: 'ROOKIE', color: '#aaa' };
  };

  return (
    <div style={{ fontFamily: 'monospace', background: '#f9f9f7', minHeight: '100vh', color: '#000' }}>
      <SiteHeader currentPage="leaderboard" user={user} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: 32 }}>
        <div style={{ border: '3px solid #000' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '48px 1fr 80px 80px 100px',
            background: '#000', color: '#f9f9f7',
            padding: '10px 16px', fontSize: 9, letterSpacing: 2, fontWeight: 700,
          }}>
            <span>#</span><span>PRODUCER</span>
            <span style={{ textAlign: 'right' }}>ELO</span>
            <span style={{ textAlign: 'right' }}>VOTES</span>
            <span style={{ textAlign: 'right' }}>TIER</span>
          </div>

          {(rankings ?? []).map((p: any, i: number) => {
            const { label, color } = tierLabel(p.elo_rating);
            const isMe = user?.id === p.id;
            return (
              <div
                key={p.id}
                style={{
                  display: 'grid', gridTemplateColumns: '48px 1fr 80px 80px 100px',
                  padding: '12px 16px', borderBottom: '2px solid #000',
                  background: isMe ? '#000' : i % 2 === 0 ? '#f9f9f7' : '#f2f2f0',
                  color: isMe ? '#f9f9f7' : '#000',
                  fontSize: 11, fontWeight: isMe ? 700 : 400,
                }}
              >
                <span style={{ fontWeight: 700 }}>{i === 0 ? '▲' : i + 1}</span>
                <span style={{ letterSpacing: 1 }}>{p.username ?? 'ANONYMOUS'}{isMe ? ' ←' : ''}</span>
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{p.elo_rating}</span>
                <span style={{ textAlign: 'right', color: isMe ? '#ccc' : '#666' }}>{p.votes_cast}</span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ background: color, color: '#000', padding: '2px 6px', fontSize: 8, fontWeight: 900, letterSpacing: 1 }}>
                    {label}
                  </span>
                </span>
              </div>
            );
          })}

          {(!rankings || rankings.length === 0) && (
            <div style={{ padding: 48, textAlign: 'center', fontSize: 11, color: '#666', letterSpacing: 2 }}>
              NO RANKINGS YET
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
