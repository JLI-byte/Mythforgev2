/** The three actions a shelf's World Bible book offers, in scroll order. */
export const BOOK_VERBS = [
    { id: 'open', label: 'Open' },
    { id: 'edit', label: 'Edit' },
    { id: 'organize', label: 'Organize' },
] as const;

export type BookAction = (typeof BOOK_VERBS)[number]['id'];

/** Wheel-step cycling with wrap-around in both directions. */
export function nextVerb(current: number, direction: 1 | -1, count: number): number {
    return (current + direction + count) % count;
}
