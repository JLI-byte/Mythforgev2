/**
 * Consistency & Gaps board widget helpers.
 *
 * As the assistant works it can flag two kinds of problem in the World Bible:
 * contradictions (two articles that disagree) and gaps (something clearly
 * missing — a faction with no leader, a place mentioned but never described).
 * These land in a single "Consistency & Gaps" widget on the board. Pure pieces:
 * the flag shape, find-or-create/append with dedup, and a serializer so the
 * assistant sees what it already flagged.
 */

import type { DeskWidget } from '@/store/workspaceStore';
import { DEFAULT_DIMS } from '@/components/editor/desk/deskConstants';

export interface ConsistencyFlag {
    id: string;
    kind: 'contradiction' | 'gap';
    /** Short one-line statement of the problem. */
    summary: string;
    /** Optional longer explanation / how to resolve it. */
    detail?: string;
}

function sameSummary(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A fresh Consistency & Gaps widget holding the given flags. */
export function makeFlagsWidget(flags: ConsistencyFlag[]): DeskWidget {
    const dims = DEFAULT_DIMS.consistencyFlags;
    return {
        id: crypto.randomUUID(),
        type: 'consistencyFlags',
        x: 120,
        y: 120,
        width: dims.w,
        height: dims.h,
        content: { flags },
    };
}

/**
 * Append a flag to the board's single consistency widget, creating it if none
 * exists. Duplicates (same summary) are ignored. Returns the next widgets array
 * (unchanged on a duplicate).
 */
export function addFlagToWidgets(widgets: DeskWidget[], flag: ConsistencyFlag): DeskWidget[] {
    const widget = widgets.find(w => w.type === 'consistencyFlags');
    if (!widget) return [...widgets, makeFlagsWidget([flag])];

    const current: ConsistencyFlag[] = widget.content?.flags ?? [];
    if (current.some(f => sameSummary(f.summary, flag.summary))) return widgets;

    const next: DeskWidget = { ...widget, content: { ...widget.content, flags: [...current, flag] } };
    return widgets.map(w => (w.id === widget.id ? next : w));
}

/** The pending flags, for the assistant's context so it won't repeat them. */
export function serializeFlags(widgets: DeskWidget[]): string {
    const widget = widgets.find(w => w.type === 'consistencyFlags');
    const list: ConsistencyFlag[] = widget?.content?.flags ?? [];
    if (!list.length) return '';
    return list.map(f => `- [${f.kind}] ${f.summary}`).join('\n');
}
