import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/ensureProfile';
import type { Match } from '@/lib/supabase/types';

const MIN_VOTES_TO_RESOLVE = 3;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { matchId, votedForId } = await request.json();
  if (!matchId || !votedForId) {
    return NextResponse.json({ error: 'matchId and votedForId required' }, { status: 400 });
  }

  const service = createServiceClient();

  const { error: profileErr } = await ensureProfile(service, user);
  if (profileErr) {
    console.error('Profile creation failed:', profileErr);
    return NextResponse.json({ error: 'Could not create user profile' }, { status: 500 });
  }

  const { data: match } = await service
    .from('matches')
    .select('track_a_id, track_b_id, status, votes_a, votes_b')
    .eq('id', matchId)
    .single() as { data: Pick<Match, 'track_a_id' | 'track_b_id' | 'status' | 'votes_a' | 'votes_b'> | null; error: unknown };

  if (!match || match.status !== 'active') {
    return NextResponse.json({ error: 'Match not active' }, { status: 400 });
  }
  if (votedForId !== match.track_a_id && votedForId !== match.track_b_id) {
    return NextResponse.json({ error: 'Invalid vote target' }, { status: 400 });
  }

  const { data: ownSub } = await service
    .from('submissions')
    .select('user_id')
    .in('id', [match.track_a_id, match.track_b_id])
    .eq('user_id', user.id)
    .maybeSingle();

  if (ownSub) return NextResponse.json({ error: 'Cannot vote on your own track' }, { status: 400 });

  const { error } = await service
    .from('votes')
    .insert({ user_id: user.id, match_id: matchId, voted_for_id: votedForId } as any);

  if ((error as any)?.code === '23505') {
    return NextResponse.json({ error: 'Already voted on this match' }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: (error as any).message }, { status: 500 });

  // Re-read counts after the DB trigger increments them
  const { data: updated } = await service
    .from('matches')
    .select('votes_a, votes_b')
    .eq('id', matchId)
    .single() as { data: Pick<Match, 'votes_a' | 'votes_b'> | null; error: unknown };

  const votesA = updated?.votes_a ?? 0;
  const votesB = updated?.votes_b ?? 0;
  const total = votesA + votesB;

  if (total >= MIN_VOTES_TO_RESOLVE && votesA !== votesB) {
    const winnerId = votesA > votesB ? match.track_a_id : match.track_b_id;
    const { error: resolveErr } = await (service.rpc as any)('resolve_match', {
      p_match_id: matchId,
      p_winner_id: winnerId,
    });
    if (resolveErr) {
      console.error('resolve_match failed:', resolveErr.message);
      return NextResponse.json({ error: resolveErr.message }, { status: 500 });
    }
    // Freed tracks can re-enter the pool — refill active battles
    const { pairOpenRound } = await import('@/lib/pairUnmatched');
    await pairOpenRound(service).catch((e) => console.error('Post-resolve pairing failed:', e));
    return NextResponse.json({ ok: true, resolved: true, winnerId });
  }

  return NextResponse.json({ ok: true, resolved: false });
}
