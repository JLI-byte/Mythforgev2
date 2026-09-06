# Research Phase 3 — Card Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring the research board to parity with Milanote's card inventory, and pay off the two
things Phase 2 left owed — the gesture that draws a connection, and a way to set labels and locks.

**Architecture:** Every card is a `DeskWidget` with a typed `content` shape. Rules live in leaf
modules with tests; renderers only draw. Each renderer is self-contained — its own file, its own
stylesheet — so the desk stylesheet stops growing and the renderers can be built in parallel.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Zustand + persist, Vitest (jsdom),
CSS Modules, TipTap (already present, used by the Writing Zone).

---

## Before you start

- `vitest.config.ts` collects **`src/**/*.test.ts` only**. A `.test.tsx` never runs.
- Leaf module style: `src/lib/research/columns.ts`. 4-space indent, no store import beyond types,
  no React, a LEAF MODULE doc comment.
- **Do not add to `WritingDesk.module.css`** (6,938 lines). Each renderer gets its own module.
- `safeHref()` in `src/lib/safeUrl.ts` already exists and is the ONLY way a writer-supplied URL
  may become an href. Every card that renders a link uses it.

### What ships

| Card | Type key | Leaf module |
|---|---|---|
| Link with preview | `reference` (upgraded) | `linkPreview.ts` |
| To-do list | `todo` | `todo.ts` |
| Document | `document` | — (TipTap) |
| Colour swatch | `swatch` | — |
| Table | `table` | `tableGrid.ts` |
| Drawing | `drawing` | — (canvas) |
| Research templates | — | `researchTemplates.ts` |

**Not built:** map cards. Thin value for secondary-world fiction; revisit if asked.
**Video and audio** are not separate types — they are what a link card becomes when
`detectEmbed()` recognises the host.

---

## Task 1: Link preview rules

**Files:** Create `src/lib/research/linkPreview.ts` + `.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { detectEmbed, faviconFor, displayHost, normaliseLinkContent } from './linkPreview';

describe('detectEmbed', () => {
    it('recognises a YouTube watch URL', () => {
        expect(detectEmbed('https://www.youtube.com/watch?v=abc123'))
            .toEqual({ kind: 'video', provider: 'youtube', embedUrl: 'https://www.youtube.com/embed/abc123' });
    });

    it('recognises a youtu.be short link', () => {
        expect(detectEmbed('https://youtu.be/abc123')?.embedUrl)
            .toBe('https://www.youtube.com/embed/abc123');
    });

    it('recognises Vimeo', () => {
        expect(detectEmbed('https://vimeo.com/123456789'))
            .toEqual({ kind: 'video', provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789' });
    });

    it('recognises SoundCloud as audio', () => {
        const r = detectEmbed('https://soundcloud.com/artist/track');
        expect(r?.kind).toBe('audio');
        expect(r?.provider).toBe('soundcloud');
    });

    it('is null for an ordinary page', () => {
        expect(detectEmbed('https://example.com/article')).toBeNull();
    });

    it('is null for rubbish rather than throwing', () => {
        expect(detectEmbed('not a url')).toBeNull();
        expect(detectEmbed('')).toBeNull();
        expect(detectEmbed(undefined)).toBeNull();
    });

    it('refuses a non-http scheme even when the host looks right', () => {
        expect(detectEmbed('javascript:alert(1)//youtube.com/watch?v=x')).toBeNull();
    });
});

describe('displayHost', () => {
    it('drops the www and the scheme', () => {
        expect(displayHost('https://www.jstor.org/stable/44')).toBe('jstor.org');
    });
    it('assumes https for a bare host', () => {
        expect(displayHost('jstor.org/stable')).toBe('jstor.org');
    });
    it('is empty for rubbish', () => {
        expect(displayHost('not a url')).toBe('');
    });
});

describe('faviconFor', () => {
    it('builds a favicon URL from the host', () => {
        expect(faviconFor('https://jstor.org/x')).toContain('jstor.org');
    });
    it('is null when there is no safe host', () => {
        expect(faviconFor('javascript:alert(1)')).toBeNull();
    });
});

describe('normaliseLinkContent', () => {
    it('fills the title from the host when none was given', () => {
        expect(normaliseLinkContent({ url: 'https://jstor.org/stable/44' }).title).toBe('jstor.org');
    });
    it('leaves a title the writer set', () => {
        expect(normaliseLinkContent({ url: 'https://jstor.org', title: 'Sieges' }).title).toBe('Sieges');
    });
    it('defaults both toggles on, so a pasted link shows what it is', () => {
        const c = normaliseLinkContent({ url: 'https://x.test' });
        expect(c.showImage).toBe(true);
        expect(c.showDescription).toBe(true);
    });
    it('keeps toggles the writer turned off', () => {
        expect(normaliseLinkContent({ url: 'https://x.test', showImage: false }).showImage).toBe(false);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/research/linkPreview.test.ts` → FAIL, unresolved import.

