import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const service = await createServiceClient();
  const { data: profile } = await (service.from('profiles') as any)
    .select('is_admin').eq('id', user.id).single();
  return profile?.is_admin ? { user, service } : null;
}

// GET — fetch rounds + all profiles
export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [{ data: rounds }, { data: profiles }] = await Promise.all([
    auth.service.from('rounds').select('*').order('started_at', { ascending: false }),
    (auth.service.from('profiles') as any).select('id, username, is_admin, elo_rating').order('username'),
  ]);

  return NextResponse.json({ rounds, profiles });
}

// POST — actions: open_round, close_round, toggle_admin
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { action } = body;

  if (action === 'open_round') {
    // Close any currently open rounds first
    await auth.service.from('rounds').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('status', 'open');
    const { data, error } = await auth.service.from('rounds').insert({ status: 'open' }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ round: data });
  }

  if (action === 'close_round') {
    const { roundId } = body;
    const { error } = await auth.service.from('rounds')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', roundId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'toggle_admin') {
    const { userId, isAdmin } = body;
    const { error } = await (auth.service.from('profiles') as any)
      .update({ is_admin: isAdmin }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
