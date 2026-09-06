/**
 * LEAF MODULE — to-do cards.
 *
 * The natural home for "before I draft this chapter". Ids are passed in rather
 * than generated so every function stays pure and testable.
 */

export interface TodoItem {
    id: string;
    text: string;
    done: boolean;
}

export function addItem(items: TodoItem[], text: string, id: string): TodoItem[] {
    const trimmed = text.trim();
    if (!trimmed) return items;   // a blank row is never what was meant
    return [...items, { id, text: trimmed, done: false }];
}

export function toggleItem(items: TodoItem[], id: string): TodoItem[] {
    return items.map(i => (i.id === id ? { ...i, done: !i.done } : i));
}

export function removeItem(items: TodoItem[], id: string): TodoItem[] {
    return items.filter(i => i.id !== id);
}

export function editItem(items: TodoItem[], id: string, text: string): TodoItem[] {
    return items.map(i => (i.id === id ? { ...i, text } : i));
}

export function todoProgress(items: TodoItem[]): { done: number; total: number; percent: number } {
    const total = items.length;
    const done = items.filter(i => i.done).length;
    return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
