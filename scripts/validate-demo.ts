import { DEMO_TRACK } from '../lib/demoTrack';
import { SONNET_TRACK } from '../lib/sonnetTrack';
import { MODULES, GRID_ROWS, GRID_STEPS } from '../lib/store';

type Track = typeof DEMO_TRACK;

function validate(name: string, track: Track): string[] {
  const errors: string[] = [];

  for (const m of MODULES) {
    const g = track.grids[m];
    if (g.length !== GRID_ROWS) errors.push(`${m} grid has ${g.length} rows, expected ${GRID_ROWS}`);
    g.forEach((row, i) => {
      if (row.length !== GRID_STEPS) errors.push(`${m} grid row ${i} has ${row.length} steps, expected ${GRID_STEPS}`);
    });

    const vault = track.vaults[m];
    if (vault.patterns.length < 1) errors.push(`${m} vault has no patterns`);
    if (vault.patterns.length > 5) errors.push(`${m} vault has ${vault.patterns.length} patterns, max is 5`);
    if (!vault.patterns.some((p) => p.id === vault.activePatternId)) {
      errors.push(`${m} activePatternId ${vault.activePatternId} not found in its own patterns`);
    }
    for (const p of vault.patterns) {
      if (p.grid.length !== GRID_ROWS) errors.push(`${m} pattern ${p.id} grid has wrong row count`);
    }
  }

  for (const block of track.timeline) {
    const vault = track.vaults[block.moduleType];
    if (!vault.patterns.some((p) => p.id === block.patternId)) {
      errors.push(`Timeline block ${block.id} references missing pattern ${block.patternId}`);
    }
    if (block.startSec < 0 || block.startSec + block.durationSec > 60) {
      errors.push(`Timeline block ${block.id} out of 0-60s bounds: ${block.startSec}-${block.startSec + block.durationSec}`);
    }
  }

  for (const m of MODULES) {
    const blocks = track.timeline.filter((b) => b.moduleType === m).sort((a, b) => a.startSec - b.startSec);
    for (let i = 1; i < blocks.length; i++) {
      const prev = blocks[i - 1];
      const cur = blocks[i];
      if (cur.startSec < prev.startSec + prev.durationSec) {
        errors.push(`${m} blocks overlap: ${prev.id} and ${cur.id}`);
      }
    }
  }

  for (const m of MODULES) {
    const hasAny = track.grids[m].some((row) => row.some(Boolean));
    if (!hasAny) errors.push(`${m}'s grid is entirely empty`);
  }

  for (const m of MODULES) {
    const s = track.moduleSettings[m];
    for (const [k, v] of Object.entries(s)) {
      if (typeof v !== 'number' || v < 0 || v > 1) errors.push(`${m}.${k} = ${v} is out of [0,1] range`);
    }
  }

  return errors.map((e) => `[${name}] ${e}`);
}

const allErrors = [
  ...validate('DEMO_TRACK', DEMO_TRACK),
  ...validate('SONNET_TRACK', SONNET_TRACK),
];

if (allErrors.length) {
  console.error('TRACK VALIDATION FAILED:\n' + allErrors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
} else {
  for (const [name, track] of [['DEMO_TRACK', DEMO_TRACK], ['SONNET_TRACK', SONNET_TRACK]] as const) {
    console.log(`${name} validation passed:`, {
      modules: MODULES.length,
      timelineBlocks: track.timeline.length,
      bpm: track.bpm,
      endSec: Math.max(...track.timeline.map((b) => b.startSec + b.durationSec)),
    });
  }
}
