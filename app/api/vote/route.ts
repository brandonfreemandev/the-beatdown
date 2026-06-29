import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
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

  const service = await createServiceClient();

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

  // Check updated vote counts and auto-resolve if threshold reached
  const newVotesA = match.votes_a + (votedForId === match.track_a_id ? 1 : 0);
  const newVotesB = match.votes_b + (votedForId === match.track_b_id ? 1 : 0);
  const total = newVotesA + newVotesB;

  if (total >= MIN_VOTES_TO_RESOLVE && newVotesA !== newVotesB) {
    const winnerId = newVotesA > newVotesB ? match.track_a_id : match.track_b_id;
    await service.rpc('resolve_match', { p_match_id: matchId, p_winner_id: winnerId });
    return NextResponse.json({ ok: true, resolved: true, winnerId });
  }

  return NextResponse.json({ ok: true, resolved: false });
}
