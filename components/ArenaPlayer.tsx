'use client';
import { MODULE_COLORS, MODULE_LABELS, MODULES, GRID_STEPS } from '@/lib/store';
import { useTrackPlayback } from '@/lib/useTrackPlayback';
import type { ModuleType } from '@/lib/audioEngine';
import type { ArrangementData } from '@/lib/supabase/types';

interface Props {
  arrangement: ArrangementData;
  color: string;
  label: string;
  title?: string;
}

export default function ArenaPlayer({ arrangement, color, label, title }: Props) {
  const { playing, currentSec, toggle } = useTrackPlayback(arrangement);
  const secPerStep = 60 / (arrangement.bpm || 120) / 4;
  const step = playing ? Math.floor(currentSec / secPerStep) % GRID_STEPS : -1;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Header */}
      <div style={{
        // Fixed accent header — text and button on it stay literal black/white in both themes
        background: color, color: '#000', borderBottom: '3px solid var(--bd-ink)',
        padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 9, letterSpacing: 3, opacity: 0.6 }}>{label}</div>
          {title && <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 13, letterSpacing: 2, marginTop: 2 }}>{title}</div>}
        </div>
        <button
          onClick={toggle}
          style={{
            background: playing ? '#000' : 'rgba(0,0,0,0.15)',
            color: playing ? '#f9f9f7' : '#000',
            border: '2px solid #000',
            fontFamily: 'monospace', fontWeight: 700, fontSize: 10, letterSpacing: 2,
            padding: '5px 14px', cursor: 'pointer', flexShrink: 0,
          }}
        >
          {playing ? '■ STOP' : '▶ LISTEN'}
        </button>
      </div>

      {/* Mini grid — shows whichever pattern is actually active per module at the current time.
          Older submissions (pre-dating the vaults field) have no blocks to resolve, so fall
          back to their flat saved grid, matching how they always rendered before this fix. */}
      <div style={{ padding: '12px 14px 10px', flex: 1, background: 'var(--bd-bg)' }}>
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
    </div>
  );
}
