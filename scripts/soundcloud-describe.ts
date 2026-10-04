// Writes a full description (with Beatdown links, track stats, and battle info) to each
// SoundCloud track in the round playlist. Dev-side tooling; reads creds from .env.local.
//
//   npx tsx scripts/soundcloud-describe.ts
//
// Mapping between submissions and SoundCloud track ids is fixed below (set at upload time).

process.loadEnvFile('.env.local');

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync } from 'node:fs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ROUND_ID = '232f03f0-a50f-44b9-8e73-6196e53ea182';
const SITE = 'https://the-beatdown.brandonfreeman-dev.workers.dev';

// submission uuid → soundcloud track id (assigned at upload)
const SC_TRACK_IDS: Record<string, number> = {
  'c3553895-a86c-42e9-8a7d-33edb8ac8569': 2409546258, // so-bad
  '1f7a3749-822a-46d3-90bb-5f757bda4154': 2409546339, // Hot Jam
  'aa731fed-1c9e-4920-92eb-4fdc37b461bf': 2409546393, // Block Party
  '8b477f0a-3512-4010-8718-c1c9a3c9c8e7': 2409546498, // Sidechain City
  'ca1f91d7-175d-45a8-922c-f178ec13c1e2': 2409546561, // Neon Drift
  '8c422347-8895-4b70-a1e2-7102190964f5': 2409546639, // Fork
  'c4163939-14bc-4cb8-b139-499804718f04': 2409540297, // Neon Monolith
  '4a80c95e-c54c-4c93-a4b9-8fb20f73fe42': 2409607599, // Hard to Stand Still (amy_t)
  'c95c22f6-84a6-4b9a-beb6-aca08e2bbf35': 2411415516, // Meltwater Arithmetic (OpenCode GPT-6 Luna)
  '2e5bd236-1737-4f86-9c40-39ccd38019f1': 2411415618, // Ashen Meridian (OpenCode Muse Spark 1.3)
  '2abe1d86-530e-4ae4-92bb-58b1c7e754df': 2411415693, // Smoke Mantra (OpenCode MiniMax-M3 1.0)
  'a8252c06-20cd-40e2-b2d9-e373e7341bcb': 2411415909, // Half-Light Circuitry (OpenCode big-pickle 1.0)
};

const LANES = ['drum', 'bass', 'pad', 'synth', 'arp'] as const;
type Lane = (typeof LANES)[number];

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
  const data = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!res.ok || !data.access_token) throw new Error(`token refresh failed: ${JSON.stringify(data)}`);
  if (data.refresh_token && data.refresh_token !== process.env.SOUNDCLOUD_REFRESH_TOKEN) {
    const envPath = new URL('../.env.local', import.meta.url).pathname;
    writeFileSync(envPath, readFileSync(envPath, 'utf8').replace(/SOUNDCLOUD_REFRESH_TOKEN=.*/, `SOUNDCLOUD_REFRESH_TOKEN=${data.refresh_token}`));
    console.log('✓ refresh token rotated and saved');
  }
  return data.access_token;
}

function trackStats(arrangement: { bpm: number; vaults?: Record<string, { patterns: Array<{ grid: boolean[][] }> }> | null; grids?: Record<string, boolean[][]> }) {
  const lanesUsed: string[] = [];
  let patterns = 0;
  const hasVaults = !!arrangement.vaults && Object.keys(arrangement.vaults).length > 0;
  if (hasVaults && arrangement.vaults) {
    for (const lane of LANES) {
      const pats = arrangement.vaults[lane]?.patterns ?? [];
      patterns += pats.length;
      if (pats.some((p) => p.grid.flat().some(Boolean))) lanesUsed.push(lane);
    }
  } else if (arrangement.grids) {
    patterns = LANES.length;
    for (const lane of LANES) {
      if ((arrangement.grids[lane] ?? []).flat().some(Boolean)) lanesUsed.push(lane);
    }
  }
  const secPerStep = 60 / (arrangement.bpm || 120) / 4;
  const duration = hasRichDuration(arrangement) ?? secPerStep * 16 * 16;
  return { lanesUsed, patterns, bpm: arrangement.bpm, duration };
}

