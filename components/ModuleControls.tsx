'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
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
  const moduleSettings = useStore((s) => s.moduleSettings[module]);
  const setModuleSettings = useStore((s) => s.setModuleSettings);
  const res = moduleSettings?.res ?? 0.05;
  const pan = moduleSettings?.pan ?? 0.5;

  // Vault state — self-contained here
  const vault = useStore((s) => s.vaults[module]);
  const loadPatternToGrid = useStore((s) => s.loadPatternToGrid);
  const addPattern = useStore((s) => s.addPattern);
  const [vaultOpen, setVaultOpen] = useState(false);
  const vaultRef = useRef<HTMLDivElement>(null);

  const activePattern = vault.patterns.find((p) => p.id === vault.activePatternId);
  const vaultLabel = activePattern ? activePattern.data.patternName : 'VAULT';

  useEffect(() => {
    if (!vaultOpen) return;
    const handler = (e: MouseEvent) => {
      if (vaultRef.current && !vaultRef.current.contains(e.target as Node)) {
        setVaultOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [vaultOpen]);

  // Close vault when module changes
  useEffect(() => { setVaultOpen(false); }, [module]);

  const handleVolume = useCallback((v: number) => {
    setVolume(v);
    audioEngine.setVolume(module, v);
  }, [module]);

  const handleCutoff = useCallback((v: number) => {
    setCutoff(v);
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
    setModuleSettings(module, { res: v });
    audioEngine.setRes(module, v * 20);
  }, [module, setModuleSettings]);

  const handlePan = useCallback((v: number) => {
    setModuleSettings(module, { pan: v });
    audioEngine.setPan(module, (v - 0.5) * 2);
  }, [module, setModuleSettings]);

  const bpm = useStore((s) => s.bpm);
  const setBpm = useStore((s) => s.setBpm);
  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setBpm(v);
    audioEngine.setBpm(v);
  };

  return (
    <div className="mc-root">
      {/* Knob row */}
      <div className="controls-row">
        <RotaryKnob label="VOL"    value={volume} onChange={handleVolume} color={color} defaultValue={0.7} />
        <RotaryKnob label="CUTOFF" value={cutoff} onChange={handleCutoff} color={color} defaultValue={0.8} />
        <RotaryKnob label="DECAY"  value={decay}  onChange={handleDecay}  color={color} defaultValue={0.3} />
        <RotaryKnob label="ATTACK" value={attack} onChange={handleAttack} color={color} defaultValue={0.05} />
        <RotaryKnob label="RES"    value={res}    onChange={handleRes}    color={color} defaultValue={0.05} />
        <RotaryKnob label="PAN"    value={pan}    onChange={handlePan}    color={color} defaultValue={0.5} />

        {/* Play + BPM + Vault */}
        <div className="controls-play-bpm">
          {/* Vault selector */}
          <div ref={vaultRef} className="vault-wrap">
            <button
              onClick={() => setVaultOpen((o) => !o)}
              className={`vault-toggle${vaultOpen ? ' open' : ''}`}
            >
              <span className="vault-label">{vaultLabel}</span>
              <span className="vault-caret">{vaultOpen ? '▴' : '▾'}</span>
            </button>

            {vaultOpen && (
              <div className="vault-menu">
                {vault.patterns.map((p) => {
                  const isActive = p.id === vault.activePatternId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { loadPatternToGrid(module, p.id); setVaultOpen(false); }}
                      className={`vault-item${isActive ? ' active' : ''}`}
                    >
                      <div className="vault-item-swatch" style={{ background: isActive ? color : 'transparent' }} />
                      <span className="vault-item-name">{p.data.patternName}</span>
                    </button>
                  );
                })}
                {vault.patterns.length < 5 && (
                  <button
                    onClick={() => { addPattern(module); setVaultOpen(false); }}
                    className="vault-new"
                  >
                    + NEW PATTERN
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Play button — icon-only DAW transport control, no spelled-out label */}
          <button
            onClick={onTogglePlay}
            className={`transport-play${isPlaying ? ' playing' : ''}`}
            aria-label={isPlaying ? 'Stop' : 'Play'}
            title={isPlaying ? 'Stop' : 'Play'}
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" fill="currentColor" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2.5 1 L12.5 7 L2.5 13 Z" fill="currentColor" /></svg>
            )}
          </button>

          {/* BPM */}
          <div className="bpm-wrap">
            <span className="bpm-label">BPM</span>
            <input
              type="number"
              min={40}
              max={240}
              value={bpm}
              onChange={handleBpmChange}
              className="bpm-input"
            />
          </div>
        </div>
      </div>

      {/* Sequencer grid area */}
      <div className="seq-area">
        <SequencerWrapper module={module} playhead={playhead} />
      </div>
    </div>
  );
}

import dynamic from 'next/dynamic';
const StepSequencer = dynamic(() => import('./StepSequencer'), { ssr: false });

function SequencerWrapper({ module, playhead }: { module: ModuleType; playhead: number }) {
  return <StepSequencer module={module} playhead={playhead} />;
}
