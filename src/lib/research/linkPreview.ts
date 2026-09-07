/**
 * LEAF MODULE — link cards.
 *
 * A link card is the research board's most-used card, and the only one whose
 * content comes from outside the app. Everything here judges a writer-supplied
 * string; nothing here trusts one.
 *
 * Video and audio are not separate card types. They are what a link card
 * becomes when the host is recognised, which is why detection lives here rather
 * than in a renderer.
 */

import { safeHref } from '@/lib/safeUrl';

export interface EmbedInfo {
    kind: 'video' | 'audio';
    provider: 'youtube' | 'vimeo' | 'soundcloud';
    embedUrl: string;
}

export interface LinkContent {
    url?: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    showImage?: boolean;
    showDescription?: boolean;
}

/** Parse via safeHref so a non-http scheme can never reach detection. */
function safeUrl(raw: string | null | undefined): URL | null {
    const href = safeHref(raw);
    if (!href) return null;
    try {
        return new URL(href);
    } catch {
        return null;
    }
}

export function detectEmbed(raw: string | null | undefined): EmbedInfo | null {
    const url = safeUrl(raw);
    if (!url) return null;

    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
        const v = url.searchParams.get('v');
        if (v) return { kind: 'video', provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${v}` };
    }
    if (host === 'youtu.be') {
        const id = url.pathname.replace(/^\//, '');
        if (id) return { kind: 'video', provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` };
    }
    if (host === 'vimeo.com') {
        const id = url.pathname.replace(/^\//, '');
        if (/^\d+$/.test(id)) return { kind: 'video', provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    if (host === 'soundcloud.com') {
        return {
            kind: 'audio',
            provider: 'soundcloud',
            embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.href)}`,
        };
    }
    return null;
}

export function displayHost(raw: string | null | undefined): string {
    const url = safeUrl(raw);
    return url ? url.hostname.replace(/^www\./, '') : '';
}

/** Google's favicon service. Null when there is no safe host to ask about. */
export function faviconFor(raw: string | null | undefined): string | null {
    const host = displayHost(raw);
    if (!host) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

/** Fill the gaps a freshly pasted link leaves. Never overwrites the writer. */
export function normaliseLinkContent(content: LinkContent): LinkContent {
    return {
        ...content,
        title: content.title || displayHost(content.url) || '',
        showImage: content.showImage ?? true,
        showDescription: content.showDescription ?? true,
    };
}
