/**
 * Workspace ownership and local-storage sweeping — LEAF MODULE (no store, no React).
 *
 * One browser, many writers. Everything LoreCanvas keeps in localStorage — the
 * workspace itself and every automatic or manual backup — has to be attributable
 * to exactly one account, or the next person to sign in inherits the last
 * person's manuscripts and their first autosave writes those manuscripts into
 * their own cloud row. The decisions live here as pure functions so they can be
 * tested without a browser and without the store.
 */

/** The zustand persist key. */
export const WORKSPACE_STORAGE_KEY = 'lorecanvas-workspace';

/** Every automatic and manual backup key starts with this. */
export const BACKUP_KEY_PREFIX = 'lorecanvas-backup-';

/**
 * True when persisted state is stamped for someone other than the signed-in
 * user. Unstamped state belongs to nobody yet — that is the pre-upgrade case,
 * and it is adopted rather than discarded, so no existing writer loses work the
 * day this ships.
 */
export function isForeignWorkspace(
    storedOwnerUserId: string | null | undefined,
    currentUserId: string,
): boolean {
    if (!storedOwnerUserId) return false;
    if (!currentUserId) return false;
    return storedOwnerUserId !== currentUserId;
}

/**
 * Every key LoreCanvas owns that can hold one account's work, given a snapshot
 * of the localStorage key list. Anything else in there — the landing theme
 * choice, the Supabase session — is not a manuscript and is left alone.
 */
export function ownedStorageKeys(allKeys: readonly string[]): string[] {
    return allKeys.filter(
        k => k === WORKSPACE_STORAGE_KEY || k.startsWith(BACKUP_KEY_PREFIX),
    );
}

/**
 * The owner stamped inside a backup blob, or null when it carries none.
 *
 * Two blob shapes exist in the wild: automatic backups written by the persist
 * `migrate` hook store the bare state object, while manual backups copy the
 * whole `{ state, version }` envelope. Both are read here.
 */
export function readBackupOwner(raw: string | null): string | null {
    if (!raw) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed as Record<string, unknown>;
    const state = (Object.prototype.hasOwnProperty.call(envelope, 'state')
        ? envelope.state
        : envelope) as Record<string, unknown> | null;
    if (!state || typeof state !== 'object') return null;
    const owner = state.ownerUserId;
    return typeof owner === 'string' && owner.length > 0 ? owner : null;
}

/**
 * Stamps an unowned backup with a user id, so backups taken before ownership
 * existed stay visible to the person who actually made them. Returns null when
 * the blob is unparseable or already owned — in both cases there is nothing to
 * write back.
 */
export function claimBackup(raw: string, userId: string): string | null {
    if (!userId) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed as Record<string, unknown>;
    const hasEnvelope = Object.prototype.hasOwnProperty.call(envelope, 'state');
    const state = (hasEnvelope ? envelope.state : envelope) as Record<string, unknown> | null;
    if (!state || typeof state !== 'object') return null;
    const owner = state.ownerUserId;
    if (typeof owner === 'string' && owner.length > 0) return null;
    const nextState = { ...state, ownerUserId: userId };
    return JSON.stringify(hasEnvelope ? { ...envelope, state: nextState } : nextState);
}
