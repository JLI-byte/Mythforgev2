import { describe, it, expect } from 'vitest';
import { searchBoards, snippetAround } from './boardSearch';
import type { BoardRegistry } from './boardTree';

const REG: BoardRegistry = {
    b1: { id: 'b1', name: 'Main',      parentId: null, projectId: 'p1' },
    b2: { id: 'b2', name: 'The Siege', parentId: 'b1', projectId: 'p1' },
    b9: { id: 'b9', name: 'Other',     parentId: null, projectId: 'p2' },
};

const STATES = {
    b1: { widgets: [
        { id: 'w1', type: 'sticky',    x: 0, y: 0, width: 1, height: 1, content: { text: 'The siege lasted nine days' } },
        { id: 'w2', type: 'reference', x: 0, y: 0, width: 1, height: 1, content: { title: 'Supply lines', url: 'https://x.test' } },
    ] },
    b2: { widgets: [
        { id: 'w3', type: 'sticky', x: 0, y: 0, width: 1, height: 1, content: { text: 'Maren holds the west gate' } },
    ], unsorted: [
        { id: 'w4', type: 'sticky', x: 0, y: 0, width: 1, height: 1, content: { text: 'Siege engines?' } },
    ] },
    b9: { widgets: [
        { id: 'w5', type: 'sticky', x: 0, y: 0, width: 1, height: 1, content: { text: 'siege of somewhere else' } },
    ] },
} as never;

describe('searchBoards', () => {
    it('finds cards by their text, case-insensitively', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'siege');
        expect(hits.map(h => h.widgetId).sort()).toEqual(['w1', 'w4', undefined].sort());
    });

    it('stays inside the project', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'siege');
        expect(hits.some(h => h.boardId === 'b9')).toBe(false);
    });

    it('matches a board by name and reports it with no widget', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'The Siege');
        expect(hits.some(h => h.boardId === 'b2' && h.widgetId === undefined)).toBe(true);
    });

    it('searches a link card’s title', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'supply');
        expect(hits[0].widgetId).toBe('w2');
    });

    it('searches the unsorted tray as well as the canvas', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'engines');
        expect(hits.map(h => h.widgetId)).toEqual(['w4']);
    });

    it('ranks a board-name match above a card match', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'siege');
        expect(hits[0].widgetId).toBeUndefined();
    });

    it('is empty for a blank query rather than returning everything', () => {
        expect(searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, '   ')).toEqual([]);
    });

    it('is empty when nothing matches', () => {
        expect(searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'zzzz')).toEqual([]);
    });
});

describe('snippetAround', () => {
    it('centres the window on the match', () => {
        expect(snippetAround('the siege lasted nine days', 'siege', 8)).toContain('siege');
    });

    it('returns short text whole, with no ellipsis', () => {
        expect(snippetAround('siege', 'siege', 20)).toBe('siege');
    });

    it('returns the head when the needle is absent', () => {
        expect(snippetAround('abcdefghij', 'zz', 4)).toBe('abcd…');
    });
});
