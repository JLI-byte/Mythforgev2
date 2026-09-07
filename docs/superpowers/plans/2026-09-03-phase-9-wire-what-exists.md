# Phase 9 — Wire What Is Already Built Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect behaviour that is already implemented and correct but that nothing calls — six store actions, the ProseMirror `codeBlock` node, and the writing column's resize handles — so a user can reach it.

**Architecture:** Every task in this phase is a wire, not a build. The store action or ProseMirror node already exists and already works; what is missing is the control that invokes it. Tasks are ordered store-first so that each UI change lands on a contract that a `.test.ts` has already pinned. Nothing here changes a data shape, so the build is green between every task and no migration is needed.

**Tech Stack:** TypeScript (strict), React 19, Next 16, Zustand, TipTap 3 / ProseMirror, Vitest 3.2.6 (jsdom).

**Depends on:** Phase 1 (subtraction) and Phase 2 (remove AI). Assumes one work type (`'story'`) and no AI code.

**Note on the test runner:** `vitest.config.ts` includes only `src/**/*.test.ts` — **not** `.test.tsx`. There are currently 45 `.test.ts` files and zero `.test.tsx` files. Store logic is tested; component wiring is verified by hand, and every task that touches a component carries explicit manual steps.

**Note on line numbers:** every line number below was read from the working tree at commit `afcfd98`, i.e. **before** Phases 1–8. Those phases will shift them. Each edit therefore also quotes the exact code to find, and the quote is authoritative — if a line number misses, search for the quoted text.

---

## What the audit actually found

Read this before writing any code. Three items in the roadmap's Phase 9 table were verified against the source and are **not** what they were described as.

| Claim | Verdict | Evidence |
|-------|---------|----------|
| `checkAndAwardBadges` is unwired, so **the five achievements cannot be earned at all** | **Half wrong.** The action is uncalled, but the badge *logic* is already wired: `recordWritingSession` calls `checkBadges` inline (`workspaceStore.ts:1931`), and it is reached by `DeskTipTapEditor` → `useWritingSession` → `recordWritingSession` (`useWritingSession.ts:116`). Writing words **does** award badges today | `workspaceStore.ts:1929-1938`, `useWritingSession.ts:106-118`, `DeskTipTapEditor.tsx:27,60-61` |
| `toggleStandardFormat` gives "double-spaced, 12pt, running headers, word count on page one" | **Wrong.** The action only swaps `editorMaxWidth` to `720` and caches the old value. There is no typography in it at all. Worse, **`editorMaxWidth` is read by no component** — `setEditorMaxWidth` is also uncalled, so wiring the toggle on its own would produce no visible change | `workspaceStore.ts:1798-1813`; `grep -rn editorMaxWidth src --include=*.tsx` returns nothing |
| `15e`: "the add toolbar only appears once the board is non-empty, so an empty board looks like a dead end" | **Wrong.** The research add toolbar's condition is `{isResearch && (` at `WritingDesk.tsx:913` — there is no `widgets.length` term. The three buttons (Note, Clipping, Link) render on an empty board, alongside a centred `pointer-events: none` empty hint at `WritingDesk.tsx:637`. **This half of `15e` is dropped.** Only the URL field survives | `WritingDesk.tsx:637-645, 913-919`; `WritingDesk.module.css:4673-4703, 6826-6847` |

Everything else checked out:

| Action | Declared | Implemented | Component references |
|--------|----------|-------------|----------------------|
| `checkAndAwardBadges` | `:1027` | `:1996` | **0** |
| `toggleStandardFormat` | `:905` | `:1798` | **0** |
| `repairStreak` | `:1023` | `:1959` | **0** |
| `deleteScene` | `:815` | `:1579` | **0** |
| `deleteDocument` | `:811` | `:1509` | **0** |
| `reorderScenes` | `:817` | `:1615` | **0** |
| `deleteSocialPost` | `:1016` | `:1766` | **0** |
| `moveWorldBibleType` | `:917` | `:2145` | **0** |

Verified with `grep -rn "<name>" src --include=*.tsx` for each — every one returns nothing outside `src/store/workspaceStore.ts`. None of the four actions Phase 1 deletes (`setSessionWordCount`, `setHoveredEntity`, `deleteHierarchyTemplate`, `updateGlobalWidgets`) is touched here.

**Bookkeeping note:** `2026-09-03-phase-1-subtraction.md:29-30` says `deleteSocialPost` and `moveWorldBibleType` are "wired in Phase 7". The roadmap's Phase 9 table (`2026-09-03-remediation-roadmap.md:198`) claims them under `04c`. The roadmap wins; they are Tasks 5 and 6 below.

### The real badge gap

`checkBadges` (`workspaceStore.ts:1150-1170`) reads only `streakState` and awards five badges:

| Badge id | Condition |
|----------|-----------|
| `first_day` | `streak.totalWritingDays >= 1` |
| `seven_day_streak` | `streak.currentStreak >= 7` |
| `thirty_day_streak` | `streak.currentStreak >= 30` |
| `ten_thousand_words` | `streak.totalWordsAllTime >= 10000` |
| `fifty_thousand_words` | `streak.totalWordsAllTime >= 50000` |

Four store paths move `streakState`. Only one of them awards:

| Path | Recomputes streak | Awards badges |
|------|-------------------|---------------|
| `recordWritingSession` (`:1889`) | yes | **yes** — inline `checkBadges` at `:1931` |
| `updateGoalConfig` (`:1942`) | yes (`recomputeGoalMet` can flip past days when the target drops) | **no** |
| `repairStreak` (`:1959`) | yes (a bought day can complete a 7- or 30-day run) | **no** |
| `onRehydrateStorage` (`:2592`) | yes (`state.streakState = computeStreakFromDays(...)`) | **no** |

So a writer who lowers their daily target from 1000 to 200, turning ten near-miss days into met days, earns nothing. Task 1 makes `checkAndAwardBadges` the single award point and calls it from all four paths.

---

## File Structure

**New:**

| Path | Why |
|------|-----|
| `src/store/badgeAwarding.test.ts` | Task 1 — badges award on every streak change |
| `src/store/sceneActions.test.ts` | Task 3 — `deleteScene` / `reorderScenes` contract |
| `src/store/documentActions.test.ts` | Task 4 — `deleteDocument` contract |
| `src/store/socialActions.test.ts` | Task 5 — `deleteSocialPost` contract |
| `src/store/moveWorldBibleType.test.ts` | Task 6 — `moveWorldBibleType` contract |
| `src/lib/safeUrl.ts` + `src/lib/safeUrl.test.ts` | Task 9 — LEAF MODULE; the Link card's href guard |

**Modified:**

| Path | Change |
|------|--------|
| `src/store/workspaceStore.ts` | `updateGoalConfig`, `repairStreak` and `computeStreakState` call `checkAndAwardBadges`; rehydrate awards too |
| `src/components/goals/GoalsContent.tsx` | Calendar days become repair targets; `ConfirmDialog` spends a repair |
| `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx` | Spine gains scene delete, scene move up/down, and chapter delete |
| `src/components/layout/SocialMediaPanel.tsx` | Each history row gains a delete button |
| `src/components/world/WorldBibleFolderTree.tsx` | Folder rows show draggable entity-type chips |
| `src/components/editor/desk/DeskTipTapEditor.tsx` | Standard-format toggle; Code Block in the block-style dropdown; measure comes from the store |
| `src/components/editor/desk/widgets/ReferenceCardRenderer.tsx` | URL field plus a guarded open-link anchor |
| `src/components/editor/WritingDesk.tsx` | The two docked resize handles gain `role="separator"`, labels and a visible grip |
| `src/components/editor/WritingDesk.module.css` | `pre`/`code` rules, standard-format rules, `--desk-measure`, docked resize grip |
| `src/components/world/WorldBibleFolderTree.module.css` | Type-chip rules |
| `src/components/goals/GoalsContent.module.css` | Repairable-day rules |
| `src/components/layout/SocialMediaPanel.module.css` | History-row delete rules |

**Established patterns this phase follows rather than reinvents:**

| Need | Existing pattern | Where |
|------|------------------|-------|
| Destructive confirmation | `ConfirmDialog` — portalled, Escape-closes, `confirmDanger` button | `src/components/editor/desk/MethodLibrary.tsx:163-191`, used at `WritingDesk.tsx:984,1003` |
| Lightweight two-click delete | `confirming` state + `CONFIRM_TIMEOUT_MS` auto-disarm | `WorldBibleFolderTree.tsx:11,55,80-84` |
| Store-action test | `useWorkspaceStore.setState(...)` then `getState().action()` | `src/store/worldBibleActions.test.ts` |
| Pure-module test | direct import, no store | `src/store/streaks.test.ts` |
| Toolbar button | `onMouseDown` + `preventDefault` so the editor keeps focus | `DeskTipTapEditor.tsx:212-216` |
| Visible resize handle | `background: transparent` + `transition: background 150ms ease` + `:hover` background | `src/components/layout/WorldBiblePanel.module.css:181-195` |
| Drag payload | `e.dataTransfer.setData(key, value)`, lowercase key check in `dragover` | `WorldBibleFolderTree.tsx:88-105` |

> Do **not** copy `.researchResizer` (`WritingDesk.module.css:4900-4914`) as the resize pattern — Phase 2 Task 8 deletes it.

---

## Task 1: Badges award on every streak change

**Files:**
- Test: `src/store/badgeAwarding.test.ts` (create)
- Modify: `src/store/workspaceStore.ts` — `updateGoalConfig` (`:1942`), `repairStreak` (`:1959`), `computeStreakState` (`:1988`), `onRehydrateStorage` (`:2592`)
- Modify: `src/components/goals/GoalsContent.tsx`

`checkAndAwardBadges` becomes the one place a badge is granted. It is idempotent — `checkBadges` filters against `earnedIds` and the action returns `{}` when nothing is new — so calling it from four places cannot double-award.

- [ ] **Step 1: Write the failing test**

Create `src/store/badgeAwarding.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store/badgeAwarding.test.ts`

Expected: FAIL. The first five badge assertions fail with `expected [] to include 'first_day'` (and `'seven_day_streak'`, `'ten_thousand_words'`). The last two — no-double-award and repair accounting — pass already.

- [ ] **Step 3: Route the three store paths through `checkAndAwardBadges`**