- [ ] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — link cards.
 *
 * A link card is the research board's most-used card, and the only one whose
 * content comes from outside the app. Everything here judges a writer-supplied
 * string; nothing here trusts one.
 *
 * Video and audio are not separate card types. They are what a link card
 * becomes when the host is recognised, which is why detection lives here rather
 * than in a renderer.
 */

import { safeHref } from '@/lib/safeUrl';

export interface EmbedInfo {
    kind: 'video' | 'audio';
    provider: 'youtube' | 'vimeo' | 'soundcloud';
    embedUrl: string;
}

export interface LinkContent {
    url?: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    showImage?: boolean;
    showDescription?: boolean;
}

/** Parse via safeHref so a non-http scheme can never reach detection. */
function safeUrl(raw: string | null | undefined): URL | null {
    const href = safeHref(raw);
    if (!href) return null;
    try {
        return new URL(href);
    } catch {
        return null;
    }
}

export function detectEmbed(raw: string | null | undefined): EmbedInfo | null {
    const url = safeUrl(raw);
    if (!url) return null;

    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
        const v = url.searchParams.get('v');
        if (v) return { kind: 'video', provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${v}` };
    }
    if (host === 'youtu.be') {
        const id = url.pathname.replace(/^\//, '');
        if (id) return { kind: 'video', provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` };
    }
    if (host === 'vimeo.com') {
        const id = url.pathname.replace(/^\//, '');
        if (/^\d+$/.test(id)) return { kind: 'video', provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    if (host === 'soundcloud.com') {
        return {
            kind: 'audio',
            provider: 'soundcloud',
            embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.href)}`,
        };
    }
    return null;
}

export function displayHost(raw: string | null | undefined): string {
    const url = safeUrl(raw);
    return url ? url.hostname.replace(/^www\./, '') : '';
}

/** Google's favicon service. Null when there is no safe host to ask about. */
export function faviconFor(raw: string | null | undefined): string | null {
    const host = displayHost(raw);
    if (!host) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

/** Fill the gaps a freshly pasted link leaves. Never overwrites the writer. */
export function normaliseLinkContent(content: LinkContent): LinkContent {
    return {
        ...content,
        title: content.title || displayHost(content.url) || '',
        showImage: content.showImage ?? true,
        showDescription: content.showDescription ?? true,
    };
}
```

- [ ] **Step 4: Run it and watch it pass** — 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/linkPreview.ts src/lib/research/linkPreview.test.ts
git commit -m "feat: link preview rules — embed detection, favicon, host"
```

---

## Task 2: To-do rules

**Files:** Create `src/lib/research/todo.ts` + `.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { addItem, toggleItem, removeItem, editItem, todoProgress, type TodoItem } from './todo';

const items: TodoItem[] = [
    { id: 'a', text: 'Fix the siege duration', done: true },
    { id: 'b', text: 'Name the gate captain', done: false },
];

describe('addItem', () => {
    it('appends an unchecked item', () => {
        const r = addItem(items, 'Map the grain route', 'c');
        expect(r).toHaveLength(3);
        expect(r[2]).toEqual({ id: 'c', text: 'Map the grain route', done: false });
    });
    it('refuses an empty line rather than adding a blank row', () => {
        expect(addItem(items, '   ', 'c')).toBe(items);
    });
});

describe('toggleItem', () => {
    it('flips one item', () => {
        expect(toggleItem(items, 'b')[1].done).toBe(true);
    });
    it('leaves the others alone', () => {
        expect(toggleItem(items, 'b')[0].done).toBe(true);
    });
    it('is a no-op for an unknown id', () => {
        expect(toggleItem(items, 'zz')).toEqual(items);
    });
});

describe('removeItem', () => {
    it('drops one', () => {
        expect(removeItem(items, 'a').map(i => i.id)).toEqual(['b']);
    });
});

describe('editItem', () => {
    it('replaces the text', () => {
        expect(editItem(items, 'b', 'Name the captain')[1].text).toBe('Name the captain');
    });
    it('keeps the done state', () => {
        expect(editItem(items, 'a', 'x')[0].done).toBe(true);
    });
});

describe('todoProgress', () => {
    it('counts done over total', () => {
        expect(todoProgress(items)).toEqual({ done: 1, total: 2, percent: 50 });
    });
    it('is 0 percent for an empty list rather than NaN', () => {
        expect(todoProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    });
    it('is 100 when everything is done', () => {
        expect(todoProgress([{ id: 'a', text: 'x', done: true }]).percent).toBe(100);
    });
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — to-do cards.
 *
 * The natural home for "before I draft this chapter". Ids are passed in rather
 * than generated so every function stays pure and testable.
 */

export interface TodoItem {
    id: string;
    text: string;
    done: boolean;
}

export function addItem(items: TodoItem[], text: string, id: string): TodoItem[] {
    const trimmed = text.trim();
    if (!trimmed) return items;   // a blank row is never what was meant
    return [...items, { id, text: trimmed, done: false }];
}

export function toggleItem(items: TodoItem[], id: string): TodoItem[] {
    return items.map(i => (i.id === id ? { ...i, done: !i.done } : i));
}

export function removeItem(items: TodoItem[], id: string): TodoItem[] {
    return items.filter(i => i.id !== id);
}

export function editItem(items: TodoItem[], id: string, text: string): TodoItem[] {
    return items.map(i => (i.id === id ? { ...i, text } : i));
}

export function todoProgress(items: TodoItem[]): { done: number; total: number; percent: number } {
    const total = items.length;
    const done = items.filter(i => i.done).length;
    return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
```

- [ ] **Step 4: Run it and watch it pass** — 10 tests.

- [ ] **Step 5: Commit.**

---

## Task 3: Table rules

**Files:** Create `src/lib/research/tableGrid.ts` + `.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
    makeGrid, setCell, addRow, addColumn, removeRow, removeColumn, renameColumn, type Grid,
} from './tableGrid';

const g: Grid = {
    columns: ['Name', 'Role'],
    rows: [['Maren', 'Captain'], ['Idris', 'Sergeant']],
};

describe('makeGrid', () => {
    it('builds an empty grid of the given shape', () => {
        const r = makeGrid(2, 3);
        expect(r.columns).toHaveLength(2);
        expect(r.rows).toHaveLength(3);
        expect(r.rows[0]).toEqual(['', '']);
    });
});

describe('setCell', () => {
    it('writes one cell', () => {
        expect(setCell(g, 1, 0, 'Sgt.').rows[1][0]).toBe('Sgt.');
    });
    it('leaves the rest untouched', () => {
        expect(setCell(g, 1, 0, 'x').rows[0]).toEqual(['Maren', 'Captain']);
    });
    it('ignores an out-of-range cell rather than growing the grid', () => {
        expect(setCell(g, 9, 9, 'x')).toEqual(g);
    });
});

describe('addRow', () => {
    it('appends a row as wide as the columns', () => {
        const r = addRow(g);
        expect(r.rows).toHaveLength(3);
        expect(r.rows[2]).toEqual(['', '']);
    });
});

describe('addColumn', () => {
    it('appends a column and widens every row', () => {
        const r = addColumn(g, 'Age');
        expect(r.columns).toEqual(['Name', 'Role', 'Age']);
        expect(r.rows.every(row => row.length === 3)).toBe(true);
    });
});

describe('removeRow', () => {
    it('drops one row', () => {
        expect(removeRow(g, 0).rows).toEqual([['Idris', 'Sergeant']]);
    });
});

describe('removeColumn', () => {
    it('drops the column and the matching cell in every row', () => {
        const r = removeColumn(g, 1);
        expect(r.columns).toEqual(['Name']);
        expect(r.rows).toEqual([['Maren'], ['Idris']]);
    });
    it('refuses to remove the last column, which would strand the rows', () => {
        const one: Grid = { columns: ['Only'], rows: [['x']] };
        expect(removeColumn(one, 0)).toEqual(one);
    });
});

describe('renameColumn', () => {
    it('renames a header', () => {
        expect(renameColumn(g, 0, 'Who').columns[0]).toBe('Who');
    });
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — table cards.
 *
 * A grid of strings: headers plus rows. No formulas — Milanote has them, but a
 * writer tracking a regnal list or a casualty count does not need a
 * spreadsheet engine, and every cell being a string keeps search working.
 *
 * Every operation keeps the grid rectangular. A ragged grid renders wrong and
 * is very hard to repair by hand.
 */

export interface Grid {
    columns: string[];
    rows: string[][];
}

export function makeGrid(cols: number, rows: number): Grid {
    return {
        columns: Array.from({ length: cols }, (_, i) => `Column ${i + 1}`),
        rows: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    };
}

export function setCell(grid: Grid, row: number, col: number, value: string): Grid {
    if (row < 0 || row >= grid.rows.length) return grid;
    if (col < 0 || col >= grid.columns.length) return grid;
    return {
        ...grid,
        rows: grid.rows.map((r, i) => (i === row ? r.map((c, j) => (j === col ? value : c)) : r)),
    };
}

export function addRow(grid: Grid): Grid {
    return { ...grid, rows: [...grid.rows, grid.columns.map(() => '')] };
}

export function addColumn(grid: Grid, name: string): Grid {
    return {
        columns: [...grid.columns, name],
        rows: grid.rows.map(r => [...r, '']),
    };
}

export function removeRow(grid: Grid, row: number): Grid {
    return { ...grid, rows: grid.rows.filter((_, i) => i !== row) };
}

export function removeColumn(grid: Grid, col: number): Grid {
    if (grid.columns.length <= 1) return grid;   // rows must belong to something
    return {
        columns: grid.columns.filter((_, i) => i !== col),
        rows: grid.rows.map(r => r.filter((_, i) => i !== col)),
    };
}

export function renameColumn(grid: Grid, col: number, name: string): Grid {
    return { ...grid, columns: grid.columns.map((c, i) => (i === col ? name : c)) };
}
```

- [ ] **Step 4: Run it and watch it pass** — 11 tests.

- [ ] **Step 5: Commit.**

---

## Task 4: Research templates

**Files:** Create `src/lib/research/researchTemplates.ts` + `.test.ts`

The Research counterpart to Drafting's Writing Methods: a starter board rather than a blank one.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { RESEARCH_TEMPLATES, buildTemplate } from './researchTemplates';

describe('RESEARCH_TEMPLATES', () => {
    it('offers templates, each with an id, name and description', () => {
        expect(RESEARCH_TEMPLATES.length).toBeGreaterThan(0);
        for (const t of RESEARCH_TEMPLATES) {
            expect(t.id).toBeTruthy();
            expect(t.name).toBeTruthy();
            expect(t.description).toBeTruthy();
        }
    });

    it('has no duplicate ids', () => {
        const ids = RESEARCH_TEMPLATES.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('buildTemplate', () => {
    it('returns widgets for a known template', () => {
        const ws = buildTemplate('place-study', () => 'id');
        expect(ws.length).toBeGreaterThan(0);
    });

    it('gives every widget a distinct id from the supplied generator', () => {
        let n = 0;
        const ws = buildTemplate('place-study', () => `id-${n++}`);
        expect(new Set(ws.map(w => w.id)).size).toBe(ws.length);
    });

    it('lays columns out without overlapping them', () => {
        const cols = buildTemplate('place-study', (() => { let n = 0; return () => `id-${n++}`; })())
            .filter(w => w.type === 'column');
        const xs = cols.map(c => c.x);
        expect(new Set(xs).size).toBe(xs.length);
    });

    it('parents every child to a column that the template actually creates', () => {
        let n = 0;
        const ws = buildTemplate('place-study', () => `id-${n++}`);
        const ids = new Set(ws.map(w => w.id));
        for (const w of ws) {
            if (w.parentId) expect(ids.has(w.parentId)).toBe(true);
        }
    });

    it('is empty for an unknown template rather than throwing', () => {
        expect(buildTemplate('nope', () => 'id')).toEqual([]);
    });
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — starter boards for the Research stage.
 *
 * Drafting has Writing Methods; Research had nothing, so every board began
 * blank. These are the shapes a writer builds by hand anyway.
 *
 * The id generator is injected so the whole thing stays pure and a test can
 * assert on the ids it produced.
 */

import type { DeskWidget } from '@/store/workspaceStore';
import { COLUMN_WIDTH } from './columns';

export interface ResearchTemplate {
    id: string;
    name: string;
    description: string;
}

export const RESEARCH_TEMPLATES: ResearchTemplate[] = [
    { id: 'place-study',    name: 'Place study',    description: 'Geography, daily life, power, and what the reader must feel' },
    { id: 'character-dig',  name: 'Character dig',  description: 'What they want, what they fear, and what they are wrong about' },
    { id: 'event-timeline', name: 'Event timeline', description: 'Before, during and after, with the open questions kept apart' },
    { id: 'source-review',  name: 'Source review',  description: 'Reading list, verified facts, and contradictions to chase' },
];

/** column title -> the notes it starts with */
const LAYOUTS: Record<string, [string, string[]][]> = {
    'place-study': [
        ['Geography',      ['Terrain and approach', 'Weather through the year']],
        ['Daily life',     ['Who works, and at what', 'What is eaten, and when']],
        ['Power',          ['Who decides', 'Who enforces']],
        ['On the page',    ['What the reader should smell', 'The detail only a local would know']],
    ],
    'character-dig': [
        ['Want',           ['Stated want', 'Actual want']],
        ['Fear',           ['What they avoid', 'What it costs them']],
        ['Wrong about',    ['The belief', 'What breaks it']],
        ['Voice',          ['Words they use', 'Words they never use']],
    ],
    'event-timeline': [
        ['Before',         ['What made it possible', 'Who saw it coming']],
        ['During',         ['Hour by hour', 'Who was where']],
        ['After',          ['Who tells the story', 'What is misremembered']],
        ['Open questions', ['']],
    ],
    'source-review': [
        ['To read',        ['']],
        ['Verified',       ['']],
        ['Contradictions', ['']],
        ['Discarded',      ['Why it was wrong']],
    ],
};

const COLUMN_GAP = 40;
const COLUMN_TOP = 80;
const COLUMN_HEIGHT = 360;

export function buildTemplate(templateId: string, nextId: () => string): DeskWidget[] {
    const layout = LAYOUTS[templateId];
    if (!layout) return [];

    const widgets: DeskWidget[] = [];

    layout.forEach(([title, notes], i) => {
        const columnId = nextId();
        widgets.push({
            id: columnId,
            type: 'column',
            x: 80 + i * (COLUMN_WIDTH + COLUMN_GAP),
            y: COLUMN_TOP,
            width: COLUMN_WIDTH,
            height: COLUMN_HEIGHT,
            content: { title },
        });

        notes.filter(Boolean).forEach((text, j) => {
            widgets.push({
                id: nextId(),
                type: 'sticky',
                x: 0, y: 0, width: 200, height: 120,
                content: { text },
                parentId: columnId,
                columnOrder: j,
            });
        });
    });

    return widgets;
}
```

- [ ] **Step 4: Run it and watch it pass** — 7 tests.

- [ ] **Step 5: Commit.**

---

## Task 5: The renderers

**Files (each self-contained — its own component and stylesheet):**

- `src/components/editor/desk/widgets/LinkCardRenderer.tsx` + `.module.css`
- `src/components/editor/desk/widgets/TodoRenderer.tsx` + `.module.css`
- `src/components/editor/desk/widgets/SwatchRenderer.tsx` + `.module.css`
- `src/components/editor/desk/widgets/DocumentRenderer.tsx` + `.module.css`
- `src/components/editor/desk/widgets/TableRenderer.tsx` + `.module.css`
- `src/components/editor/desk/widgets/DrawingRenderer.tsx` + `.module.css`

Every renderer takes `{ content, onChange }` and must:

- read every colour from a token (`--surface-high`, `--border`, `--muted`, `--accent`,
  `--foreground`) — no literals, and never `--overlay-rgb` for anything meant to darken
- give every control a label, and a `:focus-visible` outline
- keep long text wrapping (`overflow-wrap: anywhere`) — clipped text is a bug
- debounce nothing itself; `onChange` is already debounced by `WidgetRenderer`

Per-card contracts:

**LinkCardRenderer** — `content: LinkContent`. Uses `normaliseLinkContent`, `detectEmbed`,
`faviconFor`, `displayHost` and `safeHref`. Shows a thumbnail (or the embed iframe when
`detectEmbed` returns one), title, host with favicon, description. Two toggle buttons hide the
image and description. A URL input when the card is empty. Never renders an anchor when
`safeHref` returns null.

**TodoRenderer** — `content: { items?: TodoItem[] }`. Uses `addItem`, `toggleItem`,
`removeItem`, `editItem`, `todoProgress`. Checkbox per row, a progress bar in the header, an
input at the foot that adds on Enter. Done rows are struck through and dimmed.

**SwatchRenderer** — `content: { title?: string; colors?: string[] }`. A row of colour chips,
each an `<input type="color">`; a button to add one and a control to remove one. Shows the hex
under each chip.

**DocumentRenderer** — `content: { html?: string }`. Long-form text via the TipTap setup the
Writing Zone already uses (`src/components/editor/desk/widgets/WritingZoneRenderer.tsx` is the
reference). Headings, lists, bold/italic. No toolbar beyond those.

**TableRenderer** — `content: { grid?: Grid }`. Uses `makeGrid`, `setCell`, `addRow`,
`addColumn`, `removeRow`, `removeColumn`, `renameColumn`. Editable header cells, editable body
cells, add row / add column buttons. The whole table scrolls inside `overflow-x: auto`.

**DrawingRenderer** — `content: { strokes?: number[][] }`. A `<canvas>` capturing pointer
strokes as arrays of x/y pairs, redrawn from `strokes` on mount and on resize. A clear button.
Strokes are stored, not a data URL — a data URL of a large sketch would bloat the persisted
workspace, which already has a size limit (`src/lib/workspaceSize.ts`).

- [ ] **Step 1: Build all six renderers**
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`
- [ ] **Step 3: Commit**

---

## Task 6: Register the new types

**Files:** `src/store/workspaceStore.ts`, `src/components/editor/desk/deskConstants.ts`,
`src/components/editor/desk/widgets/WidgetRenderer.tsx`, `src/components/editor/WritingDesk.tsx`

- [ ] **Step 1: Widen `DeskWidgetType`** with `'todo' | 'document' | 'swatch' | 'table' | 'drawing'`
- [ ] **Step 2: `DEFAULT_DIMS`** — todo 260×240, document 360×320, swatch 240×140,
      table 420×280, drawing 320×260. Add each to `PALETTE_ITEMS`.
- [ ] **Step 3: `WidgetRenderer`** — one `case` per type
- [ ] **Step 4: Research toolbar** — the toolbar is already five buttons wide, so the new types
      go behind a "＋ More" popover rather than six more buttons in a row
- [ ] **Step 5: Typecheck, test, commit**

---

## Task 7: Draw a connection

**Files:** `src/components/editor/WritingDesk.tsx`, `src/components/editor/desk/ConnectionLayer.tsx`

Phase 2 built the rules and the layer but no gesture. This is the corner dot.

- [ ] **Step 1: Add the handle**

On each research card, a dot at the top-right that appears on hover or selection. `onMouseDown`
on it starts a connection drag rather than a move drag.

- [ ] **Step 2: Track the drag**

Hold `{ fromWidgetId, toPoint }` in state while dragging; render a provisional line in
`ConnectionLayer` from the card to the live pointer.

- [ ] **Step 3: Complete or discard**

On mouse-up over another card, `makeConnection({widgetId: from}, {widgetId: over}, crypto.randomUUID())`
and write it to `connections`. On mouse-up over empty canvas, discard — a line to nowhere is
almost always a slip, and a free-point endpoint can be added later from the line's own menu.

- [ ] **Step 4: Delete a line**

A selected connection deletes on `Delete` via `removeConnection`.

- [ ] **Step 5: Typecheck, test, commit**

---

## Task 8: Label and lock UI

**Files:** `src/components/editor/research/LabelBar.tsx` + `.module.css`,
`src/components/editor/WritingDesk.tsx`

Phase 2 shipped the rules with nothing to set them.

- [ ] **Step 1: LabelBar** — a strip above the canvas listing the project's labels, each a
      toggle that filters the canvas via `filterByLabels`. A "＋ Label" button calls
      `createResearchLabel`.
- [ ] **Step 2: Apply to a card** — the selected card's context menu lists the labels; picking
      one calls `applyLabel` / `removeLabel`. Applied labels render as chips on the card.
- [ ] **Step 3: Lock** — a lock item in the same menu calling `toggleLock`; the drag and resize
      handlers already consult `canManipulate`, so confirm they do and wire them if not.
- [ ] **Step 4: Typecheck, test, commit**

---

## Task 9: Verify and close

- [ ] **Step 1:** `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npx eslint src`

Expected: tsc 0; **794 tests** (750 + 44 new); build compiles; eslint at **223**.

- [ ] **Step 2: Browser checks** — use `read_page`, not screenshots; the pane lags a frame.

- Paste a YouTube URL into a link card; confirm it embeds rather than showing a thumbnail
- Add three to-dos; check one; confirm the progress bar moves
- Add a table; add a column; confirm every row widened
- Draw on a drawing card; reload; confirm the strokes came back
- Drag from a card's corner dot to another card; confirm a line appears and follows both cards
- Delete a card with a line; confirm the line goes
- Apply a label; filter by it; confirm unlabelled cards hide and a labelled child keeps its column

- [ ] **Step 3:** Tick every box, add the status banner, commit.

---

## Definition of done

- Link cards preview and embed; to-do, document, swatch, table and drawing cards all work
- A research board can start from a template rather than blank
- A connection can be drawn by hand and deleted
- Labels and locks can be set, and the canvas can be filtered by label
- 750 existing tests still pass, plus 44 new ones across four leaf modules
