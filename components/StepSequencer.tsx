'use client';
import { useEffect, useState } from 'react';
import { audioEngine } from '@/lib/audioEngine';
import { MODULE_COLORS, GRID_ROWS, GRID_STEPS, useStore } from '@/lib/store';
import type { ModuleType } from '@/lib/audioEngine';

const SCALE_FREQS: Record<ModuleType, number[]> = {
  drum:  [80, 100, 120, 150, 180, 200, 240, 300],
  bass:  [55, 73.4, 82.4, 110, 146.8, 164.8, 220, 293.7],
  pad:   [261.6, 293.7, 329.6, 369.9, 415.3, 466.2, 523.2, 587.3],
  synth: [220, 246.9, 261.6, 293.7, 329.6, 369.9, 415.3, 440],
  arp:   [440, 493.9, 523.2, 587.3, 659.3, 739.9, 830.6, 880],
};

const DRUM_LABELS = ['Kick', 'Kick 2', 'Snare', 'Snare 2', 'Ghost', 'Hi-Hat', 'Hi-Hat 2', 'Open Hat'];

interface Props {
  module: ModuleType;
  playhead: number;
}

export default function StepSequencer({ module, playhead }: Props) {
  const grid = useStore((s) => s.grids[module]);
  const toggleCell = useStore((s) => s.toggleCell);
  const color = MODULE_COLORS[module];
  const [hoveredCell, setHoveredCell] = useState<[number,number] | null>(null);

  const toggle = (row: number, col: number) => {
    toggleCell(module, row, col);
    if (!grid[row][col]) {
      audioEngine.preview(module, SCALE_FREQS[module][row], row);
    }
  };

  useEffect(() => {
    if (playhead < 0) return;
    for (let row = 0; row < GRID_ROWS; row++) {
      if (grid[row][playhead]) {
        audioEngine.preview(module, SCALE_FREQS[module][row], row);
      }
    }
  }, [playhead, module, grid]);

  const groups = [0, 1, 2, 3].map((g) => [g * 4, g * 4 + 1, g * 4 + 2, g * 4 + 3]);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', height: '100%', minHeight: 0, position: 'relative' }}
    >

      {Array.from({ length: GRID_ROWS }, (_, ri) => (
        <div
          key={ri}
          style={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}
        >
          {groups.map((group, gi) => (
            <div
              key={gi}
              style={{ display: 'flex', gap: 3, flex: 1, marginLeft: gi > 0 ? 6 : 0 }}
            >
              {group.map((ci) => {
                const isActive = grid[ri][ci];
                const isHead = ci === playhead;
                const isHovered = module === 'drum' && hoveredCell?.[0] === ri && hoveredCell?.[1] === ci;
                return (
                  <button
                    key={ci}
                    onClick={() => toggle(ri, ci)}
                    onMouseEnter={() => module === 'drum' && setHoveredCell([ri, ci])}
                    onMouseLeave={() => module === 'drum' && setHoveredCell(null)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 0,
                      background: isActive
                        ? isHead ? '#fff' : color
                        : isHead ? '#d8d8d6' : '#f9f9f7',
                      border: '2px solid #000',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {isHovered && !isActive && (
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: 7,
                        fontWeight: 900,
                        color: '#000',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        letterSpacing: 0.3,
                      }}>
                        {DRUM_LABELS[ri]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
