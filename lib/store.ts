import { create } from 'zustand';
import { temporal } from 'zundo';
import { persist } from 'zustand/middleware';
import type { ModuleType, SequenceData } from './audioEngine';

export const MODULE_COLORS: Record<ModuleType, string> = {
  drum:  '#74b9f3',
  bass:  '#ffb300',
  pad:   '#e8212b',
  synth: '#6abf3a',
  arp:   '#00a693',
};

export const MODULE_LABELS: Record<ModuleType, string> = {
  drum: 'DRUMS',
  bass: 'BASS',
  pad:  'PADS',
  synth: 'SYNTH',
  arp:  'ARP',
};

export const MODULES: ModuleType[] = ['drum', 'bass', 'pad', 'synth', 'arp'];
export const GRID_ROWS = 8;
export const GRID_STEPS = 16;
export const MAX_ARRANGEMENT_SEC = 60;

export type PatternId = string;
export type Grid = boolean[][];

export interface Pattern {
  id: PatternId;
  moduleType: ModuleType;
  data: SequenceData;
  grid: Grid;
}

export interface ModuleVault {
  patterns: Pattern[];
  activePatternId: PatternId | null;
  vaultOpen: boolean;
}

export interface TimelineBlock {
  id: string;
  patternId: PatternId;
  moduleType: ModuleType;
  startSec: number;
  durationSec: number;
}

function emptyGrid(): Grid {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_STEPS).fill(false));
}

export interface ModuleSettings {
  res: number; // 0–1
  pan: number; // 0–1
}

interface AppState {
  activeModule: ModuleType;
  vaults: Record<ModuleType, ModuleVault>;
  grids: Record<ModuleType, Grid>;
  moduleSettings: Record<ModuleType, ModuleSettings>;
  mutedModules: Set<ModuleType>;
  soloedModules: Set<ModuleType>;
  timeline: TimelineBlock[];
  timelineOpen: boolean;
  bpm: number;

  setActiveModule: (m: ModuleType) => void;
  setModuleSettings: (module: ModuleType, settings: Partial<ModuleSettings>) => void;
  toggleMute: (module: ModuleType) => void;
  toggleSolo: (module: ModuleType) => void;
  setActivePattern: (module: ModuleType, id: PatternId) => void;
  toggleVault: (module: ModuleType) => void;
  addPattern: (module: ModuleType) => void;
  deletePattern: (module: ModuleType, id: PatternId) => void;
  duplicatePattern: (module: ModuleType, id: PatternId) => void;
  saveGridToPattern: (module: ModuleType) => void;
  loadPatternToGrid: (module: ModuleType, id: PatternId) => void;
  toggleCell: (module: ModuleType, row: number, col: number) => void;
  placeBlock: (module: ModuleType, startSec: number) => void;
  removeBlock: (blockId: string) => void;
  moveBlock: (blockId: string, newStartSec: number) => void;
  toggleTimeline: () => void;
  setBpm: (bpm: number) => void;
  renamePattern: (module: ModuleType, id: PatternId, name: string) => void;
  clearSession: () => void;
}

function defaultVault(): ModuleVault {
  return { patterns: [], activePatternId: null, vaultOpen: true };
}

function seedPattern(module: ModuleType, index: number): Pattern {
  const freqMap: Record<ModuleType, number[]> = {
    drum:  [80, 60, 100, 80],
    bass:  [55, 82.4, 110, 73.4],
    pad:   [261.6, 329.6, 392, 523.2],
    synth: [440, 493.9, 523.2, 587.3],
    arp:   [220, 277.2, 329.6, 440],
  };
  const freqs = freqMap[module];
  return {
    id: `${module}-${index}`,
    moduleType: module,
    grid: emptyGrid(),
    data: {
      patternName: `${MODULE_LABELS[module]} ${index + 1}`,
      durationBeats: 8,
      notes: [],
      activeModules: { [module]: true },
    },
  };
}

const initialVaults: Record<ModuleType, ModuleVault> = {} as Record<ModuleType, ModuleVault>;
const initialGrids: Record<ModuleType, Grid> = {} as Record<ModuleType, Grid>;
const initialModuleSettings: Record<ModuleType, ModuleSettings> = {} as Record<ModuleType, ModuleSettings>;

for (const m of MODULES) {
  const vault = defaultVault();
  vault.patterns = [seedPattern(m, 0), seedPattern(m, 1)];
  vault.activePatternId = vault.patterns[0].id;
  initialVaults[m] = vault;
  initialGrids[m] = emptyGrid();
  initialModuleSettings[m] = { res: 0.05, pan: 0.5 };
}

