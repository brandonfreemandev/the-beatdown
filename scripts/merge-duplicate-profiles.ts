// Run: npx tsx scripts/merge-duplicate-profiles.ts --keep <uuid> --remove <uuid>
// Moves submissions/votes from duplicate profile into primary, then deletes duplicate row.
process.loadEnvFile('.env.local');

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);
const keepIdx = args.indexOf('--keep');
const removeIdx = args.indexOf('--remove');
const keepId = keepIdx >= 0 ? args[keepIdx + 1] : null;
const removeId = removeIdx >= 0 ? args[removeIdx + 1] : null;

if (!keepId || !removeId) {
  console.error('Usage: npx tsx scripts/merge-duplicate-profiles.ts --keep <uuid> --remove <uuid>');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const [{ data: keep }, { data: remove }] = await Promise.all([
    supabase.from('profiles').select('id, username').eq('id', keepId).maybeSingle(),
    supabase.from('profiles').select('id, username').eq('id', removeId).maybeSingle(),
  ]);

  if (!keep || !remove) {
    console.error('Both profiles must exist.');
    process.exit(1);
  }

  console.log(`Merging "${remove.username}" (${removeId}) → "${keep.username}" (${keepId})`);

  const { data: subs } = await supabase.from('submissions').select('id').eq('user_id', removeId);
  for (const s of subs ?? []) {
    await supabase.from('submissions').update({ user_id: keepId }).eq('id', s.id);
    console.log(`  moved submission ${s.id}`);
  }

  const { data: votes } = await supabase.from('votes').select('id').eq('user_id', removeId);
  for (const v of votes ?? []) {
    await supabase.from('votes').update({ user_id: keepId }).eq('id', v.id);
    console.log(`  moved vote ${v.id}`);
  }

  await supabase.from('profiles').delete().eq('id', removeId);
  console.log(`✓ Deleted duplicate profile ${removeId}`);
  console.log('Run: npx tsx scripts/repair-profile-stats.ts');
}

main();
