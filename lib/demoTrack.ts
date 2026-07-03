import type { ModuleType } from './audioEngine';
import type { Grid, ModuleVault, ModuleSettings, TimelineBlock } from './store';
import { MODULES, MODULE_LABELS, GRID_ROWS, GRID_STEPS } from './store';

function grid(rows: Record<number, number[]>): Grid {
  return Array.from({ length: GRID_ROWS }, (_, r) => {
    const active = new Set(rows[r] ?? []);
    return Array.from({ length: GRID_STEPS }, (_, c) => active.has(c));
  });
}

function emptyGrid(): Grid {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_STEPS).fill(false));
}

// Rows: KICK, KICK 2, SNARE, SNARE 2, GHOST, HI-HAT, HI-HAT 2, OPEN HAT
const drumGrid = grid({
  0: [0, 4, 8, 12],
  2: [4, 12],
  5: [0, 2, 4, 6, 8, 10, 12, 14],
  7: [15],
});

// SCALE_FREQS.bass = [55, 73.4, 82.4, 110, 146.8, 164.8, 220, 293.7]
const bassGrid = grid({
  0: [0, 4, 8, 12],
  2: [10],
});

// SCALE_FREQS.pad = [261.6, 293.7, 329.6, 369.9, 415.3, 466.2, 523.2, 587.3]
const padGrid = grid({
  0: [0, 8],
  2: [0, 8],
  4: [0, 8],
});

// SCALE_FREQS.synth = [220, 246.9, 261.6, 293.7, 329.6, 369.9, 415.3, 440]
const synthGrid = grid({
  0: [0, 8],
  2: [2, 6, 14],
  4: [4],
});

// SCALE_FREQS.arp = [440, 493.9, 523.2, 587.3, 659.3, 739.9, 830.6, 880]
const arpGrid = grid({
  0: [0, 4, 8, 12],
  1: [1, 5, 9, 13],
  2: [2, 6, 10, 14],
  3: [3, 7, 11, 15],
});

const DEMO_GRIDS: Record<ModuleType, Grid> = {
  drum: drumGrid,
  bass: bassGrid,
  pad: padGrid,
  synth: synthGrid,
  arp: arpGrid,
};

function patternId(module: ModuleType): string {
  return `${module}-demo-1`;
}

function demoVault(module: ModuleType): ModuleVault {
  return {
    patterns: [
      {
        id: patternId(module),
        moduleType: module,
        grid: DEMO_GRIDS[module],
        data: { patternName: `${MODULE_LABELS[module]} 1`, durationBeats: 8, notes: [], activeModules: { [module]: true } },
      },
      {
        id: `${module}-demo-2`,
        moduleType: module,
        grid: emptyGrid(),
        data: { patternName: `${MODULE_LABELS[module]} 2`, durationBeats: 8, notes: [], activeModules: { [module]: true } },
      },
    ],
    activePatternId: patternId(module),
    vaultOpen: false,
  };
}

const DEMO_VAULTS: Record<ModuleType, ModuleVault> = {} as Record<ModuleType, ModuleVault>;
for (const m of MODULES) DEMO_VAULTS[m] = demoVault(m);

function block(id: string, module: ModuleType, startSec: number, durationSec: number): TimelineBlock {
  return { id, moduleType: module, patternId: patternId(module), startSec, durationSec };
}

// Drums + bass throughout, pad/synth/arp stagger in — one pattern per module, no variations.
const DEMO_TIMELINE: TimelineBlock[] = [
  block('demo-drum-1', 'drum', 0, 48),
  block('demo-bass-1', 'bass', 0, 48),
  block('demo-pad-1', 'pad', 12, 36),
  block('demo-synth-1', 'synth', 24, 24),
  block('demo-arp-1', 'arp', 36, 12),
];

const DEMO_MODULE_SETTINGS: Record<ModuleType, ModuleSettings> = {
  drum:  { volume: 0.8,  cutoff: 0.9,  decay: 0.15, attack: 0.02, res: 0.1,  pan: 0.5 },
  bass:  { volume: 0.75, cutoff: 0.35, decay: 0.4,  attack: 0.05, res: 0.15, pan: 0.5 },
  pad:   { volume: 0.55, cutoff: 0.5,  decay: 0.85, attack: 0.4,  res: 0.05, pan: 0.4 },
  synth: { volume: 0.6,  cutoff: 0.7,  decay: 0.35, attack: 0.08, res: 0.2,  pan: 0.6 },
  arp:   { volume: 0.45, cutoff: 0.85, decay: 0.2,  attack: 0.01, res: 0.25, pan: 0.65 },
};

export const DEMO_TRACK = {
  grids: DEMO_GRIDS,
  vaults: DEMO_VAULTS,
  timeline: DEMO_TIMELINE,
  bpm: 100,
  moduleSettings: DEMO_MODULE_SETTINGS,
};
