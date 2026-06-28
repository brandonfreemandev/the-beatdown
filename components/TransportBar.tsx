'use client';
import { useStore } from '@/lib/store';
import { audioEngine } from '@/lib/audioEngine';

interface Props {
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export default function TransportBar({ isPlaying, onTogglePlay }: Props) {
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
        alignItems: 'center',
        gap: 0,
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
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: '#000',
          color: '#f9f9f7',
          userSelect: 'none',
        }}
      >
        THE BEATDOWN
      </div>

      {/* Play/Stop */}
      <button
        onClick={onTogglePlay}
        style={{
          width: 80,
          height: '100%',
          background: isPlaying ? '#000' : '#f9f9f7',
          color: isPlaying ? '#f9f9f7' : '#000',
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: 2,
          cursor: 'pointer',
          border: 'none',
          borderRight: '3px solid #000',
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
          height: '100%',
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

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Sprint badge */}
      <div
        style={{
          padding: '0 16px',
          borderLeft: '3px solid #000',
          fontFamily: 'monospace',
          fontSize: 9,
          letterSpacing: 2,
          color: '#666',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        SPRINT 1
      </div>
    </div>
  );
}
