import { NextResponse } from 'next/server';
import { makePkcePair, stashVerifier } from '@/lib/soundcloudOAuth';

export const dynamic = 'force-dynamic';

// Dev tooling: kicks off the SoundCloud OAuth (authorization code + PKCE) flow.
// Visit http://localhost:3000/api/soundcloud/authorize while logged into SoundCloud.
export async function GET() {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const redirectUri = process.env.SOUNDCLOUD_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return new Response('Missing SOUNDCLOUD_CLIENT_ID / SOUNDCLOUD_REDIRECT_URI in env', { status: 500 });
  }

  const { verifier, challenge, state } = await makePkcePair();
  stashVerifier(state, verifier);

  const url = new URL('https://secure.soundcloud.com/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
}
