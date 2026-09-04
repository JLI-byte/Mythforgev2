# Phase 7 — First Run and Coming Back Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give LoreCanvas a memory of the person using it. One `hasOnboarded` flag turns Home into the "Where do you want to begin?" screen for someone who has never made a book; the same flag then unlocks four one-at-a-time dismissible hints for the features that are genuinely invisible. Home also learns to say what changed while the writer was away, and to measure a manuscript in scenes and chapters rather than only in words per day.

**Architecture:** Every decision this phase makes is a pure function in `src/lib/`, because `vitest.config.ts` includes only `src/**/*.test.ts` — component tests do not run. Five new leaf modules own the logic (should the first-run screen show; which hint is due; what changed since the last visit; how far along the manuscript is; what a new story is made of). The store gains three persisted fields and three actions, all thin. The JSX is the only untested layer and every JSX change here carries an explicit manual verification step. Task order keeps `tsc` green throughout: leaf module and its test first, then the component that consumes it.

**Tech Stack:** TypeScript (strict), React 19, Next 16, Zustand (persist middleware), Vitest (jsdom).

**Depends on:** Phases 1–6. This plan assumes one work type (`'story'`), no AI anywhere, `[[` entity linking from Phase 4, and `InterviewRunner` from Phase 5.

**Note on the test runner:** `vitest.config.ts` includes only `src/**/*.test.ts` — **not** `.test.tsx`. Do not write a `.test.tsx`; it will silently never run.

**Note on line numbers:** every line number below was read from the tree at the time of writing, i.e. **before** Phases 1-6 land. Phase 2 alone deletes `chatHistories` from four places in `workspaceStore.ts`, so numbers in that file drift by a few lines. Each citation also names the code it points at — anchor on the text, and treat the number as a starting point for the search.

**LEAF MODULE convention:** 4-space indent, no store import, no React import, and a doc comment at the top that says LEAF MODULE. See `src/lib/homeStats.ts` and `src/lib/writingDays.ts` for the house style.

---

## What was investigated, and what it changed

Read this before writing a hint for anything. The roadmap's Phase 7 row names three features to teach. Two of them do not survive verification.

| Candidate | Verdict | Evidence |
|-----------|---------|----------|
| `@` mentions in the editor | **Does not exist after Phase 1.** Do not write a hint | `EntitySuggest`/`EntityMark` are mounted in exactly one place, `src/components/editor/ScreenplayEditor.tsx:14-16,33-34`, which Phase 1 item `2b` deletes. The prose editor `src/components/editor/desk/DeskTipTapEditor.tsx:5-15` never loaded either extension |
| The research board's add buttons | **Already visible.** Do not write a hint | `src/components/editor/WritingDesk.tsx:913-919` renders Note / Clipping / Link unconditionally whenever `isResearch`, including on an empty board. `.topCenterControls` (`WritingDesk.module.css:4673`) is a pill row at top centre, `z-index: 60` |
| The Draft Table method picker | **Already taught.** Do not write a hint | `DraftTableWelcome` (`src/components/editor/desk/MethodLibrary.tsx:201`) is an empty-state overlay rendered at `WritingDesk.tsx:954` offering "Pick a Method", "Help Me Choose" and "Start Blank" |
| Drag a box on the empty canvas to place a card | **Invisible. Teach it** | `WritingDesk.tsx:handleCanvasMouseDown` — left-drag on bare canvas draws a ghost and opens the widget picker at ≥40×30px; Shift-drag or middle-drag pans. Nothing on screen says so |
| The docked writing column's drag edges | **Invisible. Teach it** | `WritingDesk.tsx:859-860` renders `.deskResizeE` / `.deskResizeW`; `WritingDesk.module.css:751-760` gives `.deskResizeHandle` `background: transparent` and a 10px hit area. Roadmap item `13` (Phase 9) confirms the affordance is still missing |
| `[[` entity linking | **New in Phase 4 and undiscoverable. Teach it** | Roadmap item `2e`. Today `openInlineCreator` is called only from `WorldBibleHome.tsx:187` and `WorldBibleRoot.tsx:75,164` — World Bible buttons |
| Dragging a book between shelves | **Invisible. Teach it** | `Bookshelf.tsx:383` makes every book `draggable` and `Bookshelf.tsx:450` makes every shelf a drop target. There is no cue, no `title`, and no prose anywhere on the Bookshelf that mentions it |
| ⌘/Ctrl+K command palette | Skipped, deliberately | Real (`src/app/page.tsx:105`, no button anywhere) but it duplicates the ModeBar's visible search field and its quick-create duplicates the visible New Project button. Teaching a redundant shortcut is noise |
| ⌘/Ctrl+E export | Skipped | The ModeBar already has a visible Export button (`ModeBar.tsx:501`) |
| Ctrl/Shift+scroll canvas zoom | Skipped | A zoom slider, ±, 100% and Fit are visible at `WritingDesk.tsx:864-910` |
| Double-click to rename a chapter or scene | Skipped | Already carries `title="Double-click to rename"` (`StoryWritingZone.tsx:377,407`) |
| The Interviews launcher | Skipped | Phase 5 remounts `InterviewMenu` as a labelled button. A labelled button is not invisible |

**Already implemented, no task written:**

- The three-intent "Where do you want to begin?" copy exists in full at `src/components/management/Bookshelf.tsx:785-811`, with styling at `Bookshelf.module.css:409-452`. This phase **moves** it rather than writing it again.
- Every timestamp the absence digest needs is already stamped. `updateProject`, `updateDocument`, `updateScene` and `updateEntity` all write `updatedAt: new Date()` (`workspaceStore.ts:1472, 1501, 1556, 1833`).
- `Scene.wordCount` is maintained on every keystroke-debounce by the editor (`StoryWritingZone.tsx:237,269` calling `updateScene(s.id, { content, wordCount })`), so structural progress does not need to re-count words.

**Confirmed absent:** `grep -rn "onboard\|Onboard\|tour\|firstRun\|hasSeen" src` returns nothing. There is no onboarding state of any kind.

**Stale AI copy this phase fixes in passing.** Phase 2 deletes the AI but does not touch these three strings, all of which are read by a brand-new user:

- `Bookshelf.tsx:796` — "Gather notes and build the world with the AI assistant"
- `HomePage.tsx` "Needs attention" tile — "Ask the research assistant to review your world."
- `WritingDesk.tsx:641` — "The assistant can read everything you put here."

---

## Account switching

`hasOnboarded`, `dismissedHints` and `lastVisitAt` are **per-user** state. All three go into `partializeWorkspace` (`src/store/workspaceStore.ts:1219`) and therefore live inside the single `lorecanvas-workspace` blob that Phase 3 stamps with `ownerUserId`.

That is the whole design. When user B signs in on user A's browser:

- Phase 3's `ownerUserId` mismatch discards the blob → all three fields fall back to their initial values → B gets the first-run screen and B's own hints.
- Phase 3's sign-out reset clears the blob → same outcome.

**Do not store any of these three fields in their own `localStorage` key.** A separate key is outside the blob Phase 3 owns, would survive both the mismatch discard and the sign-out reset, and would hand user B user A's onboarding. Task 1 includes a test that asserts all three are present in `partializeWorkspace`'s output, so a later refactor that pulls them out fails loudly.

---

## File Structure

**Created:**

| Path | What |
|------|------|
| `src/lib/onboarding.ts` | LEAF MODULE — first-run gate and the rehydration normalisers |
| `src/lib/onboarding.test.ts` | Its unit tests |
| `src/lib/newStory.ts` | LEAF MODULE — builds the project/chapter/scene records a new story is made of |
| `src/lib/newStory.test.ts` | Its unit tests |
| `src/lib/hints.ts` | LEAF MODULE — the hint catalogue and "which hint is due" |
| `src/lib/hints.test.ts` | Its unit tests |
| `src/lib/sinceLastVisit.ts` | LEAF MODULE — what changed while the writer was away |
| `src/lib/sinceLastVisit.test.ts` | Its unit tests |
| `src/lib/structuralProgress.ts` | LEAF MODULE — a manuscript measured in scenes and chapters |
| `src/lib/structuralProgress.test.ts` | Its unit tests |
| `src/store/onboardingState.test.ts` | Asserts the three new fields persist |
| `src/components/ui/BeginOptions.tsx` | The three-intent picker, shared by the Bookshelf wizard and Home |
| `src/components/ui/BeginOptions.module.css` | Moved out of `Bookshelf.module.css` |
| `src/components/ui/HintBubble.tsx` | One dismissible hint card |
| `src/components/ui/HintBubble.module.css` | Its styling |
| `src/components/home/FirstRunPanel.tsx` | Home on an empty workspace |
| `src/components/home/FirstRunPanel.module.css` | Its styling |

**Modified:**

| Path | Change |
|------|--------|
| `src/store/workspaceStore.ts` | Three persisted fields, one transient field, three actions, `partializeWorkspace`, initial state, rehydration guards, `addProject` |
| `src/components/management/Bookshelf.tsx` | Uses `planNewStory` and `BeginOptions`; AI copy removed |
| `src/components/management/Bookshelf.module.css` | Begin-option rules moved out |
| `src/components/home/HomePage.tsx` | First-run branch, "While you were away" tile, manuscript tile, AI copy removed |
| `src/components/home/HomePage.module.css` | Two new tile classes |
| `src/components/editor/WritingDesk.tsx` | Mounts the desk hint; AI copy removed |
| `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx` | Mounts the editor hint |
| `src/app/page.tsx` | Calls `markVisit()` once, after hydration |
| `src/components/goals/GoalsContent.tsx` | Project bars report scenes and chapters, not "% of a novel's length" |

---

## Task 1: Onboarding state in the store

**Files:**
- Create: `src/lib/onboarding.ts`
- Create: `src/lib/onboarding.test.ts`
- Create: `src/store/onboardingState.test.ts`
- Modify: `src/store/workspaceStore.ts`

- [ ] **Step 1: Write the failing leaf-module test**

