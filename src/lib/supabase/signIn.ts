import { createClient } from './client';
import { ALLOW_SIGNUP_FROM_LOGIN, isNotInvitedError } from '@/lib/authPolicy';

/**
 * The one sign-in path every surface uses.
 *
 * Before this existed, the login page and the login modal each built their own
 * signInWithOtp call and disagreed about whether an unknown email creates an
 * account. Adding a third surface would have made it three.
 */

export interface SignInResult {
    ok: boolean;
    /** The email is not on the invite list — a different message, not an error. */
    notInvited: boolean;
    /** Message to show the user. Null on a clean success with nothing to say. */
    message: string | null;
}

/** Where every provider returns the browser after a successful sign-in. */
function callbackUrl(): string {
    return `${window.location.origin}/auth/callback`;
}

export async function sendMagicLink(email: string): Promise<SignInResult> {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: ALLOW_SIGNUP_FROM_LOGIN,
            emailRedirectTo: callbackUrl(),
        },
    });

    if (!error) {
        return { ok: true, notInvited: false, message: 'A magic link is on its way — check your inbox.' };
    }
    if (isNotInvitedError(error.message)) {
        return { ok: false, notInvited: true, message: null };
    }
    return { ok: false, notInvited: false, message: error.message };
}

/**
 * OAuth cannot carry the invite policy — there is no shouldCreateUser for it.
 * Whether a new Google account may be created is decided entirely by the
 * Supabase project's own signup setting, and this helper must not be able to
 * contradict it.
 */
export async function signInWithGoogle(): Promise<SignInResult> {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl() },
    });

    if (error) {
        return { ok: false, notInvited: false, message: error.message };
    }
    // A successful OAuth start navigates the whole page away.
    return { ok: true, notInvited: false, message: null };
}
