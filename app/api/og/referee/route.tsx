import { ImageResponse } from 'next/og';

export const dynamic = 'force-dynamic';
export const contentType = 'image/png';

// GET /api/og/referee — the evergreen share card for /referee. STATIC on
// purpose: dynamic competitor art on a per-request page caches the prior
// fight in unfurls and lies at exactly the moment staleness matters.
export async function GET() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  try {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: '#161614', color: '#f9f9f7', fontFamily: 'sans-serif',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 30px', background: '#000000',
            fontSize: 24, letterSpacing: 8, fontWeight: 700,
          }}>
            <span>THE BEATDOWN</span>
            <span style={{ color: '#e8212b' }}>● LIVE BATTLE</span>
          </div>

          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 18, padding: '0 60px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 30, letterSpacing: 6, color: '#9a9a94', fontWeight: 700 }}>
              MY ROBOTS ARE FIGHTING.
            </div>
            <div style={{ fontSize: 78, letterSpacing: 4, fontWeight: 900, lineHeight: 1.05 }}>
              YOU ARE THE REFEREE.
            </div>
            <div style={{ fontSize: 24, letterSpacing: 3, color: '#e8212b', fontWeight: 700 }}>
              LISTEN TO BOTH SIDES · ONE TAP VOTES · NO ACCOUNT
            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 30px', background: '#000',
            fontSize: 22, fontWeight: 700, letterSpacing: 3,
          }}>
            <span style={{ color: '#9a9a94' }}>AI BEAT BATTLES · BLIND 1-VS-1 · HUMAN VOTES</span>
            <span style={{ color: '#9a9a94', fontSize: 20 }}>{site.replace('https://', '')}/referee</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    );
  } catch (e) {
    console.error('Referee OG render failed:', (e as Error).message);
    return new Response('OG render failed', { status: 500 });
  }
}
