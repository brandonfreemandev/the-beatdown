# Deploying to Cloudflare Workers

The Beatdown runs on [Cloudflare Workers](https://developers.cloudflare.com/workers/) via the [@opennextjs/cloudflare](https://opennext.js.org/cloudflare) adapter (Next.js 16, Node.js runtime on Workers).

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (Workers Paid plan recommended if the bundle exceeds 3 MiB compressed)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) authenticated locally: `npx wrangler login`
- Supabase project with Google OAuth already configured
- GitHub repo connected (optional, for CI deploys)

## One-time setup

### 1. Environment variables

Wrangler is a **local project dependency**, not a global CLI. Do **not** type `wrangler` by itself — zsh will say `command not found`. Use either form below from the project root (`the-beatdown/`):

```bash
# Option A — npm scripts (easiest)
npm run cf:login
npm run cf:secret -- SUPABASE_SERVICE_ROLE_KEY
npm run cf:secret -- GOOGLE_AI_API_KEY
npm run cf:secret -- NEXT_PUBLIC_SUPABASE_URL
npm run cf:secret -- NEXT_PUBLIC_SUPABASE_ANON_KEY

# Option B — npx (same thing, longer)
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Each `secret put` prompts you to paste the value (input is hidden). Confirm login with `npm run cf:whoami`.

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Vote/submit profile bootstrap |
| `GOOGLE_AI_API_KEY` | yes | Arena matchmaker bot pairing |

### 2. Supabase OAuth redirect URLs

**This is the most common cause of “redirects to localhost” on mobile.**

In **Supabase → Authentication → URL Configuration**:

| Field | Value |
|-------|--------|
| **Site URL** | `https://the-beatdown.brandonfreeman-dev.workers.dev` |
| **Redirect URLs** | `https://the-beatdown.brandonfreeman-dev.workers.dev/auth/callback` |

If Site URL is still `http://localhost:3000`, Google sign-in will send users back to localhost after auth — which breaks on a phone.

Also add to **`.env.local`** before deploying (baked into the client at build time):

```
NEXT_PUBLIC_SITE_URL=https://the-beatdown.brandonfreeman-dev.workers.dev
```

Then redeploy: `npm run deploy`

### 3. Bootstrap Arena (after first deploy)

Scripts run locally against Supabase — not on Workers:

```bash
npx tsx scripts/bootstrap-arena.ts
```

## Deploy from your machine

```bash
npm run deploy
```

This runs `opennextjs-cloudflare build` (Next.js build + Workers transform) then uploads to Cloudflare. First deploy creates `the-beatdown.<account>.workers.dev`.

### Preview locally in the Workers runtime

```bash
npm run preview
```

Uses `.dev.vars` for secrets. Slower than `npm run dev` but matches production runtime.

## Deploy via GitHub (Workers Builds)

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Connect to Git**.
3. Select the repo and configure:

   | Setting | Value |
   |---------|-------|
   | Build command | `npx opennextjs-cloudflare build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | `/` |

4. Add the environment variables/secrets from step 1 in **Build variables and secrets**.

## Custom domain

After deploy:

1. **Workers & Pages → the-beatdown → Settings → Domains & Routes**
2. Add your domain (e.g. `beatdown.yourdomain.com`)
3. Update Supabase OAuth redirect URLs to match

## Troubleshooting

- **`proxy.ts` vs `middleware.ts`** — OpenNext does not support Next.js 16's Node `proxy.ts` yet. This repo uses legacy `middleware.ts` for Supabase session refresh (Next 16 shows a deprecation warning; safe until OpenNext adds proxy support).
- **`next dev` balloons memory / crashes with OOM** — a corrupted `.next` Turbopack cache makes the dev server spin CPU at idle and climb to a heap crash, which then corrupts the cache further. Fix: `rm -rf .next` and restart. If it recurs, the cause is the same cycle, not the app.
- **Cloudflare bindings in dev** — `initOpenNextCloudflareForDev()` in `next.config.ts` is gated behind `NEXT_DEV_CLOUDFLARE_BINDINGS=1` (no app code consumes Cloudflare bindings during `next dev`, and the initializer adds startup cost). `npm run preview` and `npm run deploy` are unaffected.
- **Build fails on TypeScript** — run `npm run build` locally first; fix any errors before `npm run deploy`.
- **Auth redirect loop** — production URL must exactly match Supabase redirect allowlist.
- **406 on profiles** — usually missing profile row; vote/submit routes call `ensureProfile`.
- **Worker size limit** — check output after deploy; upgrade to Workers Paid if over 3 MiB compressed on Free.

## Files added for Cloudflare

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Worker name, compatibility flags, assets binding |
| `open-next.config.ts` | OpenNext adapter config |
| `public/_headers` | Cache static `/_next/static/*` at the edge |
| `.dev.vars.example` | Template for local Workers preview secrets |
