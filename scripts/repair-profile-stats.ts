// Run: npx tsx scripts/repair-profile-stats.ts
// Syncs submissions_count and votes_cast from source tables (fixes bot re-seed resets).
process.loadEnvFile('.env.local');

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const [{ data: profiles }, { data: submissions }, { data: votes }] = await Promise.all([
    supabase.from('profiles').select('id, username, submissions_count, votes_cast'),
    supabase.from('submissions').select('user_id'),
    supabase.from('votes').select('user_id'),
  ]);

  const subCounts = new Map<string, number>();
  for (const s of submissions ?? []) {
    subCounts.set(s.user_id, (subCounts.get(s.user_id) ?? 0) + 1);
  }
  const voteCounts = new Map<string, number>();
  for (const v of votes ?? []) {
    voteCounts.set(v.user_id, (voteCounts.get(v.user_id) ?? 0) + 1);
  }

  for (const p of profiles ?? []) {
    const subs = subCounts.get(p.id) ?? 0;
    const cast = voteCounts.get(p.id) ?? 0;
    if (subs === p.submissions_count && cast === p.votes_cast) continue;
    await supabase.from('profiles').update({ submissions_count: subs, votes_cast: cast }).eq('id', p.id);
    console.log(`✓ ${p.username}: submissions ${p.submissions_count}→${subs}, votes_cast ${p.votes_cast}→${cast}`);
  }
  console.log('Done.');
}

main();
