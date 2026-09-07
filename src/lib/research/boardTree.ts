/**
 * LEAF MODULE — the research board tree.
 *
 * A board's id is whatever key it already has in researchStates, so nesting was
 * added without moving a single board. Legacy ids look like `project:<id>` or
 * `project:<id>::<boardId>`; new boards get a UUID. Nothing reads meaning out
 * of an id — the registry's parentId is the only thing that describes shape.
 *
 * No store import beyond types, no React, 4-space indent.
 */

export interface ResearchBoardNode {
    id: string;
    name: string;
    /** null = a project's root board. */
    parentId: string | null;
    projectId: string;
}

export type BoardRegistry = Record<string, ResearchBoardNode>;

/** Guards every parent walk. Deeper than this is a cycle or a mistake. */
const MAX_DEPTH = 32;

/** Root first, the board itself last. Empty if the board is unknown. */
export function breadcrumbFor(reg: BoardRegistry, boardId: string): ResearchBoardNode[] {
    const path: ResearchBoardNode[] = [];
    const seen = new Set<string>();
    let cursor: string | null = boardId;

    while (cursor && path.length < MAX_DEPTH) {
        if (seen.has(cursor)) break;   // a cycle: stop rather than hang
        seen.add(cursor);
        const node: ResearchBoardNode | undefined = reg[cursor];
        if (!node) break;
        path.unshift(node);
        cursor = node.parentId;
    }
    return path;
}

/**
 * Direct children, name-sorted. Pass parentId null with a projectId to list
 * that project's roots.
 */
export function childrenOf(
    reg: BoardRegistry,
    parentId: string | null,
    projectId?: string,
): ResearchBoardNode[] {
    return Object.values(reg)
        .filter(n => n.parentId === parentId && (parentId !== null || !projectId || n.projectId === projectId))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every board beneath this one, at any depth. Excludes the board itself. */
export function descendantIds(reg: BoardRegistry, boardId: string): string[] {
    const out: string[] = [];
    const queue = [boardId];
    const seen = new Set<string>([boardId]);

    while (queue.length) {
        const current = queue.shift()!;
        for (const node of Object.values(reg)) {
            if (node.parentId !== current || seen.has(node.id)) continue;
            seen.add(node.id);
            out.push(node.id);
            queue.push(node.id);
        }
    }
    return out;
}

export function rootBoardIdFor(reg: BoardRegistry, projectId: string): string | null {
    const root = Object.values(reg).find(n => n.projectId === projectId && n.parentId === null);
    return root ? root.id : null;
}

/** A board cannot be moved into itself or anything below it. */
export function canMove(reg: BoardRegistry, boardId: string, targetParentId: string | null): boolean {
    if (targetParentId === null) return true;
    if (targetParentId === boardId) return false;
    return !descendantIds(reg, boardId).includes(targetParentId);
}
