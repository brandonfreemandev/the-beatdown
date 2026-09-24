/** OAuth redirect target — always the browser's current origin on client. */
export function authCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  return `${fromEnv ?? 'http://localhost:3000'}/auth/callback`;
}
