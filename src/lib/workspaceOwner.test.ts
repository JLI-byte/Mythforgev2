import { describe, it, expect } from 'vitest';
import {
    BACKUP_KEY_PREFIX,
    WORKSPACE_STORAGE_KEY,
    claimBackup,
    isForeignWorkspace,
    ownedStorageKeys,
    readBackupOwner,
} from './workspaceOwner';

describe('isForeignWorkspace', () => {
    it('is true when the stamp names someone else', () => {
        expect(isForeignWorkspace('user-a', 'user-b')).toBe(true);
    });

    it('is false when the stamp names the signed-in user', () => {
        expect(isForeignWorkspace('user-a', 'user-a')).toBe(false);
    });

    it('adopts rather than discards an unstamped workspace', () => {
        expect(isForeignWorkspace(undefined, 'user-a')).toBe(false);
        expect(isForeignWorkspace(null, 'user-a')).toBe(false);
        expect(isForeignWorkspace('', 'user-a')).toBe(false);
    });

    it('never discards when nobody is signed in', () => {
        expect(isForeignWorkspace('user-a', '')).toBe(false);
    });
});

describe('ownedStorageKeys', () => {
    it('picks the workspace and every backup, and nothing else', () => {
        const keys = [
            WORKSPACE_STORAGE_KEY,
            `${BACKUP_KEY_PREFIX}v3-1700000000000`,
            `${BACKUP_KEY_PREFIX}v4-1700000009999`,
            'lorecanvas-beta-feedback',
            'lc-theme',
            'sb-abcdef-auth-token',
        ];
        expect(ownedStorageKeys(keys)).toEqual([
            WORKSPACE_STORAGE_KEY,
            `${BACKUP_KEY_PREFIX}v3-1700000000000`,
            `${BACKUP_KEY_PREFIX}v4-1700000009999`,
        ]);
    });

    it('returns nothing for an empty browser', () => {
        expect(ownedStorageKeys([])).toEqual([]);
    });
});

describe('readBackupOwner', () => {
    it('reads the owner out of an enveloped backup', () => {
        const raw = JSON.stringify({ state: { ownerUserId: 'user-a', projects: [] }, version: 4 });
        expect(readBackupOwner(raw)).toBe('user-a');
    });

    it('reads the owner out of a bare-state backup', () => {
        const raw = JSON.stringify({ ownerUserId: 'user-b', projects: [] });
        expect(readBackupOwner(raw)).toBe('user-b');
    });

    it('returns null for an unowned or unreadable backup', () => {
        expect(readBackupOwner(JSON.stringify({ state: { projects: [] } }))).toBeNull();
        expect(readBackupOwner('not json at all')).toBeNull();
        expect(readBackupOwner(null)).toBeNull();
    });
});

describe('claimBackup', () => {
    it('stamps an unowned enveloped backup', () => {
        const raw = JSON.stringify({ state: { projects: [1] }, version: 4 });
        const out = claimBackup(raw, 'user-a');
        expect(out).not.toBeNull();
        expect(JSON.parse(out!)).toEqual({ state: { projects: [1], ownerUserId: 'user-a' }, version: 4 });
    });

    it('stamps an unowned bare-state backup without inventing an envelope', () => {
        const raw = JSON.stringify({ projects: [1] });
        const out = claimBackup(raw, 'user-a');
        expect(JSON.parse(out!)).toEqual({ projects: [1], ownerUserId: 'user-a' });
    });

    it('leaves an already-owned backup alone', () => {
        const raw = JSON.stringify({ state: { ownerUserId: 'user-b' }, version: 4 });
        expect(claimBackup(raw, 'user-a')).toBeNull();
    });

    it('refuses unreadable input and an empty user id', () => {
        expect(claimBackup('{{{', 'user-a')).toBeNull();
        expect(claimBackup(JSON.stringify({ projects: [] }), '')).toBeNull();
    });
});