Create `src/lib/onboarding.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
    shouldShowFirstRun,
    normalizeDismissedHints,
    normalizeVisitStamp,
} from './onboarding';

describe('shouldShowFirstRun', () => {
    it('shows for a writer who has never onboarded and owns nothing', () => {
        expect(shouldShowFirstRun({ hasOnboarded: false, projectCount: 0 })).toBe(true);
    });

    it('does not show once the flag is set, even with an empty workspace', () => {
        expect(shouldShowFirstRun({ hasOnboarded: true, projectCount: 0 })).toBe(false);
    });

    it('does not show while a book exists, even if the flag was never set', () => {
        // The example world seeds real projects, so a seeded workspace is not empty.
        expect(shouldShowFirstRun({ hasOnboarded: false, projectCount: 3 })).toBe(false);
    });
});

describe('normalizeDismissedHints', () => {
    it('returns an empty list for anything that is not an array', () => {
        expect(normalizeDismissedHints(undefined)).toEqual([]);
        expect(normalizeDismissedHints(null)).toEqual([]);
        expect(normalizeDismissedHints('entity-link')).toEqual([]);
        expect(normalizeDismissedHints({ 0: 'entity-link' })).toEqual([]);
    });

    it('keeps only non-empty strings', () => {
        expect(normalizeDismissedHints(['entity-link', 7, '', null, 'shelf-drag']))
            .toEqual(['entity-link', 'shelf-drag']);
    });
});

describe('normalizeVisitStamp', () => {
    it('keeps a parseable ISO timestamp', () => {
        expect(normalizeVisitStamp('2026-09-01T08:30:00.000Z'))
            .toBe('2026-09-01T08:30:00.000Z');
    });

    it('rejects anything unparseable or not a string', () => {
        expect(normalizeVisitStamp('yesterday')).toBeNull();
        expect(normalizeVisitStamp(1725000000000)).toBeNull();
        expect(normalizeVisitStamp(undefined)).toBeNull();
        expect(normalizeVisitStamp(null)).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/onboarding.test.ts`

Expected: FAIL — `Failed to resolve import "./onboarding"`.

- [ ] **Step 3: Write the leaf module**

Create `src/lib/onboarding.ts`:

```typescript
/**
 * First-run state — LEAF MODULE (no store, no React import).
 *
 * The app has exactly one way of knowing whether it has met this writer
 * before: hasOnboarded. Everything that behaves differently for a newcomer —
 * the Home first-run screen, the contextual hints — reads that flag through
 * here rather than guessing from the shape of the workspace.
 *
 * The normalisers exist because these fields arrived after the persisted
 * schema shipped: an older blob has no value for them, and a corrupted one
 * can have any value at all.
 */

export interface FirstRunInput {
    hasOnboarded: boolean;
    projectCount: number;
}

/**
 * Home becomes the "Where do you want to begin?" screen only for a writer who
 * has never finished onboarding AND has nothing to open. The project count is
 * the second half deliberately: loading the example world creates real
 * projects, so a seeded workspace is not a blank one.
 */
export function shouldShowFirstRun(input: FirstRunInput): boolean {
    return !input.hasOnboarded && input.projectCount === 0;
}

/** A persisted dismissed-hint list, reduced to the ids we can actually use. */
export function normalizeDismissedHints(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/**
 * A persisted visit timestamp, or null. An unparseable stamp reads as "never
 * been here", which shows no digest — better than an absence measured against
 * NaN.
 */
export function normalizeVisitStamp(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    return Number.isFinite(Date.parse(value)) ? value : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/onboarding.test.ts`

Expected: PASS — 3 suites, 8 tests.

- [ ] **Step 5: Write the failing persistence test**

Create `src/store/onboardingState.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { partializeWorkspace } from './workspaceStore';

/**
 * These three fields are per-user. They must live inside the single persisted
 * workspace blob so that Phase 3's ownerUserId discard and sign-out reset take
 * them with everything else. A separate localStorage key would survive both
 * and hand the next person on this browser someone else's onboarding.
 */
describe('partializeWorkspace: first-run state', () => {
    it('persists hasOnboarded', () => {
        const state = { hasOnboarded: true } as never;
        expect(partializeWorkspace(state)).toHaveProperty('hasOnboarded', true);
    });

    it('persists dismissedHints', () => {
        const state = { dismissedHints: ['entity-link'] } as never;
        expect(partializeWorkspace(state)).toHaveProperty('dismissedHints', ['entity-link']);
    });

    it('persists lastVisitAt', () => {
        const state = { lastVisitAt: '2026-09-01T08:30:00.000Z' } as never;
        expect(partializeWorkspace(state))
            .toHaveProperty('lastVisitAt', '2026-09-01T08:30:00.000Z');
    });

    it('does not persist previousVisitAt — it is derived at boot, once per load', () => {
        const state = { previousVisitAt: '2026-08-01T00:00:00.000Z' } as never;
        expect(partializeWorkspace(state)).not.toHaveProperty('previousVisitAt');
    });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/store/onboardingState.test.ts`

Expected: FAIL — `expected { worlds: undefined, … } to have property "hasOnboarded"`.

- [ ] **Step 7: Add the fields to the store interface**

In `src/store/workspaceStore.ts`, in `interface WorkspaceState` (opens at line 511), add this block immediately after the `exampleWorldId: string | null;` declaration that ends at line 607:

```typescript
    /**
     * Whether this writer has been through first run. Set the moment they own
     * a book — by creating one, importing one, or loading the example world.
     * Per-user: it rides inside the persisted workspace blob so an account
     * switch discards it along with everything else.
     */
    hasOnboarded: boolean;

    /**
     * Ids of contextual hints this writer has closed. Holds the '*' sentinel
     * (HINTS_ALL_DISMISSED) when they asked not to be shown any more.
     */
    dismissedHints: string[];

    /** ISO timestamp of the start of the CURRENT visit. Persisted. */
    lastVisitAt: string | null;

    /**
     * The value lastVisitAt held when this page load began — what "away since"
     * means for the whole session. Transient: derived once by markVisit() and
     * never persisted, or the digest would reset itself on every save.
     */
    previousVisitAt: string | null;
```

- [ ] **Step 8: Add the action signatures**

In the same interface, add these beside the other action declarations — put them directly after `setExampleData: (on: boolean) => void;` (line 875):

```typescript
    /** Mark first run complete. Idempotent. */
    completeOnboarding: () => void;

    /** Close one hint by id, or every hint with HINTS_ALL_DISMISSED. */
    dismissHint: (id: string) => void;

    /**
     * Freeze the previous visit stamp and start a new one. Called once per page
     * load, after hydration. Calling it again in the same load is a no-op, so
     * a remount cannot erase the absence the writer has not read yet.
     */
    markVisit: () => void;
```

- [ ] **Step 9: Add the initial state**

In the store's initial object, after `exampleWorldId: null,` (line 1336):

```typescript
            hasOnboarded: false,
            dismissedHints: [],
            lastVisitAt: null,
            previousVisitAt: null,
```

- [ ] **Step 10: Add them to `partializeWorkspace`**

In `partializeWorkspace` (line 1219), after `exampleWorldId: state.exampleWorldId,` (line 1235):

```typescript
        hasOnboarded: state.hasOnboarded,
        dismissedHints: state.dismissedHints,
        lastVisitAt: state.lastVisitAt,
```

`previousVisitAt` is **not** added — it is derived per page load.

- [ ] **Step 11: Implement the three actions**

In the store body, directly after the closing `},` of `setExampleData` (its final `},`, line 1750 before Phases 1-6 land), add:

```typescript
            completeOnboarding: () =>
                set((state) => (state.hasOnboarded ? {} : { hasOnboarded: true })),

            dismissHint: (id) =>
                set((state) => (
                    state.dismissedHints.includes(id)
                        ? {}
                        : { dismissedHints: [...state.dismissedHints, id] }
                )),

            markVisit: () =>
                set((state) => {
                    // Once per page load. previousVisitAt is null only before
                    // the first call, so a second call finds it set and stops.
                    if (state.previousVisitAt !== null) return {};
                    return {
                        previousVisitAt: state.lastVisitAt,
                        lastVisitAt: new Date().toISOString(),
                    };
                }),
```

Note the one edge this accepts: on a writer's very first ever visit `lastVisitAt` is null, so `previousVisitAt` stays null and `markVisit` will run again if Home remounts. That is harmless — there is nothing to overwrite, and the digest shows nothing for a null `since` either way.

- [ ] **Step 12: Set the flag where a book is first owned**

`addProject` is the single choke point every route into owning a book passes through — the Bookshelf wizard, the import modal, the command palette's quick-create, and `betaSeedData`'s example world. Replace `addProject` at `src/store/workspaceStore.ts:1461`:

```typescript
            addProject: (project) =>
                set((state) => {
                    logger.info('Project added:', project.name);
                    // Owning a book is what ends first run, however it happened —
                    // created, imported, or seeded from the example world.
                    return {
                        projects: [...state.projects, project],
                        ...(state.hasOnboarded ? {} : { hasOnboarded: true }),
                    };
                }),
```

- [ ] **Step 13: Add the rehydration guards**

In `onRehydrateStorage` (`src/store/workspaceStore.ts:2488`), beside the other late-arrival guards — directly after the `worldUnderstanding` guard (the `if (!state.worldUnderstanding …) { state.worldUnderstanding = {}; }` block), immediately above `state.setHasHydrated(true);`:

```typescript
                    // First-run state arrived after the persisted schema shipped.
                    if (typeof state.hasOnboarded !== 'boolean') {
                        // An existing writer with work is not a newcomer.
                        state.hasOnboarded = state.projects.length > 0;
                    }
                    state.dismissedHints = normalizeDismissedHints(state.dismissedHints);
                    state.lastVisitAt = normalizeVisitStamp(state.lastVisitAt);
                    // Never restored: it is derived per page load by markVisit().
                    state.previousVisitAt = null;
```

Add the import at the top of the file, beside the other `@/lib` imports (near line 6):

```typescript
import { normalizeDismissedHints, normalizeVisitStamp } from '@/lib/onboarding';
```

- [ ] **Step 14: Run both tests to verify they pass**

Run: `npx vitest run src/store/onboardingState.test.ts src/lib/onboarding.test.ts`

Expected: PASS — 12 tests.

- [ ] **Step 15: Full check**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: the app can tell a new writer from a returning one

Adds hasOnboarded, dismissedHints and lastVisitAt to the workspace store.
All three sit inside the persisted blob rather than their own localStorage
key, so Phase 3's ownerUserId discard and sign-out reset take them with
everything else — the next person on this browser gets their own first run,
not the last person's.

