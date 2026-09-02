import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, COVER_COLORS, partializeWorkspace } from './workspaceStore';

describe('createWorld', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({ worlds: [] });
    });

    it('returns the id of the world it added', () => {
        const id = useWorkspaceStore.getState().createWorld('Aethel');
        const worlds = useWorkspaceStore.getState().worlds;
        expect(worlds).toHaveLength(1);
        expect(worlds[0].id).toBe(id);
        expect(worlds[0].name).toBe('Aethel');
    });

    it('trims the name', () => {
        useWorkspaceStore.getState().createWorld('  Rustwater  ');
        expect(useWorkspaceStore.getState().worlds[0].name).toBe('Rustwater');
    });

    it('applies the same defaults the shelf wizard would', () => {
        useWorkspaceStore.getState().createWorld('Mirefall');
        const w = useWorkspaceStore.getState().worlds[0];
        expect(w.genre).toBe('fantasy');
        expect(w.techLevel).toBe('medieval');
        expect(w.tone).toEqual({ darkness: 'balanced', scale: 'balanced', humor: 'balanced' });
        expect(w.logline).toBe('');
        expect(w.magicExists).toBe(false);
        expect(w.timePeriod).toBe('');
        expect(COVER_COLORS).toContain(w.coverColor);
        expect(w.createdAt).toBeInstanceOf(Date);
    });

    it('keeps existing worlds', () => {
        useWorkspaceStore.getState().createWorld('First');
        useWorkspaceStore.getState().createWorld('Second');
        expect(useWorkspaceStore.getState().worlds.map(w => w.name)).toEqual(['First', 'Second']);
    });
});

describe('pendingNewStoryWorldKey', () => {
    it('round-trips through its actions', () => {
        useWorkspaceStore.getState().requestNewStory('world-1');
        expect(useWorkspaceStore.getState().pendingNewStoryWorldKey).toBe('world-1');
        useWorkspaceStore.getState().clearPendingNewStory();
        expect(useWorkspaceStore.getState().pendingNewStoryWorldKey).toBeNull();
    });

    it('is NOT persisted — a reload must not reopen the creation modal', () => {
        useWorkspaceStore.getState().requestNewStory('world-1');
        const persisted = partializeWorkspace(useWorkspaceStore.getState());
        expect('pendingNewStoryWorldKey' in persisted).toBe(false);
    });
});