In `src/store/workspaceStore.ts`, `updateGoalConfig` currently reads:

```typescript
            updateGoalConfig: (updates) =>
                set((state) => {
```

Change it to run the award after the set. Replace the action's opening line and closing `}),` so it becomes:

```typescript
            updateGoalConfig: (updates) => {
                set((state) => {
                    const newConfig = { ...state.goalConfig, ...updates, goalConfigured: true };

                    // Recompute goalMet against the new targets, judging each date
                    // on its combined total across projects.
                    const updatedDays = recomputeGoalMet(state.writingDays, newConfig);

                    const streakState = computeStreakFromDays(updatedDays);

                    return {
                        goalConfig: newConfig,
                        writingDays: updatedDays,
                        streakState,
                    };
                });
                // Dropping the target can flip past days to met, which can complete a
                // streak or cross a word threshold. Awarding here keeps every path
                // that moves streakState going through one place.
                get().checkAndAwardBadges();
            },
```

`repairStreak` gets the same treatment:

```typescript
            repairStreak: (date) => {
                set((state) => {
                    if (state.goalConfig.streakRepairsAvailable <= 0) return {};

                    // Add a repaired day entry
                    const repairedDay: WritingDay = {
                        id: crypto.randomUUID(),
                        projectId: state.activeProjectId || '',
                        date,
                        wordsWritten: 0,
                        minutesWritten: 0,
                        goalMet: true,
                        // Marks the row as bought, so restamping the date from its
                        // word totals cannot silently spend the repair.
                        repaired: true,
                    };

                    const updatedDays = [...state.writingDays, repairedDay];
                    const streakState = computeStreakFromDays(updatedDays);

                    return {
                        writingDays: updatedDays,
                        goalConfig: {
                            ...state.goalConfig,
                            streakRepairsAvailable: state.goalConfig.streakRepairsAvailable - 1,
                        },
                        streakState,
                    };
                });
                get().checkAndAwardBadges();
            },
```

and `computeStreakState`:

```typescript
            computeStreakState: () => {
                const state = get();
                const streakState = computeStreakFromDays(state.writingDays);
                set({ streakState });
                get().checkAndAwardBadges();
                return streakState;
            },
```

`get` is already the second argument of the store creator (`workspaceStore.ts:1312`), so no signature change is needed.

- [ ] **Step 4: Award on rehydration**

In `onRehydrateStorage`, this line already exists:

```typescript
                    // Recompute streak on rehydration (streakState is never persisted)
                    state.streakState = computeStreakFromDays(state.writingDays ?? []);
```

Add immediately after it:

```typescript
                    // Badges are persisted but streakState is not, so a workspace that
                    // crossed a threshold on another device arrives here unawarded.
                    // checkBadges is pure and filters against what is already earned.
                    state.earnedBadges = [
                        ...state.earnedBadges,
                        ...checkBadges(state.streakState, state.earnedBadges),
                    ];
```

`checkBadges` is a module-scope function in the same file (`:1150`), so it needs no import.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/store/badgeAwarding.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 6: Full check**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: badges award from every path that moves the streak

checkAndAwardBadges existed and was called by nothing. recordWritingSession
awarded inline, so typing worked, but lowering the daily target, buying a
streak repair and rehydrating all moved streakState without checking. A
writer who dropped their target from 1000 to 200 and turned ten near-miss
days into met days earned nothing. All four paths now go through the action."
```

---

## Task 2: Spend a streak repair from the calendar

**Files:**
- Modify: `src/components/goals/GoalsContent.tsx`
- Modify: `src/components/goals/GoalsContent.module.css`

`repairStreak(date)` has no caller. The Goals panel already draws a month heatmap where every missed day is a `.calDayNone` cell (`GoalsContent.tsx:329-340`). Those cells become the repair target. Depends on Task 1 so the repair can complete a streak *and* award the badge in one action.

The store does not guard against repairing today, a future date, or a date that is already met — the UI must, since it is the only caller.

- [ ] **Step 1: Import the dialog and the new store bindings**

In `src/components/goals/GoalsContent.tsx`, extend the React import at line 15 and add the dialog import:

```typescript
import React, { useState, useMemo } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import styles from './GoalsContent.module.css';
import { useWorkspaceStore, BADGE_DEFINITIONS } from '@/store/workspaceStore';
import { ConfirmDialog } from '@/components/editor/desk/MethodLibrary';
import ShareModal from '../ui/ShareModal';
import { ShareCardOptions } from '@/lib/shareCard';
```

- [ ] **Step 2: Subscribe to the action and hold the pending date**

After `const updateGoalConfig = useWorkspaceStore(s => s.updateGoalConfig);` (line 151), add:

```typescript
    const repairStreak = useWorkspaceStore(s => s.repairStreak);
```

and after the `shareData` state (line 158), add:

```typescript
    // The calendar day a repair is armed against, or null.
    const [repairDate, setRepairDate] = useState<string | null>(null);
```

- [ ] **Step 3: Decide which days are repairable**

`getDayClass` already computes everything needed. Add this predicate directly above it (above the `/** Get calendar day CSS class based on writing stats */` comment):

```typescript
    const repairsLeft = goalConfig.streakRepairsAvailable;

    /**
     * A repair buys back a past day that was missed. Today is still winnable and
     * the future has not happened, so neither is offered — and a day that already
     * counts would spend the repair for nothing.
     */
    const canRepair = (day: CalendarDay): boolean =>
        repairsLeft > 0 &&
        day.dayNum > 0 &&
        !day.isFuture &&
        !day.isToday &&
        !(dayStatsMap[day.date]?.goalMet ?? false);
```

- [ ] **Step 4: Make the repairable cells buttons**

Replace the calendar grid at `GoalsContent.tsx:329-341`:

```tsx
                <div className={styles.calGrid}>
                    {calendarGrid.map((day, i) => (
                        <div
                            key={i}
                            className={getDayClass(day)}
                            title={day.date ? `${day.date}: ${dayStatsMap[day.date]?.wordsWritten ?? 0} words` : ''}
                        >
                            {day.dayNum > 0 && (
                                <span className={styles.calDayNum}>{day.dayNum}</span>
                            )}
                        </div>
                    ))}
                </div>
```

with:

```tsx
                <div className={styles.calGrid}>
                    {calendarGrid.map((day, i) => {
                        const words = day.date ? (dayStatsMap[day.date]?.wordsWritten ?? 0) : 0;
                        const repairable = canRepair(day);
                        if (!repairable) {
                            return (
                                <div
                                    key={i}
                                    className={getDayClass(day)}
                                    title={day.date ? `${day.date}: ${words} words` : ''}
                                >
                                    {day.dayNum > 0 && (
                                        <span className={styles.calDayNum}>{day.dayNum}</span>
                                    )}
                                </div>
                            );
                        }
                        return (
                            <button
                                key={i}
                                type="button"
                                className={`${getDayClass(day)} ${styles.calDayRepairable}`}
                                title={`${day.date}: ${words} words — repair this day`}
                                aria-label={`Repair ${day.date}, ${words} words written`}
                                onClick={() => setRepairDate(day.date)}
                            >
                                <span className={styles.calDayNum}>{day.dayNum}</span>
                            </button>
                        );
                    })}
                </div>
```

- [ ] **Step 5: Say how many repairs are left, and confirm before spending one**

Replace the stats row at `GoalsContent.tsx:343-346`:

```tsx
                <div className={styles.calStats}>
                    <span>🔥 {streakState.currentStreak} day streak</span>
                    <span>⭐ Best: {streakState.longestStreak} days</span>
                </div>
```

with:

```tsx
                <div className={styles.calStats}>
                    <span>🔥 {streakState.currentStreak} day streak</span>
                    <span>⭐ Best: {streakState.longestStreak} days</span>
                    <span className={styles.repairCount}>
                        {repairsLeft > 0
                            ? `🛠 ${repairsLeft} repair${repairsLeft === 1 ? '' : 's'} — click a missed day`
                            : '🛠 No repairs left'}
                    </span>
                </div>
```

Then, immediately before the closing `</div>` of the component's outermost `<div className={styles.container}>` — beside the existing `ShareModal` render — add:

```tsx
            {repairDate && (
                <ConfirmDialog
                    title="Repair this day?"
                    body={`${repairDate} will count toward your streak. This spends one of your ${repairsLeft} repair${repairsLeft === 1 ? '' : 's'} and cannot be undone.`}
                    confirmLabel="Spend a repair"
                    onConfirm={() => { repairStreak(repairDate); setRepairDate(null); }}
                    onCancel={() => setRepairDate(null)}
                />
            )}
```

- [ ] **Step 6: Style the repairable cells**

The calendar day rules live at `GoalsContent.module.css:267-347`. Append after `.calDayToday`:

```css
/* A missed past day the writer can buy back. Styled as an affordance, not a
   state: the heatmap colour still says what happened, the ring says it is
   actionable. A plain hover would be invisible until the pointer arrives. */
.calDayRepairable {
    border: 1px dashed rgba(128, 128, 128, 0.45);
    cursor: pointer;
    padding: 0;
    font: inherit;
    transition: border-color 150ms ease, background 150ms ease;
}

.calDayRepairable:hover,
.calDayRepairable:focus-visible {
    border-color: var(--accent);
    background: rgba(var(--accent-rgb), 0.12);
}

.repairCount {
    color: var(--muted, #888);
}
```

- [ ] **Step 7: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 8: Manual verification**

`npm run dev`, then in the browser at `http://localhost:4000`:

1. Open the Writing Goals side panel.
2. In **This Month**, a past day with no writing shows a dashed outline; today and future days do not.
3. Hovering a dashed day tints it with the accent colour; tabbing to it shows the same ring.
4. The line under the calendar reads `🛠 1 repair — click a missed day`.
5. Click a dashed past day. The confirm dialog names that date and says one repair will be spent. Press Escape — nothing changes.
6. Click again and confirm. That day turns met-coloured, the streak number rises, and the line now reads `🛠 No repairs left`.
7. No day is dashed any more.
8. If the repair completed a seven-day run, **The Habit** appears earned in Achievements without a reload.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: spend a streak repair from the Goals calendar

repairStreak had no caller, so the streakRepairsAvailable the store grants
every writer could never be spent. Missed past days in the heatmap are now
buttons; today and the future are not offered, and neither is a day that
already counts."
```

---

## Task 3: Delete and reorder scenes in the writing spine

**Files:**
- Test: `src/store/sceneActions.test.ts` (create)
- Modify: `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`
- Modify: `src/components/editor/WritingDesk.module.css`

`StoryWritingZone`'s spine (`:330-427`) lists every chapter and, for the open chapter, every scene sorted by `order`. It can add a chapter (`handleAddChapter`), add a scene (`:416-420`) and rename either by double-click (`:340-49`, `:387-407`). It cannot delete or reorder anything.

**A constraint to respect:** the scene row at `:389` is a `<button>`. HTML forbids nesting a button inside a button, and React will not warn. The row must become a `<div>` wrapper holding the existing select button plus the new controls.

- [ ] **Step 1: Write the characterization test**

Create `src/store/sceneActions.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, type Scene } from './workspaceStore';

