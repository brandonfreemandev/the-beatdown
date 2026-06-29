'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type Page = 'studio' | 'arena' | 'leaderboard';

interface Props {
  currentPage: Page;
  user: User | null;
}

export default function SiteHeader({ currentPage, user }: Props) {
  const [signingIn, setSigningIn] = useState(false);
  const supabase = createClient();

  const signIn = async () => {
    setSigningIn(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  const userName = user?.user_metadata?.name?.split(' ')[0] ?? 'SIGNED IN';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      height: 48,
      borderBottom: '3px solid #000',
      background: '#f9f9f7',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <a
        href="/"
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
          textDecoration: 'none',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        THE BEATDOWN
      </a>

      {/* Nav */}
      {(['studio', 'arena', 'leaderboard'] as Page[]).map((page) => {
        const isActive = page === currentPage;
        const href = page === 'studio' ? '/' : `/${page}`;
        return (
          <a
            key={page}
            href={href}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              borderRight: '2px solid #000',
              fontFamily: 'monospace',
              fontWeight: isActive ? 900 : 700,
              fontSize: 10,
              letterSpacing: 2,
              textDecoration: 'none',
              color: '#000',
              background: isActive ? 'rgba(0,0,0,0.07)' : 'transparent',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {page.toUpperCase()}
            {isActive && (
              <span style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                height: 3,
                background: '#000',
              }} />
            )}
          </a>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* Submit */}
      <a
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          background: '#e8212b',
          color: '#fff',
          fontFamily: 'monospace',
          fontWeight: 900,
          fontSize: 10,
          letterSpacing: 2,
          textDecoration: 'none',
          borderLeft: '3px solid #000',
          flexShrink: 0,
        }}
      >
        SUBMIT
      </a>

      {/* Auth */}
      <button
        onClick={user ? signOut : signIn}
        disabled={signingIn}
        style={{
          padding: '0 16px',
          background: user ? '#000' : 'transparent',
          color: user ? '#f9f9f7' : '#000',
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: 9,
          letterSpacing: 2,
          cursor: 'pointer',
          border: 'none',
          borderLeft: '3px solid #000',
          flexShrink: 0,
          opacity: signingIn ? 0.5 : 1,
        }}
      >
        {user ? userName : 'SIGN IN'}
      </button>
    </div>
  );
}
