'use client';
import SequencerPreview from '@/components/SequencerPreview';
import { useTrackPlayback } from '@/lib/useTrackPlayback';
import type { ArrangementData } from '@/lib/supabase/types';

interface Props {
  arrangement: ArrangementData;
  color: string;
  label: string;
  title?: string;
}

export default function ArenaPlayer({ arrangement, color, label, title }: Props) {
  const { playing, currentSec, toggle } = useTrackPlayback(arrangement);

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

      <div style={{ padding: '12px 14px 10px', flex: 1, background: 'var(--bd-bg)' }}>
        <SequencerPreview arrangement={arrangement} currentSec={currentSec} playing={playing} />
      </div>
    </div>
  );
}
