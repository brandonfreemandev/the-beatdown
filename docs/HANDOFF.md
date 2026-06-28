# The Beatdown — Engineering Handoff

_Last updated: 2026-06-28 · Sprint 2 complete_

---

## What This Is

A competitive web music sequencer. Users compose 60-second arrangements using a fixed 4-module palette, then submit to blind 1-vs-1 Arena battles. Skill wins over gear — everyone uses the same tools.

---

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npx tsc --noEmit   # type-check
```

**Node**: 18+ required. No env vars needed for Sprint 1–2.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Edge-optimized, TypeScript |
| State | Zustand | Single store, no context providers |
| Audio | Web Audio API | Native browser, no external libs |
| Styling | Inline styles | Zero Tailwind — Mondrian spec requires precise pixel control |
| DB (Sprint 3) | Supabase | Not yet wired |
| AI Matchmaker (Sprint 3) | Gemma4:31b-cloud → Gemma Flash | Not yet wired |
| Auth (Sprint 3) | Google + SoundCloud social | Not yet wired |

---

## Project Structure

```
app/
  layout.tsx          # Root layout — no Geist fonts, monospace only
  page.tsx            # 'use client' shell, dynamic imports BeatdownShell
  globals.css         # CSS variables for the design system

components/
  BeatdownShell.tsx   # Root UI component — layout, tab nav, vault toggle
  TransportBar.tsx    # Logo, play/stop, BPM input
  ModuleControls.tsx  # Knob row + sequencer grid for active module
  StepSequencer.tsx   # 8×16 grid, reads/writes store grids per module
  RotaryKnob.tsx      # SVG knob with mouse drag interaction
  VaultPanel.tsx      # 5-slot pattern bank with save/load/delete/duplicate
  ArrangementTimeline.tsx  # 60s timeline with snap-to-grid, drag-to-move

lib/
  audioEngine.ts      # Web Audio API singleton — oscillators, envelopes, per-module nodes
  store.ts            # Zustand store — all app state
  usePlayback.ts      # Playback hook — all-module simultaneous step sequencing

docs/
  VISION.md           # High-level scope
  council-transcript.md   # Design council decisions (source of truth for aesthetics)
  agent_handoff.md    # Original builder spec
  HANDOFF.md          # This file
```

---

## Design System

**Palette (locked — user-approved):**

| Token | Hex | Usage |
|---|---|---|
| Background | `#f9f9f7` | All surfaces |
| Black | `#000000` | All borders, text |
| Drum | `#74b9f3` | Sky blue |
| Bass | `#ffb300` | Amber |
| Pad | `#e8212b` | Mondrian red |
| Synth | `#6abf3a` | Yellow-green |
| Arp | `#00a693` | Teal |

**Rules (non-negotiable from council):**
- NO rounded corners anywhere
- NO shadows
- NO gradients
- 3px black borders for primary frames, 2px for internal elements
- Active/selected state = **color inversion** (block → white, text → black)
- Font: monospace everywhere

---

## Data Model

### Core Types (`lib/store.ts`)

```ts
type ModuleType = 'drum' | 'bass' | 'pad' | 'synth' | 'arp';
type Grid = boolean[][];   // [8 rows][16 steps]

interface Pattern {
  id: string;
  moduleType: ModuleType;
  grid: Grid;              // the step sequencer state
  data: SequenceData;      // name, durationBeats, notes[], activeModules
}

interface ModuleVault {
  patterns: Pattern[];     // max 5
  activePatternId: string | null;
  vaultOpen: boolean;
}

interface TimelineBlock {
  id: string;
  patternId: string;       // reference — NOT raw audio
  moduleType: ModuleType;
  startSec: number;
  durationSec: number;
}
```

### SequenceData JSON schema (from council, do not change shape):

```json
{
  "patternName": "DRUMS_A",
  "durationBeats": 8,
  "notes": [
    { "beat": 1, "noteFrequencyHz": 261.6, "durationRatio": 0.5 }
  ],
  "activeModules": { "drum": true }
}
```

### Hard constraints
- **60 seconds** max arrangement length
- **5 patterns** per module (vault cap)
- Timeline stores **pattern ID references**, never raw audio — editing a source pattern updates all timeline instances

---

## Audio Engine (`lib/audioEngine.ts`)

Singleton `audioEngine` — call `audioEngine.init()` once on mount (BeatdownShell does this).

**Signal chain per module:**
```
OscillatorNode → GainNode (envelope) → BiquadFilterNode (lowpass) → GainNode (volume) → destination
```

**Waveforms by module:**
| Module | Waveform | Notes |
|---|---|---|
| drum | square | + pitch envelope for punch |
| bass | sawtooth | |
| pad | sine | |
| synth | triangle | |
| arp | sawtooth | |

