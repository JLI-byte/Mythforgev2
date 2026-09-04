import { describe, it, expect } from 'vitest';
import {
    shouldShowFirstRun,
    normalizeDismissedHints,
    normalizeVisitStamp,
} from './onboarding';

describe('shouldShowFirstRun', () => {
    it('shows for a writer who has never onboarded and owns nothing', () => {
        expect(shouldShowFirstRun({ hasOnboarded: false, projectCount: 0 })).toBe(true);
    });

    it('does not show once the flag is set, even with an empty workspace', () => {
        expect(shouldShowFirstRun({ hasOnboarded: true, projectCount: 0 })).toBe(false);
    });

    it('does not show while a book exists, even if the flag was never set', () => {
        // The example world seeds real projects, so a seeded workspace is not empty.
        expect(shouldShowFirstRun({ hasOnboarded: false, projectCount: 3 })).toBe(false);
    });
});

describe('normalizeDismissedHints', () => {
    it('returns an empty list for anything that is not an array', () => {
        expect(normalizeDismissedHints(undefined)).toEqual([]);
        expect(normalizeDismissedHints(null)).toEqual([]);
        expect(normalizeDismissedHints('entity-link')).toEqual([]);
        expect(normalizeDismissedHints({ 0: 'entity-link' })).toEqual([]);
    });

    it('keeps only non-empty strings', () => {
        expect(normalizeDismissedHints(['entity-link', 7, '', null, 'shelf-drag']))
            .toEqual(['entity-link', 'shelf-drag']);
    });
});

describe('normalizeVisitStamp', () => {
    it('keeps a parseable ISO timestamp', () => {
        expect(normalizeVisitStamp('2026-09-01T08:30:00.000Z'))
            .toBe('2026-09-01T08:30:00.000Z');
    });

    it('rejects anything unparseable or not a string', () => {
        expect(normalizeVisitStamp('yesterday')).toBeNull();
        expect(normalizeVisitStamp(1725000000000)).toBeNull();
        expect(normalizeVisitStamp(undefined)).toBeNull();
        expect(normalizeVisitStamp(null)).toBeNull();
    });
});
