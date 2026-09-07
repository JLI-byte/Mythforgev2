import { describe, it, expect } from 'vitest';
import { NOT_SIGNED_IN_CODE, describeDeleteFailure, isDeleteConfirmed } from './accountDeletion';

describe('isDeleteConfirmed', () => {
    it('confirms on an exact match', () => {
        expect(isDeleteConfirmed('writer@example.com', 'writer@example.com')).toBe(true);
    });

    it('forgives surrounding whitespace and a capitalised first letter', () => {
        expect(isDeleteConfirmed('  Writer@Example.com ', 'writer@example.com')).toBe(true);
    });

    it('refuses a near miss on the domain', () => {
        expect(isDeleteConfirmed('writer@example.co', 'writer@example.com')).toBe(false);
    });

    it('refuses a different address entirely', () => {
        expect(isDeleteConfirmed('someone@example.com', 'writer@example.com')).toBe(false);
    });

    it('refuses empty input', () => {
        expect(isDeleteConfirmed('', 'writer@example.com')).toBe(false);
        expect(isDeleteConfirmed('   ', 'writer@example.com')).toBe(false);
    });

    it('can never confirm when the account email is unknown', () => {
        expect(isDeleteConfirmed('', undefined)).toBe(false);
        expect(isDeleteConfirmed('anything', null)).toBe(false);
        expect(isDeleteConfirmed('', '')).toBe(false);
        expect(isDeleteConfirmed('  ', '  ')).toBe(false);
    });
});

describe('describeDeleteFailure', () => {
    it('says deletion is unavailable when the function is not deployed', () => {
        const msg = describeDeleteFailure({ code: 'PGRST202', message: 'Could not find the function' });
        expect(msg).toContain('not available on this deployment');
        expect(msg).toContain('was not deleted');
    });

    it('says the session expired when the function reports no caller', () => {
        const msg = describeDeleteFailure({ code: NOT_SIGNED_IN_CODE, message: 'Not signed in.' });
        expect(msg).toContain('session has expired');
    });

    it('falls back to a plain nothing-changed message', () => {
        expect(describeDeleteFailure({ code: '57014' })).toContain('Nothing has changed');
        expect(describeDeleteFailure(null)).toContain('Nothing has changed');
        expect(describeDeleteFailure(undefined)).toContain('Nothing has changed');
    });

    it('always leads with the fact that nothing was deleted', () => {
        for (const err of [{ code: 'PGRST202' }, { code: NOT_SIGNED_IN_CODE }, {}, null]) {
            expect(describeDeleteFailure(err).startsWith('Your account was not deleted.')).toBe(true);
        }
    });
});
