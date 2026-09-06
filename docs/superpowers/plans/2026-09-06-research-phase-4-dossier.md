# Research Phase 4 — Native Cards and the Dossier

> **Status: complete.** Shipped 2026-09-06. 810 tests, tsc clean, build
> compiles, eslint at the 223 baseline.
>
> Verified in the browser that the dossier is a query and not a copy: a note
> edited on the board showed its new text in the dossier without the dossier
> being touched. That is the whole design premise, so it was worth proving
> rather than asserting.
>
> Scope correction carried out: the "live Bible pin" item was already true
> before this phase and no work was done on it.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Put the cards Milanote structurally cannot have onto the research canvas, and make a
finished board a live reference you can read while Drafting and Writing.

**Architecture:** A dossier is a **saved query**, never a copy — `{rootBoardId, includeNested}`
resolved at render time. Flattening a board tree into readable sections is a pure leaf module;
the panel only draws. Native cards read the store live, exactly as the Bible pin already does.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Zustand + persist, Vitest (jsdom),
CSS Modules.

---

## Scope correction

The roadmap listed "live Bible pin — reads its entity by id instead of holding a copy" as work.
**It is already true.** `WorldBiblePinRenderer` stores only `{entityId}` and renders
`entity.name`, `entity.description` and `entity.customFields` from `useWorkspaceStore(s =>
s.entities)`. Editing the article already updates the pin. That roadmap line was written from
the mockup rather than the code; no work is needed and none should be invented.

What is actually left:

| | |
|---|---|
| Consistency flags and article suggestions on the canvas | They are filtered off it by `TRAY_WIDGET_TYPES` |
| Interview card | Run an interview in place on the board |
| Scene pin | A scene's title, words and progress, linking into Writing |
| **Research Dossier** | The phase's centrepiece |
| LabelBar | Owed from Phase 3 |

---

## Task 1: Dossier rules

**Files:** Create `src/lib/research/dossier.ts` + `.test.ts`

The whole point of the phase. A dossier flattens a board tree into ordered, readable sections —
every card type reduced to a title and a body, because a reference you read while writing cannot
be a canvas.

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { summariseCard, collectDossier, makeDossier } from './dossier';
import type { BoardRegistry } from './boardTree';
import type { DeskWidget } from '@/store/workspaceStore';

const w = (over: Partial<DeskWidget>): DeskWidget => ({
    id: 'x', type: 'sticky', x: 0, y: 0, width: 1, height: 1, content: {}, ...over,
});

describe('summariseCard', () => {
    it('reads a sticky note as its text', () => {
        expect(summariseCard(w({ type: 'sticky', content: { text: 'Nine days' } })))
            .toEqual({ title: 'Note', body: 'Nine days' });
    });

    it('reads a link as its title and host', () => {
        const r = summariseCard(w({ type: 'reference', content: { title: 'Supply lines', url: 'https://www.jstor.org/x' } }));
        expect(r.title).toBe('Supply lines');
        expect(r.body).toContain('jstor.org');
    });

    it('reads a to-do as its progress and its open items', () => {
        const r = summariseCard(w({
            type: 'todo',
            content: { items: [
                { id: 'a', text: 'Fix duration', done: true },
                { id: 'b', text: 'Name the captain', done: false },
            ] },
        }));
        expect(r.title).toBe('To do — 1/2');
        expect(r.body).toContain('Name the captain');
        expect(r.body).not.toContain('Fix duration');   // done items are not outstanding work
    });

    it('reads a column as its title and count', () => {
        expect(summariseCard(w({ type: 'column', content: { title: 'Open questions' } })).title)
            .toBe('Open questions');
    });

    it('reads a table as its headers and row count', () => {
        const r = summariseCard(w({
            type: 'table',
            content: { grid: { columns: ['Name', 'Role'], rows: [['Maren', 'Captain']] } },
        }));
        expect(r.body).toContain('Name');
        expect(r.body).toContain('1 row');
    });

    it('strips tags from a document rather than printing markup', () => {
        const r = summariseCard(w({ type: 'document', content: { html: '<p>The <b>west</b> gate</p>' } }));
        expect(r.body).toBe('The west gate');
    });

    it('names a card with nothing in it rather than returning empty', () => {
        expect(summariseCard(w({ type: 'drawing', content: {} })).title).toBe('Drawing');
    });
});

