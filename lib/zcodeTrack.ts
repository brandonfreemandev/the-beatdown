import type { ModuleType } from './audioEngine';
import type { Grid, ModuleVault, ModuleSettings, TimelineBlock } from './store';
import { GRID_ROWS, GRID_STEPS } from './store';

// ── ZCode's own submission ("SHIP IT") ───────────────────────────────────────
// An A-minor house cut about shipping software. Pattern names trace a release:
// cold boot → green build → hotfix → deploy. Structured like the bundled demo:
// named 16-step patterns per module vault, standard blocks (durationBeats: 8
// → 4.0s at 120 BPM).

const BPM = 120;
const BLOCK_SEC = (8 / BPM) * 60; // 4.0s

function grid(rows: Record<number, number[]>): Grid {
  return Array.from({ length: GRID_ROWS }, (_, r) => {
    const active = new Set(rows[r] ?? []);
    return Array.from({ length: GRID_STEPS }, (_, c) => active.has(c));
  });
}

// ── Patterns ──────────────────────────────────────────────────────────────────
// Drum rows: KICK, KICK 2, SNARE, SNARE 2, GHOST, HI-HAT, HI-HAT 2, OPEN HAT

const DRUM_COLD_BOOT = grid({
  1: [0, 8],
  4: [3, 7, 11, 15],
  6: [12],
});

const DRUM_GREEN_BUILD = grid({
  1: [0, 4, 8, 12],
  2: [4, 12],
  5: [2, 6, 10, 14],
  4: [7, 15],
  7: [6],
});

const DRUM_HOTFIX = grid({
  1: [0, 8],
  2: [4, 10, 12, 14, 15],
  3: [11, 13],
  5: [2, 6],
});

const DRUM_DEPLOY = grid({
  1: [0, 4, 6, 8, 12],
  2: [4, 12],
  3: [15],
  5: [2, 6, 10, 14],
  4: [3, 11],
  7: [6, 14],
});

const BASS_PING = grid({
  0: [0, 3, 6],
  3: [8, 11],
  1: [14],
});

const BASS_ROLLING = grid({
  0: [0, 2, 4, 6, 8, 10, 12, 14],
  3: [4, 12],
});

const BASS_MAINTENANCE = grid({
  3: [0, 8],
  5: [6, 14],
});

const PAD_UPTIME = grid({
  0: [0],
  2: [4],
  4: [8],
  6: [12],
});

const PAD_BALANCED = grid({
  0: [0, 8],
  2: [0, 8],
  4: [8],
});

const PAD_NIGHTSHIFT = grid({
  5: [0, 8],
  1: [0, 8],
  4: [4, 12],
});

const SYNTH_STAB = grid({
  0: [0, 8],
  2: [3, 11],
  4: [6, 14],
});

const SYNTH_CALL = grid({
  7: [0],
  4: [3, 6, 11],
  5: [8],
  2: [14],
});

const SYNTH_ROLLBACK = grid({
  7: [0],
  6: [2],
  5: [4],
  4: [6],
  3: [8],
  2: [10],
  1: [12],
  0: [14],
});

const ARP_HEARTBEAT = grid({
  4: [0, 8],
  0: [4, 12],
});

const ARP_PIPELINE = grid({
  0: [0, 4, 8, 12],
  2: [2, 6, 10, 14],
  4: [1, 5, 9, 13],
  3: [3, 7, 11, 15],
});

const ARP_RELEASE = grid({
  0: [0, 2, 4, 6],
  2: [8, 10],
  4: [12],
  5: [14],
});

// ── Vaults ────────────────────────────────────────────────────────────────────

interface PatternSpec { key: string; name: string; grid: Grid }

const PATTERNS: Record<ModuleType, PatternSpec[]> = {
  drum: [
    { key: 'boot',   name: 'COLD BOOT',       grid: DRUM_COLD_BOOT },
    { key: 'build',  name: 'GREEN BUILD',     grid: DRUM_GREEN_BUILD },
    { key: 'hotfix', name: 'HOTFIX FILL',     grid: DRUM_HOTFIX },
    { key: 'deploy', name: 'DEPLOY WEEKEND',  grid: DRUM_DEPLOY },
  ],
  bass: [
    { key: 'ping',  name: 'PING',            grid: BASS_PING },
    { key: 'roll',  name: 'ROLLING DEPLOY',  grid: BASS_ROLLING },
    { key: 'maint', name: 'MAINTENANCE',     grid: BASS_MAINTENANCE },
  ],
  pad: [
    { key: 'uptime', name: 'AMBIENT UPTIME',  grid: PAD_UPTIME },
    { key: 'load',   name: 'LOAD BALANCED',   grid: PAD_BALANCED },
    { key: 'night',  name: 'NIGHT SHIFT',     grid: PAD_NIGHTSHIFT },
  ],
  synth: [
    { key: 'stab', name: 'STATUS STAB',      grid: SYNTH_STAB },
    { key: 'call', name: 'SHIPPING CALL',    grid: SYNTH_CALL },
    { key: 'run',  name: 'ROLLBACK RUN',     grid: SYNTH_ROLLBACK },
  ],
  arp: [
    { key: 'beat',    name: 'HEARTBEAT',      grid: ARP_HEARTBEAT },
    { key: 'ci',      name: 'CI PIPELINE',    grid: ARP_PIPELINE },
    { key: 'release', name: 'RELEASE RISE',   grid: ARP_RELEASE },
  ],
};

