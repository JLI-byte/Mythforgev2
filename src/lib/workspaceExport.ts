/**
 * Workspace data export — LEAF MODULE (no store, no React, no network).
 *
 * Builds the single JSON file a writer takes with them. Two rules shape it:
 *
 *  - It must be complete. Everything the app persists goes in, verbatim, so the
 *    file is a real copy rather than a summary.
 *  - It must be honest. The envelope says what format it is, when it was made,
 *    which account it came from, what is inside it, and — the part that is
 *    usually missing — what is NOT inside it.
 *
 * The caller passes the already-partialized workspace, which keeps this module
 * free of any store import.
 */

export const EXPORT_FORMAT = 'lorecanvas-workspace-export';

/** Bump only when the envelope shape changes, never for a store schema change. */
export const EXPORT_FORMAT_VERSION = 1;

/**
 * The zustand persist schema version the export stamps onto the file.
 *
 * This mirrors the `version:` literal in the persist config of
 * src/store/workspaceStore.ts. It lives here rather than being imported from
 * the store because this is a leaf module and the store pulls in React and
 * zustand. workspaceExport.test.ts reads the store source and fails if the two
 * numbers ever drift, so the mirror cannot rot silently.
 */
export const WORKSPACE_SCHEMA_VERSION = 4;

/** Written into every export so the file itself states its own limits. */
export const NOT_INCLUDED = [
    'Local backup snapshots (the lorecanvas-backup-* entries in this browser). Those are copies of older versions of the same data.',
    'Beta feedback you have submitted. That is stored separately and is not part of your workspace.',
    'Your account itself — this file cannot sign you in. It is your writing, not your credentials.',
    'Files you have already exported from LoreCanvas as .docx, .epub or .md.',
] as const;

export interface WorkspaceExportMeta {
    schemaVersion: number;
    /** ISO timestamp. Passed in rather than read from the clock, so this stays pure. */
    exportedAt: string;
    userId?: string;
    email?: string;
}

export interface WorkspaceExport {
    format: string;
    formatVersion: number;
    exportedAt: string;
    schemaVersion: number;
    account: { userId?: string; email?: string } | null;
    contents: string[];
    notIncluded: readonly string[];
    workspace: Record<string, unknown>;
}

export function buildWorkspaceExport(
    workspace: Record<string, unknown>,
    meta: WorkspaceExportMeta,
): WorkspaceExport {
    const account = meta.userId || meta.email
        ? {
            ...(meta.userId ? { userId: meta.userId } : {}),
            ...(meta.email ? { email: meta.email } : {}),
        }
        : null;

    return {
        format: EXPORT_FORMAT,
        formatVersion: EXPORT_FORMAT_VERSION,
        exportedAt: meta.exportedAt,
        schemaVersion: meta.schemaVersion,
        account,
        contents: Object.keys(workspace),
        notIncluded: NOT_INCLUDED,
        workspace,
    };
}

/** The filename a writer sees in their downloads folder. */
export function exportFileName(exportedAt: string): string {
    return `lorecanvas-export-${exportedAt.slice(0, 10)}.json`;
}
