'use client';
import type { CSSProperties } from 'react';
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

const DRUM_LABELS_FULL = ['KICK', 'KICK 2', 'SNARE', 'SNARE 2', 'GHOST', 'HI-HAT', 'HI-HAT 2', 'OPEN HAT'];

function freqToNote(freq: number): string {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const semitones = Math.round(12 * Math.log2(freq / 440)) + 69;
  const note = NOTE_NAMES[((semitones % 12) + 12) % 12];
  const octave = Math.floor(semitones / 12) - 1;
  return `${note}${octave}`;
}

const NOTE_LABELS_FULL: Record<ModuleType, string[]> = {
  drum:  DRUM_LABELS_FULL,
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

  const toggle = (row: number, col: number) => {
    toggleCell(module, row, col);
    if (!grid[row][col]) {
      audioEngine.preview(module, SCALE_FREQS[module][row], row);
    }
  };

  const groups = [0, 1, 2, 3].map((g) => [g * 4, g * 4 + 1, g * 4 + 2, g * 4 + 3]);
  const labelsFull = NOTE_LABELS_FULL[module];

  return (
    <div className="cursor-grid seq-grid" style={{ ['--mod-color' as string]: color } as CSSProperties}>
      {Array.from({ length: GRID_ROWS }, (_, ri) => (
        <div key={ri} className="seq-row">
          {/* Rotated row label — mobile only (CSS-gated); never affects desktop layout */}
          <div className="seq-row-header"><span>{labelsFull[ri]}</span></div>
          {groups.map((group, gi) => (
            <div key={gi} className="seq-group">
              {group.map((ci) => {
                const isActive = grid[ri][ci];
                const isHead = ci === playhead;
                // Inactive non-head cells leave background to CSS (enables mobile alternating tint);
                // active + playhead cells set it inline so they override the tint.
                const cellBg = isActive ? (isHead ? '#fff' : color) : (isHead ? '#d8d8d6' : undefined);
                return (
                  <button
                    key={ci}
                    className="step-btn step-cell"
                    onClick={() => toggle(ri, ci)}
                    style={cellBg ? { background: cellBg } : undefined}
                  >
                    {!isActive && (
                      /* Desktop hover label — position:absolute (in CSS) so it never affects cell sizing */
                      <span className="cell-label">{labelsFull[ri]}</span>
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
