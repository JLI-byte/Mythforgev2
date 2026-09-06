# Research Phase 2 — Arrangement Implementation Plan

> **Status: complete.** Shipped 2026-09-06. 750 tests, tsc clean, build
> compiles, eslint at the 223 baseline.
>
> Two deviations from the plan as written, both deliberate:
> - The stylesheet split was dropped. Moving `.researchLayout` and friends out
>   of the 6,938-line desk stylesheet means re-pointing class references across
>   a 1,073-line component for no functional gain. Every new Phase 2 style went
>   into its own per-component module instead, which stops the growth.
> - `ColumnRenderer` takes the reactive widget array, not `widgetsRef.current`
>   as Task 7 first specified. Reading the ref during render was both a React
>   violation and a real bug: a column's count and child list would have gone
>   stale the moment a card was added.
>
> Labels and locking ship as tested rules with no UI yet — the canvas honours
> `locked` and `labelIds`, but nothing sets them. That surface belongs with the
> card-type work in Phase 3.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make a research board stay legible past fifty cards — columns, connecting lines,
labels, locking, cross-board search, and the shortcuts that mean you never reach for the toolbar.

**Architecture:** Six leaf modules hold every rule; the components only draw. Columns keep the
widget list **flat** — a column is a widget, its children are ordinary widgets carrying
`parentId` — so search, the dossier and every existing traversal keep working untouched.
Connections are not cards and live in their own array on `DeskState`.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Zustand + persist, Vitest (jsdom),
CSS Modules.

---

## Before you start

- `vitest.config.ts` collects **`src/**/*.test.ts` only**. A `.test.tsx` is silently never run.
  Every rule below is therefore a `.ts` leaf module.
- Leaf module house style: `src/lib/research/boardTree.ts`. 4-space indent, no store import
  beyond types, no React, a doc comment saying LEAF MODULE.
- `src/components/editor/WritingDesk.module.css` is 6,938 lines. **Do not add to it.** Every new
  style in this phase goes in its own `*.module.css` beside its component.

### Store fields this phase adds

On `DeskWidget` — all optional, so every existing widget stays valid:

```ts
  /** Set = this card is laid out by its column, not by its own x/y. */
  parentId?: string | null;
  /** Position within the parent column. Ignored when parentId is unset. */
  columnOrder?: number;
  /** Pinned in place: excluded from drag, resize and marquee selection. */
  locked?: boolean;
  labelIds?: string[];
```

On `DeskState`:

```ts
  /** Research boards only: lines between cards. Not widgets — they have no box. */
  connections?: Connection[];
```

On `WorkspaceState`:

```ts
  /** Label set, per project id. */
  researchLabels: Record<string, Label[]>;
```

---

## Task 1: Columns

**Files:**
- Create: `src/lib/research/columns.ts`, `src/lib/research/columns.test.ts`

A column is a widget of type `column`. Its children are ordinary widgets whose `parentId` is the
column's id and whose order within it is `columnOrder`. The list stays flat.

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
    childrenOfColumn, addToColumn, removeFromColumn, reorderInColumn,
    groupIntoColumn, columnCount, isFreeOnCanvas,
} from './columns';
import type { DeskWidget } from '@/store/workspaceStore';

const w = (id: string, over: Partial<DeskWidget> = {}): DeskWidget => ({
    id, type: 'sticky', x: 10, y: 10, width: 200, height: 160, content: { text: id }, ...over,
});

describe('childrenOfColumn', () => {
    it('returns only that column’s children, in columnOrder', () => {
        const ws = [
            w('c1', { type: 'column' }),
            w('b', { parentId: 'c1', columnOrder: 1 }),
            w('a', { parentId: 'c1', columnOrder: 0 }),
            w('x', { parentId: 'c2', columnOrder: 0 }),
            w('loose'),
        ];
        expect(childrenOfColumn(ws, 'c1').map(c => c.id)).toEqual(['a', 'b']);
    });

    it('is empty for a column with no children', () => {
        expect(childrenOfColumn([w('c1', { type: 'column' })], 'c1')).toEqual([]);
    });

    it('puts a child with no columnOrder last rather than dropping it', () => {
        const ws = [w('a', { parentId: 'c1', columnOrder: 0 }), w('b', { parentId: 'c1' })];
        expect(childrenOfColumn(ws, 'c1').map(c => c.id)).toEqual(['a', 'b']);
    });
});

describe('columnCount', () => {
    it('counts the children', () => {
        const ws = [w('a', { parentId: 'c1' }), w('b', { parentId: 'c1' }), w('z')];
        expect(columnCount(ws, 'c1')).toBe(2);
    });
});

describe('isFreeOnCanvas', () => {
    it('is true for a card with no parent', () => {
        expect(isFreeOnCanvas(w('a'))).toBe(true);
    });
    it('is false for a card in a column', () => {
        expect(isFreeOnCanvas(w('a', { parentId: 'c1' }))).toBe(false);
    });
});

describe('addToColumn', () => {
    it('appends and stamps parentId plus the next order', () => {
        const ws = [w('c1', { type: 'column' }), w('a', { parentId: 'c1', columnOrder: 0 }), w('n')];
        const r = addToColumn(ws, 'n', 'c1');
        const moved = r.find(x => x.id === 'n')!;
        expect(moved.parentId).toBe('c1');
        expect(moved.columnOrder).toBe(1);
    });

    it('inserts at an index and renumbers the rest', () => {
        const ws = [
            w('c1', { type: 'column' }),
            w('a', { parentId: 'c1', columnOrder: 0 }),
            w('b', { parentId: 'c1', columnOrder: 1 }),
            w('n'),
        ];
        const r = addToColumn(ws, 'n', 'c1', 0);
        expect(childrenOfColumn(r, 'c1').map(c => c.id)).toEqual(['n', 'a', 'b']);
    });

    it('refuses to put a column inside a column', () => {
        const ws = [w('c1', { type: 'column' }), w('c2', { type: 'column' })];
        expect(addToColumn(ws, 'c2', 'c1')).toEqual(ws);
    });

    it('is a no-op for an unknown card', () => {
        const ws = [w('c1', { type: 'column' })];
        expect(addToColumn(ws, 'nope', 'c1')).toEqual(ws);
    });
});

describe('removeFromColumn', () => {
    it('clears the parent and places the card at the drop point', () => {
        const ws = [w('c1', { type: 'column' }), w('a', { parentId: 'c1', columnOrder: 0 })];
        const r = removeFromColumn(ws, 'a', { x: 300, y: 120 });
        const freed = r.find(x => x.id === 'a')!;
        expect(freed.parentId ?? null).toBeNull();
        expect(freed.columnOrder).toBeUndefined();
        expect(freed).toMatchObject({ x: 300, y: 120 });
    });

    it('renumbers what is left behind', () => {
        const ws = [
            w('c1', { type: 'column' }),
            w('a', { parentId: 'c1', columnOrder: 0 }),
            w('b', { parentId: 'c1', columnOrder: 1 }),
        ];
        const r = removeFromColumn(ws, 'a', { x: 0, y: 0 });
        expect(childrenOfColumn(r, 'c1').map(c => [c.id, c.columnOrder])).toEqual([['b', 0]]);
    });
});

