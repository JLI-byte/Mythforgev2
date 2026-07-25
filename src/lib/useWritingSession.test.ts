import { describe, it, expect, beforeEach } from 'vitest';
import {
    seedWritingBaseline,
    nextSessionDelta,
    shouldAutoSnapshot,
    __resetWritingSession,
} from './useWritingSession';

const T0 = 1_700_000_000_000; // fixed epoch for deterministic minute math
const MIN = 60_000;

beforeEach(() => __resetWritingSession());

describe('nextSessionDelta', () => {
    it('records nothing on the first sighting of an unseeded scene', () => {
        expect(nextSessionDelta('s1', 500, T0)).toBeNull();
    });

    it('records the delta once a baseline exists', () => {
        nextSessionDelta('s1', 500, T0);
        const d = nextSessionDelta('s1', 540, T0 + 2 * MIN);
        expect(d).toEqual({ wordsAdded: 40, minutesSpent: 2 });
    });

    it('counts words typed since the seeded load point', () => {
        seedWritingBaseline('s1', 500, T0);
        expect(nextSessionDelta('s1', 512, T0 + MIN)).toEqual({ wordsAdded: 12, minutesSpent: 1 });
    });

    it('rounds a sub-minute burst up to one minute', () => {
        seedWritingBaseline('s1', 0, T0);
        expect(nextSessionDelta('s1', 30, T0 + 5_000)!.minutesSpent).toBe(1);
    });

    it('returns null when the word count has not moved', () => {
        seedWritingBaseline('s1', 100, T0);
        expect(nextSessionDelta('s1', 100, T0 + MIN)).toBeNull();
    });

    it('does not double-count words retyped after a deletion', () => {
        seedWritingBaseline('s1', 100, T0);
        expect(nextSessionDelta('s1', 120, T0 + MIN)).toEqual({ wordsAdded: 20, minutesSpent: 1 });
        // Writer deletes back down to 90 …
        expect(nextSessionDelta('s1', 90, T0 + 2 * MIN)).toBeNull();
        // … then types back up to 110: only the 20 above the new low count.
        // Elapsed time still runs from the last *recorded* delta — deleting and
        // rewriting is working time, so it counts as 2 minutes, not 1.
        expect(nextSessionDelta('s1', 110, T0 + 3 * MIN)).toEqual({ wordsAdded: 20, minutesSpent: 2 });
    });

    it('keeps a baseline across an editor remount (the regression)', () => {
        // Scene loads, writer types.
        seedWritingBaseline('s1', 100, T0);
        expect(nextSessionDelta('s1', 150, T0 + MIN)).toEqual({ wordsAdded: 50, minutesSpent: 1 });

        // Writer visits Home and comes back — the editor remounts and re-seeds.
        seedWritingBaseline('s1', 150, T0 + 2 * MIN); // no-op, baseline survives

        // The next burst is still counted instead of being swallowed.
        expect(nextSessionDelta('s1', 175, T0 + 3 * MIN)).toEqual({ wordsAdded: 25, minutesSpent: 2 });
    });

    it('tracks scenes independently', () => {
        seedWritingBaseline('s1', 100, T0);
        seedWritingBaseline('s2', 0, T0);
        expect(nextSessionDelta('s1', 110, T0 + MIN)).toEqual({ wordsAdded: 10, minutesSpent: 1 });
        expect(nextSessionDelta('s2', 40, T0 + MIN)).toEqual({ wordsAdded: 40, minutesSpent: 1 });
    });

    it('ignores an empty scene id', () => {
        expect(nextSessionDelta('', 100, T0)).toBeNull();
    });
});

describe('seedWritingBaseline', () => {
    it('never overwrites an existing baseline', () => {
        seedWritingBaseline('s1', 100, T0);
        seedWritingBaseline('s1', 999, T0 + MIN); // ignored
        expect(nextSessionDelta('s1', 120, T0 + 2 * MIN)).toEqual({ wordsAdded: 20, minutesSpent: 2 });
    });
});

describe('shouldAutoSnapshot', () => {
    it('skips empty scenes', () => {
        expect(shouldAutoSnapshot('s1', T0, 0)).toBe(false);
    });

    it('allows the first snapshot then throttles for five minutes', () => {
        expect(shouldAutoSnapshot('s1', T0, 100)).toBe(true);
        expect(shouldAutoSnapshot('s1', T0 + MIN, 100)).toBe(false);
        expect(shouldAutoSnapshot('s1', T0 + 6 * MIN, 100)).toBe(true);
    });
});