**Key methods:**
- `audioEngine.init()` — create per-module nodes, connect graph
- `audioEngine.preview(module, freqHz)` — one-shot note (used by grid cell clicks)
- `audioEngine.setVolume/setCutoff/setDecay/setAttack(module, value)` — real-time param control
- `audioEngine.setBpm(bpm)` — updates tempo reference

---

## Playback (`lib/usePlayback.ts`)

`usePlayback()` hook manages the global play/stop loop:
- Fires `setInterval` at 16th-note resolution (`60 / bpm / 4 * 1000` ms)
- On each tick: reads all 5 module grids from store, fires `audioEngine.preview()` for every active cell in the current step column
- Returns `{ isPlaying, playhead (0–15), timelineSec (0–60), toggle }`
- BPM changes during playback: interval is cleared and restarted automatically

---

## State (`lib/store.ts`)

Zustand store — access anywhere via `useStore(selector)` or `useStore.getState()` for non-reactive reads.

**Key actions:**

| Action | Description |
|---|---|
| `setActiveModule(m)` | Switch tab, close all vaults |
| `toggleCell(module, row, col)` | Flip a step in the working grid |
| `saveGridToPattern(module)` | Snapshot working grid → active vault pattern |
| `loadPatternToGrid(module, id)` | Load vault pattern → working grid |
| `addPattern(module)` | New blank pattern slot (max 5) |
| `deletePattern(module, id)` | Delete slot, remove timeline references, load next pattern |
| `duplicatePattern(module, id)` | Copy pattern to new slot (max 5) |
| `placeBlock(module, startSec)` | Place active pattern on timeline, snapped to pattern duration grid |
| `moveBlock(blockId, newStartSec)` | Drag timeline block, snapped, overlap-checked |
| `removeBlock(blockId)` | Remove from timeline |
| `toggleTimeline()` | Open/close arrangement panel |

---

## Sprint Status

### ✅ Sprint 1 — Complete
- Mondrian shell (off-white, 3px black borders, no rounded corners)
- 5-module audio engine (Web Audio API, per-module oscillator + filter + envelope)
- 8×16 step sequencer with per-module independent grid state
- Rotary knobs (VOL, CUTOFF, DECAY, ATTACK) with mouse-drag interaction
- Vault panel (5-slot pattern bank)
- BPM-synced transport with play/stop

### ✅ Sprint 2 — Complete
- Vault save/load fully wired to grid state
- All 5 modules play simultaneously during playback
- Vault: delete and duplicate pattern actions
- 60s arrangement timeline with pull-up handle
- Timeline: click-to-place with snap-to-grid (snaps to pattern duration boundaries)
- Timeline: drag-to-move blocks with overlap detection
- Timeline: right-click to remove blocks
- Red playhead line tracks in real time

### 🔲 Sprint 3 — Not started
- Supabase schema + migrations
- Google / SoundCloud social auth (guest-first flow)
- Gatekeeper system (vote count = simple majority of current round before submit unlocks)
- Arena: blind 1-vs-1 voting UI (Track A vs Track B, no names)
- ELO leaderboard
- Gemma4:31b-cloud Matchmaker Agent (pair tracks by metadata/style)
  - Fallback: Gemini Flash (large context, lower rate limit)
- Pattern persistence (save arrangements to Supabase)
- Submission flow (60s render + upload)

---

## Known Issues / Next Up

- Drum sounds are placeholder oscillator-based — real drum synthesis (noise bursts, kick transients) is a future improvement
- No pattern naming UI (names are auto-generated; rename in vault is Sprint 3)
- Timeline does not yet drive which pattern grid is loaded per-module during playback (always plays the working grid regardless of what's on the timeline — full arrangement playback is Sprint 3)
- No mobile layout (desktop-first by design for Sprint 1–2)

---

## Arena / Gatekeeper Spec (for Sprint 3 implementer)

- **Gatekeeper**: User must cast votes equal to simple majority of entries in the current Arena round before "Submit" unlocks. E.g., 10 entries → need 6 votes cast.
- **Arena UI**: Symmetric split, Track A vs Track B. No names, no avatars during voting. Identity revealed after vote is cast ("you just beat [Producer X]").
- **Matchmaker**: AI agent pairs tracks. Primary model: `gemma4:31b-cloud`. Fallback: Gemini Flash. Pair by skill bracket / audio metadata tags.
- **Leaderboard**: ELO-based ranking. No gamification badges — prestige comes from rank position only.

---

## Council Aesthetic Directives (binding)

From `docs/council-transcript.md` — The General's final verdicts:

1. **No red** was originally banned but user overrode this — Pad module IS red (`#e8212b`). This is final.
2. **Mondrian/Bauhaus**: The black frame is structural DNA. Every element is a rectangle. No decorative additions.
3. **Vault interaction**: Active pattern = white block (color inverted), inactive = module color. No borders added.
4. **Vault layout**: Hard-sided snap sidebar. Screen re-partitions; no overlay/float.
5. **Sprint discipline**: Ship audio first, then constraints layer, then competition layer.
