import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/ensureProfile';
import { resolveExpiredMatches, BATTLE_DEADLINE_HOURS } from '@/lib/battleLifecycle';
import { checkRateLimit, clientIp } from '@/lib/botSubmissions';
import type { Match } from '@/lib/supabase/types';

const MIN_VOTES_TO_RESOLVE = 3;
const VOTER_COOKIE = 'bd_voter';
const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

interface VoteTarget {
  matchId: string;
  trackAId: string;
  trackBId: string;
}

export async function POST(request: Request) {
  // Close time-boxed battles first so votes can't land on the undead.
  await resolveExpiredMatches().catch((e) => console.error('Expire check failed:', e));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const service = createServiceClient();

  const { matchId, votedForId } = await request.json();
  if (!matchId || !votedForId) {
    return NextResponse.json({ error: 'matchId and votedForId required' }, { status: 400 });
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

  const target: VoteTarget = { matchId, trackAId: match.track_a_id, trackBId: match.track_b_id };
  let insertError: { code?: string; message?: string } | null = null;
  let anonymousVoterKey: string | null = null;

  if (user) {
    const { error: profileErr } = await ensureProfile(service, user);
    if (profileErr) {
      console.error('Profile creation failed:', profileErr);
      return NextResponse.json({ error: 'Could not create user profile' }, { status: 500 });
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
    insertError = error as any;
  } else {
    // Anonymous path: identity is just a cookie. Best-effort IP rate limit is
    // the flood guard; the per-match unique index is the real wall.
    if (!checkRateLimit(clientIp(request))) {
      return NextResponse.json({ error: 'Too many votes — slow down' }, { status: 429 });
    }
    const existing = request.headers.get('cookie')?.match(new RegExp(`${VOTER_COOKIE}=([^;]+)`))?.[1];
    anonymousVoterKey = existing ?? crypto.randomUUID();
    const { error } = await service
      .from('votes')
      .insert({ user_id: null, voter_key: anonymousVoterKey, match_id: matchId, voted_for_id: votedForId } as any);
    insertError = error as any;
  }

  return finish(target, votedForId, insertError, anonymousVoterKey);
}

/** Re-read counts (DB trigger increments them), resolve at threshold. */
async function finish(
  target: VoteTarget,
  votedForId: string,
  insertError: { code?: string; message?: string } | null,
  anonymousVoterKey: string | null,
): Promise<NextResponse> {
  const cookie = anonymousVoterKey ? {
    name: VOTER_COOKIE,
    value: anonymousVoterKey,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: true,
    path: '/',
    maxAge: VOTER_COOKIE_MAX_AGE,
  } : undefined;

  if (insertError?.code === '23505') {
    // Already voted — return current counts so the UI can sync.
    const counts = await currentCounts(target.matchId);
    return withCookie(NextResponse.json({
      error: 'Already voted on this match', ...counts, threshold: MIN_VOTES_TO_RESOLVE,
    }, { status: 409 }), cookie);
  }
  if (insertError) {
    console.error('Vote insert failed:', insertError.message);
    return withCookie(NextResponse.json({ error: insertError.message ?? 'Vote failed' }, { status: 500 }), cookie);
  }

  const service = createServiceClient();
  const { data: updated } = await service
    .from('matches')
    .select('votes_a, votes_b')
    .eq('id', target.matchId)
    .single() as { data: { votes_a: number; votes_b: number } | null };

  const votesA = updated?.votes_a ?? 0;
  const votesB = updated?.votes_b ?? 0;
  const total = votesA + votesB;

  if (total >= MIN_VOTES_TO_RESOLVE && votesA !== votesB) {
    const winnerId = votesA > votesB ? target.trackAId : target.trackBId;
    const { error: resolveErr } = await (service.rpc as any)('resolve_match', {
      p_match_id: target.matchId,
      p_winner_id: winnerId,
    });
    if (resolveErr) {
      console.error('resolve_match failed:', resolveErr.message);
      return withCookie(NextResponse.json({ error: resolveErr.message }, { status: 500 }), cookie);
    }
    // Freed tracks can re-enter the pool — refill active battles
    const { pairOpenRound } = await import('@/lib/pairUnmatched');
    await pairOpenRound(service).catch((e) => console.error('Post-resolve pairing failed:', e));
    return withCookie(NextResponse.json({
      ok: true, resolved: true, winnerId, votesA, votesB, threshold: MIN_VOTES_TO_RESOLVE,
    }), cookie);
  }

  return withCookie(NextResponse.json({
    ok: true, resolved: false, votesA, votesB, threshold: MIN_VOTES_TO_RESOLVE, deadlineHours: BATTLE_DEADLINE_HOURS,
  }), cookie);
}

async function currentCounts(matchId: string): Promise<{ votesA: number; votesB: number }> {
  const service = createServiceClient();
  const { data } = await service
    .from('matches')
    .select('votes_a, votes_b')
    .eq('id', matchId)
    .single() as { data: { votes_a: number; votes_b: number } | null };
  return { votesA: data?.votes_a ?? 0, votesB: data?.votes_b ?? 0 };
}

function withCookie(res: NextResponse, cookie?: { name: string; value: string; httpOnly: boolean; sameSite: 'lax'; secure: boolean; path: string; maxAge: number }): NextResponse {
  if (cookie) res.cookies.set(cookie);
  return res;
}
