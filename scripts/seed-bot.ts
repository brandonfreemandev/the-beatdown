// Run: npx tsx scripts/seed-bot.ts   (reads Supabase credentials from .env.local automatically)
process.loadEnvFile('.env.local');

import { createClient } from '@supabase/supabase-js';
import { DEMO_TRACK } from '../lib/demoTrack';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const BOT_EMAIL = 'claude-sonnet-5@thebeatdown.bot';

// profiles.id is a foreign key into auth.users — a made-up UUID can't satisfy that constraint,
// so the bot needs a real (if fake/no-login) auth user first.
async function getOrCreateBotUserId(): Promise<string> {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: BOT_EMAIL,
    email_confirm: true,
    user_metadata: { full_name: 'Claude Sonnet 5' },
  });
  if (!createErr && created.user) return created.user.id;

  // Already exists from a prior run — look it up instead of failing.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw new Error(`Could not create or find bot user: ${createErr?.message} / ${listErr.message}`);
  const existing = list.users.find((u) => u.email === BOT_EMAIL);
  if (!existing) throw new Error(`Bot user creation failed and no existing user found: ${createErr?.message}`);
  return existing.id;
}

async function main() {
  const botId = await getOrCreateBotUserId();
  console.log('✓ Bot auth user ready:', botId);

  // 1. Upsert bot profile
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: botId,
    username: 'Claude Sonnet 5',
    elo_rating: 1000,
    votes_cast: 0,
    submissions_count: 0, // the submissions_count trigger bumps this when the row below is inserted
  });
  if (profileErr) { console.error('Profile error:', profileErr.message); process.exit(1); }
  console.log('✓ Bot profile upserted');

  // 2. Find open round
  const { data: round, error: roundErr } = await supabase
    .from('rounds').select('id').eq('status', 'open')
    .order('started_at', { ascending: false }).limit(1).single();
  if (roundErr || !round) { console.error('No open round:', roundErr?.message); process.exit(1); }
  console.log('✓ Round found:', round.id);

  // If the bot already has a submission in this round, update its content in place
  // (re-running this script after editing demoTrack.ts should sync it, not duplicate it —
  // the submissions_count trigger only fires on INSERT, so an UPDATE here won't double-count).
  const { data: existingSub } = await supabase
    .from('submissions').select('id').eq('user_id', botId).eq('round_id', round.id).maybeSingle();

  if (existingSub) {
    const { error: updateErr } = await supabase
      .from('submissions')
      .update({ title: 'Hot Jam (Claude Sonnet 5)', arrangement: DEMO_TRACK })
      .eq('id', existingSub.id);
    if (updateErr) { console.error('Update error:', updateErr.message); process.exit(1); }
    console.log('✓ Existing submission updated with latest demo track content');
    return;
  }

  // 3. Insert submission — full shape (grids + vaults + timeline + moduleSettings), matching
  // what a real user's SubmitModal sends. The old version of this script only sent {bpm, grids}.
  const { error: subErr } = await supabase.from('submissions').insert({
    user_id: botId,
    round_id: round.id,
    title: 'Hot Jam (Claude Sonnet 5)',
    arrangement: DEMO_TRACK,
  });
  if (subErr) { console.error('Submission error:', subErr.message); process.exit(1); }
  console.log('✓ Submission inserted — Claude Sonnet 5 is in the Arena');
}

main();
