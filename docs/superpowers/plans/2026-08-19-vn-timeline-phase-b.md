# VN Season Timeline — Phase B: the surface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the branch map with the timeline the writer actually uses — nested boxes, level-of-detail rendering, click-to-focus framing, decision editing, and export.

**Architecture:** The timeline is a **self-contained surface**, not a widget on the Draft Table canvas. For a visual novel project, a small wrapper renders `VNTimelineSurface` instead of `WritingDesk`. The surface owns its own viewport, zoom and focus, so none of `WritingDesk`'s 1064 lines of drag, resize and widget plumbing has to be touched or fought.

**Tech Stack:** TypeScript, React 19, Next.js 16, Zustand 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-vn-season-timeline-design.md`
**Phase A plan:** `docs/superpowers/plans/2026-08-19-vn-timeline-phase-a.md`

---

## Context you need before starting

**Phase A is done and green.** These exist, are tested, and must not be reimplemented:

| Thing | Where |
|---|---|
| `VNSeason`, `VNEpisode`, `VNDecision`, `VNOption` | `src/lib/vnTimeline.ts` |
| `VNBox`, `VNFocus`, `UNSORTED_SEASON_ID`, `STORY_BOX_ID` | `src/lib/vnTimeline.ts` |
| `layoutTimeline(seasons, episodes, focus?) → VNBox[]` | `src/lib/vnTimeline.ts` |
| `tierForZoom(zoom) → 'story'\|'season'\|'episode'\|'decision'` | `src/lib/vnTimeline.ts` |
| `buildTimelineScript(seasons, episodes, castNames, projectName, flags)` | `src/lib/vnTimelineExport.ts` |
| `VNFlag`, `VNEffect`, `VNCondition` + formatters | `src/lib/vnFlags.ts` |
| `Project.seasons`, `Document.seasonId` / `order` / `decisions` | `src/store/workspaceStore.ts` |

**`layoutTimeline` already does the hard part.** Boxes arrive positioned, sized, marked collapsed or not, and ordered parents-before-children. The surface's job is to draw them and route clicks — do not recompute geometry in the component.

### The one bug pattern that has bitten this codebase repeatedly

**Never build objects inside a `useShallow` selector.**

```ts
// WRONG — new objects every call, so useShallow sees a change every render,
// and the component re-renders forever. This crashed the workspace once.
const eps = useWorkspaceStore(useShallow(s =>
    s.documents.filter(...).map(d => ({ id: d.id, title: d.title }))));

// RIGHT — select the stored objects, reshape after.
const docs = useWorkspaceStore(useShallow(s => s.documents.filter(...)));
const eps = docs.map(d => ({ id: d.id, title: d.title }));
```

`useShallow` compares array elements with `Object.is`. Fresh object literals never compare equal. Every selector in this plan follows the right-hand form; keep it that way.

**Other hard-won rules:**

- An effect that writes to the store must not depend on a value the store write changes, or it re-fires. Latch with a `useRef` when it should run once.
- Handlers registered on `document` during a drag capture render-time values. Read fresh state at commit time.

**Run tests with:** `npm test`. **Baseline: 344 tests across 38 files, `npx tsc --noEmit` exits 0.**

---

## File Structure

**New**

| File | Responsibility |
|---|---|
| `src/components/editor/vn/DraftSurface.tsx` | Picks the timeline for visual novels, `WritingDesk` for everything else. |
| `src/components/editor/vn/VNTimelineSurface.tsx` | Viewport, zoom, focus, box rendering. |
| `src/components/editor/vn/VNEpisodeBox.tsx` | One episode, drawn per tier. |
| `src/components/editor/vn/VNDecisionEditor.tsx` | One decision and its options. |
| `src/components/editor/vn/VNTimeline.module.css` | Styles for the surface. |

**Modified**

| File | Change |
|---|---|
| `src/app/page.tsx` | Render `DraftSurface` instead of `WritingDesk variant="draft"`. |
| `src/store/workspaceStore.ts` | Remove `Document.choices`; remove `vnBlock` from `DeskWidgetType`. |
| `src/lib/export.ts` | `exportAsRenpy` takes seasons and episodes. |
| `src/components/editor/desk/deskConstants.ts` | Drop the `vnBlock` palette and dims entries. |
| `src/components/editor/desk/widgets/WidgetRenderer.tsx` | Drop the `vnBlock` case. |

**Deleted**

`VNBlockRenderer.tsx`, `VNEdgeLayer.tsx`, `vnBlocks.ts`, `vnBlocks.test.ts`, `vnBlockView.ts`, `vnBlockView.test.ts`, and the `VNEdgeLayer` render in `WritingDesk.tsx`.

`VNFlagsRenderer.tsx` **survives** — the timeline reuses it as-is.

---

### Task 1: Remove the branch map

The timeline replaces it. Removing it first means nothing has to keep two models alive at once.

**Files:**
- Delete: `src/components/editor/desk/widgets/VNBlockRenderer.tsx`, `src/components/editor/desk/widgets/VNEdgeLayer.tsx`, `src/lib/vnBlocks.ts`, `src/lib/vnBlocks.test.ts`, `src/lib/vnBlockView.ts`, `src/lib/vnBlockView.test.ts`
- Modify: `src/store/workspaceStore.ts`, `src/lib/export.ts`, `src/components/editor/desk/deskConstants.ts`, `src/components/editor/desk/widgets/WidgetRenderer.tsx`, `src/components/editor/WritingDesk.tsx`

- [ ] **Step 1: Delete the files**

```bash
git rm src/components/editor/desk/widgets/VNBlockRenderer.tsx \
       src/components/editor/desk/widgets/VNEdgeLayer.tsx \
       src/lib/vnBlocks.ts src/lib/vnBlocks.test.ts \
       src/lib/vnBlockView.ts src/lib/vnBlockView.test.ts
