import { describe, it, expect } from 'vitest';
import {
    CREATURE_STAGES,
    creatureProgress,
    multiplierForStreak,
    stageForXp,
    totalXp,
    xpForDay,
} from './creatureXp';
import { addDays } from './writingDays';

const WORDS = { dailyWordTarget: 500, primaryMetric: 'words' as const, dailyTimeTarget: 20 };

const day = (date: string, projectId: string, wordsWritten: number) =>
    ({ id: `${date}-${projectId}`, date, projectId, wordsWritten, minutesWritten: 0, goalMet: false });

describe('multiplierForStreak', () => {
    it('steps at every tier boundary', () => {
        expect(multiplierForStreak(0)).toBe(1);
        expect(multiplierForStreak(2)).toBe(1);
        expect(multiplierForStreak(3)).toBe(1.25);
        expect(multiplierForStreak(6)).toBe(1.25);
        expect(multiplierForStreak(7)).toBe(1.5);
        expect(multiplierForStreak(13)).toBe(1.5);
        expect(multiplierForStreak(14)).toBe(2);
        expect(multiplierForStreak(29)).toBe(2);
        expect(multiplierForStreak(30)).toBe(3);
        expect(multiplierForStreak(999)).toBe(3);
    });
});

describe('xpForDay', () => {
    it('awards the goal bonus plus word xp', () => {
        expect(xpForDay({ words: 500, target: 500, streak: 1, goalMet: true })).toBe(100);
    });

    it('multiplies by the streak tier', () => {
        expect(xpForDay({ words: 500, target: 500, streak: 14, goalMet: true })).toBe(200);
    });

    it('caps word xp at twice the target', () => {
        // 2000 words counts as 1000: (50 + 100) * 3
        expect(xpForDay({ words: 2000, target: 500, streak: 30, goalMet: true })).toBe(450);
    });

    it('still credits words on a day that missed the goal', () => {
        expect(xpForDay({ words: 200, target: 500, streak: 0, goalMet: false })).toBe(20);
    });

    it('is zero for a day with no words and no goal', () => {
        expect(xpForDay({ words: 0, target: 500, streak: 0, goalMet: false })).toBe(0);
    });
});

describe('totalXp', () => {
    it('totals a date across projects before scoring it', () => {
        // 300 + 300 clears a 500 goal: (50 + 60) * 1
        const split = totalXp([day('2026-05-01', 'a', 300), day('2026-05-01', 'b', 300)], WORDS);
        expect(split).toBe(110);
        expect(split).toBe(totalXp([day('2026-05-01', 'a', 600)], WORDS));
    });

    it('applies the streak each day actually had, not the final one', () => {
        // Streaks 1, 2, 3 -> 1x, 1x, 1.25x. The third day crosses a tier, so the
        // total is 100 + 100 + 125, not three days at any single multiplier.
        const days = ['2026-05-01', '2026-05-02', '2026-05-03'].map(d => day(d, 'a', 500));
        expect(totalXp(days, WORDS)).toBe(325);
    });

    it('is zero with no history', () => {
        expect(totalXp([], WORDS)).toBe(0);
    });

    it('never decreases when a day is added', () => {
        const days = ['2026-05-01', '2026-05-02'].map(d => day(d, 'a', 500));
        const before = totalXp(days, WORDS);
        const after = totalXp([...days, day('2026-05-09', 'a', 10)], WORDS);
        expect(after).toBeGreaterThanOrEqual(before);
    });
});

describe('stageForXp', () => {
    it('picks the highest stage the xp reaches', () => {
        expect(stageForXp(0).id).toBe('egg');
        expect(stageForXp(499).id).toBe('egg');
        expect(stageForXp(500).id).toBe('cracking');
        expect(stageForXp(1500).id).toBe('hatchling');
        expect(stageForXp(4000).id).toBe('juvenile');
        expect(stageForXp(10000).id).toBe('adult');
        expect(stageForXp(999999).id).toBe('adult');
    });
});

describe('creatureProgress', () => {
    it('reports the fraction through the current stage', () => {
        const p = creatureProgress([day('2026-05-01', 'a', 500)], WORDS); // 100 xp
        expect(p.totalXp).toBe(100);
        expect(p.stage.id).toBe('egg');
        expect(p.nextStage?.id).toBe('cracking');
        expect(p.xpToNext).toBe(400);
        expect(p.fraction).toBeCloseTo(0.2);
    });

    it('is full and has no next stage at adult', () => {
        // 60 consecutive capped days earns 21,377 — comfortably past 10,000.
        // 28 days only reaches 7,127, which is still Juvenile: the tier
        // multipliers make the back half of a long streak carry most of it.
        const days = Array.from({ length: 60 }, (_, i) => day(addDays('2026-01-01', i), 'a', 5000));
        const p = creatureProgress(days, WORDS);
        expect(p.stage.id).toBe('adult');
        expect(p.nextStage).toBeNull();
        expect(p.fraction).toBe(1);
        expect(p.xpToNext).toBe(0);
    });

    it('starts at the egg with no history', () => {
        const p = creatureProgress([], WORDS);
        expect(p.totalXp).toBe(0);
        expect(p.stage.id).toBe('egg');
        expect(p.fraction).toBe(0);
    });
});

describe('CREATURE_STAGES', () => {
    it('is ordered by ascending threshold and starts at zero', () => {
        expect(CREATURE_STAGES[0].minXp).toBe(0);
        const thresholds = CREATURE_STAGES.map(s => s.minXp);
        expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
    });
});
