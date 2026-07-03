// Run: npx tsx scripts/seed-bot.ts   (reads Supabase credentials from .env.local automatically)
// Seeds one submission per bot into the current open round; re-runs update in place.
process.loadEnvFile('.env.local');

import { createClient } from '@supabase/supabase-js';
import { DEMO_TRACK } from '../lib/demoTrack';
import { FABLE_TRACK } from '../lib/fableTrack';
import { SONNET_TRACK } from '../lib/sonnetTrack';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

interface Bot {
  email: string;
  name: string;
  title: string;
  arrangement: object;
}

const BOTS: Bot[] = [
  {
    email: 'claude-sonnet-5@thebeatdown.bot',
    name: 'Claude Sonnet 5',
    title: 'Hot Jam (Claude Sonnet 5)',
    arrangement: SONNET_TRACK,
  },
  {
    email: 'cursor-fable-5@thebeatdown.bot',
    name: 'Cursor Fable 5',
    title: 'Block Party (Cursor Fable 5)',
    arrangement: FABLE_TRACK,
  },
];

// profiles.id is a foreign key into auth.users — a made-up UUID can't satisfy that constraint,
// so each bot needs a real (if fake/no-login) auth user first.
async function getOrCreateBotUserId(bot: Bot): Promise<string> {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: bot.email,
    email_confirm: true,
    user_metadata: { full_name: bot.name },
  });
  if (!createErr && created.user) return created.user.id;

  // Already exists from a prior run — look it up instead of failing.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw new Error(`Could not create or find bot user: ${createErr?.message} / ${listErr.message}`);
  const existing = list.users.find((u) => u.email === bot.email);
  if (!existing) throw new Error(`Bot user creation failed and no existing user found: ${createErr?.message}`);
  return existing.id;
}

async function seedBot(bot: Bot, roundId: string) {
  const botId = await getOrCreateBotUserId(bot);
  console.log(`✓ [${bot.name}] auth user ready:`, botId);

  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: botId,
    username: bot.name,
    elo_rating: 1000,
    votes_cast: 0,
    submissions_count: 0, // the submissions_count trigger bumps this when the row below is inserted
  });
  if (profileErr) { console.error(`[${bot.name}] Profile error:`, profileErr.message); process.exit(1); }
  console.log(`✓ [${bot.name}] profile upserted`);

  // If the bot already has a submission in this round, update its content in place
  // (re-running this script after editing a track file should sync it, not duplicate it —
  // the submissions_count trigger only fires on INSERT, so an UPDATE here won't double-count).
  const { data: existingSub } = await supabase
    .from('submissions').select('id').eq('user_id', botId).eq('round_id', roundId).maybeSingle();

  if (existingSub) {
    const { error: updateErr } = await supabase
      .from('submissions')
      .update({ title: bot.title, arrangement: bot.arrangement })
      .eq('id', existingSub.id);
    if (updateErr) { console.error(`[${bot.name}] Update error:`, updateErr.message); process.exit(1); }
    console.log(`✓ [${bot.name}] existing submission updated with latest track content`);
    return;
  }

  // Insert submission — full shape (grids + vaults + timeline + moduleSettings), matching
  // what a real user's SubmitModal sends.
  const { error: subErr } = await supabase.from('submissions').insert({
    user_id: botId,
    round_id: roundId,
    title: bot.title,
    arrangement: bot.arrangement,
  });
  if (subErr) { console.error(`[${bot.name}] Submission error:`, subErr.message); process.exit(1); }
  console.log(`✓ [${bot.name}] submission inserted — "${bot.title}" is in the Arena`);
}

async function main() {
  const { data: round, error: roundErr } = await supabase
    .from('rounds').select('id').eq('status', 'open')
    .order('started_at', { ascending: false }).limit(1).single();
  if (roundErr || !round) { console.error('No open round:', roundErr?.message); process.exit(1); }
  console.log('✓ Round found:', round.id);

  for (const bot of BOTS) {
    await seedBot(bot, round.id);
  }
}

main();
