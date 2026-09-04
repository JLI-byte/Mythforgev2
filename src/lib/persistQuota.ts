/**
 * Local-save failure classification and wording — LEAF MODULE (no store, no React).
 *
 * The persist path used to swallow every write failure with `catch { }`. A
 * writer whose browser is full then kept typing into a workspace that was no
 * longer being saved locally and found out when the tab closed. The wording
 * lives here, beside the detection, so it can be read and tested as one thing.
 */

/** Names browsers use for a storage-quota failure. */
export const QUOTA_ERROR_NAMES = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'];

/** Legacy numeric codes: 22 is the DOMException code, 1014 is Firefox's. */
export const QUOTA_ERROR_CODES = [22, 1014];

export function isQuotaError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { name?: unknown; code?: unknown };
    if (typeof e.name === 'string' && QUOTA_ERROR_NAMES.includes(e.name)) return true;
    return typeof e.code === 'number' && QUOTA_ERROR_CODES.includes(e.code);
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * What to tell the writer. Both branches say the same two things: what is not
 * saved, and what still is — because cloud sync is a separate path and is
 * usually still working.
 */
export function describePersistFailure(err: unknown, bytes: number): string {
    const size = formatBytes(bytes);
    if (isQuotaError(err)) {
        return `This browser is out of space, so your recent edits are not saved on this device (${size} needed). `
            + `Cloud sync is unaffected. Free space by deleting old backups in Settings, or by removing large pasted images.`;
    }
    return `LoreCanvas could not save to this browser (${size}). `
        + `Your work is still in memory and still syncing to the cloud — do not close this tab until sync shows "Saved".`;
}
