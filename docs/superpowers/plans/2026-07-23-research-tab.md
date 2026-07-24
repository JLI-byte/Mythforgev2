# Research Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Research tab between Bookshelf and Draft Table — a spatial corkboard of note/clipping/link cards, with a per-project and per-world scope toggle, built by reusing the existing Writing Desk canvas.

**Architecture:** The Research tab renders the existing `WritingDesk` canvas under a new `variant="research"`. A thin `ResearchTab` wrapper owns the scope switcher and passes a composite `scopeKey` (`project:<id>` or `world:<worldKey>`) down. The canvas reads/writes a new `researchStates` store slice keyed by that scope key, reusing the same `DeskState` shape, persistence, and drag/zoom engine. Cards reuse existing widget types: sticky (Note), image (Clipping), reference (Link).

**Tech Stack:** Next.js 16 (React 19), Zustand 5 (persist middleware), TypeScript, Vitest (jsdom). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-23-research-tab-design.md`

---

## File Structure

**Created:**
- `src/lib/researchScope.ts` — pure scope-key resolver (leaf module, no store import).
- `src/lib/researchScope.test.ts` — unit tests for the resolver.
- `src/store/researchState.test.ts` — unit test for the `updateResearchState` store action.
- `src/components/editor/ResearchTab.tsx` — wrapper: scope switcher + renders the canvas.

**Modified:**
- `src/store/workspaceStore.ts` — `WorkspaceMode` union, `researchStates` slice + action, `partializeWorkspace`.
- `src/components/editor/WritingDesk.tsx` — `research` variant, `scopeKey` prop, generalized storage identity, research Add menu.
- `src/components/editor/WritingDesk.module.css` — scope bar styles (appended).
- `src/components/navigation/ModeBar.tsx` — new `MODE_TABS` entry.
- `src/app/page.tsx` — render branch for `research`.

---

## Task 1: Research scope-key resolver

**Files:**
- Create: `src/lib/researchScope.ts`
- Test: `src/lib/researchScope.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/researchScope.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { researchScopeKey } from './researchScope';

