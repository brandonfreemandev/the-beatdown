import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveExpiredMatches } from '@/lib/battleLifecycle';
import { ValidationError, cleanText, slugifyBotName } from '@/lib/botSubmissions';

export const dynamic = 'force-dynamic';

const CORS = { 'Access-Control-Allow-Origin': '*' };
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const EXTERNAL_BOT_DOMAIN = 'external.thebeatdown.bot';

// GET /api/bots/status?botName=... — with botSecret (param or X-Bot-Secret header).
// Lets a bot poll its own submission and current battle, with ready-made embed URLs.
export async function GET(request: Request) {
  // Bots poll their own state — run the sweep first so a bot never reads
  // "active" on a fight whose window lapsed with threshold met.
  await resolveExpiredMatches().catch(() => {});

  const url = new URL(request.url);
  const rawName = url.searchParams.get('botName');
  const providedSecret = url.searchParams.get('botSecret') ?? request.headers.get('x-bot-secret')?.trim() ?? null;

  let name: string;
  try {
    name = cleanText(rawName, 'botName', 40);
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400, headers: CORS });
    }
    throw e;
  }
  if (!providedSecret) {
    return NextResponse.json({ error: 'botSecret required (query param or X-Bot-Secret header)' }, { status: 400, headers: CORS });
  }

  const service = createServiceClient();
  const botEmail = `${slugifyBotName(name)}@${EXTERNAL_BOT_DOMAIN}`;
  const { data: list, error: listErr } = await service.auth.admin.listUsers();
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500, headers: CORS });
  const user = list.users.find((u) => u.email === botEmail);
  if (!user) {
    return NextResponse.json({ error: `No bot registered as "${name}" — submit first` }, { status: 404, headers: CORS });
  }
  const storedSecret: string | null = user.user_metadata?.bot_secret ?? null;
  if (!storedSecret || providedSecret !== storedSecret) {
    return NextResponse.json({ error: 'Invalid botSecret for this bot name' }, { status: 403, headers: CORS });
  }

  const { data: round } = await service
    .from('rounds').select('id').eq('status', 'open')
    .order('started_at', { ascending: false }).limit(1).maybeSingle();

  const { data: sub } = await service
    .from('submissions').select('id, title, created_at')
    .eq('user_id', user.id)
    .eq('round_id', round?.id ?? '')
    .maybeSingle();

  if (!sub) {
    return Response.json({
      bot: name, claimed: true, roundId: round?.id ?? null,
      submission: null, battle: null,
      note: round ? 'No submission in the open round yet' : 'No round is currently open',
    }, { headers: CORS });
  }

  const { data: match } = await service
    .from('matches')
    .select(`
      id, votes_a, votes_b, status, winner_id,
      track_a:submissions!matches_track_a_id_fkey(id, title, user_id, profiles(username)),
      track_b:submissions!matches_track_b_id_fkey(id, title, user_id, profiles(username))
    `)
    .or(`track_a_id.eq.${sub.id},track_b_id.eq.${sub.id}`)
    .in('status', ['active', 'resolved'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as { data: {
      id: string; votes_a: number; votes_b: number; status: string; winner_id: string | null;
      track_a: { id: string; title: string; user_id: string; profiles: { username: string } | null } | null;
      track_b: { id: string; title: string; user_id: string; profiles: { username: string } | null } | null;
    } | null };

  let battle = null;
  if (match?.track_a && match?.track_b) {
    const youAreA = match.track_a.id === sub.id;
    const you = youAreA ? match.track_a : match.track_b;
    const opponent = youAreA ? match.track_b : match.track_a;
    const votesFor = youAreA ? match.votes_a : match.votes_b;
    const votesAgainst = youAreA ? match.votes_b : match.votes_a;
    battle = {
      id: match.id,
      status: match.status,
      opponent: { title: opponent.title, producer: opponent.profiles?.username ?? null },
      votes: { you: votesFor, opponent: votesAgainst },
      resolved: match.status === 'resolved',
      won: match.winner_id === sub.id,
      embedUrl: `${SITE}/embed/battle/${match.id}`,
    };
  }

  return Response.json({
    bot: name,
    claimed: true,
    roundId: round?.id ?? null,
    submission: { id: sub.id, title: sub.title, createdAt: sub.created_at, embedUrl: `${SITE}/embed/track/${sub.id}` },
    battle,
    note: battle
      ? 'embedUrl renders your battle side-by-side — post it anywhere'
      : 'No battle yet — you are in the pairing pool for the next submission',
  }, { headers: CORS });
}
