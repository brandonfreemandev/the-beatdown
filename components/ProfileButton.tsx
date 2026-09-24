'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStore, MODULES } from '@/lib/store';
import { DEMO_TRACK } from '@/lib/demoTrack';
import { signInWithGoogle } from '@/lib/authSignIn';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
  isAdmin?: boolean;
  onSubmit?: () => void;
  gateBlocked?: boolean;
  votesCast?: number | null;
  votesRequired?: number;
}

function getInitials(user: User): string {
  const name: string = user.user_metadata?.full_name ?? user.user_metadata?.name ?? '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

export default function ProfileButton({ user, isAdmin = false, onSubmit, gateBlocked = false, votesCast = null, votesRequired = 3 }: Props) {
  const [open, setOpen] = useState(false);
  // Initial value must match what the inline script in layout.tsx already set on <html>
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });
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
    const err = await signInWithGoogle(supabase);
    if (err) {
      setSigningIn(false);
      alert(err);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  const saveSession = () => {
    const s = useStore.getState();
    const data = JSON.stringify(
      { grids: s.grids, vaults: s.vaults, timeline: s.timeline, bpm: s.bpm, moduleSettings: s.moduleSettings },
      null,
      2
    );
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beatdown-session-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  // Shared by file-loaded sessions and the bundled demo track
  const applySessionData = (data: any) => {
    if (!data.grids || !data.vaults || data.timeline === undefined) {
      alert('Invalid session file.');
      return;
    }
    // Working grids must match each vault's activePatternId — loadPatternToGrid auto-saves
    // the current grid into the active pattern before switching, so a mismatch here would
    // copy the wrong pattern into the vault on the first dropdown click.
    const grids = { ...data.grids };
    for (const m of MODULES) {
      const vault = data.vaults[m];
      const active = vault?.patterns?.find((p: { id: string }) => p.id === vault.activePatternId);
      if (active?.grid) {
        grids[m] = active.grid.map((r: boolean[]) => [...r]);
      }
    }
    useStore.setState({
      grids,
      vaults: data.vaults,
      timeline: data.timeline,
      bpm: data.bpm ?? 120,
      // Older saved sessions predate per-module knob settings — keep current values rather than wiping them
      moduleSettings: data.moduleSettings ?? useStore.getState().moduleSettings,
    });
    useStore.temporal.getState().clear();
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
          applySessionData(JSON.parse(ev.target?.result as string));
        } catch { alert('Could not read session file.'); }
      };
      reader.readAsText(file);
    };
    input.click();
    setOpen(false);
  };

  const loadDemo = () => {
    applySessionData(DEMO_TRACK);
    setOpen(false);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
  };

  const openRound = rounds.find((r) => r.status === 'open');

  if (!user) {
    return (
      <button
        onClick={signIn}
        disabled={signingIn}
        style={{
          padding: '0 16px', background: 'transparent', color: 'var(--bd-ink)',
          fontFamily: 'monospace', fontWeight: 700, fontSize: 9, letterSpacing: 2,
          cursor: 'pointer', border: 'none',
          flexShrink: 0, opacity: signingIn ? 0.5 : 1, height: '100%',
        }}
      >
        SIGN IN
      </button>
    );
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
      <button
        onClick={() => { setOpen((o) => !o); setConfirmNew(false); setConfirmOut(false); setAdminOpen(false); }}
        style={{ padding: '0 14px', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, border: '2px solid var(--bd-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bd-ink)', color: 'var(--bd-on-ink)', fontFamily: 'monospace', fontWeight: 900, fontSize: 10,
        }}>
          {getInitials(user)}
        </div>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: 'var(--bd-bg)', border: '3px solid var(--bd-ink)', minWidth: 220, zIndex: 100,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '2px solid var(--bd-ink)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 1, color: 'var(--bd-muted)' }}>
            {user.user_metadata?.full_name ?? user.email ?? 'SIGNED IN'}
          </div>

          {/* Submit — always in dropdown, especially for mobile */}
          {onSubmit && (
            <button
              onClick={gateBlocked ? undefined : () => { onSubmit(); setOpen(false); }}
              style={{
                padding: '10px 14px',
                background: gateBlocked ? 'transparent' : 'var(--bd-red)',
                color: gateBlocked ? 'var(--bd-faint)' : '#fff',
                border: 'none',
                borderBottom: '2px solid var(--bd-ink)',
                fontFamily: 'monospace',
                fontWeight: 900,
                fontSize: 10,
                letterSpacing: 2,
                cursor: gateBlocked ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span>⬆ SUBMIT TRACK</span>
              {gateBlocked && (
                <span style={{ fontSize: 8, letterSpacing: 1, color: 'var(--bd-faint)' }}>
                  VOTE {votesCast}/{votesRequired} FIRST TO UNLOCK
                </span>
              )}
            </button>
          )}

          <MenuBtn onClick={saveSession}>↓ SAVE SESSION</MenuBtn>
          <MenuBtn onClick={loadSession}>↑ LOAD SESSION</MenuBtn>
          <MenuBtn onClick={loadDemo}>♫ LOAD DEMO TRACK</MenuBtn>
          <MenuBtn onClick={toggleTheme}>{theme === 'light' ? '◐ DARK MODE' : '◑ LIGHT MODE'}</MenuBtn>

          <div style={{ borderTop: '2px solid var(--bd-ink)' }} />

          {confirmNew ? (
            <div style={{ padding: '8px 14px', borderBottom: '2px solid var(--bd-ink)' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginBottom: 8, color: 'var(--bd-red)' }}>Clear all work?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <ConfirmBtn danger onClick={() => { clearSession(); setOpen(false); setConfirmNew(false); }}>YES, CLEAR</ConfirmBtn>
                <ConfirmBtn onClick={() => setConfirmNew(false)}>CANCEL</ConfirmBtn>
              </div>
            </div>
          ) : (
            <MenuBtn onClick={() => setConfirmNew(true)}>⊘ NEW SESSION</MenuBtn>
          )}

          <div style={{ borderTop: '2px solid var(--bd-ink)' }} />

          {/* Admin section */}
          {isAdmin && (
            <>
              <MenuBtn onClick={() => { setAdminOpen((o) => !o); if (!adminOpen) loadAdmin(); }}>
                ⚙ ADMIN {adminOpen ? '▴' : '▾'}
              </MenuBtn>

              {adminOpen && (
                <div style={{ borderTop: '2px solid var(--bd-ink)', borderBottom: '2px solid var(--bd-ink)', background: 'var(--bd-ink-wash)', padding: '12px 14px' }}>
                  {adminLoading && <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--bd-muted)', marginBottom: 8 }}>Loading…</div>}

                  <div style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: 2, fontWeight: 700, marginBottom: 6 }}>ROUND</div>
                  {openRound ? (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--bd-muted)', marginBottom: 6 }}>
                        Open · {new Date(openRound.started_at).toLocaleDateString()}
                      </div>
                      <ConfirmBtn danger onClick={() => adminAction({ action: 'close_round', roundId: openRound.id })}>
                        CLOSE ROUND
                      </ConfirmBtn>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--bd-faint)', marginBottom: 6 }}>No open round</div>
                      <ConfirmBtn onClick={() => adminAction({ action: 'open_round' })}>OPEN NEW ROUND</ConfirmBtn>
                    </div>
                  )}

                  {profiles.length > 0 && (
                    <>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: 2, fontWeight: 700, marginTop: 10, marginBottom: 6 }}>ADMINS</div>
                      {profiles.map((p) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--bd-ink)' }}>{p.username ?? 'anon'}</span>
                          <button
                            onClick={() => adminAction({ action: 'toggle_admin', userId: p.id, isAdmin: !p.is_admin })}
                            disabled={p.id === user?.id}
                            style={{
                              fontFamily: 'monospace', fontSize: 8, fontWeight: 700, letterSpacing: 1,
                              padding: '2px 8px', cursor: p.id === user?.id ? 'default' : 'pointer',
                              border: '2px solid var(--bd-ink)',
                              background: p.is_admin ? 'var(--bd-ink)' : 'transparent',
                              color: p.is_admin ? 'var(--bd-on-ink)' : 'var(--bd-ink)',
                              opacity: p.id === user?.id ? 0.4 : 1,
                            }}
                          >
                            {p.is_admin ? 'ADMIN' : 'USER'}
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {adminMsg && <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--bd-red)', marginTop: 8 }}>{adminMsg}</div>}
                </div>
              )}
            </>
          )}

          {confirmOut ? (
            <div style={{ padding: '8px 14px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginBottom: 8, color: 'var(--bd-red)' }}>Sign out?</div>
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
        padding: '10px 14px', background: hover ? 'var(--bd-ink-wash)' : 'transparent',
        border: 'none', borderBottom: '2px solid var(--bd-ink)',
        fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 2,
        cursor: 'pointer', textAlign: 'left', color: 'var(--bd-ink)', width: '100%',
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
        background: danger ? 'var(--bd-red)' : 'transparent',
        color: danger ? '#fff' : 'var(--bd-ink)',
        border: '2px solid var(--bd-ink)',
        fontFamily: 'monospace', fontWeight: 700, fontSize: 9, letterSpacing: 1,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
