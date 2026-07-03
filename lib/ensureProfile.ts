import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

/** OAuth signups can land in auth.users before the DB trigger creates a profiles row. */
export async function ensureProfile(
  service: SupabaseClient<Database>,
  user: User,
): Promise<{ error: string | null }> {
  const baseName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'Anonymous';

  let username = baseName;
  const { data: nameCollision } = await service
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle();

  if (nameCollision) {
    const tag = user.email?.split('@')[0] ?? user.id.slice(0, 8);
    username = `${baseName} (${tag})`;
  }

  const { error } = await service.from('profiles').upsert(
    { id: user.id, username },
    { onConflict: 'id', ignoreDuplicates: true },
  );

  if (!error) return { error: null };
  // Race: another request created the row between our check and insert
  if (error.code === '23505') return { error: null };

  return { error: error.message };
}
