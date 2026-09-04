/**
 * Auth callback redirect rules — LEAF MODULE (no store, no React, no Request).
 *
 * The callback used to send every production magic link to one hardcoded
 * hostname, so a link clicked on any other deployment — a preview, a staging
 * box, a second domain — landed where the session cookie did not exist and the
 * user bounced straight back to /welcome. The development branch pointed at
 * port 3000 while the dev server runs on 4000, so it was broken locally too.
 */

/** Where sign-in lands when no usable `next` was supplied. */
export const DEFAULT_NEXT = '/?view=home';

/**
 * The origin a freshly-signed-in user should be sent back to.
 *
 * Order matters. `x-forwarded-host` is client-supplied unless a trusted proxy
 * overwrites it, so an explicitly configured NEXT_PUBLIC_SITE_URL always wins:
 * that is how a deployment closes the vector by configuration rather than by
 * trusting a header. Behind Vercel and every mainstream platform the forwarded
 * headers are set by the platform and the fallback is correct.
 */
export function resolveRedirectBase(
    requestOrigin: string,
    forwardedHost: string | null,
    forwardedProto: string | null,
    configuredSiteUrl: string | undefined,
): string {
    if (configuredSiteUrl) {
        return configuredSiteUrl.replace(/\/+$/, '');
    }
    if (forwardedHost) {
        const isLoopback = forwardedHost.startsWith('localhost')
            || forwardedHost.startsWith('127.0.0.1');
        const proto = forwardedProto ?? (isLoopback ? 'http' : 'https');
        return `${proto}://${forwardedHost}`;
    }
    return requestOrigin;
}

/**
 * The post-sign-in path, refused unless it is same-site. A protocol-relative
 * `//host` is a URL, not a path, and would take the user off the site with a
 * freshly minted session — so it falls back like any other rejected value.
 */
export function safeNextPath(rawNext: string | null): string {
    const next = rawNext || DEFAULT_NEXT;
    return next.startsWith('/') && !next.startsWith('//') ? next : DEFAULT_NEXT;
}
