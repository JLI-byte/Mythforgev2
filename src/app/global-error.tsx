"use client";

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Last-resort error screen.
 *
 * Next renders this only when the root layout itself throws, which means it
 * REPLACES the layout — so it has to supply its own <html> and <body>. Nothing
 * from the app is available here: no theme provider, no stylesheet, no font.
 * Every value below is therefore a literal rather than a token, because the
 * token definitions live in a stylesheet this screen cannot assume loaded.
 *
 * Colours are fixed dark rather than theme-aware for the same reason, and are
 * checked to stay legible either way: the page paints its own background, so
 * it never composites onto an unknown ground.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Global error boundary caught:', error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0e0e0e',
                    color: '#e5e2e1',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
            >
                <div
                    role="alert"
                    style={{
                        maxWidth: 460,
                        padding: '1.75rem',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.09)',
                        background: '#131313',
                        textAlign: 'center',
                    }}
                >
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }} aria-hidden="true">😵</div>

                    <h1 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 600 }}>
                        LoreCanvas could not start
                    </h1>

                    <p style={{ margin: '0 0 16px', fontSize: '0.85rem', opacity: 0.75, lineHeight: 1.5 }}>
                        Your work is stored on this device and has not been lost. Reloading
                        usually clears this.
                    </p>

                    <button
                        onClick={reset}
                        style={{
                            padding: '8px 18px',
                            borderRadius: 8,
                            border: 'none',
                            cursor: 'pointer',
                            background: '#d0bcff',
                            color: '#17121f',
                            fontSize: '0.85rem',
                        }}
                    >
                        Reload
                    </button>

                    {error.digest && (
                        <p style={{ margin: '14px 0 0', fontSize: '0.7rem', opacity: 0.5 }}>
                            Reference: {error.digest}
                        </p>
                    )}
                </div>
            </body>
        </html>
    );
}
