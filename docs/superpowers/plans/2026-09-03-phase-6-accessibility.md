# Phase 6 — Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LoreCanvas operable and legible without a mouse or a screen. Twenty-one dialogs gain real dialog semantics and Escape, and all twenty-four gain a focus trap; the app gains its first live regions, so a save, a word count and an export result are spoken rather than merely drawn; the page chrome leaves `<main>` and a skip link jumps past it; and the last thirteen nameless controls get names.

**Architecture:** Two shared pieces carry almost all of the work, so the twenty-four dialog fixes are three added attributes and one hook call each rather than twenty-four bespoke implementations.

- `src/lib/focusTrap.ts` — a LEAF MODULE holding the only part of a focus trap that is arithmetic rather than DOM: where Tab lands next. Unit-tested.
- `src/lib/useModalDialog.ts` — the React layer over it. Focus in on open, Tab cycles inside, Escape closes, focus returns on close, and a module-level stack so only the topmost dialog reacts to Escape. It sits in `src/lib/` beside the existing `useWritingSession.ts`, which sets that precedent; it is **not** a leaf module and does not claim to be.
- `src/lib/liveAnnouncer.ts` — a LEAF MODULE holding the announcement queue: dedupe, coalescing, expiry, and the invisible marker that makes a repeated message a genuine text change. Unit-tested.
- `src/components/a11y/LiveRegion.tsx` — two `aria-live` regions mounted once in the root layout, fed by the queue.

Order matters for two reasons. The shared hook has to exist before any dialog can call it, so Task 1 is infrastructure with no user-visible change; **item `2c` is Task 2**, the first behaviour change in the phase, because the work-type modal gates every creation in the app. And every task ends with a green `tsc`, so the build is never broken across more than one task.

**Tech Stack:** TypeScript (strict), React 19.2.3, Next 16, Zustand, Vitest 3 (jsdom).

**Depends on:** Phases 1–5. This plan assumes one work type (`'story'`), no AI anywhere, and `InterviewRunner` shipped by Phase 5.

**Note on the test runner:** `vitest.config.ts` includes only `src/**/*.test.ts` — **not** `.test.tsx`. Component tests do not run. Every test in this plan is a `.test.ts` against a pure module. Every JSX/ARIA change is verified instead by an explicit keyboard or screen-reader step written into the task.

**Note on line numbers:** every path and line below was read from the working tree on this branch. Phases 1–5 shift some of them. Each edit therefore quotes the exact code it is anchored to — match on the code, not on the number.

---

## What is already done — do not redo it

Verified in the tree before this plan was written.

| Claim in the roadmap | Actual state | Evidence |
|---|---|---|
| `18` "the remaining dialogs" need `role="dialog"` | **Three of twenty-four already have it.** Two are correct today — full semantics, accessible name and Escape — and Phase 5's `InterviewRunner` ships correct. All three still lack a focus trap, which nothing in this app has | `src/components/home/GoalScheduleModal.tsx:66–76`, `src/app/welcome/themes/standard/RequestAccessModal.tsx:43–48`, and `2026-09-03-phase-5-lore-without-ai.md` Task 11 |
| `2d` "ZERO `aria-live` / `role="status"` / `role="alert"` / `<output>` in the entire product" | **False — two exist.** Neither covers saving, word counts or exports, so the substance of the item stands, but the count does not | `src/components/layout/ErrorBoundary.tsx:47` (`role="alert"`), `src/components/management/WorldBibleBook.tsx:125` (`aria-live="polite"`) |
| `19` "name the remaining unnamed controls" | Most already landed on this branch — every form field in the World Bible, the Bookshelf wizard and the article link picker has a `htmlFor`/`useId` pair, and every dialog close button already carries `aria-label` | commits `ed4d367`, `eb1950c`, `d7c881f`, `918c2d8` |
| Focus rings | Already global and correct — `:focus-visible` with a `:focus:not(:focus-visible)` reset | `src/app/globals.css`, "Focus" block |
| Hit targets | Already a global `.hit-target` utility | `src/app/globals.css`, "Hit areas" block |
| Decorative shader canvas | Already `aria-hidden="true"` | `src/components/theme/DeskLighting.tsx:302` |
| `InlineEntryCreator` focus handling | Already focuses its first input on open and returns focus to the editor on close. It still needs dialog semantics and Escape | `src/components/world/InlineEntryCreator.tsx:32–37, 49–53` |

**Excluded with cause:** `src/components/navigation/ProjectSwitcher.tsx` renders a backdrop dialog but **nothing mounts it** — `grep -rn "ProjectSwitcher" src` outside its own file returns nothing. It is dead code, not an accessibility defect. Leave it; it belongs to a dead-code sweep, not to this phase.

---

## The dialog inventory

Twenty-four overlay dialogs exist after Phases 1–5 — twenty-three in the tree today, plus `InterviewRunner`, which Phase 5 adds. Each row was checked for `role="dialog"`, `aria-modal`, an accessible name, focus entry, a focus trap and Escape. **Not one of the twenty-four traps focus or restores it**, including the three that already have correct semantics.

| # | Dialog | File and anchor | `role` | Name | Escape | Task |
|---|---|---|---|---|---|---|
| 1 | **New work** (type → name → begin) | `Bookshelf.tsx:696` `styles.wizardBackdrop` under `{isStoryModalOpen && (` | no | no | **no** | 2 |
| 2 | Shelf wizard | `Bookshelf.tsx:546` under `{isWizardOpen && (` | no | no | yes | 3 |
| 3 | Delete book confirm | `Bookshelf.tsx:829` under `{deletingProjectId && (` | no | no | yes | 3 |
| 4 | Delete shelf confirm | `Bookshelf.tsx:849` under `{deletingWorldId && (` | no | no | yes | 3 |
| 5 | Export | `ui/ExportModal.tsx:91` | no | no | **no** | 4 |
| 6 | Settings | `ui/SettingsModal.tsx:108` | no | no | **no** | 4 |
| 7 | Share Milestone | `ui/ShareModal.tsx:106` | no | no | **no** | 4 |
| 8 | Sign in | `ui/LoginModal.tsx:66` | no | no | **no** | 4 |
| 9 | Import | `ui/ImportModal.tsx:304` | no | no | **no** | 4 |
| 10 | New Project | `ui/NewProjectModal.tsx:93` | no | no | yes | 4 |
| 11 | Your Library | `ui/ProjectLibraryModal.tsx:49` | no | no | **no** | 4 |
| 12 | Project Settings | `ui/ProjectSettingsModal.tsx:74` | no | no | **no** | 4 |
| 13 | Method Library | `desk/MethodLibrary.tsx:63` | no | no | yes | 5 |
| 14 | `ConfirmDialog` | `desk/MethodLibrary.tsx:180` | no | no | yes¹ | 5 |
| 15 | Method Finder | `desk/MethodFinder.tsx:64` | no | no | yes | 5 |
| 16 | Draft Export | `desk/DraftExport.tsx:163` | no | no | yes | 5 |
| 17 | Command Palette | `navigation/CommandPalette.tsx:167` | no | no | partial² | 6 |
| 18 | New World Entry | `world/InlineEntryCreator.tsx:100` | no | no | **no** | 6 |
| 19 | Edit Entity | `world/EntityDetailPanel.tsx:115` | no | no | yes | 6 |
| 20 | Entity Not Found | `world/EntityDetailPanel.tsx:74` | no | no | yes | 6 |
| 21 | Interview editor | `research/InterviewEditorModal.tsx:89` | no | no | **no** | 6 |
| 22 | Interview runner | `research/InterviewRunner.tsx` (Phase 5) | **yes** | **yes** | **no** | 6 |
| 23 | Scheduled goals | `home/GoalScheduleModal.tsx:71` | **yes** | **yes** | **yes** | 6 — trap only |
| 24 | Request access | `welcome/…/RequestAccessModal.tsx:46` | **yes** | **yes** | **yes** | 6 — trap only |

Rows 22–24 already carry `role`, `aria-modal` and a name; leave those alone. They still need the trap, because focus has never been held inside any dialog in this app.

¹ `ConfirmDialog` and `MethodLibrary` **both** add a `window` keydown listener (`MethodLibrary.tsx:48` and `:174`). With the confirm open on top of the library, one Escape closes both. The stack in `useModalDialog` is what fixes this.

² `CommandPalette.tsx:147` is a React `onKeyDown` on the search input only. Escape works while the input holds focus and nowhere else.

---

## File Structure

**Created:**

| Path | What |
|------|------|
| `src/lib/focusTrap.ts` | LEAF MODULE — Tab arithmetic and the focusable selector |
| `src/lib/focusTrap.test.ts` | 9 unit tests |
| `src/lib/useModalDialog.ts` | React hook — focus in, trap, Escape, restore, nesting stack |
| `src/lib/liveAnnouncer.ts` | LEAF MODULE — announcement queue and the subscribe/announce bus |
| `src/lib/liveAnnouncer.test.ts` | 11 unit tests |
| `src/components/a11y/LiveRegion.tsx` | The two live regions, mounted once |

**Modified:**

| Path | Change |
|------|--------|
| `src/app/layout.tsx` | Mounts `<LiveRegion />` |
| `src/app/globals.css` | Adds the global `.sr-only` utility |
| `src/app/page.tsx` | `<main>` narrows to the editor column; `ModeBar` and the panels move out; skip link added |
| `src/app/page.module.css` | Adds `.skipLink` |
| `src/components/management/Bookshelf.tsx` | Four dialogs; the ad-hoc Escape effect goes |
| `src/components/ui/` — 8 files | Dialog semantics |
| `src/components/editor/desk/MethodLibrary.tsx`, `MethodFinder.tsx`, `DraftExport.tsx` | Dialog semantics; ad-hoc Escape effects go |
| `src/components/navigation/CommandPalette.tsx`, `ModeBar.tsx` | Dialog semantics; one control named |
| `src/components/world/InlineEntryCreator.tsx`, `EntityDetailPanel.tsx`, `ArticleGridEditor.tsx` | Dialog semantics; announcements; one control named |
| `src/components/editor/research/InterviewEditorModal.tsx` | Dialog semantics; five controls named |
| `src/components/editor/research/InterviewRunner.tsx` | Focus trap; backdrop marked; close button named. Semantics already correct from Phase 5 |
| `src/components/home/GoalScheduleModal.tsx` | Focus trap only — semantics already correct |
| `src/app/welcome/themes/standard/RequestAccessModal.tsx` | Focus trap only — semantics already correct |
| `src/components/editor/WritingDesk.tsx` | Announcement on save; three controls named |
| `src/components/editor/desk/BookViewEditor.tsx` | Two controls named |
| `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx` | Announcement on save; two controls named |
| `src/components/editor/desk/widgets/RelationshipMapRenderer.tsx`, `StickyNoteRenderer.tsx` | Two controls named |
| `src/components/world/article-grid/widgets/OrgChartWidget.tsx`, `SceneCardWidget.tsx` | Two controls named |
| `src/components/ui/ExportModal.tsx` | Announcements on export success and failure |

