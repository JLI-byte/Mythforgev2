/**
 * LEAF MODULE — search across every board in a project.
 *
 * Once boards nest, a card can be three levels down and invisible. Search is
 * what makes that depth safe.
 *
 * Card text lives in `content`, whose shape varies by card type, so this reads
 * a fixed list of likely string fields rather than pretending to know each
 * type. Anything it cannot read simply does not match.
 */

import type { BoardRegistry } from './boardTree';

/** content fields worth searching, across every card type. */
const TEXT_FIELDS = ['text', 'title', 'url', 'description', 'name', 'note'] as const;

export interface SearchHit {
    boardId: string;
    boardName: string;
    /** Absent when the board itself matched by name. */
    widgetId?: string;
    snippet: string;
    score: number;
}

interface SearchInput {
    registry: BoardRegistry;
    states: Record<string, { widgets?: unknown[]; unsorted?: unknown[] }>;
    projectId: string;
}

/** A window of `radius` characters either side of the match. */
export function snippetAround(text: string, needle: string, radius: number): string {
    const at = text.toLowerCase().indexOf(needle.toLowerCase());
    if (at === -1) return text.length <= radius ? text : `${text.slice(0, radius)}…`;

    const start = Math.max(0, at - radius);
    const end = Math.min(text.length, at + needle.length + radius);
    return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function readableText(widget: unknown): string {
    const content = (widget as { content?: Record<string, unknown> })?.content ?? {};
    return TEXT_FIELDS
        .map(f => content[f])
        .filter((v): v is string => typeof v === 'string')
        .join(' · ');
}

export function searchBoards(input: SearchInput, rawQuery: string): SearchHit[] {
    const query = rawQuery.trim();
    if (!query) return [];
    const needle = query.toLowerCase();

    const hits: SearchHit[] = [];
    const boards = Object.values(input.registry).filter(b => b.projectId === input.projectId);

    for (const board of boards) {
        if (board.name.toLowerCase().includes(needle)) {
            // A board is a place, and a place outranks a card inside one.
            hits.push({ boardId: board.id, boardName: board.name, snippet: board.name, score: 100 });
        }

        const state = input.states[board.id];
        const cards = [...(state?.widgets ?? []), ...(state?.unsorted ?? [])];

        for (const card of cards) {
            const text = readableText(card);
            if (!text.toLowerCase().includes(needle)) continue;
            hits.push({
                boardId: board.id,
                boardName: board.name,
                widgetId: (card as { id: string }).id,
                snippet: snippetAround(text, query, 32),
                score: 50,
            });
        }
    }

    return hits.sort((a, b) => b.score - a.score || a.boardName.localeCompare(b.boardName));
}
