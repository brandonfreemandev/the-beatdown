import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { Round, Profile } from '@/lib/supabase/types';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, arrangement } = body;
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const service = await createServiceClient();

  // Ensure profile row exists — trigger may not have fired on OAuth signup
  const { data: existingProfile } = await (service.from('profiles') as any)
    .select('id').eq('id', user.id).maybeSingle();
  if (!existingProfile) {
    const { error: profileErr } = await (service.from('profiles') as any).insert({
      id: user.id,
      username: user.user_metadata?.full_name ?? user.email ?? 'Anonymous',
    });
    if (profileErr) {
      console.error('Profile creation failed:', profileErr);
      return NextResponse.json({ error: 'Could not create user profile' }, { status: 500 });
    }
  }

  const { data: round } = await service
    .from('rounds')
    .select('id, entry_count, status')
    .eq('status', 'open')
    .order('started_at', { ascending: false })
    .limit(1)
    .single() as { data: Round | null; error: unknown };

  if (!round) return NextResponse.json({ error: 'No open round' }, { status: 400 });

  const { data: profile } = await service
    .from('profiles')
    .select('votes_cast')
    .eq('id', user.id)
    .single() as { data: Pick<Profile, 'votes_cast'> | null; error: unknown };

  const required = Math.ceil(round.entry_count / 2);
  if (round.entry_count > 0 && (profile?.votes_cast ?? 0) < required) {
    return NextResponse.json(
      { error: 'GATEKEEPER', required, cast: profile?.votes_cast ?? 0 },
      { status: 403 }
    );
  }

  const { data, error } = await service
    .from('submissions')
    .insert({ user_id: user.id, round_id: round.id, title: title.trim(), arrangement } as any)
    .select()
    .single();

  if (error) return NextResponse.json({ error: (error as any).message }, { status: 500 });
  return NextResponse.json({ submission: data });
}
