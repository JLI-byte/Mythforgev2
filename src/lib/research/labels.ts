/**
 * LEAF MODULE — card labels, and locking.
 *
 * Both are per-card metadata that changes what the canvas DOES with a card
 * rather than what the card IS, which is why they share a module.
 *
 * Filtering keeps a column whose child matches. Hiding the column but keeping
 * the child would leave the child with nowhere to be drawn.
 */

import type { DeskWidget } from '@/store/workspaceStore';

export interface Label {
    id: string;
    name: string;
    color: string;
}

/** Semantic colours, kept away from --accent so a label never reads as selection. */
export const LABEL_COLORS = [
    '#4cd7f6',   // verified
    '#ffb869',   // contradiction
    '#2ec27e',   // resolved
    '#ff6b6d',   // blocked
    '#d0bcff',   // idea
] as const;

export function makeLabel(id: string, name: string, colorIndex: number): Label {
    return { id, name, color: LABEL_COLORS[colorIndex % LABEL_COLORS.length] };
}

export function applyLabel(widgets: DeskWidget[], widgetId: string, labelId: string): DeskWidget[] {
    return widgets.map(w => {
        if (w.id !== widgetId) return w;
        const ids = w.labelIds ?? [];
        return ids.includes(labelId) ? w : { ...w, labelIds: [...ids, labelId] };
    });
}

export function removeLabel(widgets: DeskWidget[], widgetId: string, labelId: string): DeskWidget[] {
    return widgets.map(w =>
        w.id === widgetId ? { ...w, labelIds: (w.labelIds ?? []).filter(id => id !== labelId) } : w,
    );
}

/** A card's labels, resolved. Ids whose label was deleted are skipped. */
export function labelsOn(widget: DeskWidget, labels: Label[]): Label[] {
    const byId = new Map(labels.map(l => [l.id, l]));
    return (widget.labelIds ?? []).map(id => byId.get(id)).filter((l): l is Label => Boolean(l));
}

/** Cards carrying ANY of `labelIds`, plus the columns holding them. */
export function filterByLabels(widgets: DeskWidget[], labelIds: string[]): DeskWidget[] {
    if (labelIds.length === 0) return widgets;
    const wanted = new Set(labelIds);

    const matched = widgets.filter(w => (w.labelIds ?? []).some(id => wanted.has(id)));
    const keep = new Set(matched.map(w => w.id));
    for (const w of matched) {
        if (w.parentId) keep.add(w.parentId);   // a child needs its column drawn
    }
    return widgets.filter(w => keep.has(w.id));
}

export function canManipulate(widget: DeskWidget): boolean {
    return !widget.locked;
}

export function toggleLock(widgets: DeskWidget[], widgetId: string): DeskWidget[] {
    return widgets.map(w => (w.id === widgetId ? { ...w, locked: !w.locked } : w));
}

/**
 * Lock or unlock a whole selection.
 *
 * Toggling each card independently would scramble a mixed selection — half
 * locking, half unlocking — which is never what was meant. Instead the
 * selection moves to ONE state: if anything in it is still unlocked, lock
 * everything; only when all of it is locked does this unlock.
 */
export function toggleLockAll(widgets: DeskWidget[], ids: string[]): DeskWidget[] {
    if (ids.length === 0) return widgets;
    const target = new Set(ids);
    const anyUnlocked = widgets.some(w => target.has(w.id) && !w.locked);
    return widgets.map(w => (target.has(w.id) ? { ...w, locked: anyUnlocked } : w));
}
