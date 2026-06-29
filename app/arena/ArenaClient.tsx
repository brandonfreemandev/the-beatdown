'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ArenaPlayer from '@/components/ArenaPlayer';
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

const BD: React.CSSProperties = { fontFamily: 'monospace', background: '#f9f9f7', minHeight: '100vh', color: '#000' };
const HEADER: React.CSSProperties = {
  background: '#000', color: '#f9f9f7', padding: '0 24px',
  height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  borderBottom: '3px solid #000',
};

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
      setMatchmakeResult(`✓ ${data.pairs} match${data.pairs !== 1 ? 'es' : ''} created`);
      router.refresh();
    } else {
      setMatchmakeResult(`✗ ${data.error ?? 'Failed'}`);
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
    <div style={BD}>
      {/* Nav */}
      <div style={HEADER}>
        <a href="/" style={{ color: '#f9f9f7', fontWeight: 900, fontSize: 13, letterSpacing: 3, textDecoration: 'none' }}>
          THE BEATDOWN
        </a>
        <nav style={{ display: 'flex', gap: 0 }}>
          {['STUDIO', 'ARENA', 'LEADERBOARD'].map((page) => (
            <a
              key={page}
              href={page === 'STUDIO' ? '/' : `/${page.toLowerCase()}`}
              style={{
                color: page === 'ARENA' ? '#000' : '#f9f9f7',
                background: page === 'ARENA' ? '#f9f9f7' : 'transparent',
                fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 2,
                padding: '0 16px', height: 48, display: 'flex', alignItems: 'center',
                textDecoration: 'none', borderLeft: '2px solid #333',
              }}
            >
              {page}
            </a>
          ))}
        </nav>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 32 }}>
        {/* Gatekeeper status */}
        {user && profile && (
          <div style={{ border: '2px solid #000', padding: '12px 16px', marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>
              VOTES CAST: <strong>{profile.votes_cast}</strong>
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>
              ELO: <strong>{profile.elo_rating}</strong>
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>
              SUBMISSIONS: <strong>{profile.submissions_count}</strong>
            </span>
          </div>
        )}

        {!user && (
          <div style={{ border: '2px solid #000', padding: '16px', marginBottom: 32, fontFamily: 'monospace', fontSize: 12 }}>
            Sign in to cast votes and unlock submission rights.
          </div>
        )}

        {/* Matchmaker — visible to signed-in users */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <button
              onClick={runMatchmaker}
              disabled={matchmaking}
              style={{
                background: '#000', color: '#f9f9f7', border: 'none',
                fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 2,
                padding: '10px 20px', cursor: matchmaking ? 'wait' : 'pointer',
                opacity: matchmaking ? 0.6 : 1,
              }}
            >
              {matchmaking ? 'MATCHING...' : '⚡ RUN MATCHMAKER'}
            </button>
            {matchmakeResult && (
              <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 1 }}>
                {matchmakeResult}
              </span>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: '#e8212b', color: '#fff', padding: '10px 16px', marginBottom: 24, fontFamily: 'monospace', fontSize: 11 }}>
            {error}
          </div>
        )}

        {matches.length === 0 && (
          <div style={{ textAlign: 'center', padding: 80, fontFamily: 'monospace' }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3, marginBottom: 12 }}>NO ACTIVE MATCHES</div>
            <div style={{ fontSize: 11, color: '#666', letterSpacing: 1 }}>Submit your track — the Matchmaker will pair you soon.</div>
          </div>
        )}

        {matches.map((match) => {
          const hasVoted = alreadyVoted(match.id);
          const myVote = voted[match.id] ?? (userVotes.includes(match.id) ? 'voted' : null);
          const isLoading = loading === match.id;
          const total = match.votes_a + match.votes_b;

          return (
            <div key={match.id} style={{ marginBottom: 48, border: '3px solid #000' }}>
              {/* Match header */}
              <div style={{ background: '#000', color: '#f9f9f7', padding: '8px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 3 }}>
                MATCH
              </div>

              {/* Tracks side by side */}
              <div style={{ display: 'flex', gap: 0 }}>
                <ArenaPlayer
                  arrangement={match.track_a.arrangement}
                  color="#74b9f3"
                  label="TRACK A"
                />
                <div style={{ width: 3, background: '#000', flexShrink: 0 }} />
                <ArenaPlayer
                  arrangement={match.track_b.arrangement}
                  color="#ffb300"
                  label="TRACK B"
                />
              </div>

              {/* Vote row */}
              <div style={{ borderTop: '3px solid #000', display: 'flex', alignItems: 'stretch' }}>
                <button
                  onClick={() => castVote(match.id, match.track_a.id)}
                  disabled={!!hasVoted || !user || isLoading}
                  style={{
                    ...voteBtn,
                    background: myVote === match.track_a.id ? '#74b9f3' : '#f9f9f7',
                    fontWeight: myVote === match.track_a.id ? 900 : 700,
                  }}
                >
                  {hasVoted ? `${match.votes_a} VOTE${match.votes_a !== 1 ? 'S' : ''}` : 'VOTE A'}
                </button>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '2px solid #000', borderRight: '2px solid #000', fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, color: '#666' }}>
                  {hasVoted && total > 0
                    ? `${Math.round((match.votes_a / total) * 100)}% / ${Math.round((match.votes_b / total) * 100)}%`
                    : isLoading ? '...' : 'CAST YOUR VOTE'}
                </div>

                <button
                  onClick={() => castVote(match.id, match.track_b.id)}
                  disabled={!!hasVoted || !user || isLoading}
                  style={{
                    ...voteBtn,
                    background: myVote === match.track_b.id ? '#ffb300' : '#f9f9f7',
                    fontWeight: myVote === match.track_b.id ? 900 : 700,
                  }}
                >
                  {hasVoted ? `${match.votes_b} VOTE${match.votes_b !== 1 ? 'S' : ''}` : 'VOTE B'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const voteBtn: React.CSSProperties = {
  flex: 1, padding: '14px 0', border: 'none', cursor: 'pointer',
  fontFamily: 'monospace', fontSize: 11, letterSpacing: 2,
  transition: 'background 0.1s',
};