const pid = (module: ModuleType, key: string) => `zcode-${module}-${key}`;

const ZCODE_VAULTS = {} as Record<ModuleType, ModuleVault>;
for (const m of Object.keys(PATTERNS) as ModuleType[]) {
  ZCODE_VAULTS[m] = {
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

// ── Timeline ──────────────────────────────────────────────────────────────────

function blocksFor(module: ModuleType, key: string, spans: Array<[number, number]>): TimelineBlock[] {
  const out: TimelineBlock[] = [];
  for (const [start, end] of spans) {
    for (let sec = start; sec < end; sec += BLOCK_SEC) {
      out.push({
        id: `zcode-${module}-${key}-${sec}`,
        moduleType: module,
        patternId: pid(module, key),
        startSec: sec,
        durationSec: BLOCK_SEC,
      });
    }
  }
  return out;
}

// 48s form: BOOT 0–8 · GROOVE 8–24 · DROP 24–32 · BREAKDOWN 32–40 · FINAL PUSH 40–48
const ZCODE_TIMELINE: TimelineBlock[] = [
  ...blocksFor('drum', 'boot',   [[0, 8]]),
  ...blocksFor('drum', 'build',  [[8, 24]]),
  ...blocksFor('drum', 'hotfix', [[24, 28]]),
  ...blocksFor('drum', 'deploy', [[28, 32], [40, 48]]),
  ...blocksFor('drum', 'boot',   [[32, 40]]),

  ...blocksFor('bass', 'ping',  [[8, 16]]),
  ...blocksFor('bass', 'roll',  [[16, 32], [40, 48]]),
  ...blocksFor('bass', 'maint', [[32, 40]]),

  ...blocksFor('pad', 'uptime', [[0, 16], [40, 48]]),
  ...blocksFor('pad', 'load',   [[16, 32]]),
  ...blocksFor('pad', 'night',  [[32, 36]]),
  ...blocksFor('pad', 'load',   [[36, 40]]),

  ...blocksFor('synth', 'stab', [[16, 24], [36, 40]]),
  ...blocksFor('synth', 'call', [[24, 32], [40, 48]]),
  ...blocksFor('synth', 'run',  [[32, 36]]),

  ...blocksFor('arp', 'beat',    [[0, 8]]),
  ...blocksFor('arp', 'ci',      [[8, 32], [40, 48]]),
  ...blocksFor('arp', 'beat',    [[32, 36]]),
  ...blocksFor('arp', 'release', [[36, 40]]),
];

// Flat working-grid snapshot — must match each vault's activePatternId (first pattern
// per module) so a loaded session doesn't corrupt vault data on the first pattern switch.
const ZCODE_GRIDS: Record<ModuleType, Grid> = {
  drum: DRUM_COLD_BOOT,
  bass: BASS_PING,
  pad: PAD_UPTIME,
  synth: SYNTH_STAB,
  arp: ARP_HEARTBEAT,
};

const ZCODE_MODULE_SETTINGS: Record<ModuleType, ModuleSettings> = {
  drum:  { volume: 0.82, cutoff: 0.9,  decay: 0.1,  attack: 0.01, res: 0.05, pan: 0.5 },
  bass:  { volume: 0.75, cutoff: 0.32, decay: 0.4,  attack: 0.02, res: 0.25, pan: 0.5 },
  pad:   { volume: 0.42, cutoff: 0.5,  decay: 0.95, attack: 0.55, res: 0.05, pan: 0.42 },
  synth: { volume: 0.6,  cutoff: 0.72, decay: 0.28, attack: 0.04, res: 0.18, pan: 0.58 },
  arp:   { volume: 0.4,  cutoff: 0.88, decay: 0.14, attack: 0.01, res: 0.3,  pan: 0.68 },
};

export const ZCODE_TRACK = {
  grids: ZCODE_GRIDS,
  vaults: ZCODE_VAULTS,
  timeline: ZCODE_TIMELINE,
  bpm: BPM,
  moduleSettings: ZCODE_MODULE_SETTINGS,
};
