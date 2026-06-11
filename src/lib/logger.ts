/* eslint-disable @typescript-eslint/no-explicit-any */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Logger Wrapper
 * 
 * Central utility for structured logging throughout LoreCanvas.
 * Using this wrapper instead of raw console calls ensures consistency, 
 * makes it trivial to swap in a real observability service (like Datadog/Sentry) 
 * later, and silences non-critical logs in production builds automatically.
 */
export const logger = {
    info: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.info('[LoreCanvas]', ...args);
        }
    },
    warn: (...args: any[]) => {
        console.warn('[LoreCanvas]', ...args);
    },
    error: (...args: any[]) => {
        console.error('[LoreCanvas]', ...args);
    },
    debug: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug('[LoreCanvas]', ...args);
        }
    }
};
