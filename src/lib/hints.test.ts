import { describe, it, expect } from 'vitest';
import { HINTS, HINTS_ALL_DISMISSED, nextHintFor } from './hints';

const onboarded = { hasOnboarded: true };

describe('HINTS', () => {
    it('teaches exactly the four invisible features', () => {
        expect(HINTS.map(h => h.id)).toEqual([
            'desk-canvas-draw',
            'writing-column-resize',
            'entity-link',
            'shelf-drag',
        ]);
    });

    it('gives every hint a surface, a title and a body', () => {
        for (const h of HINTS) {
            expect(['desk', 'editor', 'bookshelf']).toContain(h.surface);
            expect(h.title.length).toBeGreaterThan(0);
            expect(h.body.length).toBeGreaterThan(0);
        }
    });

    it('uses no id that collides with the dismiss-everything sentinel', () => {
        expect(HINTS.map(h => h.id)).not.toContain(HINTS_ALL_DISMISSED);
    });
});

describe('nextHintFor', () => {
    it('shows nothing before first run is finished', () => {
        expect(nextHintFor('desk', [], { hasOnboarded: false })).toBeNull();
    });

    it('offers the first hint on its own surface', () => {
        expect(nextHintFor('desk', [], onboarded)?.id).toBe('desk-canvas-draw');
    });

    it('offers nothing on a surface whose turn has not come', () => {
        expect(nextHintFor('bookshelf', [], onboarded)).toBeNull();
        expect(nextHintFor('editor', [], onboarded)).toBeNull();
    });

    it('advances to the next hint once one is dismissed', () => {
        expect(nextHintFor('desk', ['desk-canvas-draw'], onboarded)?.id)
            .toBe('writing-column-resize');
    });

    it('moves to the next surface once that surface is exhausted', () => {
        const dismissed = ['desk-canvas-draw', 'writing-column-resize'];
        expect(nextHintFor('desk', dismissed, onboarded)).toBeNull();
        expect(nextHintFor('editor', dismissed, onboarded)?.id).toBe('entity-link');
    });

    it('shows nothing anywhere once every hint is dismissed', () => {
        const all = HINTS.map(h => h.id);
        expect(nextHintFor('desk', all, onboarded)).toBeNull();
        expect(nextHintFor('editor', all, onboarded)).toBeNull();
        expect(nextHintFor('bookshelf', all, onboarded)).toBeNull();
    });

    it('shows nothing anywhere once the writer opts out', () => {
        const optedOut = [HINTS_ALL_DISMISSED];
        expect(nextHintFor('desk', optedOut, onboarded)).toBeNull();
        expect(nextHintFor('editor', optedOut, onboarded)).toBeNull();
        expect(nextHintFor('bookshelf', optedOut, onboarded)).toBeNull();
    });

    it('ignores dismissed ids it does not recognise', () => {
        expect(nextHintFor('desk', ['gone-in-a-later-version'], onboarded)?.id)
            .toBe('desk-canvas-draw');
    });
});