---

## Task 1: The focus-trap leaf module and the dialog hook

**Files:**
- Create: `src/lib/focusTrap.ts`
- Create: `src/lib/focusTrap.test.ts`
- Create: `src/lib/useModalDialog.ts`

No component changes here — nothing renders differently at the end of this task. It exists so Tasks 2–6 are three attributes and one hook call each.

- [ ] **Step 1: Write the failing test**

Create `src/lib/focusTrap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { FOCUSABLE_SELECTOR, initialTrapIndex, nextTrapIndex } from './focusTrap';

describe('nextTrapIndex', () => {
    it('steps forward through the middle of the list', () => {
        expect(nextTrapIndex(5, 2, false)).toBe(3);
    });

    it('steps backward through the middle of the list', () => {
        expect(nextTrapIndex(5, 2, true)).toBe(1);
    });

    it('wraps forward from the last element to the first', () => {
        expect(nextTrapIndex(5, 4, false)).toBe(0);
    });

    it('wraps backward from the first element to the last', () => {
        expect(nextTrapIndex(5, 0, true)).toBe(4);
    });

    it('pulls focus in from outside the dialog to the first element', () => {
        expect(nextTrapIndex(5, -1, false)).toBe(0);
    });

    it('pulls focus in from outside backwards to the last element', () => {
        expect(nextTrapIndex(5, -1, true)).toBe(4);
    });

    it('returns -1 when the dialog has nothing focusable', () => {
        expect(nextTrapIndex(0, -1, false)).toBe(-1);
        expect(nextTrapIndex(0, 3, true)).toBe(-1);
    });
});

describe('initialTrapIndex', () => {
    it('honours an element the dialog marked as its own first stop', () => {
        expect(initialTrapIndex(4, 2)).toBe(2);
    });

    it('falls back to the first element when nothing is marked, or the mark is stale', () => {
        expect(initialTrapIndex(4, -1)).toBe(0);
        expect(initialTrapIndex(4, 9)).toBe(0);
        expect(initialTrapIndex(0, -1)).toBe(-1);
    });
});

describe('FOCUSABLE_SELECTOR', () => {
    it('excludes disabled controls and tabindex="-1"', () => {
        expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
        expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/focusTrap.test.ts`

Expected: FAIL — `Failed to resolve import "./focusTrap"`.

- [ ] **Step 3: Write the leaf module**

Create `src/lib/focusTrap.ts`:

```typescript
/**
 * Focus-trap ordering. LEAF MODULE (no store, no React).
 *
 * The DOM half of a focus trap — querying, focusing, restoring — belongs in a
 * hook. The half worth testing is arithmetic: given how many focusable
 * elements a dialog has and which one holds focus, where does Tab go next?
 * That is here, and it is pure.
 */

/** Everything a dialog can put focus on, matched in DOM order. */
export const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Index Tab (or Shift+Tab) should land on.
 *
 * `current` is -1 when focus is outside the dialog, which is how focus escaping
 * gets pulled back in. Returns -1 when there is nothing focusable at all; the
 * caller treats that as "focus the dialog container itself".
 */
export function nextTrapIndex(count: number, current: number, backwards: boolean): number {
    if (count <= 0) return -1;
    if (current < 0 || current >= count) return backwards ? count - 1 : 0;
    const next = backwards ? current - 1 : current + 1;
    if (next < 0) return count - 1;
    if (next >= count) return 0;
    return next;
}

/**
 * Index to focus when the dialog opens. `autoFocusIndex` is the position of an
 * element the dialog marked as its own first stop, or -1 if it named none.
 */
export function initialTrapIndex(count: number, autoFocusIndex: number): number {
    if (count <= 0) return -1;
    if (autoFocusIndex >= 0 && autoFocusIndex < count) return autoFocusIndex;
    return 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/focusTrap.test.ts`

Expected: PASS — 10 tests.

- [ ] **Step 5: Write the React layer**

Create `src/lib/useModalDialog.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef } from 'react';
import { FOCUSABLE_SELECTOR, initialTrapIndex, nextTrapIndex } from './focusTrap';

/**
 * Everything a modal dialog owes the keyboard, in one hook: focus moves in on
 * open, Tab cycles inside instead of walking the page behind, Escape closes,
 * and focus returns to whatever opened it.
 *
 * Nesting is why the Escape listener is stack-aware rather than per-component.
 * MethodLibrary and its ConfirmDialog each added their own window listener, so
 * a single Escape over the confirm closed the library underneath it too.
 *
 * Give the dialog element `tabIndex={-1}` so there is somewhere to put focus
 * when it contains no focusable control, and `data-autofocus` on any control
 * that should be the first stop.
 *
 * Sits in src/lib beside useWritingSession.ts, which set that precedent. It
 * imports React, so it is deliberately NOT a leaf module — the pure part it
 * calls is focusTrap.ts.
 */

/** Open dialogs, innermost last. Only the last one answers Escape and Tab. */
const openDialogs: symbol[] = [];

export function useModalDialog<T extends HTMLElement>(onClose: () => void) {
    const ref = useRef<T>(null);

    // Held in a ref so a dialog that rebuilds its onClose every render does not
    // tear down and re-run the whole effect, stealing focus back on each keystroke.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const focusables = useCallback((): HTMLElement[] => {
        const root = ref.current;
        if (!root) return [];
        return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
            // getClientRects() rather than offsetParent: dialogs are usually
            // position:fixed, for which offsetParent is null even when visible.
            .filter(el => el.getClientRects().length > 0);
    }, []);

    useEffect(() => {
        const token = Symbol('dialog');
        openDialogs.push(token);

        const root = ref.current;
        const restoreTo = document.activeElement as HTMLElement | null;

        const items = focusables();
        const marked = items.findIndex(el => el.hasAttribute('data-autofocus'));
        const index = initialTrapIndex(items.length, marked);
        if (index >= 0) items[index].focus();
        else root?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (openDialogs[openDialogs.length - 1] !== token) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab') return;

            const current = focusables();
            if (current.length === 0) return;
            e.preventDefault();
            const at = current.indexOf(document.activeElement as HTMLElement);
            const to = nextTrapIndex(current.length, at, e.shiftKey);
            if (to >= 0) current[to].focus();
        };

        // Capture phase: the dialog gets Escape before any editor keymap does.
        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            const at = openDialogs.indexOf(token);
            if (at >= 0) openDialogs.splice(at, 1);
            restoreTo?.focus?.();
        };
    }, [focusables]);

    return ref;
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS. Nothing imports the hook yet, so the app is unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/lib/focusTrap.ts src/lib/focusTrap.test.ts src/lib/useModalDialog.ts
git commit -m "feat: a focus trap, and the arithmetic behind it

focusTrap.ts is the pure half — where Tab lands next — and is unit tested.
useModalDialog.ts is the DOM half: focus in, cycle, Escape, restore. Its
Escape listener is stack-aware because MethodLibrary and its ConfirmDialog
each had their own, and one Escape closed both."
```

---

## Task 2: `2c` — the work-type modal

**Files:**
- Modify: `src/components/management/Bookshelf.tsx`

Nothing is created in this app without passing through this modal. Today it has no `role`, no `aria-modal`, no accessible name, no focus entry, no Escape, and the page behind it stays in the tab order — reaching the modal's own first control takes 29 tab stops through the shelf underneath.

- [ ] **Step 1: Import the hook**

At `src/components/management/Bookshelf.tsx:3`, the import block already reads:

```typescript
import React, { useId, useState, useEffect } from 'react';
```

Add below the other `@/lib` imports (after line 10, `import { getDraftType } from '@/lib/writingMethods';`):

```typescript
import { useModalDialog } from '@/lib/useModalDialog';
```

- [ ] **Step 2: Extract the modal into its own component**

The hook's effect has to run when the dialog mounts, and the dialog is a conditional branch inside `Bookshelf`. Wrap it. At the bottom of `Bookshelf.tsx`, after the `Bookshelf` function, add:

```tsx
/**
 * A dialog shell: dialog semantics, focus trap, Escape, focus restore.
 * A component rather than a hook call inside Bookshelf, because the hook's
 * effect has to run on the dialog's OWN mount — Bookshelf itself is always
 * mounted, so a hook called there would fire once at page load.
 */
function ShelfDialog({
    labelledBy,
    onDismiss,
    children,
}: {
    labelledBy: string;
    onDismiss: () => void;
    children: React.ReactNode;
}) {
    const dialogRef = useModalDialog<HTMLDivElement>(onDismiss);
    return (
        <div className={styles.wizardBackdrop} onClick={onDismiss} role="presentation">
            <div
                ref={dialogRef}
                className={styles.wizardModal}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                tabIndex={-1}
            >
                {children}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Wrap the new-work modal**

At `Bookshelf.tsx:695`, replace the two opening lines:

```tsx
            {isStoryModalOpen && (
                <div className={styles.wizardBackdrop} onClick={() => setIsStoryModalOpen(false)}>
                    <div className={styles.wizardModal} onClick={e => e.stopPropagation()}>
```

with:

```tsx
            {isStoryModalOpen && (
                <ShelfDialog labelledBy={`${fieldId}-story-title`} onDismiss={() => setIsStoryModalOpen(false)}>
```

and the matching close, currently:

```tsx
                    </div>
                </div>
            )}

            {/* ─── DELETE CONFIRMATION MODAL (shared: book or shelf) ── */}
```

with:

```tsx
                </ShelfDialog>
            )}

            {/* ─── DELETE CONFIRMATION MODAL (shared: book or shelf) ── */}
