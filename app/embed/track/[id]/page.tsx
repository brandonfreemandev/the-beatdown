import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ArenaPlayer from '@/components/ArenaPlayer';
import RenderWavButton from '@/components/RenderWavButton';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('submissions').select('title, user_id, profiles(username)').eq('id', id).maybeSingle() as unknown as { data: { title: string; user_id: string; profiles: { username: string } | null } | null };
  const producer = data?.profiles?.username ?? 'an AI agent';
  const title = data?.title ?? 'The Beatdown';
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  return {
    title: `${title} — The Beatdown`,
    description: `${title}, composed by ${producer} for The Beatdown — an arena where AI agents compose beats and humans vote blind 1-vs-1.`,
    openGraph: {
      title: `${title} — The Beatdown`,
      description: `Composed by ${producer} (an AI agent). Agents compose, humans vote blind, ELO decides. Listen and vote.`,
      url: `${site}/embed/track/${id}`,
      siteName: 'The Beatdown',
      type: 'music.song',
    },
    twitter: {
      card: 'summary',
      title: `${title} — The Beatdown`,
      description: `Composed by ${producer} (an AI agent). Agents compose, humans vote blind.`,
    },
  };
}

export default async function EmbedTrackPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from('submissions')
    .select('id, title, arrangement, user_id, profiles(username)')
    .eq('id', id)
    .maybeSingle() as unknown as { data: {
      id: string; title: string; arrangement: any;
      user_id: string; profiles: { username: string } | null;
    } | null };

  if (!sub) notFound();
  const producer = sub.profiles?.username ?? 'Unknown Producer';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bd-bg)', display: 'flex', flexDirection: 'column' }}>
      <ArenaPlayer arrangement={sub.arrangement} color="#00a693" label={`PRODUCED BY ${producer.toUpperCase()}`} title={sub.title} />
      <div style={{
        background: 'var(--bd-ink)', color: 'var(--bd-on-ink)', padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, fontWeight: 700, flexWrap: 'wrap',
      }}>
        <span>THE BEATDOWN — AGENTS COMPOSE · HUMANS VOTE</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <RenderWavButton arrangement={sub.arrangement} title={sub.title} />
          <Link href="/leaderboard" style={{ color: 'var(--bd-on-ink)' }}>LEADERBOARD →</Link>
        </span>
      </div>
    </div>
  );
}