addProject sets the flag, so importing a manuscript or loading the example
world ends first run just as creating a book does. Existing writers with
projects rehydrate as already onboarded."
```

---

## Task 2: Extract what a new story is made of

**Files:**
- Create: `src/lib/newStory.ts`
- Create: `src/lib/newStory.test.ts`
- Modify: `src/components/management/Bookshelf.tsx`

`confirmCreateStory` (`Bookshelf.tsx:305-365`) is the only code in the app that knows a story is a project plus Chapter 1 plus Scene 1 plus a pre-filtered Draft Table. Home is about to need the same knowledge. Extracting it first means Task 3 calls a tested function instead of copying sixty lines.

- [ ] **Step 1: Write the failing test**

Create `src/lib/newStory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { planNewStory } from './newStory';

const ids = { projectId: 'p1', documentId: 'd1', sceneId: 's1' };
const now = new Date('2026-09-03T10:00:00.000Z');

function base() {
    return { name: 'The Long Winter', workTypeId: 'story', coverColor: '#26262b', ids, now };
}

describe('planNewStory', () => {
    it('returns null for a blank name', () => {
        expect(planNewStory({ ...base(), name: '   ' })).toBeNull();
    });

    it('returns null for a work type that does not exist', () => {
        expect(planNewStory({ ...base(), workTypeId: 'screenplay' })).toBeNull();
    });

    it('trims the name onto the project', () => {
        const plan = planNewStory({ ...base(), name: '  The Long Winter  ' })!;
        expect(plan.project.name).toBe('The Long Winter');
    });

    it('builds a project carrying the work type writing mode', () => {
        const plan = planNewStory(base())!;
        expect(plan.project.id).toBe('p1');
        expect(plan.project.writingMode).toBe('novel');
        expect(plan.project.coverColor).toBe('#26262b');
        expect(plan.project.createdAt).toEqual(now);
    });

    it('gives the story a first chapter and a first scene, wired together', () => {
        const plan = planNewStory(base())!;
        expect(plan.document).toEqual({
            id: 'd1', projectId: 'p1', title: 'Chapter 1', content: '', createdAt: now,
        });
        expect(plan.scene).toEqual({
            id: 's1', documentId: 'd1', projectId: 'p1',
            title: 'Scene 1', content: '', order: 0, createdAt: now,
        });
    });

    it('pre-filters the Draft Table to the work type', () => {
        const plan = planNewStory(base())!;
        expect(plan.draftState).toEqual({ draftTypeId: 'novel', draftFormat: 'prose' });
    });

    it('files the story under a shelf when one is given', () => {
        const plan = planNewStory({ ...base(), worldId: 'w9' })!;
        expect(plan.project.worldId).toBe('w9');
    });

    it('omits an empty brief rather than storing a hollow object', () => {
        const plan = planNewStory({ ...base(), brief: { audience: '  ', goal: '' } })!;
        expect(plan.project).not.toHaveProperty('brief');
    });

    it('keeps only the brief answers that were actually filled in', () => {
        const plan = planNewStory({ ...base(), brief: { audience: 'YA', goal: '  ' } })!;
        expect(plan.project.brief).toEqual({ audience: 'YA' });
    });
});
```

If `getDraftType('novel')?.format` is not `'prose'` in this repo, read `src/lib/writingMethods/draftTypes.ts` and use the value it actually holds — the assertion must match the data, not the other way round.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/newStory.test.ts`

Expected: FAIL — `Failed to resolve import "./newStory"`.

- [ ] **Step 3: Write the leaf module**

Create `src/lib/newStory.ts`:

```typescript
/**
 * What a new story is made of — LEAF MODULE (no store, no React import).
 *
 * A book is never just a project row: it is a project, its first chapter, its
 * first scene, and a Draft Table pre-filtered to the kind of work it is. Two
 * screens create books — the Bookshelf wizard and Home's first-run panel — so
 * that shape lives here rather than in whichever one happened to be written
 * first.
 *
 * Returns plain records for the caller to hand to the store's actions. The
 * caller supplies the ids and the clock so the result is deterministic.
 */

import { getWorkType, type WritingMode } from './workTypes';
import { getWorkSubType, type ProjectBrief } from './workSubTypes';
import { getDraftType } from './writingMethods/draftTypes';

export interface NewStoryIds {
    projectId: string;
    documentId: string;
    sceneId: string;
}

export interface NewStoryInput {
    name: string;
    workTypeId: string;
    /** Only Script/Report ever had sub-types; kept so the wizard can pass one. */
    subTypeId?: string | null;
    brief?: ProjectBrief;
    /** Shelf to file the book under. undefined means the standalone shelf. */
    worldId?: string;
    coverColor: string;
    ids: NewStoryIds;
    now: Date;
}

export interface PlannedProject {
    id: string;
    name: string;
    writingMode: WritingMode;
    coverColor: string;
    worldId?: string;
    createdAt: Date;
    workSubTypeId?: string;
    brief?: ProjectBrief;
}

export interface PlannedDocument {
    id: string;
    projectId: string;
    title: string;
    content: string;
    createdAt: Date;
}

export interface PlannedScene {
    id: string;
    documentId: string;
    projectId: string;
    title: string;
    content: string;
    order: number;
    createdAt: Date;
}

export interface NewStoryPlan {
    project: PlannedProject;
    document: PlannedDocument;
    scene: PlannedScene;
    /** null when no draft type honestly fits the work. */
    draftState: { draftTypeId: string; draftFormat: string | undefined } | null;
}

/**
 * Build every record a new story needs, or null when the input cannot make
 * one — a blank name or an unknown work type. Returning null rather than
 * throwing keeps the callers' click handlers straight-line.
 */
export function planNewStory(input: NewStoryInput): NewStoryPlan | null {
    const name = input.name.trim();
    const workType = getWorkType(input.workTypeId);
    if (!name || !workType) return null;

    const subType = getWorkSubType(input.subTypeId);

    // Only keep answers that were actually filled in.
    const brief: ProjectBrief = Object.fromEntries(
        Object.entries(input.brief ?? {}).filter(([, v]) => v?.trim()),
    );
    const hasBrief = Object.keys(brief).length > 0;

    // The sub-type knows better than the work type when both have an opinion.
    const draftTypeId = subType?.draftTypeId ?? workType.draftTypeId;

    return {
        project: {
            id: input.ids.projectId,
            name,
            writingMode: workType.writingMode,
            coverColor: input.coverColor,
            worldId: input.worldId,
            createdAt: input.now,
            ...(subType ? { workSubTypeId: subType.id } : {}),
            ...(hasBrief ? { brief } : {}),
        },
        document: {
            id: input.ids.documentId,
            projectId: input.ids.projectId,
            title: 'Chapter 1',
            content: '',
            createdAt: input.now,
        },
        scene: {
            id: input.ids.sceneId,
            documentId: input.ids.documentId,
            projectId: input.ids.projectId,
            title: 'Scene 1',
            content: '',
            order: 0,
            createdAt: input.now,
        },
        draftState: draftTypeId
            ? { draftTypeId, draftFormat: getDraftType(draftTypeId)?.format }
            : null,
    };
}
```

`getDraftType` is imported from `./writingMethods/draftTypes` rather than `./writingMethods`, because the package index imports `DeskWidget` from the store and would break the leaf rule.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/newStory.test.ts`

Expected: PASS — 9 tests.

- [ ] **Step 5: Rewrite `confirmCreateStory` to use it**

In `src/components/management/Bookshelf.tsx`, replace the body of `confirmCreateStory` (lines 305–365, from `const confirmCreateStory` through its closing `};`) with:

```typescript
    const confirmCreateStory = (destination: 'template' | 'desk' | 'research') => {
        const plan = planNewStory({
            name: storyName,
            workTypeId: storyTypeId ?? '',
            subTypeId: storySubTypeId,
            brief: storyBrief,
            worldId: storyWorldId,
            coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
            ids: {
                projectId: crypto.randomUUID(),
                documentId: crypto.randomUUID(),
                sceneId: crypto.randomUUID(),
            },
            now: new Date(),
        });
        if (!plan) return;

        addProject(plan.project);
        if (plan.draftState) updateDraftState(plan.project.id, plan.draftState);
        addDocument(plan.document);
        addScene(plan.scene);

        setIsStoryModalOpen(false);
        setStoryName('');
        setActiveProject(plan.project.id);
        setWorkspaceMode(destination);
    };
```

Add the import beside the other `@/lib` imports (after line 10):

```typescript
import { planNewStory } from '@/lib/newStory';
```

Then remove the imports that only `confirmCreateStory` used. Let the compiler find them:

Run: `npx eslint src/components/management/Bookshelf.tsx`

Expected: it flags any now-unused import. `getWorkType`, `getWorkSubType`, `getDraftType` and `type ProjectBrief` are the likely candidates — but `getWorkType` and `getWorkSubType` are still used by the wizard's JSX at lines 700–746, so check each before deleting. Delete only the ones eslint actually flags.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src/components/management/Bookshelf.tsx`

Expected: all three clean.

- [ ] **Step 7: Manual verification**

Start the dev server. On the Bookshelf, create a new book named "Verify One" and pick **Draft First**.

Confirm: the book appears on the shelf, the app lands on the Draft Table, the method library is pre-filtered to novel methods, and switching to the Writing Desk shows "Chapter 1 / Scene 1". Repeat with **Start Writing** and confirm it lands on the Writing Desk instead. Nothing about this flow should have changed.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: extract what a new story is made of into a leaf module

confirmCreateStory was the only code that knew a book is a project plus
Chapter 1 plus Scene 1 plus a pre-filtered Draft Table. Home's first-run
panel needs the same knowledge, so it moves to src/lib/newStory.ts with
real unit tests instead of being copied into a second component."
```

---

## Task 3: Home is the front door on an empty workspace

**Files:**
- Create: `src/components/ui/BeginOptions.tsx`, `src/components/ui/BeginOptions.module.css`
- Create: `src/components/home/FirstRunPanel.tsx`, `src/components/home/FirstRunPanel.module.css`
- Modify: `src/components/management/Bookshelf.tsx`, `src/components/management/Bookshelf.module.css`
- Modify: `src/components/home/HomePage.tsx`

The three intents already explain the whole app — Research First, Draft First, Start Writing map the three modes onto three things a writer might actually want. They are buried on step three of a modal you can only reach from the Bookshelf. This task moves them somewhere a newcomer will be standing.

This is a JSX task. Verification is manual.

- [ ] **Step 1: Move the begin-option styling into its own module**

Cut `Bookshelf.module.css` lines 409–452 — the comment block, `.beginOptions`, `.beginOption`, `.beginOption:hover:not(:disabled)`, `.beginOption:disabled`, `.beginOptionTitle` and `.beginOptionDesc` — and paste them unchanged into a new `src/components/ui/BeginOptions.module.css`.

Confirm nothing else in the Bookshelf referenced them:

```bash
grep -n "beginOption" src/components/management/Bookshelf.module.css
```

Expected: no output.

- [ ] **Step 2: Write the shared component**

Create `src/components/ui/BeginOptions.tsx`:

```tsx
"use client";

