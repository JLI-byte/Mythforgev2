import { describe, it, expect, beforeEach } from 'vitest';
import { listDataBackups, partializeWorkspace, useWorkspaceStore } from './workspaceStore';
import { BACKUP_KEY_PREFIX, WORKSPACE_STORAGE_KEY, readBackupOwner } from '@/lib/workspaceOwner';

describe('workspace ownership', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspaceStore.setState({
            ownerUserId: null,
            worlds: [],
            projects: [{ id: 'p1', name: 'Draft' } as never],
            entities: [{ id: 'e1', name: 'Mira', type: 'character' } as never],
            scenes: [],
            documents: [],
        });
    });

    it('persists the owner alongside the work', () => {
        useWorkspaceStore.setState({ ownerUserId: 'user-a' });
        const persisted = partializeWorkspace(useWorkspaceStore.getState());
        expect(persisted.ownerUserId).toBe('user-a');
    });

    it('claimWorkspace stamps the signed-in user', () => {
        useWorkspaceStore.getState().claimWorkspace('user-a');
        expect(useWorkspaceStore.getState().ownerUserId).toBe('user-a');
    });

    it('claimWorkspace ignores an empty user id', () => {
        useWorkspaceStore.getState().claimWorkspace('');
        expect(useWorkspaceStore.getState().ownerUserId).toBeNull();
    });

    it('claimWorkspace adopts backups that predate ownership', () => {
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v3-1700000000000`,
            JSON.stringify({ projects: [{ id: 'old' }] }));
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000009999`,
            JSON.stringify({ state: { ownerUserId: 'user-b' }, version: 4 }));

        useWorkspaceStore.getState().claimWorkspace('user-a');

        expect(readBackupOwner(localStorage.getItem(`${BACKUP_KEY_PREFIX}v3-1700000000000`)))
            .toBe('user-a');
        expect(readBackupOwner(localStorage.getItem(`${BACKUP_KEY_PREFIX}v4-1700000009999`)))
            .toBe('user-b');
    });

    it('resetWorkspace empties every content collection', () => {
        useWorkspaceStore.setState({ ownerUserId: 'user-a' });
        useWorkspaceStore.getState().resetWorkspace();
        const state = useWorkspaceStore.getState();
        expect(state.projects).toEqual([]);
        expect(state.entities).toEqual([]);
        expect(state.scenes).toEqual([]);
        expect(state.documents).toEqual([]);
        expect(state.ownerUserId).toBeNull();
    });

    it('resetWorkspace sweeps the workspace key and every backup, and nothing else', () => {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, '{"state":{},"version":4}');
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000000000`, '{}');
        localStorage.setItem('lorecanvas-beta-feedback', '[]');

        useWorkspaceStore.getState().resetWorkspace();

        expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
        expect(localStorage.getItem(`${BACKUP_KEY_PREFIX}v4-1700000000000`)).toBeNull();
        expect(localStorage.getItem('lorecanvas-beta-feedback')).toBe('[]');
    });
});

describe('listDataBackups', () => {
    beforeEach(() => localStorage.clear());

    it('offers only the signed-in user their own backups', () => {
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000000000`,
            JSON.stringify({ state: { ownerUserId: 'user-a' }, version: 4 }));
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000009999`,
            JSON.stringify({ state: { ownerUserId: 'user-b' }, version: 4 }));

        const keys = listDataBackups('user-a').map(b => b.key);
        expect(keys).toEqual([`${BACKUP_KEY_PREFIX}v4-1700000000000`]);
    });

    it('hides unowned backups rather than offering them to whoever is here now', () => {
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v3-1700000000000`, JSON.stringify({ projects: [] }));
        expect(listDataBackups('user-a')).toEqual([]);
    });

    it('offers nothing at all when nobody is signed in', () => {
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000000000`,
            JSON.stringify({ state: { ownerUserId: 'user-a' }, version: 4 }));
        expect(listDataBackups('')).toEqual([]);
    });

    it('still sorts newest first', () => {
        const owned = () => JSON.stringify({ state: { ownerUserId: 'user-a' }, version: 4 });
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000000000`, owned());
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000009999`, owned());
        expect(listDataBackups('user-a').map(b => b.timestamp))
            .toEqual([1700000009999, 1700000000000]);
    });
});
