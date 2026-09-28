import { takeVerifier, storeTokens } from '@/lib/soundcloudOAuth';

export const dynamic = 'force-dynamic';

// Dev tooling: OAuth redirect target. Exchanges the authorization code for tokens
// (PKCE) and shows the result. The refresh token displayed here gets copied into
// .env.local as SOUNDCLOUD_REFRESH_TOKEN by the operator.

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><body style="font-family:monospace;max-width:720px;margin:60px auto;padding:0 20px;line-height:1.6">
<h2>${title}</h2>${body}</body></html>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  if (error) {
    return page('SoundCloud connect failed ✗', `<p>SoundCloud returned: <strong>${error}</strong></p><p>Close this tab and retry /api/soundcloud/authorize.</p>`);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const verifier = state ? takeVerifier(state) : null;
  if (!code || !verifier) {
    return page('SoundCloud connect failed ✗', '<p>Missing code/state, or the authorize attempt expired (10 min). Retry /api/soundcloud/authorize.</p>');
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID!;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET!;
  const redirectUri = process.env.SOUNDCLOUD_REDIRECT_URI!;

  const res = await fetch('https://secure.soundcloud.com/oauth/token', {
    method: 'POST',
    headers: {
      accept: 'application/json; charset=utf-8',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      code,
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || !data.access_token) {
    return page('Token exchange failed ✗', `<pre>${JSON.stringify(data, null, 2)}</pre>`);
  }

  storeTokens({
    access_token: String(data.access_token),
    expires_in: data.expires_in ? Number(data.expires_in) : undefined,
    refresh_token: data.refresh_token ? String(data.refresh_token) : undefined,
    scope: data.scope ? String(data.scope) : undefined,
    token_type: data.token_type ? String(data.token_type) : undefined,
    obtainedAt: new Date().toISOString(),
  });

  const tokens = (await import('@/lib/soundcloudOAuth')).getTokens()!;
  const refreshToken = tokens.refresh_token ?? '(none returned — see docs)';

  return page(
    'SoundCloud connected ✓',
    `<p>Add this line to <code>.env.local</code>:</p>
     <pre style="background:#f4f4f4;padding:12px;border:2px solid #000;overflow-x:auto">SOUNDCLOUD_REFRESH_TOKEN=${refreshToken}</pre>
     <p>Scope: <code>${tokens.scope ?? '—'}</code> · token type: <code>${tokens.token_type ?? '—'}</code> · expires in: <code>${tokens.expires_in ?? '—'}</code>s</p>`,
  );
}
