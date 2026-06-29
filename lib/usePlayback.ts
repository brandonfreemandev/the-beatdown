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
  // Pattern-loop mode
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);
  const patternStepRef = useRef(0);
  const patternTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Arrangement mode
  const [arrIsPlaying, setArrIsPlaying] = useState(false);
  const [timelineSec, setTimelineSec] = useState(-1);
  const [arrLoop, setArrLoop] = useState(false);
  const arrStepRef = useRef(0);
  const arrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arrLoopRef = useRef(false);

  // Keep arrLoopRef in sync so the interval closure sees current value
  useEffect(() => { arrLoopRef.current = arrLoop; }, [arrLoop]);

  const bpm = useStore((s) => s.bpm);

  const msPerStep = useCallback(() => (60 / bpm / 4) * 1000, [bpm]);

  // ── Pattern tick ─────────────────────────────────────────────────────────
  const patternTick = useCallback(() => {
    const step = patternStepRef.current % GRID_STEPS;
    setPlayhead(step);

    const grids = useStore.getState().grids;
    for (const module of MODULES) {
      const grid = grids[module];
      for (let row = 0; row < GRID_ROWS; row++) {
        if (grid[row][step]) audioEngine.preview(module, SCALE_FREQS[module][row]);
      }
    }
    patternStepRef.current += 1;
  }, []);

  const startPattern = useCallback(() => {
    audioEngine.resume();
    patternStepRef.current = 0;
    patternTimerRef.current = setInterval(patternTick, msPerStep());
  }, [patternTick, msPerStep]);

  const stopPattern = useCallback(() => {
    if (patternTimerRef.current) clearInterval(patternTimerRef.current);
    setPlayhead(-1);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) { stopPattern(); setIsPlaying(false); }
    else {
      if (arrIsPlaying) { stopArr(); setArrIsPlaying(false); }
      startPattern(); setIsPlaying(true);
    }
  }, [isPlaying, arrIsPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Arrangement tick ─────────────────────────────────────────────────────
  const arrTick = useCallback(() => {
    const secPerStep = (60 / bpm / 4);
    const sec = arrStepRef.current * secPerStep;

    if (sec >= 60) {
      if (arrLoopRef.current) {
        arrStepRef.current = 0;
        setTimelineSec(0);
        return;
      } else {
        if (arrTimerRef.current) clearInterval(arrTimerRef.current);
        setArrIsPlaying(false);
        setTimelineSec(-1);
        return;
      }
    }

    setTimelineSec(sec);

    const state = useStore.getState();
    const step = arrStepRef.current % GRID_STEPS;

    for (const module of MODULES) {
      const block = state.timeline.find(
        (b) => b.moduleType === module && sec >= b.startSec && sec < b.startSec + b.durationSec
      );
      if (!block) continue;
      const pattern = state.vaults[module].patterns.find((p) => p.id === block.patternId);
      if (!pattern) continue;
      // step within this pattern block
      const localStep = Math.floor((sec - block.startSec) / secPerStep) % GRID_STEPS;
      for (let row = 0; row < GRID_ROWS; row++) {
        if (pattern.grid[row][localStep]) audioEngine.preview(module, SCALE_FREQS[module][row]);
      }
    }

    arrStepRef.current += 1;
  }, [bpm]);

  const startArr = useCallback(() => {
    audioEngine.resume();
    arrStepRef.current = 0;
    arrTimerRef.current = setInterval(arrTick, msPerStep());
  }, [arrTick, msPerStep]);

  const stopArr = useCallback(() => {
    if (arrTimerRef.current) clearInterval(arrTimerRef.current);
    setTimelineSec(-1);
  }, []);

  const toggleArr = useCallback(() => {
    if (arrIsPlaying) { stopArr(); setArrIsPlaying(false); }
    else {
      if (isPlaying) { stopPattern(); setIsPlaying(false); }
      startArr(); setArrIsPlaying(true);
    }
  }, [arrIsPlaying, isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-sync intervals on BPM change
  useEffect(() => {
    if (isPlaying) {
      if (patternTimerRef.current) clearInterval(patternTimerRef.current);
      patternTimerRef.current = setInterval(patternTick, msPerStep());
    }
    if (arrIsPlaying) {
      if (arrTimerRef.current) clearInterval(arrTimerRef.current);
      arrTimerRef.current = setInterval(arrTick, msPerStep());
    }
  }, [bpm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (patternTimerRef.current) clearInterval(patternTimerRef.current);
      if (arrTimerRef.current) clearInterval(arrTimerRef.current);
    };
  }, []);

  return { isPlaying, playhead, toggle, arrIsPlaying, timelineSec, arrLoop, setArrLoop, toggleArr };
}
