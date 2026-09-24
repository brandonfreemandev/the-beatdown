import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase/types';

/** OAuth callback must use the live request origin — not a build-time localhost default. */
function requestSiteUrl(request: NextRequest): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return url.origin;
}

export async function GET(request: NextRequest) {
  const siteUrl = requestSiteUrl(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  let next = searchParams.get('next') ?? '/';
  if (!next.startsWith('/')) next = '/';

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/?error=auth&reason=missing_code`);
  }

  let response = NextResponse.redirect(`${siteUrl}${next}`);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.redirect(`${siteUrl}${next}`);
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${siteUrl}/?error=auth&reason=${encodeURIComponent(error.message)}`
    );
  }

  return response;
}
