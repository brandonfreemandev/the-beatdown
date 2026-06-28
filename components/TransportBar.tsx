'use client';
import { useStore } from '@/lib/store';
import { audioEngine } from '@/lib/audioEngine';
import AuthButton from './AuthButton';
import type { User } from '@supabase/supabase-js';

interface Props {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSubmit: () => void;
  user: User | null;
}

export default function TransportBar({ isPlaying, onTogglePlay, onSubmit, user }: Props) {
  const bpm = useStore((s) => s.bpm);
  const setBpm = useStore((s) => s.setBpm);

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setBpm(v);
    audioEngine.setBpm(v);
  };

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

      {/* Play/Stop */}
      <button
        onClick={onTogglePlay}
        style={{
          width: 80,
          background: isPlaying ? '#000' : '#f9f9f7',
          color: isPlaying ? '#f9f9f7' : '#000',
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: 2,
          cursor: 'pointer',
          border: 'none',
          borderRight: '3px solid #000',
          flexShrink: 0,
        }}
      >
        {isPlaying ? '■ STOP' : '▶ PLAY'}
      </button>

      {/* BPM */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 16px',
          borderRight: '3px solid #000',
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>BPM</span>
        <input
          type="number"
          min={40}
          max={240}
          value={bpm}
          onChange={handleBpmChange}
          style={{
            width: 56,
            background: 'transparent',
            border: '2px solid #000',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: 13,
            textAlign: 'center',
            padding: '2px 4px',
            color: '#000',
          }}
        />
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
            background: page === 'STUDIO' ? 'rgba(0,0,0,0.06)' : 'transparent',
            flexShrink: 0,
          }}
        >
          {page}
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

      {/* Auth */}
      <AuthButton user={user} />
    </div>
  );
}
