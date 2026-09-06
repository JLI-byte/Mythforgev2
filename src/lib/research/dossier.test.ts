import { describe, it, expect } from 'vitest';
import { summariseCard, collectDossier, makeDossier } from './dossier';
import type { BoardRegistry } from './boardTree';
import type { DeskWidget } from '@/store/workspaceStore';

const w = (over: Partial<DeskWidget>): DeskWidget => ({
    id: 'x', type: 'sticky', x: 0, y: 0, width: 1, height: 1, content: {}, ...over,
});

describe('summariseCard', () => {
    it('reads a sticky note as its text', () => {
        expect(summariseCard(w({ type: 'sticky', content: { text: 'Nine days' } })))
            .toEqual({ title: 'Note', body: 'Nine days' });
    });

    it('reads a link as its title and host', () => {
        const r = summariseCard(w({ type: 'reference', content: { title: 'Supply lines', url: 'https://www.jstor.org/x' } }));
        expect(r.title).toBe('Supply lines');
        expect(r.body).toContain('jstor.org');
    });

    it('reads a to-do as its progress and its open items', () => {
        const r = summariseCard(w({
            type: 'todo',
            content: { items: [
                { id: 'a', text: 'Fix duration', done: true },
                { id: 'b', text: 'Name the captain', done: false },
            ] },
        }));
        expect(r.title).toBe('To do — 1/2');
        expect(r.body).toContain('Name the captain');
        expect(r.body).not.toContain('Fix duration');   // done items are not outstanding work
    });

    it('reads a column as its title and count', () => {
        expect(summariseCard(w({ type: 'column', content: { title: 'Open questions' } })).title)
            .toBe('Open questions');
    });

    it('reads a table as its headers and row count', () => {
        const r = summariseCard(w({
            type: 'table',
            content: { grid: { columns: ['Name', 'Role'], rows: [['Maren', 'Captain']] } },
        }));
        expect(r.body).toContain('Name');
        expect(r.body).toContain('1 row');
    });

    it('strips tags from a document rather than printing markup', () => {
        const r = summariseCard(w({ type: 'document', content: { html: '<p>The <b>west</b> gate</p>' } }));
        expect(r.body).toBe('The west gate');
    });

    it('names a card with nothing in it rather than returning empty', () => {
        expect(summariseCard(w({ type: 'drawing', content: {} })).title).toBe('Drawing');
    });
});

const REG: BoardRegistry = {
    b1: { id: 'b1', name: 'Main',      parentId: null, projectId: 'p1' },
    b2: { id: 'b2', name: 'The Siege', parentId: 'b1', projectId: 'p1' },
    b3: { id: 'b3', name: 'Defenders', parentId: 'b2', projectId: 'p1' },
    z9: { id: 'z9', name: 'Elsewhere', parentId: null, projectId: 'p2' },
};

const STATES = {
    b1: { widgets: [w({ id: 'c1', content: { text: 'Root note' } })] },
    b2: { widgets: [w({ id: 'c2', content: { text: 'Siege note' } })] },
    b3: { widgets: [w({ id: 'c3', content: { text: 'Defender note' } })] },
    z9: { widgets: [w({ id: 'c9', content: { text: 'Other project' } })] },
} as never;

describe('collectDossier', () => {
    const base = { registry: REG, states: STATES };

    it('returns the root board first, depth first', () => {
        const d = makeDossier('d1', 'Siege research', 'p1', 'b1');
        expect(collectDossier(base, d).map(s => s.boardName)).toEqual(['Main', 'The Siege', 'Defenders']);
    });

    it('records depth so the panel can indent', () => {
        const d = makeDossier('d1', 'x', 'p1', 'b1');
        expect(collectDossier(base, d).map(s => s.depth)).toEqual([0, 1, 2]);
    });

    it('stops at the root board when nesting is off', () => {
        const d = { ...makeDossier('d1', 'x', 'p1', 'b1'), includeNested: false };
        expect(collectDossier(base, d).map(s => s.boardName)).toEqual(['Main']);
    });

    it('can be rooted partway down the tree', () => {
        const d = makeDossier('d1', 'x', 'p1', 'b2');
        expect(collectDossier(base, d).map(s => s.boardName)).toEqual(['The Siege', 'Defenders']);
    });

    it('summarises each card in the section', () => {
        const d = makeDossier('d1', 'x', 'p1', 'b1');
        expect(collectDossier(base, d)[0].cards[0].body).toBe('Root note');
    });

    it('never leaves the project, even if a board id were reused', () => {
        const d = makeDossier('d1', 'x', 'p1', 'b1');
        const names = collectDossier(base, d).map(s => s.boardName);
        expect(names).not.toContain('Elsewhere');
    });

    it('includes the unsorted tray, marked as unsorted', () => {
        const states = {
            b1: { widgets: [], unsorted: [w({ id: 'u1', content: { text: 'Not filed yet' } })] },
        } as never;
        const d = { ...makeDossier('d1', 'x', 'p1', 'b1'), includeNested: false };
        const section = collectDossier({ registry: REG, states }, d)[0];
        expect(section.cards[0].unsorted).toBe(true);
    });

    it('is empty for a root board that does not exist', () => {
        const d = makeDossier('d1', 'x', 'p1', 'nope');
        expect(collectDossier(base, d)).toEqual([]);
    });

    it('drops a board with nothing on it, so the panel is not a list of empty headings', () => {
        const states = { b1: { widgets: [w({ id: 'c1', content: { text: 'x' } })] }, b2: { widgets: [] } } as never;
        const d = makeDossier('d1', 'x', 'p1', 'b1');
        expect(collectDossier({ registry: REG, states }, d).map(s => s.boardName)).toEqual(['Main']);
    });
});