describe('reorderInColumn', () => {
    it('restamps order from the given id list', () => {
        const ws = [
            w('c1', { type: 'column' }),
            w('a', { parentId: 'c1', columnOrder: 0 }),
            w('b', { parentId: 'c1', columnOrder: 1 }),
        ];
        const r = reorderInColumn(ws, 'c1', ['b', 'a']);
        expect(childrenOfColumn(r, 'c1').map(c => c.id)).toEqual(['b', 'a']);
    });

    it('ignores ids that are not in that column, rather than adopting them', () => {
        const ws = [
            w('c1', { type: 'column' }),
            w('a', { parentId: 'c1', columnOrder: 0 }),
            w('stray'),
        ];
        const r = reorderInColumn(ws, 'c1', ['stray', 'a']);
        expect(childrenOfColumn(r, 'c1').map(c => c.id)).toEqual(['a']);
        expect(r.find(x => x.id === 'stray')!.parentId ?? null).toBeNull();
    });
});

describe('groupIntoColumn', () => {
    it('creates a column and adopts the selection in the given order', () => {
        const ws = [w('a'), w('b'), w('c')];
        const r = groupIntoColumn(ws, ['a', 'b'], { x: 50, y: 60 }, 'col-1');
        const col = r.find(x => x.id === 'col-1')!;
        expect(col.type).toBe('column');
        expect(col).toMatchObject({ x: 50, y: 60 });
        expect(childrenOfColumn(r, 'col-1').map(c => c.id)).toEqual(['a', 'b']);
        expect(r.find(x => x.id === 'c')!.parentId ?? null).toBeNull();
    });

    it('skips columns in the selection, since columns cannot nest', () => {
        const ws = [w('a'), w('c2', { type: 'column' })];
        const r = groupIntoColumn(ws, ['a', 'c2'], { x: 0, y: 0 }, 'col-1');
        expect(childrenOfColumn(r, 'col-1').map(c => c.id)).toEqual(['a']);
    });

    it('does nothing when the selection holds no groupable card', () => {
        const ws = [w('c2', { type: 'column' })];
        expect(groupIntoColumn(ws, ['c2'], { x: 0, y: 0 }, 'col-1')).toEqual(ws);
    });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/research/columns.test.ts`
Expected: FAIL — `Failed to resolve import "./columns"`.

- [x] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — columns on a research board.
 *
 * A column is a widget. Its children are ordinary widgets carrying parentId,
 * so the board's widget list stays FLAT: search, the dossier and every existing
 * traversal keep working without knowing columns exist.
 *
 * Columns cannot nest. Milanote has the same rule, and it is what stops a board
 * turning into a tree nobody can scan.
 */

import type { DeskWidget } from '@/store/workspaceStore';

export const COLUMN_WIDTH = 260;
export const COLUMN_MIN_HEIGHT = 140;

export function isFreeOnCanvas(widget: DeskWidget): boolean {
    return !widget.parentId;
}

/** That column's children, in columnOrder. Anything unnumbered sorts last. */
export function childrenOfColumn(widgets: DeskWidget[], columnId: string): DeskWidget[] {
    return widgets
        .filter(w => w.parentId === columnId)
        .sort((a, b) => (a.columnOrder ?? Number.MAX_SAFE_INTEGER) - (b.columnOrder ?? Number.MAX_SAFE_INTEGER));
}

export function columnCount(widgets: DeskWidget[], columnId: string): number {
    return widgets.reduce((n, w) => (w.parentId === columnId ? n + 1 : n), 0);
}

/** Renumber a column's children 0..n-1 in their current order. */
function restamp(widgets: DeskWidget[], columnId: string): DeskWidget[] {
    const order = new Map(childrenOfColumn(widgets, columnId).map((w, i) => [w.id, i]));
    return widgets.map(w => (order.has(w.id) ? { ...w, columnOrder: order.get(w.id) } : w));
}

/** Move a card into a column, optionally at an index. Columns are refused. */
export function addToColumn(
    widgets: DeskWidget[],
    widgetId: string,
    columnId: string,
    atIndex?: number,
): DeskWidget[] {
    const moving = widgets.find(w => w.id === widgetId);
    if (!moving || moving.type === 'column') return widgets;

    const siblings = childrenOfColumn(widgets, columnId).filter(w => w.id !== widgetId);
    const index = atIndex === undefined ? siblings.length : Math.max(0, Math.min(atIndex, siblings.length));

    const ids = siblings.map(w => w.id);
    ids.splice(index, 0, widgetId);
    const rank = new Map(ids.map((id, i) => [id, i]));

    return widgets.map(w =>
        rank.has(w.id)
            ? { ...w, parentId: columnId, columnOrder: rank.get(w.id) }
            : w,
    );
}

/** Take a card out of its column and drop it on the canvas at `at`. */
export function removeFromColumn(
    widgets: DeskWidget[],
    widgetId: string,
    at: { x: number; y: number },
): DeskWidget[] {
    const moving = widgets.find(w => w.id === widgetId);
    if (!moving || !moving.parentId) return widgets;
    const columnId = moving.parentId;

    const freed = widgets.map(w => {
        if (w.id !== widgetId) return w;
        const { columnOrder: _drop, ...rest } = w;
        return { ...rest, parentId: null, x: at.x, y: at.y };
    });
    return restamp(freed, columnId);
}

/** Restamp order from an explicit id list. Ids outside the column are ignored. */
export function reorderInColumn(
    widgets: DeskWidget[],
    columnId: string,
    orderedIds: string[],
): DeskWidget[] {
    const own = new Set(childrenOfColumn(widgets, columnId).map(w => w.id));
    const rank = new Map(orderedIds.filter(id => own.has(id)).map((id, i) => [id, i]));
    return widgets.map(w => (rank.has(w.id) ? { ...w, columnOrder: rank.get(w.id) } : w));
}

/**
 * Wrap a selection in a new column at `at`. `columnId` is passed in rather than
 * generated so this stays pure and the test can assert on it.
 */
export function groupIntoColumn(
    widgets: DeskWidget[],
    widgetIds: string[],
    at: { x: number; y: number },
    columnId: string,
): DeskWidget[] {
    const groupable = widgetIds.filter(id => {
        const w = widgets.find(x => x.id === id);
        return w && w.type !== 'column';
    });
    if (groupable.length === 0) return widgets;

    const column: DeskWidget = {
        id: columnId,
        type: 'column',
        x: at.x,
        y: at.y,
        width: COLUMN_WIDTH,
        height: COLUMN_MIN_HEIGHT,
        content: { title: 'Untitled' },
    };

    const rank = new Map(groupable.map((id, i) => [id, i]));
    const adopted = widgets.map(w =>
        rank.has(w.id) ? { ...w, parentId: columnId, columnOrder: rank.get(w.id) } : w,
    );
    return [...adopted, column];
}
```

- [x] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/research/columns.test.ts`
Expected: PASS, 16 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/research/columns.ts src/lib/research/columns.test.ts
git commit -m "feat: column rules — flat widget list, parentId, ordering"
```

---

## Task 2: Connections

**Files:**
- Create: `src/lib/research/connections.ts`, `src/lib/research/connections.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
    makeConnection, resolveEndpoint, pruneOrphans, connectionsFor, removeConnection,
    type Connection,
} from './connections';
import type { DeskWidget } from '@/store/workspaceStore';

const w = (id: string, over: Partial<DeskWidget> = {}): DeskWidget => ({
    id, type: 'sticky', x: 100, y: 200, width: 200, height: 100, content: {}, ...over,
});

describe('resolveEndpoint', () => {
    it('resolves a widget endpoint to the card’s centre', () => {
        expect(resolveEndpoint({ widgetId: 'a' }, [w('a')])).toEqual({ x: 200, y: 250 });
    });

    it('passes a free point straight through', () => {
        expect(resolveEndpoint({ x: 12, y: 34 }, [])).toEqual({ x: 12, y: 34 });
    });

    it('is null when the widget is gone', () => {
        expect(resolveEndpoint({ widgetId: 'ghost' }, [w('a')])).toBeNull();
    });
});

describe('makeConnection', () => {
    it('defaults to a single arrow at the end', () => {
        const c = makeConnection({ widgetId: 'a' }, { widgetId: 'b' }, 'c1');
        expect(c).toMatchObject({ id: 'c1', arrow: 'end', curve: 0 });
    });
});

describe('connectionsFor', () => {
    it('finds every line touching a card, at either end', () => {
        const cs: Connection[] = [
            makeConnection({ widgetId: 'a' }, { widgetId: 'b' }, 'c1'),
            makeConnection({ widgetId: 'b' }, { widgetId: 'c' }, 'c2'),
            makeConnection({ x: 0, y: 0 }, { widgetId: 'c' }, 'c3'),
        ];
        expect(connectionsFor(cs, 'b').map(c => c.id)).toEqual(['c1', 'c2']);
    });
});

describe('removeConnection', () => {
    it('drops one line by id', () => {
        const cs = [makeConnection({ x: 0, y: 0 }, { x: 1, y: 1 }, 'c1')];
        expect(removeConnection(cs, 'c1')).toEqual([]);
    });
});

describe('pruneOrphans', () => {
    it('drops a line whose card was deleted', () => {
        const cs = [
            makeConnection({ widgetId: 'a' }, { widgetId: 'b' }, 'c1'),
            makeConnection({ widgetId: 'a' }, { widgetId: 'gone' }, 'c2'),
        ];
        expect(pruneOrphans(cs, [w('a'), w('b')]).map(c => c.id)).toEqual(['c1']);
    });

    it('keeps a line pinned to free points, which depend on no card', () => {
        const cs = [makeConnection({ x: 0, y: 0 }, { x: 5, y: 5 }, 'c1')];
        expect(pruneOrphans(cs, []).map(c => c.id)).toEqual(['c1']);
    });

    it('returns the same array when nothing is orphaned, so React can skip', () => {
        const cs = [makeConnection({ widgetId: 'a' }, { x: 1, y: 1 }, 'c1')];
        expect(pruneOrphans(cs, [w('a')])).toBe(cs);
    });

    it('handles an empty list', () => {
        expect(pruneOrphans([], [])).toEqual([]);
    });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/research/connections.test.ts`
Expected: FAIL — `Failed to resolve import "./connections"`.

- [x] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — lines between cards.
 *
 * A connection is not a widget. It has no box, no z-order and no content, and
 * making it one would put it in every traversal that expects a card. It lives
 * in its own array on DeskState.
 *
 * An endpoint is either a card (the line follows it) or a free point (it does
 * not). A line to a deleted card is pruned; a line to a free point survives,
 * because nothing it depends on has gone.
 */

import type { DeskWidget } from '@/store/workspaceStore';

export type Endpoint = { widgetId: string } | { x: number; y: number };

export interface Connection {
    id: string;
    from: Endpoint;
    to: Endpoint;
    label?: string;
    /** 0 = straight. Positive bows one way, negative the other. */
    curve: number;
    arrow: 'none' | 'end' | 'both';
    color?: string;
}

function isWidgetEnd(ep: Endpoint): ep is { widgetId: string } {
    return typeof (ep as { widgetId?: unknown }).widgetId === 'string';
}

export function makeConnection(from: Endpoint, to: Endpoint, id: string): Connection {
    return { id, from, to, curve: 0, arrow: 'end' };
}

/** Where an endpoint actually is. Null when its card is gone. */
export function resolveEndpoint(
    ep: Endpoint,
    widgets: DeskWidget[],
): { x: number; y: number } | null {
    if (!isWidgetEnd(ep)) return { x: ep.x, y: ep.y };
    const w = widgets.find(x => x.id === ep.widgetId);
    if (!w) return null;
    return { x: w.x + w.width / 2, y: w.y + w.height / 2 };
}

export function connectionsFor(connections: Connection[], widgetId: string): Connection[] {
    return connections.filter(c =>
        (isWidgetEnd(c.from) && c.from.widgetId === widgetId) ||
        (isWidgetEnd(c.to) && c.to.widgetId === widgetId),
    );
}

export function removeConnection(connections: Connection[], id: string): Connection[] {
    return connections.filter(c => c.id !== id);
}

/**
 * Drop lines whose card no longer exists. Returns the SAME array when nothing
 * changed, so a React dependency on it does not fire on every render.
 */
export function pruneOrphans(connections: Connection[], widgets: DeskWidget[]): Connection[] {
    const live = new Set(widgets.map(w => w.id));
    const keep = connections.filter(c =>
        (!isWidgetEnd(c.from) || live.has(c.from.widgetId)) &&
        (!isWidgetEnd(c.to) || live.has(c.to.widgetId)),
    );
    return keep.length === connections.length ? connections : keep;
}
```

- [x] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/research/connections.test.ts`
Expected: PASS, 10 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/research/connections.ts src/lib/research/connections.test.ts
git commit -m "feat: connection rules — endpoints, pruning, arrows"
```

---

## Task 3: Labels and locking

**Files:**
- Create: `src/lib/research/labels.ts`, `src/lib/research/labels.test.ts`

Locking rides along here: both are per-card metadata that changes what the canvas does with a
card rather than what the card is.

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
    LABEL_COLORS, makeLabel, applyLabel, removeLabel, filterByLabels,
    labelsOn, canManipulate, toggleLock,
} from './labels';
import type { DeskWidget } from '@/store/workspaceStore';

const w = (id: string, over: Partial<DeskWidget> = {}): DeskWidget => ({
    id, type: 'sticky', x: 0, y: 0, width: 100, height: 100, content: {}, ...over,
});

describe('makeLabel', () => {
    it('takes a colour from the palette by index', () => {
        expect(makeLabel('l1', 'Verified', 0).color).toBe(LABEL_COLORS[0]);
    });
    it('wraps past the end of the palette rather than going undefined', () => {
        expect(makeLabel('l1', 'X', LABEL_COLORS.length).color).toBe(LABEL_COLORS[0]);
    });
});

describe('applyLabel', () => {
    it('adds a label id to a card', () => {
        const r = applyLabel([w('a')], 'a', 'l1');
        expect(r[0].labelIds).toEqual(['l1']);
    });
    it('does not duplicate an id already present', () => {
        const r = applyLabel([w('a', { labelIds: ['l1'] })], 'a', 'l1');
        expect(r[0].labelIds).toEqual(['l1']);
    });
    it('is a no-op for an unknown card', () => {
        const ws = [w('a')];
        expect(applyLabel(ws, 'nope', 'l1')).toEqual(ws);
    });
});

describe('removeLabel', () => {
    it('takes the id off', () => {
        const r = removeLabel([w('a', { labelIds: ['l1', 'l2'] })], 'a', 'l1');
        expect(r[0].labelIds).toEqual(['l2']);
    });
    it('is a no-op when the card does not carry it', () => {
        const ws = [w('a', { labelIds: ['l2'] })];
        expect(removeLabel(ws, 'a', 'l1')[0].labelIds).toEqual(['l2']);
    });
});

describe('labelsOn', () => {
    it('resolves a card’s ids to labels, skipping ones that were deleted', () => {
        const labels = [makeLabel('l1', 'A', 0), makeLabel('l2', 'B', 1)];
        expect(labelsOn(w('a', { labelIds: ['l2', 'gone'] }), labels).map(l => l.name)).toEqual(['B']);
    });
});

describe('filterByLabels', () => {
    it('returns everything when no filter is active', () => {
        const ws = [w('a', { labelIds: ['l1'] }), w('b')];
        expect(filterByLabels(ws, []).map(x => x.id)).toEqual(['a', 'b']);
    });
    it('keeps a card carrying any one of the selected labels', () => {
        const ws = [w('a', { labelIds: ['l1'] }), w('b', { labelIds: ['l2'] }), w('c')];
        expect(filterByLabels(ws, ['l1', 'l2']).map(x => x.id)).toEqual(['a', 'b']);
    });
    it('keeps a column whose child matches, or the child would float loose', () => {
        const ws = [
            w('col', { type: 'column' }),
            w('kid', { parentId: 'col', labelIds: ['l1'] }),
            w('other'),
        ];
        expect(filterByLabels(ws, ['l1']).map(x => x.id).sort()).toEqual(['col', 'kid']);
    });
});

describe('canManipulate', () => {
    it('is true for an ordinary card', () => {
        expect(canManipulate(w('a'))).toBe(true);
    });
    it('is false for a locked card', () => {
        expect(canManipulate(w('a', { locked: true }))).toBe(false);
    });
});

describe('toggleLock', () => {
    it('locks an unlocked card and unlocks a locked one', () => {
        const once = toggleLock([w('a')], 'a');
        expect(once[0].locked).toBe(true);
        expect(toggleLock(once, 'a')[0].locked).toBe(false);
    });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/research/labels.test.ts`
Expected: FAIL — `Failed to resolve import "./labels"`.

- [x] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — card labels, and locking.
 *
 * Both are per-card metadata that changes what the canvas DOES with a card
 * rather than what the card IS, which is why they share a module.
 *
 * Filtering keeps a column whose child matches. Hiding the column but keeping
 * the child would leave the child with nowhere to be drawn.
 */

import type { DeskWidget } from '@/store/workspaceStore';

export interface Label {
    id: string;
    name: string;
    color: string;
}

/** Semantic colours, kept away from --accent so a label never reads as selection. */
export const LABEL_COLORS = [
    '#4cd7f6',   // verified
    '#ffb869',   // contradiction
    '#2ec27e',   // resolved
    '#ff6b6d',   // blocked
    '#d0bcff',   // idea
] as const;

export function makeLabel(id: string, name: string, colorIndex: number): Label {
    return { id, name, color: LABEL_COLORS[colorIndex % LABEL_COLORS.length] };
}

export function applyLabel(widgets: DeskWidget[], widgetId: string, labelId: string): DeskWidget[] {
    return widgets.map(w => {
        if (w.id !== widgetId) return w;
        const ids = w.labelIds ?? [];
        return ids.includes(labelId) ? w : { ...w, labelIds: [...ids, labelId] };
    });
}

export function removeLabel(widgets: DeskWidget[], widgetId: string, labelId: string): DeskWidget[] {
    return widgets.map(w =>
        w.id === widgetId ? { ...w, labelIds: (w.labelIds ?? []).filter(id => id !== labelId) } : w,
    );
}

/** A card's labels, resolved. Ids whose label was deleted are skipped. */
export function labelsOn(widget: DeskWidget, labels: Label[]): Label[] {
    const byId = new Map(labels.map(l => [l.id, l]));
    return (widget.labelIds ?? []).map(id => byId.get(id)).filter((l): l is Label => Boolean(l));
}

/** Cards carrying ANY of `labelIds`, plus the columns holding them. */
export function filterByLabels(widgets: DeskWidget[], labelIds: string[]): DeskWidget[] {
    if (labelIds.length === 0) return widgets;
    const wanted = new Set(labelIds);

    const matched = widgets.filter(w => (w.labelIds ?? []).some(id => wanted.has(id)));
    const keep = new Set(matched.map(w => w.id));
    for (const w of matched) {
        if (w.parentId) keep.add(w.parentId);   // a child needs its column drawn
    }
    return widgets.filter(w => keep.has(w.id));
}

export function canManipulate(widget: DeskWidget): boolean {
    return !widget.locked;
}

export function toggleLock(widgets: DeskWidget[], widgetId: string): DeskWidget[] {
    return widgets.map(w => (w.id === widgetId ? { ...w, locked: !w.locked } : w));
}
```

- [x] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/research/labels.test.ts`
Expected: PASS, 14 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/research/labels.ts src/lib/research/labels.test.ts
git commit -m "feat: label and lock rules"
```

---

## Task 4: Cross-board search

**Files:**
- Create: `src/lib/research/boardSearch.ts`, `src/lib/research/boardSearch.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { searchBoards, snippetAround } from './boardSearch';
import type { BoardRegistry } from './boardTree';

const REG: BoardRegistry = {
    b1: { id: 'b1', name: 'Main',      parentId: null, projectId: 'p1' },
    b2: { id: 'b2', name: 'The Siege', parentId: 'b1', projectId: 'p1' },
    b9: { id: 'b9', name: 'Other',     parentId: null, projectId: 'p2' },
};

const STATES = {
    b1: { widgets: [
        { id: 'w1', type: 'sticky',    x: 0, y: 0, width: 1, height: 1, content: { text: 'The siege lasted nine days' } },
        { id: 'w2', type: 'reference', x: 0, y: 0, width: 1, height: 1, content: { title: 'Supply lines', url: 'https://x.test' } },
    ] },
    b2: { widgets: [
        { id: 'w3', type: 'sticky', x: 0, y: 0, width: 1, height: 1, content: { text: 'Maren holds the west gate' } },
    ], unsorted: [
        { id: 'w4', type: 'sticky', x: 0, y: 0, width: 1, height: 1, content: { text: 'Siege engines?' } },
    ] },
    b9: { widgets: [
        { id: 'w5', type: 'sticky', x: 0, y: 0, width: 1, height: 1, content: { text: 'siege of somewhere else' } },
    ] },
} as never;

describe('searchBoards', () => {
    it('finds cards by their text, case-insensitively', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'siege');
        expect(hits.map(h => h.widgetId).sort()).toEqual(['w1', 'w4', undefined].sort());
    });

    it('stays inside the project', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'siege');
        expect(hits.some(h => h.boardId === 'b9')).toBe(false);
    });

    it('matches a board by name and reports it with no widget', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'The Siege');
        expect(hits.some(h => h.boardId === 'b2' && h.widgetId === undefined)).toBe(true);
    });

    it('searches a link card’s title', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'supply');
        expect(hits[0].widgetId).toBe('w2');
    });

    it('searches the unsorted tray as well as the canvas', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'engines');
        expect(hits.map(h => h.widgetId)).toEqual(['w4']);
    });

    it('ranks a board-name match above a card match', () => {
        const hits = searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'siege');
        expect(hits[0].widgetId).toBeUndefined();
    });

    it('is empty for a blank query rather than returning everything', () => {
        expect(searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, '   ')).toEqual([]);
    });

    it('is empty when nothing matches', () => {
        expect(searchBoards({ registry: REG, states: STATES, projectId: 'p1' }, 'zzzz')).toEqual([]);
    });
});

