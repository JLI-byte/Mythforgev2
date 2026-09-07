import { describe, it, expect } from 'vitest';
import { evaluateSaveGate, shouldSaveToCloud } from './syncGate';

const base = {
    hydrationOk: true,
    stateOwnerUserId: 'user-a',
    currentUserId: 'user-a',
    contentCount: 12,
};

describe('evaluateSaveGate', () => {
    it('allows a hydrated, owned, non-empty workspace', () => {
        expect(evaluateSaveGate(base)).toBe('ok');
    });

    it('blocks a workspace stamped for another user', () => {
        expect(evaluateSaveGate({ ...base, stateOwnerUserId: 'user-b' }))
            .toBe('foreign-or-unclaimed-state');
    });

    it('blocks an unclaimed workspace', () => {
        expect(evaluateSaveGate({ ...base, stateOwnerUserId: null }))
            .toBe('foreign-or-unclaimed-state');
    });

    it('blocks when nobody is signed in', () => {
        expect(evaluateSaveGate({ ...base, currentUserId: '' })).toBe('not-signed-in');
    });

    it('blocks an empty workspace when the cloud read never succeeded', () => {
        expect(evaluateSaveGate({ ...base, hydrationOk: false, contentCount: 0 }))
            .toBe('unhydrated-and-empty');
    });

    it('still allows real content through when the cloud read failed', () => {
        expect(evaluateSaveGate({ ...base, hydrationOk: false, contentCount: 3 })).toBe('ok');
    });
});

describe('shouldSaveToCloud', () => {
    it('is true only for ok', () => {
        expect(shouldSaveToCloud(base)).toBe(true);
        expect(shouldSaveToCloud({ ...base, stateOwnerUserId: 'user-b' })).toBe(false);
    });
});
