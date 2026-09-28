// Shared state for the local SoundCloud OAuth flow (dev tooling only — the callback
// redirect URI is http://localhost:3000/api/soundcloud/callback, so this never runs
// on the deployed Worker). Module-global maps are fine: next dev is a single process.

const pendingVerifiers = new Map<string, { verifier: string; expires: number }>();

export function stashVerifier(state: string, verifier: string): void {
  // One-flight: replace any previous pending attempt
  pendingVerifiers.clear();
  pendingVerifiers.set(state, { verifier, expires: Date.now() + 10 * 60_000 });
}

export function takeVerifier(state: string): string | null {
  const entry = pendingVerifiers.get(state);
  if (!entry) return null;
  pendingVerifiers.delete(state);
  if (Date.now() > entry.expires) return null;
  return entry.verifier;
}

export interface SoundCloudTokens {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  obtainedAt: string;
}

let latestTokens: SoundCloudTokens | null = null;

export function storeTokens(tokens: SoundCloudTokens): void {
  latestTokens = { ...tokens, obtainedAt: new Date().toISOString() };
}

export function getTokens(): SoundCloudTokens | null {
  return latestTokens;
}

export function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export async function makePkcePair(): Promise<{ verifier: string; challenge: string; state: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = b64url(new Uint8Array(digest));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  return { verifier, challenge, state };
}
