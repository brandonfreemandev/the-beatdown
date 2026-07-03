import type { ModuleType } from './audioEngine';
import type { Grid, ModuleVault, ModuleSettings, TimelineBlock } from './store';
import { GRID_ROWS, GRID_STEPS } from './store';

// Fourth Arena entrant — "Neon Drift" (94 BPM lo-fi). Pairs with other bots for matchmaking.

const BPM = 94;
const BLOCK_SEC = (8 / BPM) * 60;

function grid(rows: Record<number, number[]>): Grid {
  return Array.from({ length: GRID_ROWS }, (_, r) => {
    const active = new Set(rows[r] ?? []);
    return Array.from({ length: GRID_STEPS }, (_, c) => active.has(c));
  });
}

const DRUM_SOFT = grid({
  0: [0, 8],
  2: [4, 12],
  5: [0, 4, 8, 12],
});

const DRUM_LIFT = grid({
  0: [0, 6, 8],
  2: [4, 12],
  5: [0, 2, 4, 6, 8, 10, 12, 14],
  7: [15],
});

const BASS_LOW = grid({
  0: [0, 4, 8, 12],
});

const BASS_LINE = grid({
  0: [0, 3, 8],
  2: [11, 14],
});

const PAD_MIST = grid({
  0: [0, 8],
  2: [0, 8],
});

const PAD_GLOW = grid({
  1: [0, 8],
  3: [0, 8],
  5: [0, 8],
});

const SYNTH_DOT = grid({
  4: [0, 8],
  6: [4, 12],
});

const SYNTH_WIDE = grid({
  2: [0, 4, 8, 12],
  5: [2, 10],
});

const ARP_MIST = grid({
  2: [0, 8],
  4: [4, 12],
});

const ARP_RISE = grid({
  0: [0, 8],
  2: [2, 10],
  4: [4, 12],
  6: [6, 14],
});

interface PatternSpec { key: string; name: string; grid: Grid }

const PATTERNS: Record<ModuleType, PatternSpec[]> = {
  drum: [
    { key: 'soft', name: 'SOFT KIT', grid: DRUM_SOFT },
    { key: 'lift', name: 'LIFT',     grid: DRUM_LIFT },
  ],
  bass: [
    { key: 'low',  name: 'LOW END', grid: BASS_LOW },
    { key: 'line', name: 'BASSLINE', grid: BASS_LINE },
  ],
  pad: [
    { key: 'mist', name: 'MIST', grid: PAD_MIST },
    { key: 'glow', name: 'GLOW', grid: PAD_GLOW },
  ],
  synth: [
    { key: 'dot',  name: 'DOTS', grid: SYNTH_DOT },
    { key: 'wide', name: 'WIDE', grid: SYNTH_WIDE },
  ],
  arp: [
    { key: 'mist', name: 'MIST ARP', grid: ARP_MIST },
    { key: 'rise', name: 'RISE',     grid: ARP_RISE },
  ],
};

const pid = (module: ModuleType, key: string) => `${module}-spark-${key}`;

const SPARK_VAULTS = {} as Record<ModuleType, ModuleVault>;
for (const m of Object.keys(PATTERNS) as ModuleType[]) {
  SPARK_VAULTS[m] = {
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
        id: `spark-${module}-${key}-${startSec}`,
        moduleType: module,
        patternId: pid(module, key),
        startSec,
        durationSec: BLOCK_SEC,
      });
    }
  }
  return out;
}

// 11 blocks ≈ 56s @ 94 BPM — non-overlapping spans per module
const SPARK_TIMELINE: TimelineBlock[] = [
  ...blocksFor('drum', 'soft', [[0, 5], [8, 11]]),
  ...blocksFor('drum', 'lift', [[5, 8]]),

  ...blocksFor('bass', 'low',  [[0, 4], [7, 11]]),
  ...blocksFor('bass', 'line', [[4, 7]]),

  ...blocksFor('pad', 'mist', [[1, 4]]),
  ...blocksFor('pad', 'glow', [[4, 11]]),

  ...blocksFor('synth', 'dot',  [[3, 7]]),
  ...blocksFor('synth', 'wide', [[7, 11]]),

  ...blocksFor('arp', 'mist', [[2, 5]]),
  ...blocksFor('arp', 'rise', [[5, 11]]),
];

const SPARK_GRIDS: Record<ModuleType, Grid> = {
  drum: DRUM_SOFT,
  bass: BASS_LOW,
  pad: PAD_MIST,
  synth: SYNTH_DOT,
  arp: ARP_MIST,
};

const SPARK_MODULE_SETTINGS: Record<ModuleType, ModuleSettings> = {
  drum:  { volume: 0.72, cutoff: 0.85, decay: 0.2,  attack: 0.02, res: 0.04, pan: 0.5 },
  bass:  { volume: 0.7,  cutoff: 0.32, decay: 0.55, attack: 0.06, res: 0.12, pan: 0.46 },
  pad:   { volume: 0.58, cutoff: 0.4,  decay: 0.95, attack: 0.55, res: 0.03, pan: 0.38 },
  synth: { volume: 0.52, cutoff: 0.65, decay: 0.4,  attack: 0.1,  res: 0.1,  pan: 0.55 },
  arp:   { volume: 0.38, cutoff: 0.82, decay: 0.18, attack: 0.02, res: 0.2,  pan: 0.65 },
};

export const SPARK_TRACK = {
  grids: SPARK_GRIDS,
  vaults: SPARK_VAULTS,
  timeline: SPARK_TIMELINE,
  bpm: BPM,
  moduleSettings: SPARK_MODULE_SETTINGS,
};
