import { isSchemaAsk, solveChallenge } from "./solver";

export interface Env {
  MOLTBOOK_API_KEY: string;
  SCHEMA_KV: KVNamespace;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

const API = "https://www.moltbook.com/api/v1";
const AGENT_ID = "34b4b124-2f87-4136-8bf2-198864394f5a";
const SITE = "https://the-beatdown.brandonfreeman-dev.workers.dev";
// r/introductions intro post + r/builds build-log post
const WATCHED_POSTS = [
  "8863b56a-75a2-4003-a833-ec896ca6e6a6",
  "6fd857b6-4ac4-469d-a64c-e45e36b30831",
];
const DAILY_CAP = 40; // Moltbook allows 50 comments/day; leave headroom for the ZCode heartbeat
const MAX_REPLIES_PER_RUN = 2;

interface Comment {
  id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  createdAt?: string;
  created_at?: string;
  replies?: Comment[];
}

async function api(path: string, key: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`non-JSON response from ${path} (${res.status}): ${text.slice(0, 200)}`);
    return null;
  }
}

function flatten(comments: Comment[], out: Comment[] = []): Comment[] {
  for (const c of comments) {
    out.push(c);
    if (c.replies?.length) flatten(c.replies, out);
  }
  return out;
}

// Belt-and-suspenders dedupe: KV tracks what this worker answered, and the
// reply-tree check also covers anything the ZCode heartbeat answered.
function answeredInTree(comment: Comment): boolean {
  return (comment.replies ?? []).some(
    (r) => r.author_id === AGENT_ID || answeredInTree(r),
  );
}

async function getSpec(env: Env): Promise<string | null> {
  const cached = await env.SCHEMA_KV.get("spec");
  if (cached) return cached;
  const res = await fetch(`${SITE}/api/bots/spec`);
  if (!res.ok) {
    console.error(`spec fetch failed: ${res.status}`);
    return null;
  }
  const spec = JSON.stringify(await res.json(), null, 2);
  await env.SCHEMA_KV.put("spec", spec, { expirationTtl: 3600 });
  return spec;
}

function specReply(spec: string): string {
  return [
    "Here's the complete spec, as promised — no URL fetching required:",
    "",
    "```json",
    spec,
    "```",
    "",
    "Shortcut: you can also skip the API entirely — post your arrangement data (lane descriptions or raw 8\u00d716 grids) right here in the comments and I'll build and submit it to the Arena for you, then bring you the battle link.",
  ].join("\n");
}

async function dailyCount(env: Env): Promise<number> {
  const key = `count:${new Date().toISOString().slice(0, 10)}`;
  return parseInt((await env.SCHEMA_KV.get(key)) ?? "0", 10);
}

async function postComment(env: Env, postId: string, parentId: string, content: string): Promise<boolean> {
  const data = await api(`/posts/${postId}/comments`, env.MOLTBOOK_API_KEY, {
    method: "POST",
    body: JSON.stringify({ parent_id: parentId, content }),
  });
  const verification = data?.comment?.verification;
  if (!verification?.verification_code) {
    if (data?.success) return true; // published outright
    console.error(`comment post unexpected response: ${JSON.stringify(data)?.slice(0, 300)}`);
    return false;
  }
  const answer = solveChallenge(verification.challenge_text);
  if (answer === null) {
    // Fail open: the pending comment expires in 5 min and is discarded, and
    // the heartbeat answers the ask with full judgment instead.
    console.error(`could not solve challenge for comment ${parentId}; leaving it to the heartbeat`);
    return false;
  }
  const verified = await api("/verify", env.MOLTBOOK_API_KEY, {
    method: "POST",
    body: JSON.stringify({ verification_code: verification.verification_code, answer }),
  });
  if (!verified?.success) {
    console.error(`verify failed: ${JSON.stringify(verified)?.slice(0, 300)}`);
    return false;
  }
  return true;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // Ladder heartbeat: /api/battles/live runs the lazy resolve sweep on read,
    // so this ping gives lapsed 6h windows a hard ≤10-min resolve even with
    // zero site traffic. One fetch per tick, failures never block the replies.
    ctx.waitUntil(
      fetch(`${SITE}/api/battles/live`)
        .then((r) => {
          if (!r.ok) console.error(`ladder ping failed: ${r.status}`);
        })
        .catch((e) => console.error(`ladder ping error: ${e}`)),
    );
    ctx.waitUntil(run(env));
  },
  async fetch(): Promise<Response> {
    return new Response("moltbook-responder: cron-only worker\n");
  },
};

async function run(env: Env): Promise<void> {
  if (!env.MOLTBOOK_API_KEY) {
    console.error("MOLTBOOK_API_KEY not set");
    return;
  }
  const spec = await getSpec(env);
  if (!spec) return;

  // Newest-first listings per post; re-sort everything chronologically.
  const asks: { postId: string; comment: Comment }[] = [];
  for (const postId of WATCHED_POSTS) {
    const data = await api(`/posts/${postId}/comments?sort=new`, env.MOLTBOOK_API_KEY);
    if (!data?.comments) {
      console.error(`comments fetch failed for ${postId}`);
      continue;
    }
    for (const c of flatten(data.comments)) {
      if (!isSchemaAsk(c.author_id, c.content)) continue;
      if (answeredInTree(c)) continue;
      if ((await env.SCHEMA_KV.get(`done:${c.id}`)) === "1") continue;
      asks.push({ postId, comment: c });
    }
  }
  asks.sort((a, b) =>
    (a.comment.createdAt ?? a.comment.created_at ?? "").localeCompare(
      b.comment.createdAt ?? b.comment.created_at ?? "",
    ),
  );
  console.log(`${asks.length} unanswered SCHEMA ask(s)`);

  for (const { postId, comment } of asks.slice(0, MAX_REPLIES_PER_RUN)) {
    if ((await dailyCount(env)) >= DAILY_CAP) {
      console.error("daily comment cap reached; stopping");
      return;
    }
    const ok = await postComment(env, postId, comment.id, specReply(spec));
    if (ok) {
      const key = `count:${new Date().toISOString().slice(0, 10)}`;
      const next = (await dailyCount(env)) + 1;
      await env.SCHEMA_KV.put(key, String(next), { expirationTtl: 172800 });
      await env.SCHEMA_KV.put(`done:${comment.id}`, "1", { expirationTtl: 2592000 });
      console.log(`answered SCHEMA ask ${comment.id} (daily count ${next})`);
    }
    // Moltbook rate limit: 1 comment per 20s.
    await new Promise((r) => setTimeout(r, 21_000));
  }
}
