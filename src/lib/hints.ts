/**
 * Contextual hints — LEAF MODULE (no store, no React import).
 *
 * Four features in LoreCanvas have no affordance at all: you either know they
 * are there or you never find them. This is the whole teaching layer for them.
 * There is no tour, no docs site and no help menu — a hint appears once, at
 * first contact, and never again after it is closed.
 *
 * Only these four. Everything else that looked like a candidate was either
 * already labelled, already visible, or deleted in an earlier phase; see the
 * Phase 7 plan for what was ruled out and why.
 *
 * The catalogue is in teaching order and a hint is offered only when it is the
 * first undismissed one in the list. That single rule is what keeps two
 * bubbles off the screen at once without any component knowing about any
 * other component.
 */

export type HintSurface = 'desk' | 'editor' | 'bookshelf';

export interface Hint {
    id: string;
    surface: HintSurface;
    title: string;
    body: string;
}

/** Stored in dismissedHints when the writer asks for no more hints at all. */
export const HINTS_ALL_DISMISSED = '*';

export const HINTS: Hint[] = [
    {
        id: 'desk-canvas-draw',
        surface: 'desk',
        title: 'Drag out a space',
        body: 'Drag a box on the empty canvas to place a card exactly where you want it. Hold Shift and drag to move the canvas itself.',
    },
    {
        id: 'writing-column-resize',
        surface: 'desk',
        title: 'The column is yours to size',
        body: 'Drag the left or right edge of the writing column to change how wide the page is. It stays that width next time.',
    },
    {
        id: 'entity-link',
        surface: 'editor',
        title: 'Link people and places as you write',
        body: 'Type [[ in the manuscript to link a World Bible article. If the name is new, it offers to create the article there and then.',
    },
    {
        id: 'shelf-drag',
        surface: 'bookshelf',
        title: 'Books move between shelves',
        body: 'Drag a book onto another shelf to re-file it. Its chapters, scenes and lore go with it.',
    },
];

/**
 * The hint due on this surface, or null. Null means one of four things: first
 * run is not finished, the writer opted out, everything is dismissed, or the
 * next hint belongs to a different surface.
 */
export function nextHintFor(
    surface: HintSurface,
    dismissed: string[],
    opts: { hasOnboarded: boolean },
): Hint | null {
    if (!opts.hasOnboarded) return null;
    if (dismissed.includes(HINTS_ALL_DISMISSED)) return null;
    const next = HINTS.find(h => !dismissed.includes(h.id));
    if (!next || next.surface !== surface) return null;
    return next;
}
