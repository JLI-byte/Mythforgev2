/**
 * Writing-day aggregation — LEAF MODULE (no store, no React import).
 *
 * A writing day is recorded once per project, so a single date can hold several
 * rows. Everything that asks "what happened on this date?" — whether the goal
 * was met, how long the streak was — has to total those rows first. Doing that
 * in one place is what keeps the streak, the heatmap and the creature agreeing.
 */

import { targetForDateKey, type GoalTargetConfig } from './goalSchedule';

export interface WritingDayLike {
    date: string;
    wordsWritten: number;
    minutesWritten?: number;
    goalMet?: boolean;
    /** A purchased streak repair: counts as met however few words were written. */
    repaired?: boolean;
}

/** The goal settings needed to judge a day, beyond the word targets themselves. */
export interface GoalRules extends GoalTargetConfig {
    primaryMetric: 'words' | 'time';
    dailyTimeTarget: number;
}

export interface DayTotals {
    words: number;
    minutes: number;
}

/**
 * Shift a local YYYY-MM-DD key by whole days.
 *
 * Parsed by hand and guarded the way goalSchedule.dayIndexOfKey is: persisted
 * data can be malformed, and a bad key must not silently become NaN-NaN-NaN.
 */
export function addDays(key: string, delta: number): string {
    const [y, m, d] = key.split('-').map(Number);
    if (!y || !m || !d) return key;
    const dt = new Date(y, m - 1, d + delta);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** Words and minutes per date, summed across every project. */
export function totalsByDate(days: WritingDayLike[]): Map<string, DayTotals> {
    const totals = new Map<string, DayTotals>();
    for (const d of days) {
        const current = totals.get(d.date) ?? { words: 0, minutes: 0 };
        totals.set(d.date, {
            words: current.words + (d.wordsWritten || 0),
            minutes: current.minutes + (d.minutesWritten || 0),
        });
    }
    return totals;
}

/**
 * Whether a date's totals clear that date's goal — on the writing alone.
 *
 * Deliberately blind to streak repairs: a repair buys back the streak, not the
 * work, so anything rewarding effort (experience) should ask this, while
 * anything tracking the streak should ask dateVerdicts below.
 */
export function isGoalMet(totals: DayTotals, config: GoalRules, dateKey: string): boolean {
    return config.primaryMetric === 'words'
        ? totals.words >= targetForDateKey(config, dateKey)
        : totals.minutes >= config.dailyTimeTarget;
}

/** Dates holding a purchased streak repair. */
export function repairedDates(days: WritingDayLike[]): Set<string> {
    return new Set(days.filter(d => d.repaired).map(d => d.date));
}

/**
 * Met-or-not per date, counting a repaired day as met.
 *
 * Repairs are bought with a limited resource, so restamping must never quietly
 * spend one: a repaired date stays met even though it holds no words.
 */
export function dateVerdicts(days: WritingDayLike[], config: GoalRules): Map<string, boolean> {
    const repaired = repairedDates(days);
    const verdicts = new Map<string, boolean>();
    for (const [key, totals] of totalsByDate(days)) {
        verdicts.set(key, repaired.has(key) || isGoalMet(totals, config, key));
    }
    return verdicts;
}

/**
 * Restamp goalMet on every row from its DATE total.
 *
 * The flag used to be set from a single project's words, so 300 words in one
 * project and 300 in another lost a 500-word day entirely. Every row on a date
 * now carries that date's verdict. Returns new rows; never mutates.
 */
export function recomputeGoalMet<T extends WritingDayLike>(days: T[], config: GoalRules): T[] {
    const verdicts = dateVerdicts(days, config);
    // The lookup always hits: verdicts was built from these same rows.
    return days.map(d => ({ ...d, goalMet: verdicts.get(d.date) ?? false }));
}

/** Dates whose totals met the goal, ascending, one entry each. */
export function goalMetDates(days: WritingDayLike[], config: GoalRules): string[] {
    return [...dateVerdicts(days, config).entries()]
        .filter(([, met]) => met)
        .map(([key]) => key)
        .sort();
}

/**
 * Streak length on each goal-met date — how many consecutive days had been met
 * up to and including it. Dates that missed the goal are absent from the map.
 */
export function streakByDate(days: WritingDayLike[], config: GoalRules): Map<string, number> {
    const streaks = new Map<string, number>();
    let previous: string | null = null;
    let run = 0;
    for (const key of goalMetDates(days, config)) {
        run = previous !== null && addDays(previous, 1) === key ? run + 1 : 1;
        streaks.set(key, run);
        previous = key;
    }
    return streaks;
}
