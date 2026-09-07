import { describe, it, expect } from 'vitest';
import {
    rectFromDrag, widgetsInRect, moveWidgets, deleteWidgets, isMarqueeDrag, MARQUEE_MIN_DRAG,
} from './selection';
import type { DeskWidget } from '@/store/workspaceStore';

const w = (id: string, over: Partial<DeskWidget> = {}): DeskWidget => ({
    id, type: 'sticky', x: 100, y: 100, width: 100, height: 100, content: {}, ...over,
});

describe('rectFromDrag', () => {
    it('builds a rect from a top-left to bottom-right drag', () => {
        expect(rectFromDrag({ x: 10, y: 20 }, { x: 110, y: 220 }))
            .toEqual({ x: 10, y: 20, width: 100, height: 200 });
    });

    it('normalises a drag made upward and to the left', () => {
        expect(rectFromDrag({ x: 110, y: 220 }, { x: 10, y: 20 }))
            .toEqual({ x: 10, y: 20, width: 100, height: 200 });
    });

    it('gives a zero-area rect for a click, not a negative one', () => {
        expect(rectFromDrag({ x: 5, y: 5 }, { x: 5, y: 5 }))
            .toEqual({ x: 5, y: 5, width: 0, height: 0 });
    });
});

describe('isMarqueeDrag', () => {
    it('is false for a click, so a click still just deselects', () => {
        expect(isMarqueeDrag({ x: 0, y: 0, width: 0, height: 0 })).toBe(false);
    });

    it('is false for a tremor below the threshold', () => {
        expect(isMarqueeDrag({ x: 0, y: 0, width: MARQUEE_MIN_DRAG - 1, height: MARQUEE_MIN_DRAG - 1 })).toBe(false);
    });

    it('is true once either edge clears the threshold', () => {
        expect(isMarqueeDrag({ x: 0, y: 0, width: MARQUEE_MIN_DRAG, height: 1 })).toBe(true);
        expect(isMarqueeDrag({ x: 0, y: 0, width: 1, height: MARQUEE_MIN_DRAG })).toBe(true);
    });
});

describe('widgetsInRect', () => {
    const widgets = [
        w('inside',   { x: 100, y: 100 }),
        w('overlaps', { x: 190, y: 190 }),   // corner clips the rect
        w('outside',  { x: 900, y: 900 }),
    ];
    const rect = { x: 50, y: 50, width: 150, height: 150 };

    it('takes a card fully inside', () => {
        expect(widgetsInRect(widgets, rect)).toContain('inside');
    });

    it('takes a card that merely overlaps — a marquee is not a containment test', () => {
        expect(widgetsInRect(widgets, rect)).toContain('overlaps');
    });

    it('leaves a card entirely outside', () => {
        expect(widgetsInRect(widgets, rect)).not.toContain('outside');
    });

    it('ignores a card inside a column, which the column lays out', () => {
        const ws = [w('kid', { x: 100, y: 100, parentId: 'col-1' })];
        expect(widgetsInRect(ws, rect)).toEqual([]);
    });

    it('ignores a docked card, which does not live in canvas coordinates', () => {
        const ws = [w('docked', { x: 100, y: 100, dock: 'center' })];
        expect(widgetsInRect(ws, rect)).toEqual([]);
    });

    it('still takes a locked card, so it can be selected and unlocked', () => {
        const ws = [w('locked', { x: 100, y: 100, locked: true })];
        expect(widgetsInRect(ws, rect)).toEqual(['locked']);
    });

    it('is empty for a rect touching nothing', () => {
        expect(widgetsInRect(widgets, { x: 0, y: 0, width: 1, height: 1 })).toEqual([]);
    });
});

describe('moveWidgets', () => {
    it('shifts every selected card by the delta', () => {
        const r = moveWidgets([w('a'), w('b', { x: 300 })], ['a', 'b'], 10, -20);
        expect(r.find(x => x.id === 'a')).toMatchObject({ x: 110, y: 80 });
        expect(r.find(x => x.id === 'b')).toMatchObject({ x: 310, y: 80 });
    });

    it('leaves unselected cards where they are', () => {
        const r = moveWidgets([w('a'), w('b')], ['a'], 10, 10);
        expect(r.find(x => x.id === 'b')).toMatchObject({ x: 100, y: 100 });
    });

    it('refuses to move a locked card, even inside a group', () => {
        const r = moveWidgets([w('a'), w('pinned', { locked: true })], ['a', 'pinned'], 10, 10);
        expect(r.find(x => x.id === 'a')).toMatchObject({ x: 110 });
        expect(r.find(x => x.id === 'pinned')).toMatchObject({ x: 100 });
    });

    it('is a no-op for an empty selection', () => {
        const ws = [w('a')];
        expect(moveWidgets(ws, [], 10, 10)).toEqual(ws);
    });
});

describe('deleteWidgets', () => {
    it('removes every selected card', () => {
        expect(deleteWidgets([w('a'), w('b'), w('c')], ['a', 'c']).map(x => x.id)).toEqual(['b']);
    });

    it('takes a column’s children with it, or they would be orphaned off-canvas', () => {
        const ws = [w('col', { type: 'column' }), w('kid', { parentId: 'col' }), w('loose')];
        expect(deleteWidgets(ws, ['col']).map(x => x.id)).toEqual(['loose']);
    });

    it('keeps a locked card, which is what locking is for', () => {
        const ws = [w('a'), w('pinned', { locked: true })];
        expect(deleteWidgets(ws, ['a', 'pinned']).map(x => x.id)).toEqual(['pinned']);
    });

    it('is a no-op for an empty selection', () => {
        const ws = [w('a')];
        expect(deleteWidgets(ws, [])).toEqual(ws);
    });
});
