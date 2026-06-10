import { describe, it, expect } from 'vitest';
import { computeStreakFromDays, type WritingDay } from './workspaceStore';

function day(date: string, wordsWritten: number, goalMet: boolean): WritingDay {
    return { id: date, projectId: 'p1', date, wordsWritten, minutesWritten: 10, goalMet };
}

/** Returns a YYYY-MM-DD offset from today, for time-relative streak tests. */
function dayOffset(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

describe('computeStreakFromDays', () => {
    it('returns a zeroed streak for no data', () => {
        const s = computeStreakFromDays([]);
        expect(s.currentStreak).toBe(0);
        expect(s.longestStreak).toBe(0);
        expect(s.totalWritingDays).toBe(0);
        expect(s.totalWordsAllTime).toBe(0);
    });

    it('sums total words across all entries regardless of goal', () => {
        const s = computeStreakFromDays([
            day('2024-01-01', 100, false),
            day('2024-01-02', 250, true),
        ]);
        expect(s.totalWordsAllTime).toBe(350);
    });

    it('counts only goal-met days as writing days', () => {
        const s = computeStreakFromDays([
            day('2024-01-01', 100, false),
            day('2024-01-02', 250, true),
            day('2024-01-03', 300, true),
        ]);
        expect(s.totalWritingDays).toBe(2);
    });

    it('computes the longest historical streak from consecutive goal-met days', () => {
        const s = computeStreakFromDays([
            day('2024-01-01', 300, true),
            day('2024-01-02', 300, true),
            day('2024-01-03', 300, true),
            // gap
            day('2024-01-05', 300, true),
        ]);
        expect(s.longestStreak).toBe(3);
    });

    it('counts a current streak ending today', () => {
        const s = computeStreakFromDays([
            day(dayOffset(-2), 300, true),
            day(dayOffset(-1), 300, true),
            day(dayOffset(0), 300, true),
        ]);
        expect(s.currentStreak).toBe(3);
    });

    it('breaks the current streak when the most recent goal day is older than yesterday', () => {
        const s = computeStreakFromDays([
            day(dayOffset(-10), 300, true),
            day(dayOffset(-9), 300, true),
        ]);
        expect(s.currentStreak).toBe(0);
    });

    it('records the last date with any words written', () => {
        const s = computeStreakFromDays([
            day('2024-01-01', 100, false),
            day('2024-01-04', 50, false),
        ]);
        expect(s.lastWritingDate).toBe('2024-01-04');
    });
});
