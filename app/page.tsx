'use client';
import dynamic from 'next/dynamic';

const BeatdownShell = dynamic(() => import('@/components/BeatdownShell'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100vw', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', fontWeight: 700, letterSpacing: 4, fontSize: 11,
      background: 'var(--bd-bg)', color: 'var(--bd-ink)',
    }}>
      LOADING STUDIO…
    </div>
  ),
});

export default function Home() {
  return <BeatdownShell />;
}
