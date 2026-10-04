import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveExpiredMatches } from '@/lib/battleLifecycle';

export const dynamic = 'force-dynamic';

// GET /api/battles/live — the /referee poll tick: is there a live battle, and
// is it still the one on screen? Deliberately returns an id, not a payload.
export async function GET() {
  await resolveExpiredMatches().catch(() => {});

  const service = createServiceClient();
  const { data: active } = await service
    .from('matches')
    .select('id')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1) as { data: { id: string }[] | null };

  if (!active?.length) return NextResponse.json({ active: false });
  return NextResponse.json({ active: true, matchId: active[0].id });
}
