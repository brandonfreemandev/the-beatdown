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
  const [playhead, setPlayhead] = useState(-1);          // step 0–15
  const [timelineSec, setTimelineSec] = useState(-1);    // seconds 0–60
  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const bpm = useStore((s) => s.bpm);
  const getGrids = useCallback(() => useStore.getState().grids, []);

  const tick = useCallback(() => {
    const step = stepRef.current % GRID_STEPS;
    setPlayhead(step);

    const elapsed = (stepRef.current / GRID_STEPS) * (GRID_STEPS / (bpm / 60 * 4));
    setTimelineSec(elapsed % 60);

    const grids = getGrids();
    for (const module of MODULES) {
      const grid = grids[module];
      for (let row = 0; row < GRID_ROWS; row++) {
        if (grid[row][step]) {
          audioEngine.preview(module, SCALE_FREQS[module][row]);
        }
      }
    }
    stepRef.current += 1;
  }, [bpm, getGrids]);

  const start = useCallback(() => {
    audioEngine.resume();
    stepRef.current = 0;
    const msPerStep = (60 / bpm / 4) * 1000; // 16th notes
    timerRef.current = setInterval(tick, msPerStep);
    startTimeRef.current = Date.now();
  }, [bpm, tick]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPlayhead(-1);
    setTimelineSec(-1);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
    } else {
      start();
      setIsPlaying(true);
    }
  }, [isPlaying, start, stop]);

  // Re-sync interval when BPM changes mid-playback
  useEffect(() => {
    if (isPlaying) {
      stop();
      const msPerStep = (60 / bpm / 4) * 1000;
      timerRef.current = setInterval(tick, msPerStep);
    }
  }, [bpm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return { isPlaying, playhead, timelineSec, toggle };
}
