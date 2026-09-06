import { describe, it, expect } from 'vitest';
import { detectEmbed, faviconFor, displayHost, normaliseLinkContent } from './linkPreview';

describe('detectEmbed', () => {
    it('recognises a YouTube watch URL', () => {
        expect(detectEmbed('https://www.youtube.com/watch?v=abc123'))
            .toEqual({ kind: 'video', provider: 'youtube', embedUrl: 'https://www.youtube.com/embed/abc123' });
    });

    it('recognises a youtu.be short link', () => {
        expect(detectEmbed('https://youtu.be/abc123')?.embedUrl)
            .toBe('https://www.youtube.com/embed/abc123');
    });

    it('recognises Vimeo', () => {
        expect(detectEmbed('https://vimeo.com/123456789'))
            .toEqual({ kind: 'video', provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789' });
    });

    it('recognises SoundCloud as audio', () => {
        const r = detectEmbed('https://soundcloud.com/artist/track');
        expect(r?.kind).toBe('audio');
        expect(r?.provider).toBe('soundcloud');
    });

    it('is null for an ordinary page', () => {
        expect(detectEmbed('https://example.com/article')).toBeNull();
    });

    it('is null for rubbish rather than throwing', () => {
        expect(detectEmbed('not a url')).toBeNull();
        expect(detectEmbed('')).toBeNull();
        expect(detectEmbed(undefined)).toBeNull();
    });

    it('refuses a non-http scheme even when the host looks right', () => {
        expect(detectEmbed('javascript:alert(1)//youtube.com/watch?v=x')).toBeNull();
    });
});

describe('displayHost', () => {
    it('drops the www and the scheme', () => {
        expect(displayHost('https://www.jstor.org/stable/44')).toBe('jstor.org');
    });
    it('assumes https for a bare host', () => {
        expect(displayHost('jstor.org/stable')).toBe('jstor.org');
    });
    it('is empty for rubbish', () => {
        expect(displayHost('not a url')).toBe('');
    });
});

describe('faviconFor', () => {
    it('builds a favicon URL from the host', () => {
        expect(faviconFor('https://jstor.org/x')).toContain('jstor.org');
    });
    it('is null when there is no safe host', () => {
        expect(faviconFor('javascript:alert(1)')).toBeNull();
    });
});

describe('normaliseLinkContent', () => {
    it('fills the title from the host when none was given', () => {
        expect(normaliseLinkContent({ url: 'https://jstor.org/stable/44' }).title).toBe('jstor.org');
    });
    it('leaves a title the writer set', () => {
        expect(normaliseLinkContent({ url: 'https://jstor.org', title: 'Sieges' }).title).toBe('Sieges');
    });
    it('defaults both toggles on, so a pasted link shows what it is', () => {
        const c = normaliseLinkContent({ url: 'https://x.test' });
        expect(c.showImage).toBe(true);
        expect(c.showDescription).toBe(true);
    });
    it('keeps toggles the writer turned off', () => {
        expect(normaliseLinkContent({ url: 'https://x.test', showImage: false }).showImage).toBe(false);
    });
});
