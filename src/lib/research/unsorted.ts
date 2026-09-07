/**
 * LEAF MODULE — the per-board unsorted tray.
 *
 * Anything dropped on a board lands here before the writer decides where it
 * goes. A card in the tray keeps its size and content but its x/y mean
 * nothing until it is dragged out, which is the moment they are set.
 *
 * Every function returns new arrays. Nothing is mutated.
 */

import type { DeskWidget } from '@/store/workspaceStore';

interface TrayState {
    widgets?: DeskWidget[];
    unsorted?: DeskWidget[];
}

interface TrayResult {
    widgets: DeskWidget[];
    unsorted: DeskWidget[];
}

export function trayCount(state: TrayState): number {
    return state.unsorted?.length ?? 0;
}

/** Canvas -> tray. A no-op if the card is not on the canvas. */
export function toTray(state: TrayState, widgetId: string): TrayResult {
    const widgets = state.widgets ?? [];
    const unsorted = state.unsorted ?? [];
    const moving = widgets.find(w => w.id === widgetId);
    if (!moving) return { widgets, unsorted };

    return {
        widgets: widgets.filter(w => w.id !== widgetId),
        unsorted: [...unsorted, moving],
    };
}

/** Tray -> canvas at `at`. A no-op if the card is not in the tray. */
export function fromTray(
    state: TrayState,
    widgetId: string,
    at: { x: number; y: number },
): TrayResult {
    const widgets = state.widgets ?? [];
    const unsorted = state.unsorted ?? [];
    const moving = unsorted.find(w => w.id === widgetId);
    if (!moving) return { widgets, unsorted };

    return {
        widgets: [...widgets, { ...moving, x: at.x, y: at.y }],
        unsorted: unsorted.filter(w => w.id !== widgetId),
    };
}
