'use client';
import { useRef, useCallback } from 'react';

interface Props {
  label: string;
  value: number;   // 0–1
  onChange: (v: number) => void;
  color?: string;
}

export default function RotaryKnob({ label, value, onChange, color = '#000' }: Props) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;

    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = (startY.current - e.clientY) / 120;
      onChange(Math.min(1, Math.max(0, startVal.current + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [value, onChange]);

  // Draw knob arc: -135deg to +135deg
  const MIN_ANGLE = -135;
  const MAX_ANGLE = 135;
  const angle = MIN_ANGLE + value * (MAX_ANGLE - MIN_ANGLE);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const cx = 24, cy = 24, r = 18;

  const arcX = (deg: number) => cx + r * Math.cos(toRad(deg - 90));
  const arcY = (deg: number) => cy + r * Math.sin(toRad(deg - 90));

  const startArc = { x: arcX(MIN_ANGLE), y: arcY(MIN_ANGLE) };
  const endArc = { x: arcX(angle), y: arcY(angle) };
  const largeArc = (angle - MIN_ANGLE) > 180 ? 1 : 0;

  const tickX = cx + (r - 4) * Math.cos(toRad(angle - 90));
  const tickY = cy + (r - 4) * Math.sin(toRad(angle - 90));

  return (
    <div className="flex flex-col items-center select-none" style={{ width: 56 }}>
      <svg
        width={48}
        height={48}
        onMouseDown={onMouseDown}
        style={{ cursor: 'ns-resize' }}
      >
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ccc" strokeWidth={3} />
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
        <circle cx={cx} cy={cy} r={6} fill="#f9f9f7" stroke="#000" strokeWidth={2} />
      </svg>
      <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#000' }}>
        {label}
      </span>
    </div>
  );
}
