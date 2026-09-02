/**
 * Creature experience — LEAF MODULE (no store, no React import).
 *
 * Experience is derived from writing history, never stored: it is a pure
 * function of the days written and the goals in force, recomputed the way the
 * streak already is. Each day is scored with the streak it actually had at the
 * time, so the total only ever rises — a creature you are raising must not
 * shrink because a streak broke.
 *
 * Every tunable sits at the top. The numbers are a starting guess and are meant
 * to be retuned once they have been lived with.
 */

import { targetForDateKey } from './goalSchedule';
import {
    isGoalMet, streakByDate, totalsByDate,
    type GoalRules, type WritingDayLike,
} from './writingDays';

/** Flat award for meeting the day's goal. */
export const GOAL_BONUS = 50;
/** Words per point of experience. */
export const WORDS_PER_XP = 10;
/** Words stop earning past this multiple of the day's target. */
export const WORD_CAP_MULTIPLE = 2;

/** Highest threshold first — multiplierForStreak takes the first that fits. */
export const MULTIPLIER_TIERS: readonly { minStreak: number; multiplier: number }[] = [
    { minStreak: 30, multiplier: 3 },
    { minStreak: 14, multiplier: 2 },
    { minStreak: 7, multiplier: 1.5 },
    { minStreak: 3, multiplier: 1.25 },
    { minStreak: 0, multiplier: 1 },
];

export function multiplierForStreak(streak: number): number {
    return MULTIPLIER_TIERS.find(t => streak >= t.minStreak)?.multiplier ?? 1;
}

export interface CreatureStage {
    id: 'egg' | 'cracking' | 'hatchling' | 'juvenile' | 'adult';
    label: string;
    minXp: number;
}

/** Ascending by minXp. */
export const CREATURE_STAGES: readonly CreatureStage[] = [
    { id: 'egg', label: 'Egg', minXp: 0 },
    { id: 'cracking', label: 'Cracking', minXp: 500 },
    { id: 'hatchling', label: 'Hatchling', minXp: 1500 },
    { id: 'juvenile', label: 'Juvenile', minXp: 4000 },
    { id: 'adult', label: 'Adult', minXp: 10000 },
];

/** Experience earned on one day. The cap is what keeps consistency ahead of volume. */
export function xpForDay(input: {
    words: number;
    target: number;
    streak: number;
    goalMet: boolean;
}): number {
    const { words, target, streak, goalMet } = input;
    const base = goalMet ? GOAL_BONUS : 0;
    const cap = Math.max(0, target) * WORD_CAP_MULTIPLE;
    const wordXp = Math.min(Math.max(0, words), cap) / WORDS_PER_XP;
    return Math.round((base + wordXp) * multiplierForStreak(streak));
}

/** Experience across the whole writing history. */
export function totalXp(days: WritingDayLike[], config: GoalRules): number {
    const totals = totalsByDate(days);
    const streaks = streakByDate(days, config);
    let sum = 0;
    for (const [dateKey, t] of totals) {
        sum += xpForDay({
            words: t.words,
            target: targetForDateKey(config, dateKey),
            streak: streaks.get(dateKey) ?? 0,
            goalMet: isGoalMet(t, config, dateKey),
        });
    }
    return sum;
}

export function stageForXp(xp: number): CreatureStage {
    let stage = CREATURE_STAGES[0];
    for (const s of CREATURE_STAGES) {
        if (xp >= s.minXp) stage = s;
    }
    return stage;
}

export interface CreatureProgress {
    totalXp: number;
    stage: CreatureStage;
    nextStage: CreatureStage | null;
    /** 0-1 through the current stage; 1 once there is no next stage. */
    fraction: number;
    xpToNext: number;
}

export function creatureProgress(days: WritingDayLike[], config: GoalRules): CreatureProgress {
    const xp = totalXp(days, config);
    const stage = stageForXp(xp);
    const index = CREATURE_STAGES.findIndex(s => s.id === stage.id);
    const nextStage = CREATURE_STAGES[index + 1] ?? null;

    if (!nextStage) {
        return { totalXp: xp, stage, nextStage: null, fraction: 1, xpToNext: 0 };
    }

    const span = nextStage.minXp - stage.minXp;
    return {
        totalXp: xp,
        stage,
        nextStage,
        fraction: span > 0 ? Math.min(1, (xp - stage.minXp) / span) : 1,
        xpToNext: Math.max(0, nextStage.minXp - xp),
    };
}
