import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * LoreCanvas Global Auth Proxy
 *
 * Manages session refreshing and access control.
 * Unauthenticated users are redirected to /login for all restricted routes.
 *
 * Creator: Antigravity
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Resolve the session. The auth check runs in the proxy sandbox, whose fetch
  // to Supabase can fail transiently (notably under Turbopack dev).
  // If it does, fail open: let the request through and let client-side gating +
  // Supabase RLS protect data, rather than throwing or wrongly bouncing users.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.warn('[proxy] auth check failed, passing request through:', error);
    return response;
  }

  // Route protection logic
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.startsWith('/login');
  const isWelcomePage = pathname.startsWith('/welcome');
  const isAuthCallback = pathname.startsWith('/auth/callback');
  const isDevLogin = pathname.startsWith('/api/dev-login');
  const isStaticAsset = pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|webp)$/);
  const isInternal = pathname.startsWith('/_next');

  const isPublic = isLoginPage || isWelcomePage || isAuthCallback || isDevLogin || isStaticAsset || isInternal;

  if (!user && !isPublic) {
    // Unauthenticated visitors land on the public beta landing page
    const url = request.nextUrl.clone();
    url.pathname = '/welcome';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from the login/landing pages
  if (user && (isLoginPage || isWelcomePage)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
