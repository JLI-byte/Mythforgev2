import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Developer sign-in — DEVELOPMENT ONLY.
 *
 * Signs in with DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD from .env.local so the
 * developer doesn't need a magic-link email on every session. The route is a
 * Gated on NODE_ENV alone, which a production build cannot set to
 * 'development'. There is deliberately no environment variable that re-opens
 * this route: testing a production build locally is not worth an
 * internet-reachable password-free session as the owner. The env vars are
 * server-only (not NEXT_PUBLIC), so they never reach client bundles.
 */
export async function POST() {
    if (process.env.NODE_ENV !== 'development') {
        return new NextResponse(null, { status: 404 });
    }

    const email = process.env.DEV_LOGIN_EMAIL;
    const password = process.env.DEV_LOGIN_PASSWORD;
    if (!email || !password) {
        return NextResponse.json(
            { error: 'DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD missing from .env.local' },
            { status: 500 },
        );
    }

    // A rejected sign-in and an unreachable auth service are different
    // failures and deserve different answers. Without this try/catch a network
    // error surfaced to the writer as the raw string "fetch failed", which
    // says nothing about what broke or whether their work is safe.
    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }
        return NextResponse.json({ ok: true });
    } catch (cause) {
        // The cause stays in the server log, never in the response: it can
        // carry hostnames and provider internals.
        logger.error('dev-login: auth service unreachable', cause);
        return NextResponse.json(
            { error: 'Could not reach the sign-in service. Your work is safe — try again in a moment.' },
            { status: 503 },
        );
    }
}
