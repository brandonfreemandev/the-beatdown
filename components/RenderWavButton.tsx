'use client';
import { useState } from 'react';
import { renderArrangementToWav, sanitizeFilename } from '@/lib/renderTrack';
import type { ArrangementData } from '@/lib/supabase/types';

interface Props {
  arrangement: ArrangementData;
  title: string;
}

export default function RenderWavButton({ arrangement, title }: Props) {
  const [state, setState] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');

  const render = async () => {
    setState('rendering');
    try {
      const blob = await renderArrangementToWav(arrangement);
      // Dev convenience: also stash the render on the dev server so automation can
      // collect it without relying on browser downloads.
      if (process.env.NODE_ENV === 'development') {
        try {
          await fetch(`/api/dev/save-render?name=${sanitizeFilename(title)}.wav`, {
            method: 'POST',
            headers: { 'content-type': 'audio/wav' },
            body: blob,
          });
        } catch { /* download still proceeds even if the dev stash fails */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilename(title)}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState('done');
    } catch {
      setState('error');
    }
  };

  const label = state === 'rendering' ? '◌ RENDERING…'
    : state === 'done' ? '✓ RENDERED — CHECK DOWNLOADS'
    : state === 'error' ? '✗ RENDER FAILED — RETRY'
    : '⬇ RENDER WAV';

  return (
    <button
      onClick={render}
      disabled={state === 'rendering'}
      style={{
        background: 'transparent',
        color: 'var(--bd-on-ink)',
        border: '1px solid var(--bd-on-ink)',
        fontFamily: 'monospace', fontWeight: 700, fontSize: 9, letterSpacing: 2,
        padding: '3px 8px', cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