```

- [ ] **Step 4: Give every step of the modal the same heading id**

The modal has three steps and a different `<h2>` in each. The `aria-labelledby` above points at one id, so all three headings carry it — only one is ever rendered.

At `Bookshelf.tsx:700`:

```tsx
<h2 id={`${fieldId}-story-title`} className={styles.wizardTitle}>What are you writing?</h2>
```

At `Bookshelf.tsx:721`:

```tsx
<h2 id={`${fieldId}-story-title`} className={styles.wizardTitle}>What kind of script or report?</h2>
```

At `Bookshelf.tsx:745`, the naming step's heading, add the same `id` to the existing opening tag:

```tsx
<h2 id={`${fieldId}-story-title`} className={styles.wizardTitle}>
```

> If Phase 1 removed the `'kind'` step along with sub-types, that middle heading no longer exists — skip it and edit the two that remain.

- [ ] **Step 5: Mark the first stop on the naming step**

The name input at `Bookshelf.tsx:759` already carries `autoFocus`. React's `autoFocus` and the hook's focus-in race each other. Replace `autoFocus` with `data-autofocus` so the hook is the single owner:

```tsx
                                        placeholder={getWorkType(storyTypeId)?.namePlaceholder}
                                        data-autofocus
                                    />
```

- [ ] **Step 6: Remove the two per-input Escape handlers the hook replaces**

At `Bookshelf.tsx:758`, the name input's `onKeyDown` becomes Enter-only:

```tsx
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') { e.preventDefault(); confirmCreateStory('template'); }
                                        }}
```

At `Bookshelf.tsx:777`, delete the brief field's handler entirely:

```tsx
                                                    onKeyDown={e => { if (e.key === 'Escape') setIsStoryModalOpen(false); }}
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit --pretty false && npm run build`

Expected: both clean.

- [ ] **Step 8: Manual keyboard verification**

Start the dev server. Go to the Bookshelf. **Do not touch the mouse after this point.**

1. Tab to any **New Book** button and press Enter.
2. **Focus must already be inside the dialog** — press Tab once and check the ring is on a control *inside* the modal, not on a shelf behind it. Before this task it took 29 presses to reach the first work-type card.
3. Tab repeatedly past the last control. Focus must **wrap to the first control in the dialog**, never onto the shelf underneath.
4. Shift+Tab from the first control must wrap to the last.
5. Press **Escape**. The dialog closes and focus returns to the **New Book** button you pressed Enter on.
6. Reopen, pick a work type, and confirm focus lands in the **Name** field on the naming step.

- [ ] **Step 9: Manual screen-reader verification**

With NVDA (Windows) or VoiceOver (`Cmd+F5`) running, open the modal.

- On open it must announce **"What are you writing?, dialog"**. Before this task it announced nothing — the container was a plain `div`.
- With the virtual cursor (NVDA: down-arrow; VoiceOver: `VO+Right`), you must **not** be able to read the shelf behind the dialog. That is what `aria-modal="true"` buys.
- On the naming step it must announce **"New Story, dialog"** followed by **"Name, edit"**.

- [ ] **Step 10: Commit**

```bash
git add src/components/management/Bookshelf.tsx
git commit -m "fix: the modal that gates every creation was invisible to a screen reader

