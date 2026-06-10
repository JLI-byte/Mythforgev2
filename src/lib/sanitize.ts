/**
 * Sanitizes user input intended for entity names, titles, or short descriptions.
 * 
 * SECURITY CONTEXT (Vance):
 * This function is critical for preventing Cross-Site Scripting (XSS) via our 
 * localStorage backing store. While React escapes strings during standard rendering, 
 * accepting raw HTML tags into the data model creates latent injection vectors 
 * if that data is ever parsed elsewhere, exported, or serialized.
 * 
 * @param input The raw string input from the user
 * @param maxLength The maximum allowed length (defaults to 100)
 * @returns A sanitized, trimmed, and length-clamped string
 */
export function sanitizeLabel(input: string, maxLength: number = 100): string {
    if (!input) return '';

    // Trim whitespace
    let cleaned = input.trim();

    // Strip < and > characters to prevent basic HTML/script injection
    cleaned = cleaned.replace(/[<>]/g, '');

    // Clamp to maximum length
    if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength).trim();
    }

    return cleaned;
}

/**
 * Escapes the five HTML-significant characters. Use when interpolating
 * untrusted text into an HTML string before it is parsed.
 */
export function escapeHtml(input: string): string {
    if (!input) return '';
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Sanitizes rich HTML for safe rendering via dangerouslySetInnerHTML / innerHTML.
 *
 * SECURITY: in-app editors capture innerHTML from contentEditable surfaces and
 * sync it through Supabase, so stored content is untrusted on the way back out.
 * DOMPurify strips scripts, event handlers, and javascript:/data: URLs while
 * preserving the formatting, links, images, and tables TipTap produces.
 *
 * On the server (no DOM) we fall back to escaping, so unsanitized markup is
 * never emitted during SSR — the client re-renders the sanitized HTML on hydrate.
 */
export function sanitizeHtml(raw: string): string {
    if (!raw) return '';
    if (typeof window === 'undefined') return escapeHtml(raw);
    // Imported here (client-only) to avoid pulling DOMPurify into server bundles.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('dompurify');
    const DOMPurify = (mod.default ?? mod) as {
        sanitize: (dirty: string, cfg?: Record<string, unknown>) => string;
    };
    return DOMPurify.sanitize(raw, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['data-screenplay-type', 'data-entity-id', 'colspan', 'rowspan'],
        FORBID_TAGS: ['style', 'form', 'input', 'button'],
    });
}
