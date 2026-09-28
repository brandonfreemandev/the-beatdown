import { normalizeArrangement } from './botSubmissions';

// ── Gemini's entry ("NEON MONOLITH") ─────────────────────────────────────────
// v2, authored by Gemini after round feedback. v1 ("Gemini Flash (browser)")
// was one 16-step loop per lane for the whole track; this is a proper
// arrangement: 9 vault patterns across the lanes and a 20-block timeline
// (intro → main → breakdown → solo section → fill → reprise, 54.5 s at 132 BPM).
// The JSON below is byte-for-byte what Gemini delivered, normalized through the
// same validator the public bot API uses (lib/botSubmissions.ts).

const GEMINI_ARRANGEMENT = JSON.parse(`{
  "bpm": 132,
  "moduleSettings": {
    "drum": { "volume": 0.85, "cutoff": 0.9, "decay": 0.35, "attack": 0.01, "res": 0.2, "pan": 0.5 },
    "bass": { "volume": 0.8, "cutoff": 0.7, "decay": 0.45, "attack": 0.02, "res": 0.4, "pan": 0.5 },
    "pad": { "volume": 0.6, "cutoff": 0.5, "decay": 0.75, "attack": 0.25, "res": 0.3, "pan": 0.5 },
    "synth": { "volume": 0.75, "cutoff": 0.8, "decay": 0.3, "attack": 0.05, "res": 0.35, "pan": 0.4 },
    "arp": { "volume": 0.7, "cutoff": 0.85, "decay": 0.2, "attack": 0.01, "res": 0.5, "pan": 0.6 }
  },
  "vaults": {
    "drum": {
      "activePatternId": "drum-main",
      "patterns": [
        {
          "id": "drum-intro",
          "grid": [
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, true, true, false, false, true, false, false, false, true, true, false, false, true, false, true],
            [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true]
          ]
        },
        {
          "id": "drum-main",
          "grid": [
            [true, false, false, false, false, false, true, false, true, false, false, false, false, false, true, false],
            [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
            [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
            [false, false, false, false, false, false, false, true, false, false, false, false, false, false, true, false],
            [false, true, true, false, false, true, false, false, false, true, true, false, false, true, false, true],
            [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            [false, false, false, true, false, false, false, true, false, false, false, true, false, false, false, true],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true]
          ]
        },
        {
          "id": "drum-fill",
          "grid": [
            [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
            [false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true],
            [false, false, false, false, true, false, false, false, false, false, false, false, true, true, true, true],
            [true, true, true, true, false, false, false, false, true, true, true, true, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, true]
          ]
        }
      ]
    },
    "bass": {
      "activePatternId": "bass-main",
      "patterns": [
        {
          "id": "bass-main",
          "grid": [
            [true, false, false, true, false, false, true, false, true, false, false, true, false, false, false, false],
            [false, false, true, false, false, true, false, false, false, false, true, false, false, true, false, false],
            [false, false, false, false, true, false, false, false, false, false, false, false, true, false, true, false],
            [false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, true],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
          ]
        },
        {
          "id": "bass-alt",
          "grid": [
            [true, true, false, false, true, true, false, false, true, true, false, false, true, true, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, true],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
          ]
        }
      ]
    },
    "pad": {
      "activePatternId": "pad-sustained",
      "patterns": [
        {
          "id": "pad-sustained",
          "grid": [
            [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
          ]
        }
      ]
    },
    "synth": {
      "activePatternId": "synth-lead",
      "patterns": [
        {
          "id": "synth-lead",
          "grid": [
            [true, false, false, false, false, false, true, false, false, false, true, false, false, false, false, false],
            [false, false, false, true, false, false, false, false, false, false, false, false, false, true, false, false],
            [false, false, true, false, false, true, false, false, true, false, false, false, true, false, false, false],
            [false, false, false, false, true, false, false, false, false, false, false, true, false, false, false, true],
            [false, true, false, false, false, false, false, true, false, true, false, false, false, false, true, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
          ]
        },
        {
          "id": "synth-solo",
          "grid": [
            [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, true, false, false, true, false, false, true, false, false, true, false, false, true, false, false],
            [false, false, true, false, false, true, false, false, true, false, false, true, false, false, true, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false]
          ]
        }
      ]
    },
    "arp": {
      "activePatternId": "arp-fast",
      "patterns": [
        {
          "id": "arp-fast",
          "grid": [
            [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, true, false, false, false, true, false, false, false, true, false, false, false, true, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
            [false, false, false, true, false, false, false, true, false, false, false, true, false, false, false, true],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
          ]
        }
      ]
    }
  },
  "timeline": [
    { "patternId": "pad-sustained", "moduleType": "pad", "startSec": 0.0, "durationSec": 7.272 },
    { "patternId": "arp-fast", "moduleType": "arp", "startSec": 3.636, "durationSec": 3.636 },
    { "patternId": "drum-intro", "moduleType": "drum", "startSec": 3.636, "durationSec": 3.636 },
    { "patternId": "drum-main", "moduleType": "drum", "startSec": 7.272, "durationSec": 14.545 },
    { "patternId": "bass-main", "moduleType": "bass", "startSec": 7.272, "durationSec": 14.545 },
    { "patternId": "synth-lead", "moduleType": "synth", "startSec": 10.909, "durationSec": 10.909 },
    { "patternId": "arp-fast", "moduleType": "arp", "startSec": 7.272, "durationSec": 14.545 },
    { "patternId": "pad-sustained", "moduleType": "pad", "startSec": 21.818, "durationSec": 7.272 },
    { "patternId": "synth-lead", "moduleType": "synth", "startSec": 21.818, "durationSec": 7.272 },
    { "patternId": "drum-main", "moduleType": "drum", "startSec": 29.090, "durationSec": 14.545 },
    { "patternId": "bass-alt", "moduleType": "bass", "startSec": 29.090, "durationSec": 14.545 },
    { "patternId": "synth-solo", "moduleType": "synth", "startSec": 29.090, "durationSec": 14.545 },
    { "patternId": "arp-fast", "moduleType": "arp", "startSec": 29.090, "durationSec": 14.545 },
    { "patternId": "pad-sustained", "moduleType": "pad", "startSec": 36.363, "durationSec": 7.272 },
    { "patternId": "drum-fill", "moduleType": "drum", "startSec": 43.636, "durationSec": 3.636 },
    { "patternId": "drum-main", "moduleType": "drum", "startSec": 47.272, "durationSec": 7.272 },
    { "patternId": "bass-main", "moduleType": "bass", "startSec": 47.272, "durationSec": 7.272 },
    { "patternId": "synth-solo", "moduleType": "synth", "startSec": 47.272, "durationSec": 7.272 },
    { "patternId": "arp-fast", "moduleType": "arp", "startSec": 47.272, "durationSec": 7.272 },
    { "patternId": "pad-sustained", "moduleType": "pad", "startSec": 47.272, "durationSec": 7.272 }
  ]
}` as string);

const normalized = normalizeArrangement(GEMINI_ARRANGEMENT);

export const GEMINI_TRACK = {
  grids: normalized.grids,
  vaults: normalized.vaults,
  timeline: normalized.timeline,
  bpm: normalized.bpm,
  moduleSettings: normalized.moduleSettings,
};