```

- [ ] **Step 2: Unwire them**

In `src/components/editor/desk/widgets/WidgetRenderer.tsx`, remove the `VNBlockRenderer` import and its `case 'vnBlock':` line. Leave `VNFlagsRenderer` and its case alone.

In `src/components/editor/desk/deskConstants.ts`, remove the `vnBlock` entry from `DEFAULT_DIMS` and from `PALETTE_ITEMS`. Leave both `vnFlags` entries.

In `src/components/editor/WritingDesk.tsx`, remove the `VNEdgeLayer` import and the `<VNEdgeLayer widgets={canvasWidgets} />` line.

In `src/store/workspaceStore.ts`:
- Remove `'vnBlock' | ` from the `DeskWidgetType` union. Keep `'vnFlags'`.
- Remove the `choices?: VNBlockChoice[]` field from `Document`.
- Remove the now-unused `VNBlockChoice` import.

- [ ] **Step 3: Point the exporter at the timeline**

In `src/lib/export.ts`, replace `exportAsRenpy` entirely:

```ts
/**
 * Exports a visual novel's timeline as a single .rpy file.
 *
 * Ren'Py auto-loads every .rpy under game/, so this drops in alongside the
 * writer's own options.rpy and screens.rpy without overwriting anything.
 */
export function exportAsRenpy(
    seasons: VNSeason[],
    episodes: VNEpisode[],
    castNames: string[],
    projectName: string,
    flags: VNFlag[] = [],
): void {
    const script = buildTimelineScript(seasons, episodes, castNames, projectName, flags);
    const safeName = projectName?.trim() || 'visual-novel';
    downloadFile(script, `${slugify(safeName)}.rpy`, 'text/plain');
}
```

and swap the imports at the top:

```ts
import { buildTimelineScript } from '@/lib/vnTimelineExport';
import type { VNSeason, VNEpisode } from '@/lib/vnTimeline';
import type { VNFlag } from '@/lib/vnFlags';
```

removing the `buildRenpyScript` and `VNScene` imports if nothing else in the file uses them.

- [ ] **Step 4: Find anything left**

Run: `grep -rn "vnBlock\|VNBlockChoice\|flattenBlocksToScenes\|vnBlockView\|VNEdgeLayer" src/`
Expected: no matches.

Whatever it finds, fix. `tsc` will also point at anything missed.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 323 tests across 36 files (21 tests and 2 files removed with `vnBlocks` and `vnBlockView`).

- [ ] **Step 6: Commit**

```bash
git add -u src/
git commit -m "refactor: remove the branch map, superseded by the timeline"
```

`git add -u src/` stages deletions and modifications under `src/` only. Confirm with `git diff --cached --stat` that nothing outside `src/` is staged, and that the unrelated files (Bookshelf, ResearchTab, launch.json, WorkTypeArtwork.tsx) are untouched — those are modified but not staged, and `-u` will pick them up if they were previously tracked, so **check the staged list carefully and unstage anything that is not yours**.

---

### Task 2: The surface

**Files:**
- Create: `src/components/editor/vn/VNTimelineSurface.tsx`
- Create: `src/components/editor/vn/VNTimeline.module.css`
- Create: `src/components/editor/vn/DraftSurface.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the surface**

