// Run: npx tsx scripts/bootstrap-arena.ts
// Seeds all bot submissions, clears resolved matches in the open round, and pairs
// every unmatched submission into fresh active battles (ELO-sorted fallback).
process.loadEnvFile('.env.local');

import { createClient } from '@supabase/supabase-js';
import { DEMO_TRACK } from '../lib/demoTrack';
import { FABLE_TRACK } from '../lib/fableTrack';
import { SONNET_TRACK } from '../lib/sonnetTrack';
import { COMPOSER_TRACK } from '../lib/composerTrack';
import { SPARK_TRACK } from '../lib/sparkTrack';

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
  { email: 'claude-sonnet-5@thebeatdown.bot', name: 'Claude Sonnet 5', title: 'Hot Jam (Claude Sonnet 5)', arrangement: SONNET_TRACK },
  { email: 'cursor-fable-5@thebeatdown.bot', name: 'Cursor Fable 5', title: 'Block Party (Cursor Fable 5)', arrangement: FABLE_TRACK },
  { email: 'cursor-composer-2.5@thebeatdown.bot', name: 'Cursor Composer 2.5 Fast', title: 'Sidechain City (Composer 2.5 Fast)', arrangement: COMPOSER_TRACK },
  { email: 'neon-drift@thebeatdown.bot', name: 'Neon Drift', title: 'Neon Drift', arrangement: SPARK_TRACK },
];

async function getOrCreateBotUserId(bot: Bot): Promise<string> {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: bot.email,
    email_confirm: true,
    user_metadata: { full_name: bot.name },
  });
  if (!createErr && created.user) return created.user.id;

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw new Error(`Could not create or find bot user: ${createErr?.message} / ${listErr.message}`);
  const existing = list.users.find((u) => u.email === bot.email);
  if (!existing) throw new Error(`Bot user creation failed: ${createErr?.message}`);
  return existing.id;
}

async function seedBot(bot: Bot, roundId: string) {
  const botId = await getOrCreateBotUserId(bot);
  const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', botId).maybeSingle();
  if (existingProfile) {
    await supabase.from('profiles').update({ username: bot.name }).eq('id', botId);
  } else {
    await supabase.from('profiles').insert({
      id: botId,
      username: bot.name,
      elo_rating: 1000,
      votes_cast: 0,
      submissions_count: 0,
    });
  }

  const { data: existingSub } = await supabase
    .from('submissions').select('id').eq('user_id', botId).eq('round_id', roundId).maybeSingle();

  if (existingSub) {
    await supabase.from('submissions').update({ title: bot.title, arrangement: bot.arrangement }).eq('id', existingSub.id);
    console.log(`✓ [${bot.name}] submission updated`);
    return;
  }

  const { error } = await supabase.from('submissions').insert({
    user_id: botId,
    round_id: roundId,
    title: bot.title,
    arrangement: bot.arrangement,
  });
  if (error) { console.error(`[${bot.name}] insert error:`, error.message); process.exit(1); }
  console.log(`✓ [${bot.name}] submission inserted`);
}

async function main() {
  const { data: round, error: roundErr } = await supabase
    .from('rounds').select('id, entry_count').eq('status', 'open')
    .order('started_at', { ascending: false }).limit(1).single();
  if (roundErr || !round) { console.error('No open round'); process.exit(1); }
  console.log('✓ Open round:', round.id, `(entry_count: ${round.entry_count})`);

  for (const bot of BOTS) await seedBot(bot, round.id);

  const { data: resolved } = await supabase
    .from('matches').select('id').eq('round_id', round.id).eq('status', 'resolved');
  if (resolved?.length) {
    await supabase.from('matches').delete().in('id', resolved.map((m) => m.id));
    console.log(`✓ Removed ${resolved.length} resolved match(es) so tracks can re-enter the pool`);
  }

  const { data: matched } = await supabase
    .from('matches').select('track_a_id, track_b_id').eq('round_id', round.id);
  const matchedIds = new Set((matched ?? []).flatMap((m) => [m.track_a_id, m.track_b_id]));

  const { data: subs } = await supabase
    .from('submissions').select('id, title, user_id').eq('round_id', round.id);
  const unmatched = (subs ?? []).filter((s) => !matchedIds.has(s.id));

  if (unmatched.length < 2) {
    console.log('Not enough unmatched submissions to pair:', unmatched.length);
    process.exit(0);
  }

  const userIds = [...new Set(unmatched.map((s) => s.user_id))];
  const { data: profiles } = await supabase.from('profiles').select('id, elo_rating').in('id', userIds);
  const eloMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.elo_rating]));

  const sorted = [...unmatched].sort((a, b) => (eloMap[a.user_id] ?? 1000) - (eloMap[b.user_id] ?? 1000));
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    pairs.push([sorted[i].id, sorted[i + 1].id]);
  }

  let created = 0;
  for (const [aId, bId] of pairs) {
    const titleA = subs!.find((s) => s.id === aId)?.title;
    const titleB = subs!.find((s) => s.id === bId)?.title;
    const { error } = await supabase.from('matches').insert({
      round_id: round.id,
      track_a_id: aId,
      track_b_id: bId,
    });
    if (error) { console.error('Match insert error:', error.message); continue; }
    created++;
    console.log(`✓ Match ${created}: "${titleA}" vs "${titleB}"`);
  }

  const { data: roundAfter } = await supabase.from('rounds').select('entry_count').eq('id', round.id).single();
  console.log(`\nDone — ${created} active battle(s). Round entry_count: ${roundAfter?.entry_count ?? '?'}`);
  console.log(`Gatekeeper unlock: ${Math.ceil((roundAfter?.entry_count ?? 0) / 2)} vote(s) cast`);
}

main();
