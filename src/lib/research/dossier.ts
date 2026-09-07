/**
 * LEAF MODULE — the Research Dossier.
 *
 * A dossier is a SAVED QUERY, never a copy: it holds which board tree to read
 * and renders it live. Research keeps moving while a chapter is drafted, and a
 * frozen dossier would quietly become wrong.
 *
 * Flattening happens here because a reference you read while writing cannot be
 * a canvas. Every card type is reduced to a title and a body; a card this does
 * not understand still gets its type name rather than disappearing.
 */

import type { DeskWidget } from '@/store/workspaceStore';
import type { BoardRegistry } from './boardTree';
import { childrenOfColumn } from './columns';
import { todoProgress, type TodoItem } from './todo';
import { displayHost } from './linkPreview';
import type { Grid } from './tableGrid';

export interface Dossier {
    id: string;
    name: string;
    projectId: string;
    rootBoardId: string;
    includeNested: boolean;
    pinnedTo?: { kind: 'scene' | 'chapter' | 'project'; id: string };
}

export interface DossierCard {
    id: string;
    type: string;
    title: string;
    body: string;
    unsorted?: boolean;
}

export interface DossierSection {
    boardId: string;
    boardName: string;
    depth: number;
    cards: DossierCard[];
}

export function makeDossier(
    id: string, name: string, projectId: string, rootBoardId: string,
): Dossier {
    return { id, name, projectId, rootBoardId, includeNested: true };
}

/** Readable names for card types that carry no title of their own. */
const TYPE_NAMES: Record<string, string> = {
    sticky: 'Note', image: 'Image', reference: 'Link', drawing: 'Drawing',
    swatch: 'Palette', document: 'Document', table: 'Table', todo: 'To do',
    board: 'Board', column: 'Column', biblePinit: 'Bible pin',
    scenePin: 'Scene', interview: 'Interview', consistencyFlags: 'Consistency flags',
    articleSuggestions: 'Article suggestions',
};

function textFromHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** One card, reduced to something readable in a list. */
export function summariseCard(widget: DeskWidget): { title: string; body: string } {
    const c = (widget.content ?? {}) as Record<string, unknown>;
    const fallback = TYPE_NAMES[widget.type] ?? widget.type;

    switch (widget.type) {
        case 'sticky':
            return { title: fallback, body: String(c.text ?? '') };

        case 'reference': {
            const host = displayHost(String(c.url ?? ''));
            return {
                title: String(c.title || fallback),
                body: [host, String(c.description ?? '')].filter(Boolean).join(' — '),
            };
        }

        case 'todo': {
            const items = (c.items ?? []) as TodoItem[];
            const { done, total } = todoProgress(items);
            // Only what is still outstanding: a dossier is read to find work left.
            const open = items.filter(i => !i.done).map(i => i.text);
            return { title: `To do — ${done}/${total}`, body: open.join('\n') };
        }

        case 'document':
            return { title: fallback, body: textFromHtml(String(c.html ?? '')) };

        case 'table': {
            const grid = c.grid as Grid | undefined;
            if (!grid) return { title: fallback, body: '' };
            const n = grid.rows.length;
            return {
                title: fallback,
                body: `${grid.columns.join(' · ')} (${n} row${n === 1 ? '' : 's'})`,
            };
        }

        case 'column':
            return { title: String(c.title || fallback), body: '' };

        case 'swatch':
            return { title: String(c.title || fallback), body: ((c.colors ?? []) as string[]).join(' ') };

        default:
            return { title: String(c.title || fallback), body: String(c.text ?? '') };
    }
}

interface DossierInput {
    registry: BoardRegistry;
    states: Record<string, { widgets?: DeskWidget[]; unsorted?: DeskWidget[] }>;
}

/** Depth-first from the dossier's root. Empty boards are omitted. */
export function collectDossier(input: DossierInput, dossier: Dossier): DossierSection[] {
    const root = input.registry[dossier.rootBoardId];
    if (!root || root.projectId !== dossier.projectId) return [];

    const sections: DossierSection[] = [];

    const walk = (boardId: string, depth: number) => {
        const node = input.registry[boardId];
        if (!node || node.projectId !== dossier.projectId) return;

        const state = input.states[boardId];
        const onCanvas = state?.widgets ?? [];
        const inTray = state?.unsorted ?? [];

        // A card inside a column is listed under the column, not twice, so the
        // dossier reads in the order the board is arranged.
        const parented = new Set(onCanvas.filter(x => x.parentId).map(x => x.id));
        const ordered: DeskWidget[] = [];
        for (const card of onCanvas) {
            if (parented.has(card.id)) continue;
            ordered.push(card);
            if (card.type === 'column') ordered.push(...childrenOfColumn(onCanvas, card.id));
        }

        const cards: DossierCard[] = [
            ...ordered.map(x => ({ id: x.id, type: x.type, ...summariseCard(x) })),
            ...inTray.map(x => ({ id: x.id, type: x.type, ...summariseCard(x), unsorted: true })),
        ];

        if (cards.length > 0) {
            sections.push({ boardId, boardName: node.name, depth, cards });
        }

        if (!dossier.includeNested) return;
        for (const child of Object.values(input.registry)) {
            if (child.parentId === boardId) walk(child.id, depth + 1);
        }
    };

    walk(dossier.rootBoardId, 0);
    return sections;
}
