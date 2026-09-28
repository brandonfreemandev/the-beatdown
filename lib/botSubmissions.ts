// Shared machinery for the public bot-submission API (GET /api/bots/spec, POST /api/bots/submit).
// Bots send a minimal payload ({bpm, grids} — exactly what a browser Studio session holds) and
// this module normalizes it into the full ArrangementData shape used by playback: synthesizing
// vault patterns + a full-length timeline when the bot didn't author its own arrangement.
// Grid constants are mirrored from lib/store.ts rather than imported — store pulls in zustand,
// which server routes don't need.
export const GRID_ROWS = 8;
export const GRID_STEPS = 16;
export const MODULE_TYPES = ['drum', 'bass', 'pad', 'synth', 'arp'] as const;

export type BotModuleType = (typeof MODULE_TYPES)[number];

// Arrangement cap matches MAX_ARRANGEMENT_SEC in store.ts (+0.5s tolerance for float drift)
const ARRANGEMENT_CAP_SEC = 60.5;
const OVERLAP_EPSILON_SEC = 0.001; // same 1ms tolerance scripts/validate-demo.ts uses

// Studio defaults from store.ts defaultModuleSettings()
const DEFAULT_MODULE_SETTINGS: Record<BotModuleType, BotModuleSettings> = {
  drum:  { volume: 0.7, cutoff: 0.8, decay: 0.3, attack: 0.05, res: 0.05, pan: 0.5 },
  bass:  { volume: 0.7, cutoff: 0.8, decay: 0.3, attack: 0.05, res: 0.05, pan: 0.5 },
  pad:   { volume: 0.7, cutoff: 0.8, decay: 0.3, attack: 0.05, res: 0.05, pan: 0.5 },
  synth: { volume: 0.7, cutoff: 0.8, decay: 0.3, attack: 0.05, res: 0.05, pan: 0.5 },
  arp:   { volume: 0.7, cutoff: 0.8, decay: 0.3, attack: 0.05, res: 0.05, pan: 0.5 },
};

export type BotModuleSettings = {
  volume: number; cutoff: number; decay: number; attack: number; res: number; pan: number;
};

export type BotTimelineBlock = {
  id: string; patternId: string; moduleType: BotModuleType; startSec: number; durationSec: number;
};

export type BotPattern = {
  id: string; moduleType: BotModuleType; grid: boolean[][];
  data: { patternName: string; durationBeats: number; notes: never[]; activeModules: Record<string, boolean> };
};

export type BotArrangement = {
  bpm: number;
  grids: Record<BotModuleType, boolean[][]>;
  vaults: Record<BotModuleType, { patterns: BotPattern[]; activePatternId: string; vaultOpen: boolean }>;
  timeline: BotTimelineBlock[];
  moduleSettings: Record<BotModuleType, BotModuleSettings>;
};

export class ValidationError extends Error {}

// A function DECLARATION with an explicit never return — required so TS narrows `unknown`
// values after guards like `if (!Array.isArray(raw)) fail(...)`.
function fail(msg: string): never {
  throw new ValidationError(msg);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (v === 0 || v === 1) return v === 1;
  return fail(`Grid cells must be booleans (or 0/1), got: ${JSON.stringify(v) ?? 'undefined'}`);
};

const clamp01 = (v: unknown, field: string, module: string): number => {
  const n = typeof v === 'number' ? v : NaN;
  if (Number.isNaN(n)) fail(`moduleSettings.${module}.${field} must be a number`);
  return Math.min(1, Math.max(0, n));
};

/** Strip control chars, collapse whitespace, trim. */
export function cleanText(raw: unknown, field: string, max: number): string {
  if (typeof raw !== 'string') fail(`${field} is required`);
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  if (!cleaned) fail(`${field} is required`);
  return cleaned;
}

/** Lowercase [a-z0-9-] slug for the bot's identity email. */
export function slugifyBotName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  return slug || 'bot';
}

/** Parse/validate one grid: exactly 8 rows × 16 boolean cells. */
function parseGrid(raw: unknown, label: string): boolean[][] {
  if (!Array.isArray(raw)) fail(`${label} must be an array of ${GRID_ROWS} rows (one per note)`);
  if (raw.length !== GRID_ROWS) fail(`${label} must have exactly ${GRID_ROWS} rows, got ${raw.length}`);
  return raw.map((row, r) => {
    if (!Array.isArray(row)) fail(`${label} row ${r} must be an array of ${GRID_STEPS} steps (16th notes)`);
    if (row.length !== GRID_STEPS) fail(`${label} row ${r} must have exactly ${GRID_STEPS} steps, got ${row.length}`);
    return row.map(toBool);
  });
}

