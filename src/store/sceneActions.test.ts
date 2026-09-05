import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, type Scene } from './workspaceStore';

function scene(id: string, order: number, documentId = 'd1'): Scene {
    return {
        id,
        documentId,
        projectId: 'p1',
        title: id,
        content: '',
        order,
        createdAt: new Date('2026-01-01'),
    };
}

const scenes = () => useWorkspaceStore.getState().scenes;
const orderOf = (documentId: string) =>
    scenes()
        .filter(s => s.documentId === documentId)
        .sort((a, b) => a.order - b.order)
        .map(s => s.id);

describe('deleteScene', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            activeProjectId: 'p1',
            activeDocumentId: 'd1',
            activeSceneId: 's2',
            scenes: [scene('s1', 0), scene('s2', 1), scene('s3', 2), scene('x1', 0, 'd2')],
        } as never);
    });

    it('removes only the named scene', () => {
        useWorkspaceStore.getState().deleteScene('s2');
        expect(scenes().map(s => s.id)).toEqual(['s1', 's3', 'x1']);
    });

    it('moves the selection to the next scene when the active one goes', () => {
        useWorkspaceStore.getState().deleteScene('s2');
        expect(useWorkspaceStore.getState().activeSceneId).toBe('s3');
    });

    it('falls back to the previous scene when the last one goes', () => {
        useWorkspaceStore.setState({ activeSceneId: 's3' } as never);
        useWorkspaceStore.getState().deleteScene('s3');
        expect(useWorkspaceStore.getState().activeSceneId).toBe('s2');
    });

    it('clears the selection when the chapter is emptied', () => {
        useWorkspaceStore.setState({
            activeSceneId: 'only',
            scenes: [scene('only', 0)],
        } as never);
        useWorkspaceStore.getState().deleteScene('only');
        expect(useWorkspaceStore.getState().activeSceneId).toBeNull();
    });

    it('leaves the selection alone when an inactive scene goes', () => {
        useWorkspaceStore.getState().deleteScene('s1');
        expect(useWorkspaceStore.getState().activeSceneId).toBe('s2');
    });

    it('ignores an unknown id', () => {
        useWorkspaceStore.getState().deleteScene('nope');
        expect(scenes()).toHaveLength(4);
    });

    // --- characterisation beyond the plan ---

    it('does NOT renumber the surviving order values, leaving a gap', () => {
        useWorkspaceStore.getState().deleteScene('s1');
        const survivors = scenes().filter(s => s.documentId === 'd1');
        expect(survivors.map(s => s.order)).toEqual([1, 2]);
    });

    it('only considers the deleted scene\'s own chapter when handing the selection on', () => {
        // The last scene of d1 goes; d2's scene is never a candidate.
        useWorkspaceStore.setState({
            activeSceneId: 'lone',
            scenes: [scene('lone', 0), scene('x1', 0, 'd2')],
        } as never);
        useWorkspaceStore.getState().deleteScene('lone');
        expect(useWorkspaceStore.getState().activeSceneId).toBeNull();
    });

    it('leaves activeDocumentId untouched even when the chapter is emptied', () => {
        useWorkspaceStore.setState({
            activeDocumentId: 'd1',
            activeSceneId: 'only',
            scenes: [scene('only', 0)],
        } as never);
        useWorkspaceStore.getState().deleteScene('only');
        expect(useWorkspaceStore.getState().activeDocumentId).toBe('d1');
    });
});

describe('reorderScenes', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            activeProjectId: 'p1',
            scenes: [scene('s1', 0), scene('s2', 1), scene('s3', 2), scene('x1', 0, 'd2')],
        } as never);
    });

    it('restamps order from the position in the id list', () => {
        useWorkspaceStore.getState().reorderScenes('d1', ['s3', 's1', 's2']);
        expect(orderOf('d1')).toEqual(['s3', 's1', 's2']);
    });

    it('does not touch scenes in another chapter', () => {
        useWorkspaceStore.getState().reorderScenes('d1', ['s3', 's2', 's1']);
        expect(scenes().find(s => s.id === 'x1')?.order).toBe(0);
    });

    it('leaves ids absent from the list untouched', () => {
        useWorkspaceStore.getState().reorderScenes('d1', ['s3', 's1']);
        expect(scenes().find(s => s.id === 's2')?.order).toBe(1);
    });

    // --- characterisation beyond the plan ---

    it('restamps rather than swaps, so a partial list can duplicate an order value', () => {
        useWorkspaceStore.getState().reorderScenes('d1', ['s3', 's1']);
        const byId = Object.fromEntries(scenes().map(s => [s.id, s.order]));
        // s1 is restamped to 1 while s2 keeps its untouched 1 — the caller must
        // always pass the chapter's COMPLETE id list.
        expect([byId.s3, byId.s1, byId.s2]).toEqual([0, 1, 1]);
    });

    it('ignores ids that belong to a different chapter', () => {
        useWorkspaceStore.getState().reorderScenes('d1', ['x1', 's1', 's2', 's3']);
        expect(scenes().find(s => s.id === 'x1')?.order).toBe(0);
        expect(orderOf('d1')).toEqual(['s1', 's2', 's3']);
    });

    it('ignores an unknown documentId without throwing', () => {
        useWorkspaceStore.getState().reorderScenes('nope', ['s1', 's2', 's3']);
        expect(orderOf('d1')).toEqual(['s1', 's2', 's3']);
    });

    it('leaves the selection alone', () => {
        useWorkspaceStore.setState({ activeSceneId: 's2' } as never);
        useWorkspaceStore.getState().reorderScenes('d1', ['s3', 's2', 's1']);
        expect(useWorkspaceStore.getState().activeSceneId).toBe('s2');
    });
});
