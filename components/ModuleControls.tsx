'use client';
import { useState, useCallback } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import { MODULE_COLORS, useStore } from '@/lib/store';
import RotaryKnob from './RotaryKnob';
import type { ModuleType } from '@/lib/audioEngine';

interface Props {
  module: ModuleType;
  playhead: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export default function ModuleControls({ module, playhead, isPlaying, onTogglePlay }: Props) {
  const color = MODULE_COLORS[module];

  const [volume, setVolume] = useState(0.7);
  const [cutoff, setCutoff] = useState(0.8);
  const [decay, setDecay] = useState(0.3);
  const [attack, setAttack] = useState(0.05);
  const [res, setRes] = useState(0.05); // 0–1 mapped to Q 0–20
  const [pan, setPan] = useState(0.5);  // 0–1 mapped to -1..+1

  const handleVolume = useCallback((v: number) => {
    setVolume(v);
    audioEngine.setVolume(module, v);
  }, [module]);

  const handleCutoff = useCallback((v: number) => {
    setCutoff(v);
    // map 0-1 to 200-18000 Hz (log scale approx)
    audioEngine.setCutoff(module, 200 + v * v * 17800);
  }, [module]);

  const handleDecay = useCallback((v: number) => {
    setDecay(v);
    audioEngine.setDecay(module, 0.05 + v * 2.0);
  }, [module]);

  const handleAttack = useCallback((v: number) => {
    setAttack(v);
    audioEngine.setAttack(module, 0.001 + v * 0.3);
  }, [module]);

  const handleRes = useCallback((v: number) => {
    setRes(v);
    audioEngine.setRes(module, v * 20); // 0–20 Q range
  }, [module]);

  const handlePan = useCallback((v: number) => {
    setPan(v);
    audioEngine.setPan(module, (v - 0.5) * 2); // 0–1 → -1..+1
  }, [module]);

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
        flexDirection: 'column',
        gap: 0,
        height: '100%',
      }}
    >
      {/* Knob row */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: '16px 20px',
          borderBottom: '2px solid #000',
          background: '#f9f9f7',
          alignItems: 'flex-end',
        }}
      >
        <RotaryKnob label="VOL" value={volume} onChange={handleVolume} color={color} />
        <RotaryKnob label="CUTOFF" value={cutoff} onChange={handleCutoff} color={color} />
        <RotaryKnob label="DECAY" value={decay} onChange={handleDecay} color={color} />
        <RotaryKnob label="ATTACK" value={attack} onChange={handleAttack} color={color} />
        <RotaryKnob label="RES" value={res} onChange={handleRes} color={color} />
        <RotaryKnob label="PAN" value={pan} onChange={handlePan} color={color} />

        {/* Play + BPM — lives here instead of the header row */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 12, paddingBottom: 2 }}>
          <button
            onClick={onTogglePlay}
            style={{
              height: 36,
              padding: '0 18px',
              background: isPlaying ? '#000' : '#f9f9f7',
              color: isPlaying ? '#f9f9f7' : '#000',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 2,
              cursor: 'pointer',
              border: '2px solid #000',
            }}
          >
            {isPlaying ? '■ STOP' : '▶ PLAY'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, letterSpacing: 2, paddingBottom: 2 }}>BPM</span>
            <input
              type="number"
              min={40}
              max={240}
              value={bpm}
              onChange={handleBpmChange}
              style={{
                width: 56,
                height: 36,
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
        </div>
      </div>

      {/* Sequencer grid area */}
      <div
        style={{
          flex: 1,
          padding: '12px 16px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Lazy import to avoid SSR issues */}
        <SequencerWrapper module={module} playhead={playhead} />
      </div>
    </div>
  );
}

// Thin wrapper so StepSequencer renders only client-side
import dynamic from 'next/dynamic';
const StepSequencer = dynamic(() => import('./StepSequencer'), { ssr: false });

function SequencerWrapper({ module, playhead }: { module: ModuleType; playhead: number }) {
  return <StepSequencer module={module} playhead={playhead} />;
}
