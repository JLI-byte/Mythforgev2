/**
 * Account deletion — LEAF MODULE (no store, no React, no network).
 *
 * The irreversible bits of the delete flow that are worth testing on their own:
 * whether the typed confirmation actually matches, and what to tell someone
 * when the delete did not happen.
 *
 * The delete itself is a Postgres SECURITY DEFINER function that takes no
 * arguments and can only ever act on `auth.uid()` — see
 * supabase/migrations/20260904120300_delete_own_account.sql. There is no user
 * id anywhere in this module or its caller, by design: a client-supplied id
 * would be an id somebody could change.
 */

/** The Postgres error code the function raises when there is no session. */
export const NOT_SIGNED_IN_CODE = 'PT401';

/** PostgREST's code for "that function is not in the schema cache". */
const FUNCTION_MISSING_CODE = 'PGRST202';

/**
 * True when the typed text confirms deletion of `email`.
 *
 * Whitespace is trimmed and case is ignored — a phone keyboard capitalising the
 * first letter would otherwise leave the button permanently disabled with no
 * explanation. Neither concession lowers the bar meaningfully: the whole
 * address still has to be typed out, which is not something a stray click does.
 *
 * An empty or unknown email can never confirm, so a signed-out reader cannot
 * arrive at an enabled button by typing nothing.
 */
export function isDeleteConfirmed(typed: string, email: string | undefined | null): boolean {
    if (!email) return false;
    const target = email.trim().toLowerCase();
    if (!target) return false;
    return typed.trim().toLowerCase() === target;
}

export interface DeleteFailure {
    code?: string | null;
    message?: string | null;
}

/**
 * What to show when the RPC came back with an error.
 *
 * Every branch leads with the same fact — nothing was deleted — because that is
 * the thing the reader most needs to know, and only then explains why. The
 * missing-function branch exists so a deployment where the migration has not
 * been applied says so, instead of inviting an endless retry of something that
 * cannot succeed.
 */
export function describeDeleteFailure(error: DeleteFailure | null | undefined): string {
    const code = error?.code ?? '';

    if (code === FUNCTION_MISSING_CODE) {
        return 'Your account was not deleted. Account deletion is not available on this deployment yet — nothing has changed. Please contact support.';
    }
    if (code === NOT_SIGNED_IN_CODE) {
        return 'Your account was not deleted. Your session has expired — sign in again and retry.';
    }
    return 'Your account was not deleted. Nothing has changed — please try again.';
}
