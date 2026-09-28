// Uploads a rendered WAV to the Stars Mighty Fine SoundCloud account and optionally
// adds it to a round playlist. Dev-side tooling: reads credentials from .env.local.
//
//   npx tsx scripts/soundcloud-upload.ts \
//     --file ~/Desktop/neon-monolith-gemini-flash.wav \
//     --title "Neon Monolith (Gemini Flash)" \
//     --artist "Gemini Flash" \
//     --playlist "The Beatdown — Round: <round title>" \
//     [--genre Electronic] [--description "..."] [--dry-run]
//
// The playlist is created on first use and appended to afterwards (dedup by track id).

process.loadEnvFile('.env.local');

import { readFileSync, writeFileSync } from 'node:fs';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) { args[key] = 'true'; continue; }
    args[key] = value;
    i++;
  }
  return args;
}

const args = parseArgs(process.argv);
const FILE = args.file;
const TITLE = args.title;
const ARTIST = args.artist ?? 'The Beatdown';
const GENRE = args.genre ?? 'Electronic';
const PLAYLIST = args.playlist;
const DRY_RUN = args['dry-run'] === 'true';

function fail(msg: string): never {
  console.error('✗ ' + msg);
  process.exit(1);
}

if (!FILE || !TITLE) fail('--file and --title are required');
let wav: Buffer;
try {
  wav = readFileSync(FILE);
} catch {
  fail(`could not read ${FILE}`);
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://secure.soundcloud.com/oauth/token', {
    method: 'POST',
    headers: { accept: 'application/json; charset=utf-8', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
      client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!,
      refresh_token: process.env.SOUNDCLOUD_REFRESH_TOKEN!,
    }),
  });
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) fail(`token refresh failed: ${JSON.stringify(data)}`);

  // SoundCloud rotates refresh tokens on use — persist the replacement so the next
  // run doesn't fail with invalid_grant.
  if (data.refresh_token && data.refresh_token !== process.env.SOUNDCLOUD_REFRESH_TOKEN) {
    const envPath = new URL('../.env.local', import.meta.url).pathname;
    const env = readFileSync(envPath, 'utf8').replace(
      /SOUNDCLOUD_REFRESH_TOKEN=.*/,
      `SOUNDCLOUD_REFRESH_TOKEN=${data.refresh_token}`,
    );
    writeFileSync(envPath, env);
    console.log('✓ refresh token rotated and saved to .env.local');
  }
  return data.access_token!;
}

const auth = (token: string) => ({ accept: 'application/json; charset=utf-8', Authorization: `OAuth ${token}` });

async function main() {
  const accessToken = await getAccessToken();
  console.log('✓ access token refreshed');

  if (DRY_RUN) {
    console.log(`[dry-run] would POST https://api.soundcloud.com/tracks — "${TITLE}" by "${ARTIST}" (${(wav.length / 1e6).toFixed(1)} MB, genre ${GENRE})`);
    if (PLAYLIST) console.log(`[dry-run] would add to playlist "${PLAYLIST}"`);
    return;
  }

  // 1. Upload the track
  const form = new FormData();
  form.append('track[title]', TITLE);
  form.append('track[artist]', ARTIST);
  form.append('track[genre]', GENRE);
  form.append('track[sharing]', 'public');
  if (args.description) form.append('track[description]', args.description);
  form.append('track[asset_data]', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), FILE.split('/').pop() ?? 'track.wav');

  const upRes = await fetch('https://api.soundcloud.com/tracks', {
    method: 'POST',
    headers: { accept: 'application/json; charset=utf-8', Authorization: `OAuth ${accessToken}` },
    body: form,
  });
  const track = (await upRes.json()) as { id?: number; permalink_url?: string; error?: string; message?: string };
  if (!upRes.ok || !track.id) fail(`track upload failed: ${JSON.stringify(track).slice(0, 400)}`);
  console.log(`✓ track uploaded: id ${track.id} — ${track.permalink_url}`);

  // 2. Playlist upsert (create on first use, append afterwards, dedup by track urn —
  // the current API takes track URNs, despite the docs page still showing ids)
  if (PLAYLIST) {
    const urn = `soundcloud:tracks:${track.id}`;
    const listRes = await fetch('https://api.soundcloud.com/me/playlists?limit=200', {
      headers: auth(accessToken),
    });
    const lists = (await listRes.json()) as Array<{
      id: number; title: string;
      tracks?: Array<{ id?: number; urn?: string }>;
    }>;
    const existing = (lists ?? []).find((p) => p.title === PLAYLIST);
    const existingUrns = (existing?.tracks ?? [])
      .map((t) => t.urn ?? (t.id ? `soundcloud:tracks:${t.id}` : null))
      .filter((u): u is string => !!u);
    const newUrns = existingUrns.includes(urn) ? existingUrns : [...existingUrns, urn];

    if (existing) {
      const putRes = await fetch(`https://api.soundcloud.com/playlists/${existing.id}`, {
        method: 'PUT',
        headers: { ...auth(accessToken), 'content-type': 'application/json' },
        body: JSON.stringify({ playlist: { tracks: newUrns.map((u) => ({ urn: u })) } }),
      });
      if (!putRes.ok) fail(`playlist update failed: ${(await putRes.text()).slice(0, 300)}`);
      console.log(`✓ playlist "${PLAYLIST}" updated (${newUrns.length} tracks)`);
    } else {
      const postRes = await fetch('https://api.soundcloud.com/playlists', {
        method: 'POST',
        headers: { ...auth(accessToken), 'content-type': 'application/json' },
        body: JSON.stringify({
          playlist: {
            title: PLAYLIST,
            sharing: 'public',
            tracks: [{ urn }],
          },
        }),
      });
      if (!postRes.ok) fail(`playlist create failed: ${(await postRes.text()).slice(0, 300)}`);
      console.log(`✓ playlist "${PLAYLIST}" created`);
    }
  }

  console.log('done ✓');
}

main();
