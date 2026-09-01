import { describe, it, expect } from 'vitest';
import {
    countContent,
    looksLikeWorkspace,
    newestContentTime,
    resolveWorkspaceConflict,
} from './workspaceConflict';

const at = (iso: string) => ({ id: iso, updatedAt: iso });

describe('newestContentTime', () => {
    it('takes the newest stamp across every content collection', () => {
        const state = {
            projects: [at('2026-01-01T00:00:00.000Z')],
            scenes: [at('2026-03-04T00:00:00.000Z')],
            entities: [at('2026-02-01T00:00:00.000Z')],
        };
        expect(newestContentTime(state)).toBe(new Date('2026-03-04T00:00:00.000Z').getTime());
    });

    it('falls back to createdAt when updatedAt is absent', () => {
        expect(newestContentTime({ projects: [{ createdAt: '2026-05-05T00:00:00.000Z' }] }))
            .toBe(new Date('2026-05-05T00:00:00.000Z').getTime());
    });

    it('ignores unparseable and missing stamps', () => {
        expect(newestContentTime({ projects: [{ updatedAt: 'not-a-date' }, {}] })).toBe(0);
    });

    it('is 0 for empty or absent state', () => {
        expect(newestContentTime(null)).toBe(0);
        expect(newestContentTime({ projects: [] })).toBe(0);
    });
});

describe('countContent', () => {
    it('sums every content collection and ignores non-arrays', () => {
        expect(countContent({ projects: [1, 2], scenes: [3], entities: 'nope' })).toBe(3);
    });
});

describe('looksLikeWorkspace', () => {
    it('accepts a blob whose content keys are arrays or absent', () => {
        expect(looksLikeWorkspace({ projects: [], entities: [] })).toBe(true);
        expect(looksLikeWorkspace({ theme: 'dark' })).toBe(true);
    });

    it('rejects non-objects and malformed collections', () => {
        expect(looksLikeWorkspace(null)).toBe(false);
        expect(looksLikeWorkspace('nope')).toBe(false);
        expect(looksLikeWorkspace({ projects: 'nope' })).toBe(false);
    });
});

describe('resolveWorkspaceConflict', () => {
    const older = { projects: [at('2026-01-01T00:00:00.000Z')] };
    const newer = { projects: [at('2026-06-01T00:00:00.000Z')] };
    const empty = { projects: [], documents: [], scenes: [], entities: [] };

    it('takes the cloud when local has nothing yet (new device)', () => {
        expect(resolveWorkspaceConflict(empty, newer))
            .toEqual({ takeCloud: true, reason: 'local-empty' });
    });

    it('REFUSES an empty cloud copy over populated local work', () => {
        expect(resolveWorkspaceConflict(newer, empty))
            .toEqual({ takeCloud: false, reason: 'cloud-empty' });
    });

    it('takes the cloud when its content is genuinely newer', () => {
        expect(resolveWorkspaceConflict(older, newer))
            .toEqual({ takeCloud: true, reason: 'cloud-newer' });
    });

    it('keeps local when local content is newer', () => {
        expect(resolveWorkspaceConflict(newer, older))
            .toEqual({ takeCloud: false, reason: 'local-newer-or-equal' });
    });

    it('keeps local on a tie rather than clobbering what is on screen', () => {
        expect(resolveWorkspaceConflict(newer, { projects: [at('2026-06-01T00:00:00.000Z')] }))
            .toEqual({ takeCloud: false, reason: 'local-newer-or-equal' });
    });

    it('ignores save-time metadata: a freshly-saved but stale cloud row loses', () => {
        // The regression that erased real work. The row's updated_at was "now"
        // because any store change bumps it, but its content was older.
        const freshlySavedStaleCloud = { projects: [at('2026-01-01T00:00:00.000Z')], updatedAt: Date.now() };
        expect(resolveWorkspaceConflict(newer, freshlySavedStaleCloud).takeCloud).toBe(false);
    });
});
