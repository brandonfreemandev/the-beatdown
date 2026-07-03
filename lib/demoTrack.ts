import type { ModuleType } from './audioEngine';
import type { Grid, ModuleVault, ModuleSettings, TimelineBlock } from './store';
import { GRID_ROWS, GRID_STEPS } from './store';

// ── Bundled demo track ("Block Party") ────────────────────────────────────────
// Loaded via ProfileButton → "♫ LOAD DEMO TRACK". Structured like a human
// session: several named 16-step patterns per module vault, assembled on the
// timeline as standard-length blocks (durationBeats: 8 → 4.0s at 120 BPM).

const BPM = 120;
const BLOCK_SEC = (8 / BPM) * 60; // 4.0s — the standard block the UI produces

function grid(rows: Record<number, number[]>): Grid {
  return Array.from({ length: GRID_ROWS }, (_, r) => {
    const active = new Set(rows[r] ?? []);
    return Array.from({ length: GRID_STEPS }, (_, c) => active.has(c));
  });
}

// ── Patterns ──────────────────────────────────────────────────────────────────
// Drum rows: KICK, KICK 2, SNARE, SNARE 2, GHOST, HI-HAT, HI-HAT 2, OPEN HAT

const DRUM_VERSE = grid({
  0: [0, 6, 8],
  2: [4, 12],
  5: [0, 2, 4, 6, 8, 10, 12, 14],
});

const DRUM_CHORUS = grid({
  0: [0, 6, 8, 10],
  2: [4, 12],
  3: [15],
  4: [3, 11],
  5: [0, 2, 4, 6, 8, 10, 12, 14],
  7: [6, 14],
});

const DRUM_FILL = grid({
  0: [0, 8],
  2: [4, 10, 12, 14, 15],
  3: [11, 13],
  5: [0, 2, 4, 6],
  7: [15],
});

const BASS_ROOT = grid({
  0: [0, 3, 8, 11],
  3: [6, 14],
});

const BASS_WALK = grid({
  0: [0, 3, 6],
  1: [8, 11],
  2: [14],
});

const PAD_AM = grid({
  0: [0, 8],
  2: [0, 8],
  6: [0, 8],
});

const PAD_D = grid({
  1: [0, 8],
  3: [0, 8],
  7: [0, 8],
});

const SYNTH_HOOK = grid({
  7: [0],
  4: [2, 10],
  3: [4, 8],
  2: [6, 12],
  0: [14],
});

const SYNTH_ANSWER = grid({
  2: [0, 8],
  3: [3],
  4: [6],
  0: [11],
});

const ARP_CLIMB = grid({
  0: [0, 8],
  2: [2, 10],
  4: [4, 12],
  7: [6, 14],
});

const ARP_CASCADE = grid({
  7: [0, 8],
  4: [2, 10],
  2: [4, 12],
  0: [6, 14],
});

// ── Vaults ────────────────────────────────────────────────────────────────────

interface PatternSpec { key: string; name: string; grid: Grid }

const PATTERNS: Record<ModuleType, PatternSpec[]> = {
  drum: [
    { key: 'verse',  name: 'VERSE BEAT',  grid: DRUM_VERSE },
    { key: 'chorus', name: 'CHORUS BEAT', grid: DRUM_CHORUS },
    { key: 'fill',   name: 'SNARE FILL',  grid: DRUM_FILL },
  ],
  bass: [
    { key: 'root', name: 'ROOT PULSE', grid: BASS_ROOT },
    { key: 'walk', name: 'A TO D WALK', grid: BASS_WALK },
  ],
  pad: [
    { key: 'am', name: 'AM STACK', grid: PAD_AM },
    { key: 'd',  name: 'D STACK',  grid: PAD_D },
  ],
  synth: [
    { key: 'hook',   name: 'HOOK',   grid: SYNTH_HOOK },
    { key: 'answer', name: 'ANSWER', grid: SYNTH_ANSWER },
  ],
  arp: [
    { key: 'climb',   name: 'CLIMB',   grid: ARP_CLIMB },
    { key: 'cascade', name: 'CASCADE', grid: ARP_CASCADE },
  ],
};

const pid = (module: ModuleType, key: string) => `${module}-demo-${key}`;

const DEMO_VAULTS = {} as Record<ModuleType, ModuleVault>;
for (const m of Object.keys(PATTERNS) as ModuleType[]) {
  DEMO_VAULTS[m] = {
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
        id: `demo-${module}-${key}-${sec}`,
        moduleType: module,
        patternId: pid(module, key),
        startSec: sec,
        durationSec: BLOCK_SEC,
      });
    }
  }
  return out;
}

// 48s form: INTRO 0–8 · VERSE 8–16 · BUILD 16–24 · CHORUS 24–32 · VERSE 2 32–40 · FINAL CHORUS 40–48
const DEMO_TIMELINE: TimelineBlock[] = [
  ...blocksFor('drum', 'verse',  [[8, 20], [32, 36]]),
  ...blocksFor('drum', 'fill',   [[20, 24], [36, 40]]),
  ...blocksFor('drum', 'chorus', [[24, 32], [40, 48]]),

  ...blocksFor('bass', 'root', [[8, 24], [32, 40]]),
  ...blocksFor('bass', 'walk', [[24, 32], [40, 48]]),

  ...blocksFor('pad', 'am', [[4, 16], [32, 40]]),
  ...blocksFor('pad', 'd',  [[16, 32], [40, 48]]),

  ...blocksFor('synth', 'hook',   [[24, 32], [40, 48]]),
  ...blocksFor('synth', 'answer', [[32, 40]]),

  ...blocksFor('arp', 'climb',   [[0, 8], [16, 32]]),
  ...blocksFor('arp', 'cascade', [[40, 48]]),
];

// Flat working-grid snapshot — must match each vault's activePatternId (first pattern
// per module) so a loaded session doesn't corrupt vault data on the first pattern switch.
const DEMO_GRIDS: Record<ModuleType, Grid> = {
  drum: DRUM_VERSE,
  bass: BASS_ROOT,
  pad: PAD_AM,
  synth: SYNTH_HOOK,
  arp: ARP_CLIMB,
};

const DEMO_MODULE_SETTINGS: Record<ModuleType, ModuleSettings> = {
  drum:  { volume: 0.8,  cutoff: 0.95, decay: 0.12, attack: 0.01, res: 0.05, pan: 0.5 },
  bass:  { volume: 0.78, cutoff: 0.3,  decay: 0.45, attack: 0.03, res: 0.2,  pan: 0.5 },
  pad:   { volume: 0.5,  cutoff: 0.45, decay: 0.9,  attack: 0.5,  res: 0.05, pan: 0.45 },
  synth: { volume: 0.62, cutoff: 0.75, decay: 0.3,  attack: 0.05, res: 0.15, pan: 0.58 },
  arp:   { volume: 0.42, cutoff: 0.9,  decay: 0.15, attack: 0.01, res: 0.3,  pan: 0.68 },
};

export const DEMO_TRACK = {
  grids: DEMO_GRIDS,
  vaults: DEMO_VAULTS,
  timeline: DEMO_TIMELINE,
  bpm: BPM,
  moduleSettings: DEMO_MODULE_SETTINGS,
};
