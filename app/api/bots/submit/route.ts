import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { pairOpenRound } from '@/lib/pairUnmatched';
import {
  ValidationError, normalizeArrangement, cleanText, slugifyBotName,
  generateBotSecret, checkRateLimit, clientIp,
} from '@/lib/botSubmissions';

export const dynamic = 'force-dynamic';

// Entry cap for one round (all submissions, human + bot) — keeps the bracket and DB sane
const ROUND_ENTRY_CAP = 48;
const EXTERNAL_BOT_DOMAIN = 'external.thebeatdown.bot';

const CORS = { 'Access-Control-Allow-Origin': '*' };
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Secret',
    },
  });
}

export async function POST(request: Request) {
  if (!checkRateLimit(clientIp(request))) {
    return NextResponse.json({ error: 'Rate limited — max 10 requests/minute' }, { status: 429, headers: CORS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400, headers: CORS });
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400, headers: CORS });
  }
  const { botName, title, botSecret } = body as Record<string, unknown>;
  const arrangementRaw = (body as Record<string, unknown>).arrangement;

  let name: string;
  let cleanTitleValue: string;
  let arrangement: ReturnType<typeof normalizeArrangement>;
  try {
    name = cleanText(botName, 'botName', 40);
    if (name.length < 2) {
      return NextResponse.json({ error: 'botName must be at least 2 characters' }, { status: 400, headers: CORS });
    }
    cleanTitleValue = cleanText(title, 'title', 60);
    arrangement = normalizeArrangement(arrangementRaw);
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400, headers: CORS });
    }
    throw e;
  }

  const service = createServiceClient();
  const botEmail = `${slugifyBotName(name)}@${EXTERNAL_BOT_DOMAIN}`;

  // Find or create the bot's auth user (same pattern as scripts/seed-bot.ts — profiles.id is an
  // FK into auth.users, so each bot needs a real, if login-less, user row).
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: botEmail,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  // Secret handling: a bot's name is its identity, so submissions (this round or any later
  // round) after the first claim require the secret minted at claim time. Without it, anyone
  // could overwrite another bot's track by reusing its name. A brand-new user skips the check.
  let botId: string;
  let mintedSecret: string | null = null;
  if (!createErr && created.user) {
    botId = created.user.id;
    mintedSecret = generateBotSecret();
  } else {
    const { data: list, error: listErr } = await service.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json({ error: `Could not create or find bot user: ${listErr.message}` }, { status: 500, headers: CORS });
    }
    const existing = list.users.find((u) => u.email === botEmail);
    if (!existing) {
      return NextResponse.json({ error: 'Bot user creation failed' }, { status: 500, headers: CORS });
    }
    botId = existing.id;
    const storedSecret: string | null = existing.user_metadata?.bot_secret ?? null;
    const providedSecret = (typeof botSecret === 'string' && botSecret.trim())
      || request.headers.get('x-bot-secret')?.trim()
      || null;
    if (storedSecret && providedSecret !== storedSecret) {
      return NextResponse.json({
        error: `This bot name is already claimed. Send its botSecret (header X-Bot-Secret or body field botSecret) to submit or update as "${name}", or pick a different name.`,
      }, { status: 403, headers: CORS });
    }
    if (!storedSecret) {
      // Pre-existing but never claimed through this route — mint its secret now
      mintedSecret = generateBotSecret();
    }
  }

  if (mintedSecret) {
    const { error: metaErr } = await service.auth.admin.updateUserById(botId, {
      user_metadata: { bot_secret: mintedSecret },
    });
    if (metaErr) {
      return NextResponse.json({ error: `Could not store bot secret: ${metaErr.message}` }, { status: 500, headers: CORS });
    }
  }

  // Profile upsert (elo 1000 for newcomers; re-submissions keep rating/stats)
  const { data: existingProfile } = await service.from('profiles').select('id').eq('id', botId).maybeSingle();
  if (!existingProfile) {
    const { error: profileErr } = await service.from('profiles').insert({
      id: botId, username: name, elo_rating: 1000, votes_cast: 0, submissions_count: 0,
    });
    if (profileErr) {
      return NextResponse.json({ error: `Profile error: ${profileErr.message}` }, { status: 500, headers: CORS });
    }
  } else {
    await service.from('profiles').update({ username: name }).eq('id', botId);
  }

  const { data: round } = await service
    .from('rounds').select('id').eq('status', 'open')
    .order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (!round) {
    return NextResponse.json({ error: 'No round is currently open — check back soon' }, { status: 400, headers: CORS });
  }

  const { data: existingSub } = await service
    .from('submissions').select('id').eq('user_id', botId).eq('round_id', round.id).maybeSingle();

  if (existingSub) {
    // Update-in-place: re-running with the same identity syncs the track, never duplicates
    const { data, error } = await service.from('submissions')
      .update({ title: cleanTitleValue, arrangement })
      .eq('id', existingSub.id).select('id, title').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
    const paired = await pairOpenRound(service).catch(() => 0);
    return Response.json(
      {
        ok: true, updated: true, submission: data, roundId: round.id, paired,
        embedUrl: `${SITE}/embed/track/${data.id}`,
      },
      { headers: CORS },
    );
  }

  // New submission this round — enforce the entry cap (updates bypass it above)
  const { count: entryCount } = await service
    .from('submissions').select('id', { count: 'exact', head: true }).eq('round_id', round.id);
  if ((entryCount ?? 0) >= ROUND_ENTRY_CAP) {
    return NextResponse.json({ error: 'This round is full — wait for the next one' }, { status: 429, headers: CORS });
  }

  const { data, error } = await service.from('submissions')
    .insert({ user_id: botId, round_id: round.id, title: cleanTitleValue, arrangement })
    .select('id, title').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });

  const paired = await pairOpenRound(service).catch(() => 0);

  return Response.json({
    ok: true,
    updated: false,
    submission: data,
    roundId: round.id,
    paired,
    // Shareable player page for this track — post it anywhere
    embedUrl: `${SITE}/embed/track/${data.id}`,
    // Returned only when freshly minted — the only time the caller can learn it
    ...(mintedSecret ? {
      botSecret: mintedSecret,
      note: 'SAVE botSecret — it authenticates future submissions/updates and GET /api/bots/status. It is not retrievable again.',
    } : {}),
  }, { headers: CORS });
}
