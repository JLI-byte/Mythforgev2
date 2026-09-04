import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveRedirectBase, safeNextPath } from '@/lib/authRedirect';

/**
 * Auth Callback Route
 *
 * Exchanges the magic-link code for a Supabase session, then returns the user
 * to the host they actually signed in from — derived from the request rather
 * than hardcoded, so previews, staging and a second domain all work.
 *
 * Set NEXT_PUBLIC_SITE_URL to pin the destination explicitly; it takes
 * precedence over the forwarded headers, which are client-supplied unless a
 * trusted proxy overwrites them.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Default landing after sign-in is the Home dashboard (?view= is read by the
  // workspace on mount), not whatever mode the previous session persisted.
  // safeNextPath refuses anything that is not a same-site path, so a value like
  // "https://evil.com" or "//evil.com" cannot become an open redirect that
  // lands a freshly authenticated user on an attacker-controlled page.
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectBase = resolveRedirectBase(
        origin,
        request.headers.get('x-forwarded-host'),
        request.headers.get('x-forwarded-proto'),
        process.env.NEXT_PUBLIC_SITE_URL,
      );
      return NextResponse.redirect(`${redirectBase}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
