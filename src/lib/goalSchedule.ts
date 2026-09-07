/**
 * Daily word-goal resolution — LEAF MODULE (no store or React import).
 *
 * A writer keeps one everyday target and, optionally, per-weekday overrides
 * ("200 on Mondays, 1000 on Fridays"). Anything that asks "what was the goal on
 * this day?" — the ring on Home, goalMet/streak bookkeeping, the heatmap —
 * resolves it through here so every surface gives the same answer.
 */

/** Sunday-first, matching Date.getDay(). */
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Per-weekday overrides, index 0 = Sunday. null means "use the everyday target". */
export type WeekdayTargets = (number | null)[];

export interface GoalTargetConfig {
    dailyWordTarget: number;
    weekdayWordTargets?: WeekdayTargets | null;
}

/** A fresh schedule: no weekday differs from the everyday target. */
export function emptyWeekdayTargets(): WeekdayTargets {
    return [null, null, null, null, null, null, null];
}

/** Persisted values from older builds may be missing or malformed. */
export function normalizeWeekdayTargets(value: unknown): WeekdayTargets {
    if (!Array.isArray(value) || value.length !== 7) return emptyWeekdayTargets();
    return value.map(v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null));
}

/** Bounds for the draggable ring on Home. Exact values outside this live in the schedule editor. */
export const GOAL_MIN = 50;
export const GOAL_MAX = 3000;
export const GOAL_STEP = 25;

/** Snap to the nearest step and hold inside the draggable range. */
export function clampGoal(n: number): number {
    if (!Number.isFinite(n)) return GOAL_MIN;
    const snapped = Math.round(n / GOAL_STEP) * GOAL_STEP;
    return Math.min(GOAL_MAX, Math.max(GOAL_MIN, snapped));
}

/** The everyday target, with a sane floor if it was never configured. */
export function baseTarget(config: GoalTargetConfig): number {
    return config.dailyWordTarget > 0 ? config.dailyWordTarget : 500;
}

/** The goal for one weekday (0 = Sunday), falling back to the everyday target. */
export function targetForDayIndex(config: GoalTargetConfig, dayIndex: number): number {
    const override = config.weekdayWordTargets?.[dayIndex];
    return typeof override === 'number' && override > 0 ? override : baseTarget(config);
}

/**
 * Weekday of a local YYYY-MM-DD key. Parsed by hand on purpose:
 * new Date('2026-09-01') is read as UTC and lands on the previous day west of
 * Greenwich, which would attribute a day's words to the wrong weekday's goal.
 */
export function dayIndexOfKey(key: string): number {
    const [y, m, d] = key.split('-').map(Number);
    if (!y || !m || !d) return new Date().getDay();
    return new Date(y, m - 1, d).getDay();
}

/** The goal that applied on a given YYYY-MM-DD. */
export function targetForDateKey(config: GoalTargetConfig, key: string): number {
    return targetForDayIndex(config, dayIndexOfKey(key));
}

/** True when at least one weekday differs from the everyday target. */
export function hasWeekdaySchedule(config: GoalTargetConfig): boolean {
    return (config.weekdayWordTargets ?? []).some(v => typeof v === 'number' && v > 0);
}
