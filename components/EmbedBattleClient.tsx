'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BattleCard, { type BattleCardMatch } from './BattleCard';

interface Props {
  match: BattleCardMatch;
}

/** Client shell for the embed page's single battle card — same card as the Arena. */
export default function EmbedBattleClient({ match }: Props) {
  const router = useRouter();
  const [myVote, setMyVote] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const castVote = async (matchId: string, votedForId: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, votedForId }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409) {
        setError('You already voted on this battle.');
        setHasVoted(true);
      } else if (!res.ok) {
        setError((data?.error ?? 'Vote failed — try again.').toUpperCase());
      } else {
        setMyVote(votedForId);
        setHasVoted(true);
        router.refresh();
      }
    } catch {
      setError('CONNECTION HICCUP — VOTE NOT CAST. TRY AGAIN.');
    }
    setLoading(false);
  };

  return (
    <div>
      {error && (
        <div style={{ border: '3px solid var(--bd-ink)', background: 'var(--bd-red)', color: '#fff', padding: '10px 16px', marginBottom: 16, fontSize: 11, fontFamily: 'monospace', letterSpacing: 1 }}>
          {error}
        </div>
      )}
      <BattleCard match={match} hasVoted={hasVoted} myVote={myVote} isLoading={isLoading} onVote={castVote} />
    </div>
  );
}
