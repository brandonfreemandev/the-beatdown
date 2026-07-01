'use client';
import { useRef, useCallback, useState, useEffect } from 'react';
import {
  useStore, MODULE_COLORS, MODULE_LABELS, MODULES, MAX_ARRANGEMENT_SEC,
} from '@/lib/store';
import type { ModuleType } from '@/lib/audioEngine';

interface Props {
  timelineSec: number;
  arrIsPlaying: boolean;
  arrLoop: boolean;
  onToggleArr: () => void;
  onToggleLoop: () => void;
  onSeek: (sec: number) => void;
  onReturnToStart: () => void;
}

const ROW_HEIGHT = 36;
const HANDLE_HEIGHT = 28;
const LABEL_WIDTH = 52;

const MODULE_INITIAL: Record<string, string> = { drum: 'D', bass: 'B', pad: 'P', synth: 'S', arp: 'A' };

export default function ArrangementTimeline({ timelineSec, arrIsPlaying, arrLoop, onToggleArr, onToggleLoop, onSeek, onReturnToStart }: Props) {
  const timelineOpen = useStore((s) => s.timelineOpen);
  const toggleTimeline = useStore((s) => s.toggleTimeline);
  const timeline = useStore((s) => s.timeline);
  const vaults = useStore((s) => s.vaults);
  const placeBlock = useStore((s) => s.placeBlock);
  const removeBlock = useStore((s) => s.removeBlock);
  const moveBlock = useStore((s) => s.moveBlock);
  const bpm = useStore((s) => s.bpm);
  const mutedModules = useStore((s) => s.mutedModules);
  const soloedModules = useStore((s) => s.soloedModules);
  const toggleMute = useStore((s) => s.toggleMute);
  const toggleSolo = useStore((s) => s.toggleSolo);
  const railRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Ghost block: { module, snappedSec } while hovering empty track space
  const [ghost, setGhost] = useState<{ module: ModuleType; snappedSec: number; durSec: number } | null>(null);

  const handleTrackMouseMove = useCallback(
    (module: ModuleType, e: React.MouseEvent<HTMLDivElement>) => {
      if (!railRef.current) return;
      const rect = railRef.current.getBoundingClientRect();
      const trackWidth = rect.width - LABEL_WIDTH;
      const x = Math.max(0, e.clientX - rect.left - LABEL_WIDTH);
      const rawSec = (x / trackWidth) * MAX_ARRANGEMENT_SEC;
      const vault = useStore.getState().vaults[module];
      const p = vault.patterns.find((pt) => pt.id === vault.activePatternId);
      if (!p) return;
      const durSec = (p.data.durationBeats / bpm) * 60;
      const snappedSec = Math.round(rawSec / durSec) * durSec;

      // Hide ghost if it would overlap an existing block
      const tl = useStore.getState().timeline;
      const overlaps = tl.some(
        (b) =>
          b.moduleType === module &&
          !(snappedSec >= b.startSec + b.durationSec || snappedSec + durSec <= b.startSec)
      );
      if (overlaps || snappedSec + durSec > MAX_ARRANGEMENT_SEC) {
        setGhost(null);
      } else {
        setGhost({ module, snappedSec, durSec });
      }
    },
    [bpm]
  );

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

        {/* Arrangement transport — return, play (primary), loop, matching standard DAW transport order */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderLeft: '1px solid #3a3a3a', flexShrink: 0 }}>
          <button
            onClick={onReturnToStart}
            className="arr-return"
            aria-label="Return to start"
            title="Return to start"
          >
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="1" y="1" width="2.5" height="12" fill="currentColor" />
              <path d="M13 1 L4 7 L13 13 Z" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={onToggleArr}
            className={`arr-play${arrIsPlaying ? ' playing' : ''}`}
            aria-label={arrIsPlaying ? 'Pause arrangement' : 'Play arrangement'}
            title={arrIsPlaying ? 'Pause arrangement' : 'Play arrangement'}
          >
            {arrIsPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14">
                <rect x="2" y="1" width="4" height="12" fill="currentColor" />
                <rect x="8" y="1" width="4" height="12" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2.5 1 L12.5 7 L2.5 13 Z" fill="currentColor" /></svg>
            )}
          </button>
          <button
            onClick={onToggleLoop}
            className={`arr-loop${arrLoop ? ' active' : ''}`}
            aria-label="Toggle loop"
            title="Toggle loop"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="currentColor" transform="scale(-1,1) translate(-24,0)" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
          </button>
        </div>
      </div>

      {timelineOpen && (
        <div
          ref={railRef}
          style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {/* Ruler */}
          <div style={{ height: 20, borderBottom: '2px solid #000', position: 'relative', flexShrink: 0, display: 'flex' }}>
            {/* Label-width spacer so ruler aligns with track area */}
            <div style={{ width: LABEL_WIDTH, flexShrink: 0, borderRight: '2px solid #000', background: '#f9f9f7' }} />
          <div style={{ flex: 1, position: 'relative', cursor: 'pointer' }} onClick={(e) => {
              if (!railRef.current) return;
              const rect = railRef.current.getBoundingClientRect();
              const trackWidth = rect.width - LABEL_WIDTH;
              const x = Math.max(0, e.clientX - rect.left - LABEL_WIDTH);
              const raw = (x / trackWidth) * MAX_ARRANGEMENT_SEC;
              const state = useStore.getState();
              const secPerBlock = (60 / state.bpm) * 8;
              onSeek(Math.round(raw / secPerBlock) * secPerBlock);
            }}>
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
          </div>{/* end track area */}
          </div>{/* end ruler */}

          {/* Module rows */}
          {MODULES.map((module, i) => {
            const color = MODULE_COLORS[module];
            const rowBlocks = timeline.filter((b) => b.moduleType === module);
            const hasSolo = soloedModules.size > 0;
            const isDimmed = mutedModules.has(module) || (hasSolo && !soloedModules.has(module));
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
                {/* Label: left color gutter + M/S text buttons */}
                <div
                  style={{
                    width: LABEL_WIDTH,
                    flexShrink: 0,
                    borderRight: '2px solid #000',
                    display: 'flex',
                    cursor: 'default',
                    background: '#f9f9f7',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 8px color stripe */}
                  <div style={{ width: 8, background: color, flexShrink: 0 }} />
                  {/* M button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMute(module); }}
                    title="Mute"
                    style={{
                      flex: 1,
                      border: 'none',
                      background: mutedModules.has(module) ? '#000' : 'transparent',
                      color: mutedModules.has(module) ? '#fff' : '#000',
                      fontFamily: 'monospace',
                      fontWeight: 900,
                      fontSize: 9,
                      letterSpacing: 1,
                      cursor: 'pointer',
                    }}
                  >
                    M
                  </button>
                  {/* S button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSolo(module); }}
                    title="Solo"
                    style={{
                      flex: 1,
                      border: 'none',
                      background: soloedModules.has(module) ? '#000' : 'transparent',
                      color: soloedModules.has(module) ? '#fff' : '#000',
                      fontFamily: 'monospace',
                      fontWeight: 900,
                      fontSize: 9,
                      letterSpacing: 1,
                      cursor: 'pointer',
                    }}
                  >
                    S
                  </button>
                </div>

                {/* Track area */}
                <div
                  style={{ flex: 1, position: 'relative', overflow: 'visible' }}
                  onMouseMove={(e) => handleTrackMouseMove(module, e)}
                  onMouseLeave={() => setGhost(null)}
                >
                  {/* Playhead */}
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

                  {/* Ghost block preview — desktop only */}
                  {!isMobile && ghost?.module === module && (
                    <div
                      className="ghost-block"
                      style={{
                        position: 'absolute',
                        left: `${secToPercent(ghost.snappedSec)}%`,
                        width: `${secToPercent(ghost.durSec)}%`,
                        top: 4, bottom: 4,
                        background: 'transparent',
                        border: '2px dashed #000',
                        opacity: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 5,
                        overflow: 'hidden',
                        pointerEvents: 'none',
                        zIndex: 4,
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 700, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                        {patternName(module, vaults[module].activePatternId ?? '')}
                      </span>
                    </div>
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
                          opacity: isDimmed ? 0.4 : 1,
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
                        <span className="block-label-full" style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 700, letterSpacing: 1, whiteSpace: 'nowrap' }}>
                          {patternName(module, block.patternId)}
                        </span>
                        <span className="block-label-short" style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 700, letterSpacing: 0, whiteSpace: 'nowrap' }}>
                          {MODULE_INITIAL[module]}{vaults[module].patterns.findIndex(p => p.id === block.patternId) + 1}
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
            <span className="arr-footer-full">CLICK TO PLACE · DRAG TO MOVE · RIGHT-CLICK TO REMOVE · MAX 60s</span>
            <span className="arr-footer-short">TAP · DRAG · HOLD TO REMOVE · 60s</span>
          </div>
        </div>
      )}
    </div>
  );
}
