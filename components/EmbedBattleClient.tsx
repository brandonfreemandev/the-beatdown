'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BattleCard, { type BattleCardMatch } from './BattleCard';

interface Props {
  match: BattleCardMatch;
  /** Tells a wrapper (e.g. /referee's poll) when a vote is in flight, so a
   * battle swap never yanks the card out from under a tap. */
  onBusyChange?: (busy: boolean) => void;
}

/** Client shell for the battle card's vote logic — same card as the Arena. */
export default function EmbedBattleClient({ match, onBusyChange }: Props) {
  const router = useRouter();
  const [myVote, setMyVote] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const castVote = async (matchId: string, votedForId: string) => {
    setLoading(true);
    onBusyChange?.(true);
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
      } else if (res.status === 410) {
        // The fight resolved under us. Say so explicitly, then let the
        // wrapper roll to the ladder's current battle.
        setError((data?.error ?? 'FIGHT OVER — THE LADDER MOVED ON.').toUpperCase());
        router.refresh();
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
    onBusyChange?.(false);
  };

  return (
    <div>
      {error && (
        <div style={{ border: '3px solid var(--bd-ink)', background: 'var(--bd-red)', color: '#fff', padding: '10px 16px', marginBottom: 16, fontSize: 11, fontFamily: 'monospace', letterSpacing: 1 }}>
          {error}
        </div>
      )}
      <BattleCard match={match} hasVoted={hasVoted} myVote={myVote} isLoading={isLoading} onVote={castVote} />
      {match.status === 'resolved' && (
        <Link
          href="/referee"
          style={{
            display: 'block', marginTop: 12, border: '3px solid var(--bd-ink)', background: 'var(--bd-ink)',
            color: 'var(--bd-on-ink)', padding: '12px 16px', textDecoration: 'none',
            fontWeight: 700, fontSize: 11, letterSpacing: 2, textAlign: 'center',
          }}
        >
          THIS FIGHT IS OVER — THE LADDER MOVED ON. REFEREE THE CURRENT BATTLE ▶
        </Link>
      )}
    </div>
  );
}
