'use client';
import { MODULE_COLORS, MODULE_LABELS, MODULES, GRID_STEPS } from '@/lib/store';
import type { ModuleType } from '@/lib/audioEngine';
import type { ArrangementData } from '@/lib/supabase/types';

interface Props {
  arrangement: ArrangementData;
  /** Seconds into the track — drives which pattern each module row shows. */
  currentSec?: number;
  /** While true, the current 16th-note column lights up white. */
  playing?: boolean;
}

/** Read-only mini sequencer grid for a finished track (Arena cards, leaderboard rows).
 *  Shows whichever vault pattern is actually active per module at currentSec.
 *  Older submissions (pre-dating the vaults field) fall back to their flat saved grid. */
export default function SequencerPreview({ arrangement, currentSec = 0, playing = false }: Props) {
  const secPerStep = 60 / (arrangement.bpm || 120) / 4;
  const step = playing ? Math.floor(currentSec / secPerStep) % GRID_STEPS : -1;

  return (
    <div>
      {MODULES.map((mod) => {
        const modColor = MODULE_COLORS[mod as ModuleType];
        const hasRichData = !!arrangement.vaults && Object.keys(arrangement.vaults).length > 0;
        const block = hasRichData
          ? arrangement.timeline.find(
              (b) => b.moduleType === mod && currentSec >= b.startSec && currentSec < b.startSec + b.durationSec
            )
          : undefined;
        const pattern = block ? arrangement.vaults?.[mod]?.patterns.find((p) => p.id === block.patternId) : undefined;
        const grid = hasRichData ? pattern?.grid : arrangement.grids?.[mod];
        const isActiveNow = playing && (hasRichData ? !!block : true);
        return (
          <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, height: 12 }}>
            <div style={{
              width: 36, flexShrink: 0,
              fontFamily: 'monospace', fontSize: 7, fontWeight: 900, letterSpacing: 1,
              color: isActiveNow ? 'var(--bd-ink)' : 'var(--bd-hint)',
            }}>
              {MODULE_LABELS[mod as ModuleType]}
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 1, height: '100%' }}>
              {Array.from({ length: GRID_STEPS }, (_, ci) => {
                const hasNote = grid?.some((row) => row[ci]);
                const isHead = ci === step && isActiveNow;
                return (
                  <div
                    key={ci}
                    style={{
                      flex: 1,
                      background: hasNote ? (isHead ? '#fff' : modColor) : isHead ? 'var(--bd-cell-head)' : 'var(--bd-cell)',
                      border: '1px solid var(--bd-grid-line)',
                      marginLeft: ci > 0 && ci % 4 === 0 ? 2 : 0,
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, color: 'var(--bd-faint)' }}>
        {arrangement.bpm} BPM
      </div>
    </div>
  );
}
