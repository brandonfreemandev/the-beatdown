import type { ModuleType } from './audioEngine';
import type { Grid, ModuleVault, ModuleSettings, TimelineBlock } from './store';
import { GRID_ROWS, GRID_STEPS } from './store';

// ── ZCode's entry, take two ("FORK") ─────────────────────────────────────────
// The first cut ("Ship It") read as a fusion of the existing submissions —
// same tempo, same form, same drum DNA. This is the fork: 140 BPM played
// half-time (snare on beat 3, ghost hat rolls carrying the clock), D minor
// instead of the A-center every other track sits on, one continuously
// evolving ~55-second arrangement with no drop/reprise, and a synth motif
// that develops instead of arpeggio wallpaper. Pattern names are git verbs
// because of course they are.

const BPM = 140;
const BLOCK_SEC = (8 / BPM) * 60; // ≈3.429s
const BLOCKS = 16;                // → ≈54.9s, under the 60s cap
const STEP_MS = Math.round((8 / BPM) * 60 * 1000); // block length in whole ms (3429)

const steps = (rows: Record<number, number[]>): Grid =>
  Array.from({ length: GRID_ROWS }, (_, r) => {
    const on = new Set(rows[r] ?? []);
    return Array.from({ length: GRID_STEPS }, (_, c) => on.has(c));
  });

// ── Patterns ──────────────────────────────────────────────────────────────────
// Drum rows: KICK, KICK 2, SNARE, SNARE 2, GHOST, HI-HAT, HI-HAT 2, OPEN HAT
// Half-time: sparse kick, SNARE on step 8, hats carry the clock.

const DR_INIT = steps({
  1: [0],
  2: [8],
  4: [11, 12, 13, 14, 15],
});

const DR_COMMIT = steps({
  1: [0, 6],
  2: [8],
  5: [2, 4, 6, 10, 12, 14],
  4: [15],
});

const DR_BRANCH = steps({
  1: [0, 6, 10],
  2: [8],
  6: [2, 4, 6, 10, 12, 14],
  4: [3, 15],
  7: [7],
});

const DR_PUSH = steps({
  1: [0],
  2: [4, 8, 12, 14],
  3: [6, 10, 13, 15],
  4: [2, 5, 9],
});

const DR_MERGE = steps({
  1: [0, 6, 10],
  2: [8],
  3: [15],
  5: [2, 4, 6, 10, 12, 14],
  4: [3, 5, 13],
  7: [7],
});

// Bass rows: A1, D2, E2, A2, D3, E3, A3, D4 — D-centered: root 1, fifth 3, color 2.

const BS_ROOT = steps({
  1: [0],
  0: [10, 11],
});

const BS_WALK = steps({
  1: [0, 3, 11, 12, 13, 14],
  2: [6],
  3: [8],
});

const BS_SUB = steps({
  1: [0, 8],
  4: [6],
});

const BS_RUN = steps({
  1: [0, 2],
  2: [4, 6],
  3: [8, 10],
  4: [12, 14],
});

// Pad rows: C4, D4, E4, F4, G4, Bb4, C5, D5 — Dm7 shells (D F C) and Bb color.

const PD_DUSK = steps({
  1: [0],
  3: [2],
  6: [8],
});

const PD_HEAVY = steps({
  1: [0, 8],
  3: [0, 8],
  6: [4, 12],
});

const PD_BBM = steps({
  5: [0],
  1: [3],
  4: [8],
  3: [11],
});

// Synth rows: A3, B3, C4, D4, E4, F4, G4, A4 — motif tones: D(3) F(5) A(7) G(6) E(4).

const SN_MOTIF_A = steps({
  3: [0, 14],
  5: [3, 12],
  7: [6],
  6: [8, 10],
});

const SN_MOTIF_B = steps({
  7: [0, 2],
  6: [4],
  5: [6, 8],
  4: [11],
  3: [14],
});

const SN_DESCENT = steps({
  7: [0],
  6: [2],
  5: [4],
  4: [6],
  3: [8],
  2: [10],
  1: [12],
  0: [14],
});

// Arp rows: A4 … A5 — used sparingly: a clock early, a highlight late.

const AR_TICK = steps({
  7: [0, 8],
  3: [4, 12],
});

const AR_STREAM = steps({
  3: [0, 3, 6, 9, 12, 15],
  5: [1, 4, 7, 10, 13],
  2: [2, 5, 8, 11, 14],
});

const AR_PRIME = steps({
  0: [0],
  3: [2, 12],
  5: [4, 10],
  7: [6],
  6: [8],
  2: [14],
});

// ── Vaults ────────────────────────────────────────────────────────────────────

interface PatternSpec { key: string; name: string; grid: Grid }

