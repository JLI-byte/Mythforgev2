import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, partializeWorkspace } from './workspaceStore';

describe('example data state', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            worlds: [], projects: [], documents: [], scenes: [], entities: [],
            exampleDataOn: false, stashedExample: null, exampleWorldId: null,
        });
    });

    it('starts off with nothing stashed', () => {
        const s = useWorkspaceStore.getState();
        expect(s.exampleDataOn).toBe(false);
        expect(s.stashedExample).toBeNull();
        expect(s.exampleWorldId).toBeNull();
    });

    it('persists all three fields', () => {
        const persisted = partializeWorkspace(useWorkspaceStore.getState());
        expect(persisted).toHaveProperty('exampleDataOn');
        expect(persisted).toHaveProperty('stashedExample');
        expect(persisted).toHaveProperty('exampleWorldId');
    });
});

describe('setExampleData', () => {
    /** A tiny stand-in for the real seed: one world, one project, one doc, one scene. */
    function seedFixture() {
        useWorkspaceStore.setState({
            worlds: [
                { id: 'w-ex', name: 'The Shattered Realm' } as never,
                { id: 'w-mine', name: 'Aethel' } as never,
            ],
            projects: [
                { id: 'p-ex', name: 'The Shard Archivist', worldId: 'w-ex' } as never,
                { id: 'p-mine', name: 'My Book', worldId: 'w-mine' } as never,
            ],
            documents: [
                { id: 'd-ex', projectId: 'p-ex', content: 'original' } as never,
                { id: 'd-mine', projectId: 'p-mine', content: 'mine' } as never,
            ],
            scenes: [{ id: 's-ex', documentId: 'd-ex', projectId: 'p-ex' } as never],
            entities: [{ id: 'e-ex', projectId: 'p-ex' } as never],
            exampleDataOn: true,
            exampleWorldId: 'w-ex',
            stashedExample: null,
        });
    }

    beforeEach(() => {
        useWorkspaceStore.setState({
            worlds: [], projects: [], documents: [], scenes: [], entities: [],
            exampleDataOn: false, stashedExample: null, exampleWorldId: null,
            activeProjectId: null, activeDocumentId: null, activeSceneId: null,
        });
    });

    it('off removes exactly the example records and keeps the writer\'s own', () => {
        seedFixture();
        useWorkspaceStore.getState().setExampleData(false);
        const s = useWorkspaceStore.getState();
        expect(s.worlds.map(w => w.id)).toEqual(['w-mine']);
        expect(s.projects.map(p => p.id)).toEqual(['p-mine']);
        expect(s.documents.map(d => d.id)).toEqual(['d-mine']);
        expect(s.scenes).toEqual([]);
        expect(s.entities).toEqual([]);
        expect(s.exampleDataOn).toBe(false);
    });

    it('off stashes rather than deletes', () => {
        seedFixture();
        useWorkspaceStore.getState().setExampleData(false);
        const stash = useWorkspaceStore.getState().stashedExample;
        expect(stash).not.toBeNull();
        expect(stash!.worlds.map(w => w.id)).toEqual(['w-ex']);
        expect(stash!.scenes.map(x => x.id)).toEqual(['s-ex']);
        expect(stash!.entities.map(x => x.id)).toEqual(['e-ex']);
    });

    it('round trip returns an edit made inside the example', () => {
        seedFixture();
        useWorkspaceStore.setState({
            documents: useWorkspaceStore.getState().documents.map(d =>
                d.id === 'd-ex' ? ({ ...d, content: 'my edit' } as never) : d),
        });
        useWorkspaceStore.getState().setExampleData(false);
        useWorkspaceStore.getState().setExampleData(true);
        const doc = useWorkspaceStore.getState().documents.find(d => d.id === 'd-ex');
        expect((doc as unknown as { content: string }).content).toBe('my edit');
        expect(useWorkspaceStore.getState().stashedExample).toBeNull();
        expect(useWorkspaceStore.getState().exampleDataOn).toBe(true);
    });

    it('off clears active pointers that referred to the example', () => {
        seedFixture();
        useWorkspaceStore.setState({
            activeProjectId: 'p-ex', activeDocumentId: 'd-ex', activeSceneId: 's-ex',
        });
        useWorkspaceStore.getState().setExampleData(false);
        const s = useWorkspaceStore.getState();
        expect(s.activeProjectId).toBeNull();
        expect(s.activeDocumentId).toBeNull();
        expect(s.activeSceneId).toBeNull();
    });

    it('off leaves active pointers that referred to the writer\'s own work', () => {
        seedFixture();
        useWorkspaceStore.setState({ activeProjectId: 'p-mine', activeDocumentId: 'd-mine' });
        useWorkspaceStore.getState().setExampleData(false);
        const s = useWorkspaceStore.getState();
        expect(s.activeProjectId).toBe('p-mine');
        expect(s.activeDocumentId).toBe('d-mine');
    });

    it('off with no example world present just sets the flag', () => {
        useWorkspaceStore.setState({
            worlds: [{ id: 'w-mine', name: 'Aethel' } as never],
            exampleDataOn: true, exampleWorldId: null, stashedExample: null,
        });
        expect(() => useWorkspaceStore.getState().setExampleData(false)).not.toThrow();
        const s = useWorkspaceStore.getState();
        expect(s.exampleDataOn).toBe(false);
        expect(s.stashedExample).toBeNull();
        expect(s.worlds).toHaveLength(1);
    });

    it('adopts an example world seeded before ids were recorded', () => {
        seedFixture();
        useWorkspaceStore.setState({ exampleWorldId: null });
        useWorkspaceStore.getState().setExampleData(false);
        expect(useWorkspaceStore.getState().exampleWorldId).toBe('w-ex');
        expect(useWorkspaceStore.getState().stashedExample!.worlds.map(w => w.id))
            .toEqual(['w-ex']);
    });
    it('turning on with nothing stashed flips the flag immediately', () => {
        // The seed arrives through a dynamic import, so the records land later.
        // The flag must not wait for that, or a checkbox bound to it reads as
        // a dead control on the first-ever seed.
        useWorkspaceStore.setState({
            worlds: [], projects: [], documents: [], scenes: [], entities: [],
            exampleDataOn: false, stashedExample: null, exampleWorldId: null,
        });
        useWorkspaceStore.getState().setExampleData(true);
        expect(useWorkspaceStore.getState().exampleDataOn).toBe(true);
    });
});
