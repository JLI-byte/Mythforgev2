import { describe, it, expect } from 'vitest';
import {
    LABEL_COLORS, makeLabel, applyLabel, removeLabel, filterByLabels,
    labelsOn, canManipulate, toggleLock,
} from './labels';
import type { DeskWidget } from '@/store/workspaceStore';

const w = (id: string, over: Partial<DeskWidget> = {}): DeskWidget => ({
    id, type: 'sticky', x: 0, y: 0, width: 100, height: 100, content: {}, ...over,
});

describe('makeLabel', () => {
    it('takes a colour from the palette by index', () => {
        expect(makeLabel('l1', 'Verified', 0).color).toBe(LABEL_COLORS[0]);
    });
    it('wraps past the end of the palette rather than going undefined', () => {
        expect(makeLabel('l1', 'X', LABEL_COLORS.length).color).toBe(LABEL_COLORS[0]);
    });
});

describe('applyLabel', () => {
    it('adds a label id to a card', () => {
        const r = applyLabel([w('a')], 'a', 'l1');
        expect(r[0].labelIds).toEqual(['l1']);
    });
    it('does not duplicate an id already present', () => {
        const r = applyLabel([w('a', { labelIds: ['l1'] })], 'a', 'l1');
        expect(r[0].labelIds).toEqual(['l1']);
    });
    it('is a no-op for an unknown card', () => {
        const ws = [w('a')];
        expect(applyLabel(ws, 'nope', 'l1')).toEqual(ws);
    });
});

describe('removeLabel', () => {
    it('takes the id off', () => {
        const r = removeLabel([w('a', { labelIds: ['l1', 'l2'] })], 'a', 'l1');
        expect(r[0].labelIds).toEqual(['l2']);
    });
    it('is a no-op when the card does not carry it', () => {
        const ws = [w('a', { labelIds: ['l2'] })];
        expect(removeLabel(ws, 'a', 'l1')[0].labelIds).toEqual(['l2']);
    });
});

describe('labelsOn', () => {
    it('resolves a card’s ids to labels, skipping ones that were deleted', () => {
        const labels = [makeLabel('l1', 'A', 0), makeLabel('l2', 'B', 1)];
        expect(labelsOn(w('a', { labelIds: ['l2', 'gone'] }), labels).map(l => l.name)).toEqual(['B']);
    });
});

describe('filterByLabels', () => {
    it('returns everything when no filter is active', () => {
        const ws = [w('a', { labelIds: ['l1'] }), w('b')];
        expect(filterByLabels(ws, []).map(x => x.id)).toEqual(['a', 'b']);
    });
    it('keeps a card carrying any one of the selected labels', () => {
        const ws = [w('a', { labelIds: ['l1'] }), w('b', { labelIds: ['l2'] }), w('c')];
        expect(filterByLabels(ws, ['l1', 'l2']).map(x => x.id)).toEqual(['a', 'b']);
    });
    it('keeps a column whose child matches, or the child would float loose', () => {
        const ws = [
            w('col', { type: 'column' }),
            w('kid', { parentId: 'col', labelIds: ['l1'] }),
            w('other'),
        ];
        expect(filterByLabels(ws, ['l1']).map(x => x.id).sort()).toEqual(['col', 'kid']);
    });
});

describe('canManipulate', () => {
    it('is true for an ordinary card', () => {
        expect(canManipulate(w('a'))).toBe(true);
    });
    it('is false for a locked card', () => {
        expect(canManipulate(w('a', { locked: true }))).toBe(false);
    });
});

describe('toggleLock', () => {
    it('locks an unlocked card and unlocks a locked one', () => {
        const once = toggleLock([w('a')], 'a');
        expect(once[0].locked).toBe(true);
        expect(toggleLock(once, 'a')[0].locked).toBe(false);
    });
});
