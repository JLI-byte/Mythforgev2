# Creature XP — design

**Date:** 2026-09-01
**Branch:** `feature/app-styling`
**Status:** approved, not yet implemented

## Problem

The Home streak tile shows a flame and a number. It records a habit but does
not reward one — the number resets to zero on a missed day and nothing
accumulates.

## Goal

A creature the writer hatches and raises. Meeting the daily goal earns
experience, the writing streak multiplies it, and the accumulated total moves
the creature through growth stages.

**Phase 1, this spec:** the experience system and a placeholder egg in the
streak tile.

**Later phases, not designed here:** creature art, hatch animation, species,
naming, XP notifications.

## Core decisions

### XP is derived, not logged

XP is a pure function of `writingDays` and `goalConfig`, recomputed the way
`streakState` already is. It is never stored.

The store already recomputes `goalMet` across the entire writing history
whenever the goal config changes (`updateGoalConfig`). An append-only XP log
would be the one piece of state able to disagree with the days that earned it.
Deriving keeps a single source of truth, makes double-counting structurally
impossible, and means the writer's existing history earns XP the moment the
feature ships — the egg starts with real progress rather than at zero.

The accepted cost: lowering a past day's goal target retroactively increases XP.
This is mild and favours the writer.

### The multiplier is the streak on that day

Each day's XP uses the streak length **as it was on that day**, not the current
streak. The total is the sum over all days.

If the multiplier were the current streak applied to a lifetime total, breaking
a streak would shrink the creature. A pet you are raising must never go
backwards. Under this rule XP is monotonic: it only ever increases.

### `XPEvent` is removed

The store carries an unused `XPEvent` interface, an `xpEvents: XPEvent[]` field,
an initial value, and a rehydrate guard. Nothing writes to them. Under a derived
system they describe a log we have decided not to keep, so they are deleted.

`xpEvents` is not in `partialize`, so it was never persisted — no migration is
needed and no existing data is affected.

## The formula

For each calendar date, totalling every project that has an entry on it:

```
words    = total words written on that date
target   = targetForDateKey(goalConfig, date)   // reuses the weekday schedule
goalMet  = words >= target
base     = goalMet ? GOAL_BONUS : 0
wordXp   = min(words, target * WORD_CAP_MULTIPLE) / WORDS_PER_XP
dayXp    = round((base + wordXp) * multiplier(streakOnThatDay))
```

Constants: `GOAL_BONUS = 50`, `WORDS_PER_XP = 10`, `WORD_CAP_MULTIPLE = 2`.

Words on a day that missed the goal still earn word XP. Showing up should always
count for something.

The cap at twice the target is what keeps consistency worth more than volume: a
single 10,000-word day cannot outgrow weeks of steady work.

### Worked examples

At a 500-word daily goal:

| Day | Words | Streak that day | XP |
|---|---|---|---|
| First day writing | 500 | 1 | (50 + 50) × 1 = **100** |
| Same, on a 14-day streak | 500 | 14 | (50 + 50) × 2 = **200** |
| Big day, 30-day streak | 2,000 | 30 | (50 + 100) × 3 = **450** — words capped at 1,000 |
| Missed the goal | 200 | 0 | (0 + 20) × 1 = **20** |

## Streak multiplier

| Streak that day | Multiplier |
|---|---|
| 0–2 | 1× |
| 3–6 | 1.25× |
| 7–13 | 1.5× |
| 14–29 | 2× |
| 30+ | 3× |

Tiers rather than a continuous curve, so the writer can always name the tier
they are on and see the next one.

## Growth stages

| Stage | XP |
|---|---|
| Egg | 0 |
| Cracking | 500 |
| Hatchling | 1,500 |
| Juvenile | 4,000 |
| Adult | 10,000 |

At a met 500-word goal — roughly 100 XP/day rising to 200–300 with streak — that
is cracking within a week, hatching in about two, adult over a few months.

## New leaf module: `src/lib/creatureXp.ts`

