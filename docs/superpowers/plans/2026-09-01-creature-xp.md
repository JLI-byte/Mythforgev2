# Creature XP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meeting the daily writing goal earns experience, the streak multiplies it, and the accumulated total moves a creature through growth stages. Phase 1 is the experience system plus a placeholder egg in the Home streak tile.

**Architecture:** Two pure leaf modules. `writingDays.ts` owns date aggregation and the goal-met verdict; `creatureXp.ts` owns the XP and stage maths on top of it. XP is never stored — it is derived from `writingDays` the way `streakState` already is. The store's per-project `goalMet` bug is fixed by routing both write paths through the same shared helper.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, CSS Modules, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-creature-xp-design.md`

---

## Refinement to the spec

The spec put `streakByDate` in `creatureXp.ts`. The plan moves it, `totalsByDate`
and `recomputeGoalMet` into a separate `writingDays.ts`, because the store needs
`recomputeGoalMet` for the goalMet fix and the store should not import from a
module named after the creature. `creatureXp.ts` imports from `writingDays.ts`.
Same behaviour, cleaner dependency direction.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/writingDays.ts` (create) | Aggregate writingDays by date; the goal-met verdict; per-day streak. |
| `src/lib/writingDays.test.ts` (create) | Unit tests for the above. |
| `src/lib/creatureXp.ts` (create) | Multiplier tiers, per-day XP, totals, stages, progress. |
| `src/lib/creatureXp.test.ts` (create) | Unit tests for the above. |
| `src/store/workspaceStore.ts` (modify) | Route goalMet through the shared helper; delete `XPEvent`/`xpEvents`. |
| `src/components/home/EggPlaceholder.tsx` (create) | Inline-SVG placeholder egg. |
| `src/components/home/HomePage.tsx` (modify) | Derive creature progress; render it in the streak tile. |
| `src/components/home/HomePage.module.css` (modify) | Creature styles; drop the flame styles. |

Leaf-module conventions: 4-space indent, module doc comment naming it a leaf
module, named exports. See `src/lib/goalSchedule.ts`.

---

### Task 1: Day aggregation module

**Files:**
- Create: `src/lib/writingDays.ts`
- Create: `src/lib/writingDays.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/writingDays.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/writingDays.test.ts`
Expected: FAIL — `Failed to resolve import "./writingDays"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/writingDays.ts`:

```ts
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

/** Shift a local YYYY-MM-DD key by whole days. */
export function addDays(key: string, delta: number): string {
    const [y, m, d] = key.split('-').map(Number);
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
        current.words += d.wordsWritten || 0;
        current.minutes += d.minutesWritten || 0;
        totals.set(d.date, current);
    }
    return totals;
}

/** Whether a date's totals clear that date's goal. */
export function isGoalMet(totals: DayTotals, config: GoalRules, dateKey: string): boolean {
    return config.primaryMetric === 'words'
        ? totals.words >= targetForDateKey(config, dateKey)
        : totals.minutes >= config.dailyTimeTarget;
}

/**
 * Restamp goalMet on every row from its DATE total.
 *
 * The flag used to be set from a single project's words, so 300 words in one
 * project and 300 in another lost a 500-word day entirely. Every row on a date
 * now carries that date's verdict. Returns new rows; never mutates.
 */
export function recomputeGoalMet<T extends WritingDayLike>(days: T[], config: GoalRules): T[] {
    const totals = totalsByDate(days);
    return days.map(d => ({
        ...d,
        goalMet: isGoalMet(totals.get(d.date) ?? { words: 0, minutes: 0 }, config, d.date),
    }));
}

