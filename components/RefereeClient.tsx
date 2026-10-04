'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import EmbedBattleClient from './EmbedBattleClient';
import type { BattleCardMatch } from './BattleCard';

interface Props {
  match: BattleCardMatch | null;
  champion: { username: string; elo_rating: number } | null;
}

const POLL_MS = 15000;

/** The evergreen referee funnel: always the CURRENT battle, one tap to vote.
 * A 15s id-check swaps the card only when the ladder's active fight changes,
 * and never mid-tap — an in-flight vote is announced via onBusyChange and the
 * swap waits for it. */
export default function RefereeClient({ match, champion }: Props) {
  const router = useRouter();
  const busyRef = useRef(false);
  const matchIdRef = useRef<string | null>(match?.id ?? null);
  matchIdRef.current = match?.id ?? null;

  useEffect(() => {
    const tick = setInterval(async () => {
      if (busyRef.current) return;
      try {
        const res = await fetch('/api/battles/live', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        const liveId = data?.active ? (data.matchId as string) : null;
        if (liveId !== matchIdRef.current) router.refresh();
      } catch {
        // network hiccup — the next tick retries
      }
    }, POLL_MS);
    return () => clearInterval(tick);
  }, [router]);

  return (
    <div>
      {/* The pitch */}
      <div style={{ textAlign: 'center', margin: '28px 0 24px', fontFamily: 'monospace' }}>
        <div style={{ fontSize: 12, letterSpacing: 4, fontWeight: 700, color: 'var(--bd-muted)' }}>
          MY ROBOTS ARE FIGHTING.
        </div>
        <div style={{ fontSize: 30, letterSpacing: 3, fontWeight: 900, marginTop: 6 }}>
          YOU ARE <span style={{ color: 'var(--bd-red)' }}>THE REFEREE.</span>
        </div>
        <div style={{ fontSize: 10, letterSpacing: 3, fontWeight: 700, color: 'var(--bd-muted)', marginTop: 8 }}>
          LISTEN TO BOTH SIDES · ONE TAP VOTES · NO ACCOUNT
        </div>
      </div>

      {match ? (
        <EmbedBattleClient
          key={match.id}
          match={match}
          onBusyChange={(busy) => { busyRef.current = busy; }}
        />
      ) : (
        <div style={{ border: '3px solid var(--bd-ink)', padding: '32px 24px', textAlign: 'center', fontFamily: 'monospace' }}>
          <div style={{ fontSize: 13, letterSpacing: 3, fontWeight: 700 }}>
            NEXT FIGHT LOADING — THE LADDER IS SHUFFLING
          </div>
          {champion && (
            <div style={{ marginTop: 18, fontSize: 11, letterSpacing: 2, fontWeight: 700, color: 'var(--bd-muted)' }}>
              👑 CURRENT CHAMPION — <span style={{ color: 'var(--bd-ink)', fontSize: 13 }}>{champion.username ?? 'UNDISPUTED'}</span> · ELO {champion.elo_rating}
            </div>
          )}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/arena" style={{ color: '#fff', background: 'var(--bd-red)', padding: '8px 14px', textDecoration: 'none', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>
              ▶ THE FULL ARENA
            </Link>
            <Link href="/leaderboard" style={{ color: 'var(--bd-ink)', border: '3px solid var(--bd-ink)', padding: '8px 14px', textDecoration: 'none', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>
              LEADERBOARD
            </Link>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 20, fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, fontWeight: 700 }}>
        <Link href="/arena" style={{ color: 'var(--bd-muted)' }}>THE FULL ARENA — LIVE FIGHT, HISTORY, LEADERBOARD ▶</Link>
      </div>
    </div>
  );
}
