'use client';
import dynamic from 'next/dynamic';

const BeatdownShell = dynamic(() => import('@/components/BeatdownShell'), { ssr: false });

export default function Home() {
  return <BeatdownShell />;
}
