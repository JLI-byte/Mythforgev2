import { describe, it, expect } from 'vitest';
import { intentFor, NUDGE_SMALL, NUDGE_LARGE } from './shortcuts';

const ev = (over: Partial<Parameters<typeof intentFor>[0]> = {}) => ({
    key: 'a', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
    inTextField: false, hasSelection: true, ...over,
});

describe('intentFor', () => {
    it('duplicates on Ctrl+D', () => {
        expect(intentFor(ev({ key: 'd', ctrlKey: true }))).toEqual({ kind: 'duplicate' });
    });

    it('adds another card on Ctrl+Enter', () => {
        expect(intentFor(ev({ key: 'Enter', ctrlKey: true }))).toEqual({ kind: 'addSibling' });
    });

    it('accepts Cmd as well as Ctrl', () => {
        expect(intentFor(ev({ key: 'd', metaKey: true }))).toEqual({ kind: 'duplicate' });
    });

    it('opens search on Ctrl+F', () => {
        expect(intentFor(ev({ key: 'f', ctrlKey: true, hasSelection: false }))).toEqual({ kind: 'search' });
    });

    it('goes to the parent board on Ctrl+U', () => {
        expect(intentFor(ev({ key: 'u', ctrlKey: true, hasSelection: false }))).toEqual({ kind: 'parentBoard' });
    });

    it('nudges by arrow', () => {
        expect(intentFor(ev({ key: 'ArrowRight' }))).toEqual({ kind: 'nudge', dx: NUDGE_SMALL, dy: 0 });
        expect(intentFor(ev({ key: 'ArrowUp' }))).toEqual({ kind: 'nudge', dx: 0, dy: -NUDGE_SMALL });
    });

    it('nudges further with Shift', () => {
        expect(intentFor(ev({ key: 'ArrowLeft', shiftKey: true })))
            .toEqual({ kind: 'nudge', dx: -NUDGE_LARGE, dy: 0 });
    });

    it('deletes on Delete and Backspace', () => {
        expect(intentFor(ev({ key: 'Delete' }))).toEqual({ kind: 'delete' });
        expect(intentFor(ev({ key: 'Backspace' }))).toEqual({ kind: 'delete' });
    });

    it('deselects on Escape', () => {
        expect(intentFor(ev({ key: 'Escape', hasSelection: false }))).toEqual({ kind: 'deselect' });
    });

    it('shows the shortcut sheet on slash', () => {
        expect(intentFor(ev({ key: '/', hasSelection: false }))).toEqual({ kind: 'shortcutSheet' });
    });

    it('groups a selection into a column on Ctrl+G', () => {
        expect(intentFor(ev({ key: 'g', ctrlKey: true }))).toEqual({ kind: 'groupIntoColumn' });
    });

    it('locks on Ctrl+L', () => {
        expect(intentFor(ev({ key: 'l', ctrlKey: true }))).toEqual({ kind: 'toggleLock' });
    });

    it('ignores everything unrecognised', () => {
        expect(intentFor(ev({ key: 'q' }))).toBeNull();
    });

    it('does nothing at all while typing, so a note can contain the word delete', () => {
        for (const key of ['Delete', 'Backspace', 'ArrowLeft', '/', 'd']) {
            expect(intentFor(ev({ key, inTextField: true, ctrlKey: key === 'd' }))).toBeNull();
        }
    });

    it('ignores card actions when nothing is selected', () => {
        expect(intentFor(ev({ key: 'Delete', hasSelection: false }))).toBeNull();
        expect(intentFor(ev({ key: 'd', ctrlKey: true, hasSelection: false }))).toBeNull();
    });
});
