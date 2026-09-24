'use client';
import { useRef, useCallback } from 'react';

interface Props {
  label: string;
  value: number;   // 0–1
  onChange: (v: number) => void;
  color?: string;
  defaultValue?: number;
}

const DRAG_SENSITIVITY = 120;

export default function RotaryKnob({ label, value, onChange, color = '#000', defaultValue = 0.5 }: Props) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startX = useRef(0);
  const startVal = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    startY.current = e.clientY;
    startX.current = e.clientX;
    startVal.current = value;
  }, [value]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const dy = startY.current - e.clientY;
    const dx = e.clientX - startX.current;
    const delta = (dy + dx) / DRAG_SENSITIVITY;
    onChange(Math.min(1, Math.max(0, startVal.current + delta)));
  }, [onChange]);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  // Draw knob arc: -135deg to +135deg
  const MIN_ANGLE = -135;
  const MAX_ANGLE = 135;
  const angle = MIN_ANGLE + value * (MAX_ANGLE - MIN_ANGLE);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const cx = 24, cy = 24, r = 16;

  const arcX = (deg: number) => cx + r * Math.cos(toRad(deg - 90));
  const arcY = (deg: number) => cy + r * Math.sin(toRad(deg - 90));

  const startArc = { x: arcX(MIN_ANGLE), y: arcY(MIN_ANGLE) };
  const endArc = { x: arcX(angle), y: arcY(angle) };
  const largeArc = (angle - MIN_ANGLE) > 180 ? 1 : 0;

  const tickX = cx + (r - 4) * Math.cos(toRad(angle - 90));
  const tickY = cy + (r - 4) * Math.sin(toRad(angle - 90));

  return (
    <div className="rotary-knob flex flex-col items-center select-none">
      <svg
        viewBox="0 0 48 48"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => onChange(defaultValue)}
        style={{ cursor: 'ns-resize', touchAction: 'none', overflow: 'visible' }}
      >
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={3} style={{ stroke: 'var(--bd-hairline)' }} />
        {/* Arc */}
        <path
          d={`M ${startArc.x} ${startArc.y} A ${r} ${r} 0 ${largeArc} 1 ${endArc.x} ${endArc.y}`}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="butt"
        />
        {/* Tick */}
        <circle cx={tickX} cy={tickY} r={2.5} fill={color} />
        {/* Center */}
        <circle cx={cx} cy={cy} r={6} strokeWidth={2} style={{ fill: 'var(--bd-bg)', stroke: 'var(--bd-ink)' }} />
      </svg>
      <span className="rotary-knob-label">{label}</span>
    </div>
  );
}
