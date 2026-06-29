'use client';
import { useRef, useCallback } from 'react';
import {
  useStore, MODULE_COLORS, MODULE_LABELS, MODULES, MAX_ARRANGEMENT_SEC,
} from '@/lib/store';

interface Props {
  timelineSec: number;
  arrIsPlaying: boolean;
  arrLoop: boolean;
  onToggleArr: () => void;
  onToggleLoop: () => void;
  onSeek: (sec: number) => void;
}

const ROW_HEIGHT = 36;
const HANDLE_HEIGHT = 28;
const LABEL_WIDTH = 52;

export default function ArrangementTimeline({ timelineSec, arrIsPlaying, arrLoop, onToggleArr, onToggleLoop, onSeek }: Props) {
  const timelineOpen = useStore((s) => s.timelineOpen);
  const toggleTimeline = useStore((s) => s.toggleTimeline);
  const timeline = useStore((s) => s.timeline);
  const vaults = useStore((s) => s.vaults);
  const placeBlock = useStore((s) => s.placeBlock);
  const removeBlock = useStore((s) => s.removeBlock);
  const moveBlock = useStore((s) => s.moveBlock);
  const bpm = useStore((s) => s.bpm);
  const railRef = useRef<HTMLDivElement>(null);

  const secToPercent = (sec: number) => (sec / MAX_ARRANGEMENT_SEC) * 100;

  // Snap raw seconds to the nearest pattern-duration boundary
  const snapSec = useCallback((rawSec: number, durationSec: number) => {
    return Math.round(rawSec / durationSec) * durationSec;
  }, []);

  const getPatternDurSec = useCallback(
    (module: typeof MODULES[number]) => {
      const vault = vaults[module];
      const p = vault.patterns.find((p) => p.id === vault.activePatternId);
      if (!p) return 4;
      return (p.data.durationBeats / bpm) * 60;
    },
    [vaults, bpm]
  );

  const getRailX = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!railRef.current) return 0;
    const rect = railRef.current.getBoundingClientRect();
    return Math.max(0, e.clientX - rect.left - LABEL_WIDTH);
  }, []);

  const xToSec = useCallback((x: number) => {
    if (!railRef.current) return 0;
    const trackWidth = railRef.current.getBoundingClientRect().width - LABEL_WIDTH;
    return (x / trackWidth) * MAX_ARRANGEMENT_SEC;
  }, []);

  const handlePlayheadDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!railRef.current) return;
    const rect = railRef.current.getBoundingClientRect();
    const trackWidth = rect.width - LABEL_WIDTH;

    // Collect seam positions: start and end of every block
    const state = useStore.getState();
    const seams = Array.from(
      new Set([0, ...state.timeline.flatMap((b) => [b.startSec, b.startSec + b.durationSec])])
    ).sort((a, b) => a - b);

    const snap = (raw: number) =>
      seams.reduce((best, s) => (Math.abs(s - raw) < Math.abs(best - raw) ? s : best), seams[0] ?? 0);

    const onMove = (mv: MouseEvent) => {
      const x = Math.max(0, mv.clientX - rect.left - LABEL_WIDTH);
      onSeek(snap((x / trackWidth) * MAX_ARRANGEMENT_SEC));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onSeek]);

  const handleRowClick = (module: typeof MODULES[number], e: React.MouseEvent<HTMLDivElement>) => {
    const x = getRailX(e);
    const rawSec = xToSec(x);
    const durSec = getPatternDurSec(module);
    placeBlock(module, snapSec(rawSec, durSec));
  };

  // Drag-to-move a block
  const startDrag = useCallback(
    (e: React.MouseEvent, blockId: string, blockStartSec: number, durationSec: number) => {
      e.stopPropagation();
      e.preventDefault();
      if (!railRef.current) return;
      const rect = railRef.current.getBoundingClientRect();
      const trackWidth = rect.width - LABEL_WIDTH;
      const grabOffset = e.clientX - rect.left - LABEL_WIDTH - (blockStartSec / MAX_ARRANGEMENT_SEC) * trackWidth;

      const onMove = (mv: MouseEvent) => {
        const x = Math.max(0, mv.clientX - rect.left - LABEL_WIDTH - grabOffset);
        const rawSec = (x / trackWidth) * MAX_ARRANGEMENT_SEC;
        moveBlock(blockId, snapSec(rawSec, durationSec));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [moveBlock, snapSec]
  );

  const patternName = (module: typeof MODULES[number], patternId: string) =>
    vaults[module].patterns.find((p) => p.id === patternId)?.data.patternName ?? '';

  return (
    <div
      style={{
        borderTop: '3px solid #000',
        background: '#f9f9f7',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Pull-up handle */}
      <div
        style={{
          height: HANDLE_HEIGHT,
          background: '#000',
          color: '#f9f9f7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <button
          onClick={toggleTimeline}
          style={{
            flex: 1,
            height: '100%',
            background: 'transparent',
            color: '#f9f9f7',
            border: 'none',
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: 3,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 16px',
            textAlign: 'left',
          }}
        >
          <span>ARRANGEMENT</span>
          <span style={{ fontSize: 12 }}>{timelineOpen ? '▼' : '▲'}</span>
        </button>

        {/* Arrangement transport */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderLeft: '2px solid #333', flexShrink: 0 }}>
          <button
            onClick={onToggleLoop}
            title="Toggle arrangement loop"
            style={{
              padding: '0 12px',
              background: arrLoop ? '#f9f9f7' : 'transparent',
              color: arrLoop ? '#000' : '#f9f9f7',
              border: 'none',
              borderRight: '2px solid #333',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 9,
              letterSpacing: 2,
              cursor: 'pointer',
            }}
          >
            ⟳ LOOP
          </button>
          <button
            onClick={onToggleArr}
            title="Play/stop arrangement"
            style={{
              padding: '0 16px',
              background: arrIsPlaying ? '#e8212b' : 'transparent',
              color: '#f9f9f7',
              border: 'none',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 9,
              letterSpacing: 2,
              cursor: 'pointer',
            }}
          >
            {arrIsPlaying ? '■ STOP ARR' : '▶ PLAY ARR'}
          </button>
        </div>
      </div>

      {timelineOpen && (
        <div
          ref={railRef}
          style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {/* Ruler */}
          <div style={{ height: 20, borderBottom: '2px solid #000', position: 'relative', flexShrink: 0, marginLeft: LABEL_WIDTH }}>
            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((sec) => (
              <div
                key={sec}
                style={{
                  position: 'absolute',
                  left: `${secToPercent(sec)}%`,
                  top: 0, bottom: 0,
                  borderLeft: '1px solid #000',
                  paddingLeft: 3,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: 1 }}>{sec}s</span>
              </div>
            ))}
            {timelineSec >= 0 && (
              <div
                onMouseDown={handlePlayheadDrag}
                style={{
                  position: 'absolute',
                  left: `${secToPercent(timelineSec)}%`,
                  top: 0, bottom: 0, width: 8,
                  transform: 'translateX(-3px)',
                  cursor: 'ew-resize',
                  display: 'flex',
                  alignItems: 'flex-start',
                  zIndex: 20,
                }}
              >
                {/* Caret handle */}
                <div style={{ width: 8, height: 8, background: '#e8212b', clipPath: 'polygon(0 0, 100% 0, 50% 100%)', flexShrink: 0 }} />
                <div style={{ position: 'absolute', left: 3, top: 0, bottom: 0, width: 2, background: '#e8212b' }} />
              </div>
            )}
          </div>

          {/* Module rows */}
          {MODULES.map((module, i) => {
            const color = MODULE_COLORS[module];
            const rowBlocks = timeline.filter((b) => b.moduleType === module);
            return (
              <div
                key={module}
                onClick={(e) => handleRowClick(module, e)}
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: i < MODULES.length - 1 ? '2px solid #000' : 'none',
                  display: 'flex',
                  cursor: 'crosshair',
                  position: 'relative',
                }}
              >
                {/* Label */}
                <div
                  style={{
                    width: LABEL_WIDTH,
                    flexShrink: 0,
                    background: color,
                    borderRight: '2px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    fontSize: 8,
                    letterSpacing: 2,
                    pointerEvents: 'none',
                  }}
                >
                  {MODULE_LABELS[module]}
                </div>

                {/* Track area */}
                <div style={{ flex: 1, position: 'relative' }}>
                  {/* Playhead */}
                  {timelineSec >= 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${secToPercent(timelineSec)}%`,
                        top: 0, bottom: 0, width: 2,
                        background: '#e8212b',
                        pointerEvents: 'none',
                        zIndex: 10,
                      }}
                    />
                  )}

                  {rowBlocks.map((block) => {
                    const left = secToPercent(block.startSec);
                    const width = secToPercent(block.durationSec);
                    return (
                      <div
                        key={block.id}
                        onMouseDown={(e) => startDrag(e, block.id, block.startSec, block.durationSec)}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); removeBlock(block.id); }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          left: `${left}%`,
                          width: `${width}%`,
                          top: 4, bottom: 4,
                          background: color,
                          border: '2px solid #000',
                          cursor: 'grab',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 5,
                          overflow: 'hidden',
                          userSelect: 'none',
                          zIndex: 5,
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 700, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                          {patternName(module, block.patternId)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ borderTop: '2px solid #000', padding: '4px 12px', fontFamily: 'monospace', fontSize: 9, color: '#666', letterSpacing: 1, flexShrink: 0 }}>
            CLICK TO PLACE · DRAG TO MOVE · RIGHT-CLICK TO REMOVE · MAX 60s
          </div>
        </div>
      )}
    </div>
  );
}
