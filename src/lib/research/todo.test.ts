import { describe, it, expect } from 'vitest';
import { addItem, toggleItem, removeItem, editItem, todoProgress, type TodoItem } from './todo';

const items: TodoItem[] = [
    { id: 'a', text: 'Fix the siege duration', done: true },
    { id: 'b', text: 'Name the gate captain', done: false },
];

describe('addItem', () => {
    it('appends an unchecked item', () => {
        const r = addItem(items, 'Map the grain route', 'c');
        expect(r).toHaveLength(3);
        expect(r[2]).toEqual({ id: 'c', text: 'Map the grain route', done: false });
    });
    it('refuses an empty line rather than adding a blank row', () => {
        expect(addItem(items, '   ', 'c')).toBe(items);
    });
});

describe('toggleItem', () => {
    it('flips one item', () => {
        expect(toggleItem(items, 'b')[1].done).toBe(true);
    });
    it('leaves the others alone', () => {
        expect(toggleItem(items, 'b')[0].done).toBe(true);
    });
    it('is a no-op for an unknown id', () => {
        expect(toggleItem(items, 'zz')).toEqual(items);
    });
});

describe('removeItem', () => {
    it('drops one', () => {
        expect(removeItem(items, 'a').map(i => i.id)).toEqual(['b']);
    });
});

describe('editItem', () => {
    it('replaces the text', () => {
        expect(editItem(items, 'b', 'Name the captain')[1].text).toBe('Name the captain');
    });
    it('keeps the done state', () => {
        expect(editItem(items, 'a', 'x')[0].done).toBe(true);
    });
});

describe('todoProgress', () => {
    it('counts done over total', () => {
        expect(todoProgress(items)).toEqual({ done: 1, total: 2, percent: 50 });
    });
    it('is 0 percent for an empty list rather than NaN', () => {
        expect(todoProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    });
    it('is 100 when everything is done', () => {
        expect(todoProgress([{ id: 'a', text: 'x', done: true }]).percent).toBe(100);
    });
});
