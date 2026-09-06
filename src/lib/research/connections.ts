/**
 * LEAF MODULE — lines between cards.
 *
 * A connection is not a widget. It has no box, no z-order and no content, and
 * making it one would put it in every traversal that expects a card. It lives
 * in its own array on DeskState.
 *
 * An endpoint is either a card (the line follows it) or a free point (it does
 * not). A line to a deleted card is pruned; a line to a free point survives,
 * because nothing it depends on has gone.
 */

import type { DeskWidget } from '@/store/workspaceStore';

export type Endpoint = { widgetId: string } | { x: number; y: number };

export interface Connection {
    id: string;
    from: Endpoint;
    to: Endpoint;
    label?: string;
    /** 0 = straight. Positive bows one way, negative the other. */
    curve: number;
    arrow: 'none' | 'end' | 'both';
    color?: string;
}

function isWidgetEnd(ep: Endpoint): ep is { widgetId: string } {
    return typeof (ep as { widgetId?: unknown }).widgetId === 'string';
}

export function makeConnection(from: Endpoint, to: Endpoint, id: string): Connection {
    return { id, from, to, curve: 0, arrow: 'end' };
}

/** Where an endpoint actually is. Null when its card is gone. */
export function resolveEndpoint(
    ep: Endpoint,
    widgets: DeskWidget[],
): { x: number; y: number } | null {
    if (!isWidgetEnd(ep)) return { x: ep.x, y: ep.y };
    const w = widgets.find(x => x.id === ep.widgetId);
    if (!w) return null;
    return { x: w.x + w.width / 2, y: w.y + w.height / 2 };
}

export function connectionsFor(connections: Connection[], widgetId: string): Connection[] {
    return connections.filter(c =>
        (isWidgetEnd(c.from) && c.from.widgetId === widgetId) ||
        (isWidgetEnd(c.to) && c.to.widgetId === widgetId),
    );
}

export function removeConnection(connections: Connection[], id: string): Connection[] {
    return connections.filter(c => c.id !== id);
}

/**
 * Drop lines whose card no longer exists. Returns the SAME array when nothing
 * changed, so a React dependency on it does not fire on every render.
 */
export function pruneOrphans(connections: Connection[], widgets: DeskWidget[]): Connection[] {
    const live = new Set(widgets.map(w => w.id));
    const keep = connections.filter(c =>
        (!isWidgetEnd(c.from) || live.has(c.from.widgetId)) &&
        (!isWidgetEnd(c.to) || live.has(c.to.widgetId)),
    );
    return keep.length === connections.length ? connections : keep;
}
