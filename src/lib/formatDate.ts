/**
 * Safe date formatting for values that may arrive as Date objects OR as ISO
 * strings. The workspace store persists Dates to JSON, so after rehydration
 * `entity.createdAt` and friends come back as strings — calling Date-only
 * methods on them throws. These helpers coerce first and tolerate bad input.
 */

function toDate(value: Date | string | number | null | undefined): Date | null {
    if (value == null) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Localized date (no time), or '' when the value is missing/invalid. */
export function formatDate(value: Date | string | number | null | undefined): string {
    const d = toDate(value);
    return d ? d.toLocaleDateString() : '';
}

/** Localized date and time, or '' when the value is missing/invalid. */
export function formatDateTime(value: Date | string | number | null | undefined): string {
    const d = toDate(value);
    return d ? d.toLocaleString() : '';
}
