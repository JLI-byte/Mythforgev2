import { describe, it, expect } from 'vitest';
import { resolveRedirectBase, safeNextPath, DEFAULT_NEXT } from './authRedirect';

describe('resolveRedirectBase', () => {
    it('prefers an explicitly configured site url', () => {
        expect(resolveRedirectBase('http://localhost:4000', 'evil.example.com', 'https', 'https://app.example.com'))
            .toBe('https://app.example.com');
    });

    it('strips a trailing slash from the configured site url', () => {
        expect(resolveRedirectBase('http://localhost:4000', null, null, 'https://app.example.com/'))
            .toBe('https://app.example.com');
    });

    it('uses the forwarded host and proto behind a proxy', () => {
        expect(resolveRedirectBase('http://internal:3000', 'app.example.com', 'https', undefined))
            .toBe('https://app.example.com');
    });

    it('assumes https for a forwarded host with no proto', () => {
        expect(resolveRedirectBase('http://internal:3000', 'preview-x.vercel.app', null, undefined))
            .toBe('https://preview-x.vercel.app');
    });

    it('keeps http for a forwarded localhost', () => {
        expect(resolveRedirectBase('http://localhost:4000', 'localhost:4000', null, undefined))
            .toBe('http://localhost:4000');
    });

    it('falls back to the request origin, port and all', () => {
        expect(resolveRedirectBase('http://localhost:4000', null, null, undefined))
            .toBe('http://localhost:4000');
        expect(resolveRedirectBase('https://lorecanvas.isomeric.studio', null, null, ''))
            .toBe('https://lorecanvas.isomeric.studio');
    });
});

describe('safeNextPath', () => {
    it('keeps a same-site absolute path', () => {
        expect(safeNextPath('/bookshelf')).toBe('/bookshelf');
    });

    it('refuses a protocol-relative path that would leave the site', () => {
        expect(safeNextPath('//evil.example.com')).toBe(DEFAULT_NEXT);
    });

    it('refuses an absolute url', () => {
        expect(safeNextPath('https://evil.example.com')).toBe(DEFAULT_NEXT);
    });

    it('falls back when nothing was supplied', () => {
        expect(safeNextPath(null)).toBe(DEFAULT_NEXT);
        expect(safeNextPath('')).toBe(DEFAULT_NEXT);
    });
});
