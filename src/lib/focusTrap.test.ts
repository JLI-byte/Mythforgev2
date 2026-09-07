import { describe, it, expect } from 'vitest';
import { FOCUSABLE_SELECTOR, initialTrapIndex, nextTrapIndex } from './focusTrap';

describe('nextTrapIndex', () => {
    it('steps forward through the middle of the list', () => {
        expect(nextTrapIndex(5, 2, false)).toBe(3);
    });

    it('steps backward through the middle of the list', () => {
        expect(nextTrapIndex(5, 2, true)).toBe(1);
    });

    it('wraps forward from the last element to the first', () => {
        expect(nextTrapIndex(5, 4, false)).toBe(0);
    });

    it('wraps backward from the first element to the last', () => {
        expect(nextTrapIndex(5, 0, true)).toBe(4);
    });

    it('pulls focus in from outside the dialog to the first element', () => {
        expect(nextTrapIndex(5, -1, false)).toBe(0);
    });

    it('pulls focus in from outside backwards to the last element', () => {
        expect(nextTrapIndex(5, -1, true)).toBe(4);
    });

    it('returns -1 when the dialog has nothing focusable', () => {
        expect(nextTrapIndex(0, -1, false)).toBe(-1);
        expect(nextTrapIndex(0, 3, true)).toBe(-1);
    });
});

describe('initialTrapIndex', () => {
    it('honours an element the dialog marked as its own first stop', () => {
        expect(initialTrapIndex(4, 2)).toBe(2);
    });

    it('falls back to the first element when nothing is marked, or the mark is stale', () => {
        expect(initialTrapIndex(4, -1)).toBe(0);
        expect(initialTrapIndex(4, 9)).toBe(0);
        expect(initialTrapIndex(0, -1)).toBe(-1);
    });
});

describe('FOCUSABLE_SELECTOR', () => {
    it('excludes disabled controls and tabindex="-1"', () => {
        expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
        expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
    });
});
