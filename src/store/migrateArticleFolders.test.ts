import { describe, it, expect } from 'vitest';
import { migrateArticleFolders } from './migrateArticleFolders';
import { migrateWorkspaceSchema } from './migrateWorkspaceSchema';

const customLayout = {
    roots: [
        { id: 'crew', label: 'Crew', icon: '🚀', entityTypes: ['character', 'faction', 'species'] },
        { id: 'places', label: 'Places', icon: '🪐', entityTypes: ['location'] },
    ],
};

function baseData() {
    return {
        worlds: [{ id: 'w1', name: 'Aether' }],
        projects: [{ id: 'p1', name: 'S1', worldId: 'w1' }],
        worldBibles: { w1: { layout: JSON.parse(JSON.stringify(customLayout)) } },
        entities: [
            { id: 'e1', projectId: 'p1', worldId: 'w1', name: 'Mira', type: 'character' },
            { id: 'e2', projectId: 'p1', worldId: 'w1', name: 'Dock', type: 'location' },
            { id: 'e3', projectId: 'p1', worldId: 'w1', name: 'Rune', type: 'magic' }, // no folder holds magic
            { id: 'e4', projectId: 'p1', name: 'Loose', type: 'lore' },                 // standalone world
        ],
    };
}

describe('migrateArticleFolders', () => {
    it('files entities into the first folder holding their type', () => {
        const out = migrateArticleFolders(baseData());
        expect(out.entities[0].categoryId).toBe('crew');
        expect(out.entities[1].categoryId).toBe('places');
    });

    it('leaves entities unfiled when no folder holds their type', () => {
        const out = migrateArticleFolders(baseData());
        expect(Object.prototype.hasOwnProperty.call(out.entities[2], 'categoryId')).toBe(false);
    });

    it('materializes the default layout for worlds with entities but no stored layout', () => {
        const out = migrateArticleFolders(baseData());
        // e4 is standalone; standalone has no stored bible → default materialized
        expect(out.worldBibles.standalone.layout.roots.map((r: { label: string }) => r.label))
            .toContain('Things');
        expect(out.entities[3].categoryId).toBe('things'); // lore files into Things
    });

    it('does not materialize layouts for worlds with zero entities', () => {
        const data = baseData();
        data.entities = data.entities.filter(e => e.worldId === 'w1');
        const out = migrateArticleFolders(data);
        expect(out.worldBibles.standalone).toBeUndefined();
    });

    it('never touches entities that already have a categoryId', () => {
        const data = baseData();
        (data.entities[0] as { categoryId?: string }).categoryId = 'places'; // user filed Mira manually
        const out = migrateArticleFolders(data);
        expect(out.entities[0].categoryId).toBe('places');
    });

    it('is idempotent', () => {
        const once = migrateArticleFolders(baseData());
        const twice = migrateArticleFolders(once);
        expect(twice).toEqual(once);
    });

    it('passes malformed entries and non-object input through unchanged', () => {
        expect(migrateArticleFolders(null as never)).toBeNull();
        const data = baseData();
        (data.entities as unknown[]).unshift(null);
        const out = migrateArticleFolders(data);
        expect(out.entities[0]).toBeNull();
        expect(out.entities[1].categoryId).toBe('crew');
    });
});

describe('migrateWorkspaceSchema', () => {
    it('composes v3 then v4 on a raw pre-v3 blob', () => {
        const raw = {
            worlds: [{ id: 'w1', name: 'Aether' }],
            projects: [{ id: 'p1', worldId: 'w1', worldBibleLayout: JSON.parse(JSON.stringify(customLayout)) }],
            entities: [{ id: 'e1', projectId: 'p1', name: 'Mira', type: 'character' }],
        };
        const out = migrateWorkspaceSchema(raw);
        expect(out.entities[0].worldId).toBe('w1');        // v3 ran
        expect(out.entities[0].categoryId).toBe('crew');   // v4 ran on v3's output
    });
});