Create `src/components/editor/vn/VNTimelineSurface.tsx`:

```tsx
"use client";

/**
 * VNTimelineSurface — the visual novel drafting surface.
 *
 * Story contains Seasons contain Episodes contain Decisions, drawn as boxes
 * within boxes and read top to bottom. Geometry comes entirely from
 * layoutTimeline; this component draws what it is given and routes clicks.
 *
 * It owns its own viewport, zoom and focus rather than living on the Draft
 * Table canvas, because focus-framing has to drive the transform and the
 * canvas has its own ideas about dragging, resizing and widget chrome.
 */

import React, { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
    layoutTimeline, tierForZoom, STORY_BOX_ID,
    type VNBox, type VNEpisode, type VNFocus, type VNSeason,
} from '@/lib/vnTimeline';
import styles from './VNTimeline.module.css';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const FRAME_PAD = 48;

export function VNTimelineSurface() {
    const viewportRef = useRef<HTMLDivElement>(null);

    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const project = useWorkspaceStore(s => s.projects.find(p => p.id === activeProjectId));

    // Select stored documents, reshape after — never inside the selector.
    const episodeDocs = useWorkspaceStore(useShallow(s =>
        s.documents.filter(d => d.projectId === activeProjectId),
    ));

    const seasons: VNSeason[] = project?.seasons ?? [];
    const episodes: VNEpisode[] = episodeDocs.map(d => ({
        id: d.id,
        title: d.title,
        seasonId: d.seasonId,
        order: d.order ?? 0,
        decisions: d.decisions,
    }));

    const [focus, setFocus] = useState<VNFocus | undefined>(undefined);
    const [zoom, setZoom] = useState(0.5);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const boxes = useMemo(
        () => layoutTimeline(seasons, episodes, focus),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(seasons), JSON.stringify(episodes), focus?.kind, focus?.id],
    );

    const tier = tierForZoom(zoom);

    /** Zoom and centre so one box fills the viewport. */
    const frame = (box: VNBox) => {
        const vp = viewportRef.current;
        if (!vp) return;
        const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(
            (vp.clientWidth - FRAME_PAD * 2) / box.width,
            (vp.clientHeight - FRAME_PAD * 2) / box.height,
        )));
        setZoom(z);
        setOffset({
            x: vp.clientWidth / 2 - (box.x + box.width / 2) * z,
            y: vp.clientHeight / 2 - (box.y + box.height / 2) * z,
        });
    };

    /**
     * Focus changes the layout, so the box to frame must be found in the
     * layout the new focus produces — not the one currently on screen.
     */
    const focusOn = (next: VNFocus | undefined) => {
        const nextBoxes = layoutTimeline(seasons, episodes, next);
        const target = next
            ? nextBoxes.find(b => b.id === next.id)
            : nextBoxes.find(b => b.id === STORY_BOX_ID);
        setFocus(next);
        if (target) frame(target);
    };

    const onBoxClick = (box: VNBox) => {
        if (box.kind === 'season') focusOn({ kind: 'season', id: box.id });
        else if (box.kind === 'episode') focusOn({ kind: 'episode', id: box.id });
    };

    if (!activeProjectId) return null;

    return (
        <div className={styles.surface}>
            <div className={styles.toolbar}>
                <button type="button" onClick={() => focusOn(undefined)}>
                    Whole story
                </button>
                <span className={styles.tierLabel}>{tier}</span>
                <button type="button" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.1))}>−</button>
                <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.1))}>+</button>
            </div>

            <div ref={viewportRef} className={styles.viewport}>
                <div
                    className={styles.canvas}
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
                >
                    {boxes.map(box => (
                        <div
                            key={box.id}
                            className={`${styles.box} ${styles[box.kind]} ${box.collapsed ? styles.collapsed : ''}`}
                            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
                            onClick={e => { e.stopPropagation(); onBoxClick(box); }}
                        >
                            <div className={styles.boxTitle}>{box.title}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

**On the `useMemo` dependencies:** `seasons` and `episodes` are rebuilt every render, so they cannot be dependencies directly. Serialising them is deliberate — the arrays are small (a season is three fields), and it is far safer here than a stale layout or an infinite loop.

- [ ] **Step 2: Add the styles**

Create `src/components/editor/vn/VNTimeline.module.css`:

```css
.surface {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 70vh;
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.9rem;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    font-size: 0.8rem;
}

