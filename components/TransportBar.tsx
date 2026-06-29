'use client';
import ProfileButton from './ProfileButton';
import type { User } from '@supabase/supabase-js';

interface Props {
  onSubmit: () => void;
  user: User | null;
  isAdmin?: boolean;
}

export default function TransportBar({ onSubmit, user, isAdmin = false }: Props) {

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
        onClick={onSubmit}
        style={{
          padding: '0 18px',
          background: '#e8212b',
          color: '#fff',
          fontFamily: 'monospace',
          fontWeight: 900,
          fontSize: 10,
          letterSpacing: 2,
          cursor: 'pointer',
          border: 'none',
          borderLeft: '3px solid #000',
          flexShrink: 0,
        }}
      >
        SUBMIT
      </button>

      {/* Profile */}
      <ProfileButton user={user} isAdmin={isAdmin} />
    </div>
  );
}
