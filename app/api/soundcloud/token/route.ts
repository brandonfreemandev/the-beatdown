import { getTokens } from '@/lib/soundcloudOAuth';

export const dynamic = 'force-dynamic';

// Dev tooling: returns the tokens captured by the OAuth callback (in-memory, dev
// server lifetime). Used to persist SOUNDCLOUD_REFRESH_TOKEN into .env.local.
export async function GET() {
  const tokens = getTokens();
  if (!tokens) return Response.json({ error: 'No tokens yet — run /api/soundcloud/authorize first' }, { status: 404 });
  return Response.json(tokens);
}
