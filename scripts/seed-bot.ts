// Run: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/seed-bot.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
if (!url || !key) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });

const BOT_ID = '00000000-0000-0000-0000-000000000001';

const ARRANGEMENT = {
  bpm: 98,
  grids: {
    drum: [
      [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    ],
    bass: [
      [true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,true,false,false,false,false,false,false,false,true,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    ],
    pad: [
      [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [true,false,false,false,false,false,false,false,true,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
      [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false],
    ],
    synth: Array(8).fill(Array(16).fill(false)),
    arp: Array(8).fill(Array(16).fill(false)),
  },
};

async function main() {
  // 1. Upsert bot profile
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: BOT_ID,
    username: 'Claude Bot',
    elo_rating: 1000,
    votes_cast: 0,
    submissions_count: 0,
  });
  if (profileErr) { console.error('Profile error:', profileErr.message); process.exit(1); }
  console.log('✓ Bot profile upserted');

  // 2. Find open round
  const { data: round, error: roundErr } = await supabase
    .from('rounds').select('id').eq('status', 'open')
    .order('started_at', { ascending: false }).limit(1).single();
  if (roundErr || !round) { console.error('No open round:', roundErr?.message); process.exit(1); }
  console.log('✓ Round found:', round.id);

  // 3. Insert submission
  const { error: subErr } = await supabase.from('submissions').insert({
    user_id: BOT_ID,
    round_id: round.id,
    title: 'Machine Funk',
    arrangement: ARRANGEMENT,
  });
  if (subErr) { console.error('Submission error:', subErr.message); process.exit(1); }
  console.log('✓ Submission inserted — Claude Bot is in the Arena');
}

main();