.tierLabel {
    margin-left: auto;
    opacity: 0.5;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.68rem;
}

.zoomLabel { opacity: 0.6; min-width: 3rem; text-align: center; }

.viewport {
    position: relative;
    flex: 1;
    overflow: hidden;
}

.canvas {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;
    transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.box {
    position: absolute;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    cursor: pointer;
    overflow: hidden;
}

.boxTitle {
    padding: 0.4rem 0.7rem;
    font-weight: 600;
    font-size: 0.85rem;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
}

.story    { background: rgba(255, 255, 255, 0.02); cursor: default; }
.season   { background: rgba(124, 92, 255, 0.10); border-color: rgba(124, 92, 255, 0.35); }
.episode  { background: rgba(255, 255, 255, 0.05); }
.decision { background: rgba(255, 255, 255, 0.07); border-style: dashed; }

.collapsed { opacity: 0.55; }
.collapsed:hover { opacity: 0.85; }
```

- [ ] **Step 3: Add the wrapper**

Create `src/components/editor/vn/DraftSurface.tsx`:

```tsx
"use client";

/**
 * DraftSurface — what the Draft Table shows.
 *
 * A visual novel drafts on a season timeline; every other work type drafts on
 * the spatial canvas. Choosing here keeps WritingDesk unaware that the
 * timeline exists.
 */

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import WritingDesk from '@/components/editor/WritingDesk';
import { VNTimelineSurface } from './VNTimelineSurface';

export function DraftSurface() {
    const isVisualNovel = useWorkspaceStore(s =>
        s.projects.find(p => p.id === s.activeProjectId)?.writingMode === 'visual-novel',
    );

    return isVisualNovel ? <VNTimelineSurface /> : <WritingDesk variant="draft" />;
}
```

- [ ] **Step 4: Wire it in**

In `src/app/page.tsx`, replace `<WritingDesk variant="draft" />` (around line 178) with `<DraftSurface />`, and add the import:

```tsx
import { DraftSurface } from '@/components/editor/vn/DraftSurface';
```

Leave every other `WritingDesk` usage alone.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 323 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/vn/VNTimelineSurface.tsx src/components/editor/vn/VNTimeline.module.css src/components/editor/vn/DraftSurface.tsx src/app/page.tsx
git commit -m "feat: draw the visual novel season timeline"
```

---

### Task 3: Setting up seasons and episodes

Nothing renders until a project has some. This is the first thing a writer meets.

**Files:**
- Modify: `src/components/editor/vn/VNTimelineSurface.tsx`
- Modify: `src/components/editor/vn/VNTimeline.module.css`

- [ ] **Step 1: Add the setup step**

In `VNTimelineSurface.tsx`, add these imports:

```tsx
import type { VNDecision } from '@/lib/vnTimeline';
```

Add this component above `VNTimelineSurface`:

```tsx
interface SetupProps {
    onCreate: (seasonCount: number, episodesPerSeason: number) => void;
}

/**
 * The first thing a writer sees. Answering it lays a whole skeleton down, so
 * they land on a populated timeline rather than an empty canvas and a question
 * about where to start.
 */
function TimelineSetup({ onCreate }: SetupProps) {
    const [seasonCount, setSeasonCount] = useState(1);
    const [episodeCount, setEpisodeCount] = useState(6);

    return (
        <div className={styles.setup}>
            <h2>How is this story shaped?</h2>
            <p className={styles.setupHint}>
                Both are editable later — this is a head start, not a commitment.
            </p>

            <label className={styles.setupRow}>
                <span>Seasons</span>
                <input type="number" min={1} max={20} value={seasonCount}
                       onChange={e => setSeasonCount(Math.max(1, Number(e.target.value)))} />
            </label>

            <label className={styles.setupRow}>
                <span>Episodes each</span>
                <input type="number" min={1} max={40} value={episodeCount}
                       onChange={e => setEpisodeCount(Math.max(1, Number(e.target.value)))} />
            </label>

            <button type="button" className={styles.setupGo}
                    onClick={() => onCreate(seasonCount, episodeCount)}>
                Build the timeline
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Create the skeleton**

Inside `VNTimelineSurface`, add these store actions and the handler:

```tsx
    const updateProject = useWorkspaceStore(s => s.updateProject);
    const addDocument = useWorkspaceStore(s => s.addDocument);

    const createSkeleton = (seasonCount: number, episodesPerSeason: number) => {
        if (!activeProjectId) return;

        const newSeasons: VNSeason[] = Array.from({ length: seasonCount }, (_, i) => ({
            id: crypto.randomUUID(),
            title: `Season ${i + 1}`,
            order: i,
        }));

        updateProject(activeProjectId, { seasons: newSeasons });

        for (const season of newSeasons) {
            for (let e = 0; e < episodesPerSeason; e += 1) {
                addDocument({
                    id: crypto.randomUUID(),
                    projectId: activeProjectId,
                    title: `Episode ${e + 1}`,
                    content: '',
                    createdAt: new Date(),
                    seasonId: season.id,
                    order: e,
                    decisions: [],
                });
            }
        }
    };
```

Then, just before the main `return`, add:

```tsx
    if (!seasons.length && !episodes.length) {
        return <TimelineSetup onCreate={createSkeleton} />;
    }
```

**This must come after every hook**, or the hook order changes between renders and React crashes.

- [ ] **Step 3: Add the styles**

Append to `VNTimeline.module.css`:

```css
.setup {
    margin: auto;
    padding: 2rem;
    max-width: 24rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
}

.setup h2 { margin: 0; font-size: 1.15rem; }
.setupHint { margin: 0; opacity: 0.55; font-size: 0.82rem; }

.setupRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.9rem;
}