function scene(id: string, order: number, documentId = 'd1'): Scene {
    return {
        id,
        documentId,
        projectId: 'p1',
        title: id,
        content: '',
        order,
        createdAt: new Date('2026-01-01'),
    };
}

const scenes = () => useWorkspaceStore.getState().scenes;
const orderOf = (documentId: string) =>
    scenes()
        .filter(s => s.documentId === documentId)
        .sort((a, b) => a.order - b.order)
        .map(s => s.id);

describe('deleteScene', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            activeProjectId: 'p1',
            activeDocumentId: 'd1',
            activeSceneId: 's2',
            scenes: [scene('s1', 0), scene('s2', 1), scene('s3', 2), scene('x1', 0, 'd2')],
        } as never);
    });

    it('removes only the named scene', () => {
        useWorkspaceStore.getState().deleteScene('s2');
        expect(scenes().map(s => s.id)).toEqual(['s1', 's3', 'x1']);
    });

    it('moves the selection to the next scene when the active one goes', () => {
        useWorkspaceStore.getState().deleteScene('s2');
        expect(useWorkspaceStore.getState().activeSceneId).toBe('s3');
    });

    it('falls back to the previous scene when the last one goes', () => {
        useWorkspaceStore.setState({ activeSceneId: 's3' } as never);
        useWorkspaceStore.getState().deleteScene('s3');
        expect(useWorkspaceStore.getState().activeSceneId).toBe('s2');
    });

    it('clears the selection when the chapter is emptied', () => {
        useWorkspaceStore.setState({
            activeSceneId: 'only',
            scenes: [scene('only', 0)],
        } as never);
        useWorkspaceStore.getState().deleteScene('only');
        expect(useWorkspaceStore.getState().activeSceneId).toBeNull();
    });

    it('leaves the selection alone when an inactive scene goes', () => {
        useWorkspaceStore.getState().deleteScene('s1');
        expect(useWorkspaceStore.getState().activeSceneId).toBe('s2');
    });

    it('ignores an unknown id', () => {
        useWorkspaceStore.getState().deleteScene('nope');
        expect(scenes()).toHaveLength(4);
    });
});

describe('reorderScenes', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            activeProjectId: 'p1',
            scenes: [scene('s1', 0), scene('s2', 1), scene('s3', 2), scene('x1', 0, 'd2')],
        } as never);
    });

    it('restamps order from the position in the id list', () => {
        useWorkspaceStore.getState().reorderScenes('d1', ['s3', 's1', 's2']);
        expect(orderOf('d1')).toEqual(['s3', 's1', 's2']);
    });

    it('does not touch scenes in another chapter', () => {
        useWorkspaceStore.getState().reorderScenes('d1', ['s3', 's2', 's1']);
        expect(scenes().find(s => s.id === 'x1')?.order).toBe(0);
    });

    it('leaves ids absent from the list untouched', () => {
        useWorkspaceStore.getState().reorderScenes('d1', ['s3', 's1']);
        expect(scenes().find(s => s.id === 's2')?.order).toBe(1);
    });
});
```

- [ ] **Step 2: Run it and read the result carefully**

Run: `npx vitest run src/store/sceneActions.test.ts`

Expected: **PASS — 9 tests.** This is not a red-green cycle: `deleteScene` and `reorderScenes` are already implemented and correct. The test pins the contract the UI is about to depend on. **If any assertion fails, stop** — the action does not behave the way the rest of this task assumes, and the UI design must be revisited before continuing.

- [ ] **Step 3: Commit the contract before touching the UI**

```bash
git add src/store/sceneActions.test.ts
git commit -m "test: pin the deleteScene and reorderScenes contracts

Both actions shipped with no caller and no coverage. The spine is about to
depend on the selection-handoff rule and on order being restamped from list
position, so both are pinned first."
```

- [ ] **Step 4: Subscribe to the actions and hold the pending delete**

In `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`, after `const updateDocument = useWorkspaceStore(s => s.updateDocument);` (line 32), add:

```typescript
  const deleteScene = useWorkspaceStore(s => s.deleteScene);
  const reorderScenes = useWorkspaceStore(s => s.reorderScenes);
```

and after the `editingNode` state (line 33), add:

```typescript
  // The scene a delete is armed against, or null. Scenes hold prose, so the
  // desk's ConfirmDialog gates the delete rather than a two-click arm.
  const [pendingSceneDelete, setPendingSceneDelete] = useState<{ id: string; title: string } | null>(null);
```

Add the dialog import beside the existing desk imports (after the `BookCoverEditor` import at line 22):

```typescript
import { ConfirmDialog } from '../../MethodLibrary';
```

- [ ] **Step 5: Add the two handlers**

Directly above `const docScenes = ...` (line 125), add:

```typescript
  /** Swap a scene with its neighbour and restamp the whole chapter's order. */
  const moveScene = (documentId: string, sceneId: string, delta: -1 | 1) => {
    const ordered = projectScenes
      .filter(s => s.documentId === documentId)
      .sort((a, b) => a.order - b.order)
      .map(s => s.id);
    const from = ordered.indexOf(sceneId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ordered.length) return;
    const next = [...ordered];
    [next[from], next[to]] = [next[to], next[from]];
    reorderScenes(documentId, next);
  };

  /**
   * Delete a scene, then hand the widget's own pointer somewhere valid. The
   * store moves activeSceneId, but this zone tracks its scene in widget
   * content, so a stale id would survive the delete.
   */
  const confirmSceneDelete = (documentId: string) => {
    if (!pendingSceneDelete) return;
    const ordered = projectScenes
      .filter(s => s.documentId === documentId)
      .sort((a, b) => a.order - b.order);
    const index = ordered.findIndex(s => s.id === pendingSceneDelete.id);
    const survivor = ordered[index + 1] ?? ordered[index - 1] ?? null;

    deleteScene(pendingSceneDelete.id);
    if (content.sceneId === pendingSceneDelete.id) {
      (onChangeImmediate ?? onChange)({ ...content, sceneId: survivor?.id ?? 'all' });
    }
    setPendingSceneDelete(null);
  };
