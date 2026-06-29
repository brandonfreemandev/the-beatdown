'use client';
import { useRef, useState, useCallback } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import { MODULE_COLORS, MODULE_LABELS, MODULES, GRID_ROWS, GRID_STEPS } from '@/lib/store';
import type { ModuleType } from '@/lib/audioEngine';
import type { ArrangementData } from '@/lib/supabase/types';

const SCALE_FREQS: Record<ModuleType, number[]> = {
  drum:  [80, 100, 120, 150, 180, 200, 240, 300],
  bass:  [55, 73.4, 82.4, 110, 146.8, 164.8, 220, 293.7],
  pad:   [261.6, 293.7, 329.6, 369.9, 415.3, 466.2, 523.2, 587.3],
  synth: [220, 246.9, 261.6, 293.7, 329.6, 369.9, 415.3, 440],
  arp:   [440, 493.9, 523.2, 587.3, 659.3, 739.9, 830.6, 880],
};

interface Props {
  arrangement: ArrangementData;
  color: string;
  label: string;
  title?: string;
}

export default function ArenaPlayer({ arrangement, color, label, title }: Props) {
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStep(-1);
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing) { stop(); return; }
    audioEngine.resume();
    stepRef.current = 0;
    const msPerStep = (60 / (arrangement.bpm ?? 120) / 4) * 1000;
    timerRef.current = setInterval(() => {
      const s = stepRef.current % GRID_STEPS;
      setStep(s);
      for (const module of MODULES) {
        const grid = arrangement.grids?.[module];
        if (!grid) continue;
        for (let row = 0; row < GRID_ROWS; row++) {
          if (grid[row]?.[s]) {
            audioEngine.preview(module as ModuleType, SCALE_FREQS[module as ModuleType][row], row);
          }
        }
      }
      stepRef.current += 1;
    }, msPerStep);
    setPlaying(true);
  }, [playing, arrangement, stop]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Header */}
      <div style={{
        background: color, borderBottom: '3px solid #000',
        padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 9, letterSpacing: 3, opacity: 0.6 }}>{label}</div>
          {title && <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 13, letterSpacing: 2, marginTop: 2 }}>{title}</div>}
        </div>
        <button
          onClick={toggle}
          style={{
            background: playing ? '#000' : 'rgba(0,0,0,0.15)',
            color: playing ? '#f9f9f7' : '#000',
            border: '2px solid #000',
            fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 2,
            padding: '5px 14px', cursor: 'pointer', flexShrink: 0,
          }}
        >
          {playing ? '■ STOP' : '▶ LISTEN'}
        </button>
      </div>

      {/* Mini grid with module labels */}
      <div style={{ padding: '12px 14px 10px', flex: 1, background: '#f9f9f7' }}>
        {MODULES.map((mod) => {
          const grid = arrangement.grids?.[mod];
          const modColor = MODULE_COLORS[mod as ModuleType];
          const hasAny = grid?.some((row) => row.some(Boolean));
          return (
            <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, height: 12 }}>
              <div style={{
                width: 36, flexShrink: 0,
                fontFamily: 'monospace', fontSize: 7, fontWeight: 900, letterSpacing: 1,
                color: hasAny ? '#000' : '#bbb',
              }}>
                {MODULE_LABELS[mod as ModuleType]}
              </div>
              <div style={{ flex: 1, display: 'flex', gap: 1, height: '100%' }}>
                {Array.from({ length: GRID_STEPS }, (_, ci) => {
                  const hasNote = grid?.some((row) => row[ci]);
                  const isHead = ci === step;
                  return (
                    <div
                      key={ci}
                      style={{
                        flex: 1,
                        background: hasNote ? (isHead ? '#fff' : modColor) : isHead ? '#ddd' : '#ebebeb',
                        border: '1px solid rgba(0,0,0,0.2)',
                        marginLeft: ci > 0 && ci % 4 === 0 ? 2 : 0,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, color: '#999' }}>
          {arrangement.bpm} BPM
        </div>
      </div>
    </div>
  );
}
