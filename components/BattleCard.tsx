'use client';
import ArenaPlayer from './ArenaPlayer';

export interface BattleCardMatch {
  id: string;
  votes_a: number;
  votes_b: number;
  status: 'active' | 'resolved';
  winner_id: string | null;
  track_a: { id: string; title: string; arrangement: any };
  track_b: { id: string; title: string; arrangement: any };
}

interface Props {
  match: BattleCardMatch;
  hasVoted: boolean;
  myVote: string | null;
  isLoading: boolean;
  onVote: (matchId: string, votedForId: string) => void;
}

const TRACK_COLORS = { a: '#74b9f3', b: '#ffb300' };

/** The one true battle card — used by the Arena page and battle embeds alike. */
export default function BattleCard({ match, hasVoted, myVote, isLoading, onVote }: Props) {
  const isResolved = match.status === 'resolved';
  const total = match.votes_a + match.votes_b;
  const pctA = total > 0 ? Math.round((match.votes_a / total) * 100) : 50;
  const pctB = total > 0 ? Math.round((match.votes_b / total) * 100) : 50;
  const winnerIsA = match.winner_id === match.track_a.id;
  const winnerIsB = match.winner_id === match.track_b.id;

  return (
    <div style={{
      border: '3px solid var(--bd-ink)',
      borderTop: isResolved ? '3px solid var(--bd-ink)' : '6px solid var(--bd-red)',
    }}>
      {/* Match header */}
      <div style={{
        background: isResolved ? 'var(--bd-ink-soft)' : 'var(--bd-ink)', color: 'var(--bd-on-ink)',
        padding: '10px 16px', fontWeight: 700, fontSize: 9, letterSpacing: 3,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{isResolved ? '✓ RESOLVED' : <span><span style={{ color: 'var(--bd-red)' }}>●</span> BATTLE — VOTING OPEN</span>}</span>
        <span style={{ color: 'var(--bd-on-ink-muted)' }}>{total} VOTE{total !== 1 ? 'S' : ''}</span>
      </div>

      {/* Tracks */}
      <div className="arena-match-tracks">
        <ArenaPlayer
          arrangement={match.track_a.arrangement}
          color={TRACK_COLORS.a}
          label="TRACK A"
          title={match.track_a.title}
        />
        <div className="arena-track-divider" />
        <ArenaPlayer
          arrangement={match.track_b.arrangement}
          color={TRACK_COLORS.b}
          label="TRACK B"
          title={match.track_b.title}
        />
      </div>

      {/* Vote bar */}
      {hasVoted && total > 0 && (
        <div style={{ height: 6, display: 'flex', borderTop: '2px solid var(--bd-ink)' }}>
          <div style={{ width: `${pctA}%`, background: TRACK_COLORS.a, transition: 'width 0.4s' }} />
          <div style={{ flex: 1, background: TRACK_COLORS.b }} />
        </div>
      )}

      {/* Vote buttons */}
      <div style={{ borderTop: hasVoted && total > 0 ? 'none' : '3px solid var(--bd-ink)', display: 'flex' }}>
        <VoteBtn
          onClick={() => onVote(match.id, match.track_a.id)}
          disabled={hasVoted || isLoading || isResolved}
          active={myVote === match.track_a.id}
          color={TRACK_COLORS.a}
          winner={winnerIsA}
          label={hasVoted || isResolved
            ? `${winnerIsA ? '▲ WINNER · ' : ''}${match.votes_a} vote${match.votes_a !== 1 ? 's' : ''} · ${pctA}%`
            : `VOTE FOR ${match.track_a.title.toUpperCase()}`}
        />
        <div style={{ width: 3, background: 'var(--bd-ink)', flexShrink: 0 }} />
        <VoteBtn
          onClick={() => onVote(match.id, match.track_b.id)}
          disabled={hasVoted || isLoading || isResolved}
          active={myVote === match.track_b.id}
          color={TRACK_COLORS.b}
          winner={winnerIsB}
          label={hasVoted || isResolved
            ? `${winnerIsB ? '▲ WINNER · ' : ''}${match.votes_b} vote${match.votes_b !== 1 ? 's' : ''} · ${pctB}%`
            : `VOTE FOR ${match.track_b.title.toUpperCase()}`}
        />
      </div>
    </div>
  );
}

function VoteBtn({ onClick, disabled, active, color, label, winner }: {
  onClick: () => void; disabled: boolean; active: boolean; color: string; label: string; winner?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '14px 12px',
        background: winner ? color : active ? color : 'transparent',
        border: 'none',
        fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 1,
        cursor: disabled ? 'default' : 'pointer',
        // On a fixed track-color background, text stays literal black; on the page bg it follows the theme
        color: winner || active ? '#000' : 'var(--bd-ink)',
        transition: 'background 0.15s',
        textAlign: 'center',
      }}
    >
      {label}
    </button>
  );
}
