/**
 * Local Storage Utility
 * 
 * Provides SSR-safe access to the browser's native `localStorage` API.
 * 
 * WHY DO WE NEED THIS?
 * Next.js executes code in two environments: the server (during SSR/compilation) 
 * and the browser client. `localStorage` is purely a browser DOM API. If we invoke it 
 * indiscriminately, the compilation engine will throw fatal "window is not defined" errors.
 * This wrapper centralizes the `typeof window !== 'undefined'` safety checking, 
 * keeping our React component bodies clean and completely crash-proof.
 */

/**
 * Safely fetches a string value from localStorage.
 * Returns `null` if the environment is SSR or if the key does not exist.
 * 
 * @param key The string identifier used to store the data natively.
 * @returns The string payload, or null if missing/SSR.
 */
export function getStoredValue(key: string): string | null {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
    }
    return null;
}

/**
 * Safely commits a string value to localStorage.
 * Silently aborts if invoked on the server during SSR.
 * 
 * @param key The string identifier to target natively.
 * @param value The string payload to cache.
 */
export function setStoredValue(key: string, value: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
    }
}
