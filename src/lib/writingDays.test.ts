import { describe, it, expect } from 'vitest';
import {
    addDays,
    goalMetDates,
    recomputeGoalMet,
    streakByDate,
    totalsByDate,
} from './writingDays';

const WORDS = { dailyWordTarget: 500, primaryMetric: 'words' as const, dailyTimeTarget: 20 };

const day = (date: string, projectId: string, wordsWritten: number, minutesWritten = 0) =>
    ({ id: `${date}-${projectId}`, date, projectId, wordsWritten, minutesWritten, goalMet: false });

describe('addDays', () => {
    it('moves forward and backward across month boundaries', () => {
        expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });
});

describe('totalsByDate', () => {
    it('sums every project entry sharing a date', () => {
        const totals = totalsByDate([day('2026-05-01', 'a', 300, 5), day('2026-05-01', 'b', 300, 7)]);
        expect(totals.get('2026-05-01')).toEqual({ words: 600, minutes: 12 });
    });
});

describe('recomputeGoalMet', () => {
    it('counts a goal met when the DATE total clears the target, not one project alone', () => {
        // The bug this fixes: 300 + 300 against a 500 goal met nothing.
        const days = [day('2026-05-01', 'a', 300), day('2026-05-01', 'b', 300)];
        expect(recomputeGoalMet(days, WORDS).map(d => d.goalMet)).toEqual([true, true]);
    });

    it('leaves every row on a date with the same verdict', () => {
        const days = [day('2026-05-01', 'a', 100), day('2026-05-01', 'b', 100)];
        expect(recomputeGoalMet(days, WORDS).map(d => d.goalMet)).toEqual([false, false]);
    });

    it('honours a weekday schedule override', () => {
        // 2026-05-01 is a Friday.
        const config = { ...WORDS, weekdayWordTargets: [null, null, null, null, null, 1000, null] };
        expect(recomputeGoalMet([day('2026-05-01', 'a', 600)], config)[0].goalMet).toBe(false);
        expect(recomputeGoalMet([day('2026-05-01', 'a', 600)], WORDS)[0].goalMet).toBe(true);
    });

    it('uses minutes when the primary metric is time', () => {
        const config = { ...WORDS, primaryMetric: 'time' as const, dailyTimeTarget: 20 };
        expect(recomputeGoalMet([day('2026-05-01', 'a', 10, 25)], config)[0].goalMet).toBe(true);
        expect(recomputeGoalMet([day('2026-05-01', 'a', 9999, 5)], config)[0].goalMet).toBe(false);
    });

    it('does not mutate the input rows', () => {
        const days = [day('2026-05-01', 'a', 900)];
        recomputeGoalMet(days, WORDS);
        expect(days[0].goalMet).toBe(false);
    });
});

describe('goalMetDates', () => {
    it('returns met dates sorted ascending, one entry per date', () => {
        const days = [
            day('2026-05-03', 'a', 900), day('2026-05-01', 'a', 900),
            day('2026-05-01', 'b', 900), day('2026-05-02', 'a', 10),
        ];
        expect(goalMetDates(days, WORDS)).toEqual(['2026-05-01', '2026-05-03']);
    });
});

describe('streakByDate', () => {
    it('counts consecutive days upward', () => {
        const days = ['2026-05-01', '2026-05-02', '2026-05-03'].map(d => day(d, 'a', 900));
        const map = streakByDate(days, WORDS);
        expect([...map.entries()]).toEqual([['2026-05-01', 1], ['2026-05-02', 2], ['2026-05-03', 3]]);
    });

    it('resets after a gap', () => {
        const days = ['2026-05-01', '2026-05-02', '2026-05-05'].map(d => day(d, 'a', 900));
        expect(streakByDate(days, WORDS).get('2026-05-05')).toBe(1);
    });

    it('breaks the run on a day that missed the goal', () => {
        const days = [day('2026-05-01', 'a', 900), day('2026-05-02', 'a', 100), day('2026-05-03', 'a', 900)];
        const map = streakByDate(days, WORDS);
        expect(map.has('2026-05-02')).toBe(false);
        expect(map.get('2026-05-03')).toBe(1);
    });

    it('is empty when nothing was ever met', () => {
        expect(streakByDate([day('2026-05-01', 'a', 10)], WORDS).size).toBe(0);
    });
});
