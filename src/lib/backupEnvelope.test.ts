import { describe, it, expect } from 'vitest';
import {
    backupVersionFromKey,
    isPersistEnvelope,
    normaliseBackupPayload,
} from './backupEnvelope';

describe('backupVersionFromKey', () => {
    it('reads the version an automatic backup was taken at', () => {
        expect(backupVersionFromKey('lorecanvas-backup-v2-1730000000000')).toBe(2);
        expect(backupVersionFromKey('lorecanvas-backup-v0-1730000000000')).toBe(0);
        expect(backupVersionFromKey('lorecanvas-backup-v11-1730000000000')).toBe(11);
    });

    it('falls back to 0 for a key with no parseable version', () => {
        expect(backupVersionFromKey('lorecanvas-backup-nonsense')).toBe(0);
        expect(backupVersionFromKey('')).toBe(0);
    });
});

describe('isPersistEnvelope', () => {
    it('recognises a zustand persist envelope', () => {
        expect(isPersistEnvelope({ state: { projects: [] }, version: 4 })).toBe(true);
    });

    it('rejects a bare state, and anything without an object state', () => {
        expect(isPersistEnvelope({ projects: [], scenes: [] })).toBe(false);
        expect(isPersistEnvelope({ state: null })).toBe(false);
        expect(isPersistEnvelope({ state: 'nope' })).toBe(false);
        expect(isPersistEnvelope([])).toBe(false);
        expect(isPersistEnvelope(null)).toBe(false);
    });
});

describe('normaliseBackupPayload', () => {
    const KEY = 'lorecanvas-backup-v2-1730000000000';

    it('wraps a bare automatic backup so zustand can hydrate it', () => {
        const bare = JSON.stringify({ projects: [{ id: 'p1' }], scenes: [{ id: 's1' }] });

        const out = normaliseBackupPayload(bare, KEY);

        expect(out).not.toBeNull();
        const parsed = JSON.parse(out!);
        expect(parsed.state.projects).toEqual([{ id: 'p1' }]);
        expect(parsed.state.scenes).toEqual([{ id: 's1' }]);
    });

    it('versions the wrapper from the key, so migrations replay from there', () => {
        const bare = JSON.stringify({ projects: [] });

        expect(JSON.parse(normaliseBackupPayload(bare, KEY)!).version).toBe(2);
        expect(JSON.parse(
            normaliseBackupPayload(bare, 'lorecanvas-backup-v3-1730000000000')!,
        ).version).toBe(3);
    });

    it('returns a manual backup untouched, byte for byte', () => {
        const envelope = JSON.stringify({ state: { projects: [{ id: 'p1' }] }, version: 4 });

        expect(normaliseBackupPayload(envelope, KEY)).toBe(envelope);
    });

    it('does not double-wrap an envelope', () => {
        const envelope = JSON.stringify({ state: { projects: [] }, version: 4 });

        const parsed = JSON.parse(normaliseBackupPayload(envelope, KEY)!);

        expect(parsed.state.state).toBeUndefined();
        expect(parsed.version).toBe(4);
    });

    it('refuses a payload that is not JSON', () => {
        expect(normaliseBackupPayload('{not json', KEY)).toBeNull();
    });

    it('refuses a payload that could never be a workspace', () => {
        expect(normaliseBackupPayload('null', KEY)).toBeNull();
        expect(normaliseBackupPayload('42', KEY)).toBeNull();
        expect(normaliseBackupPayload('"a string"', KEY)).toBeNull();
        expect(normaliseBackupPayload('[1,2,3]', KEY)).toBeNull();
    });

    it('preserves every key of the bare state, not just the content arrays', () => {
        const bare = JSON.stringify({
            projects: [], documents: [], scenes: [], entities: [],
            worldBibles: { w1: { layout: 'grid' } },
            goalConfig: { target: 500 },
            earnedBadges: ['first-day'],
        });

        const state = JSON.parse(normaliseBackupPayload(bare, KEY)!).state;

        expect(state.worldBibles).toEqual({ w1: { layout: 'grid' } });
        expect(state.goalConfig).toEqual({ target: 500 });
        expect(state.earnedBadges).toEqual(['first-day']);
    });
});