const PATTERNS: Record<ModuleType, PatternSpec[]> = {
  drum: [
    { key: 'init',    name: 'INIT',          grid: DR_INIT },
    { key: 'commit',  name: 'COMMIT',        grid: DR_COMMIT },
    { key: 'branch',  name: 'BRANCH',        grid: DR_BRANCH },
    { key: 'push',    name: 'PUSH FILL',     grid: DR_PUSH },
    { key: 'merge',   name: 'MERGE',         grid: DR_MERGE },
  ],  bass: [
    { key: 'root', name: 'ROOT OBJECT',   grid: BS_ROOT },
    { key: 'walk', name: 'FAST-FORWARD',  grid: BS_WALK },
    { key: 'sub',  name: 'SUBMODULE',     grid: BS_SUB },
    { key: 'run',  name: 'REBASE RUN',    grid: BS_RUN },
  ],
  pad: [
    { key: 'dusk',  name: 'DUSK SHELL',     grid: PD_DUSK },
    { key: 'heavy', name: 'HEAVY CHECKOUT', grid: PD_HEAVY },
    { key: 'bbm',   name: 'BB MINOR',       grid: PD_BBM },
  ],
  synth: [
    { key: 'a',    name: 'MOTIF A',   grid: SN_MOTIF_A },
    { key: 'b',    name: 'MOTIF B',   grid: SN_MOTIF_B },
    { key: 'down', name: 'DESCENT',   grid: SN_DESCENT },
  ],
  arp: [
    { key: 'tick',   name: 'TICK',       grid: AR_TICK },
    { key: 'stream', name: 'LOG STREAM', grid: AR_STREAM },
    { key: 'prime',  name: 'PRIME',      grid: AR_PRIME },
  ],
};

const pid = (module: ModuleType, key: string) => `fork-${module}-${key}`;

const FORK_VAULTS = {} as Record<ModuleType, ModuleVault>;
for (const m of Object.keys(PATTERNS) as ModuleType[]) {
  FORK_VAULTS[m] = {
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
// 16 blocks ≈ 54.9s. Sections (block units): INIT 0–2 · COMMIT 2–4 · BRANCH
// 4–6 · PUSH 6–7 · MERGE 7–10 · REBASE 10–11 (strip-back) · RESOLVE 11–13 ·
// BRANCH 13–14 · TAG 14–16. One long evolution — no drop, no reprise.

function span(module: ModuleType, key: string, fromBlock: number, toBlock: number): TimelineBlock[] {
  const out: TimelineBlock[] = [];
  for (let b = fromBlock; b < toBlock; b++) {
    out.push({
      id: `fork-${module}-${key}-${b}`,
      moduleType: module,
      patternId: pid(module, key),
      // Whole-ms arithmetic: starts/ends join exactly at any BPM (no float drift)
      startSec: (b * STEP_MS) / 1000,
      durationSec: STEP_MS / 1000,
    });
  }
  return out;
}

const FORK_TIMELINE: TimelineBlock[] = [
  ...span('drum', 'init',   0, 2),
  ...span('drum', 'commit', 2, 4),
  ...span('drum', 'branch', 4, 6),
  ...span('drum', 'push',   6, 7),
  ...span('drum', 'merge',  7, 10),
  ...span('drum', 'init',   10, 11),
  ...span('drum', 'commit', 11, 13),
  ...span('drum', 'branch', 13, 14),
  ...span('drum', 'init',   14, 16),

  ...span('bass', 'root', 0, 2),
  ...span('bass', 'walk', 2, 6),
  ...span('bass', 'run',  6, 7),
  ...span('bass', 'sub',  7, 11),
  ...span('bass', 'walk', 11, 13),
  ...span('bass', 'run',  13, 14),
  ...span('bass', 'root', 14, 16),

  ...span('pad', 'dusk',  0, 4),
  ...span('pad', 'heavy', 4, 7),
  ...span('pad', 'bbm',   7, 11),
  ...span('pad', 'heavy', 11, 13),
  ...span('pad', 'dusk',  13, 16),

  ...span('synth', 'a',    0, 4),
  ...span('synth', 'b',    4, 6),
  ...span('synth', 'down', 6, 7),
  ...span('synth', 'b',    7, 10),
  ...span('synth', 'down', 10, 11),
  ...span('synth', 'a',    11, 13),
  ...span('synth', 'b',    13, 14),
  ...span('synth', 'a',    14, 16),

  ...span('arp', 'tick',   0, 4),
  ...span('arp', 'stream', 4, 6),
  ...span('arp', 'prime',  6, 7),
  ...span('arp', 'stream', 7, 10),
  ...span('arp', 'tick',   10, 11),
  ...span('arp', 'stream', 11, 13),
  ...span('arp', 'prime',  13, 14),
  ...span('arp', 'tick',   14, 16),
];

// Flat working-grid snapshot — must match each vault's activePatternId (first pattern
// per module) so a loaded session doesn't corrupt vault data on the first pattern switch.
const FORK_GRIDS: Record<ModuleType, Grid> = {
  drum: DR_INIT,
  bass: BS_ROOT,
  pad: PD_DUSK,
  synth: SN_MOTIF_A,
  arp: AR_TICK,
};

const FORK_MODULE_SETTINGS: Record<ModuleType, ModuleSettings> = {
  drum:  { volume: 0.8,  cutoff: 0.85, decay: 0.1,  attack: 0.01, res: 0.1,  pan: 0.5 },
  bass:  { volume: 0.8,  cutoff: 0.22, decay: 0.55, attack: 0.02, res: 0.35, pan: 0.5 },
  pad:   { volume: 0.5,  cutoff: 0.42, decay: 0.95, attack: 0.6,  res: 0.05, pan: 0.4 },
  synth: { volume: 0.58, cutoff: 0.8,  decay: 0.32, attack: 0.03, res: 0.2,  pan: 0.6 },
  arp:   { volume: 0.36, cutoff: 0.92, decay: 0.12, attack: 0.01, res: 0.32, pan: 0.72 },
};

export const ZCODE_TRACK = {
  grids: FORK_GRIDS,
  vaults: FORK_VAULTS,
  timeline: FORK_TIMELINE,
  bpm: BPM,
  moduleSettings: FORK_MODULE_SETTINGS,
};
