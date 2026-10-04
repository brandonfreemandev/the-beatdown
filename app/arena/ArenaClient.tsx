'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BattleCard, { type BattleCardMatch } from '@/components/BattleCard';
import SiteNav from '@/components/SiteNav';
import { GATEKEEPER_ENABLED } from '@/lib/gatekeeper';
import type { Profile } from '@/lib/supabase/types';
import type { User } from '@supabase/supabase-js';

interface ArenaMatch extends BattleCardMatch {}

interface Props {
  user: User | null;
  profile: Profile | null;
  matches: ArenaMatch[];
  userVotes: string[];
  votesRequired: number;
}

const HOW_IT_WORKS = (voteThreshold: number) => [
  { step: '1 · MAKE',    desc: 'Compose a beat in the Studio using all 5 modules.' },
  { step: '2 · VOTE',    desc: GATEKEEPER_ENABLED
      ? `Vote in ${voteThreshold} Arena battle${voteThreshold !== 1 ? 's' : ''} to unlock Submit.`
      : 'While we onboard: vote on battles you like — no requirement right now.' },
  { step: '3 · SUBMIT',  desc: 'Head to Studio, hit SUBMIT, give your track a title.' },
  { step: '4 · WIN ELO', desc: "You're paired blind. After 3 votes the winner gains ELO." },
];

export default function ArenaClient({ user, profile, matches, userVotes, votesRequired: voteThreshold }: Props) {
  const router = useRouter();
  const [voted, setVoted] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [howOpen, setHowOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const castVote = async (matchId: string, votedForId: string) => {
    setLoading(matchId);
    setError('');
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, votedForId }),
    });
    const data = await res.json();
    if (!res.ok && res.status !== 409) { setError(data.error); }
    else {
      if (res.status === 409) setError('You already voted on this battle.');
      setVoted((v) => ({ ...v, [matchId]: votedForId }));
      router.refresh();
    }
    setLoading(null);
  };

  const alreadyVoted = (matchId: string): boolean =>
    userVotes.includes(matchId) || voted[matchId] !== undefined;

  const live = matches.filter((m) => m.status === 'active');
  const archived = matches.filter((m) => m.status === 'resolved');

  return (
    <div
      className="page-shell"
      style={{ fontFamily: 'monospace', display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: 'var(--bd-bg)', color: 'var(--bd-ink)' }}
    >
      <SiteNav currentPage="arena" user={user} isAdmin={profile?.is_admin ?? false} votesCast={profile?.votes_cast ?? null} votesRequired={voteThreshold} />

      <div
        className="page-scroll"
        style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}
      >
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* How it works */}
        <div style={{ border: '3px solid var(--bd-ink)', marginBottom: 32 }}>
          <button
            onClick={() => setHowOpen((o) => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bd-ink)', color: 'var(--bd-on-ink)', border: 'none', padding: '10px 16px',
              cursor: 'pointer', fontFamily: 'monospace',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: 3 }}>HOW IT WORKS</span>
              <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: 1, background: 'var(--bd-red)', color: '#fff', padding: '2px 6px' }}>NEW HERE?</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--bd-on-ink-muted)' }}>{howOpen ? '▲ HIDE' : '▼ SHOW'}</span>
          </button>
          {howOpen && (
            <div style={{ display: 'flex' }}>
              {HOW_IT_WORKS(voteThreshold).map(({ step, desc }, i) => (
                <div key={step} style={{
                  flex: 1, padding: '14px 16px',
                  borderRight: i < 3 ? '3px solid var(--bd-ink)' : 'none',
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>{step}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 1.6, color: 'var(--bd-body)' }}>{desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats bar */}
        {user && profile && (
          <div style={{ display: 'flex', border: '3px solid var(--bd-ink)', marginBottom: 32 }}>
            {[
              { label: 'ELO', value: profile.elo_rating },
              { label: 'VOTES CAST', value: profile.votes_cast },
              { label: 'SUBMISSIONS', value: profile.submissions_count },
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
        )}

        {!user && (
          <div style={{ border: '3px solid var(--bd-ink)', padding: '16px 20px', marginBottom: 32, fontSize: 11, letterSpacing: 1 }}>
            Voting is open — no account needed, just tap a side. Sign in to submit tracks and climb the ELO ladder.
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--bd-red)', color: '#fff', padding: '10px 16px', marginBottom: 24, fontSize: 11 }}>
            {error}
          </div>
        )}

        {/* Empty state */}
        {matches.length === 0 && (
          <div style={{ border: '3px solid var(--bd-ink)', padding: '64px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 4, marginBottom: 16 }}>NO ACTIVE MATCHES</div>
            <div style={{ fontSize: 11, color: 'var(--bd-muted)', letterSpacing: 1, lineHeight: 1.8 }}>
              Submit a track from the Studio, then run the Matchmaker<br />
              to be paired with another producer.
            </div>
          </div>
        )}

        {/* ── LIVE BATTLES — the action, always first ── */}
        {live.length > 0 && (
          <div style={{ border: '3px solid var(--bd-ink)', background: 'var(--bd-ink)', color: 'var(--bd-on-ink)', padding: '10px 16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: 3 }}>
              <span style={{ color: 'var(--bd-red)' }}>●</span> LIVE BATTLES
            </span>
            <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--bd-on-ink-muted)' }}>{live.length} OPEN FOR VOTING</span>
          </div>
        )}
        {live.map((match) => {
          const hasVoted = alreadyVoted(match.id);
          const myVote = voted[match.id] ?? null;
          return (
            <div key={match.id} id={`battle-${match.id}`} style={{ marginBottom: 48, scrollMarginTop: 64 }}>
              <BattleCard
                match={match}
                hasVoted={hasVoted}
                myVote={myVote}
                isLoading={loading === match.id}
                onVote={castVote}
              />
            </div>
          );
        })}

        {live.length === 0 && archived.length > 0 && (
          <div style={{ border: '3px solid var(--bd-ink)', padding: '32px', textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 4, marginBottom: 8 }}>NO LIVE BATTLES</div>
            <div style={{ fontSize: 10, color: 'var(--bd-muted)', letterSpacing: 1 }}>
              New fights appear the moment the matchmaker pairs a submission.
            </div>
          </div>
        )}

        {/* ── RESOLVED ARCHIVE — collapsed by default ── */}
        {archived.length > 0 && (
          <>
            <button
              onClick={() => setArchiveOpen((o) => !o)}
              style={{
                width: '100%', border: '3px solid var(--bd-ink)', borderTop: 'none', background: 'var(--bd-ink-soft)',
                color: 'var(--bd-on-ink)', padding: '10px 16px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontFamily: 'monospace', fontWeight: 700, fontSize: 9, letterSpacing: 3,
              }}
            >
              <span>∎ RESOLVED — ARCHIVE</span>
              <span style={{ color: 'var(--bd-on-ink-muted)' }}>{archiveOpen ? '▲ HIDE' : `▼ SHOW ${archived.length}`}</span>
            </button>
            {archiveOpen && archived.map((match) => {
              const hasVoted = alreadyVoted(match.id);
              const myVote = voted[match.id] ?? null;
              return (
                <div key={match.id} id={`battle-${match.id}`} style={{ marginBottom: 48, scrollMarginTop: 64 }}>
                  <BattleCard
                    match={match}
                    hasVoted={hasVoted}
                    myVote={myVote}
                    isLoading={loading === match.id}
                    onVote={castVote}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>
      </div>
    </div>
  );
}

