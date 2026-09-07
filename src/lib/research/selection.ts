/**
 * LEAF MODULE — marquee selection and group edits.
 *
 * Dragging a box on empty canvas selects what it touches, rather than creating
 * a card. Once several cards are selected they move, delete and group as one.
 *
 * Locking is honoured differently by each operation, and deliberately: a locked
 * card can still be SELECTED (you have to select it to unlock it) but will not
 * move and will not be deleted. Locking that could be undone by a stray marquee
 * would not be locking.
 */

import type { DeskWidget } from '@/store/workspaceStore';

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

/**
 * Below this the drag was a click with a shaky hand. A marquee that fires on a
 * two-pixel wobble would clear the selection every time someone clicks away.
 */
export const MARQUEE_MIN_DRAG = 5;

/** Normalise two drag corners into a rect with positive width and height. */
export function rectFromDrag(start: Point, end: Point): Rect {
    return {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
    };
}

export function isMarqueeDrag(rect: Rect): boolean {
    return rect.width >= MARQUEE_MIN_DRAG || rect.height >= MARQUEE_MIN_DRAG;
}

/**
 * Ids of the free canvas cards the rect touches.
 *
 * Overlap, not containment: a marquee that only took fully-enclosed cards
 * would miss the one you were most obviously reaching for at the edge.
 *
 * Skips cards a column lays out and cards that are docked — neither sits in
 * canvas coordinates, so testing them against a canvas rect is meaningless.
 */
export function widgetsInRect(widgets: DeskWidget[], rect: Rect): string[] {
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;

    return widgets
        .filter(w => !w.parentId && !w.dock)
        .filter(w =>
            w.x < right &&
            w.x + w.width > rect.x &&
            w.y < bottom &&
            w.y + w.height > rect.y,
        )
        .map(w => w.id);
}

/** Shift the selection by a delta. Locked cards stay put. */
export function moveWidgets(
    widgets: DeskWidget[],
    ids: string[],
    dx: number,
    dy: number,
): DeskWidget[] {
    if (ids.length === 0) return widgets;
    const moving = new Set(ids);

    return widgets.map(w =>
        moving.has(w.id) && !w.locked
            ? { ...w, x: w.x + dx, y: w.y + dy }
            : w,
    );
}

/**
 * Remove the selection. Deleting a column takes its children too — they are
 * laid out by the column, so leaving them behind would strand cards at
 * whatever x/y they last had on the free canvas, which is usually 0,0.
 */
export function deleteWidgets(widgets: DeskWidget[], ids: string[]): DeskWidget[] {
    if (ids.length === 0) return widgets;

    const doomed = new Set(
        ids.filter(id => !widgets.find(w => w.id === id)?.locked),
    );
    for (const w of widgets) {
        if (w.parentId && doomed.has(w.parentId)) doomed.add(w.id);
    }

    return widgets.filter(w => !doomed.has(w.id));
}
