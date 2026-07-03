import type { ModuleType } from './audioEngine';
import type { Grid, ModuleVault, ModuleSettings, TimelineBlock } from './store';
import { GRID_ROWS, GRID_STEPS } from './store';

// Cursor Composer 2.5 Fast — "Sidechain City"
// 108 BPM broken-beat funk. Multi-pattern vaults + 4s timeline blocks.

const BPM = 108;
const BLOCK_SEC = (8 / BPM) * 60;

function grid(rows: Record<number, number[]>): Grid {
  return Array.from({ length: GRID_ROWS }, (_, r) => {
    const active = new Set(rows[r] ?? []);
    return Array.from({ length: GRID_STEPS }, (_, c) => active.has(c));
  });
}

const DRUM_POCKET = grid({
  0: [0, 3, 8, 11],
  2: [4, 12],
  5: [2, 6, 10, 14],
});

const DRUM_DRIVE = grid({
  0: [0, 3, 6, 8, 11],
  2: [4, 10, 12],
  4: [7, 15],
  5: [0, 2, 4, 6, 8, 10, 12, 14],
  7: [14],
});

const DRUM_BREAK = grid({
  0: [0, 8],
  2: [2, 4, 6, 8, 10, 12, 14],
  5: [1, 3, 5, 7, 9, 11, 13, 15],
});

const BASS_SUB = grid({
  0: [0, 8],
  2: [4, 12],
});

const BASS_GROOVE = grid({
  0: [0, 6],
  1: [8],
  2: [10, 14],
  3: [12],
});

const PAD_STAB = grid({
  4: [0, 8],
  6: [0, 8],
});

const PAD_SWELL = grid({
  0: [0],
  2: [4, 12],
  4: [0, 8],
  6: [0, 8],
});

const SYNTH_RIFF = grid({
  3: [0, 4, 8, 12],
  4: [2, 6, 10, 14],
});

const SYNTH_AIR = grid({
  5: [0, 8],
  6: [4],
  7: [2, 10],
});

const ARP_PUMP = grid({
  0: [0, 4, 8, 12],
  1: [2, 6, 10, 14],
  2: [1, 5, 9, 13],
});

const ARP_DROP = grid({
  4: [0, 8],
  5: [4, 12],
  6: [2, 6, 10, 14],
});

interface PatternSpec { key: string; name: string; grid: Grid }

const PATTERNS: Record<ModuleType, PatternSpec[]> = {
  drum: [
    { key: 'pocket', name: 'POCKET', grid: DRUM_POCKET },
    { key: 'drive',  name: 'DRIVE',  grid: DRUM_DRIVE },
    { key: 'break',  name: 'BREAK',  grid: DRUM_BREAK },
  ],
  bass: [
    { key: 'sub',    name: 'SUB HOLD', grid: BASS_SUB },
    { key: 'groove', name: 'GROOVE',   grid: BASS_GROOVE },
  ],
  pad: [
    { key: 'stab',  name: 'STAB',  grid: PAD_STAB },
    { key: 'swell', name: 'SWELL', grid: PAD_SWELL },
  ],
  synth: [
    { key: 'riff', name: 'RIFF', grid: SYNTH_RIFF },
    { key: 'air',  name: 'AIR',  grid: SYNTH_AIR },
  ],
  arp: [
    { key: 'pump', name: 'PUMP', grid: ARP_PUMP },
    { key: 'drop', name: 'DROP', grid: ARP_DROP },
  ],
};

const pid = (module: ModuleType, key: string) => `${module}-composer-${key}`;

const COMPOSER_VAULTS = {} as Record<ModuleType, ModuleVault>;
for (const m of Object.keys(PATTERNS) as ModuleType[]) {
  COMPOSER_VAULTS[m] = {
    patterns: PATTERNS[m].map((p) => ({
      id: pid(m, p.key),
      moduleType: m,
      grid: p.grid,
      data: { patternName: p.name, durationBeats: 8, notes: [], activeModules: { [m]: true } },
    })),
    activePatternId: pid(m, PATTERNS[m][0].key),
    vaultOpen: false,
  };
}

function blocksFor(module: ModuleType, key: string, blockRanges: Array<[number, number]>): TimelineBlock[] {
  const out: TimelineBlock[] = [];
  for (const [startBlock, endBlock] of blockRanges) {
    for (let b = startBlock; b < endBlock; b++) {
      const startSec = b * BLOCK_SEC;
      out.push({
        id: `composer-${module}-${key}-${startSec}`,
        moduleType: module,
        patternId: pid(module, key),
        startSec,
        durationSec: BLOCK_SEC,
      });
    }
  }
  return out;
}

// 12 blocks ≈ 53s @ 108 BPM — non-overlapping spans per module
const COMPOSER_TIMELINE: TimelineBlock[] = [
  ...blocksFor('drum', 'pocket', [[0, 4], [10, 12]]),
  ...blocksFor('drum', 'break',  [[4, 6]]),
  ...blocksFor('drum', 'drive',  [[6, 10]]),

  ...blocksFor('bass', 'sub',    [[0, 6]]),
  ...blocksFor('bass', 'groove', [[6, 12]]),

  ...blocksFor('pad', 'stab',  [[2, 6]]),
  ...blocksFor('pad', 'swell', [[6, 12]]),

  ...blocksFor('synth', 'air',  [[0, 4], [10, 12]]),
  ...blocksFor('synth', 'riff', [[4, 10]]),

  ...blocksFor('arp', 'pump', [[3, 8]]),
  ...blocksFor('arp', 'drop', [[8, 12]]),
];

const COMPOSER_GRIDS: Record<ModuleType, Grid> = {
  drum: DRUM_POCKET,
  bass: BASS_SUB,
  pad: PAD_STAB,
  synth: SYNTH_RIFF,
  arp: ARP_PUMP,
};

const COMPOSER_MODULE_SETTINGS: Record<ModuleType, ModuleSettings> = {
  drum:  { volume: 0.82, cutoff: 0.92, decay: 0.1,  attack: 0.01, res: 0.08, pan: 0.48 },
  bass:  { volume: 0.8,  cutoff: 0.28, decay: 0.5,  attack: 0.02, res: 0.22, pan: 0.52 },
  pad:   { volume: 0.48, cutoff: 0.55, decay: 0.75, attack: 0.35, res: 0.08, pan: 0.42 },
  synth: { volume: 0.65, cutoff: 0.8,  decay: 0.25, attack: 0.04, res: 0.18, pan: 0.62 },
  arp:   { volume: 0.4,  cutoff: 0.88, decay: 0.12, attack: 0.01, res: 0.28, pan: 0.7 },
};

export const COMPOSER_TRACK = {
  grids: COMPOSER_GRIDS,
  vaults: COMPOSER_VAULTS,
  timeline: COMPOSER_TIMELINE,
  bpm: BPM,
  moduleSettings: COMPOSER_MODULE_SETTINGS,
};