No role, no aria-modal, no name, no focus entry, no Escape, and 29 tab
stops of shelf between opening it and reaching its first control. It is
now a real dialog: focus enters, Tab cycles inside it, Escape closes it
and focus goes back to the button that opened it."
```

---

## Task 3: `18` — the other three Bookshelf dialogs

**Files:**
- Modify: `src/components/management/Bookshelf.tsx`

`ShelfDialog` already exists from Task 2. These three reuse it, and the hand-rolled Escape effect that served them goes with it.

- [ ] **Step 1: Wrap the shelf wizard**

At `Bookshelf.tsx:545`, replace:

```tsx
            {isWizardOpen && (
                <div className={styles.wizardBackdrop} onClick={resetWizard}>
                    <div className={styles.wizardModal} onClick={e => e.stopPropagation()}>
```

with:

```tsx
            {isWizardOpen && (
                <ShelfDialog labelledBy={`${fieldId}-wizard-title`} onDismiss={resetWizard}>
```

and its matching close (`</div></div>` before the new-work modal's comment) with `</ShelfDialog>`.

At `Bookshelf.tsx:549`, add the id:

```tsx
<h2 id={`${fieldId}-wizard-title`} className={styles.wizardTitle}>{editingWorldId ? 'Edit Shelf' : 'Create New Shelf'}</h2>
```

At `Bookshelf.tsx:563`, replace the shelf-name input's `autoFocus` with `data-autofocus`.

- [ ] **Step 2: Wrap the two delete confirmations**

At `Bookshelf.tsx:828`:

```tsx
            {deletingProjectId && (
                <ShelfDialog labelledBy={`${fieldId}-delete-book-title`} onDismiss={() => setDeletingProjectId(null)}>
                    <h2 id={`${fieldId}-delete-book-title`} className={styles.wizardTitle}>
                        Delete “{projects.find(p => p.id === deletingProjectId)?.name}”?
                    </h2>
```

At `Bookshelf.tsx:848`:

```tsx
            {deletingWorldId && (
                <ShelfDialog labelledBy={`${fieldId}-delete-shelf-title`} onDismiss={() => setDeletingWorldId(null)}>
                    <h2 id={`${fieldId}-delete-shelf-title`} className={styles.wizardTitle}>Delete this shelf?</h2>
```

Replace each one's trailing `</div></div>` with `</ShelfDialog>`.

- [ ] **Step 3: Delete the hand-rolled Escape effect**

`Bookshelf.tsx:102–114` is now dead — the hook owns Escape, and it owns it per-dialog rather than by guessing which of three is on top. Delete the whole block:

```typescript
    /** Escape key listener for closing the wizard modal or a delete confirmation */
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (isWizardOpen) resetWizard();
            else if (deletingProjectId) setDeletingProjectId(null);
            else if (deletingWorldId) setDeletingWorldId(null);
        };
        if (isWizardOpen || deletingProjectId || deletingWorldId) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isWizardOpen, deletingProjectId, deletingWorldId]);
```

If `useEffect` now has no other use in this file, remove it from the React import on line 3.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false && npx eslint src/components/management/Bookshelf.tsx`

Expected: both clean. An unused-import warning means step 3 left `useEffect` behind.

- [ ] **Step 5: Manual keyboard verification**

On the Bookshelf, keyboard only:

1. Open **New Shelf**. Focus lands in the Shelf Name field. Tab wraps within the dialog. Escape closes it and focus returns to the New Shelf button.
2. Open a book's delete confirmation. Escape closes it. Tab cycles between **Cancel** and **Delete** only.
3. A screen reader announces **"Delete "<book name>"?, dialog"** on open — the destructive question is the dialog's name, so it is spoken before the two buttons.

- [ ] **Step 6: Commit**

```bash
git add src/components/management/Bookshelf.tsx
git commit -m "fix: the shelf wizard and both delete confirmations are dialogs

Their shared Escape listener guessed which of three was on top. The hook
knows, because it keeps a stack."
```

---

## Task 4: `18` — the eight `src/components/ui/` dialogs

**Files:**
- Modify: `src/components/ui/ExportModal.tsx`, `SettingsModal.tsx`, `ShareModal.tsx`, `LoginModal.tsx`, `ImportModal.tsx`, `NewProjectModal.tsx`, `ProjectLibraryModal.tsx`, `ProjectSettingsModal.tsx`

All eight share one shape: a backdrop `div` with `onClick={onClose}`, an inner panel with `onClick={e => e.stopPropagation()}`, and a heading in a `.header` block. Each is its own component, so the hook can be called directly — no wrapper needed.

The change to each is the same four edits.

- [ ] **Step 1: Apply the pattern to each file**

For every file in the list:

1. Add the import:
```typescript
import { useModalDialog } from '@/lib/useModalDialog';
```

2. Inside the component body, above the `return`:
```typescript
const dialogRef = useModalDialog<HTMLDivElement>(onClose);
```

3. Add `role="presentation"` to the backdrop `div`, and the ref plus semantics to the panel. `SettingsModal` is the model:

```tsx
        <div className={styles.backdrop} onClick={onClose} role="presentation">
            <div
                ref={dialogRef}
                className={styles.panel}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-dialog-title"
                tabIndex={-1}
            >
                <div className={styles.header}>
                    <h2 id="settings-dialog-title">Settings</h2>
```

4. Put the matching `id` on the heading.

The heading, class name and id for each:

| File | Backdrop class | Panel class | Heading | id |
|---|---|---|---|---|
| `ExportModal.tsx:91` | `styles.backdrop` | `styles.panel` | `:94` `<h2>Export</h2>` | `export-dialog-title` |
| `SettingsModal.tsx:108` | `styles.backdrop` | `styles.panel` | `:111` `<h2>Settings</h2>` | `settings-dialog-title` |
| `ShareModal.tsx:106` | `styles.backdrop` | `styles.panel` | `:109` `<h2>Share Milestone</h2>` | `share-dialog-title` |
| `LoginModal.tsx:66` | `styles.backdrop` | `styles.panel` | `:72` `<h1 className={styles.title}>LoreCanvas</h1>` | `login-dialog-title` |
| `ImportModal.tsx:304` | `styles.overlay` | `styles.modal` | `:307` `<h2 className={styles.title}>` | `import-dialog-title` |
| `NewProjectModal.tsx:93` | `styles.overlay` | `styles.modal` | `:96` `<h2 className={styles.title}>New Project</h2>` | `new-project-dialog-title` |
| `ProjectLibraryModal.tsx:49` | `styles.overlay` | `styles.modal` | `:52` `<h2 className={styles.title}>Your Library</h2>` | `library-dialog-title` |
| `ProjectSettingsModal.tsx:74` | `styles.overlay` | `styles.modal` | `:77` `<h2 className={styles.title}>Project Settings</h2>` | `project-settings-dialog-title` |

Two notes on the table:

- `ImportModal` and `NewProjectModal` take an `isOpen` prop and return `null` when it is false, so the hook only runs while the dialog is on screen. `ProjectLibraryModal` and `ProjectSettingsModal` do the same. Confirm the early return sits **above** the `useModalDialog` call is impossible — hooks cannot follow a conditional return. Instead confirm the component's early return is `if (!isOpen) return null;` **before** any hook, which is what it already does for `useState`; place `useModalDialog` in the same block as the other hooks, above that return, and pass the hook a no-op when closed is unnecessary — the effect keys off mount, and these components stay mounted. **Split them instead:** rename the existing component body to an inner `…Content` component that assumes it is open, and make the exported component `if (!isOpen) return null; return <…Content … />`. `NewProjectModal.tsx` and `ProjectLibraryModal.tsx` already portal via `createPortal`; keep the portal in the inner component.
- `LoginModal.tsx` names itself off `<h1>LoreCanvas</h1>`, which is the product name rather than the task. Use an explicit name instead of `aria-labelledby`:
```tsx
                aria-label="Sign in to LoreCanvas"
```

- [ ] **Step 2: Delete `NewProjectModal`'s own Escape listener**

`NewProjectModal.tsx:60` duplicates what the hook now does:

```typescript
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
```

Delete that effect. `handleClose` is still the `onClose` passed to the hook, so behaviour is unchanged apart from the trap.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --pretty false && npx eslint src/components/ui && npm run build`

Expected: all three clean.

- [ ] **Step 4: Manual keyboard verification**

For each of the eight, keyboard only:

1. Open it (Settings and Export are reachable from the mode bar; `Ctrl+E` opens Export).
2. Focus is inside on open. Tab wraps inside. Shift+Tab wraps backwards.
3. **Escape closes it** — this is new for six of the eight — and focus returns to the control that opened it.

Screen reader, on Export specifically: opening announces **"Export, dialog"**, and the virtual cursor cannot reach the writing desk behind it.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui
git commit -m "fix: the eight ui/ dialogs are dialogs

Six of them had no Escape at all. None of them held focus, so Tab walked
off into the page behind while the dialog stayed on screen."
```

---

## Task 5: `18` — the four Draft Table dialogs

**Files:**
- Modify: `src/components/editor/desk/MethodLibrary.tsx` (two dialogs), `MethodFinder.tsx`, `DraftExport.tsx`

These four already have Escape. What they do not have is semantics, a name, or a trap — and two of them fight each other over Escape.

- [ ] **Step 1: `MethodLibrary` — the library itself**

Import the hook. Above the `const modal = (` at `MethodLibrary.tsx:62`:

```typescript
    const dialogRef = useModalDialog<HTMLDivElement>(onClose);
```

At `:63–65`:

```tsx
    const modal = (
        <div className={styles.backdrop} onClick={onClose} role="presentation">
            <div
                ref={dialogRef}
                className={styles.modal}
                onClick={e => e.stopPropagation()}
                style={{ position: 'relative' }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="method-library-title"
                tabIndex={-1}
            >
```

Both of the library's headings take the id, since only one renders at a time — `:70` (`What are you writing?`) and `:94` (`Choose a Writing Method`):

```tsx
<h2 id="method-library-title" className={styles.title}>What are you writing?</h2>
```
```tsx
<h2 id="method-library-title" className={styles.title}>Choose a Writing Method</h2>
```

Delete the effect at `:47–51`:

```typescript
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
```

- [ ] **Step 2: `MethodLibrary` — `ConfirmDialog`**

This is the one that proves the stack works. At `:172`, add above the `return createPortal(`:

```typescript
    const dialogRef = useModalDialog<HTMLDivElement>(onCancel);
```

At `:180–182`:

```tsx
    return createPortal(
        <div className={styles.backdrop} onClick={onCancel} role="presentation">
            <div
                ref={dialogRef}
                className={`${styles.modal} ${styles.confirmModal}`}
                onClick={e => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-body"
                tabIndex={-1}
            >
                <h2 id="confirm-dialog-title" className={styles.title}>{title}</h2>
                <p id="confirm-dialog-body" className={styles.subtitle}>{body}</p>
```

`role="alertdialog"` rather than `dialog`: this one asks a destructive question, and `alertdialog` makes a screen reader read the body without the user having to go looking for it.

Delete the effect at `:173–177`.

- [ ] **Step 3: `MethodFinder`**

Add the hook above `const modal = (` at `:63`. At `:64–66`:

```tsx
    const modal = (
        <div className={styles.backdrop} onClick={onClose} role="presentation">
            <div
                ref={dialogRef}
                className={`${styles.modal} ${styles.finderModal}`}
                onClick={e => e.stopPropagation()}
                style={{ position: 'relative' }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="method-finder-title"
                tabIndex={-1}
            >
```

At `:69`:

```tsx
<h2 id="method-finder-title" className={styles.title}>{showResults ? 'Your matches' : 'Find your method'}</h2>
```

Delete the effect at `:40–44`.

- [ ] **Step 4: `DraftExport`**

Same shape. At `:163–165`, wrap with `role="dialog"`, `aria-modal="true"`, `aria-labelledby="draft-export-title"`, `tabIndex={-1}` and the ref; put the id on `:168`:

```tsx
<h2 id="draft-export-title" className={styles.title}>Export your outline</h2>
```

At `:199` the filename input carries `autoFocus`. Replace it with `data-autofocus`.

Delete the effect at `:74–78`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --pretty false && npx eslint src/components/editor/desk`

Expected: both clean.

- [ ] **Step 6: Manual keyboard verification — the nesting case**

This is the step that proves the stack. On the Draft Table:

1. Open the **Method Library**. Tab must cycle inside it.
2. Trigger the action that raises the `ConfirmDialog` on top of it (replacing an existing method).
3. Press **Escape once**. **Only the confirm closes.** The Method Library is still open, and focus is back on the control in the library that raised the confirm. Before this task, one Escape closed both.
4. Press **Escape again**. Now the library closes.

Screen reader, on the confirm: it must announce **"<title>, dialog"** and then read the body text without prompting, because it is `alertdialog` with `aria-describedby`.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/desk
git commit -m "fix: the four Draft Table dialogs, and the Escape they shared

MethodLibrary and its ConfirmDialog each registered a window keydown
listener, so a single Escape over the confirm dismissed the library
underneath it. The confirm is now an alertdialog, and only the topmost
dialog answers the key."
```

---

## Task 6: `18` — the last eight dialogs

**Files:**
- Modify: `src/components/navigation/CommandPalette.tsx`, `src/components/world/InlineEntryCreator.tsx`, `src/components/world/EntityDetailPanel.tsx` (two branches), `src/components/editor/research/InterviewEditorModal.tsx`
- Modify: `src/components/editor/research/InterviewRunner.tsx` (created by Phase 5)
- Modify: `src/components/home/GoalScheduleModal.tsx`, `src/app/welcome/themes/standard/RequestAccessModal.tsx` — **trap only, semantics already correct**

- [ ] **Step 1: `CommandPalette`**

It has no heading, so it names itself. `CommandPalette.tsx:167–168`:

```tsx
        <div className={styles.backdrop} onClick={closePalette} onContextMenu={e => e.preventDefault()} role="presentation">
            <div
                ref={dialogRef}
                className={styles.modal}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Command palette"
                tabIndex={-1}
            >
```

Add `const dialogRef = useModalDialog<HTMLDivElement>(closePalette);` above the `if (!isCommandPaletteOpen) return null;` guard at `:164`. Because that guard sits below the hooks, split the component the same way as Task 4: an inner `CommandPaletteContent` that assumes it is open, and an exported `CommandPalette` that returns `null` or renders it.

`:147`'s `if (e.key === 'Escape')` inside the input's `onKeyDown` can go — the hook covers it from anywhere in the dialog, not just while the input has focus. Leave the arrow-key and Enter branches alone.

The input at `:171` is already focused by the effect at `:78–91`. Add `data-autofocus` to it and delete that effect's `inputRef.current.focus()` line, leaving the `setSearch('')` / `setSelectedIndex(0)` reset in place — two things racing for focus is how a caret ends up in the wrong field.

- [ ] **Step 2: `InlineEntryCreator`**

At `:100–101`:

```tsx
        <div className={styles.creatorOverlay} onClick={handleBackdropClick} role="presentation">
            <div
                ref={dialogRef}
                className={styles.creatorModal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="inline-entry-title"
                tabIndex={-1}
            >
                <div className={styles.modalHeader}>
                    <h3 id="inline-entry-title">New World Entry</h3>
```

Add `const dialogRef = useModalDialog<HTMLDivElement>(closeAndReturnFocus);` — but `closeAndReturnFocus` is declared *below* the `if (!isInlineCreatorOpen) return null;` guard at `:39`. Split the component as in Task 4: move everything from `closeAndReturnFocus` down into an inner `InlineEntryCreatorForm`, and keep the store subscription plus the open check in the exported wrapper.

The existing focus-in effect at `:32–37` and `initialInputRef` become redundant — put `data-autofocus` on the name input at `:110` and delete the effect and the ref.

Its own focus-return via `window.dispatchEvent(new CustomEvent('lorecanvas:returnFocusToEditor'))` **stays**. The hook restores focus to whatever had it at open; the custom event puts the caret back in the ProseMirror document, which is a different and better destination. They do not conflict — the event fires last.

- [ ] **Step 3: `EntityDetailPanel` — both branches**

The "not found" branch at `:74–75`:

```tsx
            <div className={styles.panelBackdrop} onClick={() => setSelectedEntity(null)} role="presentation">
                <aside
                    ref={dialogRef}
                    className={styles.panelContainer}
                    onClick={e => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="entity-panel-title"
                    tabIndex={-1}
                >
                    <div className={styles.panelHeader}>
                        <h3 id="entity-panel-title">Entity Not Found</h3>
```

The main branch at `:115–118`, identically, with `<h3 id="entity-panel-title">Edit Entity</h3>` at `:118`.

Both branches sit below hooks in the same component, so one `const dialogRef = useModalDialog<HTMLAsideElement>(() => setSelectedEntity(null));` above both returns serves both — the two branches never render together.

Delete the Escape effect at `:47–53`.

- [ ] **Step 4: `InterviewEditorModal`**

At `:89–92`:

```tsx
        <div className={styles.interviewEditorBackdrop} onClick={onClose} role="presentation">
            <div
                ref={dialogRef}
                className={styles.interviewEditorModal}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="interview-editor-title"
                tabIndex={-1}
            >
                <div className={styles.interviewEditorHeader}>
                    <h2 id="interview-editor-title" className={styles.interviewEditorTitle}>{canDelete ? 'Edit interview' : 'New interview'}</h2>
```

At `:117` the first field carries `autoFocus`. Replace with `data-autofocus`.

- [ ] **Step 5: Phase 5's `InterviewRunner`**

Phase 5 ships `src/components/editor/research/InterviewRunner.tsx` already carrying `role="dialog"`, `aria-modal="true"` and `aria-label={`${interview.title} interview`}` — see `2026-09-03-phase-5-lore-without-ai.md`, Task 11. What it does **not** have is the trap, Escape, focus entry or focus restore, and its backdrop is unmarked.

Confirm the shape first:

```bash
grep -n 'role="dialog"\|interviewEditorBackdrop\|title="Close"' src/components/editor/research/InterviewRunner.tsx
```

Then make four edits:

1. `role="presentation"` on the backdrop `div`.
2. `ref={dialogRef}` and `tabIndex={-1}` on the panel, with `const dialogRef = useModalDialog<HTMLDivElement>(onClose);` above the return.
3. `data-autofocus` on the answer field, so each question lands the caret in the box rather than on the Back button.
4. `title="Close"` on the close button becomes `aria-label="Close interview"`.

Leave `role`, `aria-modal` and `aria-label` exactly as Phase 5 wrote them.

If the file is missing — Phase 5 was skipped or the component was renamed — say so in the commit message and move on rather than inventing one.

- [ ] **Step 6: Give the two already-correct dialogs the trap**

`GoalScheduleModal` and `RequestAccessModal` got their semantics in an earlier pass on this branch. Their `role`, `aria-modal` and `aria-labelledby` are correct — **do not touch them.** What they never had is the trap, because nothing in this app has.

In `src/components/home/GoalScheduleModal.tsx`:

- Add `const dialogRef = useModalDialog<HTMLDivElement>(onClose);` above the return.
- Add `ref={dialogRef}` and `tabIndex={-1}` to the `<div className={styles.modal}>` at `:67`.
- Delete the Escape effect at `:34–38` — the hook owns it now, and owns it stack-aware.
- Add `data-autofocus` to the everyday-goal input at `:91`.

In `src/app/welcome/themes/standard/RequestAccessModal.tsx`:

- Same three edits against the panel at `:45–48` (which already has `role`, `aria-modal` and `aria-labelledby="request-title"`), and delete its own Escape listener at `:27`.
- Add `data-autofocus` to the first field at `:90`.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit --pretty false && npx eslint src && npx vitest run && npm run build`

Expected: all four clean.

- [ ] **Step 8: Manual keyboard verification**

1. `Ctrl+K` opens the Command Palette. The caret is already in the search box. Escape closes it from anywhere in the dialog, including after tabbing to a result. Focus returns to where you were.
2. In the writing editor, trigger **New World Entry**. Focus lands in the Name field. Escape closes it and **the caret returns to the document**, not to a button.
3. Open an entity's detail panel. Escape closes it; focus returns to the entity you opened.

Screen reader: the Command Palette announces **"Command palette, dialog"**; New World Entry announces **"New World Entry, dialog"** then **"Name, edit"**.

- [ ] **Step 9: Commit**

```bash
git add src/components/navigation/CommandPalette.tsx src/components/world/InlineEntryCreator.tsx src/components/world/EntityDetailPanel.tsx src/components/editor/research/InterviewEditorModal.tsx src/components/editor/research/InterviewRunner.tsx src/components/home/GoalScheduleModal.tsx src/app/welcome/themes/standard/RequestAccessModal.tsx
git commit -m "fix: the last dialogs get semantics, and every dialog gets the trap

The Command Palette's Escape was bound to its search input, so it only
worked while the caret was in the box. InlineEntryCreator keeps its own
focus-return event: the hook restores focus to the opener, the event puts
the caret back in the manuscript, which is the better destination."
```

---

## Task 7: `2d` — the announcement queue

**Files:**
- Create: `src/lib/liveAnnouncer.ts`
- Create: `src/lib/liveAnnouncer.test.ts`

Two things a bare `<div aria-live>` gets wrong, and neither is obvious. A screen reader ignores a live region whose text has not changed, so saving twice in a row announces once. And two messages in the same tick clobber each other. Both are pure logic, so both are tested here before anything renders.

- [ ] **Step 1: Write the failing test**

Create `src/lib/liveAnnouncer.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import {
    ANNOUNCEMENT_COALESCE_MS,
    ANNOUNCEMENT_TTL_MS,
    EMPTY_ANNOUNCER,
    announce,
    announcementText,
    expireAnnouncements,
    pushAnnouncement,
    subscribeToAnnouncements,
} from './liveAnnouncer';

describe('pushAnnouncement', () => {
    it('ignores a blank or whitespace-only message', () => {
        expect(pushAnnouncement(EMPTY_ANNOUNCER, '', 'polite', 0)).toBe(EMPTY_ANNOUNCER);
        expect(pushAnnouncement(EMPTY_ANNOUNCER, '   ', 'polite', 0)).toBe(EMPTY_ANNOUNCER);
    });

    it('does not mutate the state it is given', () => {
        const before = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        const after = pushAnnouncement(before, 'Exported', 'polite', 100);
        expect(before.queue).toHaveLength(1);
        expect(after.queue).toHaveLength(2);
        expect(after).not.toBe(before);
    });

    it('drops a repeat of the same message inside the coalesce window', () => {
        const first = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        const second = pushAnnouncement(first, 'Saved', 'polite', ANNOUNCEMENT_COALESCE_MS - 1);
        expect(second.queue).toHaveLength(1);
        expect(second.nextId).toBe(first.nextId);
    });

    it('re-announces the same message once the coalesce window has passed', () => {
        const first = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        const second = pushAnnouncement(first, 'Saved', 'polite', ANNOUNCEMENT_COALESCE_MS + 1);
        expect(second.queue).toHaveLength(2);
        expect(announcementText(second, 'polite')).not.toBe(announcementText(first, 'polite'));
    });

    it('trims the message before storing it', () => {
        const state = pushAnnouncement(EMPTY_ANNOUNCER, '  Saved  ', 'polite', 0);
        expect(state.queue[0].message).toBe('Saved');
    });
});

describe('announcementText', () => {
    it('is empty for a channel with nothing in it', () => {
        expect(announcementText(EMPTY_ANNOUNCER, 'polite')).toBe('');
        expect(announcementText(EMPTY_ANNOUNCER, 'assertive')).toBe('');
    });

    it('reads the newest message on that channel', () => {
        let state = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        state = pushAnnouncement(state, 'Exported', 'polite', 1000);
        expect(announcementText(state, 'polite')).toContain('Exported');
        expect(announcementText(state, 'polite')).not.toContain('Saved');
    });

    it('keeps polite and assertive apart', () => {
        let state = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        state = pushAnnouncement(state, 'Export failed', 'assertive', 10);
        expect(announcementText(state, 'polite')).toContain('Saved');
        expect(announcementText(state, 'assertive')).toContain('Export failed');
    });
});

describe('expireAnnouncements', () => {
    it('drops entries older than the TTL', () => {
        const state = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        expect(expireAnnouncements(state, ANNOUNCEMENT_TTL_MS + 1).queue).toHaveLength(0);
    });

    it('returns the same object when nothing has expired', () => {
        const state = pushAnnouncement(EMPTY_ANNOUNCER, 'Saved', 'polite', 0);
        expect(expireAnnouncements(state, 10)).toBe(state);
    });
});

describe('the announcement bus', () => {
    it('delivers to a subscriber and stops on unsubscribe', () => {
        const heard = vi.fn();
        const stop = subscribeToAnnouncements(heard);

        announce('Saved');
        expect(heard).toHaveBeenCalledWith('Saved', 'polite');

        announce('Export failed', 'assertive');
        expect(heard).toHaveBeenCalledWith('Export failed', 'assertive');

        stop();
        announce('Ignored');
        expect(heard).toHaveBeenCalledTimes(2);
    });

    it('does not throw when nothing is listening', () => {
        expect(() => announce('Nobody home')).not.toThrow();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/liveAnnouncer.test.ts`

Expected: FAIL — `Failed to resolve import "./liveAnnouncer"`.

- [ ] **Step 3: Write the leaf module**

Create `src/lib/liveAnnouncer.ts`:

```typescript
/**
 * Live-region announcements — the queue behind the app's two aria-live nodes.
 * LEAF MODULE (no store, no React).
 *
 * Two problems a bare <div aria-live> does not solve:
 *
 * 1. A screen reader says nothing when a live region's text has not changed.
 *    Saving twice in a row would therefore announce once. Each entry carries an
 *    id, and the rendered text carries an invisible marker derived from it, so
 *    a repeat really is a different string.
 * 2. Two announcements in the same tick overwrite each other. They queue
 *    instead, and the newest on each channel is what the region shows.
 *
 * The bus at the bottom is how a component anywhere announces without a prop
 * being threaded to it. It holds subscribers, not application state.
 */

export type Politeness = 'polite' | 'assertive';

export interface Announcement {
    id: number;
    message: string;
    politeness: Politeness;
    at: number;
}

export interface AnnouncerState {
    queue: readonly Announcement[];
    nextId: number;
}

export const EMPTY_ANNOUNCER: AnnouncerState = { queue: [], nextId: 1 };

/** How long an announcement stays in the region before it is swept out. */
export const ANNOUNCEMENT_TTL_MS = 5000;

/**
 * A repeat of the same message inside this window is the same event arriving
 * twice — a debounced save firing alongside a manual one — not two events.
 */
export const ANNOUNCEMENT_COALESCE_MS = 400;

export function pushAnnouncement(
    state: AnnouncerState,
    message: string,
    politeness: Politeness,
    now: number,
): AnnouncerState {
    const text = message.trim();
    if (!text) return state;

    const live = state.queue.filter(a => now - a.at < ANNOUNCEMENT_TTL_MS);
    const isRepeat = live.some(a =>
        a.message === text
        && a.politeness === politeness
        && now - a.at < ANNOUNCEMENT_COALESCE_MS);

    if (isRepeat) {
        return live.length === state.queue.length ? state : { ...state, queue: live };
    }

    return {
        queue: [...live, { id: state.nextId, message: text, politeness, at: now }],
        nextId: state.nextId + 1,
    };
}

export function expireAnnouncements(state: AnnouncerState, now: number): AnnouncerState {
    const live = state.queue.filter(a => now - a.at < ANNOUNCEMENT_TTL_MS);
    return live.length === state.queue.length ? state : { ...state, queue: live };
}

/**
 * Text for one region: the newest live message on that channel, plus an
 * invisible marker. The marker alternates with the entry id, so announcing
 * "Saved" twice produces two different strings and the reader speaks both.
 */
export function announcementText(state: AnnouncerState, politeness: Politeness): string {
    const channel = state.queue.filter(a => a.politeness === politeness);
    const latest = channel[channel.length - 1];
    if (!latest) return '';
    return latest.message + ' '.repeat(latest.id % 2);
}

// ─── The bus ────────────────────────────────────────────────────────────────

type AnnounceListener = (message: string, politeness: Politeness) => void;

const listeners = new Set<AnnounceListener>();

/** Returns the unsubscribe function, so a useEffect can return it directly. */
export function subscribeToAnnouncements(listener: AnnounceListener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Say something. Safe to call before anything is listening. */
export function announce(message: string, politeness: Politeness = 'polite'): void {
    // Copied first: a listener that unsubscribes while being called would
    // otherwise mutate the set mid-iteration.
    for (const listener of [...listeners]) listener(message, politeness);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/liveAnnouncer.test.ts`

Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/liveAnnouncer.ts src/lib/liveAnnouncer.test.ts
git commit -m "feat: an announcement queue for the app's live regions

A screen reader ignores a live region whose text has not changed, so two
saves in a row would announce once. Each entry carries an invisible marker
derived from its id, which makes a repeat a genuinely different string."
```

---

## Task 8: `2d` — the live regions themselves

**Files:**
- Create: `src/components/a11y/LiveRegion.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add the `.sr-only` utility**

`src/app/globals.css` already hosts global utilities — the `:focus-visible` block and `.hit-target`. Append after `.hit-target::after`:

```css
/* ──────────────────────────────────────────────────────────────
   Screen-reader-only text.

   Clipped rather than display:none or visibility:hidden — both of
   those take the node out of the accessibility tree, which would make
   a live region permanently silent. Global, like .hit-target, because
   the live regions are mounted from the root layout.
   ────────────────────────────────────────────────────────────── */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 2: Write the component**

Create `src/components/a11y/LiveRegion.tsx`:

```tsx
"use client";

import { useEffect, useState } from 'react';
import {
    ANNOUNCEMENT_TTL_MS,
    EMPTY_ANNOUNCER,
    announcementText,
    expireAnnouncements,
    pushAnnouncement,
    subscribeToAnnouncements,
    type AnnouncerState,
} from '@/lib/liveAnnouncer';

/**
 * The app's two live regions. Mounted once in the root layout so anything,
 * anywhere, can call announce() without a prop being threaded down to it.
 *
 * Two regions rather than one: polite waits for a pause in speech, which is
 * right for a save; assertive interrupts, which is right for an export that
 * failed and wrong for everything else.
 */
export default function LiveRegion() {
    const [state, setState] = useState<AnnouncerState>(EMPTY_ANNOUNCER);

    useEffect(() => subscribeToAnnouncements((message, politeness) => {
        setState(prev => pushAnnouncement(prev, message, politeness, Date.now()));
    }), []);

    // Sweep expired entries so the region does not hold stale text that a
    // reader would re-speak if the user navigated back to it.
    useEffect(() => {
        if (state.queue.length === 0) return;
        const timer = setInterval(
            () => setState(prev => expireAnnouncements(prev, Date.now())),
            ANNOUNCEMENT_TTL_MS,
        );
        return () => clearInterval(timer);
    }, [state.queue.length]);

    return (
        <>
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {announcementText(state, 'polite')}
            </div>
            <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
                {announcementText(state, 'assertive')}
            </div>
        </>
    );
}
```

- [ ] **Step 3: Mount it**

In `src/app/layout.tsx`, add the import beside the existing `SupabaseSyncProvider` import at line 18:

```typescript
import LiveRegion from "@/components/a11y/LiveRegion";
```

and render it inside `<body>`, above the provider, so the regions exist in the DOM before anything can announce into them:

```tsx
      <body className={`${inter.variable} ${merriweather.variable} ${imFell.variable} ${ebGaramond.variable}`}>
        <LiveRegion />
        <SupabaseSyncProvider>
          {children}
        </SupabaseSyncProvider>
      </body>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false && npm run build`

Expected: both clean.

- [ ] **Step 5: Manual verification of the plumbing**

Nothing announces yet — Task 9 wires the call sites. Confirm the regions exist and are invisible:

1. Load the app. Open DevTools and run `document.querySelectorAll('[aria-live]').length` — expect **2**.
2. Run `document.querySelector('[aria-live="polite"]').getBoundingClientRect()` — width and height must be **1**, not 0. A zero-size or `display:none` region is silent.
3. Run `announce` manually by pasting into the console is not possible (the module is bundled). Instead confirm by eye that no visible text appeared anywhere on the page.

- [ ] **Step 6: Commit**

```bash
git add src/components/a11y/LiveRegion.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: the app gets its first live regions

Two of them, polite and assertive, mounted once in the root layout. The
.sr-only utility clips rather than hiding: display:none would take the
region out of the accessibility tree and make it permanently silent."
```

---

## Task 9: `2d` — announce saving, word counts and exports

**Files:**
- Modify: `src/components/editor/WritingDesk.tsx`
- Modify: `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`
- Modify: `src/components/world/EntityDetailPanel.tsx`
- Modify: `src/components/world/ArticleGridEditor.tsx`
- Modify: `src/components/ui/ExportModal.tsx`

Five places currently paint a result and say nothing. In a writing tool, a user who is never told their work saved has no reason to trust it.

- [ ] **Step 1: The Writing Desk's "✓ Saved"**

`src/components/editor/WritingDesk.tsx:635` renders the indicator:

```tsx
<div className={`${styles.saveIndicator} ${isSaved ? styles.saveIndicatorActive : ''}`}>✓ Saved</div>
```

Add the import, and announce where the flag is set — `updateWidgets` at `:109–112`:

```typescript
    if (!silentUI) {
      setIsSaved(true);
      announce('Desk saved');
      setTimeout(() => setIsSaved(false), 2000);
    }
```

Do **not** put the announcement on the rendered div. The indicator is on screen for two seconds and then removed; a live region driven by its presence would announce on the way in and, on some readers, again on the way out.

- [ ] **Step 2: The manuscript save, with its word count**

`StoryWritingZone.tsx:304–316` is the spine save button. It is also the only honest place to speak a word count: the count is on screen at all times, but announcing it on every keystroke would make the editor unusable. Attaching it to a deliberate save gives the number once, when it is asked for.

```tsx
                onClick={() => {
                  (onChangeImmediate ?? onChange)({ ...content, saveStatus: 'saving' });
                  onManualSave?.();
                  setTimeout(() => {
                    (onChangeImmediate ?? onChange)({ ...content, saveStatus: 'saved' });
                    announce(
                      activeScene
                        ? `Saved. ${(activeScene.wordCount ?? 0).toLocaleString()} words in ${activeScene.title}.`
                        : 'Saved.',
                    );
                    setTimeout(() => (onChangeImmediate ?? onChange)({ ...content, saveStatus: null }), 2000);
                  }, 500);
                }}
```

`activeScene` is already in scope at `StoryWritingZone.tsx:128`.

- [ ] **Step 3: The entity save**

`src/components/world/EntityDetailPanel.tsx:85–93`, `handleSave`:

```typescript
    const handleSave = () => {
        updateEntity(selectedEntity.id, {
            name: name.trim(),
            type,
            description: description.trim()
        });
        setSaved(true);
        announce(`Saved ${name.trim() || 'entry'}.`);
        setConfirmingDelete(false);
    };
```

- [ ] **Step 4: The article save**

`src/components/world/ArticleGridEditor.tsx:104–105`:

```typescript
      setSaveLabel('saved');
      announce('Article saved');
      setTimeout(() => setSaveLabel('idle'), 2000);
```

- [ ] **Step 5: Export results**

`src/components/ui/ExportModal.tsx` sets `exportError` in five `catch` blocks and renders it at `:169–173` as a plain `div`. A failed export currently produces a red box and silence.

Announce each outcome at the point it is known. In each handler, after the operation succeeds, and in each `catch`. `handleDocumentDocx` is the model:

```typescript
    const handleDocumentDocx = async () => {
        if (!activeDocument || !activeProject) return;
        setExportError(null);
        setIsExporting(true);
        try {
            await exportAsDocx(activeDocument, documentScenes);
            announce('Word document downloaded.');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error during Docx export';
            setExportError(message);
            announce(`Export failed. ${message}`, 'assertive');
        } finally {
            setIsExporting(false);
        }
    };
```

Apply the same to `handleDocumentMarkdown` ("Markdown file downloaded."), `handleDocumentEpub` ("EPUB downloaded."), and `handleWorldBibleExport` ("World Bible downloaded."). Failures are always `'assertive'` — an export that did not happen is worth interrupting for; a successful one is not.

> Phase 4 (`02`, `11`) reworked this modal to export a whole manuscript. The handler names may differ. The anchor that does not move is the `exportError` state and the `catch` blocks that set it — announce beside every `setExportError`, and beside every successful `await`/call that precedes one.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --pretty false && npx eslint src && npm run build`

Expected: all three clean.

- [ ] **Step 7: Manual screen-reader verification**

With NVDA or VoiceOver running:

1. Type in a scene, then press the spine save button. It must speak **"Saved. 412 words in Chapter One."** — the count is spoken, not just drawn.
2. Move a widget on the desk so the "✓ Saved" chip appears. It must speak **"Desk saved"** once, not twice.
3. Press save twice within half a second. It must speak **once** — that is the coalesce window.
4. Press save, wait two seconds, press save again. It must speak **both times**, with the same words. This is the case a naive live region fails.
5. Open Export and download a Markdown file. It must speak **"Markdown file downloaded."**
6. Force a failure (export with no active document is guarded, so temporarily corrupt the document title or export a chapter with zero scenes if that throws). It must **interrupt** with **"Export failed. …"**.

- [ ] **Step 8: Commit**

```bash
git add src/components/editor/WritingDesk.tsx src/components/editor/desk/widgets/zones/StoryWritingZone.tsx src/components/world/EntityDetailPanel.tsx src/components/world/ArticleGridEditor.tsx src/components/ui/ExportModal.tsx
git commit -m "feat: say it when the work is saved, and when an export fails

Four save indicators and every export outcome were pixels only. The word
count rides on the manual save rather than on every keystroke — announcing
a running count while someone types makes the editor unusable."
```

---

## Task 10: `15d` — chrome out of `<main>`, and a skip link

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.css`

`src/app/page.tsx:168` opens `<main>` around the entire application: the decorative shader canvas, the mode bar `<nav>`, all the docked panels, every modal and the hover preview. A screen-reader user jumping to the main landmark lands on the whole page, which is the same as having no landmark at all. And there is no skip link anywhere in the app — `grep -rn "skip" src --include=*.tsx -i` finds only the word in comments and copy.

- [ ] **Step 1: Add the skip-link style**

Append to `src/app/page.module.css`:

```css
/* Skip link. The first tab stop on the page and hidden until it has focus,
   because it is the one control that only exists for the keyboard. */
.skipLink {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10000;
    padding: 0.5rem 0.875rem;
    background: var(--accent);
    color: var(--on-accent);
    border-bottom-right-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    transform: translateY(-150%);
}

.skipLink:focus,
.skipLink:focus-visible {
    transform: translateY(0);
}
```

`transform` rather than `display: none` or a negative `top`: the link has to stay in the accessibility tree and in the tab order to be reachable at all.

- [ ] **Step 2: Narrow `<main>`**

In `src/app/page.tsx`, the outermost element at `:168` becomes a plain `div` — the `.workspace` class is a CSS Module class and carries no element semantics, so nothing about the layout changes:

```tsx
  return (
    <div
      className={`${styles.workspace} ${isFullscreen ? styles.fullscreenMode : ''} ${isFocusMode ? styles.focusMode : ''}`}
    >
      <a href="#main-content" className={styles.skipLink}>Skip to the writing area</a>
      <DeskLighting />
      <ModeBar />
      <div className={styles.workspaceRow}>
```

and the editor column at `:174` becomes the `<main>`:

```tsx
        <main
          id="main-content"
          tabIndex={-1}
          className={styles.editorContainer}
          style={{
            paddingRight: tabRailWidth + 8,
            transition: 'padding-right 280ms ease-in-out',
          }}
        >
```

with its closing `</div>` at `:208` becoming `</main>`, and the file's final `</main>` at `:284` becoming `</div>`.

`tabIndex={-1}` is required. Without it the skip link moves the *scroll* position but not focus, so the next Tab press continues from the mode bar as if nothing happened.

Everything else stays exactly where it is. `ModeBar` already renders `<nav className={styles.modeBar}>` at `ModeBar.tsx:392`, so moving it out of `<main>` gives the page a navigation landmark and a main landmark that do not overlap. The six docked panels and the modals now sit as siblings of `<main>` rather than inside it.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --pretty false && npm run build`

Expected: both clean.

- [ ] **Step 4: Manual keyboard verification**

1. Load the app and press **Tab once**, from a fresh page load with focus nowhere. The skip link must **appear** in the top-left corner, visibly.
2. Press **Enter**. The URL gains `#main-content`.
3. Press **Tab again**. Focus must be on the **first control inside the editor column** — not back at the top of the mode bar. If it goes back to the mode bar, `tabIndex={-1}` is missing from `<main>`.

- [ ] **Step 5: Manual screen-reader verification**

With NVDA, press `D` to cycle landmarks (VoiceOver: `VO+U`, then Landmarks).

- There must be exactly **one `main`** landmark, and entering it must put you in the writing area — not on the mode bar, not on a docked panel.
- The mode bar must be reachable as a separate **navigation** landmark.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/page.module.css
git commit -m "fix: <main> wrapped the whole app, and there was no skip link

The main landmark contained the nav, every docked panel, every modal and
the shader canvas, so jumping to it landed you exactly where you already
were. It now wraps the editor column alone, and a skip link jumps past the
mode bar. <main> takes tabIndex={-1} so the jump moves focus, not just
the scroll position."
```

---

## Task 11: `19` — name the last thirteen controls

**Files:**
- Modify: `src/components/editor/desk/BookViewEditor.tsx`
- Modify: `src/components/editor/WritingDesk.tsx`
- Modify: `src/components/navigation/ModeBar.tsx`
- Modify: `src/components/world/ArticleGridEditor.tsx`
- Modify: `src/components/editor/desk/widgets/RelationshipMapRenderer.tsx`
- Modify: `src/components/editor/desk/widgets/StickyNoteRenderer.tsx`
- Modify: `src/components/world/article-grid/widgets/OrgChartWidget.tsx`
- Modify: `src/components/world/article-grid/widgets/SceneCardWidget.tsx`
- Modify: `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`
- Modify: `src/components/editor/research/InterviewEditorModal.tsx`

**How the list was arrived at.** A DOM probe only sees mounted surfaces, so the sweep was over the source: every `<button>`, `<a>`, `<input>`, `<select>` and `<textarea>` in `src/**/*.tsx`, minus anything Phases 1 and 2 delete, checked for `aria-label`, `aria-labelledby`, `title`, a literal text child, or a text-bearing `<span>`. Thirteen come back nameless. The earlier audit's figure of "roughly 53 glyph icons" is now **68 lines** matching `styles.*Icon*` without `aria-hidden`, but the overwhelming majority sit next to a text label in the same control — a work-type card reads "📖 Story", which is verbose, not nameless. Those are noise reduction, not naming, and are out of scope for this item; the thirteen below are controls a screen reader announces as **"button"** with nothing after it.

- [ ] **Step 1: The two toolbar letters**

`src/components/editor/desk/BookViewEditor.tsx:129–130`. "B" and "I" are conventional to a sighted user and meaningless spoken:

```tsx
          <button className={styles.deskFmtBtn} aria-label="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
          <button className={styles.deskFmtBtn} aria-label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
```

- [ ] **Step 2: The three zoom controls**

`src/components/editor/WritingDesk.tsx:866`, `:907`, `:909`:

```tsx
          <button className={styles.zoomBtn} aria-label="Zoom out" onClick={() => { setZoomValue(Math.max(0.2, zoom - 0.1)); }}>−</button>
```
```tsx
          <button className={styles.zoomBtn} aria-label="Zoom in" onClick={() => { setZoomValue(Math.min(2, zoom + 0.1)); }}>+</button>
```
```tsx
          <button className={styles.fitBtn} aria-label="Reset zoom to 100%" style={{ background: 'transparent', color: 'var(--muted)', fontSize: '0.6875rem' }} onClick={() => { setZoomValue(1); }}>100%</button>
```

While here, `WritingDesk.tsx:894–906` is a `<span>` with `onClick` and a `title` and no keyboard path at all — the click-to-type-zoom-percentage target. Make it a button:

```tsx
            <button
              type="button"
              className={styles.zoomValue}
              onClick={() => {
                setZoomInputValue(Math.round(zoom * 100).toString());
                setIsEditingZoom(true);
              }}
              aria-label={`Zoom is ${Math.round(zoom * 100)} percent. Activate to type a value.`}
            >
              {Math.round(zoom * 100)}%
            </button>
```

Check `.zoomValue` in `WritingDesk.module.css` for a `background`/`border` reset; a `<button>` inherits UA chrome a `<span>` does not. Add `background: none; border: none; padding: 0; font: inherit; color: inherit; cursor: pointer;` to the rule if it is not already there.

- [ ] **Step 3: The two `×` buttons and the `＋`**

`src/components/navigation/ModeBar.tsx:448`:

```tsx
            <button
              className={styles.searchClear}
              aria-label="Clear search"
              onMouseDown={e => { e.preventDefault(); setQuery(''); setResults([]); setIsOpen(false); }}
            >
              ×
            </button>
```

`src/components/editor/desk/widgets/RelationshipMapRenderer.tsx:149`:

```tsx
              <button
                aria-label={`Remove ${char?.name || 'this character'} from the map`}
                style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff4d4d', color: '#fff', border: 'none', borderRadius: '50%', width: '14px', height: '14px', fontSize: '0.6875rem', cursor: 'pointer', zIndex: 20 }}
```

`src/components/world/ArticleGridEditor.tsx:599`:

```tsx
                  <button className={styles.tabAddSmall} aria-label="Add a tab" onClick={(e) => { e.stopPropagation(); addTab(); }}>＋</button>
```

- [ ] **Step 4: The three colour pickers**

Each renders a row of empty buttons whose only content is a background colour. `aria-pressed` matters as much as the name here — without it, a reader cannot tell which one is chosen.

`src/components/editor/desk/widgets/StickyNoteRenderer.tsx:41`:

```tsx
          <button
            key={name}
            className={`${styles.stickyColorDot} ${color === name ? styles.stickyColorDotActive : ''}`}
            style={{ background: hex }}
            aria-label={`${name} note`}
            aria-pressed={color === name}
            onClick={() => handleImmediate({ color: name })}
          />
```

`src/components/world/article-grid/widgets/OrgChartWidget.tsx:264`. The values in `NODE_COLORS` are hex strings, so the name has to be positional:

```tsx
            {NODE_COLORS.map((c, i) => (
              <button key={c} className={`${styles.orgChartColorSwatch} ${newNode.color === c ? styles.orgChartColorSwatchActive : ''}`}
                style={{ background: c }}
                aria-label={`Node colour ${i + 1} of ${NODE_COLORS.length}`}
                aria-pressed={newNode.color === c}
                onClick={() => setNewNode(v => ({ ...v, color: c }))} />
            ))}
```

`src/components/world/article-grid/widgets/SceneCardWidget.tsx:48`:

```tsx
          {CARD_COLORS.map((c, i) => (
            <button
              key={c}
              className={`${styles.sceneCardColorDot} ${color === c ? styles.sceneCardColorDotActive : ''}`}
              style={{ background: c }}
              aria-label={`Card colour ${i + 1} of ${CARD_COLORS.length}`}
              aria-pressed={color === c}
              onClick={() => onChange({ ...content, color: c })}
            />
          ))}
```

- [ ] **Step 5: The manuscript save button and the cover target**

`src/components/editor/desk/widgets/zones/StoryWritingZone.tsx:304`. Its label is `✔️` or `💾` — a screen reader either says nothing or reads the emoji's CLDR name:

```tsx
              <button
                className={styles.spineSaveBtn}
                data-status={content.saveStatus}
                aria-label={content.saveStatus === 'saved' ? 'Saved' : 'Save now'}
```

and mark the glyph decorative so it is not read alongside:

```tsx
                <span aria-hidden="true">{content.saveStatus === 'saved' ? '✔️' : '💾'}</span>
```

`StoryWritingZone.tsx:286–302` is the book cover: an `<img onClick>` in one branch and a `<div onClick>` in the other, both with `title="Book Information"` and no keyboard path. Make both a `<button>` wrapping the existing visual:

```tsx
              <button
                type="button"
                className={styles.spineCoverButton}
                onClick={() => setActiveSceneId('cover')}
                aria-label="Book information"
              >
                {activeProject?.coverImageUrl ? (
                  <img src={activeProject.coverImageUrl} className={styles.spineCoverImg} alt="" />
                ) : (
                  <div
                    className={styles.spineCoverPlaceholder}
                    style={{ background: activeProject?.coverColor || 'var(--surface)' }}
                  >
                    <span className={styles.spineCoverInitials} aria-hidden="true">
                      {activeProject?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </button>
```

Add `.spineCoverButton { background: none; border: none; padding: 0; display: block; cursor: pointer; }` to the zone's stylesheet.

- [ ] **Step 6: The interview editor's five controls**

`src/components/editor/research/InterviewEditorModal.tsx` has four unlabelled fields and a close button named by `title` rather than `aria-label`.

Add `const fieldId = useId();` to the component (importing `useId` from React), then pair each field with the label that already sits beside it. At `:102`, `:112`, `:124` and `:134`:

```tsx
<input id={`${fieldId}-icon`} className={styles.interviewEditorInput} value={draft.icon} …
```
```tsx
<input id={`${fieldId}-title`} className={styles.interviewEditorInput} value={draft.title} …
```
```tsx
<input id={`${fieldId}-tagline`} className={styles.interviewEditorInput} value={draft.tagline} …
```
```tsx
<select id={`${fieldId}-target`} className={styles.interviewEditorInput} value={draft.targetType ?? ''} …
```

and give each field's existing visible label a matching `htmlFor`. If a field has no visible label, use `aria-label="Icon"` / `"Title"` / `"Tagline"` / `"Applies to"` instead.

At `:93`, replace `title="Close"` with `aria-label="Close interview editor"`. `title` is a tooltip; it is announced by some readers and not others, and never by touch.

- [ ] **Step 7: Verify no unnamed control remains**

```bash
npx tsc --noEmit --pretty false && npx eslint src && npm run build
```

Then re-run the source sweep. Every `<button>` in the surviving tree must have `aria-label`, `aria-labelledby`, or a text child:

```bash
grep -rn "<button" src --include=*.tsx | wc -l
grep -rn "aria-label" src --include=*.tsx | wc -l
```

Record both. The second should have risen by at least 13 against the pre-task count.

- [ ] **Step 8: Manual screen-reader verification**

With NVDA in browse mode, press `B` to cycle buttons on each of these surfaces in turn: the Writing Desk (zoom row and the manuscript spine), the mode bar search with text typed in it, an article's tab strip, a sticky note, a scene card, an org-chart widget's add form, and the relationship map.

**Every button must announce a name.** None may announce as bare **"button"**, and none may announce an emoji name such as "floppy disk". The three colour rows must also announce **"pressed"** on the currently selected swatch.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "fix: thirteen controls announced as bare 'button'

Bold and italic were the letters B and I; three zoom controls were a
minus, a plus and '100%'; two more were the character ×; three colour
rows were empty buttons with a background; and the manuscript save button
was an emoji. The zoom readout and the book cover were click targets with
no keyboard path at all and are now buttons."
```

---

## Task 12: Full regression and the keyboard-only walkthrough

**Files:** none — verification only.

- [ ] **Step 1: The automated gates**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src
npm run build
```

Expected: all four clean. `vitest` should report the two new suites — `focusTrap` (10 tests) and `liveAnnouncer` (11 tests).

- [ ] **Step 2: Confirm every dialog is a dialog**

```bash
grep -rc 'role="dialog"\|role="alertdialog"' src --include=*.tsx | grep -v ':0' | sort
```

Expected: a non-zero count in every file named in the inventory table above — 20 files holding the 24 dialogs (`Bookshelf.tsx` holds four, `MethodLibrary.tsx` two, `EntityDetailPanel.tsx` two). Then check nothing was missed:

```bash
grep -rn 'Backdrop}\|backdrop}\|Overlay}\|overlay}' src --include=*.tsx | grep -v 'role="presentation"'
```

Expected: only non-dialog uses — `WorldBibleCenter.tsx`'s `.backdrop` image and `.backdropIcon`, which are decorative artwork, not overlays.

- [ ] **Step 3: Confirm the live regions exist and are the only ones**

```bash
grep -rn 'aria-live\|role="status"\|role="alert"' src --include=*.tsx
```

Expected: the two in `LiveRegion.tsx`, plus the two that pre-dated this phase (`ErrorBoundary.tsx:47`, `WorldBibleBook.tsx:125`), plus `role="alertdialog"` on `ConfirmDialog`.

- [ ] **Step 4: The keyboard-only walkthrough**

Unplug the mouse, or put it out of reach. Complete this end to end without touching it:

1. Load the app. Press Tab once — the skip link appears. Enter, then Tab — you are in the editor column.
2. Press `D` (NVDA) to cycle landmarks: one `main`, one `navigation`. `main` is the editor, not the whole page.
3. Reach the Bookshelf. Open **New Book**. Focus is in the dialog. Tab cycles inside it. Escape returns you to the button.
4. Reopen, pick Story, type a name, Tab to **Start Writing**, Enter. You are on the Writing Desk.
5. Type a sentence. Tab to the spine save button. Enter. It announces **"Saved. N words in …"**.
6. `Ctrl+E` opens Export. Escape closes it and focus returns.
7. `Ctrl+K` opens the Command Palette, caret in the box. Escape closes it from anywhere in the dialog.
8. Open the Method Library, raise the confirm on top of it, press Escape once — only the confirm closes.
9. Open Settings. Tab reaches every control, including both checkboxes. Escape closes it.

Any step that cannot be completed with the keyboard is a defect in this phase, not a limitation.

- [ ] **Step 5: The screen-reader pass**

With NVDA (Windows) or VoiceOver (`Cmd+F5`), repeat steps 3–9. Every dialog announces **"<its name>, dialog"** on open. Every save and every export outcome is spoken. No control announces as bare "button".

- [ ] **Step 6: Commit any fixes found**

```bash
git add -A
git commit -m "fix: defects found in the Phase 6 keyboard and screen-reader walkthrough"
```

---

## Definition of done

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green, including `focusTrap.test.ts` (10) and `liveAnnouncer.test.ts` (11)
- [ ] `npx eslint src` clean
- [ ] `npm run build` succeeds
- [ ] All 24 dialogs carry `role="dialog"` (or `alertdialog`), `aria-modal="true"` and an accessible name
- [ ] Focus enters every one of the 24 on open, cycles inside it, and returns to the opener on close
- [ ] Escape closes every dialog, and closes **only the topmost** when two are stacked
- [ ] No component registers its own `window`/`document` Escape listener for a dialog any more
- [ ] The work-type modal takes **one** Tab press to reach its first control, not 29
- [ ] Two live regions exist, mounted once in the root layout, clipped not hidden
- [ ] Saving the desk, a manuscript, an entity and an article each announce; the manuscript save speaks its word count
- [ ] Every export outcome announces — successes politely, failures assertively
- [ ] `<main>` wraps the editor column alone; `ModeBar`, the docked panels and the modals sit outside it
- [ ] A skip link is the first tab stop and moves focus, not just scroll
- [ ] No `<button>` in `src/` announces as bare "button"
- [ ] The three colour rows expose `aria-pressed`
- [ ] The full keyboard-only walkthrough completes with the mouse out of reach

---

## What this phase deliberately does not do

Stated so the gaps are not mistaken for oversights.

- **Icon verbosity.** 68 source lines render a decorative icon without `aria-hidden`. Nearly all sit inside a control that also has text, so they make a reader verbose rather than silent. Sweeping them is a Phase 8 concern, where the icons are being touched anyway.
- **The 45 `<div onClick>` handlers** that are not focusable. Most are backdrops whose keyboard path is the Cancel button beside them, which is correct. The three that were real controls are fixed in Task 11.
- **`inert` on the background.** `aria-modal="true"` removes the page behind from the virtual cursor and the focus trap removes it from the tab order, which covers the reported defect. Marking the app root `inert` while a dialog is open would be belt and braces and would need a global open-count; it is not needed to close `2c` or `18`.
- **`ProjectSwitcher.tsx`.** A full dialog with no mount site. Dead code, not an accessibility defect.
