export type ModuleType = 'drum' | 'bass' | 'pad' | 'synth' | 'arp';

export interface Note {
  beat: number;
  noteFrequencyHz: number;
  durationRatio: number;
}

export interface SequenceData {
  patternName: string;
  durationBeats: number;
  notes: Note[];
  activeModules: Record<string, boolean>;
}

interface ModuleState {
  gainNode: GainNode;
  filterNode: BiquadFilterNode;
  pannerNode: StereoPannerNode;
  volume: number;   // 0–1
  cutoff: number;   // Hz
  decay: number;    // seconds
  attack: number;   // seconds
  res: number;      // filter Q 0–20
  pan: number;      // -1 to +1
}

// Row index → sample file for the drum module
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

class AudioEngine {
  private ctx: AudioContext | null = null;
  private modules: Map<ModuleType, ModuleState> = new Map();
  private drumBuffers: (AudioBuffer | null)[] = Array(8).fill(null);
  private schedulerTimer: ReturnType<typeof setTimeout> | null = null;
  private currentBeat = 0;
  private bpm = 120;
  private isPlaying = false;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  init() {
    const ctx = this.getCtx();
    const types: ModuleType[] = ['drum', 'bass', 'pad', 'synth', 'arp'];
    for (const type of types) {
      const gainNode = ctx.createGain();
      const filterNode = ctx.createBiquadFilter();
      const pannerNode = ctx.createStereoPanner();
      filterNode.type = 'lowpass';
      filterNode.frequency.value = 8000;
      filterNode.Q.value = 1;
      filterNode.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(ctx.destination);
      gainNode.gain.value = 0.7;
      this.modules.set(type, {
        gainNode, filterNode, pannerNode,
        volume: 0.7, cutoff: 8000, decay: 0.3, attack: 0.01, res: 1, pan: 0,
      });
    }
    // Load drum samples asynchronously
    this.loadDrumSamples(ctx);
  }

  private async loadDrumSamples(ctx: AudioContext) {
    await Promise.all(
      DRUM_SAMPLES.map(async (url, i) => {
        try {
          const res = await fetch(url);
          const buf = await res.arrayBuffer();
          this.drumBuffers[i] = await ctx.decodeAudioData(buf);
        } catch {
          // Sample failed to load — will fall back to oscillator
        }
      })
    );
  }

  private getOscType(module: ModuleType): OscillatorType {
    switch (module) {
      case 'drum': return 'square';
      case 'bass': return 'sawtooth';
      case 'pad': return 'sine';
      case 'synth': return 'triangle';
      case 'arp': return 'sawtooth';
    }
  }

  triggerNote(module: ModuleType, freq: number, when: number, duration: number) {
    const ctx = this.getCtx();
    const state = this.modules.get(module);
    if (!state) return;

    const osc = ctx.createOscillator();
    const envGain = ctx.createGain();

    osc.type = this.getOscType(module);
    osc.frequency.value = freq;

    // Drums: pitch envelope for punch
    if (module === 'drum') {
      osc.frequency.setValueAtTime(freq * 2, when);
      osc.frequency.exponentialRampToValueAtTime(freq, when + 0.05);
    }

    envGain.gain.setValueAtTime(0, when);
    envGain.gain.linearRampToValueAtTime(state.volume, when + state.attack);
    envGain.gain.exponentialRampToValueAtTime(0.001, when + state.attack + state.decay);

    osc.connect(envGain);
    envGain.connect(state.filterNode);

    osc.start(when);
    osc.stop(when + duration + state.decay);
  }

  setVolume(module: ModuleType, value: number) {
    const state = this.modules.get(module);
    if (!state) return;
    state.volume = value;
    state.gainNode.gain.setTargetAtTime(value, this.getCtx().currentTime, 0.01);
  }

  setCutoff(module: ModuleType, hz: number) {
    const state = this.modules.get(module);
    if (!state) return;
    state.cutoff = hz;
    state.filterNode.frequency.setTargetAtTime(hz, this.getCtx().currentTime, 0.01);
  }

  setDecay(module: ModuleType, seconds: number) {
    const state = this.modules.get(module);
    if (!state) return;
    state.decay = seconds;
  }

  setAttack(module: ModuleType, seconds: number) {
    const state = this.modules.get(module);
    if (!state) return;
    state.attack = seconds;
  }

  setRes(module: ModuleType, q: number) {
    const state = this.modules.get(module);
    if (!state) return;
    state.res = q;
    state.filterNode.Q.setTargetAtTime(q, this.getCtx().currentTime, 0.01);
  }

  setPan(module: ModuleType, pan: number) {
    const state = this.modules.get(module);
    if (!state) return;
    state.pan = pan;
    state.pannerNode.pan.setTargetAtTime(pan, this.getCtx().currentTime, 0.01);
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
  }

  playPattern(module: ModuleType, pattern: SequenceData) {
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const secPerBeat = 60 / this.bpm;
    const now = ctx.currentTime;

    for (const note of pattern.notes) {
      const when = now + note.beat * secPerBeat;
      const duration = note.durationRatio * secPerBeat;
      this.triggerNote(module, note.noteFrequencyHz, when, duration);
    }
  }

  private triggerDrumSample(row: number, when: number) {
    const ctx = this.getCtx();
    const buffer = this.drumBuffers[row];
    if (!buffer) return false;
    const state = this.modules.get('drum');
    if (!state) return false;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(state.volume, when);
    source.connect(envGain);
    envGain.connect(state.filterNode);
    source.start(when);
    return true;
  }

  // Single-note preview trigger (for UI cell clicks and playback)
  preview(module: ModuleType, freq: number, row?: number) {
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    if (module === 'drum' && row !== undefined) {
      if (this.triggerDrumSample(row, ctx.currentTime)) return;
    }
    this.triggerNote(module, freq, ctx.currentTime, 0.1);
  }

  async resume() {
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
  }
}

// Singleton
export const audioEngine = new AudioEngine();