const STORAGE_KEY = 'beatdown-session-v1';

// Which state slices are tracked by undo (cells + timeline only — not BPM/knobs/UI)
type UndoPartial = Pick<AppState, 'grids' | 'vaults' | 'timeline'>;

export const useStore = create<AppState>()(
  temporal(
    persist(
      (set, get) => ({
  activeModule: 'drum',
  vaults: initialVaults,
  grids: initialGrids,
  moduleSettings: initialModuleSettings,
  mutedModules: new Set<ModuleType>(),
  soloedModules: new Set<ModuleType>(),
  timeline: [],
  timelineOpen: true,
  bpm: 120,

  setActiveModule: (m) =>
    set((s) => ({
      activeModule: m,
      vaults: Object.fromEntries(
        MODULES.map((mod) => [mod, { ...s.vaults[mod], vaultOpen: false }])
      ) as Record<ModuleType, ModuleVault>,
    })),

  setActivePattern: (module, id) =>
    set((s) => ({
      vaults: {
        ...s.vaults,
        [module]: { ...s.vaults[module], activePatternId: id },
      },
    })),

  toggleVault: (module) =>
    set((s) => ({
      vaults: {
        ...s.vaults,
        [module]: { ...s.vaults[module], vaultOpen: !s.vaults[module].vaultOpen },
      },
    })),

  addPattern: (module) =>
    set((s) => {
      const vault = s.vaults[module];
      if (vault.patterns.length >= 5) return s;
      const idx = vault.patterns.length;
      const newPattern: Pattern = {
        id: `${module}-${Date.now()}`,
        moduleType: module,
        grid: emptyGrid(),
        data: {
          patternName: `${MODULE_LABELS[module]} ${idx + 1}`,
          durationBeats: 8,
          notes: [],
          activeModules: { [module]: true },
        },
      };
      return {
        vaults: {
          ...s.vaults,
          [module]: {
            ...vault,
            patterns: [...vault.patterns, newPattern],
            activePatternId: newPattern.id,
          },
        },
        grids: { ...s.grids, [module]: emptyGrid() },
      };
    }),

  saveGridToPattern: (module) =>
    set((s) => {
      const vault = s.vaults[module];
      if (!vault.activePatternId) return s;
      const grid = s.grids[module].map((r) => [...r]);
      const patterns = vault.patterns.map((p) =>
        p.id === vault.activePatternId ? { ...p, grid } : p
      );
      return { vaults: { ...s.vaults, [module]: { ...vault, patterns } } };
    }),

  loadPatternToGrid: (module, id) =>
    set((s) => {
      const vault = s.vaults[module];
      const pattern = vault.patterns.find((p) => p.id === id);
      if (!pattern) return s;
      // Auto-save current working grid into the currently active pattern before switching
      const savedPatterns = vault.activePatternId
        ? vault.patterns.map((p) =>
            p.id === vault.activePatternId
              ? { ...p, grid: s.grids[module].map((r) => [...r]) }
              : p
          )
        : vault.patterns;
      return {
        grids: { ...s.grids, [module]: pattern.grid.map((r) => [...r]) },
        vaults: { ...s.vaults, [module]: { ...vault, patterns: savedPatterns, activePatternId: id } },
      };
    }),

  toggleCell: (module, row, col) =>
    set((s) => {
      const grid = s.grids[module].map((r) => [...r]);
      grid[row][col] = !grid[row][col];
      return { grids: { ...s.grids, [module]: grid } };
    }),

  placeBlock: (module, startSec) =>
    set((s) => {
      const vault = s.vaults[module];
      if (!vault.activePatternId) return s;

      // Flush working grid into the active pattern before placing
      const flushedPatterns = vault.patterns.map((p) =>
        p.id === vault.activePatternId
          ? { ...p, grid: s.grids[module].map((r) => [...r]) }
          : p
      );
      const flushedPattern = flushedPatterns.find((p) => p.id === vault.activePatternId)!;

      const durationSec = (flushedPattern.data.durationBeats / s.bpm) * 60;
      if (startSec + durationSec > MAX_ARRANGEMENT_SEC) return s;
      const overlaps = s.timeline.some(
        (b) =>
          b.moduleType === module &&
          !(startSec >= b.startSec + b.durationSec || startSec + durationSec <= b.startSec)
      );
      if (overlaps) return s;
      const block: TimelineBlock = {
        id: `block-${Date.now()}`,
        patternId: vault.activePatternId,
        moduleType: module,
        startSec,
        durationSec,
      };
      return {
        timeline: [...s.timeline, block],
        vaults: { ...s.vaults, [module]: { ...vault, patterns: flushedPatterns } },
      };
    }),

  deletePattern: (module, id) =>
    set((s) => {
      const vault = s.vaults[module];
      if (vault.patterns.length <= 1) return s; // keep at least one
      const patterns = vault.patterns.filter((p) => p.id !== id);
      const activePatternId =
        vault.activePatternId === id ? (patterns[0]?.id ?? null) : vault.activePatternId;
      const newGrid = patterns.find((p) => p.id === activePatternId)?.grid ?? emptyGrid();
      return {
        vaults: { ...s.vaults, [module]: { ...vault, patterns, activePatternId } },
        grids: { ...s.grids, [module]: newGrid.map((r) => [...r]) },
        // remove timeline blocks referencing the deleted pattern
        timeline: s.timeline.filter((b) => b.patternId !== id),
      };
    }),

  duplicatePattern: (module, id) =>
    set((s) => {
      const vault = s.vaults[module];
      if (vault.patterns.length >= 5) return s;
      const src = vault.patterns.find((p) => p.id === id);
      if (!src) return s;
      const copy: Pattern = {
        ...src,
        id: `${module}-${Date.now()}`,
        grid: src.grid.map((r) => [...r]),
        data: { ...src.data, patternName: src.data.patternName + '_COPY' },
      };
      return {
        vaults: {
          ...s.vaults,
          [module]: {
            ...vault,
            patterns: [...vault.patterns, copy],
            activePatternId: copy.id,
          },
        },
        grids: { ...s.grids, [module]: copy.grid.map((r) => [...r]) },
      };
    }),

  removeBlock: (blockId) =>
    set((s) => ({ timeline: s.timeline.filter((b) => b.id !== blockId) })),

  moveBlock: (blockId, newStartSec) =>
    set((s) => {
      const block = s.timeline.find((b) => b.id === blockId);
      if (!block) return s;
      const clamped = Math.max(0, Math.min(newStartSec, MAX_ARRANGEMENT_SEC - block.durationSec));
      const overlaps = s.timeline.some(
        (b) =>
          b.id !== blockId &&
          b.moduleType === block.moduleType &&
          !(clamped >= b.startSec + b.durationSec || clamped + block.durationSec <= b.startSec)
      );
      if (overlaps) return s;
      return {
        timeline: s.timeline.map((b) =>
          b.id === blockId ? { ...b, startSec: clamped } : b
        ),
      };
    }),

  toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),

  setBpm: (bpm) => set({ bpm }),
  toggleMute: (module) => set((s) => {
    const next = new Set(s.mutedModules);
    next.has(module) ? next.delete(module) : next.add(module);
    return { mutedModules: next };
  }),
  toggleSolo: (module) => set((s) => {
    const next = new Set(s.soloedModules);
    next.has(module) ? next.delete(module) : next.add(module);
    return { soloedModules: next };
  }),
  setModuleSettings: (module, settings) =>
    set((s) => ({
      moduleSettings: {
        ...s.moduleSettings,
        [module]: { ...s.moduleSettings[module], ...settings },
      },
    })),

  renamePattern: (module, id, name) =>
    set((s) => {
      const vault = s.vaults[module];
      const patterns = vault.patterns.map((p) =>
        p.id === id ? { ...p, data: { ...p.data, patternName: name } } : p
      );
      return { vaults: { ...s.vaults, [module]: { ...vault, patterns } } };
    }),

  clearSession: () => {
    const fresh: Record<ModuleType, ModuleVault> = {} as Record<ModuleType, ModuleVault>;
    const freshGrids: Record<ModuleType, Grid> = {} as Record<ModuleType, Grid>;
    for (const m of MODULES) {
      const vault = defaultVault();
      vault.patterns = [seedPattern(m, 0), seedPattern(m, 1)];
      vault.activePatternId = vault.patterns[0].id;
      fresh[m] = vault;
      freshGrids[m] = emptyGrid();
    }
    set({ vaults: fresh, grids: freshGrids, timeline: [], bpm: 120, activeModule: 'drum' });
    useStore.temporal.getState().clear();
    localStorage.removeItem(STORAGE_KEY);
  },
      }),
      {
        name: STORAGE_KEY,
        // Persist everything except transient UI state
        partialize: (s) => ({
          grids: s.grids,
          vaults: s.vaults,
          timeline: s.timeline,
          bpm: s.bpm,
          moduleSettings: s.moduleSettings,
        }),
      }
    ),
    {
      // Only track these slices in undo history
      partialize: (s): UndoPartial => ({
        grids: s.grids,
        vaults: s.vaults,
        timeline: s.timeline,
      }),
      limit: 40,
    }
  )
);