```

- [ ] **Step 6: Rebuild the scene row**

Replace the scene `<button>` at `StoryWritingZone.tsx:389-414` — the block from `{scenes.map(s => (` to its closing `))}` — with a row wrapper. The select button keeps every existing behaviour, including the double-click rename:

```tsx
                        {scenes.map((s, sIdx) => (
                          <div key={s.id} className={styles.binderSpineSceneRow}>
                            <button
                              className={`${styles.binderSpineSceneTab} ${s.id === activeScene?.id ? styles.binderSpineSceneTabActive : ''}`}
                              onClick={() => setActiveSceneId(s.id)}
                            >
                              {editingNode?.type === 'scene' && editingNode.id === s.id ? (
                                <input
                                  aria-label="Scene title"
                                  className={styles.spineRenameInput}
                                  ref={renameInputRef}
                                  value={editingNode.text}
                                  onChange={e => setEditingNode({ ...editingNode, text: e.target.value })}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') { updateScene(s.id, { title: editingNode.text }); setEditingNode(null); }
                                    else if (e.key === 'Escape') setEditingNode(null);
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  onDoubleClick={e => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className={styles.binderSpineSceneTitle}
                                  onDoubleClick={() => setEditingNode({ type: 'scene', id: s.id, text: s.title })}
                                  title="Double-click to rename"
                                >
                                  {s.title}
                                </span>
                              )}
                              <span className={styles.binderSpineSceneMeta}>{s.wordCount || 0} words</span>
                            </button>
                            <div className={styles.spineSceneActions}>
                              <button
                                className={styles.spineSceneActionBtn}
                                title="Move scene up"
                                aria-label={`Move ${s.title} up`}
                                disabled={sIdx === 0}
                                onClick={() => moveScene(doc.id, s.id, -1)}
                              >▲</button>
                              <button
                                className={styles.spineSceneActionBtn}
                                title="Move scene down"
                                aria-label={`Move ${s.title} down`}
                                disabled={sIdx === scenes.length - 1}
                                onClick={() => moveScene(doc.id, s.id, 1)}
                              >▼</button>
                              <button
                                className={`${styles.spineSceneActionBtn} ${styles.spineSceneActionDanger}`}
                                title="Delete scene"
                                aria-label={`Delete ${s.title}`}
                                onClick={() => setPendingSceneDelete({ id: s.id, title: s.title })}
                              >×</button>
                            </div>
                          </div>
                        ))}
```

- [ ] **Step 7: Render the dialog**

The zone's JSX ends (line 439-450) with:

```tsx
  return (
    <>
      {isFocusMode && typeof document !== 'undefined' ? createPortal(ui, document.body) : ui}
      {activeProjectId && <ProjectSettingsModal isOpen={showSettings} onClose={() => (onChangeImmediate ?? onChange)({ ...content, showSettings: false })} projectId={activeProjectId} />}
    </>
  );
```

Replace it with:

```tsx
  return (
    <>
      {isFocusMode && typeof document !== 'undefined' ? createPortal(ui, document.body) : ui}
      {activeProjectId && <ProjectSettingsModal isOpen={showSettings} onClose={() => (onChangeImmediate ?? onChange)({ ...content, showSettings: false })} projectId={activeProjectId} />}
      {pendingSceneDelete && (
        <ConfirmDialog
          title="Delete this scene?"
          body={`“${pendingSceneDelete.title}” and everything written in it will be removed. This cannot be undone.`}
          confirmLabel="Delete Scene"
          onConfirm={() => confirmSceneDelete(activeDocId)}
          onCancel={() => setPendingSceneDelete(null)}
        />
      )}
    </>
  );
```

- [ ] **Step 8: Style the row**

`.binderSpineSceneTab` and its siblings live in `src/components/editor/WritingDesk.module.css`. Find `.binderSpineSceneTab` and append after its rules:

```css
/* The scene row is a wrapper, not the button: a delete button cannot legally
   nest inside the select button it sits on. Actions reveal on row hover, the
   same way .rowActions does in the World Bible folder tree. */
.binderSpineSceneRow {
  display: flex;
  align-items: center;
  gap: 2px;
}

.binderSpineSceneRow .binderSpineSceneTab {
  flex: 1;
  min-width: 0;
}

.spineSceneActions {
  display: flex;
  gap: 1px;
  opacity: 0;
  transition: opacity 120ms ease;
}

.binderSpineSceneRow:hover .spineSceneActions,
.spineSceneActions:focus-within {
  opacity: 1;
}

.spineSceneActionBtn {
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 0.6rem;
  line-height: 1;
  cursor: pointer;
}

.spineSceneActionBtn:hover:not(:disabled) {
  background: rgba(var(--overlay-rgb), 0.12);
  color: var(--foreground);
}

.spineSceneActionBtn:disabled {
  opacity: 0.25;
  cursor: default;
}

.spineSceneActionDanger:hover:not(:disabled) {
  background: rgba(220, 80, 80, 0.18);
  color: #e07070;
}
```

- [ ] **Step 9: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: no compiler output; all tests PASS; eslint clean.

- [ ] **Step 10: Manual verification**

1. Open a story project with a chapter holding at least three scenes.
2. Hover a scene row in the spine — ▲ ▼ × appear; they are hidden otherwise.
3. ▲ is disabled on the first scene, ▼ on the last.
4. Click ▼ on the first scene. It swaps with the second, in the spine and in Manuscript view.
5. Reload the page. The new order survives.
6. Double-click a scene title. Rename still works and the actions do not interfere.
7. Click × on a **non-open** scene, confirm. It disappears; the open scene stays open.
8. Click × on the **open** scene, confirm. The editor lands on the next scene down (or the previous one, if it was last).
9. Delete the last remaining scene in a chapter. The zone shows its "No scenes yet" state rather than a blank editor.
10. Press Escape with the dialog open — nothing is deleted.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: delete and reorder scenes from the writing spine

deleteScene and reorderScenes were both implemented, tested by nothing and
called by nothing. The spine could add and rename a scene but never remove
or move one. The scene row is now a wrapper rather than a button, because a
delete button cannot legally nest inside the select button."
```

---

## Task 4: Delete a chapter

**Files:**
- Test: `src/store/documentActions.test.ts` (create)
- Modify: `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`

`deleteDocument` cascades: it drops the document, every scene belonging to it, and clears `activeDocumentId` / `activeSceneId` when they pointed into it. Split from Task 3 because it deletes a whole chapter's worth of prose and needs its own confirmation copy.

- [ ] **Step 1: Write the characterization test**

Create `src/store/documentActions.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, type Document, type Scene } from './workspaceStore';

function doc(id: string): Document {
    return { id, projectId: 'p1', title: id, content: '', createdAt: new Date('2026-01-01') };
}

function scene(id: string, documentId: string, order = 0): Scene {
    return {
        id,
        documentId,
        projectId: 'p1',
        title: id,
        content: '',
        order,
        createdAt: new Date('2026-01-01'),
    };
}

const state = () => useWorkspaceStore.getState();

describe('deleteDocument', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            activeProjectId: 'p1',
            activeDocumentId: 'd1',
            activeSceneId: 'a1',
            documents: [doc('d1'), doc('d2')],
            scenes: [scene('a1', 'd1'), scene('a2', 'd1', 1), scene('b1', 'd2')],
        } as never);
    });

    it('removes the chapter', () => {
        state().deleteDocument('d1');
        expect(state().documents.map(d => d.id)).toEqual(['d2']);
    });

    it('takes every scene in the chapter with it', () => {
        state().deleteDocument('d1');
        expect(state().scenes.map(s => s.id)).toEqual(['b1']);
    });

    it('leaves other chapters and their scenes alone', () => {
        state().deleteDocument('d2');
        expect(state().documents.map(d => d.id)).toEqual(['d1']);
        expect(state().scenes.map(s => s.id)).toEqual(['a1', 'a2']);
    });

    it('clears the active chapter when it is the one deleted', () => {
        state().deleteDocument('d1');
        expect(state().activeDocumentId).toBeNull();
    });

    it('clears the active scene when it belonged to the deleted chapter', () => {
        state().deleteDocument('d1');
        expect(state().activeSceneId).toBeNull();
    });

    it('keeps the active scene when it belonged elsewhere', () => {
        useWorkspaceStore.setState({ activeDocumentId: 'd1', activeSceneId: 'b1' } as never);
        state().deleteDocument('d1');
        expect(state().activeSceneId).toBe('b1');
    });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/store/documentActions.test.ts`

Expected: **PASS — 6 tests.** As in Task 3 this pins an existing contract rather than driving new code. **If any assertion fails, stop.**

- [ ] **Step 3: Commit the contract**

```bash
git add src/store/documentActions.test.ts
git commit -m "test: pin the deleteDocument cascade

Deleting a chapter also deletes its scenes and clears both pointers. The
spine is about to call it, so the cascade is pinned first."
```

- [ ] **Step 4: Wire it into the spine**

In `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`, add the subscription beside the ones from Task 3:

```typescript
  const deleteDocument = useWorkspaceStore(s => s.deleteDocument);
```

and a second pending-delete state beside `pendingSceneDelete`:

```typescript
  const [pendingChapterDelete, setPendingChapterDelete] = useState<{ id: string; title: string } | null>(null);
```

Add the handler next to `confirmSceneDelete`:

```typescript
  /**
   * Delete a chapter and land the widget on a surviving one. The store nulls
   * the global pointers; this zone keeps its own documentId in widget content,
   * so it has to choose the replacement itself.
   */
  const confirmChapterDelete = () => {
    if (!pendingChapterDelete) return;
    const survivor = projectDocs.find(d => d.id !== pendingChapterDelete.id) ?? null;
    const survivorScene = survivor
      ? projectScenes.filter(s => s.documentId === survivor.id).sort((a, b) => a.order - b.order)[0]
      : undefined;

    deleteDocument(pendingChapterDelete.id);
    (onChangeImmediate ?? onChange)({
      ...content,
      documentId: survivor?.id ?? '',
      sceneId: survivorScene?.id ?? 'all',
    });
    setPendingChapterDelete(null);
  };
```

- [ ] **Step 5: Add the control**

The chapter header at `StoryWritingZone.tsx:331-378` is a `<button>`, so the delete cannot go inside it either. Put it in the group, immediately after the header button's closing `</button>` and before `{(isDocActive && !isSceneListCollapsed) && (`:

```tsx
                    {isDocActive && projectDocs.length > 1 && (
                      <button
                        className={styles.spineChapterDeleteBtn}
                        title="Delete chapter"
                        aria-label={`Delete chapter ${idx + 1}, ${doc.title}`}
                        onClick={() => setPendingChapterDelete({ id: doc.id, title: doc.title })}
                      >
                        × Delete chapter
                      </button>
                    )}
```

The `projectDocs.length > 1` guard means the last chapter cannot be deleted — a story with no chapters has no editor to land on, and `handleAddChapter` is the only way back.

- [ ] **Step 6: Render the second dialog**

Beside the `pendingSceneDelete` dialog from Task 3:

```tsx
      {pendingChapterDelete && (
        <ConfirmDialog
          title="Delete this chapter?"
          body={`“${pendingChapterDelete.title}” and every scene inside it will be removed. This cannot be undone.`}
          confirmLabel="Delete Chapter"
          onConfirm={confirmChapterDelete}
          onCancel={() => setPendingChapterDelete(null)}
        />
      )}
```

- [ ] **Step 7: Style it**

In `src/components/editor/WritingDesk.module.css`, after the Task 3 rules:

```css
/* Sits under the open chapter's header rather than inside it — the header is a
   button and cannot legally contain another. Only shown on the open chapter,
   so the spine does not become a row of delete buttons. */
.spineChapterDeleteBtn {
  display: block;
  width: 100%;
  margin: 2px 0 4px;
  padding: 3px 8px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  font-size: 0.65rem;
  text-align: left;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
}

.spineChapterDeleteBtn:hover,
.spineChapterDeleteBtn:focus-visible {
  opacity: 1;
  background: rgba(220, 80, 80, 0.15);
  color: #e07070;
}
```

- [ ] **Step 8: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: no compiler output; all tests PASS; eslint clean.

- [ ] **Step 9: Manual verification**

1. Open a story project with at least two chapters.
2. Open chapter 2. A faint "× Delete chapter" appears beneath its header; chapter 1 shows none.
3. Hover it — it turns red.
4. Click it. The dialog names the chapter and warns that its scenes go too.
5. Cancel. Nothing is deleted.
6. Delete it. The spine drops the chapter, its scenes are gone, and the editor lands on the first scene of a surviving chapter.
7. Reload. The deletion persisted.
8. Delete down to one chapter. No delete control is offered on the last one.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: delete a chapter from the writing spine

deleteDocument cascaded correctly to scenes and pointers and was called by
nothing, so a chapter added by mistake was permanent. The last chapter is
not deletable — there would be no editor left to land on."
```

---

## Task 5: Delete a shared post

**Files:**
- Test: `src/store/socialActions.test.ts` (create)
- Modify: `src/components/layout/SocialMediaPanel.tsx`
- Modify: `src/components/layout/SocialMediaPanel.module.css`

Held back from Phase 1 because the Social Media Hub survives (roadmap decision 2). `SocialMediaPanel.tsx:283-290` renders `socialHistory` as read-only rows under "Recent Updates".

- [ ] **Step 1: Write the characterization test**

Create `src/store/socialActions.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

const history = () => useWorkspaceStore.getState().socialHistory;

describe('deleteSocialPost', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            socialHistory: [
                { id: 'p1', platform: 'x', content: 'first', timestamp: '2026-09-01T10:00:00.000Z' },
                { id: 'p2', platform: 'bluesky', content: 'second', timestamp: '2026-09-02T10:00:00.000Z' },
            ],
        } as never);
    });

    it('removes only the named post', () => {
        useWorkspaceStore.getState().deleteSocialPost('p1');
        expect(history().map(p => p.id)).toEqual(['p2']);
    });

    it('ignores an unknown id', () => {
        useWorkspaceStore.getState().deleteSocialPost('nope');
        expect(history()).toHaveLength(2);
    });

    it('empties the history when the last post goes', () => {
        useWorkspaceStore.getState().deleteSocialPost('p1');
        useWorkspaceStore.getState().deleteSocialPost('p2');
        expect(history()).toEqual([]);
    });

    it('addSocialPost then deleteSocialPost round-trips', () => {
        useWorkspaceStore.setState({ socialHistory: [] } as never);
        useWorkspaceStore.getState().addSocialPost({ platform: 'x', content: 'hello' });
        const added = history()[0];
        expect(added.id).toBeTruthy();
        useWorkspaceStore.getState().deleteSocialPost(added.id);
        expect(history()).toEqual([]);
    });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/store/socialActions.test.ts`

Expected: **PASS — 4 tests.** Contract-pinning again. **If any fails, stop.**

- [ ] **Step 3: Wire the button**

In `src/components/layout/SocialMediaPanel.tsx`, add the subscription after line 74:

```typescript
    const deleteSocialPost = useWorkspaceStore(state => state.deleteSocialPost);
