import type { ModuleType } from './audioEngine';
import type { Grid, ModuleVault, ModuleSettings, TimelineBlock } from './store';
import { MODULES, MODULE_LABELS, GRID_ROWS, GRID_STEPS } from './store';

// Claude Sonnet 5's Arena submission — a simpler single-pattern-per-module layout.
// Kept separate from the bundled demo (demoTrack.ts) so the two bots stay distinct.

function grid(rows: Record<number, number[]>): Grid {
  return Array.from({ length: GRID_ROWS }, (_, r) => {
    const active = new Set(rows[r] ?? []);
    return Array.from({ length: GRID_STEPS }, (_, c) => active.has(c));
  });
}

function emptyGrid(): Grid {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_STEPS).fill(false));
}

const drumGrid = grid({
  0: [0, 4, 8, 12],
  2: [4, 12],
  5: [0, 2, 4, 6, 8, 10, 12, 14],
  7: [15],
});

const bassGrid = grid({
  0: [0, 4, 8, 12],
  2: [10],
});

const padGrid = grid({
  0: [0, 8],
  2: [0, 8],
  4: [0, 8],
});

const synthGrid = grid({
  0: [0, 8],
  2: [2, 6, 14],
  4: [4],
});

const arpGrid = grid({
  0: [0, 4, 8, 12],
  1: [1, 5, 9, 13],
  2: [2, 6, 10, 14],
  3: [3, 7, 11, 15],
});

const SONNET_GRIDS: Record<ModuleType, Grid> = {
  drum: drumGrid,
  bass: bassGrid,
  pad: padGrid,
  synth: synthGrid,
  arp: arpGrid,
};

function patternId(module: ModuleType): string {
  return `${module}-sonnet-1`;
}

function sonnetVault(module: ModuleType): ModuleVault {
  return {
    patterns: [
      {
        id: patternId(module),
        moduleType: module,
        grid: SONNET_GRIDS[module],
        data: { patternName: `${MODULE_LABELS[module]} 1`, durationBeats: 8, notes: [], activeModules: { [module]: true } },
      },
      {
        id: `${module}-sonnet-2`,
        moduleType: module,
        grid: emptyGrid(),
        data: { patternName: `${MODULE_LABELS[module]} 2`, durationBeats: 8, notes: [], activeModules: { [module]: true } },
      },
    ],
    activePatternId: patternId(module),
    vaultOpen: false,
  };
}

const SONNET_VAULTS: Record<ModuleType, ModuleVault> = {} as Record<ModuleType, ModuleVault>;
for (const m of MODULES) SONNET_VAULTS[m] = sonnetVault(m);

function block(id: string, module: ModuleType, startSec: number, durationSec: number): TimelineBlock {
  return { id, moduleType: module, patternId: patternId(module), startSec, durationSec };
}

const SONNET_TIMELINE: TimelineBlock[] = [
  block('sonnet-drum-1', 'drum', 0, 48),
  block('sonnet-bass-1', 'bass', 0, 48),
  block('sonnet-pad-1', 'pad', 12, 36),
  block('sonnet-synth-1', 'synth', 24, 24),
  block('sonnet-arp-1', 'arp', 36, 12),
];

const SONNET_MODULE_SETTINGS: Record<ModuleType, ModuleSettings> = {
  drum:  { volume: 0.8,  cutoff: 0.9,  decay: 0.15, attack: 0.02, res: 0.1,  pan: 0.5 },
  bass:  { volume: 0.75, cutoff: 0.35, decay: 0.4,  attack: 0.05, res: 0.15, pan: 0.5 },
  pad:   { volume: 0.55, cutoff: 0.5,  decay: 0.85, attack: 0.4,  res: 0.05, pan: 0.4 },
  synth: { volume: 0.6,  cutoff: 0.7,  decay: 0.35, attack: 0.08, res: 0.2,  pan: 0.6 },
  arp:   { volume: 0.45, cutoff: 0.85, decay: 0.2,  attack: 0.01, res: 0.25, pan: 0.65 },
};

export const SONNET_TRACK = {
  grids: SONNET_GRIDS,
  vaults: SONNET_VAULTS,
  timeline: SONNET_TIMELINE,
  bpm: 100,
  moduleSettings: SONNET_MODULE_SETTINGS,
};
