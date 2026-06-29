'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ArenaPlayer from '@/components/ArenaPlayer';
import SiteHeader from '@/components/SiteHeader';
import type { Profile } from '@/lib/supabase/types';
import type { User } from '@supabase/supabase-js';

interface ArenaMatch {
  id: string;
  votes_a: number;
  votes_b: number;
  status: string;
  track_a: { id: string; title: string; arrangement: any };
  track_b: { id: string; title: string; arrangement: any };
}

interface Props {
  user: User | null;
  profile: Profile | null;
  matches: ArenaMatch[];
  userVotes: string[];
}

const TRACK_COLORS = { a: '#74b9f3', b: '#ffb300' };

export default function ArenaClient({ user, profile, matches, userVotes }: Props) {
  const router = useRouter();
  const [voted, setVoted] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [matchmaking, setMatchmaking] = useState(false);
  const [matchmakeResult, setMatchmakeResult] = useState('');

  const runMatchmaker = async () => {
    setMatchmaking(true);
    setMatchmakeResult('');
    const res = await fetch('/api/matchmaker', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setMatchmakeResult(`${data.pairs} match${data.pairs !== 1 ? 'es' : ''} created`);
      router.refresh();
    } else {
      setMatchmakeResult(data.error ?? 'Failed');
    }
    setMatchmaking(false);
  };

  const castVote = async (matchId: string, votedForId: string) => {
    if (!user) return;
    setLoading(matchId);
    setError('');
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, votedForId }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); }
    else { setVoted((v) => ({ ...v, [matchId]: votedForId })); router.refresh(); }
    setLoading(null);
  };

  const alreadyVoted = (matchId: string) =>
    userVotes.includes(matchId) || voted[matchId];

  return (
    <div style={{ fontFamily: 'monospace', background: '#f9f9f7', minHeight: '100vh', color: '#000' }}>
      <SiteHeader currentPage="arena" user={user} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

        {/* Stats bar */}
        {user && profile && (
          <div style={{ display: 'flex', border: '3px solid #000', marginBottom: 32 }}>
            {[
              { label: 'ELO', value: profile.elo_rating },
              { label: 'VOTES CAST', value: profile.votes_cast },
              { label: 'SUBMISSIONS', value: profile.submissions_count },
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
        )}

        {!user && (
          <div style={{ border: '3px solid #000', padding: '16px 20px', marginBottom: 32, fontSize: 11, letterSpacing: 1 }}>
            Sign in to cast votes and submit tracks to the Arena.
          </div>
        )}

        {/* Matchmaker */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
            <button
              onClick={runMatchmaker}
              disabled={matchmaking}
              style={{
                background: '#000', color: '#f9f9f7', border: 'none',
                fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 2,
                padding: '12px 22px', cursor: matchmaking ? 'wait' : 'pointer',
                opacity: matchmaking ? 0.6 : 1,
              }}
            >
              {matchmaking ? 'MATCHING…' : '⚡ RUN MATCHMAKER'}
            </button>
            {matchmakeResult && (
              <span style={{ fontSize: 10, letterSpacing: 1, color: '#666' }}>{matchmakeResult}</span>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: '#e8212b', color: '#fff', padding: '10px 16px', marginBottom: 24, fontSize: 11 }}>
            {error}
          </div>
        )}

        {/* Empty state */}
        {matches.length === 0 && (
          <div style={{ border: '3px solid #000', padding: '64px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 4, marginBottom: 16 }}>NO ACTIVE MATCHES</div>
            <div style={{ fontSize: 11, color: '#666', letterSpacing: 1, lineHeight: 1.8 }}>
              Submit a track from the Studio, then run the Matchmaker<br />
              to be paired with another producer.
            </div>
          </div>
        )}

        {/* Match cards */}
        {matches.map((match) => {
          const hasVoted = alreadyVoted(match.id);
          const myVote = voted[match.id] ?? (userVotes.includes(match.id) ? 'voted' : null);
          const isLoading = loading === match.id;
          const total = match.votes_a + match.votes_b;
          const pctA = total > 0 ? Math.round((match.votes_a / total) * 100) : 50;
          const pctB = total > 0 ? Math.round((match.votes_b / total) * 100) : 50;

          return (
            <div key={match.id} style={{ marginBottom: 48, border: '3px solid #000' }}>
              {/* Match header */}
              <div style={{
                background: '#000', color: '#f9f9f7',
                padding: '10px 16px', fontWeight: 700, fontSize: 9, letterSpacing: 3,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>BATTLE</span>
                <span style={{ color: '#666' }}>{match.votes_a + match.votes_b} VOTE{match.votes_a + match.votes_b !== 1 ? 'S' : ''}</span>
              </div>

              {/* Tracks */}
              <div style={{ display: 'flex' }}>
                <ArenaPlayer
                  arrangement={match.track_a.arrangement}
                  color={TRACK_COLORS.a}
                  label="TRACK A"
                  title={match.track_a.title}
                />
                <div style={{ width: 3, background: '#000', flexShrink: 0 }} />
                <ArenaPlayer
                  arrangement={match.track_b.arrangement}
                  color={TRACK_COLORS.b}
                  label="TRACK B"
                  title={match.track_b.title}
                />
              </div>

              {/* Vote bar */}
              {hasVoted && total > 0 && (
                <div style={{ height: 6, display: 'flex', borderTop: '2px solid #000' }}>
                  <div style={{ width: `${pctA}%`, background: TRACK_COLORS.a, transition: 'width 0.4s' }} />
                  <div style={{ flex: 1, background: TRACK_COLORS.b }} />
                </div>
              )}

              {/* Vote buttons */}
              <div style={{ borderTop: hasVoted && total > 0 ? 'none' : '3px solid #000', display: 'flex' }}>
                <VoteBtn
                  onClick={() => castVote(match.id, match.track_a.id)}
                  disabled={!!hasVoted || !user || isLoading}
                  active={myVote === match.track_a.id}
                  color={TRACK_COLORS.a}
                  label={hasVoted ? `${match.votes_a} vote${match.votes_a !== 1 ? 's' : ''} · ${pctA}%` : `VOTE FOR ${match.track_a.title.toUpperCase()}`}
                />
                <div style={{ width: 3, background: '#000', flexShrink: 0 }} />
                <VoteBtn
                  onClick={() => castVote(match.id, match.track_b.id)}
                  disabled={!!hasVoted || !user || isLoading}
                  active={myVote === match.track_b.id}
                  color={TRACK_COLORS.b}
                  label={hasVoted ? `${match.votes_b} vote${match.votes_b !== 1 ? 's' : ''} · ${pctB}%` : `VOTE FOR ${match.track_b.title.toUpperCase()}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VoteBtn({ onClick, disabled, active, color, label }: {
  onClick: () => void; disabled: boolean; active: boolean; color: string; label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '14px 12px',
        background: active ? color : 'transparent',
        border: 'none',
        fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 1,
        cursor: disabled ? 'default' : 'pointer',
        color: '#000',
        transition: 'background 0.15s',
        textAlign: 'center',
      }}
    >
      {label}
    </button>
  );
}
