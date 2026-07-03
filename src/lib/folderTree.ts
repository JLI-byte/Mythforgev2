/**
 * Folder-tree helpers — LEAF MODULE, no store value imports.
 * Operates on the structural shape of WorldBibleRootConfig entries so it can
 * run against live layouts, drafts, and raw persisted blobs alike.
 */

export interface FolderLike {
    id: string;
    parentId?: string;
    entityTypes?: string[];
}

/** Every id nested underneath folderId (children, grandchildren, …). */
export function getDescendantIds(roots: ReadonlyArray<FolderLike | null | undefined>, folderId: string): Set<string> {
    const valid = roots.filter((r): r is FolderLike => !!r && typeof r === 'object' && typeof r.id === 'string');
    const out = new Set<string>();
    let frontier = [folderId];
    while (frontier.length) {
        const next: string[] = [];
        for (const r of valid) {
            if (r.parentId !== undefined && frontier.includes(r.parentId) && !out.has(r.id)) {
                out.add(r.id);
                next.push(r.id);
            }
        }
        frontier = next;
    }
    return out;
}

/** True when re-parenting folderId under newParentId would make a loop. */
export function wouldCreateCycle(
    roots: ReadonlyArray<FolderLike | null | undefined>,
    folderId: string,
    newParentId: string | undefined,
): boolean {
    if (newParentId === undefined) return false;      // becoming top-level is always safe
    if (newParentId === folderId) return true;        // into itself
    return getDescendantIds(roots, folderId).has(newParentId);
}

/** First folder whose entityTypes contains the type — the default filing rule. */
export function fileByType(
    roots: ReadonlyArray<FolderLike | null | undefined>,
    type: string,
): string | undefined {
    for (const r of roots) {
        if (r && typeof r === 'object' && Array.isArray(r.entityTypes) && r.entityTypes.includes(type)) {
            return r.id;
        }
    }
    return undefined;
}

/** The folder itself plus every descendant — the membership set for counts. */
export function folderMemberSet(
    roots: ReadonlyArray<FolderLike | null | undefined>,
    folderId: string,
): Set<string> {
    const out = getDescendantIds(roots, folderId);
    out.add(folderId);
    return out;
}
