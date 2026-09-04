/**
 * The invite policy — LEAF MODULE (no store, no React, no network).
 *
 * Stated once, so the login page and the login modal cannot disagree about it.
 * They did: the page set shouldCreateUser: false and the modal omitted it,
 * which GoTrue reads as true, so the modal created accounts the page refused.
 */

/**
 * Invite-only beta: no login surface may create an account.
 *
 * This governs the magic-link paths only. `signInWithOAuth` has no equivalent
 * option in any Supabase version, so the Google button cannot be gated from the
 * client at all — the only enforcement for OAuth is the project-level
 * "Allow new users to sign up" setting in the Supabase dashboard.
 */
export const ALLOW_SIGNUP_FROM_LOGIN = false;

/** GoTrue surfaces an uninvited email as a signup-disallowed error. */
export function isNotInvitedError(message: string): boolean {
    if (!message) return false;
    return /signup|not allowed|not found/i.test(message);
}
