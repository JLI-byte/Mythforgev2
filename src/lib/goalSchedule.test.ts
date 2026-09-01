import { describe, it, expect } from 'vitest';
import {
    clampGoal,
    dayIndexOfKey,
    emptyWeekdayTargets,
    hasWeekdaySchedule,
    normalizeWeekdayTargets,
    targetForDateKey,
    targetForDayIndex,
    GOAL_MIN,
    GOAL_MAX,
} from './goalSchedule';

describe('clampGoal', () => {
    it('snaps to the nearest step', () => {
        expect(clampGoal(512)).toBe(500);
        expect(clampGoal(513)).toBe(525);
    });

    it('holds inside the draggable range', () => {
        expect(clampGoal(-100)).toBe(GOAL_MIN);
        expect(clampGoal(99999)).toBe(GOAL_MAX);
    });

    it('falls back to the minimum for junk input', () => {
        expect(clampGoal(Number.NaN)).toBe(GOAL_MIN);
    });
});

describe('targetForDayIndex', () => {
    const config = {
        dailyWordTarget: 200,
        weekdayWordTargets: [null, null, null, null, null, 1000, null],
    };

    it('uses the weekday override when one is set', () => {
        expect(targetForDayIndex(config, 5)).toBe(1000);
    });

    it('falls back to the everyday target otherwise', () => {
        expect(targetForDayIndex(config, 1)).toBe(200);
    });

    it('ignores a zero or negative override', () => {
        expect(targetForDayIndex({ dailyWordTarget: 200, weekdayWordTargets: [0, ...emptyWeekdayTargets().slice(1)] }, 0)).toBe(200);
    });

    it('falls back to 500 when the everyday target was never configured', () => {
        expect(targetForDayIndex({ dailyWordTarget: 0 }, 3)).toBe(500);
    });
});

describe('dayIndexOfKey', () => {
    it('reads the key as a local date, not UTC', () => {
        // 2026-09-01 is a Tuesday. Parsed as UTC this lands on Monday west of Greenwich.
        expect(dayIndexOfKey('2026-09-01')).toBe(2);
        expect(dayIndexOfKey('2026-09-04')).toBe(5);
    });
});

describe('targetForDateKey', () => {
    it('resolves a date key through its weekday', () => {
        const config = {
            dailyWordTarget: 200,
            weekdayWordTargets: [null, null, null, null, null, 1000, null],
        };
        expect(targetForDateKey(config, '2026-09-04')).toBe(1000); // Friday
        expect(targetForDateKey(config, '2026-09-01')).toBe(200);  // Tuesday
    });
});

describe('normalizeWeekdayTargets', () => {
    it('replaces missing or malformed values with an empty schedule', () => {
        expect(normalizeWeekdayTargets(undefined)).toEqual(emptyWeekdayTargets());
        expect(normalizeWeekdayTargets([1, 2])).toEqual(emptyWeekdayTargets());
    });

    it('keeps positive numbers and nulls the rest', () => {
        expect(normalizeWeekdayTargets([500, 0, null, 'x', -3, 1000, Number.NaN]))
            .toEqual([500, null, null, null, null, 1000, null]);
    });
});

describe('hasWeekdaySchedule', () => {
    it('is false for an empty schedule', () => {
        expect(hasWeekdaySchedule({ dailyWordTarget: 200, weekdayWordTargets: emptyWeekdayTargets() })).toBe(false);
        expect(hasWeekdaySchedule({ dailyWordTarget: 200 })).toBe(false);
    });

    it('is true once any weekday is set', () => {
        expect(hasWeekdaySchedule({ dailyWordTarget: 200, weekdayWordTargets: [null, 300, null, null, null, null, null] })).toBe(true);
    });
});
