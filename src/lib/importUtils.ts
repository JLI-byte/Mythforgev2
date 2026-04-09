/**
 * importUtils.ts
 * Pure utilities for parsing structured data formats (CSV, JSON).
 */

/**
 * Simple CSV parser that handles:
 * - Comma delimiters
 * - Quoted fields (for commas/newlines inside values)
 * - Basic line breaks
 */
export function parseCSV(raw: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let insideQuotes = false;

    for (let i = 0; i < raw.length; i++) {
        const char = raw[i];
        const nextChar = raw[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                // Escaped quote: ""
                currentCell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = "";
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++; 
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = "";
        } else {
            currentCell += char;
        }
    }

    if (currentCell) currentRow.push(currentCell.trim());
    if (currentRow.length > 0) rows.push(currentRow);

    return rows;
}

/**
 * Flattens a nested JSON object into a single level of key-value pairs.
 * Useful for mapping fields in complex exports from other apps.
 */
export function flattenJSON(obj: any, prefix = ""): Record<string, string> {
    const flattened: Record<string, string> = {};

    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(flattened, flattenJSON(value, newKey));
        } else {
            flattened[newKey] = String(value);
        }
    }

    return flattened;
}
