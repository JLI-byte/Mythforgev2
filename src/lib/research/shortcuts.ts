/**
 * LEAF MODULE — the research board keymap.
 *
 * A pure function from a key event to an intent, so the whole map is testable
 * without a DOM and the canvas only has to know how to perform intents.
 *
 * Two guards matter more than any binding. While the caret is in a text field
 * nothing fires, or a note could never contain the word "delete". And card
 * actions need a selection, or Delete with nothing selected would be a silent
 * no-op the writer has to learn by accident.
 */

export const NUDGE_SMALL = 1;
export const NUDGE_LARGE = 10;

export type Intent =
    | { kind: 'duplicate' }
    | { kind: 'addSibling' }
    | { kind: 'search' }
    | { kind: 'parentBoard' }
    | { kind: 'nudge'; dx: number; dy: number }
    | { kind: 'delete' }
    | { kind: 'deselect' }
    | { kind: 'shortcutSheet' }
    | { kind: 'groupIntoColumn' }
    | { kind: 'toggleLock' };

export interface KeyContext {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    /** The caret is in an input, textarea or contenteditable. */
    inTextField: boolean;
    hasSelection: boolean;
}

const NUDGES: Record<string, [number, number]> = {
    ArrowLeft:  [-1,  0],
    ArrowRight: [ 1,  0],
    ArrowUp:    [ 0, -1],
    ArrowDown:  [ 0,  1],
};

export function intentFor(e: KeyContext): Intent | null {
    if (e.inTextField) return null;

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    // Board-level: no selection needed.
    if (mod && key === 'f') return { kind: 'search' };
    if (mod && key === 'u') return { kind: 'parentBoard' };
    if (key === 'Escape')   return { kind: 'deselect' };
    if (key === '/')        return { kind: 'shortcutSheet' };

    // Everything below acts on the selection.
    if (!e.hasSelection) return null;

    if (mod && key === 'd')     return { kind: 'duplicate' };
    if (mod && key === 'g')     return { kind: 'groupIntoColumn' };
    if (mod && key === 'l')     return { kind: 'toggleLock' };
    if (mod && key === 'Enter') return { kind: 'addSibling' };

    if (key === 'Delete' || key === 'Backspace') return { kind: 'delete' };

    const nudge = NUDGES[key];
    if (nudge) {
        const step = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
        return { kind: 'nudge', dx: nudge[0] * step, dy: nudge[1] * step };
    }

    return null;
}
