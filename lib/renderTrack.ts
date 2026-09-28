'use client';

// Offline renderer: bounces an arrangement to a WAV file using the exact same synthesis
// the live engine performs — same pitch tables (SCALE_FREQS), same drum samples, same
// knob mappings, same timeline-block scheduling as useTrackPlayback — just into an
// OfflineAudioContext instead of real time.

import { SCALE_FREQS, type ModuleType } from './audioEngine';
import { GRID_ROWS, GRID_STEPS, MODULES } from './store';
import { mapCutoff, mapDecay, mapAttack, mapRes, mapPan } from './knobMapping';
import type { ArrangementData } from './supabase/types';

const DRUM_SAMPLES = [
  '/samples/drums/kick-soft.wav',
  '/samples/drums/kick-hard.wav',
  '/samples/drums/snare-1.wav',
  '/samples/drums/snare-2.wav',
  '/samples/drums/hat-ghost.wav',
  '/samples/drums/hat-closed-1.wav',
  '/samples/drums/hat-closed-2.wav',
  '/samples/drums/hat-open.wav',
];

const OSC_TYPES: Record<ModuleType, OscillatorType> = {
  drum: 'square',
  bass: 'sawtooth',
  pad: 'sine',
  synth: 'triangle',
  arp: 'sawtooth',
};

const TAIL_SEC = 2.5; // let final decay envelopes ring out

interface ModuleChain {
  filter: BiquadFilterNode;
  gain: GainNode;
  panner: StereoPannerNode;
  volume: number;
  attack: number;
  decay: number;
}

export async function renderArrangementToWav(arrangement: ArrangementData): Promise<Blob> {
  const bpm = arrangement.bpm || 120;
  const secPerStep = 60 / bpm / 4;

  // Total length: last block end + tail. Legacy flat-grid arrangements (no timeline)
  // render 16 bars like the old ArenaPlayer looped them.
  const hasRichData = !!arrangement.vaults && Object.keys(arrangement.vaults).length > 0;
  let endSec: number;
  if (hasRichData) {
    endSec = arrangement.timeline.reduce((max, b) => Math.max(max, b.startSec + b.durationSec), 0);
  } else {
    endSec = secPerStep * GRID_STEPS * 16;
  }
  if (!Number.isFinite(endSec) || endSec <= 0) endSec = secPerStep * GRID_STEPS * 4;
  const durationSec = endSec + TAIL_SEC;

  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * durationSec), sampleRate);

  // Decode drum samples first (same files the live engine uses)
  const drumBuffers: (AudioBuffer | null)[] = [];
  for (const url of DRUM_SAMPLES) {
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      drumBuffers.push(await ctx.decodeAudioData(buf));
    } catch {
      drumBuffers.push(null);
    }
  }

  // Build one chain per module — mirrors audioEngine.init + setVolume/setCutoff/... with
  // each track's own mix settings (useTrackPlayback applies these before playing).
  // A master trim keeps the summed mix out of clipping (the live engine relies on
  // playback volume, but a distributed artifact should keep headroom).
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);
  const chains = new Map<ModuleType, ModuleChain>();
  for (const module of MODULES) {
    const s = arrangement.moduleSettings?.[module];
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = s ? mapCutoff(s.cutoff) : 8000;
    filter.Q.value = s ? mapRes(s.res) : 1;
    const gain = ctx.createGain();
    gain.gain.value = s ? s.volume : 0.7;
    const panner = ctx.createStereoPanner();
    panner.pan.value = s ? mapPan(s.pan) : 0;
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(master);
    chains.set(module, {
      filter, gain, panner,
      volume: s ? s.volume : 0.7,
      attack: s ? mapAttack(s.attack) : 0.01,
      decay: s ? mapDecay(s.decay) : 0.3,
    });
  }

  const trigger = (module: ModuleType, freq: number, when: number, row: number) => {
    const chain = chains.get(module);
    if (!chain) return;

    // Drums first try their sample (row index selects the WAV), else pitch-env square —
    // identical fallback logic to audioEngine.preview/triggerNote.
    if (module === 'drum' && drumBuffers[row]) {
      const source = ctx.createBufferSource();
      source.buffer = drumBuffers[row]!;
      const env = ctx.createGain();
      env.gain.setValueAtTime(chain.volume, when);
      source.connect(env);
      env.connect(chain.filter);
      source.start(when);
      return;
    }

    const osc = ctx.createOscillator();
    osc.type = OSC_TYPES[module];
    osc.frequency.setValueAtTime(module === 'drum' ? freq * 2 : freq, when);
    if (module === 'drum') {
      osc.frequency.exponentialRampToValueAtTime(freq, when + 0.05);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(chain.volume, when + chain.attack);
    env.gain.exponentialRampToValueAtTime(0.001, when + chain.attack + chain.decay);
    osc.connect(env);
    env.connect(chain.filter);
    osc.start(when);
    osc.stop(when + chain.attack + chain.decay + 0.05);
  };

  // Schedule every active cell — same resolution logic as useTrackPlayback
  const schedule = (module: ModuleType, grid: boolean[][], startSec: number) => {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let step = 0; step < GRID_STEPS; step++) {
        if (!grid[row]?.[step]) continue;
        const when = startSec + step * secPerStep;
        if (when >= endSec) continue;
        trigger(module, SCALE_FREQS[module][row], when, row);
      }
    }
  };

  if (hasRichData) {
    for (const block of arrangement.timeline) {
      const pattern = arrangement.vaults?.[block.moduleType]?.patterns.find((p) => p.id === block.patternId);
      if (!pattern) continue;
      // An 8-beat block plays the 16-step grid twice (useTrackPlayback localStep % 16)
      const bars = Math.ceil(block.durationSec / (secPerStep * GRID_STEPS));
      for (let bar = 0; bar < bars; bar++) {
        const startSec = block.startSec + bar * secPerStep * GRID_STEPS;
        if (startSec >= block.startSec + block.durationSec) break;
        schedule(block.moduleType, pattern.grid, startSec);
      }
    }
  } else {
    for (const module of MODULES) {
      const grid = arrangement.grids[module];
      if (!grid) continue;
      for (let loop = 0; loop < 16; loop++) {
        schedule(module, grid, loop * secPerStep * GRID_STEPS);
      }
    }
  }

  const rendered = await ctx.startRendering();
  return encodeWav(rendered);
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataSize));

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view.buffer], { type: 'audio/wav' });
}

export function sanitizeFilename(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'track';
}
