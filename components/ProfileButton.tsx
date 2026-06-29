'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
  isAdmin?: boolean;
}

function getInitials(user: User): string {
  const name: string = user.user_metadata?.full_name ?? user.user_metadata?.name ?? '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

export default function ProfileButton({ user, isAdmin = false }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [rounds, setRounds] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const clearSession = useStore((s) => s.clearSession);
  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmNew(false);
        setConfirmOut(false);
        setAdminOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const loadAdmin = useCallback(async () => {
    setAdminLoading(true);
    const res = await fetch('/api/admin');
    const data = await res.json();
    setRounds(data.rounds ?? []);
    setProfiles(data.profiles ?? []);
    setAdminLoading(false);
  }, []);

  const adminAction = async (body: object) => {
    setAdminMsg('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setAdminMsg(data.error); }
    else { setAdminMsg('Done.'); loadAdmin(); }
  };

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
            useStore.setState({ grids: data.grids, vaults: data.vaults, timeline: data.timeline, bpm: data.bpm ?? 120 });
            useStore.temporal.getState().clear();
          } else { alert('Invalid session file.'); }
        } catch { alert('Could not read session file.'); }
      };
      reader.readAsText(file);
    };
    input.click();
    setOpen(false);
  };

  const openRound = rounds.find((r) => r.status === 'open');

  if (!user) {
    return (
      <button
        onClick={signIn}
        disabled={signingIn}
        style={{
          padding: '0 16px', background: 'transparent', color: '#000',
          fontFamily: 'monospace', fontWeight: 700, fontSize: 9, letterSpacing: 2,
          cursor: 'pointer', border: 'none', borderLeft: '3px solid #000',
          flexShrink: 0, opacity: signingIn ? 0.5 : 1, height: '100%',
        }}
      >
        SIGN IN
      </button>
    );
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0, borderLeft: '3px solid #000', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={() => { setOpen((o) => !o); setConfirmNew(false); setConfirmOut(false); setAdminOpen(false); }}
        style={{ padding: '0 14px', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, border: '2px solid #000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#000', color: '#f9f9f7', fontFamily: 'monospace', fontWeight: 900, fontSize: 10,
        }}>
          {getInitials(user)}
        </div>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 9, letterSpacing: 1, color: '#000' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: '#f9f9f7', border: '3px solid #000', minWidth: 220, zIndex: 100,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '2px solid #000', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1, color: '#666' }}>
            {user.user_metadata?.full_name ?? user.email ?? 'SIGNED IN'}
          </div>

          <MenuBtn onClick={saveSession}>↓ SAVE SESSION</MenuBtn>
          <MenuBtn onClick={loadSession}>↑ LOAD SESSION</MenuBtn>

          <div style={{ borderTop: '2px solid #000' }} />

          {confirmNew ? (
            <div style={{ padding: '8px 14px', borderBottom: '2px solid #000' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginBottom: 8, color: '#e8212b' }}>Clear all work?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <ConfirmBtn danger onClick={() => { clearSession(); setOpen(false); setConfirmNew(false); }}>YES, CLEAR</ConfirmBtn>
                <ConfirmBtn onClick={() => setConfirmNew(false)}>CANCEL</ConfirmBtn>
              </div>
            </div>
          ) : (
            <MenuBtn onClick={() => setConfirmNew(true)}>⊘ NEW SESSION</MenuBtn>
          )}

          <div style={{ borderTop: '2px solid #000' }} />

          {/* Admin section */}
          {isAdmin && (
            <>
              <MenuBtn onClick={() => { setAdminOpen((o) => !o); if (!adminOpen) loadAdmin(); }}>
                ⚙ ADMIN {adminOpen ? '▴' : '▾'}
              </MenuBtn>

              {adminOpen && (
                <div style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', background: 'rgba(0,0,0,0.04)', padding: '12px 14px' }}>
                  {adminLoading && <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#666', marginBottom: 8 }}>Loading…</div>}

                  {/* Round status */}
                  <div style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>ROUND</div>
                  {openRound ? (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#666', marginBottom: 6 }}>
                        Open · {new Date(openRound.started_at).toLocaleDateString()}
                      </div>
                      <ConfirmBtn danger onClick={() => adminAction({ action: 'close_round', roundId: openRound.id })}>
                        CLOSE ROUND
                      </ConfirmBtn>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#999', marginBottom: 6 }}>No open round</div>
                      <ConfirmBtn onClick={() => adminAction({ action: 'open_round' })}>OPEN NEW ROUND</ConfirmBtn>
                    </div>
                  )}

                  {/* User admin toggle */}
                  {profiles.length > 0 && (
                    <>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: 2, fontWeight: 700, marginTop: 10, marginBottom: 6 }}>ADMINS</div>
                      {profiles.map((p) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#000' }}>{p.username ?? 'anon'}</span>
                          <button
                            onClick={() => adminAction({ action: 'toggle_admin', userId: p.id, isAdmin: !p.is_admin })}
                            disabled={p.id === user?.id}
                            style={{
                              fontFamily: 'monospace', fontSize: 8, fontWeight: 700, letterSpacing: 1,
                              padding: '2px 8px', cursor: p.id === user?.id ? 'default' : 'pointer',
                              border: '2px solid #000',
                              background: p.is_admin ? '#000' : 'transparent',
                              color: p.is_admin ? '#f9f9f7' : '#000',
                              opacity: p.id === user?.id ? 0.4 : 1,
                            }}
                          >
                            {p.is_admin ? 'ADMIN' : 'USER'}
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {adminMsg && <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#e8212b', marginTop: 8 }}>{adminMsg}</div>}
                </div>
              )}
            </>
          )}

          {confirmOut ? (
            <div style={{ padding: '8px 14px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginBottom: 8, color: '#e8212b' }}>Sign out?</div>
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
        padding: '10px 14px', background: hover ? 'rgba(0,0,0,0.07)' : 'transparent',
        border: 'none', borderBottom: '2px solid #000',
        fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 2,
        cursor: 'pointer', textAlign: 'left', color: '#000', width: '100%',
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
        fontFamily: 'monospace', fontWeight: 700, fontSize: 9, letterSpacing: 1,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
