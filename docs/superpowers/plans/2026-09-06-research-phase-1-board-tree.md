# Research Phase 1 — The Board Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a research board contain another research board, navigate the resulting tree with
breadcrumbs, and give every board an unsorted inbox that quick capture writes into.

**Architecture:** A board registry keyed by the *existing* `researchStates` keys, so migration
moves no board data. `parentId` gives nesting; a `board` widget on a canvas points at a child by
id. Each board's `DeskState` gains an `unsorted` array whose cards have no meaningful position.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Zustand + persist, Vitest (jsdom),
CSS Modules.

---

## Before you start

Read these three things:

1. `src/lib/deskStages.ts` — the house style for a leaf module. 4-space indent, no store import
   beyond types, no React, a doc comment saying LEAF MODULE.
2. `vitest.config.ts` — it collects **`src/**/*.test.ts` only**. A `.test.tsx` file is silently
   never run. Every rule in this plan therefore lives in a `.ts` leaf module.
3. `src/store/workspaceStore.ts:336` — `DeskWidget`, and `:350` `DeskState`.

Current state to be aware of:

- `researchStates: Record<string, DeskState>` keyed `project:<projectId>` or
  `project:<projectId>::<boardId>`
- `customBoards: Record<string, ResearchBoard[]>` keyed by the *base* key, holding `{id, name}`
- `src/components/editor/ResearchTab.tsx` builds the key with `researchScopeKey('project', p)`
- `src/components/editor/research/ResearchBoardBar.tsx` is the current one-level board switcher

---

## Task 1: The board tree leaf module

**Files:**
- Create: `src/lib/research/boardTree.ts`
- Test: `src/lib/research/boardTree.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
    breadcrumbFor, childrenOf, descendantIds, canMove, rootBoardIdFor,
    type ResearchBoardNode,
} from './boardTree';

const REG: Record<string, ResearchBoardNode> = {
    'project:p1':        { id: 'project:p1',        name: 'Main',      parentId: null,           projectId: 'p1' },
    'project:p1::siege': { id: 'project:p1::siege', name: 'Siege',     parentId: 'project:p1',   projectId: 'p1' },
    'b-def':             { id: 'b-def',             name: 'Defenders', parentId: 'project:p1::siege', projectId: 'p1' },
    'project:p2':        { id: 'project:p2',        name: 'Main',      parentId: null,           projectId: 'p2' },
};

describe('breadcrumbFor', () => {
    it('walks from the root down to the board itself', () => {
        expect(breadcrumbFor(REG, 'b-def').map(b => b.name)).toEqual(['Main', 'Siege', 'Defenders']);
    });

    it('is just the board when it is a root', () => {
        expect(breadcrumbFor(REG, 'project:p1').map(b => b.name)).toEqual(['Main']);
    });

    it('is empty for a board that is not in the registry', () => {
        expect(breadcrumbFor(REG, 'nope')).toEqual([]);
    });

    it('stops rather than looping when a cycle exists', () => {
        const cyclic: Record<string, ResearchBoardNode> = {
            a: { id: 'a', name: 'A', parentId: 'b', projectId: 'p1' },
            b: { id: 'b', name: 'B', parentId: 'a', projectId: 'p1' },
        };
        expect(breadcrumbFor(cyclic, 'a').length).toBeLessThanOrEqual(2);
    });
});

describe('childrenOf', () => {
    it('lists direct children only, by name', () => {
        expect(childrenOf(REG, 'project:p1').map(b => b.id)).toEqual(['project:p1::siege']);
    });

    it('lists the roots of a project when parentId is null', () => {
        expect(childrenOf(REG, null, 'p1').map(b => b.id)).toEqual(['project:p1']);
    });

    it('is empty for a leaf', () => {
        expect(childrenOf(REG, 'b-def')).toEqual([]);
    });
});

describe('descendantIds', () => {
    it('collects the whole subtree, excluding the board itself', () => {
        expect(descendantIds(REG, 'project:p1').sort()).toEqual(['b-def', 'project:p1::siege']);
    });

    it('is empty for a leaf', () => {
        expect(descendantIds(REG, 'b-def')).toEqual([]);
    });
});

describe('rootBoardIdFor', () => {
    it('finds the project root', () => {
        expect(rootBoardIdFor(REG, 'p1')).toBe('project:p1');
    });

    it('returns null when the project has no board yet', () => {
        expect(rootBoardIdFor(REG, 'p9')).toBeNull();
    });
});

describe('canMove', () => {
    it('refuses to move a board into its own descendant', () => {
        expect(canMove(REG, 'project:p1', 'b-def')).toBe(false);
    });

    it('refuses to move a board into itself', () => {
        expect(canMove(REG, 'b-def', 'b-def')).toBe(false);
    });

    it('allows a move to an unrelated board', () => {
        expect(canMove(REG, 'b-def', 'project:p1')).toBe(true);
    });

    it('allows a move to the root', () => {
        expect(canMove(REG, 'b-def', null)).toBe(true);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/research/boardTree.test.ts`
