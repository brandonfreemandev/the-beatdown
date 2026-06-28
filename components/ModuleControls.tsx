'use client';
import { useState, useCallback } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import { MODULE_COLORS, useStore } from '@/lib/store';
import RotaryKnob from './RotaryKnob';
import type { ModuleType } from '@/lib/audioEngine';

interface Props {
  module: ModuleType;
  playhead: number;
}

export default function ModuleControls({ module, playhead }: Props) {
  const color = MODULE_COLORS[module];
  const vaultOpen = useStore((s) => s.vaults[module].vaultOpen);

  const [volume, setVolume] = useState(0.7);
  const [cutoff, setCutoff] = useState(0.8);
  const [decay, setDecay] = useState(0.3);
  const [attack, setAttack] = useState(0.05);

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
        {!vaultOpen && (
          <>
            <RotaryKnob label="RES" value={0.4} onChange={() => {}} color={color} />
            <RotaryKnob label="PAN" value={0.5} onChange={() => {}} color={color} />
          </>
        )}
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
