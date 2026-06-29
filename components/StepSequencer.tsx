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

const DRUM_LABELS = ['KICK', 'KICK 2', 'SNARE', 'SNARE 2', 'GHOST', 'HI-HAT', 'HI-HAT 2', 'OPEN HAT'];

// Convert Hz to nearest note name
function freqToNote(freq: number): string {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const semitones = Math.round(12 * Math.log2(freq / 440)) + 69;
  const note = NOTE_NAMES[((semitones % 12) + 12) % 12];
  const octave = Math.floor(semitones / 12) - 1;
  return `${note}${octave}`;
}

const NOTE_LABELS: Record<ModuleType, string[]> = {
  drum:  DRUM_LABELS,
  bass:  SCALE_FREQS.bass.map(freqToNote),
  pad:   SCALE_FREQS.pad.map(freqToNote),
  synth: SCALE_FREQS.synth.map(freqToNote),
  arp:   SCALE_FREQS.arp.map(freqToNote),
};

interface Props {
  module: ModuleType;
  playhead: number;
}

export default function StepSequencer({ module, playhead }: Props) {
  const grid = useStore((s) => s.grids[module]);
  const toggleCell = useStore((s) => s.toggleCell);
  const color = MODULE_COLORS[module];
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);

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
  const labels = NOTE_LABELS[module];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', height: '100%', minHeight: 0 }}>
      {Array.from({ length: GRID_ROWS }, (_, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}>
          {groups.map((group, gi) => (
            <div key={gi} style={{ display: 'flex', gap: 3, flex: 1, marginLeft: gi > 0 ? 6 : 0 }}>
              {group.map((ci) => {
                const isActive = grid[ri][ci];
                const isHead = ci === playhead;
                const isHovered = hoveredCell?.[0] === ri && hoveredCell?.[1] === ci;
                return (
                  <button
                    key={ci}
                    onClick={() => toggle(ri, ci)}
                    onMouseEnter={() => setHoveredCell([ri, ci])}
                    onMouseLeave={() => setHoveredCell(null)}
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
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 2,
                        color: '#000',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}>
                        {labels[ri]}
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