Expected: FAIL — `Failed to resolve import "./boardTree"`.

- [ ] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — the research board tree.
 *
 * A board's id is whatever key it already has in researchStates, so nesting was
 * added without moving a single board. Legacy ids look like `project:<id>` or
 * `project:<id>::<boardId>`; new boards get a UUID. Nothing reads meaning out
 * of an id — the registry's parentId is the only thing that describes shape.
 *
 * No store import beyond types, no React, 4-space indent.
 */

export interface ResearchBoardNode {
    id: string;
    name: string;
    /** null = a project's root board. */
    parentId: string | null;
    projectId: string;
}

export type BoardRegistry = Record<string, ResearchBoardNode>;

/** Guards every parent walk. Deeper than this is a cycle or a mistake. */
const MAX_DEPTH = 32;

/** Root first, the board itself last. Empty if the board is unknown. */
export function breadcrumbFor(reg: BoardRegistry, boardId: string): ResearchBoardNode[] {
    const path: ResearchBoardNode[] = [];
    const seen = new Set<string>();
    let cursor: string | null = boardId;

    while (cursor && path.length < MAX_DEPTH) {
        if (seen.has(cursor)) break;   // a cycle: stop rather than hang
        seen.add(cursor);
        const node: ResearchBoardNode | undefined = reg[cursor];
        if (!node) break;
        path.unshift(node);
        cursor = node.parentId;
    }
    return path;
}

/**
 * Direct children, name-sorted. Pass parentId null with a projectId to list
 * that project's roots.
 */