describe('researchScopeKey', () => {
  it('keys project scope by project id', () => {
    expect(researchScopeKey('project', { id: 'p1' })).toBe('project:p1');
  });

  it('keys world scope by the project world id', () => {
    expect(researchScopeKey('world', { id: 'p1', worldId: 'w1' })).toBe('world:w1');
  });

  it('keys world scope to standalone when the project has no world', () => {
    expect(researchScopeKey('world', { id: 'p1' })).toBe('world:standalone');
  });

  it('returns null when there is no active project', () => {
    expect(researchScopeKey('project', null)).toBeNull();
    expect(researchScopeKey('world', null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- researchScope`
Expected: FAIL — cannot resolve `./researchScope`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/researchScope.ts`:

```ts
/**
 * Research scope-key resolver — LEAF MODULE (no store import).
 * A research board is keyed either to a single project (`project:<id>`) or to
 * a whole shelf/world (`world:<worldKey>`). Mirrors the World Bible's per-shelf
 * keying via worldKeyForProject.
 */
import { worldKeyForProject } from './worldKey';

export type ResearchScope = 'project' | 'world';

export function researchScopeKey(
  scope: ResearchScope,
  project?: { id: string; worldId?: string } | null,
): string | null {
  if (!project) return null;
  if (scope === 'project') return `project:${project.id}`;
  return `world:${worldKeyForProject(project)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- researchScope`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/researchScope.ts src/lib/researchScope.test.ts
git commit -m "feat: research scope-key resolver"
```

---

## Task 2: Store — researchStates slice + action

**Files:**
- Modify: `src/store/workspaceStore.ts`
- Test: `src/store/researchState.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/researchState.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

describe('updateResearchState', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ researchStates: {} });
  });

  it('creates a board at the given scope key', () => {
    useWorkspaceStore.getState().updateResearchState('project:p1', {
      widgets: [{ id: 'w1', type: 'sticky', x: 0, y: 0, width: 200, height: 200, content: {} }],
    });
    const board = useWorkspaceStore.getState().researchStates['project:p1'];
    expect(board.widgets).toHaveLength(1);
    expect(board.zoom).toBe(1);
  });

  it('does not touch other scope keys', () => {
    useWorkspaceStore.getState().updateResearchState('project:p1', { zoom: 2 });
    useWorkspaceStore.getState().updateResearchState('world:w1', { zoom: 0.5 });
    const states = useWorkspaceStore.getState().researchStates;
    expect(states['project:p1'].zoom).toBe(2);
    expect(states['world:w1'].zoom).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- researchState`
Expected: FAIL — `updateResearchState` is not a function.

- [ ] **Step 3a: Add `'research'` to the WorkspaceMode union**

In `src/store/workspaceStore.ts`, find (around line 449):

```ts
export type WorkspaceMode = 'home' | 'worldBible' | 'worldBibleEdit' | 'template' | 'desk' | 'hierarchy' | 'bookshelf';
```

Replace with:

```ts
export type WorkspaceMode = 'home' | 'worldBible' | 'worldBibleEdit' | 'template' | 'desk' | 'hierarchy' | 'bookshelf' | 'research';
```

- [ ] **Step 3b: Add the state field to the WorkspaceState interface**

Find (around line 648):

```ts
    draftStates: Record<string, DeskState>;
```

Add directly below it:

```ts

    /**
     * Research Table canvas states, keyed by a composite scope key:
     * `project:<projectId>` for per-project boards, `world:<worldKey>` for
     * per-shelf boards. Same shape as a desk state.
     */
    researchStates: Record<string, DeskState>;
```

- [ ] **Step 3c: Add the action signature**

Find (around line 834):

```ts
    /** Draft Table Actions — parallel canvas, same shape as the desk. */
    updateDraftState: (projectId: string, updates: Partial<DeskState>) => void;
```

Add directly below it:

```ts
    /** Research Table Actions — parallel canvas keyed by composite scope key. */
    updateResearchState: (scopeKey: string, updates: Partial<DeskState>) => void;
```

- [ ] **Step 3d: Add to partialize (persistence + cloud sync)**

Find (around line 1099):

```ts
        draftStates: state.draftStates,
```

Add directly below it:

```ts
        researchStates: state.researchStates,
```

- [ ] **Step 3e: Add the initial state value**

Find (around line 1184):

```ts
            draftStates: {},
```

Add directly below it:

```ts
            researchStates: {},
```

- [ ] **Step 3f: Add the action implementation**

Find (around line 2087):

```ts
            updateDraftState: (projectId, updates) =>
                set((state) => {
                    const current = state.draftStates[projectId] || { widgets: [], zoom: 1, canvasOffset: { x: 0, y: 0 } };
                    return {
                        draftStates: {
                            ...state.draftStates,
                            [projectId]: { ...current, ...updates }
                        }
                    };
                }),
```

Add directly below it:

```ts
            updateResearchState: (scopeKey, updates) =>
                set((state) => {
                    const current = state.researchStates[scopeKey] || { widgets: [], zoom: 1, canvasOffset: { x: 0, y: 0 } };
                    return {
                        researchStates: {
                            ...state.researchStates,
                            [scopeKey]: { ...current, ...updates }
                        }
                    };
                }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- researchState`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify the whole suite and types still pass**

Run: `npm test`
Expected: all existing tests still PASS.
Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/workspaceStore.ts src/store/researchState.test.ts
git commit -m "feat: researchStates store slice and updateResearchState action"
```

---

## Task 3: WritingDesk — research variant + scopeKey wiring

**Files:**
- Modify: `src/components/editor/WritingDesk.tsx`

No unit test (the project has no React component test harness; this is verified in the browser in Task 6). Each edit is a precise old→new replacement.

- [ ] **Step 1: Widen the props and add variant flags + storage identity**

Find (lines ~25-45):

```tsx
interface WritingDeskProps {
  /** 'desk' = the manuscript Writing Desk (seeds a Writing Zone).
   *  'draft' = the Draft Table: a blank per-project canvas, no Writing Zone. */
  variant?: 'desk' | 'draft';
}

export default function WritingDesk({ variant = 'desk' }: WritingDeskProps) {
  const isDraft = variant === 'draft';
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const activeDocumentId = useWorkspaceStore(s => s.activeDocumentId);
  const activeSceneId = useWorkspaceStore(s => s.activeSceneId);
  const deskState = useWorkspaceStore(s => activeProjectId ? (isDraft ? s.draftStates[activeProjectId] : s.deskStates[activeProjectId]) : null);
  // Route persistence to the matching per-project slice; local name is kept so
  // every existing call site (updateDeskState(activeProjectId, …)) is unchanged.
  const updateDeskStateAction = useWorkspaceStore(s => s.updateDeskState);
  const updateDraftStateAction = useWorkspaceStore(s => s.updateDraftState);
  const updateDeskState = isDraft ? updateDraftStateAction : updateDeskStateAction;
  // The Draft Table is a blank canvas — global desk widgets don't bleed onto it.
  const globalWidgetsRaw = useWorkspaceStore(s => s.globalWidgets);
  const globalWidgets = isDraft ? NO_GLOBAL_WIDGETS : globalWidgetsRaw;
  const updateGlobalWidgets = useWorkspaceStore(s => s.updateGlobalWidgets);
```

Replace with:

```tsx
interface WritingDeskProps {
  /** 'desk' = the manuscript Writing Desk (seeds a Writing Zone).
   *  'draft' = the Draft Table: a blank per-project canvas, no Writing Zone.
   *  'research' = the Research Table: a blank canvas keyed by scopeKey. */
  variant?: 'desk' | 'draft' | 'research';
  /** Research variant only: composite scope key (`project:<id>` | `world:<key>`). */
  scopeKey?: string | null;
}

export default function WritingDesk({ variant = 'desk', scopeKey = null }: WritingDeskProps) {
  const isDraft = variant === 'draft';
  const isResearch = variant === 'research';
  const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
  const activeDocumentId = useWorkspaceStore(s => s.activeDocumentId);
  const activeSceneId = useWorkspaceStore(s => s.activeSceneId);
  // Storage identity: research boards key by scopeKey; desk/draft by project id.
  const stateKey = isResearch ? scopeKey : activeProjectId;
  const deskState = useWorkspaceStore(s =>
    isResearch
      ? (scopeKey ? s.researchStates[scopeKey] : null)
      : activeProjectId
        ? (isDraft ? s.draftStates[activeProjectId] : s.deskStates[activeProjectId])
        : null
  );
  // Route persistence to the matching slice; local name is kept so every
  // existing call site (updateDeskState(stateKey, …)) is unchanged.
  const updateDeskStateAction = useWorkspaceStore(s => s.updateDeskState);
  const updateDraftStateAction = useWorkspaceStore(s => s.updateDraftState);
  const updateResearchStateAction = useWorkspaceStore(s => s.updateResearchState);
  const updateDeskState = isResearch ? updateResearchStateAction : isDraft ? updateDraftStateAction : updateDeskStateAction;
  // Draft and Research are blank canvases — global desk widgets don't bleed on.
  const globalWidgetsRaw = useWorkspaceStore(s => s.globalWidgets);
  const globalWidgets = (isDraft || isResearch) ? NO_GLOBAL_WIDGETS : globalWidgetsRaw;
  const updateGlobalWidgets = useWorkspaceStore(s => s.updateGlobalWidgets);
```

- [ ] **Step 2: Point `updateWidgets` at the generalized state key**

Find (lines ~85-93):

```tsx
  const updateWidgets = useCallback((next: DeskWidget[], silentUI: boolean = true) => {
    if (!activeProjectId) return;
    widgetsRef.current = next;
    updateDeskState(activeProjectId, { widgets: next });
    if (!silentUI) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  }, [activeProjectId, updateDeskState]);
```

Replace with:

```tsx
  const updateWidgets = useCallback((next: DeskWidget[], silentUI: boolean = true) => {
    if (!stateKey) return;
    widgetsRef.current = next;
    updateDeskState(stateKey, { widgets: next });
    if (!silentUI) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  }, [stateKey, updateDeskState]);
```

- [ ] **Step 3: Skip Writing Zone seeding for research**

Find (lines ~244-246):

```tsx
  useEffect(() => {
    if (!activeProjectId) return;
    if (isDraft) return; // Draft Table is a blank canvas — no seeded Writing Zone.
```

Replace with:

```tsx
  useEffect(() => {
    if (!activeProjectId) return;
    if (isDraft || isResearch) return; // Blank canvases — no seeded Writing Zone.
```

- [ ] **Step 4: Point pan (`setOffset`) at the generalized state key**

Find (lines ~217-222):

```tsx
  const setOffset = useCallback((off: { x: number; y: number }) => {
    if (!activeProjectId) return;
    canvasOffsetRef.current = off;
    offsetRef.current = off;
    updateDeskState(activeProjectId, { canvasOffset: off });
  }, [activeProjectId, updateDeskState]);
```

Replace with:

```tsx
  const setOffset = useCallback((off: { x: number; y: number }) => {
    if (!stateKey) return;
    canvasOffsetRef.current = off;
    offsetRef.current = off;
    updateDeskState(stateKey, { canvasOffset: off });
  }, [stateKey, updateDeskState]);
```

- [ ] **Step 5: Point zoom (`setZoomValue`) at the generalized state key**

Find (lines ~224-228):

```tsx
  const setZoomValue = useCallback((z: number) => {
    if (!activeProjectId) return;
    zoomRef.current = z;
    updateDeskState(activeProjectId, { zoom: z });
  }, [activeProjectId, updateDeskState]);
```

Replace with:

```tsx
  const setZoomValue = useCallback((z: number) => {
    if (!stateKey) return;
    zoomRef.current = z;
    updateDeskState(stateKey, { zoom: z });
  }, [stateKey, updateDeskState]);
```

- [ ] **Step 6: Point Fit at the generalized state key**

Find (lines ~544-548):

```tsx
    if (activeProjectId) {
      updateDeskState(activeProjectId, { zoom: nextZoom, canvasOffset: nextOffset });
    }
  };
```

Replace with:

```tsx
    if (stateKey) {
      updateDeskState(stateKey, { zoom: nextZoom, canvasOffset: nextOffset });
    }
  };
```

- [ ] **Step 7: Generalize the empty-state guard**

Find (line ~584):

```tsx
  if (!activeProjectId) {
```

Replace with:

```tsx
  if (!stateKey) {
```

- [ ] **Step 8: Add the Research Add menu**

Find the start of the draft-only controls block (line ~859):

```tsx
        {isDraft && (
          <>
            <div className={styles.topCenterControls}>
```

Insert this block immediately BEFORE that `{isDraft && (` line:

```tsx
        {isResearch && (
          <div className={styles.topCenterControls}>
            <button className={styles.methodPickerBtn} onMouseDown={e => e.stopPropagation()} onClick={() => addAtCenter('sticky')}>📝 Note</button>
            <button className={styles.methodPickerBtn} onMouseDown={e => e.stopPropagation()} onClick={() => addAtCenter('image')}>🖼️ Clipping</button>
            <button className={styles.methodPickerBtn} onMouseDown={e => e.stopPropagation()} onClick={() => addAtCenter('reference')}>🔗 Link</button>
          </div>
        )}

```

- [ ] **Step 9: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no type errors. (`updateGlobalWidgets` may be reported as unused if it already was — leave it as-is; do not introduce new unused vars.)

- [ ] **Step 10: Commit**

```bash
git add src/components/editor/WritingDesk.tsx
git commit -m "feat: WritingDesk research variant with scoped storage and add menu"
```

---

## Task 4: ResearchTab wrapper + scope switcher

**Files:**
- Create: `src/components/editor/ResearchTab.tsx`
- Modify: `src/components/editor/WritingDesk.module.css` (append styles)

- [ ] **Step 1: Append the scope-bar styles**

Append to the END of `src/components/editor/WritingDesk.module.css`:

```css

/* ── Research Tab scope switcher ─────────────────────────── */
.researchRoot {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.researchScopeBar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--border, rgba(128, 128, 128, 0.2));
}

.researchScopeBtn {
  padding: 6px 14px;
  font-size: 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(128, 128, 128, 0.25));
  background: transparent;
  color: var(--muted, #888);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}

.researchScopeBtn:hover {
  color: var(--text, inherit);
}

.researchScopeBtnActive {
  background: var(--accent, #4a6fa5);
  border-color: var(--accent, #4a6fa5);
  color: #fff;
}

.researchCanvasHost {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}
```

- [ ] **Step 2: Create the wrapper component**

Create `src/components/editor/ResearchTab.tsx`:

```tsx
"use client";

import React, { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { researchScopeKey, type ResearchScope } from '@/lib/researchScope';
import WritingDesk from './WritingDesk';
import styles from './WritingDesk.module.css';

/**
 * Research Tab — a blank spatial board for research cards. Owns the
 * project/world scope switcher and hands the resolved scope key to the shared
 * canvas, which reads/writes the matching researchStates slice.
 */
export default function ResearchTab() {
  const [scope, setScope] = useState<ResearchScope>('project');
  const activeProject = useWorkspaceStore(s =>
    s.projects.find(p => p.id === s.activeProjectId) ?? null
  );
  const scopeKey = researchScopeKey(scope, activeProject);

  return (
    <div className={styles.researchRoot}>
      <div className={styles.researchScopeBar}>
        <button
          className={`${styles.researchScopeBtn} ${scope === 'project' ? styles.researchScopeBtnActive : ''}`}
          onClick={() => setScope('project')}
        >
          This Project
        </button>
        <button
          className={`${styles.researchScopeBtn} ${scope === 'world' ? styles.researchScopeBtnActive : ''}`}
          onClick={() => setScope('world')}
        >
          This World
        </button>
      </div>
      <div className={styles.researchCanvasHost}>
        <WritingDesk variant="research" scopeKey={scopeKey} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/ResearchTab.tsx src/components/editor/WritingDesk.module.css
git commit -m "feat: ResearchTab wrapper with project/world scope switcher"
```

---

## Task 5: ModeBar — add the Research tab

**Files:**
- Modify: `src/components/navigation/ModeBar.tsx`

- [ ] **Step 1: Import the Telescope icon**

Find (line 4):

```tsx
import { Home, Library, NotebookPen, Globe, LayoutTemplate } from 'lucide-react';
```

Replace with:

```tsx
import { Home, Library, NotebookPen, Globe, LayoutTemplate, Telescope } from 'lucide-react';
```

- [ ] **Step 2: Add the tab between Bookshelf and Draft Table**

Find (lines ~210-216):

```tsx
/** Top-bar tabs the limelight indicator tracks. */
const MODE_TABS = [
  { mode: 'bookshelf', label: 'Bookshelf', Icon: Library },
  { mode: 'template', label: 'Draft Table', Icon: LayoutTemplate },
  { mode: 'desk', label: 'Writing Desk', Icon: NotebookPen },
  { mode: 'worldBible', label: 'World Bible', Icon: Globe },
] as const;
```

Replace with:

```tsx
/** Top-bar tabs the limelight indicator tracks. */
const MODE_TABS = [
  { mode: 'bookshelf', label: 'Bookshelf', Icon: Library },
  { mode: 'research', label: 'Research', Icon: Telescope },
  { mode: 'template', label: 'Draft Table', Icon: LayoutTemplate },
  { mode: 'desk', label: 'Writing Desk', Icon: NotebookPen },
  { mode: 'worldBible', label: 'World Bible', Icon: Globe },
] as const;
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no type errors (the `mode` strings are checked against `WorkspaceMode` via `setWorkspaceMode`).

- [ ] **Step 4: Commit**

```bash
git add src/components/navigation/ModeBar.tsx
git commit -m "feat: Research tab in the ModeBar between Bookshelf and Draft Table"
```

---

## Task 6: page.tsx — render the Research tab

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the lazy import**

Find (lines ~27-28):

```tsx
const Bookshelf = lazy(() => import('@/components/management/Bookshelf').then(m => ({ default: m.Bookshelf })));
const HomePage = lazy(() => import('@/components/home/HomePage'));
```

Replace with:

```tsx
const Bookshelf = lazy(() => import('@/components/management/Bookshelf').then(m => ({ default: m.Bookshelf })));
const HomePage = lazy(() => import('@/components/home/HomePage'));
const ResearchTab = lazy(() => import('@/components/editor/ResearchTab'));
```

- [ ] **Step 2: Add the render branch**

Find (lines ~180-184):

```tsx
                ) : workspaceMode === 'bookshelf' ? (
                  <Bookshelf />
                ) : (
                  <WritingDesk />
                )}
```

Replace with:

```tsx
                ) : workspaceMode === 'bookshelf' ? (
                  <Bookshelf />
                ) : workspaceMode === 'research' ? (
                  <ResearchTab />
                ) : (
                  <WritingDesk />
                )}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: render ResearchTab for the research workspace mode"
```

---

## Task 7: Browser verification pass

**Files:** none (manual verification with the preview tools).

- [ ] **Step 1: Start the dev server and open the app**

Use `preview_start` with `{name: "dev"}`, then sign in / select or create a project so a project is active.

- [ ] **Step 2: Tab presence and order**

Confirm the top bar reads **Bookshelf · Research · Draft Table · Writing Desk · World Bible**, and clicking the telescope opens a blank board with a **This Project · This World** bar at the top.

- [ ] **Step 3: Add cards**

Click **Note**, **Clipping**, **Link** in turn; confirm a sticky, an image pin, and a reference card each appear on the canvas and can be dragged and resized.

- [ ] **Step 4: Persistence**

Type into a Note card, reload the page (`navigate` to the same URL), return to the Research tab, and confirm the card and its text are still there.

- [ ] **Step 5: Scope separation**

On **This Project**, note the cards present. Switch to **This World** — confirm it shows a different (initially empty) board. Add a card there, switch back to **This Project**, and confirm each scope kept its own cards.

- [ ] **Step 6: Drag-drop clipping**

Drag an image file (or an image from a browser tab) onto the board; confirm it becomes a clipping card.

- [ ] **Step 7: Check console + logs**

Use `read_console_messages` (errors only) and `preview_logs` (level error); confirm no new errors were introduced.

- [ ] **Step 8: Final full-suite check**

Run: `npm test`
Expected: all tests PASS.
Run: `npx tsc --noEmit`
Expected: no type errors.
```
```