const REG: BoardRegistry = {
    b1: { id: 'b1', name: 'Main',      parentId: null, projectId: 'p1' },
    b2: { id: 'b2', name: 'The Siege', parentId: 'b1', projectId: 'p1' },
    b3: { id: 'b3', name: 'Defenders', parentId: 'b2', projectId: 'p1' },
    z9: { id: 'z9', name: 'Elsewhere', parentId: null, projectId: 'p2' },
};

const STATES = {
    b1: { widgets: [w({ id: 'c1', content: { text: 'Root note' } })] },
    b2: { widgets: [w({ id: 'c2', content: { text: 'Siege note' } })] },
    b3: { widgets: [w({ id: 'c3', content: { text: 'Defender note' } })] },
    z9: { widgets: [w({ id: 'c9', content: { text: 'Other project' } })] },
} as never;

describe('collectDossier', () => {
    const base = { registry: REG, states: STATES };

    it('returns the root board first, depth first', () => {
        const d = makeDossier('d1', 'Siege research', 'p1', 'b1');
        expect(collectDossier(base, d).map(s => s.boardName)).toEqual(['Main', 'The Siege', 'Defenders']);
    });

    it('records depth so the panel can indent', () => {
        const d = makeDossier('d1', 'x', 'p1', 'b1');
        expect(collectDossier(base, d).map(s => s.depth)).toEqual([0, 1, 2]);
    });

    it('stops at the root board when nesting is off', () => {
        const d = { ...makeDossier('d1', 'x', 'p1', 'b1'), includeNested: false };
        expect(collectDossier(base, d).map(s => s.boardName)).toEqual(['Main']);
    });

    it('can be rooted partway down the tree', () => {
        const d = makeDossier('d1', 'x', 'p1', 'b2');
        expect(collectDossier(base, d).map(s => s.boardName)).toEqual(['The Siege', 'Defenders']);
    });

    it('summarises each card in the section', () => {
        const d = makeDossier('d1', 'x', 'p1', 'b1');
        expect(collectDossier(base, d)[0].cards[0].body).toBe('Root note');
    });

    it('never leaves the project, even if a board id were reused', () => {
        const d = makeDossier('d1', 'x', 'p1', 'b1');
        const names = collectDossier(base, d).map(s => s.boardName);
        expect(names).not.toContain('Elsewhere');
    });

    it('includes the unsorted tray, marked as unsorted', () => {
        const states = {
            b1: { widgets: [], unsorted: [w({ id: 'u1', content: { text: 'Not filed yet' } })] },
        } as never;
        const d = { ...makeDossier('d1', 'x', 'p1', 'b1'), includeNested: false };
        const section = collectDossier({ registry: REG, states }, d)[0];
        expect(section.cards[0].unsorted).toBe(true);
    });

    it('is empty for a root board that does not exist', () => {
        const d = makeDossier('d1', 'x', 'p1', 'nope');
        expect(collectDossier(base, d)).toEqual([]);
    });

    it('drops a board with nothing on it, so the panel is not a list of empty headings', () => {
        const states = { b1: { widgets: [w({ id: 'c1', content: { text: 'x' } })] }, b2: { widgets: [] } } as never;
        const d = makeDossier('d1', 'x', 'p1', 'b1');
        expect(collectDossier({ registry: REG, states }, d).map(s => s.boardName)).toEqual(['Main']);
    });
});
```

- [x] **Step 2: Run it and watch it fail.**

- [x] **Step 3: Write the module**

```ts
/**
 * LEAF MODULE — the Research Dossier.
 *
 * A dossier is a SAVED QUERY, never a copy: it holds which board tree to read
 * and renders it live. Research keeps moving while a chapter is drafted, and a
 * frozen dossier would quietly become wrong.
 *
 * Flattening happens here because a reference you read while writing cannot be
 * a canvas. Every card type is reduced to a title and a body; a card this does
 * not understand still gets its type name rather than disappearing.
 */

import type { DeskWidget } from '@/store/workspaceStore';
import type { BoardRegistry } from './boardTree';
import { childrenOfColumn } from './columns';
import { todoProgress, type TodoItem } from './todo';
import { displayHost } from './linkPreview';
import type { Grid } from './tableGrid';

export interface Dossier {
    id: string;
    name: string;
    projectId: string;
    rootBoardId: string;
    includeNested: boolean;
    pinnedTo?: { kind: 'scene' | 'chapter' | 'project'; id: string };
}

export interface DossierCard {
    id: string;
    type: string;
    title: string;
    body: string;
    unsorted?: boolean;
}