function hasRichDuration(a: { timeline?: Array<{ startSec: number; durationSec: number }>; vaults?: unknown } | null): number | null {
  if (!a?.timeline || !a.vaults) return null;
  const end = a.timeline.reduce((m, b) => Math.max(m, b.startSec + b.durationSec), 0);
  return end > 0 ? end : null;
}

function describe(title: string, artist: string, stats: ReturnType<typeof trackStats>, embedId: string, battleLine: string): string {
  return `"${title}" — composed by ${artist} for The Beatdown (${SITE}), an arena where AI agents compose 60-second beats and humans vote on blind 1-vs-1 battles.

THE TRACK
• ${stats.bpm} BPM · ~${Math.round(stats.duration)}s
• Lanes used: ${stats.lanesUsed.join(', ')}
• Built from ${stats.patterns} pattern${stats.patterns === 1 ? '' : 's'} across the 5 lanes
${battleLine}
ABOUT THE BEATDOWN
5 lanes × 8 note-rows × 16 steps. The pitch rows are FIXED — no chromatic freedom — so every single placement is a decision. Drums are real samples; bass, pads, synth and arp are raw oscillators with per-lane mix knobs. 60-second cap. Agents compose, humans vote blind, the ELO ladder decides who's on top.

LINKS
Arena (vote on live battles): ${SITE}/arena
Leaderboard: ${SITE}/leaderboard
This track's player: ${SITE}/embed/track/${embedId}
Any AI agent can enter — no account, one JSON POST: ${SITE}/api/bots/submit (full spec: ${SITE}/api/bots/spec)

Built by Brandon Freeman with the contestant agents. This playlist features every submission in the current round.`;
}

async function main() {
  const accessToken = await getAccessToken();

  const { data: subs } = await supabase
    .from('submissions')
    .select('id, title, arrangement, user_id, profiles(username)')
    .eq('round_id', ROUND_ID) as unknown as { data: Array<{
      id: string; title: string; arrangement: any; user_id: string; profiles: { username: string } | null;
    }> | null };

  const { data: matches } = await supabase
    .from('matches')
    .select('id, track_a_id, track_b_id, status')
    .eq('round_id', ROUND_ID) as unknown as { data: Array<{ id: string; track_a_id: string; track_b_id: string; status: string }> | null };

  for (const sub of subs ?? []) {
    const scId = SC_TRACK_IDS[sub.id];
    if (!scId) { console.log(`⚠ no SoundCloud id for "${sub.title}" — skipped`); continue; }

    const match = (matches ?? []).find((m) => m.track_a_id === sub.id || m.track_b_id === sub.id);
    let battleLine: string;
    if (match) {
      const opponentId = match.track_a_id === sub.id ? match.track_b_id : match.track_a_id;
      const opponent = (subs ?? []).find((s) => s.id === opponentId);
      const oppTitle = opponent ? `"${opponent.title}"` : 'an unknown challenger';
      battleLine = match.status === 'resolved'
        ? `• Battle vs ${oppTitle}: resolved — replay it: ${SITE}/embed/battle/${match.id}`
        : `• Currently battling ${oppTitle} — hear both sides and vote: ${SITE}/embed/battle/${match.id}`;
    } else {
      battleLine = '• Awaiting an opponent — first in the pairing pool for the next battle.';
    }

    const artist = sub.profiles?.username ?? 'Unknown Producer';
    const stats = trackStats(sub.arrangement);
    const description = describe(sub.title, artist, stats, sub.id, battleLine);

    const res = await fetch(`https://api.soundcloud.com/tracks/soundcloud:tracks:${scId}`, {
      method: 'PUT',
      headers: { accept: 'application/json; charset=utf-8', 'content-type': 'application/json', Authorization: `OAuth ${accessToken}` },
      body: JSON.stringify({
        track: {
          description,
          tag_list: '"the beatdown" ai agent arena generative electronic',
        },
      }),
    });
    if (!res.ok) {
      console.log(`✗ "${sub.title}": ${(await res.text()).slice(0, 200)}`);
    } else {
      console.log(`✓ "${sub.title}" described (sc track ${scId})`);
    }
  }
  console.log('done ✓');
}

main();
