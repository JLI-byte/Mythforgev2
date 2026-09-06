import { describe, it, expect } from 'vitest';
import {
    childrenOfColumn, addToColumn, removeFromColumn, reorderInColumn,
    groupIntoColumn, columnCount, isFreeOnCanvas,
} from './columns';
import type { DeskWidget } from '@/store/workspaceStore';

const w = (id: string, over: Partial<DeskWidget> = {}): DeskWidget => ({
    id, type: 'sticky', x: 10, y: 10, width: 200, height: 160, content: { text: id }, ...over,
});

describe('childrenOfColumn', () => {
    it('returns only that column’s children, in columnOrder', () => {
        const ws = [
            w('c1', { type: 'column' }),
            w('b', { parentId: 'c1', columnOrder: 1 }),
            w('a', { parentId: 'c1', columnOrder: 0 }),
            w('x', { parentId: 'c2', columnOrder: 0 }),
            w('loose'),
        ];
        expect(childrenOfColumn(ws, 'c1').map(c => c.id)).toEqual(['a', 'b']);
    });

    it('is empty for a column with no children', () => {
        expect(childrenOfColumn([w('c1', { type: 'column' })], 'c1')).toEqual([]);
    });

    it('puts a child with no columnOrder last rather than dropping it', () => {
        const ws = [w('a', { parentId: 'c1', columnOrder: 0 }), w('b', { parentId: 'c1' })];
        expect(childrenOfColumn(ws, 'c1').map(c => c.id)).toEqual(['a', 'b']);
    });
});

describe('columnCount', () => {
    it('counts the children', () => {
        const ws = [w('a', { parentId: 'c1' }), w('b', { parentId: 'c1' }), w('z')];
        expect(columnCount(ws, 'c1')).toBe(2);
    });
});

describe('isFreeOnCanvas', () => {
    it('is true for a card with no parent', () => {
        expect(isFreeOnCanvas(w('a'))).toBe(true);
    });
    it('is false for a card in a column', () => {
        expect(isFreeOnCanvas(w('a', { parentId: 'c1' }))).toBe(false);
    });
});

describe('addToColumn', () => {
    it('appends and stamps parentId plus the next order', () => {
        const ws = [w('c1', { type: 'column' }), w('a', { parentId: 'c1', columnOrder: 0 }), w('n')];
        const r = addToColumn(ws, 'n', 'c1');
        const moved = r.find(x => x.id === 'n')!;
        expect(moved.parentId).toBe('c1');
        expect(moved.columnOrder).toBe(1);
    });

    it('inserts at an index and renumbers the rest', () => {
        const ws = [
            w('c1', { type: 'column' }),
            w('a', { parentId: 'c1', columnOrder: 0 }),
            w('b', { parentId: 'c1', columnOrder: 1 }),
            w('n'),
        ];
        const r = addToColumn(ws, 'n', 'c1', 0);
        expect(childrenOfColumn(r, 'c1').map(c => c.id)).toEqual(['n', 'a', 'b']);
    });

    it('refuses to put a column inside a column', () => {
        const ws = [w('c1', { type: 'column' }), w('c2', { type: 'column' })];
        expect(addToColumn(ws, 'c2', 'c1')).toEqual(ws);
    });

    it('is a no-op for an unknown card', () => {
        const ws = [w('c1', { type: 'column' })];
        expect(addToColumn(ws, 'nope', 'c1')).toEqual(ws);
    });
});

describe('removeFromColumn', () => {
    it('clears the parent and places the card at the drop point', () => {
        const ws = [w('c1', { type: 'column' }), w('a', { parentId: 'c1', columnOrder: 0 })];
        const r = removeFromColumn(ws, 'a', { x: 300, y: 120 });
        const freed = r.find(x => x.id === 'a')!;
        expect(freed.parentId ?? null).toBeNull();
        expect(freed.columnOrder).toBeUndefined();
        expect(freed).toMatchObject({ x: 300, y: 120 });
    });

    it('renumbers what is left behind', () => {
        const ws = [
            w('c1', { type: 'column' }),
            w('a', { parentId: 'c1', columnOrder: 0 }),
            w('b', { parentId: 'c1', columnOrder: 1 }),
        ];
        const r = removeFromColumn(ws, 'a', { x: 0, y: 0 });
        expect(childrenOfColumn(r, 'c1').map(c => [c.id, c.columnOrder])).toEqual([['b', 0]]);
    });
});

describe('reorderInColumn', () => {
    it('restamps order from the given id list', () => {
        const ws = [
            w('c1', { type: 'column' }),
            w('a', { parentId: 'c1', columnOrder: 0 }),
            w('b', { parentId: 'c1', columnOrder: 1 }),
        ];
        const r = reorderInColumn(ws, 'c1', ['b', 'a']);
        expect(childrenOfColumn(r, 'c1').map(c => c.id)).toEqual(['b', 'a']);
    });

    it('ignores ids that are not in that column, rather than adopting them', () => {
        const ws = [
            w('c1', { type: 'column' }),
            w('a', { parentId: 'c1', columnOrder: 0 }),
            w('stray'),
        ];
        const r = reorderInColumn(ws, 'c1', ['stray', 'a']);
        expect(childrenOfColumn(r, 'c1').map(c => c.id)).toEqual(['a']);
        expect(r.find(x => x.id === 'stray')!.parentId ?? null).toBeNull();
    });
});

describe('groupIntoColumn', () => {
    it('creates a column and adopts the selection in the given order', () => {
        const ws = [w('a'), w('b'), w('c')];
        const r = groupIntoColumn(ws, ['a', 'b'], { x: 50, y: 60 }, 'col-1');
        const col = r.find(x => x.id === 'col-1')!;
        expect(col.type).toBe('column');
        expect(col).toMatchObject({ x: 50, y: 60 });
        expect(childrenOfColumn(r, 'col-1').map(c => c.id)).toEqual(['a', 'b']);
        expect(r.find(x => x.id === 'c')!.parentId ?? null).toBeNull();
    });

    it('skips columns in the selection, since columns cannot nest', () => {
        const ws = [w('a'), w('c2', { type: 'column' })];
        const r = groupIntoColumn(ws, ['a', 'c2'], { x: 0, y: 0 }, 'col-1');
        expect(childrenOfColumn(r, 'col-1').map(c => c.id)).toEqual(['a']);
    });

    it('does nothing when the selection holds no groupable card', () => {
        const ws = [w('c2', { type: 'column' })];
        expect(groupIntoColumn(ws, ['c2'], { x: 0, y: 0 }, 'col-1')).toEqual(ws);
    });
});