import React from 'react';
import styles from './BeginOptions.module.css';

export type BeginDestination = 'research' | 'template' | 'desk';

interface BeginOptionsProps {
    onChoose: (destination: BeginDestination) => void;
    disabled?: boolean;
}

/**
 * The three ways into a new book. Shown twice: on step three of the Bookshelf's
 * new-work wizard, and on Home when the workspace is empty. It is the only
 * place in the app that maps the modes onto what a writer actually wants to do
 * next, which is exactly why a newcomer should not have to find it inside a
 * modal.
 */
export function BeginOptions({ onChoose, disabled = false }: BeginOptionsProps) {
    return (
        <div className={styles.beginOptions}>
            <button
                className={styles.beginOption}
                onClick={() => onChoose('research')}
                disabled={disabled}
            >
                <span className={styles.beginOptionTitle}>🔎 Research First</span>
                <span className={styles.beginOptionDesc}>
                    Gather notes, clippings and links on a board before you write a word
                </span>
            </button>
            <button
                className={styles.beginOption}
                onClick={() => onChoose('template')}
                disabled={disabled}
            >
                <span className={styles.beginOptionTitle}>🗺️ Draft First</span>
                <span className={styles.beginOptionDesc}>
                    Outline on the Draft Table with a writing method
                </span>
            </button>
            <button
                className={styles.beginOption}
                onClick={() => onChoose('desk')}
                disabled={disabled}
            >
                <span className={styles.beginOptionTitle}>✍️ Start Writing</span>
                <span className={styles.beginOptionDesc}>
                    Jump straight in on the Writing Desk
                </span>
            </button>
        </div>
    );
}
```

The Research First description no longer mentions the AI assistant. That copy named a feature Phase 2 deleted.

- [ ] **Step 3: Use it in the Bookshelf wizard**

In `src/components/management/Bookshelf.tsx`, replace the whole `<div className={styles.beginOptions}>…</div>` block (lines 786–811) with:

```tsx
                                <BeginOptions
                                    onChoose={confirmCreateStory}
                                    disabled={!storyName.trim()}
                                />
```

Leave the `<label className={styles.shelfLabel}>Where do you want to begin?</label>` on line 785 exactly where it is. Add the import beside the other component imports (after line 12):

```typescript
import { BeginOptions } from '@/components/ui/BeginOptions';
```

- [ ] **Step 4: Write the first-run panel**

Create `src/components/home/FirstRunPanel.tsx`:

```tsx
"use client";

import React, { useState } from 'react';
import { useWorkspaceStore, COVER_COLORS } from '@/store/workspaceStore';
import { planNewStory } from '@/lib/newStory';
import { BeginOptions, type BeginDestination } from '@/components/ui/BeginOptions';
import styles from './FirstRunPanel.module.css';

/**
 * Home, for a writer who has never made a book.
 *
 * The three intents below are the app's own map of itself: a research board, a
 * draft table, a writing desk, each described by what you would want it for.
 * Until now that map lived on step three of a modal you could only open from
 * the Bookshelf — visible only to people who no longer needed it.
 */
export default function FirstRunPanel() {
    const addProject = useWorkspaceStore(s => s.addProject);
    const addDocument = useWorkspaceStore(s => s.addDocument);
    const addScene = useWorkspaceStore(s => s.addScene);
    const updateDraftState = useWorkspaceStore(s => s.updateDraftState);
    const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
    const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
    const setExampleData = useWorkspaceStore(s => s.setExampleData);
    const completeOnboarding = useWorkspaceStore(s => s.completeOnboarding);

    const [name, setName] = useState('');

    const begin = (destination: BeginDestination) => {
        const plan = planNewStory({
            name,
            workTypeId: 'story',
            coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
            ids: {
                projectId: crypto.randomUUID(),
                documentId: crypto.randomUUID(),
                sceneId: crypto.randomUUID(),
            },
            now: new Date(),
        });
        if (!plan) return;

        addProject(plan.project);
        if (plan.draftState) updateDraftState(plan.project.id, plan.draftState);
        addDocument(plan.document);
        addScene(plan.scene);

        setActiveProject(plan.project.id);
        setWorkspaceMode(destination);
    };

    return (
        <div className={styles.firstRun}>
            <div className={styles.inner}>
                <h1 className={styles.title}>Let&apos;s start a book</h1>
                <p className={styles.sub}>
                    LoreCanvas is three rooms around one manuscript: a board for what you
                    find out, a table for how it is shaped, and a desk for the writing
                    itself. Pick where you want to begin — you can move between them
                    whenever you like.
                </p>

                <label className={styles.nameLabel} htmlFor="first-run-name">
                    What are you calling it?
                </label>
                <input
                    id="first-run-name"
                    className={styles.nameInput}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && name.trim()) begin('desk'); }}
                    placeholder="e.g. The Long Winter"
                    autoFocus
                />

                <p className={styles.beginLabel}>Where do you want to begin?</p>
                <BeginOptions onChoose={begin} disabled={!name.trim()} />

                <div className={styles.escapeRow}>
                    <button
                        className={styles.escapeBtn}
                        onClick={() => setExampleData(true)}
                    >
                        Show me a finished example instead
                    </button>
                    <button
                        className={styles.escapeBtn}
                        onClick={completeOnboarding}
                    >
                        I&apos;ll look around first
                    </button>
                </div>
            </div>
        </div>
    );
}
```

Both escape hatches end first run: "Show me an example" calls `setExampleData(true)`, which seeds projects through `addProject` and so sets `hasOnboarded` on its own; "I'll look around first" calls `completeOnboarding` directly.

- [ ] **Step 5: Style it**

Create `src/components/home/FirstRunPanel.module.css`:

```css
.firstRun {
  display: flex;
  justify-content: center;
  padding: clamp(32px, 8vh, 96px) 24px;
}

.inner {
  width: 100%;
  max-width: 560px;
}

.title {
  margin: 0 0 10px;
  font-size: 1.9rem;
  font-weight: 700;
  color: var(--foreground);
}

.sub {
  margin: 0 0 28px;
  font-size: 0.9rem;
  line-height: 1.65;
  color: var(--muted);
}

.nameLabel,
.beginLabel {
  display: block;
  margin: 0 0 6px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.beginLabel { margin-top: 24px; }

.nameInput {
  width: 100%;
  padding: 11px 13px;
  border-radius: 10px;
  border: 1px solid rgba(var(--overlay-rgb), 0.14);
  background: rgba(var(--overlay-rgb), 0.05);
  color: var(--foreground);
  font-size: 0.95rem;
}

.nameInput:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.escapeRow {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 4px;
}

.escapeBtn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 0.78rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.escapeBtn:hover { color: var(--foreground); }

.escapeBtn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 4px;
}
```

- [ ] **Step 6: Branch Home onto it**

In `src/components/home/HomePage.tsx`, add the imports:

```typescript
import { shouldShowFirstRun } from '@/lib/onboarding';
import FirstRunPanel from './FirstRunPanel';
```

and the selector, beside the other store reads:

```typescript
  const hasOnboarded = useWorkspaceStore(s => s.hasOnboarded);
