import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

const history = () => useWorkspaceStore.getState().socialHistory;

/**
 * Characterization test for the Social Media Hub's history actions, written
 * before the Recent Updates row gained a delete control. deleteSocialPost was
 * implemented and called by nothing, so the list only ever grew.
 */
describe('deleteSocialPost', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            socialHistory: [
                { id: 'p1', platform: 'x', content: 'first', timestamp: '2026-09-01T10:00:00.000Z' },
                { id: 'p2', platform: 'bluesky', content: 'second', timestamp: '2026-09-02T10:00:00.000Z' },
            ],
        } as never);
    });

    it('removes only the named post', () => {
        useWorkspaceStore.getState().deleteSocialPost('p1');
        expect(history().map(p => p.id)).toEqual(['p2']);
    });

    it('ignores an unknown id', () => {
        useWorkspaceStore.getState().deleteSocialPost('nope');
        expect(history().map(p => p.id)).toEqual(['p1', 'p2']);
    });

    it('is idempotent — deleting the same id twice is not an error', () => {
        useWorkspaceStore.getState().deleteSocialPost('p1');
        useWorkspaceStore.getState().deleteSocialPost('p1');
        expect(history().map(p => p.id)).toEqual(['p2']);
    });

    it('empties the history when the last post goes', () => {
        useWorkspaceStore.getState().deleteSocialPost('p1');
        useWorkspaceStore.getState().deleteSocialPost('p2');
        expect(history()).toEqual([]);
    });

    it('addSocialPost then deleteSocialPost round-trips', () => {
        useWorkspaceStore.setState({ socialHistory: [] } as never);
        useWorkspaceStore.getState().addSocialPost({ platform: 'x', content: 'hello' });
        const added = history()[0];
        expect(added.id).toBeTruthy();
        expect(added.timestamp).toBeTruthy();
        useWorkspaceStore.getState().deleteSocialPost(added.id);
        expect(history()).toEqual([]);
    });

    it('addSocialPost puts the newest post first, so a delete cannot shift the wrong row', () => {
        useWorkspaceStore.getState().addSocialPost({ platform: 'threads', content: 'newest' });
        expect(history().map(p => p.content)).toEqual(['newest', 'first', 'second']);
    });
});
