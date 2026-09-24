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
  votes_received: number;
  submissions_count: number;
  is_admin?: boolean;
  track: { title: string; arrangement: ArrangementData } | null;
}

interface Props {
  rankings: RankingRow[];
  user: User | null;
  myProfile: RankingRow | null;
  votesRequired: number;
}

export default function LeaderboardClient({ rankings, user, myProfile, votesRequired: voteThreshold }: Props) {
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const total = rankings.length;

  return (
    <div
      className="page-shell"
      style={{ fontFamily: 'monospace', display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: 'var(--bd-bg)', color: 'var(--bd-ink)' }}
    >
      <SiteNav currentPage="leaderboard" user={user} isAdmin={myProfile?.is_admin ?? false} votesCast={myProfile?.votes_cast ?? null} votesRequired={voteThreshold} />

      <div
        className="page-scroll"
        style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}
      >

      <div className="lb-page">

        {/* Stats header */}
        <div className="lb-stats">
          {[
            { label: 'PRODUCERS', value: total },
            { label: 'TOP ELO', value: rankings[0]?.elo_rating ?? '—' },
            { label: 'FLOOR ELO', value: rankings[total - 1]?.elo_rating ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="lb-stat">
              <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--bd-muted)', fontWeight: 700 }}>{label}</div>
              <div className="lb-stat-value" style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="lb-table">
          <div className="lb-row lb-row-head">
            <span className="lb-col-num">RANK</span>
            <span />
            <span className="lb-col-producer">PRODUCER</span>
            <span className="lb-col-elo">ELO</span>
            <span className="lb-col-won">WON</span>
            <span className="lb-col-tier">TIER</span>
          </div>

          {rankings.map((p, i) => {
            const { label, color } = tierLabel(p.elo_rating);
            const isMe = user?.id === p.id;
            const isPodium = i < 3;
            const medalBg = isPodium ? MEDAL_BG[i] : null;

            return (
              <div
                key={p.id}
                className={`lb-row${isPodium ? ' lb-row-podium' : ''}`}
                style={{
                  borderBottom: '2px solid var(--bd-ink)',
                  background: isMe ? 'var(--bd-ink)' : medalBg ?? (i % 2 === 0 ? 'var(--bd-bg)' : 'var(--bd-bg-alt)'),
                  color: isMe ? 'var(--bd-on-ink)' : medalBg ? '#000' : 'var(--bd-ink)',
                  fontSize: 11,
                  fontWeight: isPodium || isMe ? 700 : 400,
                  borderLeft: isPodium ? `5px solid ${MEDAL_BG[i]}` : isMe ? '5px solid var(--bd-ink)' : '5px solid transparent',
                }}
              >
                <span className="lb-col-num" style={{ fontSize: isPodium ? 14 : 11 }}>
                  {isPodium ? MEDALS[i] : i + 1}
                </span>
                <RowPlayButton
                  rowId={p.id}
                  track={p.track}
                  isActiveRow={activeRowId === p.id}
                  onActivate={() => setActiveRowId(p.id)}
                />
                <span className="lb-col-producer">
                  {p.username ?? 'ANONYMOUS'}{isMe ? ' ←' : ''}
                </span>
                <span className="lb-col-elo" style={{ fontSize: isPodium ? 13 : 11 }}>
                  {p.elo_rating}
                </span>
                <span className="lb-col-won" style={{ color: isMe ? 'var(--bd-on-ink-muted)' : medalBg ? '#666' : 'var(--bd-muted)' }}>
                  {p.votes_received}
                </span>
                <span className="lb-col-tier">
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

  if (!track) return <span className="lb-play lb-play-empty" aria-hidden />;

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