function parseModuleSettings(raw: unknown): Record<BotModuleType, BotModuleSettings> {
  const rawSettings = isPlainObject(raw) ? raw : undefined;
  const out = {} as Record<BotModuleType, BotModuleSettings>;
  for (const m of MODULE_TYPES) {
    const base = DEFAULT_MODULE_SETTINGS[m];
    const mod = isPlainObject(rawSettings?.[m]) ? rawSettings[m] : undefined;
    out[m] = {
      volume: mod?.volume === undefined ? base.volume : clamp01(mod.volume, 'volume', m),
      cutoff: mod?.cutoff === undefined ? base.cutoff : clamp01(mod.cutoff, 'cutoff', m),
      decay: mod?.decay === undefined ? base.decay : clamp01(mod.decay, 'decay', m),
      attack: mod?.attack === undefined ? base.attack : clamp01(mod.attack, 'attack', m),
      res: mod?.res === undefined ? base.res : clamp01(mod.res, 'res', m),
      pan: mod?.pan === undefined ? base.pan : clamp01(mod.pan, 'pan', m),
    };
  }
  return out;
}

function parseVaults(
  raw: unknown,
  fallbackGrids: Record<BotModuleType, boolean[][]> | null,
): Record<BotModuleType, { patterns: BotPattern[]; activePatternId: string; vaultOpen: boolean }> {
  if (!isPlainObject(raw)) fail('vaults must be an object keyed by module');
  const out = {} as Record<BotModuleType, { patterns: BotPattern[]; activePatternId: string; vaultOpen: boolean }>;
  for (const m of MODULE_TYPES) {
    const vault = raw[m];
    if (!isPlainObject(vault) || !Array.isArray(vault.patterns) || vault.patterns.length < 1) {
      fail(`vaults.${m}.patterns must be a non-empty array (or omit vaults and send grids only)`);
    }
    if (vault.patterns.length > 5) fail(`vaults.${m} may hold at most 5 patterns`);
    const patterns: BotPattern[] = vault.patterns.map((p, i) => {
      if (!isPlainObject(p)) fail(`vaults.${m}.patterns[${i}] must be an object`);
      const id = typeof p.id === 'string' && p.id.trim() ? p.id.trim().slice(0, 60) : `${m}-pattern-${i + 1}`;
      const grid = parseGrid(p.grid ?? fallbackGrids?.[m], `${m}.patterns[${i}]`);
      const name = isPlainObject(p.data) && typeof p.data.patternName === 'string' && p.data.patternName.trim()
        ? p.data.patternName.trim().slice(0, 40)
        : `PATTERN ${i + 1}`;
      return {
        id, moduleType: m, grid,
        data: { patternName: name, durationBeats: 8, notes: [], activeModules: { [m]: true } },
      };
    });
    const ids = new Set(patterns.map((p) => p.id));
    if (ids.size !== patterns.length) fail(`vaults.${m} has duplicate pattern ids`);
    const active = typeof vault.activePatternId === 'string' && ids.has(vault.activePatternId)
      ? vault.activePatternId
      : patterns[0].id;
    out[m] = { patterns, activePatternId: active, vaultOpen: false };
  }
  return out;
}

function parseTimeline(
  raw: unknown,
  vaults: ReturnType<typeof parseVaults>,
): BotTimelineBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) fail('timeline must be a non-empty array of blocks');
  const blocks: BotTimelineBlock[] = raw.map((b, i) => {
    if (!isPlainObject(b)) fail(`timeline[${i}] must be an object`);
    const moduleType = b.moduleType as BotModuleType;
    if (!MODULE_TYPES.includes(moduleType)) fail(`timeline[${i}].moduleType must be one of ${MODULE_TYPES.join(', ')}`);
    const patternId = typeof b.patternId === 'string' ? b.patternId : fail(`timeline[${i}].patternId is required`);
    if (!vaults[moduleType].patterns.some((p) => p.id === patternId)) {
      fail(`timeline[${i}] references patternId "${patternId}" which is not in vaults.${moduleType}`);
    }
    const startSec = typeof b.startSec === 'number' && Number.isFinite(b.startSec) && b.startSec >= 0
      ? b.startSec : fail(`timeline[${i}].startSec must be a number ≥ 0`);
    const durationSec = typeof b.durationSec === 'number' && Number.isFinite(b.durationSec) && b.durationSec > 0
      ? b.durationSec : fail(`timeline[${i}].durationSec must be a number > 0`);
    const id = typeof b.id === 'string' && b.id.trim() ? b.id.trim().slice(0, 80) : `ext-${moduleType}-${patternId}-${i}`;
    return { id, patternId, moduleType, startSec, durationSec };
  });

  // Same-module blocks may not overlap (the Studio enforces this too)
  for (const m of MODULE_TYPES) {
    const spans = blocks.filter((b) => b.moduleType === m).sort((a, b) => a.startSec - b.startSec);
    for (let i = 1; i < spans.length; i++) {
      if (spans[i].startSec < spans[i - 1].startSec + spans[i - 1].durationSec - OVERLAP_EPSILON_SEC) {
        fail(`timeline has overlapping ${m} blocks near ${spans[i].startSec.toFixed(3)}s`);
      }
    }
  }

  const end = Math.max(...blocks.map((b) => b.startSec + b.durationSec));
  if (end > ARRANGEMENT_CAP_SEC) {
    fail(`arrangement is ${end.toFixed(1)}s long — the cap is 60s`);
  }
  return blocks;
}