export function childrenOf(
    reg: BoardRegistry,
    parentId: string | null,
    projectId?: string,
): ResearchBoardNode[] {
    return Object.values(reg)
        .filter(n => n.parentId === parentId && (parentId !== null || !projectId || n.projectId === projectId))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every board beneath this one, at any depth. Excludes the board itself. */
export function descendantIds(reg: BoardRegistry, boardId: string): string[] {
    const out: string[] = [];
    const queue = [boardId];
    const seen = new Set<string>([boardId]);

    while (queue.length) {
        const current = queue.shift()!;
        for (const node of Object.values(reg)) {
            if (node.parentId !== current || seen.has(node.id)) continue;
            seen.add(node.id);
            out.push(node.id);
            queue.push(node.id);
        }
    }
    return out;
}

export function rootBoardIdFor(reg: BoardRegistry, projectId: string): string | null {
    const root = Object.values(reg).find(n => n.projectId === projectId && n.parentId === null);
    return root ? root.id : null;
}

/** A board cannot be moved into itself or anything below it. */
export function canMove(reg: BoardRegistry, boardId: string, targetParentId: string | null): boolean {
    if (targetParentId === null) return true;
    if (targetParentId === boardId) return false;
    return !descendantIds(reg, boardId).includes(targetParentId);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/research/boardTree.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/boardTree.ts src/lib/research/boardTree.test.ts
git commit -m "feat: research board tree — registry, breadcrumbs, descendants"
```

---

## Task 2: Derive the registry from existing data

**Files:**
- Create: `src/lib/research/boardMigration.ts`
- Test: `src/lib/research/boardMigration.test.ts`

This is the only irreversible step in the phase. It reads `researchStates` keys and
`customBoards` names and produces the registry. It writes no board content.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildRegistry } from './boardMigration';

describe('buildRegistry', () => {
    it('makes a root board from a bare project key', () => {
        const reg = buildRegistry({ 'project:p1': {} }, {});
        expect(reg['project:p1']).toEqual({
            id: 'project:p1', name: 'Main', parentId: null, projectId: 'p1',
        });
    });

    it('hangs a composite key under its base as a child', () => {
        const reg = buildRegistry(
            { 'project:p1': {}, 'project:p1::b7': {} },
            { 'project:p1': [{ id: 'b7', name: 'Siege' }] },
        );
        expect(reg['project:p1::b7']).toEqual({
            id: 'project:p1::b7', name: 'Siege', parentId: 'project:p1', projectId: 'p1',
        });
    });

    it('names a child Untitled board when customBoards has forgotten it', () => {
        const reg = buildRegistry({ 'project:p1': {}, 'project:p1::gone': {} }, {});
        expect(reg['project:p1::gone'].name).toBe('Untitled board');
        expect(reg['project:p1::gone'].parentId).toBe('project:p1');
    });

    it('creates the missing root when only a child board was persisted', () => {
        // A board bar entry can outlive its base key if the base was never drawn on.
        const reg = buildRegistry({ 'project:p1::b7': {} }, { 'project:p1': [{ id: 'b7', name: 'Siege' }] });
        expect(reg['project:p1']).toBeDefined();
        expect(reg['project:p1'].parentId).toBeNull();
        expect(reg['project:p1::b7'].parentId).toBe('project:p1');
    });

    it('ignores world-scoped boards, which have no screen any more', () => {
        const reg = buildRegistry({ 'project:p1': {}, 'world:w1': {} }, {});
        expect(reg['world:w1']).toBeUndefined();
        expect(Object.keys(reg)).toEqual(['project:p1']);
    });

    it('returns an empty registry for an empty workspace', () => {
        expect(buildRegistry({}, {})).toEqual({});
    });

    it('is idempotent — running it on its own output changes nothing', () => {
        const states = { 'project:p1': {}, 'project:p1::b7': {} };
        const boards = { 'project:p1': [{ id: 'b7', name: 'Siege' }] };
        expect(buildRegistry(states, boards)).toEqual(buildRegistry(states, boards));
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/research/boardMigration.test.ts`
Expected: FAIL — `Failed to resolve import "./boardMigration"`.

- [ ] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — derive the board registry from the shape research boards had
 * before they could nest.
 *
 * Board data is NOT touched. researchStates keeps its keys; this only works out
 * what each key means. Legacy keys are `project:<id>` (a root) and
 * `project:<id>::<boardId>` (its child, named in customBoards).
 *
 * World-scoped keys are skipped: the This Project / This World switcher was
 * removed in 522995a, so those boards have no screen. They stay in
 * researchStates untouched, ready for whatever replaces that switcher.
 */

import type { BoardRegistry, ResearchBoardNode } from './boardTree';

const PROJECT_PREFIX = 'project:';
const CHILD_SEPARATOR = '::';

/** Name used when a composite key has no matching customBoards entry. */
export const ORPHAN_BOARD_NAME = 'Untitled board';

/** Name given to a project's root board. */
export const ROOT_BOARD_NAME = 'Main';

interface LegacyBoard { id: string; name: string }

export function buildRegistry(
    researchStates: Record<string, unknown>,
    customBoards: Record<string, LegacyBoard[]>,
): BoardRegistry {
    const reg: BoardRegistry = {};

    const ensureRoot = (projectId: string): string => {
        const rootId = `${PROJECT_PREFIX}${projectId}`;
        if (!reg[rootId]) {
            reg[rootId] = { id: rootId, name: ROOT_BOARD_NAME, parentId: null, projectId };
        }
        return rootId;
    };

    for (const key of Object.keys(researchStates)) {
        if (!key.startsWith(PROJECT_PREFIX)) continue;   // world: and anything else

        const body = key.slice(PROJECT_PREFIX.length);
        const sep = body.indexOf(CHILD_SEPARATOR);

        if (sep === -1) {
            ensureRoot(body);
            continue;
        }

        const projectId = body.slice(0, sep);
        const childId = body.slice(sep + CHILD_SEPARATOR.length);
        const parentId = ensureRoot(projectId);
        const named = (customBoards[parentId] ?? []).find(b => b.id === childId);

        const node: ResearchBoardNode = {
            id: key,
            name: named ? named.name : ORPHAN_BOARD_NAME,
            parentId,
            projectId,
        };
        reg[key] = node;
    }

    return reg;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/research/boardMigration.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/boardMigration.ts src/lib/research/boardMigration.test.ts
git commit -m "feat: derive the research board registry from legacy keys"
```

---

## Task 3: The unsorted tray leaf module

**Files:**
- Create: `src/lib/research/unsorted.ts`
- Test: `src/lib/research/unsorted.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { toTray, fromTray, trayCount } from './unsorted';
import type { DeskWidget } from '@/store/workspaceStore';

const card = (id: string): DeskWidget => ({
    id, type: 'sticky', x: 40, y: 40, width: 200, height: 160, content: { text: id },
});

describe('toTray', () => {
    it('moves a card off the canvas and onto the end of the tray', () => {
        const r = toTray({ widgets: [card('a'), card('b')], unsorted: [card('z')] }, 'a');
        expect(r.widgets.map(w => w.id)).toEqual(['b']);
        expect(r.unsorted.map(w => w.id)).toEqual(['z', 'a']);
    });

    it('leaves everything alone when the id is not on the canvas', () => {
        const before = { widgets: [card('a')], unsorted: [] };
        expect(toTray(before, 'nope')).toEqual(before);
    });

    it('treats a missing tray as empty', () => {
        const r = toTray({ widgets: [card('a')], unsorted: undefined }, 'a');
        expect(r.unsorted.map(w => w.id)).toEqual(['a']);
    });
});

describe('fromTray', () => {
    it('places the card at the drop point and takes it out of the tray', () => {
        const r = fromTray({ widgets: [], unsorted: [card('a'), card('b')] }, 'a', { x: 320, y: 96 });
        expect(r.unsorted.map(w => w.id)).toEqual(['b']);
        expect(r.widgets).toHaveLength(1);
        expect(r.widgets[0]).toMatchObject({ id: 'a', x: 320, y: 96 });
    });

    it('leaves everything alone when the id is not in the tray', () => {
        const before = { widgets: [], unsorted: [card('a')] };
        expect(fromTray(before, 'nope', { x: 10, y: 10 })).toEqual(before);
    });

    it('keeps the card size and content intact across the move', () => {
        const r = fromTray({ widgets: [], unsorted: [card('a')] }, 'a', { x: 5, y: 5 });
        expect(r.widgets[0].width).toBe(200);
        expect(r.widgets[0].content).toEqual({ text: 'a' });
    });
});

describe('trayCount', () => {
    it('counts the tray', () => {
        expect(trayCount({ unsorted: [card('a'), card('b')] })).toBe(2);
    });

    it('is 0 when the tray is missing', () => {
        expect(trayCount({})).toBe(0);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/research/unsorted.test.ts`
Expected: FAIL — `Failed to resolve import "./unsorted"`.

- [ ] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — the per-board unsorted tray.
 *
 * Anything dropped on a board lands here before the writer decides where it
 * goes. A card in the tray keeps its size and content but its x/y mean
 * nothing until it is dragged out, which is the moment they are set.
 *
 * Every function returns new arrays. Nothing is mutated.
 */

import type { DeskWidget } from '@/store/workspaceStore';

interface TrayState {
    widgets?: DeskWidget[];
    unsorted?: DeskWidget[];
}

interface TrayResult {
    widgets: DeskWidget[];
    unsorted: DeskWidget[];
}

export function trayCount(state: TrayState): number {
    return state.unsorted?.length ?? 0;
}

/** Canvas -> tray. A no-op if the card is not on the canvas. */
export function toTray(state: TrayState, widgetId: string): TrayResult {
    const widgets = state.widgets ?? [];
    const unsorted = state.unsorted ?? [];
    const moving = widgets.find(w => w.id === widgetId);
    if (!moving) return { widgets, unsorted };

    return {
        widgets: widgets.filter(w => w.id !== widgetId),
        unsorted: [...unsorted, moving],
    };
}

/** Tray -> canvas at `at`. A no-op if the card is not in the tray. */
export function fromTray(
    state: TrayState,
    widgetId: string,
    at: { x: number; y: number },
): TrayResult {
    const widgets = state.widgets ?? [];
    const unsorted = state.unsorted ?? [];
    const moving = unsorted.find(w => w.id === widgetId);
    if (!moving) return { widgets, unsorted };

    return {
        widgets: [...widgets, { ...moving, x: at.x, y: at.y }],
        unsorted: unsorted.filter(w => w.id !== widgetId),
    };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/research/unsorted.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/unsorted.ts src/lib/research/unsorted.test.ts
git commit -m "feat: unsorted tray move rules"
```

---

## Task 4: Wire the registry and tray into the store

**Files:**
- Modify: `src/store/workspaceStore.ts`

- [ ] **Step 1: Add the state field and the widget type**

At the `DeskWidgetType` union (line ~323) add `'board'`:

```ts
export type DeskWidgetType = 'writingZone' | 'sticky' | 'reference' | 'image' | 'biblePinit' | 'sceneControl' | 'characterState' | 'continuity' | 'structure' | 'research' | 'progress' | 'relMap' | 'draftNav' | 'beatCard' | 'articleSuggestions' | 'consistencyFlags' | 'worldUnderstanding' | 'board' | 'untyped';
```

In `DeskState` (line ~350) add the tray:

```ts
    /** Research boards only: the inbox anything dropped on the board lands in. */
    unsorted?: DeskWidget[];
```

In `WorkspaceState` add, next to `customBoards`:

```ts
    /** Every research board, by id, with its place in the tree. */
    researchBoards: BoardRegistry;
```

Import the types at the top of the file:

```ts
import { buildRegistry } from '@/lib/research/boardMigration';
import type { BoardRegistry, ResearchBoardNode } from '@/lib/research/boardTree';
```

- [ ] **Step 2: Add the actions**

Declare them beside `updateResearchState`:

```ts
    createResearchBoard: (name: string, parentId: string, projectId: string) => string;
    renameResearchBoard: (boardId: string, name: string) => void;
    deleteResearchBoard: (boardId: string) => void;
    moveResearchBoard: (boardId: string, newParentId: string | null) => void;
```

Implement them beside the existing research actions. `deleteResearchBoard` must take the whole
subtree with it, or the registry keeps orphans that `breadcrumbFor` will not resolve:

```ts
            createResearchBoard: (name, parentId, projectId) => {
                const id = crypto.randomUUID();
                set(state => ({
                    researchBoards: {
                        ...state.researchBoards,
                        [id]: { id, name, parentId, projectId },
                    },
                }));
                return id;
            },

            renameResearchBoard: (boardId, name) => set(state => {
                const node = state.researchBoards[boardId];
                if (!node) return {};
                return { researchBoards: { ...state.researchBoards, [boardId]: { ...node, name } } };
            }),

            deleteResearchBoard: (boardId) => set(state => {
                // The subtree goes too — an orphaned child can never be reached.
                const doomed = new Set([boardId, ...descendantIds(state.researchBoards, boardId)]);
                const researchBoards: BoardRegistry = {};
                for (const [id, node] of Object.entries(state.researchBoards)) {
                    if (!doomed.has(id)) researchBoards[id] = node;
                }
                const researchStates = { ...state.researchStates };
                for (const id of doomed) delete researchStates[id];
                return { researchBoards, researchStates };
            }),

            moveResearchBoard: (boardId, newParentId) => set(state => {
                const node = state.researchBoards[boardId];
                if (!node || !canMove(state.researchBoards, boardId, newParentId)) return {};
                return {
                    researchBoards: {
                        ...state.researchBoards,
                        [boardId]: { ...node, parentId: newParentId },
                    },
                };
            }),
```

Add `descendantIds` and `canMove` to the boardTree import.

- [ ] **Step 3: Initialise and persist**

In the initial state, beside `customBoards: {}`:

```ts
            researchBoards: {},
```

In `partialize`, beside `customBoards`:

```ts
        researchBoards: state.researchBoards,
```

- [ ] **Step 4: Migrate on rehydration**

In `onRehydrateStorage`, after the workspace-mode migration added in `40250f3`:

```ts
                    // Boards could not nest before this. Derive the registry from
                    // the keys researchStates already has — no board data moves.
                    if (!state.researchBoards || Object.keys(state.researchBoards).length === 0) {
                        state.researchBoards = buildRegistry(
                            state.researchStates ?? {},
                            state.customBoards ?? {},
                        );
                    }
```

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/store/workspaceStore.ts
git commit -m "feat: research board registry in the store, derived on rehydration"
```

Expected: `tsc` exits 0.

---

## Task 5: The board card renderer

**Files:**
- Create: `src/components/editor/desk/widgets/BoardCardRenderer.tsx`
- Modify: `src/components/editor/desk/widgets/WidgetRenderer.tsx:59`
- Modify: `src/components/editor/desk/deskConstants.ts`

- [ ] **Step 1: Add the card's dimensions and palette entry**

In `deskConstants.ts`, in `DEFAULT_DIMS`:

```ts
  board:       { w: 220, h: 170 },
```

In `PALETTE_ITEMS`:

```ts
  { type: 'board',       icon: '🗂️', label: 'Board' },
```

- [ ] **Step 2: Write the renderer**

```tsx
"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './BoardCardRenderer.module.css';

interface BoardCardContent {
    boardId?: string;
}

interface Props {
    content: BoardCardContent;
    onOpenBoard: (boardId: string) => void;
}

/**
 * A nested board, as it appears on its parent's canvas.
 *
 * The preview is a count and a few coloured slots rather than a live thumbnail:
 * rendering the child's widgets here would mean subscribing this card to every
 * keystroke on a board the writer is not even looking at.
 */
export function BoardCardRenderer({ content, onOpenBoard }: Props) {
    const boardId = content.boardId ?? null;
    const node = useWorkspaceStore(s => (boardId ? s.researchBoards[boardId] : undefined));
    const count = useWorkspaceStore(s => (boardId ? s.researchStates[boardId]?.widgets?.length ?? 0 : 0));

    if (!boardId || !node) {
        return <div className={styles.missing}>This board was deleted.</div>;
    }

    return (
        <button
            className={styles.card}
            onDoubleClick={() => onOpenBoard(boardId)}
            aria-label={`Open board ${node.name}, ${count} item${count === 1 ? '' : 's'}`}
        >
            <span className={styles.name}>{node.name}</span>
            <span className={styles.slots} aria-hidden="true">
                {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                    <i key={i} className={styles.slot} />
                ))}
            </span>
            <span className={styles.count}>{count} item{count === 1 ? '' : 's'}</span>
        </button>
    );
}
```

- [ ] **Step 3: Write its stylesheet**

Create `src/components/editor/desk/widgets/BoardCardRenderer.module.css`:

```css
.card {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; gap: var(--space-3);
  padding: var(--space-4);
  background: transparent; border: none; cursor: pointer;
  text-align: left; color: var(--foreground);
}
.card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.name { font-size: var(--text-sm); font-weight: 600; color: var(--accent); }
.slots { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
.slot { height: 18px; border-radius: var(--radius-sm); background: rgba(var(--overlay-rgb), 0.10); }
.count { margin-top: auto; font-size: var(--text-2xs); color: var(--muted); }
.missing { padding: var(--space-4); font-size: var(--text-xs); color: var(--muted); }
```

- [ ] **Step 4: Register it**

In `WidgetRenderer.tsx`, beside the other cases:

```tsx
    case 'board':       return <BoardCardRenderer content={content} onOpenBoard={onOpenBoard} />;
```

`onOpenBoard` threads down from `WritingDesk` the same way `onAddAtCenter` already does — add it
to `WidgetRenderer`'s props interface and to the `<WidgetRenderer ... />` call site in
`WritingDesk.tsx:756`.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/editor/desk/widgets/BoardCardRenderer.tsx src/components/editor/desk/widgets/BoardCardRenderer.module.css src/components/editor/desk/widgets/WidgetRenderer.tsx src/components/editor/desk/deskConstants.ts
git commit -m "feat: nested board card"
```

---

## Task 6: Breadcrumbs

**Files:**
- Create: `src/components/editor/research/BoardBreadcrumbs.tsx`
- Create: `src/components/editor/research/BoardBreadcrumbs.module.css`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { breadcrumbFor } from '@/lib/research/boardTree';
import styles from './BoardBreadcrumbs.module.css';

interface Props {
    boardId: string;
    onNavigate: (boardId: string) => void;
}

/** The path from the project's root board down to the one on screen. */
export function BoardBreadcrumbs({ boardId, onNavigate }: Props) {
    const registry = useWorkspaceStore(s => s.researchBoards);
    const trail = breadcrumbFor(registry, boardId);
    if (trail.length === 0) return null;

    return (
        <nav className={styles.crumbs} aria-label="Board path">
            {trail.map((node, i) => {
                const isLast = i === trail.length - 1;
                return (
                    <React.Fragment key={node.id}>
                        {i > 0 && <span className={styles.sep} aria-hidden="true">›</span>}
                        {isLast ? (
                            <span className={styles.current} aria-current="page">{node.name}</span>
                        ) : (
                            <button className={styles.crumb} onClick={() => onNavigate(node.id)}>
                                {node.name}
                            </button>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
}
```

- [ ] **Step 2: Write its stylesheet**

```css
.crumbs {
  display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border);
  font-size: var(--text-xs);
}
.crumb {
  background: none; border: none; cursor: pointer; padding: 2px 4px;
  color: var(--muted); border-radius: var(--radius-sm);
  font-size: inherit;
}
.crumb:hover { color: var(--foreground); }
.crumb:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.current { color: var(--foreground); font-weight: 600; padding: 2px 4px; }
.sep { color: var(--muted); opacity: 0.5; }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/research/BoardBreadcrumbs.tsx src/components/editor/research/BoardBreadcrumbs.module.css
git commit -m "feat: board breadcrumbs"
```

---

## Task 7: The unsorted tray component

**Files:**
- Create: `src/components/editor/research/UnsortedTray.tsx`
- Create: `src/components/editor/research/UnsortedTray.module.css`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { trayCount } from '@/lib/research/unsorted';
import styles from './UnsortedTray.module.css';

interface Props {
    boardId: string;
    onDragOut: (widgetId: string, at: { x: number; y: number }) => void;
}

/**
 * The board's inbox. Anything dropped on the board lands here first, so
 * capturing something never requires deciding where it belongs.
 */
export function UnsortedTray({ boardId, onDragOut }: Props) {
    const state = useWorkspaceStore(s => s.researchStates[boardId]);
    const cards = state?.unsorted ?? [];
    const count = trayCount(state ?? {});

    return (
        <aside className={styles.tray} aria-label="Unsorted notes">
            <header className={styles.head}>
                Unsorted <span className={styles.count}>{count}</span>
            </header>

            {cards.length === 0 ? (
                <p className={styles.empty}>
                    Nothing waiting. Drop a clipping or a note here and sort it later.
                </p>
            ) : (
                <ul className={styles.list}>
                    {cards.map(card => (
                        <li
                            key={card.id}
                            className={styles.card}
                            draggable
                            onDragEnd={e => onDragOut(card.id, { x: e.clientX, y: e.clientY })}
                        >
                            {String(card.content?.text ?? card.type)}
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
}
```

- [ ] **Step 2: Write its stylesheet**

```css
.tray {
  flex: 0 0 200px;
  border-left: 1px solid var(--border);
  background: rgba(var(--overlay-rgb), 0.02);
  padding: var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
  overflow-y: auto;
}
.head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: var(--text-2xs); letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--muted);
}
.count {
  background: rgba(var(--overlay-rgb), 0.10); border-radius: var(--radius-full);
  padding: 1px var(--space-2); color: var(--foreground);
}
.empty { font-size: var(--text-2xs); color: var(--muted); line-height: 1.5; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.card {
  background: var(--surface-high); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: var(--space-3);
  font-size: var(--text-xs); cursor: grab; line-height: 1.4;
}
@media (max-width: 900px) { .tray { display: none; } }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/research/UnsortedTray.tsx src/components/editor/research/UnsortedTray.module.css
git commit -m "feat: unsorted tray panel"
```

---

## Task 8: Rebuild ResearchTab around the tree

**Files:**
- Modify: `src/components/editor/ResearchTab.tsx`
- Delete: `src/components/editor/research/ResearchBoardBar.tsx`

The one-level board bar is replaced by breadcrumbs plus board cards on the canvas.

- [ ] **Step 1: Rewrite ResearchTab**

```tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { rootBoardIdFor } from '@/lib/research/boardTree';
import WritingDesk from './WritingDesk';
import { ResearchEmptyState } from './ResearchEmptyState';
import { BoardBreadcrumbs } from './research/BoardBreadcrumbs';
import { UnsortedTray } from './research/UnsortedTray';
import { ResearchRail } from './research/ResearchRail';
import styles from './WritingDesk.module.css';

/**
 * Research Tab — the Workshop's first stage.
 *
 * A tree of boards. The writer opens a board card to go down and a breadcrumb
 * to come back up; every board carries its own unsorted tray.
 */
export default function ResearchTab() {
    const activeProject = useWorkspaceStore(s =>
        s.projects.find(p => p.id === s.activeProjectId) ?? null
    );
    const registry = useWorkspaceStore(s => s.researchBoards);
    const rootId = activeProject ? rootBoardIdFor(registry, activeProject.id) : null;

    const [openBoardId, setOpenBoardId] = useState<string | null>(null);
    // Changing project drops you back at that project's root.
    useEffect(() => { setOpenBoardId(null); }, [activeProject?.id]);

    const boardId = openBoardId ?? rootId;

    if (!boardId) return <ResearchEmptyState />;

    return (
        <div className={styles.researchLayout}>
            <ResearchRail scopeKey={boardId} />
            <div className={styles.researchMain}>
                <BoardBreadcrumbs boardId={boardId} onNavigate={setOpenBoardId} />
                <div className={styles.researchCanvasHost}>
                    <WritingDesk variant="research" scopeKey={boardId} onOpenBoard={setOpenBoardId} />
                </div>
            </div>
            {/* handleDragOut is implemented in Task 9, Step 4. */}
            <UnsortedTray boardId={boardId} onDragOut={handleDragOut} />
        </div>
    );
}
```

- [ ] **Step 2: Delete the old board bar**

```bash
git rm src/components/editor/research/ResearchBoardBar.tsx
```

- [ ] **Step 3: Remove its orphaned CSS**

Delete the `.boardBar` and `.boardTab` rule blocks from
`src/components/editor/WritingDesk.module.css` (they begin near line 4760).

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: ResearchTab navigates the board tree"
```

---

## Task 9: Wire the tray and board creation into WritingDesk

**Files:**
- Modify: `src/components/editor/WritingDesk.tsx`

- [ ] **Step 1: Accept and thread `onOpenBoard`**

Add to `WritingDeskProps`:

```ts
  /** Research variant only: open a nested board. */
  onOpenBoard?: (boardId: string) => void;
```

Pass it to `WidgetRenderer` at the existing call site (line ~756).

- [ ] **Step 2: Make the Board tool create a board and its card together**

Extend `addAtCenter` so a `board` widget also registers a node:

```ts
  const addAtCenter = (type: DeskWidgetType) => {
    if (!viewportRef.current) return;
    const vW = viewportRef.current.clientWidth, vH = viewportRef.current.clientHeight, dims = DEFAULT_DIMS[type];
    const wx = (vW / 2 - canvasOffsetRef.current.x) / zoomRef.current - dims.w / 2, wy = (vH / 2 - canvasOffsetRef.current.y) / zoomRef.current - dims.h / 2;

    // A board card is a pointer. Register the board it points at, or the card
    // renders as "This board was deleted" the moment it appears.
    let content: Record<string, unknown> = {};
    if (type === 'board' && isResearch && stateKey && activeProjectId) {
      const newId = useWorkspaceStore.getState()
        .createResearchBoard('New board', stateKey, activeProjectId);
      content = { boardId: newId };
    }

    const nw: DeskWidget = { id: crypto.randomUUID(), type, x: wx, y: wy, width: dims.w, height: dims.h, content, dock: type === 'writingZone' ? 'center' : null };
    updateWidgets([...widgetsRef.current, nw]); setSelectedId(nw.id);
  };
```

- [ ] **Step 3: Add the six-item tool rail for the research variant**

Replace the three-button `isResearch` block near line 909 with the full toolbar:

```tsx
        {isResearch && (
          <div className={styles.topCenterControls}>
            <button className={styles.methodPickerBtn} onMouseDown={e => e.stopPropagation()} onClick={() => addAtCenter('sticky')}><StickyNote size={14} aria-hidden="true" /> Note</button>
            <button className={styles.methodPickerBtn} onMouseDown={e => e.stopPropagation()} onClick={() => addAtCenter('image')}><Image size={14} aria-hidden="true" /> Image</button>
            <button className={styles.methodPickerBtn} onMouseDown={e => e.stopPropagation()} onClick={() => addAtCenter('reference')}><Link2 size={14} aria-hidden="true" /> Link</button>
            <button className={styles.methodPickerBtn} onMouseDown={e => e.stopPropagation()} onClick={() => addAtCenter('board')}><FolderTree size={14} aria-hidden="true" /> Board</button>
          </div>
        )}
```

Import `FolderTree` from `lucide-react`. Column and Line arrive in Phase 2 — do not add dead
buttons for them.

- [ ] **Step 4: Wire the tray's drag-out**

Task 8 left `onDragOut` as a no-op. Implement it in `ResearchTab.tsx`, which owns the board id.
The drop point arrives in screen coordinates and has to be converted to canvas coordinates,
which is why it cannot live in the tray component:

```tsx
    const updateResearchState = useWorkspaceStore(s => s.updateResearchState);
    const canvasHostRef = useRef<HTMLDivElement>(null);

    /** Tray -> canvas. Screen point in, canvas point out. */
    const handleDragOut = (widgetId: string, at: { x: number; y: number }) => {
        const state = useWorkspaceStore.getState().researchStates[boardId];
        if (!state) return;

        const host = canvasHostRef.current?.getBoundingClientRect();
        const zoom = state.zoom ?? 1;
        const offset = state.canvasOffset ?? { x: 0, y: 0 };
        const point = host
            ? { x: (at.x - host.left - offset.x) / zoom, y: (at.y - host.top - offset.y) / zoom }
            : { x: 80, y: 80 };   // dropped outside the canvas: park it top-left

        const next = fromTray(state, widgetId, point);
        updateResearchState(boardId, { widgets: next.widgets, unsorted: next.unsorted });
    };
```

Import `fromTray` from `@/lib/research/unsorted` and `useRef` from React, put
`ref={canvasHostRef}` on the `researchCanvasHost` div, and pass `onDragOut={handleDragOut}` to
`<UnsortedTray />`.

- [ ] **Step 5: Typecheck, run the suite, commit**

```bash
npx tsc --noEmit
npx vitest run
git add src/components/editor/WritingDesk.tsx src/components/editor/ResearchTab.tsx
git commit -m "feat: board tool creates a nested board; tray cards drag onto the canvas"
```

Expected: `tsc` exits 0; every test passes.

---

## Task 10: Point quick capture at the tray

**Files:**
- Modify: `src/components/home/HomePage.tsx:236-245`

Quick capture currently drops a card onto the root board's canvas at a staggered position. The
tray is where an uncategorised idea belongs.

- [ ] **Step 1: Rewrite `captureIdea`**

```tsx
  // Quick capture lands in the project root board's unsorted tray — the whole
  // point of the tray is that capturing costs no decision about placement.
  const captureIdea = () => {
    const text = capture.trim();
    if (!text || !activeProject) return;
    const s = useWorkspaceStore.getState();
    const boardId = rootBoardIdFor(s.researchBoards, activeProject.id);
    if (!boardId) return;
    const current = s.researchStates[boardId]?.unsorted ?? [];
    updateResearchState(boardId, { unsorted: [...current, makeNoteCard(text, current.length)] });
    setCapture('');
    setCaptured(true);
    setTimeout(() => setCaptured(false), 2400);
  };
```

Import `rootBoardIdFor` from `@/lib/research/boardTree`, and drop the now-unused
`researchScopeKey` import.

- [ ] **Step 2: Update the toast and the button title**

```tsx
title="Send to your unsorted notes"
```

```tsx
{captured && <span className={styles.captureToast}>Added to your unsorted notes</span>}
```

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/home/HomePage.tsx
git commit -m "feat: quick capture lands in the unsorted tray"
```

---

## Task 11: Verify in the browser

- [ ] **Step 1: Confirm the migration ran**

Open the app, then in the console:

```js
const s = JSON.parse(localStorage.getItem('lorecanvas-workspace')).state;
console.log(Object.values(s.researchBoards));
```

Expected: one node per existing `researchStates` key that starts with `project:`. Every root has
`parentId: null`. No `world:` key appears.

- [ ] **Step 2: Confirm no board data moved**

```js
const s = JSON.parse(localStorage.getItem('lorecanvas-workspace')).state;
console.log(Object.keys(s.researchStates));
```

Expected: exactly the same keys as before the upgrade.

- [ ] **Step 3: Walk the tree**

In the Research stage: click **Board**, double-click the new card to go down, confirm the
breadcrumb reads `Main › New board`, click `Main` to come back up.

- [ ] **Step 4: Fill the tray**

From Home, capture an idea. Go to Research. Expected: the tray count reads 1 and the note is in
it, not on the canvas.

- [ ] **Step 5: Full check and final commit**

```bash
npx tsc --noEmit
npx vitest run
npm run build
npx eslint src
```

Expected: `tsc` 0, every test passing, build compiles, eslint at **223 errors** — the current
baseline. Anything above it is new debt introduced by this phase; fix it before committing.

```bash
git add -A
git commit -m "feat: research board tree, breadcrumbs and the unsorted tray"
```

---

## Definition of done

- A board can contain a board, at any depth
- Breadcrumbs navigate up; the board card navigates down
- Every board has its own unsorted tray, and quick capture writes into it
- The migration derived a registry without moving a single board
- 653 existing tests still pass, plus 30 new ones across three leaf modules
