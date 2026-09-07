/**
 * Workspace size measurement — LEAF MODULE (no store, no React, no network).
 *
 * `workspaces.data` is one unbounded JSON blob per user, and images pasted into
 * the editor are stored inside it as data URLs. Nothing stopped a single
 * account from pushing hundreds of megabytes into a Postgres row on every
 * autosave — a database problem and a cost problem with no ceiling.
 *
 * Two named limits, both measured on the serialised UTF-8 byte length, because
 * that is what actually crosses the wire and what Postgres actually stores:
 *
 *   - SOFT: warn the writer, and name the part of the workspace responsible.
 *   - HARD: refuse the cloud write. Local saving continues untouched.
 *
 * This is a guard rail, not a quota system. Moving images to object storage is
 * the real fix and is deliberately out of scope.
 *
 * The writer-facing sentences live here rather than in the banner, because
 * vitest only collects `src/**\/*.test.ts` — copy that a component owns is copy
 * no test can read. The component renders what this module decides.
 *
 * Note on the numbers: `totalBytes` measures the whole blob, while
 * `contributors` measures each value on its own, so the contributors sum to
 * slightly less than the total — the difference is the key names and the
 * punctuation between them. Ranking is what matters here, not reconciliation.
 *
 * `byteLength` will throw on a structure JSON cannot serialise (a cycle). That
 * cannot happen for a partialized workspace, and letting it throw is better
 * than silently under-reporting; callers on the save path catch it.
 */

/** Warn past this many bytes. 4 MB of JSON is already a very large manuscript. */
export const SOFT_LIMIT_BYTES = 4 * 1024 * 1024;

/** Refuse the cloud write past this many bytes. */
export const HARD_LIMIT_BYTES = 8 * 1024 * 1024;

export type SizeVerdict = 'ok' | 'warn' | 'blocked';

export interface KeySize {
    key: string;
    bytes: number;
}

export interface WorkspaceSize {
    /** Serialised size of the entire blob, in bytes. */
    totalBytes: number;
    verdict: SizeVerdict;
    /** Top-level persisted keys, largest first. Empty for an empty blob. */
    contributors: KeySize[];
    /** The single largest key, or null when there is nothing to measure. */
    largest: KeySize | null;
}

/** What the writer should be told, in their own words. */
export interface SizeNotice {
    tone: 'warn' | 'blocked';
    /** The situation, in one line. */
    headline: string;
    /** What it means and what to do about it. */
    detail: string;
}

const encoder = new TextEncoder();

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/**
 * Names the persisted store keys in words a writer would use, so a notice can
 * say what is taking up the room rather than printing an internal key.
 */
const KEY_LABELS: Record<string, string> = {
    scenes: 'your scenes',
    documents: 'your documents',
    entities: 'your World Bible articles',
    projects: 'your projects',
    worlds: 'your worlds',
    deskStates: 'your Writing Desk boards',
    draftStates: 'your draft tables',
    researchStates: 'your research boards',
    sceneSnapshots: 'scene version history',
    entitySnapshots: 'article version history',
    stashedExample: 'the stashed example world',
    socialHistory: 'your social posts',
};

/** Serialised UTF-8 byte length of a value. 0 when JSON drops it entirely. */
export function byteLength(value: unknown): number {
    const json = JSON.stringify(value);
    if (json === undefined) return 0;
    return encoder.encode(json).length;
}

export function verdictFor(totalBytes: number): SizeVerdict {
    if (totalBytes >= HARD_LIMIT_BYTES) return 'blocked';
    if (totalBytes >= SOFT_LIMIT_BYTES) return 'warn';
    return 'ok';
}

/** Measure a persisted workspace blob and rank what is taking up the room. */
export function measureWorkspace(blob: Record<string, unknown>): WorkspaceSize {
    const totalBytes = byteLength(blob);

    const contributors: KeySize[] = [];
    for (const [key, value] of Object.entries(blob)) {
        if (value === undefined) continue;
        contributors.push({ key, bytes: byteLength(value) });
    }
    contributors.sort((a, b) => b.bytes - a.bytes);

    return {
        totalBytes,
        verdict: verdictFor(totalBytes),
        contributors,
        largest: contributors[0] ?? null,
    };
}

/** Human-readable size for UI copy. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(1)} ${UNITS[unit]}`;
}

/** The writer's name for a persisted key, falling back to the key itself. */
export function contributorLabel(key: string | undefined): string {
    if (!key) return 'your workspace';
    return KEY_LABELS[key] ?? key;
}

/**
 * Turn a measurement into something worth interrupting a writer with, or null
 * when it is not worth interrupting them at all.
 *
 * The blocked copy leads with what is still true — the work is saved in this
 * browser — because the failure this whole feature exists to avoid is a writer
 * who believes they are synced when they are not, and its mirror image is a
 * writer who believes they have lost work when they have not.
 */
export function describeWorkspaceSize(size: WorkspaceSize | null): SizeNotice | null {
    if (!size || size.verdict === 'ok') return null;

    const total = formatBytes(size.totalBytes);
    const hard = formatBytes(HARD_LIMIT_BYTES);
    const largest = size.largest
        ? `${contributorLabel(size.largest.key)} (${formatBytes(size.largest.bytes)})`
        : 'nothing in particular';

    if (size.verdict === 'blocked') {
        return {
            tone: 'blocked',
            headline:
                `Your workspace is ${total}, past the ${hard} cloud limit, so LoreCanvas ` +
                'has stopped copying it to the cloud.',
            detail:
                'Nothing is lost — it is still saving everything in this browser. The ' +
                `biggest part is ${largest}. Removing some pasted images is usually the ` +
                'quickest way back under.',
        };
    }

    return {
        tone: 'warn',
        headline: `Your workspace is ${total}. Cloud sync stops at ${hard}.`,
        detail:
            `The biggest part is ${largest}. Pasted images are stored inside the ` +
            'workspace, so they are usually what pushes it up.',
    };
}
