/* eslint-disable @typescript-eslint/no-explicit-any */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Logger Wrapper
 * 
 * Central utility for structured logging throughout MythForge.
 * Using this wrapper instead of raw console calls ensures consistency, 
 * makes it trivial to swap in a real observability service (like Datadog/Sentry) 
 * later, and silences non-critical logs in production builds automatically.
 */
export const logger = {
    info: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.info('[MythForge]', ...args);
        }
    },
    warn: (...args: any[]) => {
        console.warn('[MythForge]', ...args);
    },
    error: (...args: any[]) => {
        console.error('[MythForge]', ...args);
    },
    debug: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug('[MythForge]', ...args);
        }
    }
};
