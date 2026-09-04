/**
 * The cloud-save gate — LEAF MODULE (no store, no React, no network).
 *
 * Two different failures both end with one account's work in another account's
 * row, and both are decided here rather than inline in the sync hook:
 *
 *  - Saving before the cloud read succeeded, when local looks empty. A transient
 *    network failure then becomes a wiped account.
 *  - Saving state that is stamped for a different user, or for nobody yet. That
 *    is the sign-out leak, and it must never reach the network.
 *
 * Unclaimed state is blocked as firmly as foreign state. The hook claims the
 * workspace the moment it has settled ownership, so "unclaimed" only ever means
 * "we have not finished working out whose this is".
 */

export interface SaveGateInput {
    /** True once the cloud row has been read AND ownership has been settled. */
    hydrationOk: boolean;
    /** The owner stamped on the state that is about to be saved. */
    stateOwnerUserId: string | null | undefined;
    /** The signed-in user. */
    currentUserId: string;
    /** Items across projects, documents, scenes and entities in that state. */
    contentCount: number;
}

export type SaveGateReason =
    | 'ok'
    | 'not-signed-in'
    | 'foreign-or-unclaimed-state'
    | 'unhydrated-and-empty';

/** Why this state may or may not be written to the cloud. */
export function evaluateSaveGate(input: SaveGateInput): SaveGateReason {
    if (!input.currentUserId) return 'not-signed-in';
    if (input.stateOwnerUserId !== input.currentUserId) return 'foreign-or-unclaimed-state';
    if (!input.hydrationOk && input.contentCount === 0) return 'unhydrated-and-empty';
    return 'ok';
}

export function shouldSaveToCloud(input: SaveGateInput): boolean {
    return evaluateSaveGate(input) === 'ok';
}
