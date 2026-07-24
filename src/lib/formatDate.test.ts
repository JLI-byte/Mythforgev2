import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from './formatDate';

describe('formatDate / formatDateTime', () => {
    const iso = '2026-07-24T01:04:29.904Z';

    it('formats a Date object', () => {
        const d = new Date(iso);
        expect(formatDate(d)).toBe(d.toLocaleDateString());
        expect(formatDateTime(d)).toBe(d.toLocaleString());
    });

    it('formats a rehydrated ISO string the same as its Date', () => {
        const d = new Date(iso);
        expect(formatDate(iso)).toBe(d.toLocaleDateString());
        expect(formatDateTime(iso)).toBe(d.toLocaleString());
    });

    it('returns empty string for missing or invalid values', () => {
        expect(formatDate(null)).toBe('');
        expect(formatDate(undefined)).toBe('');
        expect(formatDate('not a date')).toBe('');
        expect(formatDateTime(null)).toBe('');
    });
});
