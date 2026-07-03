'use client';
import { useState, useEffect } from 'react';
import SiteNav from '@/components/SiteNav';
import { useTrackPlayback } from '@/lib/useTrackPlayback';
import type { ArrangementData } from '@/lib/supabase/types';
import type { User } from '@supabase/supabase-js';

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_BG = ['#ffd700', '#c0c0c0', '#cd7f32'];

const tierLabel = (elo: number) => {
  if (elo >= 1400) return { label: 'CHAMPION', color: '#ffb300' };
  if (elo >= 1200) return { label: 'VETERAN', color: '#6abf3a' };
  if (elo >= 1100) return { label: 'CONTENDER', color: '#74b9f3' };
  return { label: 'ROOKIE', color: '#ccc' };
};

interface RankingRow {
  id: string;
  username: string | null;
  elo_rating: number;
  votes_cast: number;
  submissions_count: number;
  is_admin?: boolean;
  track: { title: string; arrangement: ArrangementData } | null;
}

interface Props {
  rankings: RankingRow[];
  user: User | null;
  myProfile: RankingRow | null;
}

export default function LeaderboardClient({ rankings, user, myProfile }: Props) {
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const total = rankings.length;

  return (
    <div style={{ fontFamily: 'monospace', background: 'var(--bd-bg)', minHeight: '100vh', color: 'var(--bd-ink)' }}>
      <SiteNav currentPage="leaderboard" user={user} isAdmin={myProfile?.is_admin ?? false} votesCast={myProfile?.votes_cast ?? null} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

        {/* Stats header */}
        <div style={{ display: 'flex', border: '3px solid var(--bd-ink)', marginBottom: 32 }}>
          {[
            { label: 'PRODUCERS', value: total },
            { label: 'TOP ELO', value: rankings[0]?.elo_rating ?? '—' },
            { label: 'FLOOR ELO', value: rankings[total - 1]?.elo_rating ?? '—' },
          ].map(({ label, value }, i) => (
            <div key={label} style={{
              flex: 1, padding: '14px 20px',
              borderRight: i < 2 ? '3px solid var(--bd-ink)' : 'none',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--bd-muted)', fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ border: '3px solid var(--bd-ink)' }}>
          {/* Column header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '52px 40px 1fr 90px 80px 110px',
            background: 'var(--bd-ink)', color: 'var(--bd-on-ink)',
            padding: '10px 16px', fontSize: 9, letterSpacing: 2, fontWeight: 700,
          }}>
            <span>RANK</span>
            <span />
            <span>PRODUCER</span>
            <span style={{ textAlign: 'right' }}>ELO</span>
            <span style={{ textAlign: 'right' }}>VOTES</span>
            <span style={{ textAlign: 'right' }}>TIER</span>
          </div>

          {rankings.map((p, i) => {
            const { label, color } = tierLabel(p.elo_rating);
            const isMe = user?.id === p.id;
            const isPodium = i < 3;
            const medalBg = isPodium ? MEDAL_BG[i] : null;

            return (
              <div
                key={p.id}
                style={{
                  display: 'grid', gridTemplateColumns: '52px 40px 1fr 90px 80px 110px',
                  alignItems: 'center',
                  padding: isPodium ? '10px 16px' : '8px 16px',
                  borderBottom: '2px solid var(--bd-ink)',
                  background: isMe ? 'var(--bd-ink)' : medalBg ?? (i % 2 === 0 ? 'var(--bd-bg)' : 'var(--bd-bg-alt)'),
                  // Medal backgrounds are fixed accents — text on them stays literal black in both themes
                  color: isMe ? 'var(--bd-on-ink)' : medalBg ? '#000' : 'var(--bd-ink)',
                  fontSize: 11,
                  fontWeight: isPodium || isMe ? 700 : 400,
                  borderLeft: isPodium ? `5px solid ${MEDAL_BG[i]}` : isMe ? '5px solid var(--bd-ink)' : '5px solid transparent',
                }}
              >
                <span style={{ fontWeight: 900, fontSize: isPodium ? 14 : 11 }}>
                  {isPodium ? MEDALS[i] : i + 1}
                </span>
                <RowPlayButton
                  rowId={p.id}
                  track={p.track}
                  isActiveRow={activeRowId === p.id}
                  onActivate={() => setActiveRowId(p.id)}
                />
                <span style={{ letterSpacing: 1 }}>
                  {p.username ?? 'ANONYMOUS'}{isMe ? ' ←' : ''}
                </span>
                <span style={{ textAlign: 'right', fontWeight: 900, fontSize: isPodium ? 13 : 11 }}>
                  {p.elo_rating}
                </span>
                <span style={{ textAlign: 'right', color: isMe ? 'var(--bd-on-ink-muted)' : medalBg ? '#666' : 'var(--bd-muted)' }}>
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

          {rankings.length === 0 && (
            <div style={{ padding: '64px 32px', textAlign: 'center', fontSize: 11, color: 'var(--bd-muted)', letterSpacing: 2 }}>
              NO RANKINGS YET
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RowPlayButton({ track, isActiveRow, onActivate }: {
  rowId: string;
  track: { title: string; arrangement: ArrangementData } | null;
  isActiveRow: boolean;
  onActivate: () => void;
}) {
  const { playing, toggle, stop } = useTrackPlayback(track?.arrangement ?? null);

  // Another row became active — stop this one so only one track plays at a time.
  useEffect(() => {
    if (!isActiveRow && playing) stop();
  }, [isActiveRow, playing, stop]);

  if (!track) return <span />;

  return (
    <button
      onClick={() => { if (!playing) onActivate(); toggle(); }}
      className={`lb-play${playing ? ' playing' : ''}`}
      aria-label={playing ? `Stop ${track.title}` : `Play ${track.title}`}
      title={playing ? `Stop ${track.title}` : `Play ${track.title}`}
    >
      {playing ? (
        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="currentColor" /></svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 1 L9 5 L2 9 Z" fill="currentColor" /></svg>
      )}
    </button>
  );
}
