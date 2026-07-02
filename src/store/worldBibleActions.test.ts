import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

const root = (id: string) => ({ id, label: id, icon: '📦', entityTypes: [] as never[] });

describe('per-shelf bible store actions', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            worlds: [{ id: 'w1', name: 'Aether' } as never],
            projects: [
                { id: 'p1', name: 'S1', worldId: 'w1' } as never,
                { id: 'p2', name: 'Loose' } as never,
            ],
            entities: [
                { id: 'e1', projectId: 'p1', worldId: 'w1', name: 'Mira', type: 'character' } as never,
                { id: 'e2', projectId: 'p2', name: 'Docks', type: 'location' } as never,
            ],
            worldBibles: {},
            activeWorldKey: 'w1',
            activeProjectId: 'p1',
        });
    });

    it('addWorldBibleRoot writes to the active world bible, seeded from default', () => {
        useWorkspaceStore.getState().addWorldBibleRoot(root('custom') as never);
        const bible = useWorkspaceStore.getState().worldBibles['w1'];
        const labels = bible.layout.roots.map(r => r.label);
        expect(labels).toContain('custom');
        expect(labels).toContain('People'); // default seeded, not lost
    });

    it('deleteProject keeps the world lore', () => {
        useWorkspaceStore.getState().deleteProject('p1');
        expect(useWorkspaceStore.getState().entities.find(e => e.id === 'e1')).toBeTruthy();
    });

    it('deleteWorld moves lore to standalone and drops the bible entry', () => {
        useWorkspaceStore.setState({ worldBibles: { w1: { layout: { roots: [root('x')] } } } });
        useWorkspaceStore.getState().deleteWorld('w1');
        const s = useWorkspaceStore.getState();
        expect(s.entities.find(e => e.id === 'e1')?.worldId).toBeUndefined();
        expect(s.worldBibles['w1']).toBeUndefined();
    });

    it('setWorkspaceMode derives activeWorldKey from the active project when unset', () => {
        useWorkspaceStore.setState({ activeWorldKey: null, activeProjectId: 'p2' });
        useWorkspaceStore.getState().setWorkspaceMode('worldBible');
        expect(useWorkspaceStore.getState().activeWorldKey).toBe('standalone');
    });
});
