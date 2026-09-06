/**
 * LEAF MODULE — derive the board registry from the shape research boards had
 * before they could nest.
 *
 * Board data is NOT touched. researchStates keeps its keys; this only works out
 * what each key means. Legacy keys are `project:<id>` (a root) and
 * `project:<id>::<boardId>` (its child, named in customBoards).
 *
 * World-scoped keys are skipped: the This Project / This World switcher was
 * removed in 522995a, so those boards have no screen. They stay in
 * researchStates untouched, ready for whatever replaces that switcher.
 */

import type { BoardRegistry, ResearchBoardNode } from './boardTree';

const PROJECT_PREFIX = 'project:';
const CHILD_SEPARATOR = '::';

/** Name used when a composite key has no matching customBoards entry. */
export const ORPHAN_BOARD_NAME = 'Untitled board';

/** Name given to a project's root board. */
export const ROOT_BOARD_NAME = 'Main';

interface LegacyBoard { id: string; name: string }

export function buildRegistry(
    researchStates: Record<string, unknown>,
    customBoards: Record<string, LegacyBoard[]>,
): BoardRegistry {
    const reg: BoardRegistry = {};

    const ensureRoot = (projectId: string): string => {
        const rootId = `${PROJECT_PREFIX}${projectId}`;
        if (!reg[rootId]) {
            reg[rootId] = { id: rootId, name: ROOT_BOARD_NAME, parentId: null, projectId };
        }
        return rootId;
    };

    for (const key of Object.keys(researchStates)) {
        if (!key.startsWith(PROJECT_PREFIX)) continue;   // world: and anything else

        const body = key.slice(PROJECT_PREFIX.length);
        const sep = body.indexOf(CHILD_SEPARATOR);

        if (sep === -1) {
            ensureRoot(body);
            continue;
        }

        const projectId = body.slice(0, sep);
        const childId = body.slice(sep + CHILD_SEPARATOR.length);
        const parentId = ensureRoot(projectId);
        const named = (customBoards[parentId] ?? []).find(b => b.id === childId);

        const node: ResearchBoardNode = {
            id: key,
            name: named ? named.name : ORPHAN_BOARD_NAME,
            parentId,
            projectId,
        };
        reg[key] = node;
    }

    return reg;
}
