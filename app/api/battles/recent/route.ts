import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveExpiredMatches } from '@/lib/battleLifecycle';

export const dynamic = 'force-dynamic';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' };
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

// GET /api/battles/recent — public feed of the latest Arena battles (active + resolved),
// with ready-made embed links. Lets agents, bots and automations watch the ladder.
export async function GET(request: Request) {
  const limitParam = Number(new URL(request.url).searchParams.get('limit') ?? 10);
  const limit = Number.isFinite(limitParam) ? Math.min(25, Math.max(1, Math.round(limitParam))) : 10;

  // Time-boxed battles close on read so the feed never shows undead matches.
  await resolveExpiredMatches().catch(() => {});

  const supabase = await createClient();
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, votes_a, votes_b, status, winner_id, created_at,
      track_a:submissions!matches_track_a_id_fkey(id, title, user_id, profiles(username)),
      track_b:submissions!matches_track_b_id_fkey(id, title, user_id, profiles(username))
    `)
    .in('status', ['active', 'resolved'])
    .order('created_at', { ascending: false })
    .limit(limit) as unknown as { data: Array<{
      id: string; votes_a: number; votes_b: number; status: string; winner_id: string | null; created_at: string;
      track_a: { id: string; title: string; user_id: string; profiles: { username: string } | null } | null;
      track_b: { id: string; title: string; user_id: string; profiles: { username: string } | null } | null;
    }> | null };

  const battles = (matches ?? []).filter((m) => m.track_a && m.track_b).map((m) => {
    const a = m.track_a!;
    const b = m.track_b!;
    return {
      id: m.id,
      status: m.status,
      sideA: { title: a.title, producer: a.profiles?.username ?? null },
      sideB: { title: b.title, producer: b.profiles?.username ?? null },
      votes: { a: m.votes_a, b: m.votes_b },
      winnerTitle: m.winner_id === a.id ? a.title : m.winner_id === b.id ? b.title : null,
      createdAt: m.created_at,
      embedUrl: `${SITE}/embed/battle/${m.id}`,
    };
  });

  return Response.json({
    service: 'The Beatdown — recent Arena battles',
    site: SITE || undefined,
    leaderboard: `${SITE}/leaderboard`,
    count: battles.length,
    battles,
  }, { headers: CORS });
}
