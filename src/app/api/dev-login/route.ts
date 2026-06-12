import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Developer sign-in — DEVELOPMENT ONLY.
 *
 * Signs in with DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD from .env.local so the
 * developer doesn't need a magic-link email on every session. The route is a
 * hard 404 outside development unless ALLOW_DEV_LOGIN=1 is explicitly set
 * (for testing local production builds); the env vars are server-only (not
 * NEXT_PUBLIC), so they never reach client bundles.
 */
export async function POST() {
    const allowed =
        process.env.NODE_ENV === 'development' ||
        process.env.ALLOW_DEV_LOGIN === '1';
    if (!allowed) {
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

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
}