```

Then replace the history row at lines 283-290:

```tsx
                                socialHistory.map(post => (
                                    <div key={post.id} className={styles.historyItem}>
                                        <div className={styles.historyHeader}>
                                            <span className={styles.historyPlatform}>{post.platform}</span>
                                            <span className={styles.historyDate}>{new Date(post.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <div className={styles.historyContent}>{post.content}</div>
                                    </div>
                                ))
```

with:

```tsx
                                socialHistory.map(post => (
                                    <div key={post.id} className={styles.historyItem}>
                                        <div className={styles.historyHeader}>
                                            <span className={styles.historyPlatform}>{post.platform}</span>
                                            <span className={styles.historyDate}>{new Date(post.timestamp).toLocaleDateString()}</span>
                                            <button
                                                className={styles.historyDelete}
                                                title="Remove from history"
                                                aria-label={`Remove the ${post.platform} update from history`}
                                                onClick={() => deleteSocialPost(post.id)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                        <div className={styles.historyContent}>{post.content}</div>
                                    </div>
                                ))
```

No confirmation dialog here on purpose: the row is a local record of something already shared elsewhere, not the writing itself. Removing it destroys nothing the writer cannot see on the platform.

- [ ] **Step 4: Style it**

In `src/components/layout/SocialMediaPanel.module.css`, append after the `.historyItem` rules:

```css
.historyItem:hover .historyDelete,
.historyDelete:focus-visible {
    opacity: 1;
}

.historyDelete {
    margin-left: auto;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--muted, #888);
    font-size: 0.9rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
}

.historyDelete:hover {
    background: rgba(220, 80, 80, 0.15);
    color: #e07070;
}
```

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: no compiler output; all tests PASS; eslint clean.

- [ ] **Step 6: Manual verification**

1. Open the Social Media panel and share an update so a row appears under **Recent Updates**.
2. The row shows no × until hovered.
3. Tab to the ×. It becomes visible on focus.
4. Click it. The row disappears immediately.
5. Reload. It is still gone.
6. Remove every row. "No posts shared yet." returns.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove a shared update from the Social Media history

deleteSocialPost was implemented and uncalled, so Recent Updates only ever
grew. Phase 1 deliberately kept the action because the Hub survives."
```

---

## Task 6: Move an entity type between World Bible folders

**Files:**
- Test: `src/store/moveWorldBibleType.test.ts` (create)
- Modify: `src/components/world/WorldBibleFolderTree.tsx`
- Modify: `src/components/world/WorldBibleFolderTree.module.css`

Held back from Phase 1 because the World Bible is the kept differentiator.

**What `entityTypes` actually controls.** It is not the same mechanism as filing an article. An article is filed by `entity.categoryId` (`WorldBibleFolderTree.tsx:97`). A folder's `entityTypes` is the *claim* a folder makes over a type, and it drives two real behaviours:

- `fileByType` (`src/lib/folderTree.ts:42-52`) — "First folder whose entityTypes contains the type — the default filing rule", used by `migrateArticleFolders.ts` and `applyBibleLayout`.
- `effectiveTypes` (`WorldBibleCenter.tsx:97-98`) — `folder.entityTypes.length ? folder.entityTypes : ['lore']` decides which types a new article created inside that folder may be.

The presets seed these claims (`src/lib/worldBiblePresets.ts:22-64`). Every folder the user makes by hand gets `entityTypes: []` (`WorldBibleFolderTree.tsx:77`, `WorldBibleCenter.tsx:190`, `WorldBibleRoot.tsx:180`, `worldAuthoring.ts:227`). **Nothing in the app can change a claim once it is set** — which is what `moveWorldBibleType` does.

- [ ] **Step 1: Write the characterization test**

Create `src/store/moveWorldBibleType.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

const root = (id: string, entityTypes: string[] = []) => ({
    id,
    label: id,
    icon: '📦',
    entityTypes: entityTypes as never[],
});

const rootsOf = (key: string) =>
    useWorkspaceStore.getState().worldBibles[key].layout.roots;

const typesIn = (key: string, id: string) =>
    rootsOf(key).find(r => r.id === id)?.entityTypes ?? [];

describe('moveWorldBibleType', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            worlds: [{ id: 'w1', name: 'Aether' } as never],
            projects: [{ id: 'p1', name: 'S1', worldId: 'w1' } as never],
            activeWorldKey: 'w1',
            activeProjectId: 'p1',
            draftHierarchyLayout: null,
            worldBibles: {
                w1: {
                    layout: {
                        roots: [
                            root('people', ['character', 'faction']),
                            root('places', ['location']),
                        ],
                    },
                },
            },
        } as never);
    });

    it('takes the type off the source folder', () => {
        useWorkspaceStore.getState().moveWorldBibleType('faction' as never, 'people', 'places');
        expect(typesIn('w1', 'people')).toEqual(['character']);
    });

    it('adds the type to the target folder', () => {
        useWorkspaceStore.getState().moveWorldBibleType('faction' as never, 'people', 'places');
        expect(typesIn('w1', 'places')).toEqual(['location', 'faction']);
    });

    it('never duplicates a type the target already claims', () => {
        useWorkspaceStore.getState().moveWorldBibleType('location' as never, 'places', 'places');
        expect(typesIn('w1', 'places')).toEqual(['location']);
    });

    it('leaves untouched folders alone', () => {
        useWorkspaceStore.getState().moveWorldBibleType('character' as never, 'people', 'places');
        expect(rootsOf('w1').map(r => r.id)).toEqual(['people', 'places']);
        expect(typesIn('w1', 'people')).toEqual(['faction']);
    });

    it('edits the draft layout when isDraft is set, not the live bible', () => {
        useWorkspaceStore.setState({
            draftHierarchyLayout: { roots: [root('a', ['lore']), root('b')] },
        } as never);
        useWorkspaceStore.getState().moveWorldBibleType('lore' as never, 'a', 'b', true);

        const draft = useWorkspaceStore.getState().draftHierarchyLayout!;
        expect(draft.roots.find(r => r.id === 'a')?.entityTypes).toEqual([]);
        expect(draft.roots.find(r => r.id === 'b')?.entityTypes).toEqual(['lore']);
        // The live bible is untouched.
        expect(typesIn('w1', 'people')).toEqual(['character', 'faction']);
    });

    it('is a no-op on a draft move when no draft exists', () => {
        useWorkspaceStore.setState({ draftHierarchyLayout: null } as never);
        useWorkspaceStore.getState().moveWorldBibleType('lore' as never, 'a', 'b', true);
        expect(useWorkspaceStore.getState().draftHierarchyLayout).toBeNull();
    });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/store/moveWorldBibleType.test.ts`

Expected: **PASS — 6 tests.** Contract-pinning. **If any fails, stop.**

- [ ] **Step 3: Commit the contract**

```bash
git add src/store/moveWorldBibleType.test.ts src/store/socialActions.test.ts
git commit -m "test: pin the deleteSocialPost and moveWorldBibleType contracts

Both were held back from Phase 1 because their features survive. Both are
about to gain a caller."
```

- [ ] **Step 4: Wire it into the folder tree**

The tree already drags folders and articles with `dataTransfer`. A type chip is a third payload on the same mechanism.

In `src/components/world/WorldBibleFolderTree.tsx`, add the subscription after line 38:

```typescript
    const moveWorldBibleType = useWorkspaceStore(s => s.moveWorldBibleType);
```

- [ ] **Step 5: Accept the new payload**

Replace `handleDrop` (lines 88-101):

```typescript
    /** Shared drop handler for folder rows and the root zone. */
    const handleDrop = (e: React.DragEvent, targetFolderId: string | undefined) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(null);
        const entityId = e.dataTransfer.getData('entityId');
        const folderId = e.dataTransfer.getData('folderId');
        if (entityId && targetFolderId !== undefined && !isDraft) {
            updateEntity(entityId, { categoryId: targetFolderId });
        } else if (folderId && folderId !== targetFolderId) {
            // Store cycle guard silently rejects loops.
            updateWorldBibleRoot(folderId, { parentId: targetFolderId }, isDraft);
        }
    };
```

with:

```typescript
    /** Shared drop handler for folder rows and the root zone. */
    const handleDrop = (e: React.DragEvent, targetFolderId: string | undefined) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(null);
        const entityId = e.dataTransfer.getData('entityId');
        const folderId = e.dataTransfer.getData('folderId');
        const typeMove = e.dataTransfer.getData('typeMove');
        if (typeMove && targetFolderId !== undefined) {
            // "<entityType>:<sourceFolderId>" — a claim moving between folders.
            const [type, fromRootId] = typeMove.split(':');
            if (type && fromRootId && fromRootId !== targetFolderId) {
                moveWorldBibleType(type as EntityType, fromRootId, targetFolderId, isDraft);
            }
        } else if (entityId && targetFolderId !== undefined && !isDraft) {
            updateEntity(entityId, { categoryId: targetFolderId });
        } else if (folderId && folderId !== targetFolderId) {
            // Store cycle guard silently rejects loops.
            updateWorldBibleRoot(folderId, { parentId: targetFolderId }, isDraft);
        }
    };
```

and widen `acceptsDrag` (lines 103-107) so a folder row lights up for a type chip:

```typescript
    /** dragover can't read getData; dataTransfer type keys are lowercased. */
    const acceptsDrag = (e: React.DragEvent, allowArticles: boolean) => {
        const t = e.dataTransfer.types;
        return t.includes('folderid') || t.includes('typemove') || (allowArticles && !isDraft && t.includes('entityid'));
    };
```

The root zone's own `onDragOver` (line 200) checks `folderid` only, so a chip dropped on empty space is correctly ignored — a claim must land on a folder.

- [ ] **Step 6: Render the chips**

In `renderFolder`, insert between the `{!isDraft && <span className={styles.count}>{count}</span>}` line and `<div className={styles.rowActions}>`:

```tsx
                    {folder.entityTypes.length > 0 && (
                        <div className={styles.typeChips}>
                            {folder.entityTypes.map(t => (
                                <span
                                    key={t}
                                    className={styles.typeChip}
                                    draggable
                                    title={`${t} — drag onto another folder to move it there`}
                                    onDragStart={(e) => {
                                        e.stopPropagation();
                                        e.dataTransfer.setData('typeMove', `${t}:${folder.id}`);
                                    }}
                                    onDragEnd={() => setDragOverId(null)}
                                >
                                    {TYPE_ICONS[t]} {t}
                                </span>
                            ))}
                        </div>
                    )}
```

`TYPE_ICONS` is already declared at line 13.

- [ ] **Step 7: Explain the gesture**

The hint at lines 210-215 currently reads:

```tsx
                <p className={styles.hint}>
                    {isDraft
                        ? 'Design the folder structure — drag folders to nest them.'
                        : 'Drag articles into folders. Drag folders onto each other to nest them.'}
                </p>
```

Replace it with:

```tsx
                <p className={styles.hint}>
                    {isDraft
                        ? 'Design the folder structure — drag folders to nest them, and drag a type tag to change which folder claims it.'
                        : 'Drag articles into folders. Drag folders onto each other to nest them. Drag a type tag to change which folder new articles of that type land in.'}
                </p>
```

- [ ] **Step 8: Style the chips**

Append to `src/components/world/WorldBibleFolderTree.module.css`:

```css
/* A folder's claim over an entity type — what fileByType matches and what
   WorldBibleCenter offers when creating an article here. Draggable onto
   another folder row; the store de-dupes, so a stray drop is harmless. */
.typeChips { display: flex; flex-wrap: wrap; gap: 3px; flex: none; }

.typeChip {
    font-size: 0.66rem;
    line-height: 1;
    color: var(--muted, #888);
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 3px 7px;
    cursor: grab;
    white-space: nowrap;
    transition: border-color 150ms ease, color 150ms ease;
}

.typeChip:hover { border-color: var(--accent); color: var(--foreground); }
.typeChip:active { cursor: grabbing; }
```

- [ ] **Step 9: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: no compiler output; all tests PASS; eslint clean. `EntityType` is already imported at `WorldBibleFolderTree.tsx:5`, so the cast in `handleDrop` compiles.

- [ ] **Step 10: Manual verification**

1. Open a World Bible seeded from a preset and switch to **Organize**.
2. Seeded folders show their type tags — "People" shows `character`, `faction`, `species`. A hand-made folder shows none.
3. Drag the `faction` tag from People onto Places. Places lights up as a drop target; on release the tag moves.
4. Reload. The move persisted.
5. Drag a tag onto its own folder. Nothing changes and no tag is duplicated.
6. Drag a tag onto empty space below the tree. Nothing changes.
7. Create a new article inside Places. `faction` is now among the offered types; inside People it is not.
8. Drag an article and drag a folder — both still behave exactly as before.
9. In the template designer (draft mode), the same gesture edits the draft only; the live bible is unchanged until the template is applied.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: drag a type tag between World Bible folders

moveWorldBibleType was implemented for both the live bible and the draft
layout and called by nothing, so a folder's claim over an entity type was
fixed at whatever the preset seeded. That claim drives fileByType and the
types WorldBibleCenter offers when creating an article, so it was the one
part of the hierarchy the writer could not change."
```

---

## Task 7: Standard manuscript format

**Files:**
- Modify: `src/components/editor/desk/DeskTipTapEditor.tsx`
- Modify: `src/components/editor/WritingDesk.module.css`

**Read the audit note above before starting.** `toggleStandardFormat` swaps `editorMaxWidth` to `720` and caches the old value — that is all it does. And `editorMaxWidth` is read by nothing, so wiring only the toggle produces no visible change. This task therefore does two things: it makes the store's measure the source of truth for the editor's width, and it gives "standard format" the typography that makes the name true.

**Deliberately out of scope:** running headers and a word count on page one. Both are page furniture and there are no pages — the editor is a continuous scroll with no pagination. They belong with front matter and the compile step, which the roadmap assigns to Phase 4 item `11`. Adding fake headers to a scrolling editor would be worse than not having them.

- [ ] **Step 1: Move the measure into a CSS variable**

In `src/components/editor/WritingDesk.module.css:380-394`, `.deskEditorContent` currently reads:

```css
.deskEditorContent {
  color: #e0e0e0;
  font-size: 16px;
  line-height: 1.6;
  outline: none;
  /* In ch, not px. The cap is a reading measure, so it has to track the font:
     the writing zone is a resizable docked widget and the desk has its own
     font-size control, and an 800px cap would let the measure blow past 90
     characters the moment either grew. 76ch is the width this already
     rendered at. */
  max-width: 76ch;
  margin: 0 auto;
  flex: 1;
  user-select: text !important;
}
```

Change only the `max-width` line:

```css
  /* Defaults to the reading measure; standard manuscript format overrides it
     with the store's editorMaxWidth, set on the wrapper below. */
  max-width: var(--desk-measure, 76ch);
```

- [ ] **Step 2: Add the standard-format rules**

Append immediately after the `.deskEditorContent hr` rule (around line 431):

```css
/* Standard manuscript format. Applied to the body wrapper rather than to the
   editor's own class, because that class is baked into editorProps at
   useEditor time and changing it would rebuild the editor and lose undo. */
.deskEditorBodyStandard .deskEditorContent {
  font-family: 'Courier New', Courier, monospace;
  font-size: 12pt;
  line-height: 2;
  color: #e8e8e8;
  text-align: left;
}

.deskEditorBodyStandard .deskEditorContent p {
  margin-bottom: 0;
  text-indent: 0.5in;
}

/* A scene's opening paragraph is flush left, as submissions expect. */
.deskEditorBodyStandard .deskEditorContent > p:first-child,
.deskEditorBodyStandard .deskEditorContent h1 + p,
.deskEditorBodyStandard .deskEditorContent h2 + p,
.deskEditorBodyStandard .deskEditorContent h3 + p {
  text-indent: 0;
}

.deskEditorBodyStandard .deskEditorContent h1,
.deskEditorBodyStandard .deskEditorContent h2,
.deskEditorBodyStandard .deskEditorContent h3 {
  font-family: inherit;
  font-size: 12pt;
  font-weight: 700;
  margin: 2em 0 1em;
  text-align: center;
}
```

- [ ] **Step 3: Consume the store values**

In `src/components/editor/desk/DeskTipTapEditor.tsx`, after line 28:

```typescript
  const isSpellcheckEnabled = useWorkspaceStore(s => s.isSpellcheckEnabled);
  const isStandardFormat = useWorkspaceStore(s => s.isStandardFormat);
  const editorMaxWidth = useWorkspaceStore(s => s.editorMaxWidth);
  const toggleStandardFormat = useWorkspaceStore(s => s.toggleStandardFormat);
```

Note that `isStandardFormat` and `editorMaxWidth` are **not** added to the `useEditor` dependency array at line 65 (`[sceneId, isSpellcheckEnabled]`). They must not be — the array rebuilds the editor, and rebuilding on a format toggle would discard undo history.

- [ ] **Step 4: Apply them to the wrapper**

Replace the editor body at the end of the component (lines 234-236):

```tsx
      <div className={styles.deskEditorBody} onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
```

with:

```tsx
      <div
        className={`${styles.deskEditorBody} ${isStandardFormat ? styles.deskEditorBodyStandard : ''}`}
        style={{ '--desk-measure': editorMaxWidth ? `${editorMaxWidth}px` : '76ch' } as React.CSSProperties}
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>
```

`React` is already imported? It is not — the file opens with `import { useRef, useEffect, useState } from 'react';` at line 3. Change that line to:

```typescript
import React, { useRef, useEffect, useState } from 'react';
```

- [ ] **Step 5: Add the toggle**

In the last toolbar group — after the "Clear Formatting" button at lines 227-231 and before that group's closing `</div>` — add:

```tsx
          <button
            className={`${styles.deskFmtBtn} ${isStandardFormat ? styles.deskFmtBtnActive : ''}`}
            onMouseDown={e => { e.preventDefault(); toggleStandardFormat(); }}
            title="Standard manuscript format — 12pt monospace, double-spaced, indented paragraphs"
            aria-label="Standard manuscript format"
            aria-pressed={isStandardFormat}
          >MS</button>
```

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: no compiler output; all tests PASS; eslint clean.

- [ ] **Step 7: Manual verification**

1. Open a scene with several paragraphs and at least one heading.
2. The text looks exactly as it did before this task — 16px, 1.6 line height, capped around 76 characters. **If it changed, the `--desk-measure` fallback is wrong.**
3. Click **MS** in the toolbar. The button takes the active highlight; the prose becomes 12pt monospace, double-spaced, with indented paragraphs and a flush-left opener. The column narrows to 720px.
4. Type a sentence, then press Ctrl+Z. The undo still works — the editor was not rebuilt.
5. Click **MS** again. Everything returns to the earlier appearance and the column returns to its previous width.
6. Toggle MS on and reload the page. It is still on, and still 720px — `isStandardFormat`, `editorMaxWidth` and `cachedEditorMaxWidth` all persist.
7. Toggle it off after the reload. The width returns to the cached value rather than snapping to a default.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: standard manuscript format toggle in the editor toolbar

toggleStandardFormat was uncalled, and the editorMaxWidth it swapped was
read by no component, so wiring the toggle alone would have changed nothing
visible. The measure now comes from the store through a CSS variable, and
the format class delivers the 12pt double-spaced indented setting the name
promises. Running headers and a page-one word count are page furniture and
wait for the compile step in Phase 4."
```

---

## Task 8: Expose code blocks

**Files:**
- Modify: `src/components/editor/desk/DeskTipTapEditor.tsx`
- Modify: `src/components/editor/WritingDesk.module.css`

`StarterKit` is used bare at `DeskTipTapEditor.tsx:32` — no `.configure()`, so `codeBlock` is registered (`@tiptap/starter-kit@^3.20.0` includes it unless passed `codeBlock: false`). `grep -rn "codeBlock\|CodeBlock" src` returns nothing: no toolbar item, no command, no CSS. The node is reachable today only via TipTap's built-in ``` ``` ``` input rule and Ctrl+Alt+C, neither of which is discoverable, and if reached the block renders unstyled — `.deskEditorContent` has rules for `p`, `h1`–`h3`, `blockquote`, `ul`, `ol`, `li` and `hr` and none for `pre` or `code`.

A code block is a block style, so it belongs in the block-style dropdown next to Quote rather than as another icon button.

- [ ] **Step 1: Add the option**

In `src/components/editor/desk/DeskTipTapEditor.tsx`, the block-style `GlassDropdown` at lines 105-126 reads:

```tsx
          <GlassDropdown
            title="Block style"
            options={[
              { value: 'p', label: 'Paragraph' },
              { value: 'h1', label: 'Heading 1' },
              { value: 'h2', label: 'Heading 2' },
              { value: 'h3', label: 'Heading 3' },
              { value: 'blockquote', label: 'Quote' },
            ]}
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1' :
              editor.isActive('heading', { level: 2 }) ? 'h2' :
              editor.isActive('heading', { level: 3 }) ? 'h3' :
              editor.isActive('blockquote') ? 'blockquote' : 'p'
            }
            onChange={val => {
              if (val === 'p') editor.chain().focus().setParagraph().run();
              if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
              if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
              if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
              if (val === 'blockquote') editor.chain().focus().toggleBlockquote().run();
            }}
          />
```

Replace it with:

```tsx
          <GlassDropdown
            title="Block style"
            options={[
              { value: 'p', label: 'Paragraph' },
              { value: 'h1', label: 'Heading 1' },
              { value: 'h2', label: 'Heading 2' },
              { value: 'h3', label: 'Heading 3' },
              { value: 'blockquote', label: 'Quote' },
              { value: 'codeBlock', label: 'Code Block' },
            ]}
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1' :
              editor.isActive('heading', { level: 2 }) ? 'h2' :
              editor.isActive('heading', { level: 3 }) ? 'h3' :
              editor.isActive('blockquote') ? 'blockquote' :
              editor.isActive('codeBlock') ? 'codeBlock' : 'p'
            }
            onChange={val => {
              if (val === 'p') editor.chain().focus().setParagraph().run();
              if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
              if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
              if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
              if (val === 'blockquote') editor.chain().focus().toggleBlockquote().run();
              if (val === 'codeBlock') editor.chain().focus().toggleCodeBlock().run();
            }}
          />
```

The `transaction` listener at lines 80-89 already forces a re-render, so the dropdown tracks the caret into and out of a code block without further work.

- [ ] **Step 2: Style the block**

In `src/components/editor/WritingDesk.module.css`, after the `.deskEditorContent hr` rule (around line 431) and before the standard-format rules from Task 7:

```css
/* The codeBlock node ships with StarterKit and had no styling, so a block
   inserted through TipTap's ``` input rule rendered as browser-default <pre>
   on the frosted surface. */
.deskEditorContent pre {
  background: rgba(var(--overlay-rgb), 0.10);
  border: 1px solid rgba(var(--overlay-rgb), 0.14);
  border-radius: 6px;
  margin: 1.5em 0;
  padding: 0.9em 1.1em;
  overflow-x: auto;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.86em;
  line-height: 1.5;
  white-space: pre;
  tab-size: 2;
}

.deskEditorContent pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
  color: var(--foreground);
}

/* Inline code, the `code` mark StarterKit also ships. */
.deskEditorContent code {
  background: rgba(var(--overlay-rgb), 0.12);
  border-radius: 4px;
  padding: 0.12em 0.35em;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.88em;
  color: var(--foreground);
}
```

- [ ] **Step 3: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: no compiler output; all tests PASS; eslint clean.

- [ ] **Step 4: Manual verification**

1. Open a scene. The Block style dropdown now lists **Code Block** after Quote.
2. Select it. The current paragraph becomes a bordered monospace block with a tinted background and no serif prose styling.
3. Press Enter twice inside it. The block keeps the caret rather than exiting on the first Enter (StarterKit's default).
4. Put the caret inside the block. The dropdown reads **Code Block**; move it into ordinary prose and it reads **Paragraph**.
5. Select **Paragraph** from inside the block. It converts back to prose.
6. Type ``` followed by a space at the start of an empty line. The input rule still creates a block, and it is now styled.
7. Paste a long line into a block. The block scrolls horizontally; the surrounding column does not.
8. Reload. The block survives — it was already serialised as `<pre><code>`; only the presentation was missing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: expose code blocks in the block style dropdown

StarterKit registers codeBlock by default and nothing in src referenced it,
so the node existed in the schema, reachable only by an undiscoverable input
rule, and rendered as an unstyled browser <pre> if reached. Adds the block
style option plus pre/code rules for the editor surface."
```

---

## Task 9: Give the Link card a URL

**Files:**
- New: `src/lib/safeUrl.ts`, `src/lib/safeUrl.test.ts`
- Modify: `src/components/editor/desk/widgets/ReferenceCardRenderer.tsx`
- Modify: `src/components/editor/WritingDesk.module.css`

The research board's third add button says **Link** (`WritingDesk.tsx:917`) and creates a `reference` widget. `ReferenceCardRenderer` has exactly two fields — a title input and a notes textarea (`ReferenceCardRenderer.tsx:29-33`) — and no URL anywhere. The card called Link cannot hold one.

**The second half of `15e` is dropped** — see the audit table. The add toolbar is gated on `{isResearch && (` at `WritingDesk.tsx:913` with no emptiness term, so the buttons already show on an empty board.

Rendering a stored string as an `href` is the one place a `javascript:` URL could execute, so the guard is a tested leaf module rather than an inline expression.

- [ ] **Step 1: Write the failing test**

Create `src/lib/safeUrl.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { safeHref } from './safeUrl';

describe('safeHref', () => {
    it('passes an https URL through unchanged', () => {
        expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    });

    it('passes an http URL through unchanged', () => {
        expect(safeHref('http://example.com')).toBe('http://example.com');
    });

    it('assumes https for a bare host', () => {
        expect(safeHref('example.com/docs')).toBe('https://example.com/docs');
    });

    it('trims surrounding whitespace', () => {
        expect(safeHref('  https://example.com  ')).toBe('https://example.com');
    });

    it('rejects a javascript: URL', () => {
        expect(safeHref('javascript:alert(1)')).toBeNull();
    });

    it('rejects a javascript: URL hidden by case and whitespace', () => {
        expect(safeHref('  JaVaScRiPt:alert(1)')).toBeNull();
    });

    it('rejects a data: URL', () => {
        expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('rejects other schemes', () => {
        expect(safeHref('file:///etc/passwd')).toBeNull();
        expect(safeHref('vbscript:msgbox(1)')).toBeNull();
    });

    it('returns null for empty or whitespace input', () => {
        expect(safeHref('')).toBeNull();
        expect(safeHref('   ')).toBeNull();
    });

    it('returns null for unparseable input', () => {
        expect(safeHref('http://')).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/safeUrl.test.ts`

Expected: FAIL — `Failed to resolve import "./safeUrl"`.

- [ ] **Step 3: Write the module**

Create `src/lib/safeUrl.ts`:

```typescript
/**
 * Link safety — LEAF MODULE (no store, no React import).
 *
 * A research Link card stores whatever the writer typed, and that string later
 * becomes an href. Only http and https may ever reach an anchor: a
 * `javascript:` or `data:` value in a persisted workspace would otherwise
 * execute on click. A bare host is the common case and is assumed https rather
 * than rejected.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * The href to render for `raw`, or null when there is nothing safe to render.
 * Callers should render plain text — never an anchor — when this returns null.
 */
export function safeHref(raw: string | null | undefined): string | null {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return null;

    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;

    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return null;
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
    if (!parsed.hostname) return null;

    return candidate;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/safeUrl.test.ts`

Expected: PASS — 10 tests.

- [ ] **Step 5: Add the field to the card**

Replace `src/components/editor/desk/widgets/ReferenceCardRenderer.tsx` in full:

```tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { safeHref } from '@/lib/safeUrl';
import styles from '../../WritingDesk.module.css';

export function ReferenceCardRenderer({ content, onChange }: { content: any; onChange: (c: any) => void; }) {
  const [localContent, setLocalContent] = useState(content);
  const lastPropContent = useRef(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (content !== lastPropContent.current) {
      setLocalContent(content);
      lastPropContent.current = content;
    }
  }, [content]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChange = (updates: Record<string, any>) => {
    const next = { ...localContent, ...updates };
    setLocalContent(next);
    lastPropContent.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(next), 600);
  };

  // Only http/https reach an anchor — a persisted javascript: value would
  // otherwise run on click.
  const href = safeHref(localContent.url);

  return (
    <div className={styles.referenceCard}>
      <input aria-label="Reference title" className={styles.referenceTitle} placeholder="Title..." value={localContent.title || ''} onChange={e => handleChange({ title: e.target.value })} />
      <div className={styles.referenceUrlRow}>
        <input
          aria-label="Reference URL"
          className={styles.referenceUrl}
          type="url"
          inputMode="url"
          placeholder="https://..."
          value={localContent.url || ''}
          onChange={e => handleChange({ url: e.target.value })}
        />
        {href && (
          <a
            className={styles.referenceUrlOpen}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in a new tab"
            aria-label="Open this link in a new tab"
            onMouseDown={e => e.stopPropagation()}
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
      <textarea aria-label="Reference notes" className={styles.referenceBody} placeholder="Notes..." value={localContent.body || ''} onChange={e => handleChange({ body: e.target.value })} />
    </div>
  );
}
```

The existing `{ title, body }` content shape is unchanged; `url` is a new optional key, so every stored card keeps working and simply shows an empty URL field.

- [ ] **Step 6: Style the row**

In `src/components/editor/WritingDesk.module.css`, insert between `.referenceTitle` and `.referenceBody` (around line 500):

```css
.referenceUrlRow {
  display: flex;
  align-items: center;
  gap: 6px;
}

.referenceUrl {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--accent);
  font-size: 0.75rem;
  font-family: inherit;
  text-overflow: ellipsis;
}

.referenceUrl::placeholder {
  color: var(--muted);
}

.referenceUrlOpen {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--muted);
  transition: background 120ms ease, color 120ms ease;
}

.referenceUrlOpen:hover {
  background: rgba(var(--overlay-rgb), 0.12);
  color: var(--accent);
}
```

- [ ] **Step 7: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: no compiler output; all tests PASS; eslint clean.

`src/lib/researchBoard.ts` is **not** touched. Its `serializeBoard` reads `title` and `body` only, and Phase 2 Task 7 deletes that function — adding a URL to it would break the exact-string assertion in `researchBoard.test.ts` for no benefit.

- [ ] **Step 8: Manual verification**

1. Open the Research tab on a project with a board.
2. On an **empty** board, the Note / Clipping / Link buttons are visible at the top centre, above the "Nothing on this board yet" hint. **This is the state `15e` claimed was broken — confirm it here and record that the second half of the item needed no work.**
3. Click **Link**. The new card shows three fields: Title, a URL line, and Notes.
4. Type `example.com` into the URL line. An open-in-new-tab icon appears at its right.
5. Click the icon. A new tab opens at `https://example.com`.
6. Clear the URL. The icon disappears.
7. Type `javascript:alert(1)`. The text stays in the field but **no icon appears** — nothing is clickable.
8. Reload. Title, URL and Notes all persisted.
9. Open a Link card created before this change. It shows an empty URL field and its title and notes are intact.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: give the research Link card a URL field

The card the add toolbar calls Link had a title and a notes box and nowhere
to put a link. Adds a URL field and an open-in-new-tab anchor gated by a new
safeUrl leaf module, so a persisted javascript: or data: value renders as
text and never as an href.

The other half of 15e was a false premise: the research add toolbar is gated
on isResearch alone (WritingDesk.tsx:913), with no widgets.length term, so
the buttons already show on an empty board. No work was needed."
```

---

## Task 10: Make the writing column look resizable

**Files:**
- Modify: `src/components/editor/WritingDesk.tsx`
- Modify: `src/components/editor/WritingDesk.module.css`

The writing column is the docked `writingZone` widget. It gains two resize handles at `WritingDesk.tsx:859-860`:

```tsx
              <div className={`${styles.deskResizeHandle} ${styles.deskResizeE}`} onMouseDown={e => handleResizeStart(e, w, 'e')} />
              <div className={`${styles.deskResizeHandle} ${styles.deskResizeW}`} onMouseDown={e => handleResizeStart(e, w, 'w')} />
```

`.deskResizeHandle` is `background: transparent` with no border, no child, no pseudo-element (`WritingDesk.module.css:751-755`), and `grep -n "deskResizeHandle" WritingDesk.module.css` returns exactly **one** line — there is no `:hover`, no `:active`, no parent-hover reveal anywhere. The only feedback is the OS cursor changing, and only after the pointer is already inside a 10px band the writer had no reason to aim at. Meanwhile the same widget's *drag* handle is visible: `.dockedHandleDots` (`:885-901`) paints three dots at `opacity: 0.3`.

This task matches that: a persistent faint grip that brightens on hover, plus the separator semantics the app already uses elsewhere.

- [ ] **Step 1: Give the handles semantics**

Replace `WritingDesk.tsx:859-860` with:

```tsx
              <div
                className={`${styles.deskResizeHandle} ${styles.deskResizeE}`}
                onMouseDown={e => handleResizeStart(e, w, 'e')}
                role="separator"
                aria-orientation="vertical"
                aria-label="Drag to widen or narrow the writing column"
                title="Drag to resize"
              />
              <div
                className={`${styles.deskResizeHandle} ${styles.deskResizeW}`}
                onMouseDown={e => handleResizeStart(e, w, 'w')}
                role="separator"
                aria-orientation="vertical"
                aria-label="Drag to widen or narrow the writing column"
                title="Drag to resize"
              />
```

The eight floating handles at line 770 are left alone — a floating widget already reads as a movable object, and eight labelled separators would be noise.

- [ ] **Step 2: Paint the grip**

In `src/components/editor/WritingDesk.module.css`, after the `.deskResizeSW` line (line 764), append:

```css
/* The docked writing column's side handles were transparent with no hover
   rule at all — the column was resizable and looked fixed. Scoped to
   .dockedWidget so the eight floating handles stay clean; a floating widget
   already reads as movable. Matches .dockedHandleDots, the drag affordance
   already on this widget, and the transparent + transition + :hover pattern
   used by every side panel's .panelResizeHandle. */
.dockedWidget > .deskResizeE::after,
.dockedWidget > .deskResizeW::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 40px;
  max-height: 40%;
  border-radius: 1px;
  background: var(--foreground);
  opacity: 0.22;
  transition: opacity 150ms ease, background 150ms ease, width 150ms ease;
}

.dockedWidget > .deskResizeE:hover::after,
.dockedWidget > .deskResizeW:hover::after,
.dockedWidget > .deskResizeE:active::after,
.dockedWidget > .deskResizeW:active::after {
  width: 3px;
  opacity: 1;
  background: var(--accent);
}
```

- [ ] **Step 3: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: no compiler output; all tests PASS; eslint clean.

- [ ] **Step 4: Manual verification**

1. Open a story project so the writing column is docked in the centre.
2. A short faint vertical bar sits on each side edge of the column, roughly mid-height. **Before this change there was nothing.**
3. Hover one. It thickens and turns accent-coloured; the cursor becomes a resize cursor; the tooltip reads "Drag to resize".
4. Drag it. The column resizes live and stops at the minimum width.
5. Release, then reload. The new width persisted.
6. Drag the opposite edge. The column resizes from that side and its left position shifts, as before.
7. Add a second docked widget beside the writing column. It shows the same grips.
8. Un-dock the writing column with the anchor button. It becomes a floating widget with all eight handles and **no** painted grips.
9. Inspect a docked handle in devtools: `role="separator"`, `aria-orientation="vertical"`, `aria-label="Drag to widen or narrow the writing column"`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: make the writing column's resize handles visible

.deskResizeHandle was background: transparent with no hover, active or
parent-hover rule anywhere in the stylesheet, so the only signal a writer
ever got was the cursor changing after they had already found a 10px band
they had no reason to aim at. The docked side handles now carry a faint grip
that brightens on hover, matching .dockedHandleDots on the same widget, plus
role=separator and a label. Floating handles are unchanged."
```

---

## Definition of done

- [ ] `npx tsc --noEmit --pretty false` clean
- [ ] `npx vitest run` green, including the six new suites: `badgeAwarding`, `sceneActions`, `documentActions`, `socialActions`, `moveWorldBibleType`, `safeUrl`
- [ ] `npx eslint src` clean
- [ ] `npm run build` succeeds
- [ ] Every action this phase set out to wire now has at least one caller outside `src/store/`:
  ```bash
  for a in checkAndAwardBadges toggleStandardFormat repairStreak deleteScene deleteDocument reorderScenes deleteSocialPost moveWorldBibleType; do
    echo "== $a: $(grep -rn "$a" src --include=*.tsx | wc -l) component refs"
  done
  ```
  Expected: **1 or more** for every one. `checkAndAwardBadges` is additionally called from three places inside the store.
- [ ] `grep -rn "toggleCodeBlock" src --include=*.tsx` returns the block-style dropdown
- [ ] `grep -rn "editorMaxWidth" src --include=*.tsx` returns `DeskTipTapEditor.tsx` — the store value is finally read by a component
- [ ] All five badges are reachable: writing awards them (unchanged), and a repair, a target change and a rehydrate now do too
- [ ] A scene can be deleted and moved; a chapter can be deleted; the last chapter cannot
- [ ] Both destructive spine actions go through `ConfirmDialog`, the app's existing pattern — no new dialog component was written
- [ ] A shared update can be removed from the Social Media history
- [ ] An entity type can be dragged between World Bible folders, in both the live bible and the template designer
- [ ] The Standard-format toggle visibly changes the manuscript, persists, and restores the previous width when switched off
- [ ] A code block can be inserted from the toolbar and is styled
- [ ] The Link card holds a URL, opens it in a new tab, and refuses to make an anchor from a non-http(s) scheme
- [ ] The docked writing column shows a resize grip before the pointer arrives

## Items closed, and one that needed no work

| Roadmap item | Outcome |
|--------------|---------|
| `04c` | All eight actions wired. Two of the descriptions in the roadmap were wrong and are corrected above — badges were already earnable by writing, and `toggleStandardFormat` was a width swap with no consumer |
| `04f` | Closed |
| `15e` | **Half closed.** The Link card gained a URL. The "add buttons on an empty board" half was a false premise — the toolbar was never gated on emptiness |
| `13` | Closed |

**Absent stage "submission format":** partly closed. The editor now offers a real standard manuscript setting. Running headers and a page-one word count need pagination and belong with Phase 4 item `11` (front matter and the compile step) — they are recorded there rather than faked here.

## What this phase deliberately did not do

- **Drag-and-drop scene reordering.** `reorderScenes(documentId, orderedIds)` takes an ordered id list, which up/down buttons satisfy exactly. Buttons are keyboard-reachable; the desk's drag code is mouse-only. If DnD is wanted later it is a separate change on the same action.
- **Deleting the last chapter.** There would be no editor to land on and `handleAddChapter` is the only way back.
- **A confirmation on `deleteSocialPost`.** The row records something already published elsewhere; removing it destroys no writing.
- **Touching `serializeBoard`.** Phase 2 deletes it.
- **A repair on today or a future day.** Today is still winnable; the future has not happened.
