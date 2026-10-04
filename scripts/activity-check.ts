// User-activity monitor for The Beatdown — run by the Moltbook heartbeat every
// 2h (and safe to run by hand): logs signups/submissions/votes since the last
// check, detects funnel failures (bounced signups, unpaired submissions), and
// self-heals pairing via the public matchmaker endpoint.
// Run: npx tsx scripts/activity-check.ts
process.loadEnvFile('.env.local');

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MEM_DIR = '/Users/brandonfreeman/.zcode/cli/memories/projects/the-beatdown-a09ae94e332585c3/memory';
const STATE_FILE = `${MEM_DIR}/beatdown-activity-state.json`;
const LOG_FILE = `${MEM_DIR}/beatdown-activity-log.md`;
const LOG_MAX_LINES = 400;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const BOUNCED_AFTER_H = 24; // signup older than this with 0 submissions = funnel suspect
const UNPAIRED_AFTER_H = 12;

async function rest<T>(path: string): Promise<T[]> {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json() as Promise<T[]>;
}

interface State {
  lastProfile: string;
  lastSubmission: string;
  lastVote: string;
  bouncedNoted: string[]; // profile ids already alerted as bounced
  lastRun: string;
}
const nowIso = () => new Date().toISOString();

function loadState(): State | null {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

function appendLog(lines: string[]) {
  const existing = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf8') : '';
  const stamped = ['', `## ${nowIso()}`, ...lines].join('\n');
  const merged = (existing + stamped + '\n').split('\n');
  writeFileSync(LOG_FILE, merged.slice(-LOG_MAX_LINES).join('\n'));
}

const hh = (iso: string) => iso.slice(0, 16).replace('T', ' ');

async function main() {
  const state = loadState();
  const firstRun = state === null;
  const wm = state ?? { lastProfile: nowIso(), lastSubmission: nowIso(), lastVote: nowIso(), bouncedNoted: [], lastRun: nowIso() };
  const out: string[] = [];
  const alerts: string[] = [];

  // 1. Signups since last check.
  const profiles = await rest<{ id: string; username: string | null; submissions_count: number; created_at: string }>(
    `profiles?select=id,username,submissions_count,created_at&created_at=gt.${encodeURIComponent(wm.lastProfile)}&order=created_at.asc`);
  for (const p of profiles) {
    out.push(`SIGNUP — ${p.username ?? p.id} (tracks so far: ${p.submissions_count}) at ${hh(p.created_at)}`);
  }

  // 2. Bounced signups: account exists, no track ever landed, older than the bounce window.
  const stale = await rest<{ id: string; username: string | null; submissions_count: number; created_at: string }>(
    `profiles?select=id,username,submissions_count,created_at&submissions_count=eq.0&created_at=lt.${new Date(Date.now() - BOUNCED_AFTER_H * 3600_000).toISOString()}`);
  for (const p of stale) {
    if (wm.bouncedNoted.includes(p.id)) continue;
    alerts.push(`BOUNCED SIGNUP — ${p.username ?? p.id} signed up ${hh(p.created_at)} UTC and never got a track through. If this is new, the submit funnel ate it.`);
    wm.bouncedNoted.push(p.id);
    appendLog([`BOUNCED — ${p.username ?? p.id} (signed up ${hh(p.created_at)}, 0 submissions)`]);
  }

  // 3. Submissions since last check + pairing health.
  const subs = await rest<{ id: string; title: string; user_id: string; created_at: string; profiles: { username: string | null } | null }>(
    `submissions?select=id,title,user_id,created_at,profiles(username)&created_at=gt.${encodeURIComponent(wm.lastSubmission)}&order=created_at.asc`);
  const activeMatches = await rest<{ id: string; track_a_id: string; track_b_id: string; status: string }>(
    `matches?select=id,track_a_id,track_b_id,status&status=eq.active`);
  const matchedIds = new Set(activeMatches.flatMap((m) => [m.track_a_id, m.track_b_id]));
  for (const s of subs) {
    out.push(`SUBMISSION — "${s.title}" by ${s.profiles?.username ?? s.user_id} at ${hh(s.created_at)}`);
  }
  // Any submission sitting unpaired past the window means pairing failed — heal it.
  const allUnpaired = await rest<{ id: string; title: string; created_at: string }>(
    `submissions?select=id,title,created_at&created_at=lt.${new Date(Date.now() - UNPAIRED_AFTER_H * 3600_000).toISOString()}`);
  const unpairedOld = allUnpaired.filter((s) => !matchedIds.has(s.id));
  if (unpairedOld.length > 0) {
    const heal = await fetch(`${SITE}/api/matchmaker`, { method: 'POST' });
    const data = await heal.json().catch(() => ({ pairs: 0 }));
    if ((data as any).pairs > 0) {
      out.push(`HEALED — ${unpairedOld.length} submission(s) sat unpaired ${UNPAIRED_AFTER_H}h+; matchmaker created ${(data as any).pairs} battle(s)`);
    } else {
      alerts.push(`UNPAIRED — ${unpairedOld.length} submission(s) (${unpairedOld.map((s) => `"${s.title}"`).join(', ')}) have no battle after ${UNPAIRED_AFTER_H}h+ and the matchmaker didn't pair them (odd count waits for the next track — only an alert if this persists across runs).`);
    }
  }

  // 4. Votes since last check (the human pulse).
  const votes = await rest<{ id: string; match_id: string; created_at: string }>(
    `votes?select=id,match_id,created_at&created_at=gt.${encodeURIComponent(wm.lastVote)}&order=created_at.asc`);
  if (votes.length > 0) out.push(`VOTES — ${votes.length} cast since last check`);

  // 5. Stale active battles (the lazy time-box resolves on read; poke it).
  const res = await fetch(`${SITE}/api/battles/recent?limit=25`);
  const feed = await res.json() as { battles: Array<{ status: string; votes: { a: number; b: number } }> };
  const staleActive = feed.battles.filter((b) => b.status === 'active').length;
  out.push(`LADDER — ${staleActive} active battle(s), ${feed.battles.filter((b) => b.status === 'resolved').length} resolved in recent feed`);

  // 6. Update watermarks (max created_at seen, not now — avoids missing rows).
  const maxOf = (rows: Array<{ created_at: string }>, fallback: string) =>
    new Date(rows.reduce((m, r) => (r.created_at > m ? r.created_at : m), fallback)).toISOString();
  wm.lastProfile = maxOf(profiles, wm.lastProfile);
  wm.lastSubmission = maxOf(subs, wm.lastSubmission);
  wm.lastVote = maxOf(votes, wm.lastVote);
  wm.lastRun = nowIso();
  writeFileSync(STATE_FILE, JSON.stringify(wm, null, 2));

  appendLog(firstRun
    ? [`BASELINE — monitoring started. Known bounced signups (pre-monitoring): N.S. Jobuk (Jul 7), Brian Thomas (Sep 29). Ladder: ${staleActive} active / ${feed.battles.filter((b) => b.status === 'resolved').length} resolved.`]
    : out);

  console.log(firstRun ? 'BASELINE RECORDED (first run — everything current is the starting point)' : 'ACTIVITY CHECK');
  if (out.length) console.log(out.map((l) => '· ' + l).join('\n'));
  else console.log('· no new activity since last check');
  if (alerts.length) console.log('\nALERTS:\n' + alerts.map((a) => '⚠ ' + a).join('\n'));
  else console.log('ALERTS: none');
}

main().catch((e) => {
  console.error('ACTIVITY CHECK FAILED:', e.message);
  process.exit(1);
});
