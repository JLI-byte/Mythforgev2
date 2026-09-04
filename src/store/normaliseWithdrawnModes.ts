/* eslint-disable @typescript-eslint/no-explicit-any -- raw persisted blobs are
   untyped by design at the migration boundary. */

/**
 * Phase 1 withdrew the Screenplay, Script/Report, Lyrics and Visual Novel work
 * types. Projects created under them still carry their writingMode, which now
 * names a mode that does not exist.
 *
 * Nothing breaks without this — pickZone already falls back to the story zone —
 * but the stored value would be a claim about the product that is no longer
 * true. This rewrites it once. Manuscript content is never touched: a
 * screenplay's scenes are still its scenes, now opened in the story editor.
 */

const WITHDRAWN = new Set(['screenplay', 'markdown', 'poetry', 'visual-novel']);

export function normaliseWithdrawnModes(data: Record<string, any>): Record<string, any> {
    if (!Array.isArray(data.projects)) return data;

    let changed = false;
    const projects = data.projects.map((p: any) => {
        if (!p || !WITHDRAWN.has(p.writingMode)) return p;
        changed = true;
        return { ...p, writingMode: 'novel' };
    });

    return changed ? { ...data, projects } : data;
}
