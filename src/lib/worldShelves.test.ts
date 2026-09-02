import { describe, it, expect } from 'vitest';
import {
    buildShelves,
    STANDALONE_SHELF_NAME,
    STANDALONE_SHELF_COLOR,
} from './worldShelves';
import { STANDALONE_KEY } from './worldKey';

const world = (id: string, name: string, createdAt: string, coverColor = '#4A6FA5') =>
    ({ id, name, createdAt, coverColor });

const project = (id: string, name: string, worldId?: string, updatedAt = '2026-01-01T00:00:00.000Z') =>
    ({ id, name, worldId, updatedAt, createdAt: '2026-01-01T00:00:00.000Z', coverColor: '#333' });

describe('buildShelves', () => {
    it('groups projects under the world they belong to', () => {
        const worlds = [world('w1', 'Aethel', '2026-01-01T00:00:00.000Z')];
        const projects = [project('p1', 'The Salt Road', 'w1'), project('p2', 'Nine Winters', 'w1')];

        const shelves = buildShelves(worlds, projects, []);

        expect(shelves).toHaveLength(1);
        expect(shelves[0].key).toBe('w1');
        expect(shelves[0].name).toBe('Aethel');
        expect(shelves[0].stories).toHaveLength(2);
    });

    it('emits a Standalones shelf only when a project has no world', () => {
        const worlds = [world('w1', 'Aethel', '2026-01-01T00:00:00.000Z')];

        expect(buildShelves(worlds, [project('p1', 'Bound', 'w1')], [])).toHaveLength(1);

        const withLoose = buildShelves(worlds, [project('p2', 'Loose')], []);
        expect(withLoose).toHaveLength(2);
        expect(withLoose[1].key).toBe(STANDALONE_KEY);
        expect(withLoose[1].name).toBe(STANDALONE_SHELF_NAME);
        expect(withLoose[1].isStandalone).toBe(true);
    });

    it('files a project pointing at a deleted world under Standalones', () => {
        const shelves = buildShelves([], [project('p1', 'Orphan', 'gone')], []);

        expect(shelves).toHaveLength(1);
        expect(shelves[0].key).toBe(STANDALONE_KEY);
        expect(shelves[0].stories.map(s => s.name)).toEqual(['Orphan']);
    });

    it('counts articles per world and re-files orphaned ones', () => {
        const worlds = [world('w1', 'Aethel', '2026-01-01T00:00:00.000Z')];
        const entities = [{ worldId: 'w1' }, { worldId: 'w1' }, { worldId: 'gone' }, {}];

        const shelves = buildShelves(worlds, [project('p1', 'Loose')], entities);

        expect(shelves[0].articleCount).toBe(2);
        expect(shelves[1].articleCount).toBe(2);
    });

    it('orders worlds by creation with Standalones always last', () => {
        const worlds = [
            world('w2', 'Mirefall', '2026-05-01T00:00:00.000Z'),
            world('w1', 'Aethel', '2026-01-01T00:00:00.000Z'),
        ];

        const shelves = buildShelves(worlds, [project('p1', 'Loose')], []);

        expect(shelves.map(s => s.name)).toEqual(['Aethel', 'Mirefall', STANDALONE_SHELF_NAME]);
    });

    it('keeps a world with no stories on the shelf', () => {
        const shelves = buildShelves([world('w1', 'Empty', '2026-01-01T00:00:00.000Z')], [], []);

        expect(shelves).toHaveLength(1);
        expect(shelves[0].stories).toEqual([]);
    });

    it('orders stories within a shelf by most recently touched', () => {
        const worlds = [world('w1', 'Aethel', '2026-01-01T00:00:00.000Z')];
        const projects = [
            project('old', 'Older', 'w1', '2026-01-01T00:00:00.000Z'),
            project('new', 'Newer', 'w1', '2026-08-01T00:00:00.000Z'),
        ];

        expect(buildShelves(worlds, projects, [])[0].stories.map(s => s.name))
            .toEqual(['Newer', 'Older']);
    });

    it('accepts Date objects as readily as ISO strings', () => {
        const worlds = [
            { id: 'w2', name: 'Later', createdAt: new Date('2026-05-01T00:00:00.000Z'), coverColor: '#111' },
            { id: 'w1', name: 'Earlier', createdAt: new Date('2026-01-01T00:00:00.000Z'), coverColor: '#222' },
        ];

        expect(buildShelves(worlds, [], []).map(s => s.name)).toEqual(['Earlier', 'Later']);
    });

    it('falls back to the standalone grey when a world or project has no cover colour', () => {
        const worlds = [{ id: 'w1', name: 'Colourless', createdAt: '2026-01-01T00:00:00.000Z' }];
        const projects = [{ id: 'p1', name: 'Plain', worldId: 'w1', createdAt: '2026-01-01T00:00:00.000Z' }];

        const shelf = buildShelves(worlds, projects, [])[0];

        expect(shelf.coverColor).toBe(STANDALONE_SHELF_COLOR);
        expect(shelf.stories[0].coverColor).toBe(STANDALONE_SHELF_COLOR);
    });

    it('falls back to the project createdAt when updatedAt is missing', () => {
        const worlds = [world('w1', 'Aethel', '2026-01-01T00:00:00.000Z')];
        const projects = [{
            id: 'p1', name: 'No update stamp', worldId: 'w1',
            createdAt: '2026-04-04T00:00:00.000Z', coverColor: '#333',
        }];

        expect(buildShelves(worlds, projects, [])[0].stories[0].updatedAt)
            .toBe(new Date('2026-04-04T00:00:00.000Z').getTime());
    });
});
