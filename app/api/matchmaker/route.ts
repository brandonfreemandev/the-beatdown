import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildPairHistory, greedyPair, MAX_CONCURRENT_BATTLES } from '@/lib/pairUnmatched';
import type { Match, Profile, Submission } from '@/lib/supabase/types';

export async function POST() {
  const service = createServiceClient();

  const { data: round } = await service
    .from('rounds')
    .select('id, entry_count')
    .eq('status', 'open')
    .order('started_at', { ascending: false })
    .limit(1)
    .single() as { data: { id: string; entry_count: number } | null; error: unknown };

  if (!round) return NextResponse.json({ error: 'No open round' }, { status: 400 });

  const { data: matched } = await service
    .from('matches')
    .select('track_a_id, track_b_id')
    .eq('round_id', round.id)
    .eq('status', 'active') as { data: Pick<Match, 'track_a_id' | 'track_b_id'>[] | null; error: unknown };

  // Council spec: one live battle site-wide — refuse to fan out at the cap.
  if ((matched ?? []).length >= MAX_CONCURRENT_BATTLES) {
    return NextResponse.json({ message: 'Match cap reached — resolve a battle first', pairs: [] });
  }

  // Rematch history across all rounds — prefer fresh match-ups when possible.
  const { data: pastMatches } = await service
    .from('matches')
    .select('track_a_id, track_b_id') as { data: Pick<Match, 'track_a_id' | 'track_b_id'>[] | null; error: unknown };
  const pairHistory = buildPairHistory(pastMatches ?? []);

  const matchedIds = new Set(
    (matched ?? []).flatMap((m) => [m.track_a_id, m.track_b_id])
  );

  const { data: subs } = await service
    .from('submissions')
    .select('id, title, user_id, arrangement')
    .eq('round_id', round.id) as { data: Pick<Submission, 'id' | 'title' | 'user_id' | 'arrangement'>[] | null; error: unknown };

  const unmatched = (subs ?? []).filter((s) => !matchedIds.has(s.id));
  if (unmatched.length < 2) {
    return NextResponse.json({ message: 'Not enough unmatched submissions', pairs: [] });
  }

  const userIds = [...new Set(unmatched.map((s) => s.user_id))];
  const { data: profiles } = await service
    .from('profiles')
    .select('id, elo_rating')
    .in('id', userIds) as { data: Pick<Profile, 'id' | 'elo_rating'>[] | null; error: unknown };

  const eloMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.elo_rating]));

  let pairs: Array<[string, string]> = [];
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const subSummaries = unmatched.map((s) => ({
      id: s.id,
      title: s.title,
      elo: eloMap[s.user_id] ?? 1000,
      bpm: (s.arrangement as any)?.bpm ?? 120,
    }));

    const prompt = `You are the matchmaker for The Beatdown, a competitive music sequencer.
Create fair 1-vs-1 pairings. Prefer similar ELO ratings, and prefer pairing agents with LOWER battlesFought so rematches happen only when unavoidable.
Return ONLY a JSON array of pairs: [["id1","id2"],["id3","id4"]]
Each ID appears in at most one pair. Odd submissions are left unpaired.

Submissions:
${JSON.stringify(subSummaries, null, 2)}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) pairs = JSON.parse(jsonMatch[0]);
  } catch {
    // Rematch-aware ELO fallback (same logic as pairUnmatched)
    const sorted = [...unmatched].sort(
      (a, b) => (eloMap[a.user_id] ?? 1000) - (eloMap[b.user_id] ?? 1000)
    );
    pairs.push(...greedyPair(
      sorted.map((s) => ({ id: s.id, elo: eloMap[s.user_id] ?? 1000 })),
      pairHistory,
    ));
  }

  const created: Match[] = [];
  for (const [aId, bId] of pairs) {
    const { data, error } = await service
      .from('matches')
      .insert({ round_id: round.id, track_a_id: aId, track_b_id: bId } as any)
      .select()
      .single() as { data: Match | null; error: unknown };
    if (!error && data) created.push(data);
  }

  return NextResponse.json({ pairs: created.length, matches: created });
}
