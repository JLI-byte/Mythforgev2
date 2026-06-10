import { describe, it, expect } from 'vitest';
import { sanitizeLabel, escapeHtml, sanitizeHtml } from './sanitize';

describe('sanitizeLabel', () => {
    it('strips angle brackets to block tag injection', () => {
        expect(sanitizeLabel('<script>alert(1)</script>Bob')).toBe('scriptalert(1)/scriptBob');
    });

    it('trims and clamps to max length', () => {
        expect(sanitizeLabel('  hello  ')).toBe('hello');
        expect(sanitizeLabel('abcdef', 3)).toBe('abc');
    });

    it('returns empty string for falsy input', () => {
        expect(sanitizeLabel('')).toBe('');
    });
});

describe('escapeHtml', () => {
    it('escapes all five significant characters', () => {
        expect(escapeHtml(`<a href="x" id='y'>&</a>`)).toBe(
            '&lt;a href=&quot;x&quot; id=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
        );
    });
});

describe('sanitizeHtml', () => {
    it('removes script tags but keeps formatting', () => {
        const out = sanitizeHtml('<p>Hello <strong>world</strong></p><script>alert(1)</script>');
        expect(out).toContain('<strong>world</strong>');
        expect(out).not.toContain('<script>');
        expect(out).not.toContain('alert(1)');
    });

    it('strips javascript: URLs from links', () => {
        const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
        expect(out).not.toContain('javascript:');
    });

    it('strips inline event handlers', () => {
        const out = sanitizeHtml('<img src="x" onerror="alert(1)">');
        expect(out).not.toContain('onerror');
    });

    it('returns empty string for empty input', () => {
        expect(sanitizeHtml('')).toBe('');
    });
});
