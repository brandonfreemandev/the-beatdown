'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { audioEngine } from './audioEngine';
import { useStore, MODULES, GRID_ROWS, GRID_STEPS } from './store';
import type { ModuleType } from './audioEngine';

const SCALE_FREQS: Record<ModuleType, number[]> = {
  drum:  [80, 100, 120, 150, 180, 200, 240, 300],
  bass:  [55, 73.4, 82.4, 110, 146.8, 164.8, 220, 293.7],
  pad:   [261.6, 293.7, 329.6, 369.9, 415.3, 466.2, 523.2, 587.3],
  synth: [220, 246.9, 261.6, 293.7, 329.6, 369.9, 415.3, 440],
  arp:   [440, 493.9, 523.2, 587.3, 659.3, 739.9, 830.6, 880],
};

export function usePlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);
  const [arrIsPlaying, setArrIsPlaying] = useState(false);
  const [timelineSec, setTimelineSec] = useState(0);
  const [arrLoop, setArrLoop] = useState(false);

  // Refs for values that interval closures must read without going stale
  const bpm = useStore((s) => s.bpm);
  const bpmRef = useRef(bpm);
  const arrLoopRef = useRef(false);
  const isPlayingRef = useRef(false);
  const arrIsPlayingRef = useRef(false);
  const patternStepRef = useRef(0);
  const arrStepRef = useRef(0);
  const patternTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep all refs in sync with state/props every render
  bpmRef.current = bpm;
  arrLoopRef.current = arrLoop;
  isPlayingRef.current = isPlaying;
  arrIsPlayingRef.current = arrIsPlaying;

  const getMsPerStep = () => (60 / bpmRef.current / 4) * 1000;

  // ── Tick functions stored in refs so the interval always calls the latest version ──
  const patternTickRef = useRef(() => {});
  patternTickRef.current = () => {
    const step = patternStepRef.current % GRID_STEPS;
    setPlayhead(step);
    // Play only the active module's working grid — pattern play is per-instrument
    const state = useStore.getState();
    const module = state.activeModule;
    const grid = state.grids[module];
    for (let row = 0; row < GRID_ROWS; row++) {
      if (grid[row][step]) audioEngine.preview(module, SCALE_FREQS[module][row], row);
    }
    patternStepRef.current += 1;
  };

  const arrTickRef = useRef(() => {});
  arrTickRef.current = () => {
    const secPerStep = 60 / bpmRef.current / 4;
    const sec = arrStepRef.current * secPerStep;

    // Loop ends at the last block's end time (not necessarily 60s)
    const state = useStore.getState();
    const lastEnd = state.timeline.reduce(
      (max, b) => Math.max(max, b.startSec + b.durationSec), 0
    );
    const endSec = lastEnd > 0 ? lastEnd : 60;

    if (sec >= endSec) {
      if (arrLoopRef.current) {
        arrStepRef.current = 0;
        setTimelineSec(0);
        // fall through and play step 0 immediately — no gap on loop
      } else {
        if (arrTimerRef.current) { clearInterval(arrTimerRef.current); arrTimerRef.current = null; }
        setArrIsPlaying(false);
        arrIsPlayingRef.current = false;
        return;
      }
    }

    const playSec = arrStepRef.current * secPerStep;
    setTimelineSec(playSec);

    const hasSolo = state.soloedModules.size > 0;
    for (const module of MODULES) {
      if (state.mutedModules.has(module)) continue;
      if (hasSolo && !state.soloedModules.has(module)) continue;
      const block = state.timeline.find(
        (b) => b.moduleType === module && playSec >= b.startSec && playSec < b.startSec + b.durationSec
      );
      if (!block) continue;
      const pattern = state.vaults[module].patterns.find((p) => p.id === block.patternId);
      if (!pattern) continue;
      const grid = block.patternId === state.vaults[module].activePatternId
        ? state.grids[module]
        : pattern.grid;
      const localStep = Math.floor((playSec - block.startSec) / secPerStep) % GRID_STEPS;
      for (let row = 0; row < GRID_ROWS; row++) {
        if (grid[row][localStep]) audioEngine.preview(module, SCALE_FREQS[module][row], row);
      }
    }

    arrStepRef.current += 1;
  };

  // ── Stable start/stop helpers ─────────────────────────────────────────────
  const startPattern = useCallback(() => {
    audioEngine.resume();
    patternStepRef.current = 0;
    if (patternTimerRef.current) clearInterval(patternTimerRef.current);
    patternTimerRef.current = setInterval(() => patternTickRef.current(), getMsPerStep());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopPattern = useCallback(() => {
    if (patternTimerRef.current) { clearInterval(patternTimerRef.current); patternTimerRef.current = null; }
    setPlayhead(-1);
  }, []);

  // startArr resumes from current arrStepRef position (supports pause/resume)
  const startArr = useCallback(() => {
    audioEngine.resume();
    if (arrTimerRef.current) clearInterval(arrTimerRef.current);
    arrTimerRef.current = setInterval(() => arrTickRef.current(), getMsPerStep());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause: stop the interval but keep timelineSec position
  const stopArr = useCallback(() => {
    if (arrTimerRef.current) { clearInterval(arrTimerRef.current); arrTimerRef.current = null; }
  }, []);

  const returnToStart = useCallback(() => {
    stopArr();
    arrStepRef.current = 0;
    setTimelineSec(0);
    setArrIsPlaying(false);
    arrIsPlayingRef.current = false;
  }, [stopArr]);

  // ── Public toggles — read from refs so they're never stale ───────────────
  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      stopPattern();
      setIsPlaying(false);
    } else {
      if (arrIsPlayingRef.current) { stopArr(); setArrIsPlaying(false); }
      startPattern();
      setIsPlaying(true);
    }
  }, [startPattern, stopPattern, stopArr]);

  const toggleArr = useCallback(() => {
    if (arrIsPlayingRef.current) {
      stopArr();
      setArrIsPlaying(false);
    } else {
      if (isPlayingRef.current) { stopPattern(); setIsPlaying(false); }
      startArr();
      setArrIsPlaying(true);
    }
  }, [startArr, stopArr, stopPattern]);

  // Re-sync interval speed on BPM change while playing
  useEffect(() => {
    if (patternTimerRef.current) {
      clearInterval(patternTimerRef.current);
      patternTimerRef.current = setInterval(() => patternTickRef.current(), getMsPerStep());
    }
    if (arrTimerRef.current) {
      clearInterval(arrTimerRef.current);
      arrTimerRef.current = setInterval(() => arrTickRef.current(), getMsPerStep());
    }
  }, [bpm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (patternTimerRef.current) clearInterval(patternTimerRef.current);
      if (arrTimerRef.current) clearInterval(arrTimerRef.current);
    };
  }, []);

  const seekArr = useCallback((sec: number) => {
    const secPerStep = 60 / bpmRef.current / 4;
    arrStepRef.current = Math.round(sec / secPerStep);
    setTimelineSec(sec);
  }, []);

  return { isPlaying, playhead, toggle, arrIsPlaying, timelineSec, arrLoop, setArrLoop, toggleArr, seekArr, returnToStart };
}
