import { DEMO_TRACK } from '../lib/demoTrack';
import { MODULES, GRID_ROWS, GRID_STEPS } from '../lib/store';

let errors: string[] = [];

for (const m of MODULES) {
  const g = DEMO_TRACK.grids[m];
  if (g.length !== GRID_ROWS) errors.push(`${m} grid has ${g.length} rows, expected ${GRID_ROWS}`);
  g.forEach((row, i) => {
    if (row.length !== GRID_STEPS) errors.push(`${m} grid row ${i} has ${row.length} steps, expected ${GRID_STEPS}`);
  });

  const vault = DEMO_TRACK.vaults[m];
  if (vault.patterns.length < 1) errors.push(`${m} vault has no patterns`);
  if (!vault.patterns.some((p) => p.id === vault.activePatternId)) {
    errors.push(`${m} activePatternId ${vault.activePatternId} not found in its own patterns`);
  }
  for (const p of vault.patterns) {
    if (p.grid.length !== GRID_ROWS) errors.push(`${m} pattern ${p.id} grid has wrong row count`);
  }
}

// Every timeline block must reference a real pattern in the matching module's vault
for (const block of DEMO_TRACK.timeline) {
  const vault = DEMO_TRACK.vaults[block.moduleType];
  if (!vault.patterns.some((p) => p.id === block.patternId)) {
    errors.push(`Timeline block ${block.id} references missing pattern ${block.patternId}`);
  }
  if (block.startSec < 0 || block.startSec + block.durationSec > 60) {
    errors.push(`Timeline block ${block.id} out of 0-60s bounds: ${block.startSec}-${block.startSec + block.durationSec}`);
  }
}

// No two blocks of the same module may overlap in time
for (const m of MODULES) {
  const blocks = DEMO_TRACK.timeline.filter((b) => b.moduleType === m).sort((a, b) => a.startSec - b.startSec);
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1];
    const cur = blocks[i];
    if (cur.startSec < prev.startSec + prev.durationSec) {
      errors.push(`${m} blocks overlap: ${prev.id} and ${cur.id}`);
    }
  }
}

// Every module the grid actually uses should have a "notes"-free but structurally sane pattern; also
// confirm the grid actually has SOMETHING active (a truly empty "demo" module would be a content bug)
for (const m of MODULES) {
  const hasAny = DEMO_TRACK.grids[m].some((row) => row.some(Boolean));
  if (!hasAny) errors.push(`${m}'s demo grid is entirely empty`);
}

// moduleSettings sanity: all values in [0,1]
for (const m of MODULES) {
  const s = DEMO_TRACK.moduleSettings[m];
  for (const [k, v] of Object.entries(s)) {
    if (typeof v !== 'number' || v < 0 || v > 1) errors.push(`${m}.${k} = ${v} is out of [0,1] range`);
  }
}

if (errors.length) {
  console.error('DEMO TRACK VALIDATION FAILED:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
} else {
  console.log('Demo track validation passed:', {
    modules: MODULES.length,
    timelineBlocks: DEMO_TRACK.timeline.length,
    bpm: DEMO_TRACK.bpm,
    endSec: Math.max(...DEMO_TRACK.timeline.map((b) => b.startSec + b.durationSec)),
  });
}
