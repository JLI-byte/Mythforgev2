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
