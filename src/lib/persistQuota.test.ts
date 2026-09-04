import { describe, it, expect } from 'vitest';
import { describePersistFailure, formatBytes, isQuotaError } from './persistQuota';

describe('isQuotaError', () => {
    it('recognises the standard DOMException name', () => {
        expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    });

    it('recognises the Firefox name and the legacy codes', () => {
        expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
        expect(isQuotaError({ code: 22 })).toBe(true);
        expect(isQuotaError({ code: 1014 })).toBe(true);
    });

    it('is false for anything else', () => {
        expect(isQuotaError(new TypeError('nope'))).toBe(false);
        expect(isQuotaError(null)).toBe(false);
        expect(isQuotaError('QuotaExceededError')).toBe(false);
    });
});

describe('formatBytes', () => {
    it('reads in the unit a person would use', () => {
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(2048)).toBe('2.0 KB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    });
});

describe('describePersistFailure', () => {
    it('names the cause and the size when the browser is full', () => {
        const msg = describePersistFailure({ name: 'QuotaExceededError' }, 5 * 1024 * 1024);
        expect(msg).toContain('out of space');
        expect(msg).toContain('5.0 MB');
    });

    it('does not blame quota for an unrelated failure', () => {
        const msg = describePersistFailure(new TypeError('boom'), 1024);
        expect(msg).not.toContain('out of space');
        expect(msg).toContain('could not save');
    });
});
