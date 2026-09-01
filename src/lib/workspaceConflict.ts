/**
 * Local-vs-cloud workspace conflict resolution — LEAF MODULE (no store, no network).
 *
 * On every load the app must decide whether the Supabase copy should replace
 * what is in the browser. Getting this wrong destroys writing, so the decision
 * lives here as a pure function with tests rather than inline in the sync hook.
 *
 * Two rules matter:
 *
 *  - Compare like with like. The row's `updated_at` is a *save* stamp, bumped by
 *    any store change at all (a panel toggle, a theme switch). Comparing it
 *    against local *content* timestamps made the cloud look newer on virtually
 *    every load, which is how a stale cloud row could overwrite real work.
 *  - Emptiness never wins. A cloud blob with no content at all cannot replace a
 *    populated local workspace, however recent it claims to be.
 */

export const CONTENT_KEYS = ['projects', 'documents', 'scenes', 'entities'] as const;

type WorkspaceLike = Record<string, unknown> | null | undefined;

function collections(state: WorkspaceLike): unknown[][] {
    if (!state) return [];
    return CONTENT_KEYS
        .map(key => (state as Record<string, unknown>)[key])
        .filter((v): v is unknown[] => Array.isArray(v));
}

/** Newest createdAt/updatedAt across the content collections, in ms. 0 when empty. */
export function newestContentTime(state: WorkspaceLike): number {
    let newest = 0;
    for (const arr of collections(state)) {
        for (const item of arr) {
            const rec = item as { updatedAt?: unknown; createdAt?: unknown } | null;
            const stamp = rec?.updatedAt ?? rec?.createdAt;
            if (stamp === undefined || stamp === null) continue;
            const ms = new Date(stamp as string).getTime();
            if (Number.isFinite(ms) && ms > newest) newest = ms;
        }
    }
    return newest;
}

/** Total items across the content collections — the "is there anything here?" measure. */
export function countContent(state: WorkspaceLike): number {
    return collections(state).reduce((n, arr) => n + arr.length, 0);
}

/** Structural guard so a malformed or hostile blob is never applied to the store. */
export function looksLikeWorkspace(data: unknown): data is Record<string, unknown> {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    return CONTENT_KEYS.every(k => d[k] === undefined || Array.isArray(d[k]));
}

export interface ConflictDecision {
    takeCloud: boolean;
    /** Short machine-ish reason, logged so a surprising outcome can be traced. */
    reason:
        | 'local-empty'
        | 'cloud-empty'
        | 'cloud-newer'
        | 'local-newer-or-equal';
}

/**
 * Decide whether the cloud copy should replace local state.
 *
 * Ties keep local: it is what the writer is currently looking at, and replacing
 * it gains nothing.
 */
export function resolveWorkspaceConflict(
    local: WorkspaceLike,
    cloud: WorkspaceLike,
): ConflictDecision {
    const localCount = countContent(local);
    if (localCount === 0) return { takeCloud: true, reason: 'local-empty' };

    // Local has work and the cloud has none: never trade content for nothing.
    if (countContent(cloud) === 0) return { takeCloud: false, reason: 'cloud-empty' };

    return newestContentTime(cloud) > newestContentTime(local)
        ? { takeCloud: true, reason: 'cloud-newer' }
        : { takeCloud: false, reason: 'local-newer-or-equal' };
}
