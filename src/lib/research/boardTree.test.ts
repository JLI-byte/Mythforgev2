import { describe, it, expect } from 'vitest';
import {
    breadcrumbFor, childrenOf, descendantIds, canMove, rootBoardIdFor,
    type ResearchBoardNode,
} from './boardTree';

const REG: Record<string, ResearchBoardNode> = {
    'project:p1':        { id: 'project:p1',        name: 'Main',      parentId: null,           projectId: 'p1' },
    'project:p1::siege': { id: 'project:p1::siege', name: 'Siege',     parentId: 'project:p1',   projectId: 'p1' },
    'b-def':             { id: 'b-def',             name: 'Defenders', parentId: 'project:p1::siege', projectId: 'p1' },
    'project:p2':        { id: 'project:p2',        name: 'Main',      parentId: null,           projectId: 'p2' },
};

describe('breadcrumbFor', () => {
    it('walks from the root down to the board itself', () => {
        expect(breadcrumbFor(REG, 'b-def').map(b => b.name)).toEqual(['Main', 'Siege', 'Defenders']);
    });

    it('is just the board when it is a root', () => {
        expect(breadcrumbFor(REG, 'project:p1').map(b => b.name)).toEqual(['Main']);
    });

    it('is empty for a board that is not in the registry', () => {
        expect(breadcrumbFor(REG, 'nope')).toEqual([]);
    });

    it('stops rather than looping when a cycle exists', () => {
        const cyclic: Record<string, ResearchBoardNode> = {
            a: { id: 'a', name: 'A', parentId: 'b', projectId: 'p1' },
            b: { id: 'b', name: 'B', parentId: 'a', projectId: 'p1' },
        };
        expect(breadcrumbFor(cyclic, 'a').length).toBeLessThanOrEqual(2);
    });
});

describe('childrenOf', () => {
    it('lists direct children only, by name', () => {
        expect(childrenOf(REG, 'project:p1').map(b => b.id)).toEqual(['project:p1::siege']);
    });

    it('lists the roots of a project when parentId is null', () => {
        expect(childrenOf(REG, null, 'p1').map(b => b.id)).toEqual(['project:p1']);
    });

    it('is empty for a leaf', () => {
        expect(childrenOf(REG, 'b-def')).toEqual([]);
    });
});

describe('descendantIds', () => {
    it('collects the whole subtree, excluding the board itself', () => {
        expect(descendantIds(REG, 'project:p1').sort()).toEqual(['b-def', 'project:p1::siege']);
    });

    it('is empty for a leaf', () => {
        expect(descendantIds(REG, 'b-def')).toEqual([]);
    });
});

describe('rootBoardIdFor', () => {
    it('finds the project root', () => {
        expect(rootBoardIdFor(REG, 'p1')).toBe('project:p1');
    });

    it('returns null when the project has no board yet', () => {
        expect(rootBoardIdFor(REG, 'p9')).toBeNull();
    });
});

describe('canMove', () => {
    it('refuses to move a board into its own descendant', () => {
        expect(canMove(REG, 'project:p1', 'b-def')).toBe(false);
    });

    it('refuses to move a board into itself', () => {
        expect(canMove(REG, 'b-def', 'b-def')).toBe(false);
    });

    it('allows a move to an unrelated board', () => {
        expect(canMove(REG, 'b-def', 'project:p1')).toBe(true);
    });

    it('allows a move to the root', () => {
        expect(canMove(REG, 'b-def', null)).toBe(true);
    });
});
