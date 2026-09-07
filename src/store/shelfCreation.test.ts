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

    it('prefers a supplied value over the default', () => {
        useWorkspaceStore.getState().createWorld('Rustwater', {
            genre: 'sci-fi',
            techLevel: 'futuristic',
            logline: 'A drowned city that will not stay drowned.',
            tone: { darkness: 'dark', scale: 'epic', humor: 'serious' },
            timePeriod: 'Far future',
        });
        const w = useWorkspaceStore.getState().worlds[0];
        expect(w.genre).toBe('sci-fi');
        expect(w.techLevel).toBe('futuristic');
        expect(w.logline).toBe('A drowned city that will not stay drowned.');
        expect(w.tone).toEqual({ darkness: 'dark', scale: 'epic', humor: 'serious' });
        expect(w.timePeriod).toBe('Far future');
    });

    it('ignores undefined overrides rather than clobbering a default', () => {
        // A wizard field the writer never touched arrives undefined.
        useWorkspaceStore.getState().createWorld('Mirefall', {
            genre: undefined,
            techLevel: undefined,
            tone: undefined,
        });
        const w = useWorkspaceStore.getState().worlds[0];
        expect(w.genre).toBe('fantasy');
        expect(w.techLevel).toBe('medieval');
        expect(w.tone).toEqual({ darkness: 'balanced', scale: 'balanced', humor: 'balanced' });
    });

    it('still generates the id, cover colour and timestamp itself', () => {
        const id = useWorkspaceStore.getState().createWorld('Thornwake', { genre: 'horror' });
        const w = useWorkspaceStore.getState().worlds[0];
        expect(w.id).toBe(id);
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