```

Then, immediately before the component's `return (` (the `<div className={styles.home}>` at the end of the file), add:

```tsx
  if (shouldShowFirstRun({ hasOnboarded, projectCount: projects.length })) {
    return <FirstRunPanel />;
  }
```

Place it **after** every hook call in the component. Returning early above a hook would change the hook order between renders and crash React.

- [ ] **Step 7: Remove the last AI copy from Home**

In the "Needs attention" tile, replace:

```tsx
              <p className={styles.tileEmpty}>Nothing flagged. Ask the research assistant to review your world.</p>
```

with:

```tsx
              <p className={styles.tileEmpty}>Nothing flagged. Consistency checks run over your lore as you write.</p>
```

- [ ] **Step 8: And from the research board's empty state**

In `src/components/editor/WritingDesk.tsx:641`, replace:

```tsx
              Notes, clippings and links about this project, arranged however you think.
              The assistant can read everything you put here.
```

with:

```tsx
              Notes, clippings and links about this project, arranged however you think.
              Use the buttons above to add one.
```

- [ ] **Step 9: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: all three clean.

- [ ] **Step 10: Manual verification**

This is the heart of the phase. Do all five.

1. **First run.** In a private window, sign in to a fresh account (or run `localStorage.clear()` then reload). Home shows "Let's start a book", the explanatory paragraph, a name field and the three intents — **not** the bento dashboard. The three buttons are disabled until a name is typed.
2. **It creates a real book.** Type "First Run Check" and click **Draft First**. The app lands on the Draft Table with the method library pre-filtered. Click Home: the bento dashboard is now showing, and the first-run panel does not come back.
3. **The example escape hatch.** Clear storage again, reload, and click "Show me a finished example instead". The example world seeds and Home switches to the dashboard within a second or two. Reload — the dashboard is still what shows.
4. **The look-around escape hatch.** Clear storage again, reload, click "I'll look around first". Home switches to the dashboard with an empty state. Reload — the dashboard persists.
5. **The Bookshelf wizard still works.** From the dashboard, Bookshelf → New Story → name it → the three intents render as before, styled identically, and each still creates and routes correctly. The Research First description now reads "Gather notes, clippings and links on a board before you write a word" with no mention of an assistant.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: Home is the front door for a writer with no books

The three intents — Research First, Draft First, Start Writing — are the
app's own map of itself, and they were reachable only from step three of a
modal you had to already own a book to care about. They now greet a
newcomer on Home and are shared with the Bookshelf wizard rather than
duplicated.

Also removes three strings that still named the deleted AI: the Research
First description, Home's needs-attention empty state, and the research
board's empty-canvas hint."
```

---

## Task 4: The hint catalogue

**Files:**
- Create: `src/lib/hints.ts`
- Create: `src/lib/hints.test.ts`

Four hints, one at a time, in a fixed teaching order. The order rule is what guarantees two bubbles can never share a screen — a hint shows only when it is the first undismissed hint in the whole catalogue *and* the writer is standing on its surface.

- [ ] **Step 1: Write the failing test**

Create `src/lib/hints.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { HINTS, HINTS_ALL_DISMISSED, nextHintFor } from './hints';

const onboarded = { hasOnboarded: true };

describe('HINTS', () => {
    it('teaches exactly the four invisible features', () => {
        expect(HINTS.map(h => h.id)).toEqual([
            'desk-canvas-draw',
            'writing-column-resize',
            'entity-link',
            'shelf-drag',
        ]);
    });

    it('gives every hint a surface, a title and a body', () => {
        for (const h of HINTS) {
            expect(['desk', 'editor', 'bookshelf']).toContain(h.surface);
            expect(h.title.length).toBeGreaterThan(0);
            expect(h.body.length).toBeGreaterThan(0);
        }
    });

    it('uses no id that collides with the dismiss-everything sentinel', () => {
        expect(HINTS.map(h => h.id)).not.toContain(HINTS_ALL_DISMISSED);
    });
});

describe('nextHintFor', () => {
    it('shows nothing before first run is finished', () => {
        expect(nextHintFor('desk', [], { hasOnboarded: false })).toBeNull();
    });

    it('offers the first hint on its own surface', () => {
        expect(nextHintFor('desk', [], onboarded)?.id).toBe('desk-canvas-draw');
    });

    it('offers nothing on a surface whose turn has not come', () => {
        expect(nextHintFor('bookshelf', [], onboarded)).toBeNull();
        expect(nextHintFor('editor', [], onboarded)).toBeNull();
    });

    it('advances to the next hint once one is dismissed', () => {
        expect(nextHintFor('desk', ['desk-canvas-draw'], onboarded)?.id)
            .toBe('writing-column-resize');
    });

    it('moves to the next surface once that surface is exhausted', () => {
        const dismissed = ['desk-canvas-draw', 'writing-column-resize'];
        expect(nextHintFor('desk', dismissed, onboarded)).toBeNull();
        expect(nextHintFor('editor', dismissed, onboarded)?.id).toBe('entity-link');
    });

    it('shows nothing anywhere once every hint is dismissed', () => {
        const all = HINTS.map(h => h.id);
        expect(nextHintFor('desk', all, onboarded)).toBeNull();
        expect(nextHintFor('editor', all, onboarded)).toBeNull();
        expect(nextHintFor('bookshelf', all, onboarded)).toBeNull();
    });

    it('shows nothing anywhere once the writer opts out', () => {
        const optedOut = [HINTS_ALL_DISMISSED];
        expect(nextHintFor('desk', optedOut, onboarded)).toBeNull();
        expect(nextHintFor('editor', optedOut, onboarded)).toBeNull();
        expect(nextHintFor('bookshelf', optedOut, onboarded)).toBeNull();
    });

    it('ignores dismissed ids it does not recognise', () => {
        expect(nextHintFor('desk', ['gone-in-a-later-version'], onboarded)?.id)
            .toBe('desk-canvas-draw');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/hints.test.ts`

Expected: FAIL — `Failed to resolve import "./hints"`.

- [ ] **Step 3: Write the leaf module**

Create `src/lib/hints.ts`:

```typescript
/**
 * Contextual hints — LEAF MODULE (no store, no React import).
 *
 * Four features in LoreCanvas have no affordance at all: you either know they
 * are there or you never find them. This is the whole teaching layer for them.
 * There is no tour, no docs site and no help menu — a hint appears once, at
 * first contact, and never again after it is closed.
 *
 * Only these four. Everything else that looked like a candidate was either
 * already labelled, already visible, or deleted in an earlier phase; see the
 * Phase 7 plan for what was ruled out and why.
 *
 * The catalogue is in teaching order and a hint is offered only when it is the
 * first undismissed one in the list. That single rule is what keeps two
 * bubbles off the screen at once without any component knowing about any
 * other component.
 */

export type HintSurface = 'desk' | 'editor' | 'bookshelf';

export interface Hint {
    id: string;
    surface: HintSurface;
    title: string;
    body: string;
}

/** Stored in dismissedHints when the writer asks for no more hints at all. */
export const HINTS_ALL_DISMISSED = '*';

export const HINTS: Hint[] = [
    {
        id: 'desk-canvas-draw',
        surface: 'desk',
        title: 'Drag out a space',
        body: 'Drag a box on the empty canvas to place a card exactly where you want it. Hold Shift and drag to move the canvas itself.',
    },
    {
        id: 'writing-column-resize',
        surface: 'desk',
        title: 'The column is yours to size',
        body: 'Drag the left or right edge of the writing column to change how wide the page is. It stays that width next time.',
    },
    {
        id: 'entity-link',
        surface: 'editor',
        title: 'Link people and places as you write',
        body: 'Type [[ in the manuscript to link a World Bible article. If the name is new, it offers to create the article there and then.',
    },
    {
        id: 'shelf-drag',
        surface: 'bookshelf',
        title: 'Books move between shelves',
        body: 'Drag a book onto another shelf to re-file it. Its chapters, scenes and lore go with it.',
    },
];

/**
 * The hint due on this surface, or null. Null means one of four things: first
 * run is not finished, the writer opted out, everything is dismissed, or the
 * next hint belongs to a different surface.
 */
export function nextHintFor(
    surface: HintSurface,
    dismissed: string[],
    opts: { hasOnboarded: boolean },
): Hint | null {
    if (!opts.hasOnboarded) return null;
    if (dismissed.includes(HINTS_ALL_DISMISSED)) return null;
    const next = HINTS.find(h => !dismissed.includes(h.id));
    if (!next || next.surface !== surface) return null;
    return next;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/hints.test.ts`

Expected: PASS — 2 suites, 12 tests.

- [ ] **Step 5: Full check**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: a hint catalogue for the four genuinely invisible features

Drag-to-draw on the desk canvas, the writing column's transparent resize
edges, [[ entity linking, and dragging a book between shelves. Nothing
else: @ mentions were only ever mounted in the deleted screenplay editor,
the research board's add buttons are a visible pill row, and the Draft
Table's method picker already has a welcome overlay.

One hint at a time, ordered, so no component needs to know about any other."
```

---

## Task 5: Show the hints

**Files:**
- Create: `src/components/ui/HintBubble.tsx`, `src/components/ui/HintBubble.module.css`
- Modify: `src/components/editor/WritingDesk.tsx`
- Modify: `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`
- Modify: `src/components/management/Bookshelf.tsx`

JSX only. Verification is manual.

- [ ] **Step 1: Write the bubble**

Create `src/components/ui/HintBubble.tsx`:

```tsx
"use client";

import React from 'react';
import { X } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { nextHintFor, HINTS_ALL_DISMISSED, type HintSurface } from '@/lib/hints';
import styles from './HintBubble.module.css';

interface HintBubbleProps {
    surface: HintSurface;
}

/**
 * One dismissible hint, or nothing. Mounted on each surface that has something
 * to teach; src/lib/hints.ts decides which of them is allowed to render, so
 * two bubbles cannot appear at once.
 */
export function HintBubble({ surface }: HintBubbleProps) {
    const hasOnboarded = useWorkspaceStore(s => s.hasOnboarded);
    const dismissedHints = useWorkspaceStore(s => s.dismissedHints);
    const dismissHint = useWorkspaceStore(s => s.dismissHint);

    const hint = nextHintFor(surface, dismissedHints, { hasOnboarded });
    if (!hint) return null;

    return (
        <aside className={styles.bubble} role="note" aria-label="Tip">
            <div className={styles.head}>
                <span className={styles.title}>{hint.title}</span>
                <button
                    className={styles.close}
                    onClick={() => dismissHint(hint.id)}
                    aria-label={`Dismiss tip: ${hint.title}`}
                >
                    <X size={13} aria-hidden="true" />
                </button>
            </div>
            <p className={styles.body}>{hint.body}</p>
            <button
                className={styles.optOut}
                onClick={() => dismissHint(HINTS_ALL_DISMISSED)}
            >
                Don&apos;t show tips
            </button>
        </aside>
    );
}
```

- [ ] **Step 2: Style it**

Create `src/components/ui/HintBubble.module.css`:

```css
.bubble {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 70;
  width: min(360px, calc(100% - 36px));
  padding: 13px 15px 11px;
  border-radius: 12px;
  border: 1px solid rgba(var(--overlay-rgb), 0.16);
  background: var(--surface-mid);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.34);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--foreground);
}

.close {
  flex: none;
  display: flex;
  padding: 3px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--muted);
  cursor: pointer;
}

.close:hover { color: var(--foreground); }

.close:focus-visible,
.optOut:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.body {
  margin: 5px 0 9px;
  font-size: 0.76rem;
  line-height: 1.55;
  color: var(--muted);
}

