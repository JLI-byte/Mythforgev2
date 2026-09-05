import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, type Document, type Scene } from './workspaceStore';

function doc(id: string): Document {
    return { id, projectId: 'p1', title: id, content: '', createdAt: new Date('2026-01-01') };
}

function scene(id: string, documentId: string, order = 0): Scene {
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

const state = () => useWorkspaceStore.getState();

describe('deleteDocument', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            activeProjectId: 'p1',
            activeDocumentId: 'd1',
            activeSceneId: 'a1',
            documents: [doc('d1'), doc('d2')],
            scenes: [scene('a1', 'd1'), scene('a2', 'd1', 1), scene('b1', 'd2')],
        } as never);
    });

    it('removes the chapter', () => {
        state().deleteDocument('d1');
        expect(state().documents.map(d => d.id)).toEqual(['d2']);
    });

    it('takes every scene in the chapter with it', () => {
        state().deleteDocument('d1');
        expect(state().scenes.map(s => s.id)).toEqual(['b1']);
    });

    it('leaves other chapters and their scenes alone', () => {
        state().deleteDocument('d2');
        expect(state().documents.map(d => d.id)).toEqual(['d1']);
        expect(state().scenes.map(s => s.id)).toEqual(['a1', 'a2']);
    });

    it('clears the active chapter when it is the one deleted', () => {
        state().deleteDocument('d1');
        expect(state().activeDocumentId).toBeNull();
    });

    it('clears the active scene when it belonged to the deleted chapter', () => {
        state().deleteDocument('d1');
        expect(state().activeSceneId).toBeNull();
    });

    it('keeps the active scene when it belonged elsewhere', () => {
        useWorkspaceStore.setState({ activeDocumentId: 'd1', activeSceneId: 'b1' } as never);
        state().deleteDocument('d1');
        expect(state().activeSceneId).toBe('b1');
    });

    // --- characterisation beyond the plan ---

    it('keeps the active chapter pointer when a different chapter is deleted', () => {
        state().deleteDocument('d2');
        expect(state().activeDocumentId).toBe('d1');
        expect(state().activeSceneId).toBe('a1');
    });

    it('does nothing but a no-op pass for an unknown id', () => {
        state().deleteDocument('nope');
        expect(state().documents.map(d => d.id)).toEqual(['d1', 'd2']);
        expect(state().scenes.map(s => s.id)).toEqual(['a1', 'a2', 'b1']);
        expect(state().activeDocumentId).toBe('d1');
        expect(state().activeSceneId).toBe('a1');
    });

    it('leaves a dangling activeSceneId dangling rather than clearing it', () => {
        // The pointer names a scene that does not exist, so the cascade cannot
        // tell which chapter it belonged to and leaves it as-is.
        useWorkspaceStore.setState({ activeSceneId: 'ghost' } as never);
        state().deleteDocument('d1');
        expect(state().activeSceneId).toBe('ghost');
    });

    it('does not touch the project list', () => {
        useWorkspaceStore.setState({ projects: [{ id: 'p1', name: 'S1' }] } as never);
        state().deleteDocument('d1');
        expect(state().projects.map(p => p.id)).toEqual(['p1']);
    });
});