export interface DossierSection {
    boardId: string;
    boardName: string;
    depth: number;
    cards: DossierCard[];
}

export function makeDossier(
    id: string, name: string, projectId: string, rootBoardId: string,
): Dossier {
    return { id, name, projectId, rootBoardId, includeNested: true };
}

/** Readable names for card types that carry no title of their own. */
const TYPE_NAMES: Record<string, string> = {
    sticky: 'Note', image: 'Image', reference: 'Link', drawing: 'Drawing',
    swatch: 'Palette', document: 'Document', table: 'Table', todo: 'To do',
    board: 'Board', column: 'Column', biblePinit: 'Bible pin',
    scenePin: 'Scene', interview: 'Interview', consistencyFlags: 'Consistency flags',
    articleSuggestions: 'Article suggestions',
};

function textFromHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** One card, reduced to something readable in a list. */
export function summariseCard(widget: DeskWidget): { title: string; body: string } {
    const c = (widget.content ?? {}) as Record<string, unknown>;
    const fallback = TYPE_NAMES[widget.type] ?? widget.type;

    switch (widget.type) {
        case 'sticky':
            return { title: fallback, body: String(c.text ?? '') };

        case 'reference': {
            const host = displayHost(String(c.url ?? ''));
            return {
                title: String(c.title || fallback),
                body: [host, String(c.description ?? '')].filter(Boolean).join(' — '),
            };
        }

        case 'todo': {
            const items = (c.items ?? []) as TodoItem[];
            const { done, total } = todoProgress(items);
            // Only what is still outstanding: a dossier is read to find work left.
            const open = items.filter(i => !i.done).map(i => i.text);
            return { title: `To do — ${done}/${total}`, body: open.join('\n') };
        }

        case 'document':
            return { title: fallback, body: textFromHtml(String(c.html ?? '')) };

        case 'table': {
            const grid = c.grid as Grid | undefined;
            if (!grid) return { title: fallback, body: '' };
            const n = grid.rows.length;
            return {
                title: fallback,
                body: `${grid.columns.join(' · ')} (${n} row${n === 1 ? '' : 's'})`,
            };
        }

        case 'column':
            return { title: String(c.title || fallback), body: '' };

        case 'swatch':
            return { title: String(c.title || fallback), body: ((c.colors ?? []) as string[]).join(' ') };

        default:
            return { title: String(c.title || fallback), body: String(c.text ?? '') };
    }
}

interface DossierInput {
    registry: BoardRegistry;
    states: Record<string, { widgets?: DeskWidget[]; unsorted?: DeskWidget[] }>;
}

