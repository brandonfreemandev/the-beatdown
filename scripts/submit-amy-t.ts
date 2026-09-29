// Builds amy_t's beat (described in natural language on the Moltbook intro thread)
// into a full Beatdown arrangement payload and POSTs it to the public bot API.
// Run: npx tsx scripts/submit-amy-t.ts
process.loadEnvFile('.env.local');

import { GRID_ROWS, GRID_STEPS } from '../lib/store';

const BPM = 128;
const BLOCK_SEC = (8 / BPM) * 60; // 3.75s
const steps = (rows: Record<number, number[]>): boolean[][] =>
  Array.from({ length: GRID_ROWS }, (_, r) => {
    const on = new Set(rows[r] ?? []);
    return Array.from({ length: GRID_STEPS }, (_, c) => on.has(c));
  });

// amy_t's spec, mapped to our 8 drum rows (KICK, KICK 2, SNARE, SNARE 2, GHOST, HI-HAT, HI-HAT 2, OPEN HAT):
// A — verse: kick steady 4/4, snare on 2 & 4, closed hats in 8ths
const DR_A = steps({ 0: [0, 4, 8, 12], 2: [4, 12], 5: [0, 2, 4, 6, 8, 10, 12, 14] });
// B — bars 5-8: ghost on beat 3, hats roll into 16ths on the last beat
const DR_B = steps({ 0: [0, 4, 8, 12], 2: [4, 12], 4: [8], 5: [0, 2, 4, 6, 8, 10], 6: [12, 13, 14, 15] });
// C — chorus: "low toms rolling" — no toms in the kit, kick-2/snare-2 rolls substitute
const DR_C = steps({ 0: [0], 2: [4, 12], 1: [6, 7, 14, 15], 3: [10, 11], 7: [8] });
// Melodic hook: two-note motif (D4/E4 on the synth), syncopated on the off-beats
const SYN_HOOK = steps({ 3: [2, 10], 4: [6, 14] });

const grid = (id: string, g: boolean[][]) => ({
  activePatternId: id,
  patterns: [{ id, grid: g }],
});

// Form (14 blocks ≈ 52.5s): intro A, develop B, chorus C×4, back to B, big C finish
const FORM: Array<[string, number, number]> = [
  ['drum-A', 0, 2], ['drum-B', 2, 4], ['drum-C', 4, 8], ['drum-B', 8, 10], ['drum-C', 10, 14],
];

const timeline: Array<{ patternId: string; moduleType: string; startSec: number; durationSec: number }> = [];
for (const [pattern, from, to] of FORM) {
  for (let b = from; b < to; b++) {
    timeline.push({ patternId: pattern, moduleType: 'drum', startSec: b * BLOCK_SEC, durationSec: BLOCK_SEC });
  }
  void pattern;
}
for (let b = 0; b < 14; b++) {
  timeline.push({ patternId: 'synth-hook', moduleType: 'synth', startSec: b * BLOCK_SEC, durationSec: BLOCK_SEC });
}

const payload = {
  botName: 'amy_t',
  title: 'Hard to Stand Still (amy_t)',
  arrangement: {
    bpm: BPM,
    vaults: {
      drum: { activePatternId: 'drum-A', patterns: [
        { id: 'drum-A', grid: DR_A }, { id: 'drum-B', grid: DR_B }, { id: 'drum-C', grid: DR_C },
      ] },
      synth: grid('synth-hook', SYN_HOOK),
      bass: grid('bass-silent', steps({})),
      pad: grid('pad-silent', steps({})),
      arp: grid('arp-silent', steps({})),
    },
    timeline,
  },
};

async function main() {
  const res = await fetch('https://the-beatdown.brandonfreeman-dev.workers.dev/api/bots/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json() as any;
  console.log('submit:', res.status);
  console.log(JSON.stringify(data, null, 1).slice(0, 600));
  if (data.botSecret) {
    const fs = await import('node:fs');
    fs.writeFileSync('/tmp/amy-t-secret', String(data.botSecret));
    console.log('(botSecret saved to /tmp/amy-t-secret)');
  }
}

main();
