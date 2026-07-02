import { describe, it, expect } from 'vitest';
import { migratePerShelfBibles } from './migratePerShelfBibles';

const layoutA = { roots: [{ id: 'a', label: 'A', icon: '📦', entityTypes: ['lore'] }] };

function baseData() {
    return {
        worlds: [{ id: 'w1', name: 'Aether' }],
        projects: [
            { id: 'p1', name: 'Story One', worldId: 'w1', worldBibleLayout: layoutA },
            { id: 'p2', name: 'Story Two', worldId: 'w1' },
            { id: 'p3', name: 'Loose Story' }, // standalone
        ],
        entities: [
            { id: 'e1', projectId: 'p1', name: 'Mira', type: 'character' },
            { id: 'e2', projectId: 'p3', name: 'The Docks', type: 'location' },
            { id: 'e3', projectId: 'ghost', name: 'Orphan', type: 'lore' },
        ],
    };
}

describe('migratePerShelfBibles', () => {
    it('backfills entity.worldId from the project link', () => {
        const out = migratePerShelfBibles(baseData());
        expect(out.entities[0].worldId).toBe('w1');
    });

    it('leaves standalone and unknown-project entities without worldId', () => {
        const out = migratePerShelfBibles(baseData());
        expect(out.entities[1].worldId).toBeUndefined();
        expect(out.entities[2].worldId).toBeUndefined();
    });

    it('normalizes entities whose worldId points at a deleted world', () => {
        const data = baseData();
        (data.entities[0] as any).worldId = 'deleted-world';
        const out = migratePerShelfBibles(data);
        expect(out.entities[0].worldId).toBeUndefined();
    });

    it('adopts the first non-empty project layout per world', () => {
        const out = migratePerShelfBibles(baseData());
        expect(out.worldBibles.w1.layout.roots).toEqual(layoutA.roots);
        expect(out.worldBibles.w1.layout.roots).not.toBe(layoutA.roots); // deep copy
    });

    it('adopts a standalone project layout under the standalone key', () => {
        const data = baseData();
        (data.projects[2] as any).worldBibleLayout = layoutA;
        const out = migratePerShelfBibles(data);
        expect(out.worldBibles.standalone.layout.roots).toEqual(layoutA.roots);
    });

    it('creates no entry for worlds with no custom layout', () => {
        const data = baseData();
        delete (data.projects[0] as any).worldBibleLayout;
        const out = migratePerShelfBibles(data);
        expect(out.worldBibles.w1).toBeUndefined();
    });

    it('is idempotent: second run changes nothing', () => {
        const once = migratePerShelfBibles(baseData());
        const twice = migratePerShelfBibles(once);
        expect(twice).toEqual(once);
    });

    it('does not rebuild an existing worldBibles map but still backfills entities', () => {
        const data = { ...baseData(), worldBibles: { w1: { layout: { roots: [] } } } };
        const out = migratePerShelfBibles(data);
        expect(out.worldBibles.w1.layout.roots).toEqual([]); // untouched
        expect(out.entities[0].worldId).toBe('w1');           // still backfilled
    });

    it('passes through non-object input unchanged', () => {
        expect(migratePerShelfBibles(null as any)).toBeNull();
    });
});
