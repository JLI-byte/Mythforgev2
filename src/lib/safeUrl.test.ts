import { describe, it, expect } from 'vitest';
import { safeHref } from './safeUrl';

describe('safeHref', () => {
    it('passes an https URL through unchanged', () => {
        expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    });

    it('passes an http URL through unchanged', () => {
        expect(safeHref('http://example.com')).toBe('http://example.com');
    });

    it('assumes https for a bare host', () => {
        expect(safeHref('example.com/docs')).toBe('https://example.com/docs');
    });

    it('trims surrounding whitespace', () => {
        expect(safeHref('  https://example.com  ')).toBe('https://example.com');
    });

    it('rejects a javascript: URL', () => {
        expect(safeHref('javascript:alert(1)')).toBeNull();
    });

    it('rejects a javascript: URL hidden by case and whitespace', () => {
        expect(safeHref('  JaVaScRiPt:alert(1)')).toBeNull();
    });

    it('rejects a data: URL', () => {
        expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('rejects other schemes', () => {
        expect(safeHref('file:///etc/passwd')).toBeNull();
        expect(safeHref('vbscript:msgbox(1)')).toBeNull();
    });

    it('returns null for empty or whitespace input', () => {
        expect(safeHref('')).toBeNull();
        expect(safeHref('   ')).toBeNull();
    });

    it('returns null for unparseable input', () => {
        expect(safeHref('http://')).toBeNull();
    });

    it('does not let a scheme-looking path smuggle a bad scheme through', () => {
        // A bare host is prefixed with https://, so this stays harmless.
        expect(safeHref('example.com/javascript:alert(1)'))
            .toBe('https://example.com/javascript:alert(1)');
    });
});