.optOut {
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 0.7rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.optOut:hover { color: var(--foreground); }
```

The bubble is `position: absolute`, so each host must be a positioned ancestor. All three are: `.deskViewport`, the writing zone wrapper and the Bookshelf root. Confirm in step 6 if any bubble lands in the wrong place.

- [ ] **Step 3: Mount the desk hint**

In `src/components/editor/WritingDesk.tsx`, add the import beside the other component imports:

```typescript
import { HintBubble } from '@/components/ui/HintBubble';
```

Then inside `<div ref={viewportRef} className={styles.deskViewport} …>`, immediately after the `{isResearch && widgets.length === 0 && (…)}` empty-hint block (which ends on line 644), add:

```tsx
        {!isResearch && <HintBubble surface="desk" />}
```

The research board has no writing column and its cards come from labelled buttons, so neither desk hint applies there.

- [ ] **Step 4: Mount the editor hint**

In `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`, add the import:

```typescript
import { HintBubble } from '@/components/ui/HintBubble';
```

Render `<HintBubble surface="editor" />` as the last child of the zone's outermost wrapper element in the component's `return`. It must sit inside an element with `position: relative` or `absolute` — if the bubble ends up pinned to the viewport instead of the zone, add `position: relative` to that wrapper's class in `WritingDesk.module.css` rather than moving the bubble.

- [ ] **Step 5: Mount the bookshelf hint**

In `src/components/management/Bookshelf.tsx`, add the import and render `<HintBubble surface="bookshelf" />` as the last child of the component's outermost `<div>` — the one whose closing tag is the final `</div>` before the component's closing brace.

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: all three clean.

- [ ] **Step 7: Manual verification**

Start from a workspace that has finished first run and has at least one book. In the browser console, run `localStorage.getItem('lorecanvas-workspace')` and confirm `dismissedHints` is `[]`; if not, reset it by dismissing nothing and clearing storage, then redo Task 3's step 10.2.

1. **One at a time, in order.** Open the Writing Desk. The "Drag out a space" bubble appears at the bottom centre of the canvas. No other bubble is on screen. Switch to the Bookshelf — no bubble there yet.
2. **It advances.** Dismiss it with the ✕. The bubble is immediately replaced by "The column is yours to size". Dismiss that too — the desk now shows no bubble, and the writing zone shows "Link people and places as you write".
3. **It reaches the Bookshelf.** Dismiss the editor hint, then open the Bookshelf. "Books move between shelves" appears. Dismiss it. No bubble appears anywhere in the app from here on.
4. **Dismissals survive a reload.** Reload the page and walk the desk, the editor and the Bookshelf again. No bubbles.
5. **Opt-out works.** Clear storage, redo first run, and on the first bubble click "Don't show tips" instead of ✕. No bubble appears on any surface, then or after a reload.
6. **No bubble during first run.** Clear storage and reload to the first-run panel. There is no bubble anywhere, including if you navigate to the Bookshelf without creating a book.
7. **The hints are true.** Follow each one literally and confirm it works: drag a box on the desk canvas and the widget picker opens; drag the writing column's left edge and it resizes; type `[[` in a scene and the article linker opens; drag a book onto another shelf and it re-files. **If any hint's instruction does not work, fix the hint text, not the feature** — except `[[`, which is Phase 4's and must work.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: one dismissible hint at first contact with each invisible feature

Mounted on the desk, in the writing zone and on the Bookshelf. The
catalogue decides which one may render, so exactly one bubble is on screen
at any time and none at all during first run. Closing one advances to the
next; 'Don't show tips' ends them permanently."
```

---

## Task 6: What changed while you were away

**Files:**
- Create: `src/lib/sinceLastVisit.ts`
- Create: `src/lib/sinceLastVisit.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/home/HomePage.tsx`, `src/components/home/HomePage.module.css`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sinceLastVisit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
    ABSENCE_THRESHOLD_MS,
    MAX_DIGEST_ITEMS,
    summarizeSinceLastVisit,
} from './sinceLastVisit';

const NOW = new Date('2026-09-03T12:00:00.000Z');
const LAST_WEEK = '2026-08-27T12:00:00.000Z';

function input(over: Partial<Parameters<typeof summarizeSinceLastVisit>[0]> = {}) {
    return {
        projects: [{ id: 'p1', name: 'The Long Winter' }],
        documents: [],
        scenes: [],
        entities: [],
        writingDays: [],
        ...over,
    };
}

describe('summarizeSinceLastVisit', () => {
    it('returns null on a first ever visit', () => {
        expect(summarizeSinceLastVisit(input(), null, NOW)).toBeNull();
    });

    it('returns null for an unparseable stamp', () => {
        expect(summarizeSinceLastVisit(input(), 'yesterday', NOW)).toBeNull();
    });

    it('returns null when the writer has barely been away', () => {
        const anHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
        expect(summarizeSinceLastVisit(input(), anHourAgo, NOW)).toBeNull();
    });

    it('returns a digest once the absence passes the threshold', () => {
        const justOver = new Date(NOW.getTime() - ABSENCE_THRESHOLD_MS - 1000).toISOString();
        const digest = summarizeSinceLastVisit(input(), justOver, NOW);
        expect(digest).not.toBeNull();
        expect(digest!.awayMs).toBeGreaterThan(ABSENCE_THRESHOLD_MS);
    });

    it('lists scenes, chapters and articles touched during the absence', () => {
        const digest = summarizeSinceLastVisit(input({
            documents: [{
                id: 'd1', projectId: 'p1', title: 'Chapter 4',
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-09-01T09:00:00.000Z',
            }],
            scenes: [{
                id: 's1', projectId: 'p1', title: 'The Sinks',
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-09-02T09:00:00.000Z',
            }],
            entities: [{
                id: 'e1', name: 'Veldrath',
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-08-30T09:00:00.000Z',
            }],
        }), LAST_WEEK, NOW);

        expect(digest!.sceneCount).toBe(1);
        expect(digest!.chapterCount).toBe(1);
        expect(digest!.articleCount).toBe(1);
        expect(digest!.items.map(i => i.title))
            .toEqual(['The Sinks', 'Chapter 4', 'Veldrath']);
    });

    it('names the project each item belongs to', () => {
        const digest = summarizeSinceLastVisit(input({
            scenes: [{
                id: 's1', projectId: 'p1', title: 'The Sinks',
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-09-02T09:00:00.000Z',
            }],
        }), LAST_WEEK, NOW);
        expect(digest!.items[0].projectName).toBe('The Long Winter');
    });

    it('ignores anything untouched since the last visit', () => {
        const digest = summarizeSinceLastVisit(input({
            scenes: [{
                id: 's1', projectId: 'p1', title: 'Old Scene',
                createdAt: '2026-08-01T00:00:00.000Z',
                updatedAt: '2026-08-02T00:00:00.000Z',
            }],
        }), LAST_WEEK, NOW);
        expect(digest!.items).toEqual([]);
        expect(digest!.sceneCount).toBe(0);
    });

    it('falls back to createdAt for a record never updated', () => {
        const digest = summarizeSinceLastVisit(input({
            scenes: [{
                id: 's1', projectId: 'p1', title: 'Brand New',
                createdAt: '2026-09-02T09:00:00.000Z',
            }],
        }), LAST_WEEK, NOW);
        expect(digest!.items.map(i => i.title)).toEqual(['Brand New']);
    });

    it('caps the list but not the counts', () => {
        const scenes = Array.from({ length: 9 }, (_, i) => ({
            id: `s${i}`, projectId: 'p1', title: `Scene ${i}`,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: new Date(Date.UTC(2026, 8, 1, i)).toISOString(),
        }));
        const digest = summarizeSinceLastVisit(input({ scenes }), LAST_WEEK, NOW)!;
        expect(digest.items).toHaveLength(MAX_DIGEST_ITEMS);
        expect(digest.sceneCount).toBe(9);
    });

    it('totals the words written on days after the last visit', () => {
        const digest = summarizeSinceLastVisit(input({
            writingDays: [
                { date: '2026-08-27', wordsWritten: 999 }, // the day they left
                { date: '2026-08-28', wordsWritten: 400 },
                { date: '2026-09-01', wordsWritten: 250 },
            ],
        }), LAST_WEEK, NOW)!;
        expect(digest.wordsWritten).toBe(650);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/sinceLastVisit.test.ts`

Expected: FAIL — `Failed to resolve import "./sinceLastVisit"`.

- [ ] **Step 3: Write the leaf module**

Create `src/lib/sinceLastVisit.ts`:

```typescript
/**
 * What changed while you were away — LEAF MODULE (no store, no React import).
 *
 * Coming back to a manuscript after a fortnight is the hardest moment in the
 * whole job: you have lost the thread and the app has always greeted you
 * exactly as it greeted you yesterday. Every timestamp needed to fix that is
 * already recorded — updateProject, updateDocument, updateScene and
 * updateEntity all stamp updatedAt — so this is arithmetic, not new tracking.
 *
 * Only for a real absence. A digest of what you did twenty minutes ago is
 * noise, so anything under ABSENCE_THRESHOLD_MS reports nothing at all.
 */

import { dateKey } from './homeStats';

/** Under this, the writer has not really been away. Twenty hours. */
export const ABSENCE_THRESHOLD_MS = 20 * 60 * 60 * 1000;

/** The digest names a few things and counts the rest. */
export const MAX_DIGEST_ITEMS = 5;

export type ChangedKind = 'scene' | 'chapter' | 'article';

export interface ChangedItem {
    kind: ChangedKind;
    id: string;
    title: string;
    /** null for lore, which belongs to a world rather than to one book. */
    projectName: string | null;
    /** Epoch ms of the change. */
    at: number;
}

export interface AbsenceInput {
    projects: { id: string; name: string }[];
    documents: { id: string; projectId: string; title: string; createdAt: Date | string; updatedAt?: Date | string }[];
    scenes: { id: string; projectId: string; title: string; createdAt: Date | string; updatedAt?: Date | string }[];
    entities: { id: string; name: string; createdAt: Date | string; updatedAt?: Date | string }[];
    writingDays: { date: string; wordsWritten: number }[];
}

export interface AbsenceDigest {
    awayMs: number;
    /** Newest first, capped at MAX_DIGEST_ITEMS. */
    items: ChangedItem[];
    sceneCount: number;
    chapterCount: number;
    articleCount: number;
    wordsWritten: number;
}

function toTime(v: Date | string | undefined): number {
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
}

/** When a record last changed: its update stamp, or its creation. */
function changedAt(r: { createdAt: Date | string; updatedAt?: Date | string }): number {
    return toTime(r.updatedAt) || toTime(r.createdAt);
}

/**
 * Everything touched between `since` and `now`, or null when there is nothing
 * worth saying: no previous visit, an unreadable stamp, or too short a gap.
 */
export function summarizeSinceLastVisit(
    input: AbsenceInput,
    since: string | null,
    now: Date,
): AbsenceDigest | null {
    if (!since) return null;
    const sinceMs = Date.parse(since);
    if (!Number.isFinite(sinceMs)) return null;

    const awayMs = now.getTime() - sinceMs;
    if (awayMs < ABSENCE_THRESHOLD_MS) return null;

    const projectName = (id: string) =>
        input.projects.find(p => p.id === id)?.name ?? null;

    const all: ChangedItem[] = [];

    for (const s of input.scenes) {
        const at = changedAt(s);
        if (at <= sinceMs) continue;
        all.push({ kind: 'scene', id: s.id, title: s.title, projectName: projectName(s.projectId), at });
    }
    for (const d of input.documents) {
        const at = changedAt(d);
        if (at <= sinceMs) continue;
        all.push({ kind: 'chapter', id: d.id, title: d.title, projectName: projectName(d.projectId), at });
    }
    for (const e of input.entities) {
        const at = changedAt(e);
        if (at <= sinceMs) continue;
        all.push({ kind: 'article', id: e.id, title: e.name, projectName: null, at });
    }

    all.sort((a, b) => b.at - a.at);

    // Words are recorded per calendar day, not per moment, so the day the
    // writer left is skipped rather than counted whole. A small undercount is
    // honest; counting the words they wrote before leaving is not.
    const leftOn = dateKey(new Date(sinceMs));
    const wordsWritten = input.writingDays
        .filter(d => d.date > leftOn)
        .reduce((n, d) => n + (d.wordsWritten || 0), 0);

    return {
        awayMs,
        items: all.slice(0, MAX_DIGEST_ITEMS),
        sceneCount: all.filter(i => i.kind === 'scene').length,
        chapterCount: all.filter(i => i.kind === 'chapter').length,
        articleCount: all.filter(i => i.kind === 'article').length,
        wordsWritten,
    };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/sinceLastVisit.test.ts`

Expected: PASS — 10 tests.

- [ ] **Step 5: Start the visit clock**

In `src/app/page.tsx`, add these two selectors beside the others:

```typescript
  const hasStoreHydrated = useWorkspaceStore((state) => state._hasHydrated);
  const markVisit = useWorkspaceStore((state) => state.markVisit);
```

and add this effect after the landing-view effect:

```typescript
  // Freeze what "last time" means for this page load. It has to wait for
  // hydration: before that, lastVisitAt is still the initial null and the
  // absence would be measured against nothing.
  useEffect(() => {
    if (hasStoreHydrated) markVisit();
  }, [hasStoreHydrated, markVisit]);
```

`markVisit` is a no-op after its first successful call, so a re-render cannot restart the clock mid-session.

- [ ] **Step 6: Show the digest on Home**

In `src/components/home/HomePage.tsx`, add:

```typescript
import { summarizeSinceLastVisit } from '@/lib/sinceLastVisit';
```

```typescript
  const previousVisitAt = useWorkspaceStore(s => s.previousVisitAt);
```

and, beside the other `useMemo` derivations:

```typescript
  const absence = useMemo(
    () => summarizeSinceLastVisit(
      { projects, documents, scenes, entities, writingDays },
      previousVisitAt,
      new Date(),
    ),
    [projects, documents, scenes, entities, writingDays, previousVisitAt],
  );
```

Then render this as the **first** child of `<section className={styles.bento}>`, before the Resume tile:

```tsx
          {absence && absence.items.length > 0 && (
            <div className={`${styles.tile} ${styles.tileAway}`}>
              <span className={styles.tileLabel}>
                <History size={14} /> While you were away
              </span>
              <p className={styles.awayLead}>
                You were gone {timeAgo(new Date(Date.now() - absence.awayMs)).replace(' ago', '')}.
                {absence.wordsWritten > 0
                  ? ` ${absence.wordsWritten.toLocaleString()} words landed before you went.`
                  : ''}
              </p>
              <ul className={styles.awayList}>
                {absence.items.map(item => (
                  <li key={`${item.kind}-${item.id}`} className={styles.awayItem}>
                    <span className={styles.awayKind}>{item.kind}</span>
                    <span className={styles.awayTitle}>{item.title}</span>
                    {item.projectName && (
                      <span className={styles.awayProject}>{item.projectName}</span>
                    )}
                  </li>
                ))}
              </ul>
              {resume && (
                <button className={styles.tileLink} onClick={resumeWriting}>
                  Back to {resume.label} <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
```

Add `History` to the existing `lucide-react` import.

- [ ] **Step 7: Style it**

Append to `src/components/home/HomePage.module.css`:

```css
.tileAway { grid-column: span 4; }

.awayLead {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--muted);
}

.awayList {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.awayItem {
  display: flex;
  align-items: baseline;
  gap: 9px;
  min-width: 0;
  font-size: 0.82rem;
}

.awayKind {
  flex: none;
  min-width: 62px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--muted);
}

.awayTitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--foreground);
}

.awayProject {
  flex: none;
  font-size: 0.7rem;
  color: var(--muted);
}
```

and add `.tileAway` to the two existing responsive overrides — `grid-column: span 2` in the `max-width` block at line 529, and `grid-column: span 1` in the block at line 536.

- [ ] **Step 8: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: all three clean.

- [ ] **Step 9: Manual verification**

The clock makes this awkward to test by waiting, so drive it from the console.

1. Open Home. There is **no** "While you were away" tile — this session started the clock and the previous stamp is either null or minutes old.
2. Edit a scene so something has a fresh `updatedAt`. Return to Home. Still no tile.
3. In the console, run:
   ```js
   const s = JSON.parse(localStorage.getItem('lorecanvas-workspace'));
   s.state.lastVisitAt = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString();
   localStorage.setItem('lorecanvas-workspace', JSON.stringify(s));
   ```
   Reload. Home now shows "While you were away", saying you were gone about 6 days, listing the scene you edited with its project name, and offering "Back to <chapter — scene>".
4. Click that button. It opens the right scene on the Writing Desk.
5. Navigate away from Home and back within the same session. The tile is still there — the stamp is frozen for the whole load, not recomputed.
6. Reload. The tile is **gone**: this load's `lastVisitAt` was written on the previous load, minutes ago.
7. Repeat step 3 with a 3-hour offset instead of 6 days. No tile — under the 20-hour threshold.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: Home remembers that you were away

Freezes the previous visit stamp once per page load and reports what
changed against it — scenes, chapters and articles touched, plus the words
that landed — with a way straight back to where the writing stopped.
Silent under twenty hours, because a digest of this morning is noise.

No new tracking: every timestamp it reads was already being stamped."
```

---

## Task 7: Measure the manuscript in its own units

**Files:**
- Create: `src/lib/structuralProgress.ts`
- Create: `src/lib/structuralProgress.test.ts`
- Modify: `src/components/home/HomePage.tsx`, `src/components/home/HomePage.module.css`
- Modify: `src/components/goals/GoalsContent.tsx`

Today the only measure of a book is words. `GoalsContent.tsx:360` divides a project's words by a hardcoded 50,000 and calls the result "% of a novel's length" — a number that says nothing about whether chapter nine exists. A story is built of chapters and scenes; that is the unit to report in.

- [ ] **Step 1: Write the failing test**

Create `src/lib/structuralProgress.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hasProse, projectProgress, progressLine } from './structuralProgress';

function scene(id: string, documentId: string, content: string, wordCount = 0) {
    return { id, projectId: 'p1', documentId, content, wordCount };
}

const documents = [
    { id: 'd1', projectId: 'p1' },
    { id: 'd2', projectId: 'p1' },
    { id: 'd3', projectId: 'p1' },
    { id: 'dX', projectId: 'p2' },
];

describe('hasProse', () => {
    it('is false for empty, whitespace and bare markup', () => {
        expect(hasProse('')).toBe(false);
        expect(hasProse('   ')).toBe(false);
        expect(hasProse('<p></p>')).toBe(false);
        expect(hasProse('<p><br></p>')).toBe(false);
        expect(hasProse('<p>&nbsp;</p>')).toBe(false);
    });

    it('is true once there are actual words', () => {
        expect(hasProse('<p>The tide came in.</p>')).toBe(true);
    });
});

describe('projectProgress', () => {
    it('reports zeroes for a project with nothing in it', () => {
        const p = projectProgress({ projectId: 'p1', documents: [], scenes: [] });
        expect(p).toEqual({
            chapters: 0, chaptersStarted: 0,
            scenes: 0, scenesStarted: 0,
            words: 0, fraction: 0,
        });
    });

    it('counts only this project\'s chapters and scenes', () => {
        const p = projectProgress({
            projectId: 'p1',
            documents,
            scenes: [
                scene('s1', 'd1', '<p>Words.</p>', 120),
                scene('sX', 'dX', '<p>Elsewhere.</p>', 900),
            ],
        });
        expect(p.chapters).toBe(3);
        expect(p.scenes).toBe(1);
        expect(p.words).toBe(120);
    });

    it('separates scenes that exist from scenes that have prose', () => {
        const p = projectProgress({
            projectId: 'p1',
            documents,
            scenes: [
                scene('s1', 'd1', '<p>Written.</p>', 100),
                scene('s2', 'd1', '<p></p>'),
                scene('s3', 'd2', '   '),
            ],
        });
        expect(p.scenes).toBe(3);
        expect(p.scenesStarted).toBe(1);
    });

    it('counts a chapter as started when any one of its scenes has prose', () => {
        const p = projectProgress({
            projectId: 'p1',
            documents,
            scenes: [
                scene('s1', 'd1', '<p>a</p>', 1),
                scene('s2', 'd1', ''),
                scene('s3', 'd2', '<p>b</p>', 1),
                scene('s4', 'd3', ''),
            ],
        });
        expect(p.chaptersStarted).toBe(2);
    });

    it('reports the fraction of scenes drafted', () => {
        const p = projectProgress({
            projectId: 'p1',
            documents,
            scenes: [
                scene('s1', 'd1', '<p>a</p>', 1),
                scene('s2', 'd1', '<p>b</p>', 1),
                scene('s3', 'd2', ''),
                scene('s4', 'd2', ''),
            ],
        });
        expect(p.fraction).toBe(0.5);
    });

    it('totals words from the counts the editor maintains', () => {
        const p = projectProgress({
            projectId: 'p1',
            documents,
            scenes: [scene('s1', 'd1', '<p>a</p>', 800), scene('s2', 'd2', '<p>b</p>', 450)],
        });
        expect(p.words).toBe(1250);
    });
});

describe('progressLine', () => {
    it('says so when there is nothing to measure', () => {
        expect(progressLine({
            chapters: 0, chaptersStarted: 0, scenes: 0, scenesStarted: 0, words: 0, fraction: 0,
        })).toBe('No scenes yet');
    });

    it('reads in scenes and chapters', () => {
        expect(progressLine({
            chapters: 7, chaptersStarted: 3, scenes: 21, scenesStarted: 8, words: 9000, fraction: 8 / 21,
        })).toBe('8 of 21 scenes drafted · 3 of 7 chapters started');
    });

    it('stays singular where singular is right', () => {
        expect(progressLine({
            chapters: 1, chaptersStarted: 1, scenes: 1, scenesStarted: 1, words: 300, fraction: 1,
        })).toBe('1 of 1 scene drafted · 1 of 1 chapter started');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/structuralProgress.test.ts`

Expected: FAIL — `Failed to resolve import "./structuralProgress"`.

- [ ] **Step 3: Write the leaf module**

Create `src/lib/structuralProgress.ts`:

```typescript
/**
 * A manuscript measured in its own units — LEAF MODULE (no store, no React).
 *
 * Words per day tells a writer whether they sat down. It does not tell them
 * whether the book exists. A story is built of chapters and scenes, so that is
 * what gets counted here: how many scenes have prose in them, and how many
 * chapters those scenes add up to.
 *
 * Word totals come from Scene.wordCount, which the editor writes on every
 * debounced save — no re-counting, and no dependence on the writingDays log,
 * which only knows about days the goals system was watching.
 */

export interface ProgressInput {
    projectId: string;
    documents: { id: string; projectId: string }[];
    scenes: { id: string; projectId: string; documentId: string; content: string; wordCount?: number }[];
}

export interface StructuralProgress {
    chapters: number;
    chaptersStarted: number;
    scenes: number;
    scenesStarted: number;
    words: number;
    /** Scenes with prose over scenes that exist. 0 when there are none. */
    fraction: number;
}

/** True when a scene holds words rather than empty editor markup. */
export function hasProse(content: string): boolean {
    if (!content) return false;
    return content
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim()
        .length > 0;
}

/** Chapter and scene counts for one project. */
export function projectProgress(input: ProgressInput): StructuralProgress {
    const docs = input.documents.filter(d => d.projectId === input.projectId);
    const scenes = input.scenes.filter(s => s.projectId === input.projectId);

    const startedDocIds = new Set<string>();
    let scenesStarted = 0;
    let words = 0;

    for (const s of scenes) {
        words += s.wordCount ?? 0;
        if (!hasProse(s.content)) continue;
        scenesStarted += 1;
        startedDocIds.add(s.documentId);
    }

    return {
        chapters: docs.length,
        chaptersStarted: docs.filter(d => startedDocIds.has(d.id)).length,
        scenes: scenes.length,
        scenesStarted,
        words,
        fraction: scenes.length > 0 ? scenesStarted / scenes.length : 0,
    };
}

const plural = (n: number, one: string) => (n === 1 ? one : `${one}s`);

/** One line a writer can read at a glance, in the unit the work uses. */
export function progressLine(p: StructuralProgress): string {
    if (p.scenes === 0) return 'No scenes yet';
    return `${p.scenesStarted} of ${p.scenes} ${plural(p.scenes, 'scene')} drafted`
        + ` · ${p.chaptersStarted} of ${p.chapters} ${plural(p.chapters, 'chapter')} started`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/structuralProgress.test.ts`

Expected: PASS — 3 suites, 12 tests.

- [ ] **Step 5: Add the manuscript tile to Home**

In `src/components/home/HomePage.tsx`, add:

```typescript
import { projectProgress, progressLine } from '@/lib/structuralProgress';
```

```typescript
  const manuscript = useMemo(
    () => (activeProject
      ? projectProgress({ projectId: activeProject.id, documents, scenes })
      : null),
    [activeProject, documents, scenes],
  );
```

Place it after the existing `activeProject` derivation, since it depends on it.

Then render this tile immediately after the Heatmap tile:

```tsx
          {/* Structural progress — the book measured in the unit it is built from */}
          <div className={`${styles.tile} ${styles.tileManuscript}`}>
            <div className={styles.tileHead}>
              <span className={styles.tileLabel}><BookOpen size={14} /> The manuscript</span>
              {manuscript && (
                <span className={styles.tileHint}>
                  {manuscript.words.toLocaleString()} words
                </span>
              )}
            </div>
            {manuscript ? (
              <>
                <p className={styles.manuscriptLine}>{progressLine(manuscript)}</p>
                <div className={styles.manuscriptTrack}>
                  <div
                    className={styles.manuscriptFill}
                    style={{ width: `${(manuscript.fraction * 100).toFixed(1)}%` }}
                  />
                </div>
                <p className={styles.tileFoot}>{activeProject!.name}</p>
              </>
            ) : (
              <p className={styles.tileEmpty}>Open a book to see how much of it exists.</p>
            )}
          </div>
```

`BookOpen` is already imported by this file.

- [ ] **Step 6: Style the tile**

Append to `src/components/home/HomePage.module.css`:

```css
.tileManuscript { grid-column: span 4; }

.manuscriptLine {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--foreground);
}

.manuscriptTrack {
  height: 7px;
  border-radius: 4px;
  background: rgba(var(--overlay-rgb), 0.12);
  overflow: hidden;
}

.manuscriptFill {
  height: 100%;
  border-radius: 4px;
  background: var(--accent);
  transition: width 260ms ease;
}
```

and add `.tileManuscript` to the same two responsive override lists as `.tileAway` — `span 2` in the block at line 529, `span 1` in the block at line 536.

- [ ] **Step 7: Replace the fake percentage in the Goals panel**

In `src/components/goals/GoalsContent.tsx`, add:

```typescript
import { projectProgress, progressLine } from '@/lib/structuralProgress';
```

and two selectors beside the existing ones at lines 146–151:

```typescript
    const documents = useWorkspaceStore(s => s.documents);
    const scenes = useWorkspaceStore(s => s.scenes);
```

Then inside the `projects.map` callback, replace line 360:

```typescript
                        const pct = Math.min(projectWords / 50000, 1) * 100;
```

with:

```typescript
                        const structure = projectProgress({
                            projectId: project.id, documents, scenes,
                        });
                        const pct = structure.fraction * 100;
```

and replace line 402:

```tsx
                                    {Math.round(pct)}% of a novel&apos;s length
```

with:

```tsx
                                    {progressLine(structure)}
```

Leave `projectWords` alone — it still feeds the milestone share button and the "N words" figure, both of which are honest about being word counts.

- [ ] **Step 8: Verify the build**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: all three clean.

- [ ] **Step 9: Manual verification**

1. Open a book with several chapters and scenes, some written and some empty. Go to Home. "The manuscript" tile names the open book, shows the total words, reads "N of M scenes drafted · N of M chapters started", and the bar matches that scene ratio.
2. Write a sentence into a previously empty scene, then return to Home. The drafted count has gone up by one, and the chapter count too if that scene was the first written one in its chapter.
3. Open the Writing Goals panel. Each project bar now reads in scenes and chapters instead of "% of a novel's length". The "N words" figure and the milestone arrow are unchanged.
4. Go to Home with no book open (clear the active project via the Bookshelf, or start from a workspace with no active project). The tile reads "Open a book to see how much of it exists." and does not error.
5. Narrow the browser to under 900px and then under 620px. The two new full-width tiles reflow with the rest of the bento; nothing overflows horizontally.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: measure a manuscript in scenes and chapters, not just words

The Goals panel divided a project's words by a hardcoded 50,000 and called
it '% of a novel's length' — a number that never says whether chapter nine
exists. Both it and a new Home tile now read in the unit the work is built
from: scenes drafted out of scenes that exist, chapters started out of
chapters that exist.

Word totals come from Scene.wordCount, which the editor already maintains,
rather than from the writingDays log, which only knows about days the goals
system was watching."
```

---

## Task 8: Regression and smoke

**Files:** none

- [ ] **Step 1: Full check**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src
npm run build
```

Expected: all four clean.

- [ ] **Step 2: Confirm the leaf rule held**

```bash
grep -n "workspaceStore\|from 'react'\|from \"react\"" \
  src/lib/onboarding.ts src/lib/newStory.ts src/lib/hints.ts \
  src/lib/sinceLastVisit.ts src/lib/structuralProgress.ts
```

Expected: no output. A hit means a leaf module reached into the store or React and its tests are no longer trustworthy in isolation.

- [ ] **Step 3: Confirm every new module is actually tested**

```bash
for f in onboarding newStory hints sinceLastVisit structuralProgress; do
  echo "== $f: $(ls src/lib/$f.test.ts 2>/dev/null | wc -l)"
done
ls src/store/onboardingState.test.ts
```

Expected: `1` for all five, and the store test present.

- [ ] **Step 4: Confirm no `.test.tsx` crept in**

```bash
git diff --name-only main...HEAD | grep '\.test\.tsx$'
```

Expected: no output. `vitest.config.ts` would never run such a file.

- [ ] **Step 5: End-to-end smoke, as a new writer**

Clear storage and walk the whole arc in one sitting:

1. Land on Home → the first-run screen, not the dashboard.
2. Name a book, pick **Start Writing** → the Writing Desk opens on Chapter 1 / Scene 1.
3. The "Drag out a space" hint is showing. Dismiss it; "The column is yours to size" replaces it. Dismiss that.
4. Type a paragraph into the scene. The `[[` hint appears in the writing zone. Type `[[` and confirm the article linker opens. Dismiss the hint.
5. Go to the Bookshelf. The "Books move between shelves" hint appears. Dismiss it.
6. Go to Home. The bento dashboard shows, with "The manuscript" reading 1 of 1 scene drafted, 1 of 1 chapter started, and today's words on the goal ring.
7. Reload. No hints, no first-run screen, no "While you were away".
8. Force an absence with the console snippet from Task 6 step 9.3 and reload. The digest names the scene you wrote and offers a way back into it.

- [ ] **Step 6: Commit anything the smoke test corrected**

```bash
git add -A
git commit -m "fix: Phase 7 smoke-test corrections"
```

Skip this step if nothing changed.

---

## Definition of done

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green, including 5 new leaf-module suites and the store persistence suite
- [ ] `npx eslint src` clean
- [ ] `npm run build` succeeds
- [ ] No `.test.tsx` file was added
- [ ] No leaf module imports the store or React
- [ ] `hasOnboarded`, `dismissedHints` and `lastVisitAt` are all in `partializeWorkspace` and in no separate `localStorage` key
- [ ] A workspace with no books shows the first-run screen on Home; one with books never does
- [ ] Creating a book, importing one, loading the example world, or clicking "I'll look around first" all end first run
- [ ] The three intents render identically in the Bookshelf wizard and on Home, from one component
- [ ] Exactly four hints exist, they appear one at a time in order, and none appears during first run
- [ ] Every hint's instruction is literally true when followed
- [ ] "Don't show tips" silences all of them permanently
- [ ] Home shows an absence digest after 20+ hours away and nothing under it
- [ ] The digest stays put for a whole session and is gone on the next load
- [ ] Home and the Goals panel both report scenes and chapters; "% of a novel's length" appears nowhere
- [ ] `grep -rn "AI assistant\|research assistant\|The assistant can read" src` returns nothing

---

## What this phase deliberately did not do

Stated so the gaps are not mistaken for oversights.

- **No tour, no docs site, no help menu.** Four hints and one front door.
- **No hint for ⌘K, ⌘E or canvas zoom.** Each duplicates something already visible.
- **No settings control to replay hints.** If a writer wants them back, `dismissedHints` is one line of the persisted blob. Add the control only if someone asks for it.
- **Roadmap item `13`** — a permanent visible resize affordance on the writing column — stays in Phase 9. The `writing-column-resize` hint teaches the feature; it does not replace the affordance. When Phase 9 lands, delete that hint from `HINTS` and the two tests that name it.
