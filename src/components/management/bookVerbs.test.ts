import { describe, it, expect } from 'vitest';
import { BOOK_VERBS, nextVerb } from './bookVerbs';

describe('bookVerbs', () => {
    it('exposes Open, Edit, Organize in order', () => {
        expect(BOOK_VERBS.map(v => v.label)).toEqual(['Open', 'Edit', 'Organize']);
    });
    it('wraps forward and backward', () => {
        expect(nextVerb(0, 1, 3)).toBe(1);
        expect(nextVerb(2, 1, 3)).toBe(0);   // wraps forward
        expect(nextVerb(0, -1, 3)).toBe(2);  // wraps backward
    });
});