/** Dates whose totals met the goal, ascending, one entry each. */
export function goalMetDates(days: WritingDayLike[], config: GoalRules): string[] {
    const totals = totalsByDate(days);
    return [...totals.entries()]
        .filter(([key, t]) => isGoalMet(t, config, key))
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/writingDays.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/writingDays.ts src/lib/writingDays.test.ts
git commit -m "feat: aggregate writing days by date, with a shared goal-met rule"
```

---

### Task 2: Creature XP module

**Files:**
- Create: `src/lib/creatureXp.ts`
- Create: `src/lib/creatureXp.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/creatureXp.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/creatureXp.test.ts`
Expected: FAIL — `Failed to resolve import "./creatureXp"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/creatureXp.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/creatureXp.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/creatureXp.ts src/lib/creatureXp.test.ts
git commit -m "feat: derive creature experience from writing history"
```

---

### Task 3: Fix goalMet in the store and drop the XP event log

**Files:**
- Modify: `src/store/workspaceStore.ts`

- [ ] **Step 1: Import the shared helper**

Add to the import block near the existing `@/lib/goalSchedule` import:

```ts
import { recomputeGoalMet, type GoalRules } from '@/lib/writingDays';
```

- [ ] **Step 2: Route recordWritingSession through it**

In `recordWritingSession`, replace the per-row goalMet logic. The existing block builds `updatedDays` in an if/else, computing `goalMet` inline in each branch. Replace both computations so the branches only build rows, then restamp every row from the date totals afterwards.

Change the `if (existing)` branch from:

```ts
                        const updated: WritingDay = {
                            ...existing,
                            wordsWritten: existing.wordsWritten + wordsAdded,
                            minutesWritten: existing.minutesWritten + minutesSpent,
                            goalMet: false, // recomputed below
                        };
                        // Compute goalMet based on primaryMetric
                        updated.goalMet = state.goalConfig.primaryMetric === 'words'
                            ? updated.wordsWritten >= targetForDateKey(state.goalConfig, today)
                            : updated.minutesWritten >= state.goalConfig.dailyTimeTarget;
                        updatedDays = state.writingDays.map(d =>
                            d.id === existing.id ? updated : d
                        );
```

to:

```ts
                        const updated: WritingDay = {
                            ...existing,
                            wordsWritten: existing.wordsWritten + wordsAdded,
                            minutesWritten: existing.minutesWritten + minutesSpent,
                            goalMet: false, // restamped from the date total below
                        };
                        updatedDays = state.writingDays.map(d =>
                            d.id === existing.id ? updated : d
                        );
```

Change the `else` branch from:

```ts
                            goalMet: state.goalConfig.primaryMetric === 'words'
                                ? wordsAdded >= targetForDateKey(state.goalConfig, today)
                                : minutesSpent >= state.goalConfig.dailyTimeTarget,
```

to:

```ts
                            goalMet: false, // restamped from the date total below
```

Then, immediately after the if/else closes and before `const streakState = computeStreakFromDays(updatedDays);`, insert:

```ts
                    // Goal met is a property of the DAY, not of one project's row:
                    // 300 words in one project and 300 in another is a 600-word day.
                    // Adding words to any project can flip the whole date, so every
                    // row is restamped from the date totals.
                    updatedDays = recomputeGoalMet(updatedDays, state.goalConfig as GoalRules);
```

- [ ] **Step 3: Route updateGoalConfig through it**

Replace:

```ts
                    // Recompute goalMet on existing days with new targets
                    const updatedDays = state.writingDays.map(d => ({
                        ...d,
                        goalMet: newConfig.primaryMetric === 'words'
                            ? d.wordsWritten >= targetForDateKey(newConfig, d.date)
                            : d.minutesWritten >= newConfig.dailyTimeTarget,
                    }));
```

with:

```ts
                    // Recompute goalMet on existing days against the new targets,
                    // judging each date on its combined total across projects.
                    const updatedDays = recomputeGoalMet(state.writingDays, newConfig as GoalRules);
```

- [ ] **Step 4: Delete the unused XP event log**

Remove all four:

1. The `XPEvent` interface and its doc comment:

```ts
/** XP event log — data layer only, not shown in UI yet */
interface XPEvent {
    id: string;
    type: 'goal_met' | 'streak_milestone' | 'project_milestone' | 'first_session';
    xp: number;
    projectId?: string;
    earnedAt: Date;
}
```

2. The state field `    xpEvents: XPEvent[];`
3. The initial value `            xpEvents: [],`
4. The rehydrate guard line containing `state.xpEvents = []`

Also update the reviver comment that names it, from:

```ts
                    // with createdAt/updatedAt. Non-entity arrays (writingDays,
                    // earnedBadges, xpEvents) are returned as-is to avoid corruption.
```

to:

```ts
                    // with createdAt/updatedAt. Non-entity arrays (writingDays,
                    // earnedBadges) are returned as-is to avoid corruption.
```

`xpEvents` is not in `partialize`, so it was never persisted — no migration is required.

- [ ] **Step 5: Remove the now-unused import if applicable**

Run:

```bash
grep -n "targetForDateKey" src/store/workspaceStore.ts
```

If no usages remain, drop `targetForDateKey` from the `@/lib/goalSchedule` import. If usages remain, leave the import alone.

- [ ] **Step 6: Typecheck and test**

Run: `npx tsc --noEmit --pretty false && npx vitest run`
Expected: tsc silent; every test passes. Pay attention to `src/store/streaks.test.ts` — if a test there encoded the per-project behaviour, it is now wrong and should be updated to expect the date-total rule, not reverted.

- [ ] **Step 7: Commit**

```bash
git add src/store/workspaceStore.ts
git commit -m "fix: judge the daily goal on the day's total, not one project's row"
```

---

### Task 4: The egg and the streak tile

**Files:**
- Create: `src/components/home/EggPlaceholder.tsx`
- Modify: `src/components/home/HomePage.tsx`
- Modify: `src/components/home/HomePage.module.css`

No unit tests — presentational, verified in the browser in Task 5.

- [ ] **Step 1: Create the placeholder egg**

Create `src/components/home/EggPlaceholder.tsx`:

```tsx
"use client";

import React from 'react';

/**
 * Stand-in creature: an egg drawn inline rather than shipped as an image, so it
 * inherits the current text colour, needs no asset request, and is trivially
 * replaced by real art per stage later.
 *
 * `cracked` shows the first fissure once the writer is past the egg stage.
 */
export function EggPlaceholder({ size = 34, cracked = false }: { size?: number; cracked?: boolean }) {
  return (
    <svg
      width={size}
      height={size * 1.24}
      viewBox="0 0 50 62"
      fill="none"
      role="img"
      aria-label={cracked ? 'A cracking egg' : 'An egg'}
    >
      <ellipse cx="25" cy="36" rx="23" ry="24" fill="currentColor" opacity="0.9" />
      <path d="M25 12 C11 12 2 24 2 36 C2 24 11 12 25 12 Z" fill="currentColor" opacity="0.9" />
      <ellipse cx="25" cy="34" rx="23" ry="26" fill="currentColor" opacity="0.9" />
      <ellipse cx="17" cy="24" rx="6" ry="8" fill="#fff" opacity="0.22" />
      {cracked && (
        <path
          d="M12 34 L20 30 L16 40 L26 36 L22 46"
          stroke="#0f1116"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Add the styles**

In `src/components/home/HomePage.module.css`, delete the `.flameLit` and `.flameCold` rules (there is a duplicated `.flameCold` — remove both copies), then add after `.streakNumber`:

```css
.eggWrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.eggLit { color: #8ab4ff; }
.eggCold { color: rgba(255, 255, 255, 0.28); }

.stageRow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.stageName {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.stageXp {
  font-size: 0.72rem;
  color: var(--muted, #8b8b95);
  font-variant-numeric: tabular-nums;
}

.xpTrack {
  height: 5px;
  margin-top: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
.xpFill {
  height: 100%;
  border-radius: 3px;
  background: #8ab4ff;
  transition: width 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

@media (prefers-reduced-motion: reduce) {
  .xpFill { transition: none; }
}
```

- [ ] **Step 3: Wire it into HomePage**

In `src/components/home/HomePage.tsx`:

Remove `Flame` from the `lucide-react` import list, leaving the other icons untouched.

Add:

```tsx
import { creatureProgress, multiplierForStreak } from '@/lib/creatureXp';
import type { GoalRules } from '@/lib/writingDays';
import { EggPlaceholder } from './EggPlaceholder';
```

Add this derivation beside the other `useMemo` blocks:

```tsx
  const creature = useMemo(
    () => creatureProgress(writingDays, goalConfig as GoalRules),
    [writingDays, goalConfig],
  );
```

- [ ] **Step 4: Replace the streak tile body**

Replace the whole `tileStreak` block:

```tsx
          <div className={`${styles.tile} ${styles.tileStreak}`}>
            <span className={styles.tileLabel}>Streak</span>
            <div className={styles.streakValue}>
              <Flame size={26} className={streakState.currentStreak > 0 ? styles.flameLit : styles.flameCold} />
              <span className={styles.streakNumber}>{streakState.currentStreak}</span>
            </div>
            <p className={styles.tileFoot}>
              day{streakState.currentStreak === 1 ? '' : 's'} · best {streakState.longestStreak}
            </p>
          </div>
```

with:

```tsx
          <div className={`${styles.tile} ${styles.tileStreak}`}>
            <span className={styles.tileLabel}>Streak</span>
            <div className={styles.eggWrap}>
              <span className={streakState.currentStreak > 0 ? styles.eggLit : styles.eggCold}>
                <EggPlaceholder size={30} cracked={creature.stage.id !== 'egg'} />
              </span>
              <span className={styles.streakNumber}>{streakState.currentStreak}</span>
            </div>
            <p className={styles.tileFoot}>
              day{streakState.currentStreak === 1 ? '' : 's'} · best {streakState.longestStreak}
              {' · '}{multiplierForStreak(streakState.currentStreak)}× xp
            </p>

            <div className={styles.stageRow}>
              <span className={styles.stageName}>{creature.stage.label}</span>
              <span className={styles.stageXp}>
                {creature.nextStage
                  ? `${creature.totalXp.toLocaleString()} / ${creature.nextStage.minXp.toLocaleString()} xp`
                  : `${creature.totalXp.toLocaleString()} xp`}
              </span>
            </div>
            <div className={styles.xpTrack}>
              <div className={styles.xpFill} style={{ width: `${(creature.fraction * 100).toFixed(1)}%` }} />
            </div>
          </div>
```

- [ ] **Step 5: Typecheck, lint, test**

Run: `npx tsc --noEmit --pretty false && npx eslint src/components/home/ && npx vitest run`

Expected: tsc silent; eslint reports only the pre-existing `react-hooks/set-state-in-effect` warning on the spotlight effect; every test passes.

- [ ] **Step 6: Confirm nothing still references the flame**

Run:

```bash
grep -n "Flame\|flameLit\|flameCold" src/components/home/HomePage.tsx src/components/home/HomePage.module.css
```

Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add src/components/home/EggPlaceholder.tsx src/components/home/HomePage.tsx src/components/home/HomePage.module.css
git commit -m "feat: show the creature egg and its experience on the streak tile"
```

---

### Task 5: Verify in the browser

**Files:** none unless a defect turns up.

Use the Browser pane (`preview_start` with `{name: "dev"}`); never run the dev server through Bash.

- [ ] **Step 1: Check the tile renders**

Open Home. Confirm the streak tile shows an egg, the streak number, the multiplier in the foot line, a stage name, an XP figure, and a progress bar.

- [ ] **Step 2: Check the numbers against the formula**

In the console, read the persisted state and compute the expectation by hand:

```js
const st = JSON.parse(localStorage.getItem('lorecanvas-workspace')).state;
const byDate = {};
for (const d of st.writingDays) byDate[d.date] = (byDate[d.date] || 0) + d.wordsWritten;
({ byDate, target: st.goalConfig.dailyWordTarget, shownXp: document.body.innerText.match(/[\d,]+ \/ [\d,]+ xp/)?.[0] });
```

Confirm the XP shown matches `(50 + min(words, target*2)/10) * multiplier` summed over the dates, given the streak each date had.

- [ ] **Step 3: Check XP responds to writing**

Open a project, type enough words to meet today's goal, return Home. XP should rise and the bar should advance. Note the autosave flow drives `recordWritingSession`, so allow a moment for it to fire.

- [ ] **Step 4: Check the goalMet fix**

This is the behaviour that was broken. With a goal of 500, write ~300 words in one project and ~300 in another on the same day. Previously this recorded no goal met. Confirm the streak now counts that day and the goal bonus is included in XP.

- [ ] **Step 5: Check the egg cracks**

Temporarily lower the everyday goal via the cog on the Today tile so accumulated XP crosses 500, and confirm the egg gains its crack and the stage reads "Cracking". Restore the goal afterwards.

- [ ] **Step 6: Check for errors and reload**

Read console messages filtered to errors — note the Browser pane retains output across reloads, so confirm any error is live rather than buffered. Then reload and confirm XP and stage are unchanged, since both are derived.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: <what the browser pass actually found>"
```

If nothing needed fixing, skip this step. Do not create an empty commit.