Pure, no store or React import, unit tested. Follows `goalSchedule.ts` and
`worldShelves.ts`.

```ts
export interface CreatureStage {
  id: 'egg' | 'cracking' | 'hatchling' | 'juvenile' | 'adult';
  label: string;
  minXp: number;
}

export interface CreatureProgress {
  totalXp: number;
  stage: CreatureStage;
  nextStage: CreatureStage | null;
  /** 0-1 through the current stage; 1 when there is no next stage. */
  fraction: number;
  xpToNext: number;
}

export function multiplierForStreak(streak: number): number;
export function xpForDay(words: number, target: number, streak: number): number;

/** Streak length on each goal-met date, keyed by date. */
export function streakByDate(days: WritingDayLike[], config: GoalTargetConfig): Map<string, number>;

export function totalXp(days: WritingDayLike[], config: GoalTargetConfig): number;
export function stageForXp(xp: number): CreatureStage;
export function creatureProgress(days: WritingDayLike[], config: GoalTargetConfig): CreatureProgress;
```

### Two details the implementation must get right

**Aggregate by date first.** `writingDays` holds one entry per project per date,
so a date with three projects has three rows. XP is computed on the date total,
not per row. The module recomputes `goalMet` from that total rather than reading
the stored per-row flag — see the section above.

**Derive the per-day streak.** `computeStreakFromDays` returns only the final
state. This module needs the running streak on each date: collect the goal-met
dates, sort them, and walk forward counting consecutive calendar days, resetting
on a gap.

## Discovered during design: goalMet is computed per project, not per day

`WritingDay` carries `goalMet` on a **per-project row**, set from that row's word
count alone (`recordWritingSession`). `computeStreakFromDays` then filters those
rows. So a writer who puts 300 words into one project and 300 into another, on a
500-word goal, has written 600 words and met their goal — but neither row reaches
500, so the app records no goal met and no streak for that day.

This is a pre-existing bug, not something this feature introduces. It matters
here because the creature aggregates by date and would therefore credit days the
streak number does not, leaving two numbers on the same tile disagreeing.

**Decision: fix it as part of this work.** `recordWritingSession` and
`updateGoalConfig` set `goalMet` from the date total across projects rather than
the single row. Streak and XP then agree because they read the same rule.

The retroactive effect is safe in one direction only: a date total is always
greater than or equal to any single row on that date, so days can only start
counting, never stop. Existing streaks can improve and cannot regress.

## The tile

`.tileStreak` keeps the streak number and gains the creature.

- The `Flame` icon is replaced by a placeholder egg drawn as **inline SVG** in a
  small `EggPlaceholder` component — no image file, so it themes with the app,
  costs no asset request, and is trivially swapped for real art later
- Adds the XP total and the current stage name
- Adds a progress bar showing `fraction` toward the next stage
- Foot line keeps `best {longestStreak}` and gains the current multiplier, since
  the multiplier is the thing the streak now buys

## Testing

`src/lib/creatureXp.test.ts`:

- Each multiplier tier, including both sides of every boundary
- `xpForDay`: goal met and missed, the word cap, zero words
- Aggregation: two projects on one date count as one combined day
- `streakByDate`: consecutive days increment, a gap resets, non-goal days break
  the run
- Stage thresholds, including exact boundary values
- `creatureProgress`: fraction at stage start, mid, and at Adult where
  `nextStage` is null
- **Monotonicity:** appending a day never lowers `totalXp`

No component tests — this repo has no harness. The tile is verified in the
browser preview.

## Risks

- **The formula is guesswork until it is lived with.** All constants sit
  together at the top of one module, so retuning is a one-line change.
- **A long history makes the first render expensive.** The derivation is O(days)
  over a collection that is already fully in memory and iterated for the heatmap;
  it is memoised in the tile like every other Home derivation.
- **Retroactive goal edits shift XP.** Accepted above, and it can only move XP up
  when a target is lowered.
