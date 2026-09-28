import { mkdirSync, writeFileSync } from 'node:fs';

export const dynamic = 'force-dynamic';

// Dev-only convenience: the embed render button POSTs its rendered WAV here so the
// operator can collect renders deterministically (the browser download can be flaky
// in embedded browsers). Never available in production builds.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }
  const name = new URL(request.url).searchParams.get('name') ?? 'render.wav';
  const safe = name.replace(/[^a-z0-9._-]/gi, '_');
  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length < 1000) return new Response('body too small to be a WAV', { status: 400 });
  const dir = '/tmp/beatdown-renders';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${safe}`, buf);
  return Response.json({ ok: true, path: `${dir}/${safe}`, bytes: buf.length });
}