/** Validate + normalize a bot's arrangement into the full playback shape. */
export function normalizeArrangement(raw: unknown): BotArrangement {
  if (!isPlainObject(raw)) fail('arrangement must be an object');

  const bpmRaw = raw.bpm === undefined ? 120 : raw.bpm;
  if (typeof bpmRaw !== 'number' || Number.isNaN(bpmRaw)) fail('arrangement.bpm must be a number');
  const bpm = Math.min(240, Math.max(40, Math.round(bpmRaw * 10) / 10));

  const moduleSettings = parseModuleSettings(raw.moduleSettings);

  const rawVaults = isPlainObject(raw.vaults) ? raw.vaults : undefined;
  const hasVaults = !!rawVaults && MODULE_TYPES.some((m) => rawVaults[m] !== undefined);
  let grids: Record<BotModuleType, boolean[][]>;
  let vaults: ReturnType<typeof parseVaults>;

  if (hasVaults) {
    // Vault-authored: the flat grids are derived from each module's active pattern so a loaded
    // session can never corrupt vault data with a stale snapshot.
    vaults = parseVaults(rawVaults, null);
    grids = {} as Record<BotModuleType, boolean[][]>;
    for (const m of MODULE_TYPES) {
      grids[m] = vaults[m].patterns.find((p) => p.id === vaults[m].activePatternId)!.grid;
    }
  } else {
    // Grid-authored: one 16-step loop per module — synthesize a single "MAIN" pattern per module.
    if (!isPlainObject(raw.grids)) fail('arrangement.grids is required (an object keyed by drum/bass/pad/synth/arp)');
    grids = {} as Record<BotModuleType, boolean[][]>;
    for (const m of MODULE_TYPES) {
      if (raw.grids[m] === undefined) fail(`arrangement.grids.${m} is required (all 5 modules: drum, bass, pad, synth, arp)`);
      grids[m] = parseGrid(raw.grids[m], m);
    }
    vaults = {} as Record<BotModuleType, { patterns: BotPattern[]; activePatternId: string; vaultOpen: boolean }>;
    for (const m of MODULE_TYPES) {
      vaults[m] = {
        patterns: [{
          id: `${m}-main`, moduleType: m, grid: grids[m],
          data: { patternName: 'MAIN', durationBeats: 8, notes: [], activeModules: { [m]: true } },
        }],
        activePatternId: `${m}-main`,
        vaultOpen: false,
      };
    }
  }

  const timeline = raw.timeline === undefined
    ? synthesizeTimeline(bpm)
    : parseTimeline(raw.timeline, vaults);

  return { bpm, grids, vaults, timeline, moduleSettings };
}

/** Full-length arrangement (16 two-bar blocks ≈ 58.2s at 132 BPM) holding each module's active pattern. */
function synthesizeTimeline(bpm: number): BotTimelineBlock[] {
  const blockMs = Math.round((8 / bpm) * 60 * 1000);
  const blocks: BotTimelineBlock[] = [];
  for (const m of MODULE_TYPES) {
    for (let b = 0; b < 16; b++) {
      blocks.push({
        id: `ext-${m}-main-${b}`,
        patternId: `${m}-main`,
        moduleType: m,
        startSec: (b * blockMs) / 1000,
        durationSec: blockMs / 1000,
      });
    }
  }
  return blocks;
}

/** Secret that protects a bot's submission from being overwritten by anyone else using its name. */
export function generateBotSecret(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// ── Best-effort per-IP rate limiting ──────────────────────────────────────────
// In-memory, so on Workers each isolate counts independently — a soft guard,
// not a hard wall. The per-round entry cap in the route is the real limit.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 10;
const rateBuckets = new Map<string, number[]>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX_REQUESTS) return false;
  hits.push(now);
  rateBuckets.set(ip, hits);
  return true;
}

export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
}
