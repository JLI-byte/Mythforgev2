import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, computeStreakFromDays, type WritingDay } from './workspaceStore';
import { emptyWeekdayTargets } from '@/lib/goalSchedule';

/** Returns a YYYY-MM-DD offset from today, matching streaks.test.ts. */
function dayOffset(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

function day(date: string, wordsWritten: number, goalMet: boolean): WritingDay {
    return { id: date, projectId: 'p1', date, wordsWritten, minutesWritten: 10, goalMet };
}

const BASE_CONFIG = {
    dailyWordTarget: 1000,
    weekdayWordTargets: emptyWeekdayTargets(),
    dailyTimeTarget: 20,
    primaryMetric: 'words' as const,
    writingDaysPerWeek: 5,
    streakRepairsAvailable: 1,
    goalConfigured: true,
};

function reset(days: WritingDay[], config: Partial<typeof BASE_CONFIG> = {}) {
    const goalConfig = { ...BASE_CONFIG, ...config };
    useWorkspaceStore.setState({
        activeProjectId: 'p1',
        writingDays: days,
        earnedBadges: [],
        goalConfig,
        streakState: computeStreakFromDays(days),
    } as never);
}

const earnedIds = () =>
    useWorkspaceStore.getState().earnedBadges.map(b => b.badgeId);

describe('badge awarding is reached from every path that moves the streak', () => {
    beforeEach(() => reset([]));

    it('repairStreak awards the first-day badge the repair just earned', () => {
        reset([]);
        useWorkspaceStore.getState().repairStreak(dayOffset(-1));
        expect(earnedIds()).toContain('first_day');
    });

    it('repairStreak awards the seven-day badge when the bought day completes the week', () => {
        // Six met days either side of a single missed day, ending today.
        const days = [-6, -5, -4, -3, -2, -1, 0]
            .filter(n => n !== -3)
            .map(n => day(dayOffset(n), 1200, true));
        reset(days);
        expect(useWorkspaceStore.getState().streakState.currentStreak).toBeLessThan(7);

        useWorkspaceStore.getState().repairStreak(dayOffset(-3));

        expect(useWorkspaceStore.getState().streakState.currentStreak).toBe(7);
        expect(earnedIds()).toContain('seven_day_streak');
    });

    it('lowering the daily target awards the badges the restamped days now earn', () => {
        reset([day(dayOffset(-1), 300, false)]);
        expect(earnedIds()).toEqual([]);

        useWorkspaceStore.getState().updateGoalConfig({ dailyWordTarget: 200 });

        expect(earnedIds()).toContain('first_day');
    });

    it('awards the word-count badges from a restamp, not just from typing', () => {
        reset([day(dayOffset(-1), 12000, false)]);
        useWorkspaceStore.getState().updateGoalConfig({ dailyWordTarget: 200 });
        expect(earnedIds()).toContain('ten_thousand_words');
    });

    it('computeStreakState awards anything the recomputed streak has earned', () => {
        reset([day(dayOffset(-1), 500, true)]);
        useWorkspaceStore.setState({ earnedBadges: [] } as never);
        useWorkspaceStore.getState().computeStreakState();
        expect(earnedIds()).toContain('first_day');
    });

    it('never awards the same badge twice', () => {
        reset([day(dayOffset(-1), 500, true)]);
        useWorkspaceStore.getState().checkAndAwardBadges();
        useWorkspaceStore.getState().checkAndAwardBadges();
        useWorkspaceStore.getState().computeStreakState();
        expect(earnedIds().filter(id => id === 'first_day')).toHaveLength(1);
    });

    it('spends exactly one repair and refuses when none are left', () => {
        reset([], { streakRepairsAvailable: 1 });
        useWorkspaceStore.getState().repairStreak(dayOffset(-1));
        expect(useWorkspaceStore.getState().goalConfig.streakRepairsAvailable).toBe(0);

        useWorkspaceStore.getState().repairStreak(dayOffset(-2));
        expect(useWorkspaceStore.getState().writingDays.filter(d => d.repaired)).toHaveLength(1);
    });
});
