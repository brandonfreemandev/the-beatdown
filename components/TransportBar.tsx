'use client';
import ProfileButton from './ProfileButton';
import type { User } from '@supabase/supabase-js';

const VOTES_REQUIRED = 3;

interface Props {
  onSubmit: () => void;
  user: User | null;
  isAdmin?: boolean;
  votesCast?: number | null;
}

export default function TransportBar({ onSubmit, user, isAdmin = false, votesCast = null }: Props) {
  const gateBlocked = user !== null && votesCast !== null && votesCast < VOTES_REQUIRED;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: 48,
        borderBottom: '3px solid #000',
        background: '#f9f9f7',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '0 20px',
          borderRight: '3px solid #000',
          fontFamily: 'monospace',
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: 3,
          display: 'flex',
          alignItems: 'center',
          background: '#000',
          color: '#f9f9f7',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        THE BEATDOWN
      </div>

      {/* Nav */}
      {(['STUDIO', 'ARENA', 'LEADERBOARD'] as const).map((page) => (
        <a
          key={page}
          href={page === 'STUDIO' ? '/' : `/${page.toLowerCase()}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderRight: '2px solid #000',
            fontFamily: 'monospace',
            fontWeight: page === 'STUDIO' ? 900 : 700,
            fontSize: 10,
            letterSpacing: 2,
            textDecoration: 'none',
            color: '#000',
            background: page === 'STUDIO' ? 'rgba(0,0,0,0.07)' : 'transparent',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {page}
          {page === 'STUDIO' && (
            <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#000' }} />
          )}
        </a>
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Submit */}
      <button
        onClick={gateBlocked ? undefined : onSubmit}
        title={gateBlocked ? `Vote on ${VOTES_REQUIRED - (votesCast ?? 0)} more track${VOTES_REQUIRED - (votesCast ?? 0) !== 1 ? 's' : ''} in the Arena to unlock` : undefined}
        style={{
          padding: '0 18px',
          background: gateBlocked ? '#888' : '#e8212b',
          color: '#fff',
          fontFamily: 'monospace',
          fontWeight: 900,
          fontSize: 10,
          letterSpacing: 2,
          cursor: gateBlocked ? 'not-allowed' : 'pointer',
          border: 'none',
          borderLeft: '3px solid #000',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <span>SUBMIT</span>
        {gateBlocked && (
          <span style={{ fontSize: 7, letterSpacing: 1, opacity: 0.85 }}>
            VOTE {votesCast}/{VOTES_REQUIRED} FIRST
          </span>
        )}
      </button>

      {/* Profile */}
      <ProfileButton user={user} isAdmin={isAdmin} />
    </div>
  );
}
