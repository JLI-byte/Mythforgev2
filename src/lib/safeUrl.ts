/**
 * Link safety — LEAF MODULE (no store, no React import).
 *
 * A research Link card stores whatever the writer typed, and that string later
 * becomes an href. Only http and https may ever reach an anchor: a
 * `javascript:` or `data:` value in a persisted workspace would otherwise
 * execute on click. A bare host is the common case and is assumed https rather
 * than rejected.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * The href to render for `raw`, or null when there is nothing safe to render.
 * Callers should render plain text — never an anchor — when this returns null.
 */
export function safeHref(raw: string | null | undefined): string | null {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return null;

    // Anything already carrying a scheme is judged on that scheme. Anything
    // else is treated as a bare host, which is what a writer usually pastes.
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;

    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return null;
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
    if (!parsed.hostname) return null;

    return trimmed === candidate ? trimmed : candidate;
}
