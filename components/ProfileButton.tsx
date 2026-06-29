'use client';
import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
}

function getInitials(user: User): string {
  const name: string = user.user_metadata?.full_name ?? user.user_metadata?.name ?? '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

export default function ProfileButton({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const clearSession = useStore((s) => s.clearSession);
  const supabase = createClient();

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmNew(false);
        setConfirmOut(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

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

  // JSON session save
  const saveSession = () => {
    const s = useStore.getState();
    const data = JSON.stringify({ grids: s.grids, vaults: s.vaults, timeline: s.timeline, bpm: s.bpm }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beatdown-session-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  // JSON session load
  const loadSession = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.grids && data.vaults && data.timeline !== undefined) {
            useStore.setState({
              grids: data.grids,
              vaults: data.vaults,
              timeline: data.timeline,
              bpm: data.bpm ?? 120,
            });
            useStore.temporal.getState().clear();
          } else {
            alert('Invalid session file.');
          }
        } catch {
          alert('Could not read session file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
    setOpen(false);
  };

  const Avatar = () => (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      flexShrink: 0,
      border: '2px solid #000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: user ? '#000' : '#f9f9f7',
      color: '#f9f9f7',
      fontFamily: 'monospace', fontWeight: 900, fontSize: 10,
      cursor: 'pointer',
      userSelect: 'none',
    }}>
      {user ? getInitials(user) : <span style={{ color: '#000', fontSize: 9, fontWeight: 700 }}>IN</span>}
    </div>
  );

  if (!user) {
    return (
      <button
        onClick={signIn}
        disabled={signingIn}
        style={{
          padding: '0 16px',
          background: 'transparent',
          color: '#000',
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: 9,
          letterSpacing: 2,
          cursor: 'pointer',
          border: 'none',
          borderLeft: '3px solid #000',
          flexShrink: 0,
          opacity: signingIn ? 0.5 : 1,
          height: '100%',
        }}
      >
        SIGN IN
      </button>
    );
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0, borderLeft: '3px solid #000', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={() => { setOpen((o) => !o); setConfirmNew(false); setConfirmOut(false); }}
        style={{
          padding: '0 14px',
          height: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Avatar />
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 9, letterSpacing: 1, color: '#000' }}>
          ▾
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          background: '#f9f9f7',
          border: '3px solid #000',
          minWidth: 200,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* User info */}
          <div style={{ padding: '10px 14px', borderBottom: '2px solid #000', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1, color: '#666' }}>
            {user.user_metadata?.full_name ?? user.email ?? 'SIGNED IN'}
          </div>

          <MenuBtn onClick={saveSession}>↓ SAVE SESSION</MenuBtn>
          <MenuBtn onClick={loadSession}>↑ LOAD SESSION</MenuBtn>

          <div style={{ borderTop: '2px solid #000' }} />

          {confirmNew ? (
            <div style={{ padding: '8px 14px', borderBottom: '2px solid #000' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginBottom: 8, color: '#e8212b' }}>
                Clear all work?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <ConfirmBtn danger onClick={() => { clearSession(); setOpen(false); setConfirmNew(false); }}>YES, CLEAR</ConfirmBtn>
                <ConfirmBtn onClick={() => setConfirmNew(false)}>CANCEL</ConfirmBtn>
              </div>
            </div>
          ) : (
            <MenuBtn onClick={() => setConfirmNew(true)}>⊘ NEW SESSION</MenuBtn>
          )}

          <div style={{ borderTop: '2px solid #000' }} />

          {confirmOut ? (
            <div style={{ padding: '8px 14px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginBottom: 8, color: '#e8212b' }}>
                Sign out?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <ConfirmBtn danger onClick={signOut}>YES, SIGN OUT</ConfirmBtn>
                <ConfirmBtn onClick={() => setConfirmOut(false)}>CANCEL</ConfirmBtn>
              </div>
            </div>
          ) : (
            <MenuBtn onClick={() => setConfirmOut(true)}>↩ SIGN OUT</MenuBtn>
          )}
        </div>
      )}
    </div>
  );
}

function MenuBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 14px',
        background: hover ? 'rgba(0,0,0,0.07)' : 'transparent',
        border: 'none',
        borderBottom: '2px solid #000',
        fontFamily: 'monospace',
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: 2,
        cursor: 'pointer',
        textAlign: 'left',
        color: '#000',
        width: '100%',
      }}
    >
      {children}
    </button>
  );
}

function ConfirmBtn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        background: danger ? '#e8212b' : 'transparent',
        color: danger ? '#fff' : '#000',
        border: '2px solid #000',
        fontFamily: 'monospace',
        fontWeight: 700,
        fontSize: 9,
        letterSpacing: 1,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
