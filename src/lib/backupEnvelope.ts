/**
 * Backup envelope normalisation. LEAF MODULE (no store, no React).
 *
 * Backups in localStorage come in two shapes, and one of them could not be
 * restored at all.
 *
 * Zustand's persist middleware writes `{ state, version }` under its storage
 * key, but hands `migrate()` the BARE state. The automatic pre-migration
 * backup is taken inside `migrate()`, so it stores a bare object;
 * `createManualBackup` copies the storage key verbatim, so it stores a full
 * envelope.
 *
 * Writing a bare object back into the persist key leaves zustand with no
 * `.state` to hydrate, so the workspace comes back EMPTY. Since automatic
 * backups are precisely the ones taken before a migration, the recovery path
 * destroyed exactly what a user would reach for it to recover.
 *
 * This module puts a bare backup back into an envelope, taking the schema
 * version from the backup's own key so the migration chain replays from the
 * version the snapshot was actually taken at.
 */

/** Oldest version, used when a key carries no parseable version. The migration
 *  chain is idempotent, so replaying all of it is always safe. */
const FALLBACK_VERSION = 0;

/**
 * Reads the schema version out of a backup key.
 * Key format: `lorecanvas-backup-v{version}-{timestamp}`.
 */
export function backupVersionFromKey(key: string): number {
    const match = /^lorecanvas-backup-v(\d+)-/.exec(key);
    if (!match) return FALLBACK_VERSION;
    const parsed = parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : FALLBACK_VERSION;
}

/** True when a parsed backup is already a zustand persist envelope. */
export function isPersistEnvelope(value: unknown): boolean {
    return Boolean(
        value
        && typeof value === 'object'
        && !Array.isArray(value)
        && 'state' in (value as Record<string, unknown>)
        && (value as Record<string, unknown>).state !== null
        && typeof (value as Record<string, unknown>).state === 'object',
    );
}

/**
 * Returns the string to write into the persist key for a given backup, or
 * null when the backup is unusable and the restore should be refused.
 *
 * An envelope is returned untouched so a manual backup restores byte for byte.
 * A bare state is wrapped, versioned from `key`.
 */
export function normaliseBackupPayload(raw: string, key: string): string | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    if (isPersistEnvelope(parsed)) return raw;

    // Anything that is not an object cannot be a workspace — refuse rather
    // than write a payload that would hydrate as nothing.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    return JSON.stringify({ state: parsed, version: backupVersionFromKey(key) });
}
