import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

const root = (id: string, entityTypes: string[] = []) => ({
    id,
    label: id,
    icon: '📦',
    entityTypes: entityTypes as never[],
});

const rootsOf = (key: string) =>
    useWorkspaceStore.getState().worldBibles[key].layout.roots;

const typesIn = (key: string, id: string) =>
    rootsOf(key).find(r => r.id === id)?.entityTypes ?? [];

/**
 * Characterization test for moveWorldBibleType, written before the folder tree
 * gained a draggable type tag. A folder's entityTypes is its claim over a type:
 * fileByType files by it and WorldBibleCenter offers those types when creating
 * an article inside the folder. Nothing in the app could change that claim.
 */
describe('moveWorldBibleType', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            worlds: [{ id: 'w1', name: 'Aether' } as never],
            projects: [{ id: 'p1', name: 'S1', worldId: 'w1' } as never],
            activeWorldKey: 'w1',
            activeProjectId: 'p1',
            draftHierarchyLayout: null,
            worldBibles: {
                w1: {
                    layout: {
                        roots: [
                            root('people', ['character', 'faction']),
                            root('places', ['location']),
                        ],
                    },
                },
            },
        } as never);
    });

    it('takes the type off the source folder', () => {
        useWorkspaceStore.getState().moveWorldBibleType('faction' as never, 'people', 'places');
        expect(typesIn('w1', 'people')).toEqual(['character']);
    });

    it('adds the type to the target folder', () => {
        useWorkspaceStore.getState().moveWorldBibleType('faction' as never, 'people', 'places');
        expect(typesIn('w1', 'places')).toEqual(['location', 'faction']);
    });

    it('never duplicates a type the target already claims', () => {
        useWorkspaceStore.setState({
            worldBibles: {
                w1: { layout: { roots: [root('people', ['location']), root('places', ['location'])] } },
            },
        } as never);
        useWorkspaceStore.getState().moveWorldBibleType('location' as never, 'people', 'places');
        expect(typesIn('w1', 'places')).toEqual(['location']);
        expect(typesIn('w1', 'people')).toEqual([]);
    });

    // EDGE CASE, and the reason the drop handler refuses a same-folder move:
    // the source branch matches first and returns early, so the target branch
    // never runs and the claim is deleted rather than kept.
    it('DROPS the claim when source and target are the same folder', () => {
        useWorkspaceStore.getState().moveWorldBibleType('location' as never, 'places', 'places');
        expect(typesIn('w1', 'places')).toEqual([]);
    });

    it('leaves untouched folders alone', () => {
        useWorkspaceStore.getState().moveWorldBibleType('character' as never, 'people', 'places');
        expect(rootsOf('w1').map(r => r.id)).toEqual(['people', 'places']);
        expect(typesIn('w1', 'people')).toEqual(['faction']);
    });

    it('an unknown source folder still grants the claim to the target', () => {
        useWorkspaceStore.getState().moveWorldBibleType('lore' as never, 'ghost', 'places');
        expect(typesIn('w1', 'places')).toEqual(['location', 'lore']);
        expect(typesIn('w1', 'people')).toEqual(['character', 'faction']);
    });

    it('an unknown target folder simply strips the claim from the source', () => {
        useWorkspaceStore.getState().moveWorldBibleType('faction' as never, 'people', 'ghost');
        expect(typesIn('w1', 'people')).toEqual(['character']);
        expect(rootsOf('w1').map(r => r.id)).toEqual(['people', 'places']);
    });

    it('is idempotent — repeating the same move changes nothing further', () => {
        useWorkspaceStore.getState().moveWorldBibleType('faction' as never, 'people', 'places');
        useWorkspaceStore.getState().moveWorldBibleType('faction' as never, 'people', 'places');
        expect(typesIn('w1', 'people')).toEqual(['character']);
        expect(typesIn('w1', 'places')).toEqual(['location', 'faction']);
    });

    it('is a no-op when no shelf is active', () => {
        useWorkspaceStore.setState({ activeWorldKey: null } as never);
        useWorkspaceStore.getState().moveWorldBibleType('faction' as never, 'people', 'places');
        expect(typesIn('w1', 'people')).toEqual(['character', 'faction']);
    });

    it('edits the draft layout when isDraft is set, not the live bible', () => {
        useWorkspaceStore.setState({
            draftHierarchyLayout: { roots: [root('a', ['lore']), root('b')] },
        } as never);
        useWorkspaceStore.getState().moveWorldBibleType('lore' as never, 'a', 'b', true);

        const draft = useWorkspaceStore.getState().draftHierarchyLayout!;
        expect(draft.roots.find(r => r.id === 'a')?.entityTypes).toEqual([]);
        expect(draft.roots.find(r => r.id === 'b')?.entityTypes).toEqual(['lore']);
        // The live bible is untouched.
        expect(typesIn('w1', 'people')).toEqual(['character', 'faction']);
    });

    it('is a no-op on a draft move when no draft exists', () => {
        useWorkspaceStore.setState({ draftHierarchyLayout: null } as never);
        useWorkspaceStore.getState().moveWorldBibleType('lore' as never, 'a', 'b', true);
        expect(useWorkspaceStore.getState().draftHierarchyLayout).toBeNull();
    });
});