.setupRow input {
    width: 5rem;
    padding: 0.35rem 0.5rem;
    font: inherit;
}

.setupGo {
    margin-top: 0.6rem;
    padding: 0.55rem 1rem;
    font: inherit;
    cursor: pointer;
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 323 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/vn/VNTimelineSurface.tsx src/components/editor/vn/VNTimeline.module.css
git commit -m "feat: lay a season and episode skeleton from one question"
```

---

### Task 4: Detail per tier

Boxes currently show only a title at every zoom. This gives each tier what it is for.

**Files:**
- Create: `src/components/editor/vn/VNEpisodeBox.tsx`
- Modify: `src/components/editor/vn/VNTimelineSurface.tsx`
- Modify: `src/components/editor/vn/VNTimeline.module.css`

- [ ] **Step 1: Write the episode box**

Create `src/components/editor/vn/VNEpisodeBox.tsx`:

```tsx
"use client";

/**
 * VNEpisodeBox — one episode, drawn for the tier the canvas is showing.
 *
 * Zoomed out it is a card with counts; zoomed in it lists its decisions. The
 * same box, more or less of it — no separate views to keep in step.
 */

import React from 'react';
import type { VNDecision, VNTier } from '@/lib/vnTimeline';
import styles from './VNTimeline.module.css';

interface VNEpisodeBoxProps {
    title: string;
    decisions: VNDecision[];
    tier: VNTier;
    collapsed: boolean;
    onTitleChange: (title: string) => void;
}

export function VNEpisodeBox({ title, decisions, tier, collapsed, onTitleChange }: VNEpisodeBoxProps) {
    const major = decisions.filter(d => d.kind === 'major').length;
    const minor = decisions.length - major;

    if (collapsed || tier === 'story') {
        return <div className={styles.boxTitle}>{title}</div>;
    }

    if (tier === 'season') {
        return (
            <>
                <div className={styles.boxTitle}>{title}</div>
                <div className={styles.counts}>
                    <span className={styles.major}>◆ {major}</span>
                    <span className={styles.minor}>◇ {minor}</span>
                </div>
            </>
        );
    }

    return (
        <>
            <input
                className={styles.titleInput}
                value={title}
                onClick={e => e.stopPropagation()}
                onChange={e => onTitleChange(e.target.value)}
            />
            <div className={styles.decisionList}>
                {decisions.length === 0 && (
                    <p className={styles.empty}>No decisions yet.</p>
                )}
                {[...decisions].sort((a, b) => a.order - b.order).map(d => (
                    <div key={d.id} className={styles.decisionRow}>
                        <span className={d.kind === 'major' ? styles.major : styles.minor}>
                            {d.kind === 'major' ? '◆' : '◇'}
                        </span>
                        <span className={styles.decisionPrompt}>{d.prompt || 'Untitled decision'}</span>
                        <span className={styles.optionCount}>{d.options.length} options</span>
                    </div>
                ))}
            </div>
        </>
    );
}
```

- [ ] **Step 2: Render it**

In `VNTimelineSurface.tsx`, add the imports:

```tsx
import { VNEpisodeBox } from './VNEpisodeBox';
```

Add the store action and a lookup near the other selectors:

```tsx
    const updateDocument = useWorkspaceStore(s => s.updateDocument);
    const episodeById = new Map(episodes.map(e => [e.id, e]));
```

Replace the box body in the render — the `<div className={styles.boxTitle}>{box.title}</div>` line — with:

```tsx
                            {box.kind === 'episode' ? (
                                <VNEpisodeBox
                                    title={box.title}
                                    decisions={episodeById.get(box.id)?.decisions ?? []}
                                    tier={tier}
                                    collapsed={box.collapsed}
                                    onTitleChange={title => updateDocument(box.id, { title })}
                                />
                            ) : (
                                <div className={styles.boxTitle}>{box.title}</div>
                            )}
```

- [ ] **Step 3: Add the styles**

Append to `VNTimeline.module.css`:

```css
.counts {
    display: flex;
    gap: 0.6rem;
    padding: 0 0.7rem;
    font-size: 0.75rem;
}

.major { color: #b9a6ff; }
.minor { color: #9ad19a; }

.titleInput {
    width: calc(100% - 1.4rem);
    margin: 0.35rem 0.7rem 0.1rem;
    border: none;
    background: transparent;
    font: inherit;
    font-weight: 600;
    font-size: 0.85rem;
}

.decisionList {
    padding: 0.2rem 0.7rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.decisionRow {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.76rem;
}

.decisionPrompt { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.optionCount { opacity: 0.45; font-size: 0.7rem; }
.empty { margin: 0; opacity: 0.4; font-size: 0.74rem; }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 323 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/vn/VNEpisodeBox.tsx src/components/editor/vn/VNTimelineSurface.tsx src/components/editor/vn/VNTimeline.module.css
git commit -m "feat: draw each episode for the tier being viewed"
```

---

### Task 5: Editing decisions

**Files:**
- Create: `src/components/editor/vn/VNDecisionEditor.tsx`
- Modify: `src/components/editor/vn/VNTimelineSurface.tsx`
- Modify: `src/components/editor/vn/VNTimeline.module.css`

- [ ] **Step 1: Write the editor**

Create `src/components/editor/vn/VNDecisionEditor.tsx`:

```tsx
"use client";

/**
 * VNDecisionEditor — one decision and its options, at the deepest zoom.
 *
 * Every operand comes from the declared flag registry; nothing here is free
 * text that reaches the generated script. A minor decision has no route
 * control at all, which is what makes "minor never changes direction" a rule
 * rather than a label.
 */

import React from 'react';
import type { VNDecision, VNOption } from '@/lib/vnTimeline';
import type { VNEffect, VNFlag } from '@/lib/vnFlags';
import styles from './VNTimeline.module.css';

interface VNDecisionEditorProps {
    decision: VNDecision;
    flags: VNFlag[];
    episodes: { id: string; title: string }[];
    onChange: (patch: Partial<VNDecision>) => void;
    onRemove: () => void;
}

export function VNDecisionEditor({ decision, flags, episodes, onChange, onRemove }: VNDecisionEditorProps) {
    const setOptions = (options: VNOption[]) => onChange({ options });

    const updateOption = (id: string, patch: Partial<VNOption>) =>
        setOptions(decision.options.map(o => (o.id === id ? { ...o, ...patch } : o)));

    const addOption = () =>
        setOptions([...decision.options, { id: crypto.randomUUID(), text: '' }]);

    const flagById = (id: string) => flags.find(f => f.id === id);

    return (
        <div className={styles.decisionEditor} onClick={e => e.stopPropagation()}>
            <div className={styles.decisionHead}>
                <select
                    value={decision.kind}
                    onChange={e => {
                        const kind = e.target.value as VNDecision['kind'];
                        // A minor decision cannot route, so drop any route it had.
                        onChange(kind === 'minor'
                            ? { kind, options: decision.options.map(o => ({ ...o, routeToEpisodeId: undefined })) }
                            : { kind });
                    }}
                >
                    <option value="major">◆ major</option>
                    <option value="minor">◇ minor</option>
                </select>

                <input
                    className={styles.promptInput}
                    value={decision.prompt}
                    placeholder="What is being decided?"
                    onChange={e => onChange({ prompt: e.target.value })}
                />

                <button type="button" onClick={onRemove} aria-label="Remove decision">×</button>
            </div>

            {decision.options.map(option => (
                <div key={option.id} className={styles.optionRow}>
                    <input
                        className={styles.optionText}
                        value={option.text}
                        placeholder="What the player sees"
                        onChange={e => updateOption(option.id, { text: e.target.value })}
                    />

                    <select
                        value={option.effects?.[0]?.flagId ?? ''}
                        onChange={e => {
                            const flagId = e.target.value;
                            if (!flagId) return updateOption(option.id, { effects: undefined });
                            const flag = flagById(flagId);
                            const effect: VNEffect = {
                                flagId,
                                op: flag?.kind === 'counter' ? 'add' : 'set',
                                value: flag?.kind === 'counter' ? 1 : undefined,
                            };
                            updateOption(option.id, { effects: [effect] });
                        }}
                    >
                        <option value="">sets nothing</option>
                        {flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>

                    {decision.kind === 'major' && (
                        <select
                            value={option.routeToEpisodeId ?? ''}
                            title="Leave blank to rejoin and carry on"
                            onChange={e => updateOption(option.id, {
                                routeToEpisodeId: e.target.value || undefined,
                            })}
                        >
                            <option value="">rejoins</option>
                            {episodes.map(ep => (
                                <option key={ep.id} value={ep.id}>→ {ep.title}</option>
                            ))}
                        </select>
                    )}

                    <button
                        type="button"
                        onClick={() => setOptions(decision.options.filter(o => o.id !== option.id))}
                        aria-label="Remove option"
                    >
                        ×
                    </button>
                </div>
            ))}

            <button type="button" className={styles.addOption} onClick={addOption}>
                + option
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Render decisions at the deepest tier**

In `VNTimelineSurface.tsx`, add:

```tsx
import { VNDecisionEditor } from './VNDecisionEditor';
```

and near the other selectors:

```tsx
    const flags = useWorkspaceStore(useShallow(s =>
        s.projects.find(p => p.id === activeProjectId)?.vnFlags ?? [],
    ));
    const episodeChoices = episodes.map(e => ({ id: e.id, title: e.title }));

    /** Decisions live on their episode, so every edit writes the whole array. */
    const updateDecision = (episodeId: string, decisionId: string, patch: Partial<VNDecision>) => {
        const current = episodeById.get(episodeId)?.decisions ?? [];
        updateDocument(episodeId, {
            decisions: current.map(d => (d.id === decisionId ? { ...d, ...patch } : d)),
        });
    };

    const removeDecision = (episodeId: string, decisionId: string) => {
        const current = episodeById.get(episodeId)?.decisions ?? [];
        updateDocument(episodeId, { decisions: current.filter(d => d.id !== decisionId) });
    };

    const addDecision = (episodeId: string) => {
        const current = episodeById.get(episodeId)?.decisions ?? [];
        updateDocument(episodeId, {
            decisions: [...current, {
                id: crypto.randomUUID(),
                kind: 'minor' as const,
                prompt: '',
                order: current.length,
                options: [],
            }],
        });
    };
```

In the box render, add a branch for decision boxes before the episode branch:

```tsx
                            {box.kind === 'decision' ? (() => {
                                const episodeId = box.parentId!;
                                const decision = episodeById.get(episodeId)?.decisions
                                    ?.find(d => d.id === box.id);
                                if (!decision) return null;
                                return tier === 'decision' ? (
                                    <VNDecisionEditor
                                        decision={decision}
                                        flags={flags}
                                        episodes={episodeChoices}
                                        onChange={patch => updateDecision(episodeId, decision.id, patch)}
                                        onRemove={() => removeDecision(episodeId, decision.id)}
                                    />
                                ) : (
                                    <div className={styles.boxTitle}>
                                        {decision.prompt || 'Untitled decision'}
                                    </div>
                                );
                            })() : box.kind === 'episode' ? (
```

closing the existing episode/else structure accordingly.

Add an "add decision" control to the focused episode. Inside the episode branch, after `<VNEpisodeBox …/>`, add:

```tsx
                                    {focus?.kind === 'episode' && focus.id === box.id && (
                                        <button
                                            type="button"
                                            className={styles.addDecision}
                                            onClick={e => { e.stopPropagation(); addDecision(box.id); }}
                                        >
                                            + decision
                                        </button>
                                    )}
```

- [ ] **Step 3: Add the styles**

Append to `VNTimeline.module.css`:

```css
.decisionEditor {
    padding: 0.4rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.76rem;
}

.decisionHead { display: flex; align-items: center; gap: 0.4rem; }
.promptInput { flex: 1; border: none; background: transparent; font: inherit; min-width: 0; }

.optionRow {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: 0.35rem;
    align-items: center;
}

.optionText { border: none; background: transparent; font: inherit; min-width: 0; }
.optionRow select, .decisionHead select { font: inherit; font-size: 0.72rem; }

.addOption, .addDecision {
    align-self: flex-start;
    border: none;
    background: transparent;
    cursor: pointer;
    opacity: 0.6;
    font: inherit;
    font-size: 0.74rem;
}

.addOption:hover, .addDecision:hover { opacity: 1; }
.addDecision { margin: 0 0.7rem 0.5rem; }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 323 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/vn/VNDecisionEditor.tsx src/components/editor/vn/VNTimelineSurface.tsx src/components/editor/vn/VNTimeline.module.css
git commit -m "feat: edit decisions and their options on the timeline"
```

---

### Task 6: Flags and export

**Files:**
- Modify: `src/components/editor/vn/VNTimelineSurface.tsx`
- Modify: `src/components/editor/vn/VNTimeline.module.css`

- [ ] **Step 1: Add the panel and the button**

In `VNTimelineSurface.tsx`, add the imports:

```tsx
import { VNFlagsRenderer } from '@/components/editor/desk/widgets/VNFlagsRenderer';
import { exportAsRenpy } from '@/lib/export';
import { worldKeyForProject, worldKeyForEntity } from '@/lib/worldKey';
```

Add the cast selector beside the others — the same shelf-scoped pattern used elsewhere in the app:

```tsx
    const castNames = useWorkspaceStore(useShallow(s =>
        s.entities
            .filter(e => worldKeyForEntity(e) === worldKeyForProject(project) && e.type === 'character')
            .map(e => e.name),
    ));
```

Add a `showFlags` state beside the others:

```tsx
    const [showFlags, setShowFlags] = useState(false);
```

In the toolbar, before the zoom controls:

```tsx
                <button type="button" onClick={() => setShowFlags(v => !v)}>
                    {showFlags ? 'Hide flags' : 'Flags'}
                </button>
                <button
                    type="button"
                    onClick={() => exportAsRenpy(
                        seasons, episodes, castNames, project?.name ?? 'visual-novel', flags)}
                >
                    Export to Ren&apos;Py
                </button>
```

After the viewport div, inside `.surface`:

```tsx
            {showFlags && (
                <div className={styles.flagsDock}>
                    <VNFlagsRenderer />
                </div>
            )}
```

- [ ] **Step 2: Add the styles**

Append to `VNTimeline.module.css`:

```css
.flagsDock {
    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    max-height: 14rem;
    overflow: auto;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 323 tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/vn/VNTimelineSurface.tsx src/components/editor/vn/VNTimeline.module.css
git commit -m "feat: declare flags and export from the timeline"
```

---

## Done when

- `npm test` passes at roughly 323 tests across 36 files
- `npx tsc --noEmit` exits 0
- `grep -rn "vnBlock\|VNBlockChoice\|flattenBlocksToScenes" src/` finds nothing
- A visual novel project's Draft Table asks how many seasons and episodes, then draws them
- Clicking a season frames it and its episodes stack vertically; clicking an episode frames that
- Zooming changes how much each box shows
- Export downloads a `.rpy` built from the timeline

## Browser verification is required, not optional

The previous cycle shipped 306 passing tests alongside a component that crashed the workspace on first click. **Do not report this phase complete on tests alone.** Open a visual novel project, run the setup, click into a season, click into an episode, add a decision, add an option, and export. Watch the console for `Maximum update depth exceeded`, which is what a bad `useShallow` selector produces.