/** Depth-first from the dossier's root. Empty boards are omitted. */
export function collectDossier(input: DossierInput, dossier: Dossier): DossierSection[] {
    const root = input.registry[dossier.rootBoardId];
    if (!root || root.projectId !== dossier.projectId) return [];

    const sections: DossierSection[] = [];

    const walk = (boardId: string, depth: number) => {
        const node = input.registry[boardId];
        if (!node || node.projectId !== dossier.projectId) return;

        const state = input.states[boardId];
        const onCanvas = state?.widgets ?? [];
        const inTray = state?.unsorted ?? [];

        // A card inside a column is listed under the column, not twice, so the
        // dossier reads in the order the board is arranged.
        const parented = new Set(onCanvas.filter(x => x.parentId).map(x => x.id));
        const ordered: DeskWidget[] = [];
        for (const card of onCanvas) {
            if (parented.has(card.id)) continue;
            ordered.push(card);
            if (card.type === 'column') ordered.push(...childrenOfColumn(onCanvas, card.id));
        }

        const cards: DossierCard[] = [
            ...ordered.map(x => ({ id: x.id, type: x.type, ...summariseCard(x) })),
            ...inTray.map(x => ({ id: x.id, type: x.type, ...summariseCard(x), unsorted: true })),
        ];

        if (cards.length > 0) {
            sections.push({ boardId, boardName: node.name, depth, cards });
        }

        if (!dossier.includeNested) return;
        for (const child of Object.values(input.registry)) {
            if (child.parentId === boardId) walk(child.id, depth + 1);
        }
    };

    walk(dossier.rootBoardId, 0);
    return sections;
}
```

- [x] **Step 4: Run it and watch it pass** — 16 tests.

- [x] **Step 5: Commit.**

---

## Task 2: Dossier state in the store

**Files:** `src/store/workspaceStore.ts`

- [x] **Step 1:** `researchDossiers: Record<string, Dossier[]>` keyed by project id, in the
      interface, the initial state (`{}`) and `partialize`.
- [x] **Step 2:** actions `createDossier(projectId, name, rootBoardId) => string`,
      `deleteDossier(projectId, dossierId)`, `updateDossier(projectId, dossierId, patch)`.
- [x] **Step 3:** `activeDossierId: string | null` plus `setActiveDossierId`, **not** persisted —
      which dossier is open is a view state, not a document.
- [x] **Step 4:** Typecheck and commit.

---

## Task 3: The Dossier panel

**Files:** Create `src/components/research/DossierPanel.tsx` + `.module.css`,
`src/components/research/DossierRenderer.tsx`

- [x] **Step 1: DossierRenderer** — takes `sections: DossierSection[]`, draws headings indented
      by `depth` and a definition-style list of cards. Read-only. An unsorted card carries a
      small "unsorted" chip. Nothing is editable — this is a reference, and a stray keystroke
      while drafting must not alter research.
- [x] **Step 2: DossierPanel** — a right-hand panel with a dossier picker at the top, then the
      renderer. Selects `researchBoards` and `researchStates`, calls `collectDossier`.
- [x] **Step 3: Mount it in the Workshop** — visible on the Drafting and Writing stages only.
      The Research stage is the board itself; a dossier of the board you are looking at is noise.
- [x] **Step 4:** Typecheck and commit.

---

## Task 4: Native cards on the canvas

**Files:** `src/components/editor/WritingDesk.tsx`, `WidgetRenderer.tsx`, `deskConstants.ts`,
plus two new renderers

- [x] **Step 1: Let the lore cards onto the board** — `TRAY_WIDGET_TYPES` currently filters
      `articleSuggestions` and `consistencyFlags` off every canvas. Keep the filter for the desk
      and draft variants; drop it for research, so a flag can sit beside the note it contradicts.
- [x] **Step 2: ScenePinRenderer** — `content: { sceneId }`. Reads the scene live from the
      store: title, word count, and progress against the project's target. A button opens it in
      the Writing stage. Renders "This scene was deleted." when the id no longer resolves,
      exactly as the Bible pin does for an entity.
- [x] **Step 3: InterviewCardRenderer** — `content: { interviewId, answers }`. Lists the
      interview's questions with the answers given so far and a progress count. Reuses
      `buildInterviewSections` from `src/lib/interviews` to create the article when complete.
- [x] **Step 4:** Register both, add to `DEFAULT_DIMS` and the ＋ More menu, typecheck, commit.

---

## Task 5: LabelBar (owed from Phase 3)

**Files:** Create `src/components/editor/research/LabelBar.tsx` + `.module.css`,
modify `ResearchTab.tsx`, `WritingDesk.tsx`

- [x] **Step 1: LabelBar** — a strip under the breadcrumbs listing the project's labels as
      toggles. Toggling filters the canvas through `filterByLabels`. A "＋ Label" button prompts
      for a name and calls `createResearchLabel`.
- [x] **Step 2: Apply to the selected card** — with a card selected, clicking a label in the bar
      applies or removes it via `applyLabel` / `removeLabel`. With nothing selected, clicking
      filters instead. The bar says which mode it is in.
- [x] **Step 3: Chips on the card** — a card's labels render as small coloured chips in its
      title bar, from `labelsOn`.
- [x] **Step 4:** Typecheck and commit.

---

## Task 6: Verify and close

- [x] **Step 1:** `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npx eslint src`

Expected: tsc 0; **810 tests** (794 + 16); build compiles; eslint at **223**.

- [x] **Step 2: Browser checks** — `read_page`, not screenshots; the pane lags a frame.

- Build a two-level board with notes on both, make a dossier of the root, switch to Writing and
  confirm both boards appear with the child indented
- Turn nesting off; confirm only the root remains
- Edit a note on the board; return to Writing; confirm the dossier shows the new text — this is
  the whole point of it being a query rather than a copy
- Run the lore check; confirm the flags card can sit on the research canvas
- Create a label, apply it to a card, filter by it

- [x] **Step 3:** Tick every box, add the status banner, commit.

---

## Definition of done

- A dossier reads a board tree live and is readable while Drafting and Writing
- Consistency flags and article suggestions can live on the research canvas
- Scene pins and interview cards work, and both degrade honestly when their target is deleted
- Labels can be created, applied and filtered by
- 794 existing tests still pass, plus 16 new ones
