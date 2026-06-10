import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth Callback Route
 * 
 * Handles the exchange of the Magic Link code for a Supabase session.
 * Managed redirection to the home page or login on failure.
 * 
 * Creator: Antigravity
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL.
  // SECURITY: only accept same-site relative paths. A value like
  // "https://evil.com" or "//evil.com" would otherwise be an open redirect
  // that lands an authenticated user on an attacker-controlled page.
  const rawNext = searchParams.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const isLocalEnv = process.env.NODE_ENV === 'development' || origin.includes('localhost');
      const forwardedHost = request.headers.get('x-forwarded-host'); // Original origin before proxy
      
      const redirectBase = isLocalEnv 
        ? 'http://localhost:3000' 
        : 'https://mythforge.isomeric.studio';

      return NextResponse.redirect(`${redirectBase}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
