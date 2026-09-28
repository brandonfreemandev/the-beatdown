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
  const { data } = await supabase.from('submissions').select('title').eq('id', id).maybeSingle();
  return { title: data?.title ? `${data.title} — The Beatdown` : 'The Beatdown' };
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