describe('snippetAround', () => {
    it('centres the window on the match', () => {
        expect(snippetAround('the siege lasted nine days', 'siege', 8)).toContain('siege');
    });

    it('returns short text whole, with no ellipsis', () => {
        expect(snippetAround('siege', 'siege', 20)).toBe('siege');
    });

    it('returns the head when the needle is absent', () => {
        expect(snippetAround('abcdefghij', 'zz', 4)).toBe('abcd…');
    });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/research/boardSearch.test.ts`
Expected: FAIL — `Failed to resolve import "./boardSearch"`.

- [x] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — search across every board in a project.
 *
 * Once boards nest, a card can be three levels down and invisible. Search is
 * what makes that depth safe.
 *
 * Card text lives in `content`, whose shape varies by card type, so this reads
 * a fixed list of likely string fields rather than pretending to know each
 * type. Anything it cannot read simply does not match.
 */

import type { BoardRegistry } from './boardTree';

/** content fields worth searching, across every card type. */
const TEXT_FIELDS = ['text', 'title', 'url', 'description', 'name', 'note'] as const;

export interface SearchHit {
    boardId: string;
    boardName: string;
    /** Absent when the board itself matched by name. */
    widgetId?: string;
    snippet: string;
    score: number;
}

interface SearchInput {
    registry: BoardRegistry;
    states: Record<string, { widgets?: unknown[]; unsorted?: unknown[] }>;
    projectId: string;
}

/** A window of `radius` characters either side of the match. */
export function snippetAround(text: string, needle: string, radius: number): string {
    const at = text.toLowerCase().indexOf(needle.toLowerCase());
    if (at === -1) return text.length <= radius ? text : `${text.slice(0, radius)}…`;

    const start = Math.max(0, at - radius);
    const end = Math.min(text.length, at + needle.length + radius);
    return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function readableText(widget: unknown): string {
    const content = (widget as { content?: Record<string, unknown> })?.content ?? {};
    return TEXT_FIELDS
        .map(f => content[f])
        .filter((v): v is string => typeof v === 'string')
        .join(' · ');
}

export function searchBoards(input: SearchInput, rawQuery: string): SearchHit[] {
    const query = rawQuery.trim();
    if (!query) return [];
    const needle = query.toLowerCase();

    const hits: SearchHit[] = [];
    const boards = Object.values(input.registry).filter(b => b.projectId === input.projectId);

    for (const board of boards) {
        if (board.name.toLowerCase().includes(needle)) {
            // A board is a place, and a place outranks a card inside one.
            hits.push({ boardId: board.id, boardName: board.name, snippet: board.name, score: 100 });
        }

        const state = input.states[board.id];
        const cards = [...(state?.widgets ?? []), ...(state?.unsorted ?? [])];

        for (const card of cards) {
            const text = readableText(card);
            if (!text.toLowerCase().includes(needle)) continue;
            hits.push({
                boardId: board.id,
                boardName: board.name,
                widgetId: (card as { id: string }).id,
                snippet: snippetAround(text, query, 32),
                score: 50,
            });
        }
    }

    return hits.sort((a, b) => b.score - a.score || a.boardName.localeCompare(b.boardName));
}
```

- [x] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/research/boardSearch.test.ts`
Expected: PASS, 11 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/research/boardSearch.ts src/lib/research/boardSearch.test.ts
git commit -m "feat: cross-board search"
```

---

## Task 5: The shortcut map

**Files:**
- Create: `src/lib/research/shortcuts.ts`, `src/lib/research/shortcuts.test.ts`

Milanote's speed is that you never reach for the toolbar. The keymap is a pure function from a
key event to an intent, so it can be tested without a DOM.

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { intentFor, NUDGE_SMALL, NUDGE_LARGE } from './shortcuts';

const ev = (over: Partial<Parameters<typeof intentFor>[0]> = {}) => ({
    key: 'a', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
    inTextField: false, hasSelection: true, ...over,
});

describe('intentFor', () => {
    it('duplicates on Ctrl+D', () => {
        expect(intentFor(ev({ key: 'd', ctrlKey: true }))).toEqual({ kind: 'duplicate' });
    });

    it('adds another card on Ctrl+Enter', () => {
        expect(intentFor(ev({ key: 'Enter', ctrlKey: true }))).toEqual({ kind: 'addSibling' });
    });

    it('accepts Cmd as well as Ctrl', () => {
        expect(intentFor(ev({ key: 'd', metaKey: true }))).toEqual({ kind: 'duplicate' });
    });

    it('opens search on Ctrl+F', () => {
        expect(intentFor(ev({ key: 'f', ctrlKey: true, hasSelection: false }))).toEqual({ kind: 'search' });
    });

    it('goes to the parent board on Ctrl+U', () => {
        expect(intentFor(ev({ key: 'u', ctrlKey: true, hasSelection: false }))).toEqual({ kind: 'parentBoard' });
    });

    it('nudges by arrow', () => {
        expect(intentFor(ev({ key: 'ArrowRight' }))).toEqual({ kind: 'nudge', dx: NUDGE_SMALL, dy: 0 });
        expect(intentFor(ev({ key: 'ArrowUp' }))).toEqual({ kind: 'nudge', dx: 0, dy: -NUDGE_SMALL });
    });

    it('nudges further with Shift', () => {
        expect(intentFor(ev({ key: 'ArrowLeft', shiftKey: true })))
            .toEqual({ kind: 'nudge', dx: -NUDGE_LARGE, dy: 0 });
    });

    it('deletes on Delete and Backspace', () => {
        expect(intentFor(ev({ key: 'Delete' }))).toEqual({ kind: 'delete' });
        expect(intentFor(ev({ key: 'Backspace' }))).toEqual({ kind: 'delete' });
    });

    it('deselects on Escape', () => {
        expect(intentFor(ev({ key: 'Escape', hasSelection: false }))).toEqual({ kind: 'deselect' });
    });

    it('shows the shortcut sheet on slash', () => {
        expect(intentFor(ev({ key: '/', hasSelection: false }))).toEqual({ kind: 'shortcutSheet' });
    });

    it('groups a selection into a column on Ctrl+G', () => {
        expect(intentFor(ev({ key: 'g', ctrlKey: true }))).toEqual({ kind: 'groupIntoColumn' });
    });

    it('locks on Ctrl+L', () => {
        expect(intentFor(ev({ key: 'l', ctrlKey: true }))).toEqual({ kind: 'toggleLock' });
    });

    it('ignores everything unrecognised', () => {
        expect(intentFor(ev({ key: 'q' }))).toBeNull();
    });

    it('does nothing at all while typing, so a note can contain the word delete', () => {
        for (const key of ['Delete', 'Backspace', 'ArrowLeft', '/', 'd']) {
            expect(intentFor(ev({ key, inTextField: true, ctrlKey: key === 'd' }))).toBeNull();
        }
    });

    it('ignores card actions when nothing is selected', () => {
        expect(intentFor(ev({ key: 'Delete', hasSelection: false }))).toBeNull();
        expect(intentFor(ev({ key: 'd', ctrlKey: true, hasSelection: false }))).toBeNull();
    });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/research/shortcuts.test.ts`
Expected: FAIL — `Failed to resolve import "./shortcuts"`.

- [x] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — the research board keymap.
 *
 * A pure function from a key event to an intent, so the whole map is testable
 * without a DOM and the canvas only has to know how to perform intents.
 *
 * Two guards matter more than any binding. While the caret is in a text field
 * nothing fires, or a note could never contain the word "delete". And card
 * actions need a selection, or Delete with nothing selected would be a silent
 * no-op the writer has to learn by accident.
 */

export const NUDGE_SMALL = 1;
export const NUDGE_LARGE = 10;

export type Intent =
    | { kind: 'duplicate' }
    | { kind: 'addSibling' }
    | { kind: 'search' }
    | { kind: 'parentBoard' }
    | { kind: 'nudge'; dx: number; dy: number }
    | { kind: 'delete' }
    | { kind: 'deselect' }
    | { kind: 'shortcutSheet' }
    | { kind: 'groupIntoColumn' }
    | { kind: 'toggleLock' };

export interface KeyContext {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    /** The caret is in an input, textarea or contenteditable. */
    inTextField: boolean;
    hasSelection: boolean;
}

const NUDGES: Record<string, [number, number]> = {
    ArrowLeft:  [-1,  0],
    ArrowRight: [ 1,  0],
    ArrowUp:    [ 0, -1],
    ArrowDown:  [ 0,  1],
};

export function intentFor(e: KeyContext): Intent | null {
    if (e.inTextField) return null;

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    // Board-level: no selection needed.
    if (mod && key === 'f') return { kind: 'search' };
    if (mod && key === 'u') return { kind: 'parentBoard' };
    if (key === 'Escape')   return { kind: 'deselect' };
    if (key === '/')        return { kind: 'shortcutSheet' };

    // Everything below acts on the selection.
    if (!e.hasSelection) return null;

    if (mod && key === 'd')     return { kind: 'duplicate' };
    if (mod && key === 'g')     return { kind: 'groupIntoColumn' };
    if (mod && key === 'l')     return { kind: 'toggleLock' };
    if (mod && key === 'Enter') return { kind: 'addSibling' };

    if (key === 'Delete' || key === 'Backspace') return { kind: 'delete' };

    const nudge = NUDGES[key];
    if (nudge) {
        const step = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
        return { kind: 'nudge', dx: nudge[0] * step, dy: nudge[1] * step };
    }

    return null;
}
```

- [x] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/research/shortcuts.test.ts`
Expected: PASS, 15 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/research/shortcuts.ts src/lib/research/shortcuts.test.ts
git commit -m "feat: research board keymap"
```

---

## Task 6: Store fields

**Files:**
- Modify: `src/store/workspaceStore.ts`

- [x] **Step 1: Widen `DeskWidget` and `DeskState`**

On `DeskWidget`, after `scopeId`:

```ts
  /** Set = this card is laid out by its column, not by its own x/y. */
  parentId?: string | null;
  /** Position within the parent column. Ignored when parentId is unset. */
  columnOrder?: number;
  /** Pinned in place: excluded from drag, resize and marquee selection. */
  locked?: boolean;
  labelIds?: string[];
```

On `DeskState`, beside `unsorted`:

```ts
  /** Research boards only: lines between cards. Not widgets — they have no box. */
  connections?: Connection[];
```

Add `'column'` to `DeskWidgetType`, and import the type:

```ts
import type { Connection } from '@/lib/research/connections';
```

- [x] **Step 2: Add the label registry**

In `WorkspaceState`, beside `researchBoards`:

```ts
    /** Research label set, per project id. */
    researchLabels: Record<string, Label[]>;
```

with `import type { Label } from '@/lib/research/labels';`, `researchLabels: {}` in the initial
state, and `researchLabels: state.researchLabels,` in `partialize`.

- [x] **Step 3: Add the label actions**

```ts
    createResearchLabel: (projectId: string, name: string) => string;
    deleteResearchLabel: (projectId: string, labelId: string) => void;
```

```ts
            createResearchLabel: (projectId, name) => {
                const id = crypto.randomUUID();
                set(state => {
                    const existing = state.researchLabels[projectId] ?? [];
                    return {
                        researchLabels: {
                            ...state.researchLabels,
                            [projectId]: [...existing, makeLabel(id, name, existing.length)],
                        },
                    };
                });
                return id;
            },

            deleteResearchLabel: (projectId, labelId) => set(state => ({
                researchLabels: {
                    ...state.researchLabels,
                    [projectId]: (state.researchLabels[projectId] ?? []).filter(l => l.id !== labelId),
                },
            })),
```

A card keeping a dead label id is harmless — `labelsOn()` skips ids it cannot resolve, so no
sweep across every board is needed on delete.

- [x] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/store/workspaceStore.ts
git commit -m "feat: column, lock, label and connection fields in the store"
```

---

## Task 7: Column renderer

**Files:**
- Create: `src/components/editor/desk/widgets/ColumnRenderer.tsx`, `ColumnRenderer.module.css`
- Modify: `src/components/editor/desk/widgets/WidgetRenderer.tsx`
- Modify: `src/components/editor/desk/deskConstants.ts` — `column: { w: 260, h: 320 }` in
  `DEFAULT_DIMS`, and `{ type: 'column', icon: '🧱', label: 'Column' }` in `PALETTE_ITEMS`

The column draws its own children, so `WritingDesk` must **not** also draw a card whose
`parentId` is set — see Task 8.

- [x] **Step 1: Write the renderer**

```tsx
"use client";

import React from 'react';
import { childrenOfColumn } from '@/lib/research/columns';
import type { DeskWidget } from '@/store/workspaceStore';
import styles from './ColumnRenderer.module.css';

interface Props {
    widget: DeskWidget;
    allWidgets: DeskWidget[];
    content: { title?: string; collapsed?: boolean };
    onChange: (c: Record<string, unknown>) => void;
    onSelectChild: (id: string) => void;
}

/** A titled stack with a live count. Columns cannot nest. */
export function ColumnRenderer({ widget, allWidgets, content, onChange, onSelectChild }: Props) {
    const children = childrenOfColumn(allWidgets, widget.id);
    const collapsed = Boolean(content.collapsed);

    return (
        <div className={styles.column}>
            <header className={styles.head}>
                <input
                    className={styles.title}
                    value={content.title ?? ''}
                    placeholder="Untitled"
                    aria-label="Column title"
                    onChange={e => onChange({ ...content, title: e.target.value })}
                />
                <span className={styles.count}>{children.length}</span>
                <button
                    className={styles.collapse}
                    onClick={() => onChange({ ...content, collapsed: !collapsed })}
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? 'Expand column' : 'Collapse column'}
                >
                    {collapsed ? '+' : '–'}
                </button>
            </header>

            {!collapsed && (
                <ul className={styles.list}>
                    {children.length === 0 ? (
                        <li className={styles.empty}>Drag cards here</li>
                    ) : children.map(child => (
                        <li key={child.id}>
                            <button className={styles.item} onClick={() => onSelectChild(child.id)}>
                                {String(child.content?.text ?? child.content?.title ?? child.type)}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
```

- [x] **Step 2: Write its stylesheet**

```css
.column {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; gap: var(--space-3);
  padding: var(--space-3);
  min-height: 0;
}
.head {
  display: flex; align-items: center; gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border);
  flex: 0 0 auto;
}
.title {
  flex: 1 1 auto; min-width: 0;
  background: transparent; border: none; color: var(--foreground);
  font-size: var(--text-xs); font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
}
.title:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.count {
  flex: 0 0 auto;
  background: rgba(var(--overlay-rgb), 0.12); border-radius: var(--radius-full);
  padding: 1px var(--space-2); font-size: var(--text-2xs); color: var(--foreground);
}
.collapse {
  flex: 0 0 auto; width: 20px; height: 20px;
  background: none; border: none; cursor: pointer;
  color: var(--muted); border-radius: var(--radius-sm); line-height: 1;
}
.collapse:hover { color: var(--foreground); }
.collapse:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: var(--space-2);
  overflow-y: auto; min-height: 0;
}
.item {
  width: 100%; text-align: left;
  background: var(--surface-high); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: var(--space-3);
  font-size: var(--text-xs); color: var(--foreground); cursor: pointer;
  line-height: 1.4; overflow-wrap: anywhere;
}
.item:hover { border-color: var(--accent); }
.item:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.empty { font-size: var(--text-2xs); color: var(--muted); padding: var(--space-2); }
```

- [x] **Step 3: Register it**

In `WidgetRenderer.tsx`:

```tsx
    case 'column':      return <ColumnRenderer widget={widget} allWidgets={widgetsRef.current} content={content} onChange={handleChangeImmediate} onSelectChild={onSelectChild ?? (() => {})} />;
```

Add `onSelectChild?: (id: string) => void;` to `WidgetRendererProps` and thread it from
`WritingDesk`, which already owns `setSelectedId`.

- [x] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/editor/desk/widgets/ColumnRenderer.tsx src/components/editor/desk/widgets/ColumnRenderer.module.css src/components/editor/desk/widgets/WidgetRenderer.tsx src/components/editor/desk/deskConstants.ts
git commit -m "feat: column renderer"
```

---

## Task 8: Hide column children from the free canvas

**Files:**
- Modify: `src/components/editor/WritingDesk.tsx`

A card inside a column is drawn by that column. If the canvas also draws it at its old x/y it
appears twice.

- [x] **Step 1: Filter the rendered list**

Where `activeWidgets` is computed, exclude parented cards:

```ts
  // A card in a column is drawn by that column, never by the canvas as well.
  const canvasWidgets = useMemo(
    () => activeWidgets.filter(w => !w.parentId),
    [activeWidgets],
  );
```

Render `canvasWidgets` in the widget map instead of `activeWidgets`. Leave `widgetsRef` holding
the **full** list — the column renderer reads it to find its children.

- [x] **Step 2: Prune orphaned connections when cards go**

In `deleteWidget`, after removing the widget:

```ts
    const nextConnections = pruneOrphans(deskState?.connections ?? [], nextWidgets);
    if (nextConnections !== (deskState?.connections ?? [])) {
      updateDeskState(stateKey, { connections: nextConnections });
    }
```

- [x] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit
npx vitest run
git add src/components/editor/WritingDesk.tsx
git commit -m "feat: column children are drawn once, by their column"
```

---

## Task 9: Connection layer

**Files:**
- Create: `src/components/editor/desk/ConnectionLayer.tsx`, `ConnectionLayer.module.css`
- Modify: `src/components/editor/WritingDesk.tsx`

- [x] **Step 1: Write the layer**

```tsx
"use client";

import React from 'react';
import { resolveEndpoint, type Connection } from '@/lib/research/connections';
import type { DeskWidget } from '@/store/workspaceStore';
import styles from './ConnectionLayer.module.css';

interface Props {
    connections: Connection[];
    widgets: DeskWidget[];
    onSelect?: (id: string) => void;
}

/**
 * Lines between cards, drawn under the widgets inside the same transformed
 * layer, so they pan and zoom with the canvas rather than drifting off it.
 */
export function ConnectionLayer({ connections, widgets, onSelect }: Props) {
    if (connections.length === 0) return null;

    return (
        <svg className={styles.layer} aria-hidden="true">
            <defs>
                <marker id="lc-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0 0.5 L9.5 5 L0 9.5 z" fill="var(--accent)" />
                </marker>
            </defs>

            {connections.map(c => {
                const a = resolveEndpoint(c.from, widgets);
                const b = resolveEndpoint(c.to, widgets);
                if (!a || !b) return null;   // pruning is async; never draw a half line

                // A quadratic control point offset perpendicular to the run.
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                const dx = b.x - a.x, dy = b.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                const cx = mx + (-dy / len) * c.curve;
                const cy = my + (dx / len) * c.curve;

                return (
                    <g key={c.id} onClick={() => onSelect?.(c.id)}>
                        <path
                            className={styles.line}
                            d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                            stroke={c.color ?? 'var(--accent)'}
                            markerEnd={c.arrow === 'none' ? undefined : 'url(#lc-arrow)'}
                            markerStart={c.arrow === 'both' ? 'url(#lc-arrow)' : undefined}
                        />
                        {c.label && (
                            <text className={styles.label} x={cx} y={cy - 6} textAnchor="middle">
                                {c.label}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}
```

- [x] **Step 2: Write its stylesheet**

```css
.layer {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 1;
}
.line {
  fill: none;
  stroke-width: 1.5;
  opacity: 0.8;
  pointer-events: stroke;
  cursor: pointer;
}
.label {
  fill: var(--foreground);
  font-size: 11px;
  paint-order: stroke;
  stroke: var(--background);
  stroke-width: 3px;
}
```

- [x] **Step 3: Mount it inside the transformed layer**

In `WritingDesk.tsx`, as the first child of `.deskCanvasInner` — inside the transform, so lines
pan and zoom with the cards:

```tsx
            {isResearch && (
              <ConnectionLayer
                connections={deskState?.connections ?? []}
                widgets={activeWidgets}
                onSelect={setSelectedConnectionId}
              />
            )}
```

with `const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);`

- [x] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/editor/desk/ConnectionLayer.tsx src/components/editor/desk/ConnectionLayer.module.css src/components/editor/WritingDesk.tsx
git commit -m "feat: connection layer"
```

---

## Task 10: Board search panel

**Files:**
- Create: `src/components/editor/research/BoardSearch.tsx`, `BoardSearch.module.css`
- Modify: `src/components/editor/ResearchTab.tsx`

- [x] **Step 1: Write the panel**

```tsx
"use client";

import React, { useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { searchBoards } from '@/lib/research/boardSearch';
import { useModalDialog } from '@/lib/useModalDialog';
import styles from './BoardSearch.module.css';

interface Props {
    projectId: string;
    onClose: () => void;
    onGo: (boardId: string) => void;
}

/** Find a card anywhere in the project's board tree. */
export function BoardSearch({ projectId, onClose, onGo }: Props) {
    const [query, setQuery] = useState('');
    const registry = useWorkspaceStore(s => s.researchBoards);
    const states = useWorkspaceStore(s => s.researchStates);
    const dialogRef = useModalDialog<HTMLDivElement>(onClose);

    const hits = useMemo(
        () => searchBoards({ registry, states, projectId }, query).slice(0, 40),
        [registry, states, projectId, query],
    );

    return (
        <div className={styles.backdrop}>
            <div
                ref={dialogRef}
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-label="Search research boards"
            >
                <input
                    className={styles.input}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search every board…"
                    aria-label="Search every board"
                    autoFocus
                />

                {query.trim() && hits.length === 0 && (
                    <p className={styles.none}>Nothing matches “{query.trim()}”.</p>
                )}

                <ul className={styles.hits}>
                    {hits.map((h, i) => (
                        <li key={`${h.boardId}-${h.widgetId ?? 'board'}-${i}`}>
                            <button
                                className={styles.hit}
                                onClick={() => { onGo(h.boardId); onClose(); }}
                            >
                                <span className={styles.where}>{h.boardName}</span>
                                <span className={styles.what}>{h.snippet}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
```

- [x] **Step 2: Write its stylesheet**

```css
.backdrop {
  position: fixed; inset: 0; z-index: 900;
  background: rgba(var(--shadow-rgb), 0.45);
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12vh;
}
.panel {
  width: min(560px, 92vw);
  max-height: 64vh;
  display: flex; flex-direction: column; gap: var(--space-3);
  background: var(--surface-mid); border: 1px solid var(--border);
  border-radius: var(--radius-xl); padding: var(--space-5);
  box-shadow: var(--shadow-5);
}
.input {
  width: 100%;
  background: var(--surface-high); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: var(--space-3) var(--space-4);
  color: var(--foreground); font-size: var(--text-md);
}
.input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.none { font-size: var(--text-xs); color: var(--muted); }
.hits {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: var(--space-1);
  overflow-y: auto; min-height: 0;
}
.hit {
  width: 100%; text-align: left; cursor: pointer;
  display: flex; flex-direction: column; gap: 2px;
  background: none; border: none; border-radius: var(--radius-md);
  padding: var(--space-3);
}
.hit:hover { background: rgba(var(--overlay-rgb), 0.06); }
.hit:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.where {
  font-size: var(--text-2xs); color: var(--accent);
  letter-spacing: 0.08em; text-transform: uppercase;
}
.what { font-size: var(--text-xs); color: var(--foreground); line-height: 1.45; }
```

- [x] **Step 3: Open it on Ctrl+F from ResearchTab**

Add to `ResearchTab.tsx`:

```tsx
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const typing = Boolean(target?.closest('input, textarea, [contenteditable="true"]'));
            const intent = intentFor({
                key: e.key,
                ctrlKey: e.ctrlKey, metaKey: e.metaKey,
                shiftKey: e.shiftKey, altKey: e.altKey,
                inTextField: typing,
                hasSelection: false,
            });
            if (intent?.kind === 'search') { e.preventDefault(); setSearchOpen(true); }
            if (intent?.kind === 'parentBoard') {
                e.preventDefault();
                const trail = breadcrumbFor(useWorkspaceStore.getState().researchBoards, boardId ?? '');
                const parent = trail.length > 1 ? trail[trail.length - 2] : null;
                if (parent) setOpenBoardId(parent.id);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [boardId]);
```

Render it when open, and import `intentFor` and `breadcrumbFor`.

- [x] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/editor/research/BoardSearch.tsx src/components/editor/research/BoardSearch.module.css src/components/editor/ResearchTab.tsx
git commit -m "feat: cross-board search panel on Ctrl+F"
```

---

## Task 11: Verify and close the phase

- [x] **Step 1: Full check**

```bash
npx tsc --noEmit
npx vitest run
npm run build
npx eslint src
```

Expected: `tsc` 0; **749 tests** (683 + 66 new); build compiles; eslint at **223** — the
baseline. Anything above it is new debt from this phase; fix it before committing.

- [x] **Step 2: Browser checks**

Use `read_page` rather than screenshots to confirm state — the preview pane's screenshots lag
behind React by a frame or two, which caused two false failures in Phase 1.

- Drop a Column; type a title; drag a note into it; confirm the count reads 1 and the note is
  drawn once, inside the column
- Collapse the column; confirm the children hide and the count stays
- Press `Ctrl F`; search a word on a nested board; confirm the hit names that board and going to
  it opens it
- Press `Ctrl U` on a child board; confirm it goes to the parent
- Delete a card that has a line attached; confirm the line goes with it

- [x] **Step 3: Mark the phase complete**

Tick every box in this file, add the status banner, and commit.

---

## Definition of done

- Cards can be grouped into titled columns with a live count, and a column's children are drawn
  once, by the column
- Lines connect cards, follow them, and are pruned when a card is deleted
- Cards carry labels, and the canvas can be filtered to them
- A locked card cannot be dragged or resized
- Search finds a card on any board in the project
- The keymap covers duplicate, add sibling, nudge, delete, deselect, group, lock, search and
  parent board
- 683 existing tests still pass, plus 66 new ones across five leaf modules
