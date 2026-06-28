'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
}

export default function AuthButton({ user }: Props) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const signIn = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  const signOut = async () => {
    setLoading(false);
    await supabase.auth.signOut();
    location.reload();
  };

  const label = user
    ? (user.user_metadata?.name?.split(' ')[0] ?? 'SIGNED IN')
    : 'GUEST';

  return (
    <button
      onClick={user ? signOut : signIn}
      disabled={loading}
      style={{
        height: '100%',
        padding: '0 14px',
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
        opacity: loading ? 0.5 : 1,
      }}
    >
      {user ? `${label} ↩` : 'SIGN IN'}
    </button>
  );
}
