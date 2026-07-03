'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { audioEngine, SCALE_FREQS } from './audioEngine';
import { GRID_ROWS, GRID_STEPS, MODULES } from './store';
import { mapCutoff, mapDecay, mapAttack, mapRes, mapPan } from './knobMapping';
import type { ModuleType } from './audioEngine';
import type { ArrangementData } from './supabase/types';

// Read-only counterpart to usePlayback's arrangement engine — plays back a fetched submission
// (Leaderboard / Arena) instead of the live editing session's Zustand store. Auto-stops at the
// end rather than looping, since this is "listen to a finished track," not a live pattern loop.
export function useTrackPlayback(arrangement: ArrangementData | null) {
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);

  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setPlaying(false);
    setCurrentSec(0);
    stepRef.current = 0;
  }, []);

  const toggle = useCallback(() => {
    if (!arrangement) return;
    if (timerRef.current) { stop(); return; }

    // Leaderboard/Arena never mount Studio's BeatdownShell, so the engine may never have been
    // initialized — without this, every preview() call below would silently no-op.
    audioEngine.init();
    audioEngine.resume();

    // Apply this track's own mix so it sounds as the composer intended, not whatever the
    // engine happens to be holding from elsewhere in the app.
    for (const module of MODULES) {
      const s = arrangement.moduleSettings?.[module];
      if (!s) continue;
      audioEngine.setVolume(module, s.volume);
      audioEngine.setCutoff(module, mapCutoff(s.cutoff));
      audioEngine.setDecay(module, mapDecay(s.decay));
      audioEngine.setAttack(module, mapAttack(s.attack));
      audioEngine.setRes(module, mapRes(s.res));
      audioEngine.setPan(module, mapPan(s.pan));
    }

    const secPerStep = 60 / (arrangement.bpm || 120) / 4;
    // Rich mode: has vaults, so timeline blocks can be resolved to real patterns.
    // Legacy mode: older submissions (pre-dating this fix) only ever saved the flat `grids` —
    // no vaults to resolve blocks against, so just loop those grids like the old ArenaPlayer did.
    const hasRichData = !!arrangement.vaults && Object.keys(arrangement.vaults).length > 0;
    const endSec = hasRichData
      ? arrangement.timeline.reduce((max, b) => Math.max(max, b.startSec + b.durationSec), 0) || 60
      : Infinity; // legacy tracks have no defined song length — loop until the user stops it

    stepRef.current = 0;
    setPlaying(true);

    timerRef.current = setInterval(() => {
      const sec = stepRef.current * secPerStep;
      if (sec >= endSec) { stop(); return; }
      setCurrentSec(sec);

      for (const module of MODULES) {
        let grid: boolean[][] | undefined;
        let localStep: number;

        if (hasRichData) {
          const block = arrangement.timeline.find(
            (b) => b.moduleType === module && sec >= b.startSec && sec < b.startSec + b.durationSec
          );
          if (!block) continue;
          const pattern = arrangement.vaults?.[module]?.patterns.find((p) => p.id === block.patternId);
          if (!pattern) continue;
          grid = pattern.grid;
          localStep = Math.floor((sec - block.startSec) / secPerStep) % GRID_STEPS;
        } else {
          grid = arrangement.grids[module];
          localStep = stepRef.current % GRID_STEPS;
        }

        if (!grid) continue;
        for (let row = 0; row < GRID_ROWS; row++) {
          if (grid[row]?.[localStep]) {
            audioEngine.preview(module as ModuleType, SCALE_FREQS[module][row], row);
          }
        }
      }
      stepRef.current += 1;
    }, secPerStep * 1000);
  }, [arrangement, stop]);

  // Stop cleanly if the component unmounts mid-playback
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return { playing, currentSec, toggle, stop };
}
