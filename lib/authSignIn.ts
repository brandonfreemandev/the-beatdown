import type { SupabaseClient } from '@supabase/supabase-js';
import { authCallbackUrl } from './siteUrl';

/** Returns an error message if public Supabase env vars look wrong in this build. */
export function validateSupabasePublicConfig(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) {
    return 'Supabase is not configured in this build. Fix .env.local, then run npm run deploy again.';
  }
  if (url.includes('.supabase.com')) {
    return 'NEXT_PUBLIC_SUPABASE_URL uses .com — it must be .supabase.co (from Supabase → Settings → API).';
  }
  if (!url.includes('.supabase.co')) {
    return 'NEXT_PUBLIC_SUPABASE_URL does not look like a Supabase project URL.';
  }
  return null;
}

/** Start Google OAuth. Returns null on success (browser navigates away), or an error message. */
export async function signInWithGoogle(supabase: SupabaseClient): Promise<string | null> {
  const configError = validateSupabasePublicConfig();
  if (configError) return configError;

  const redirectTo = authCallbackUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { prompt: 'select_account' },
      skipBrowserRedirect: true,
    },
  });

  if (error) return error.message;
  if (!data.url) return 'OAuth did not return a redirect URL.';

  window.location.assign(data.url);
  return null;
}
