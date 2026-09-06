/**
 * LEAF MODULE — columns on a research board.
 *
 * A column is a widget. Its children are ordinary widgets carrying parentId,
 * so the board's widget list stays FLAT: search, the dossier and every existing
 * traversal keep working without knowing columns exist.
 *
 * Columns cannot nest. Milanote has the same rule, and it is what stops a board
 * turning into a tree nobody can scan.
 */

import type { DeskWidget } from '@/store/workspaceStore';

export const COLUMN_WIDTH = 260;
export const COLUMN_MIN_HEIGHT = 140;

export function isFreeOnCanvas(widget: DeskWidget): boolean {
    return !widget.parentId;
}

/** That column's children, in columnOrder. Anything unnumbered sorts last. */
export function childrenOfColumn(widgets: DeskWidget[], columnId: string): DeskWidget[] {
    return widgets
        .filter(w => w.parentId === columnId)
        .sort((a, b) => (a.columnOrder ?? Number.MAX_SAFE_INTEGER) - (b.columnOrder ?? Number.MAX_SAFE_INTEGER));
}

export function columnCount(widgets: DeskWidget[], columnId: string): number {
    return widgets.reduce((n, w) => (w.parentId === columnId ? n + 1 : n), 0);
}

/** Renumber a column's children 0..n-1 in their current order. */
function restamp(widgets: DeskWidget[], columnId: string): DeskWidget[] {
    const order = new Map(childrenOfColumn(widgets, columnId).map((w, i) => [w.id, i]));
    return widgets.map(w => (order.has(w.id) ? { ...w, columnOrder: order.get(w.id) } : w));
}

/** Move a card into a column, optionally at an index. Columns are refused. */
export function addToColumn(
    widgets: DeskWidget[],
    widgetId: string,
    columnId: string,
    atIndex?: number,
): DeskWidget[] {
    const moving = widgets.find(w => w.id === widgetId);
    if (!moving || moving.type === 'column') return widgets;

    const siblings = childrenOfColumn(widgets, columnId).filter(w => w.id !== widgetId);
    const index = atIndex === undefined ? siblings.length : Math.max(0, Math.min(atIndex, siblings.length));

    const ids = siblings.map(w => w.id);
    ids.splice(index, 0, widgetId);
    const rank = new Map(ids.map((id, i) => [id, i]));

    return widgets.map(w =>
        rank.has(w.id)
            ? { ...w, parentId: columnId, columnOrder: rank.get(w.id) }
            : w,
    );
}

/** Take a card out of its column and drop it on the canvas at `at`. */
export function removeFromColumn(
    widgets: DeskWidget[],
    widgetId: string,
    at: { x: number; y: number },
): DeskWidget[] {
    const moving = widgets.find(w => w.id === widgetId);
    if (!moving || !moving.parentId) return widgets;
    const columnId = moving.parentId;

    const freed = widgets.map(w => {
        if (w.id !== widgetId) return w;
        const { columnOrder: _drop, ...rest } = w;
        return { ...rest, parentId: null, x: at.x, y: at.y };
    });
    return restamp(freed, columnId);
}

/** Restamp order from an explicit id list. Ids outside the column are ignored. */
export function reorderInColumn(
    widgets: DeskWidget[],
    columnId: string,
    orderedIds: string[],
): DeskWidget[] {
    const own = new Set(childrenOfColumn(widgets, columnId).map(w => w.id));
    const rank = new Map(orderedIds.filter(id => own.has(id)).map((id, i) => [id, i]));
    return widgets.map(w => (rank.has(w.id) ? { ...w, columnOrder: rank.get(w.id) } : w));
}

/**
 * Wrap a selection in a new column at `at`. `columnId` is passed in rather than
 * generated so this stays pure and the test can assert on it.
 */
export function groupIntoColumn(
    widgets: DeskWidget[],
    widgetIds: string[],
    at: { x: number; y: number },
    columnId: string,
): DeskWidget[] {
    const groupable = widgetIds.filter(id => {
        const w = widgets.find(x => x.id === id);
        return w && w.type !== 'column';
    });
    if (groupable.length === 0) return widgets;

    const column: DeskWidget = {
        id: columnId,
        type: 'column',
        x: at.x,
        y: at.y,
        width: COLUMN_WIDTH,
        height: COLUMN_MIN_HEIGHT,
        content: { title: 'Untitled' },
    };

    const rank = new Map(groupable.map((id, i) => [id, i]));
    const adopted = widgets.map(w =>
        rank.has(w.id) ? { ...w, parentId: columnId, columnOrder: rank.get(w.id) } : w,
    );
    return [...adopted, column];
}
