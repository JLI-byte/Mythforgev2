"use client";

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Route-level error screen.
 *
 * Next renders this when a route segment throws during render. Without it the
 * writer gets an unstyled crash page — or, in production, a blank one — and no
 * indication of whether their manuscript survived.
 *
 * It answers the three things someone actually wants to know: what failed,
 * whether their work is safe, and what to do next. The error text itself is
 * NOT shown: it can carry hostnames and provider internals, so it goes to the
 * log instead. The digest is shown, because that is the id support would ask
 * for and it discloses nothing on its own.
 *
 * Styling is inline and mirrors ErrorBoundary deliberately — this screen has to
 * render when a stylesheet or theme provider is the thing that broke.
 */
export default function RouteError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Route error boundary caught:', error);
    }, [error]);

    return (
        <div
            role="alert"
            style={{
                margin: '4rem auto',
                maxWidth: 460,
                padding: '1.75rem',
                borderRadius: 12,
                border: '1px solid var(--border, #3a3a3a)',
                background: 'var(--surface, #1e1e1e)',
                color: 'var(--foreground, #eee)',
                textAlign: 'center',
                fontFamily: 'system-ui, sans-serif',
            }}
        >
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }} aria-hidden="true">😵</div>

            <h2 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>
                This page could not load
            </h2>

            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', opacity: 0.75, lineHeight: 1.5 }}>
                Your work is saved. Nothing has been lost — you can try again, or go
                back to your bookshelf.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                    onClick={reset}
                    style={{
                        padding: '8px 18px',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        background: 'var(--accent, #6b4c9a)',
                        color: 'var(--on-accent, #fff)',
                        fontSize: '0.85rem',
                    }}
                >
                    Try again
                </button>

                {/* A hard navigation, not a <Link>. Client-side routing would
                    carry whatever broken state caused this across with it; the
                    point of this button is a clean slate. */}
                <button
                    onClick={() => { window.location.href = '/'; }}
                    style={{
                        padding: '8px 18px',
                        borderRadius: 8,
                        border: '1px solid var(--border, #3a3a3a)',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: 'var(--foreground, #eee)',
                        fontSize: '0.85rem',
                    }}
                >
                    Back to safety
                </button>
            </div>

            {error.digest && (
                <p style={{ margin: '14px 0 0', fontSize: '0.7rem', opacity: 0.5 }}>
                    Reference: {error.digest}
                </p>
            )}
        </div>
    );
}
