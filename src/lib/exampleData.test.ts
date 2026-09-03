import { describe, it, expect } from 'vitest';
import { partitionExample, selectExampleRecords } from './exampleData';

const source = {
    worlds: [{ id: 'w-ex' }, { id: 'w-mine' }],
    projects: [
        { id: 'p1', worldId: 'w-ex' },
        { id: 'p2', worldId: 'w-ex' },
        { id: 'p3', worldId: 'w-mine' },
        { id: 'p4' },
    ],
    documents: [
        { id: 'd1', projectId: 'p1' },
        { id: 'd2', projectId: 'p2' },
        { id: 'd3', projectId: 'p3' },
    ],
    scenes: [
        { id: 's1', documentId: 'd1', projectId: 'p1' },
        { id: 's2', documentId: 'd2', projectId: 'p2' },
        { id: 's3', documentId: 'd3', projectId: 'p3' },
        { id: 's4', documentId: 'gone', projectId: 'p1' },
    ],
    entities: [
        { id: 'e1', projectId: 'p1' },
        { id: 'e2', projectId: 'p3' },
    ],
};

describe('selectExampleRecords', () => {
    it('cascades world to projects, documents, scenes and entities', () => {
        const sel = selectExampleRecords(source, 'w-ex');
        expect([...sel.worldIds]).toEqual(['w-ex']);
        expect([...sel.projectIds].sort()).toEqual(['p1', 'p2']);
        expect([...sel.documentIds].sort()).toEqual(['d1', 'd2']);
        expect([...sel.entityIds]).toEqual(['e1']);
    });

    it('sweeps a scene whose document is gone but whose project is the example', () => {
        const sel = selectExampleRecords(source, 'w-ex');
        expect([...sel.sceneIds].sort()).toEqual(['s1', 's2', 's4']);
    });

    it('leaves a project with no worldId alone', () => {
        const sel = selectExampleRecords(source, 'w-ex');
        expect(sel.projectIds.has('p4')).toBe(false);
    });

    it('returns empty sets for a world id that is not present', () => {
        const sel = selectExampleRecords(source, 'nope');
        expect(sel.worldIds.size).toBe(0);
        expect(sel.projectIds.size).toBe(0);
        expect(sel.sceneIds.size).toBe(0);
    });
});

describe('partitionExample', () => {
    it('splits every array into disjoint halves whose union is the input', () => {
        const { kept, stashed } = partitionExample(source, 'w-ex');
        for (const key of ['worlds', 'projects', 'documents', 'scenes', 'entities'] as const) {
            const keptIds = kept[key].map(r => r.id);
            const stashedIds = stashed[key].map(r => r.id);
            expect(keptIds.filter(id => stashedIds.includes(id))).toEqual([]);
            expect([...keptIds, ...stashedIds].sort())
                .toEqual(source[key].map(r => r.id).sort());
        }
    });

    it('puts the example world in stashed and the writer world in kept', () => {
        const { kept, stashed } = partitionExample(source, 'w-ex');
        expect(stashed.worlds.map(w => w.id)).toEqual(['w-ex']);
        expect(kept.worlds.map(w => w.id)).toEqual(['w-mine']);
    });

    it('stashes nothing when the world id is absent', () => {
        const { kept, stashed } = partitionExample(source, 'nope');
        expect(stashed.projects).toEqual([]);
        expect(kept.projects).toHaveLength(4);
    });
});
