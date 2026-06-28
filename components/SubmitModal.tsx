'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
  onClose: () => void;
}

export default function SubmitModal({ user, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'gate'>('idle');
  const [gateInfo, setGateInfo] = useState<{ required: number; cast: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const supabase = createClient();

  const signIn = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  const submit = async () => {
    if (!title.trim()) return;
    setStatus('loading');
    const state = useStore.getState();
    const arrangement = {
      bpm: state.bpm,
      grids: state.grids,
      timeline: state.timeline,
    };

    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, arrangement }),
    });
    const data = await res.json();

    if (res.status === 403 && data.error === 'GATEKEEPER') {
      setGateInfo({ required: data.required, cast: data.cast });
      setStatus('gate');
    } else if (!res.ok) {
      setErrorMsg(data.error ?? 'Something went wrong');
      setStatus('error');
    } else {
      setStatus('success');
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  };
  const boxStyle: React.CSSProperties = {
    background: '#f9f9f7', border: '3px solid #000',
    padding: 0, minWidth: 360, fontFamily: 'monospace',
  };
  const headerStyle: React.CSSProperties = {
    background: '#000', color: '#f9f9f7',
    padding: '10px 16px', fontWeight: 900, fontSize: 11, letterSpacing: 3,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  };
  const bodyStyle: React.CSSProperties = { padding: 24 };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span>SUBMIT TO ARENA</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#f9f9f7', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
        <div style={bodyStyle}>
          {!user && (
            <>
              <p style={{ marginBottom: 16, fontSize: 12, lineHeight: 1.6 }}>
                Sign in to submit your track to the Arena.
                <br />
                You can use the sequencer as a guest.
              </p>
              <button onClick={signIn} style={primaryBtn}>SIGN IN WITH GOOGLE</button>
            </>
          )}

          {user && status === 'gate' && gateInfo && (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>GATEKEEPER</p>
              <p style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 16, color: '#333' }}>
                You need to vote on <strong>{gateInfo.required - gateInfo.cast}</strong> more track{gateInfo.required - gateInfo.cast !== 1 ? 's' : ''} before you can submit.
                <br />
                Head to the Arena and cast your votes first.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={secondaryBtn}>CLOSE</button>
                <button onClick={() => { onClose(); location.href = '/arena'; }} style={primaryBtn}>GO TO ARENA</button>
              </div>
            </>
          )}

          {user && status === 'idle' && (
            <>
              <p style={{ fontSize: 11, letterSpacing: 1, marginBottom: 12, color: '#666' }}>TRACK TITLE</p>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                maxLength={60}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '2px solid #000', background: '#fff',
                  fontFamily: 'monospace', fontSize: 13, marginBottom: 20,
                }}
                placeholder="Give your track a name..."
              />
              <button onClick={submit} disabled={!title.trim()} style={{ ...primaryBtn, opacity: title.trim() ? 1 : 0.4 }}>
                SUBMIT
              </button>
            </>
          )}

          {user && status === 'loading' && (
            <p style={{ fontSize: 12, letterSpacing: 2 }}>SUBMITTING...</p>
          )}

          {user && status === 'success' && (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>SUBMITTED ✓</p>
              <p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>
                Your track is in the Arena. The Matchmaker will pair you soon.
              </p>
              <button onClick={onClose} style={primaryBtn}>CLOSE</button>
            </>
          )}

          {user && status === 'error' && (
            <>
              <p style={{ fontSize: 12, color: '#e8212b', marginBottom: 16 }}>{errorMsg}</p>
              <button onClick={() => setStatus('idle')} style={secondaryBtn}>TRY AGAIN</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  background: '#000', color: '#f9f9f7', border: 'none',
  fontFamily: 'monospace', fontWeight: 700, fontSize: 11, letterSpacing: 2,
  padding: '10px 20px', cursor: 'pointer', width: '100%',
};
const secondaryBtn: React.CSSProperties = {
  ...primaryBtn, background: 'transparent', color: '#000',
  border: '2px solid #000', flex: 1,
};
