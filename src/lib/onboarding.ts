/**
 * First-run state — LEAF MODULE (no store, no React import).
 *
 * The app has exactly one way of knowing whether it has met this writer
 * before: hasOnboarded. Everything that behaves differently for a newcomer —
 * the Home first-run screen, the contextual hints — reads that flag through
 * here rather than guessing from the shape of the workspace.
 *
 * The normalisers exist because these fields arrived after the persisted
 * schema shipped: an older blob has no value for them, and a corrupted one
 * can have any value at all.
 */

export interface FirstRunInput {
    hasOnboarded: boolean;
    projectCount: number;
}

/**
 * Home becomes the "Where do you want to begin?" screen only for a writer who
 * has never finished onboarding AND has nothing to open. The project count is
 * the second half deliberately: loading the example world creates real
 * projects, so a seeded workspace is not a blank one.
 */
export function shouldShowFirstRun(input: FirstRunInput): boolean {
    return !input.hasOnboarded && input.projectCount === 0;
}

/** A persisted dismissed-hint list, reduced to the ids we can actually use. */
export function normalizeDismissedHints(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/**
 * A persisted visit timestamp, or null. An unparseable stamp reads as "never
 * been here", which shows no digest — better than an absence measured against
 * NaN.
 */
export function normalizeVisitStamp(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    return Number.isFinite(Date.parse(value)) ? value : null;
}
