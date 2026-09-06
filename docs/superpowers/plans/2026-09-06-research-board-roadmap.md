# Research Board Roadmap

> **For agentic workers:** each phase below has, or will have, its own plan file in this
> directory. Execute a phase with superpowers:subagent-driven-development or
> superpowers:executing-plans. This file is the map, not the instructions.

**Goal:** Rebuild the Workshop's Research stage on Milanote's model, add the card types only
LoreCanvas can offer, and make a finished research board a live reference you can open while
Drafting and Writing.

**Source of the design:** `docs/superpowers/specs/` — see the Milanote study published at
`claude.ai/code/artifact/78ae98fc-7d66-468d-b1f0-97c317f6a8d6`.

---

## Decisions already taken

| Question | Answer |
|---|---|
| What is the exported artifact? | An **in-app Research Dossier** — read-only, opens in a side panel while Drafting or Writing, pinnable to a scene or chapter. Not a file. |
| Snapshot or live? | **Live.** A dossier is a saved query over a board tree, never a copy. No stale references, no doubled storage. |
| Comments, web clipper? | **Deferred.** Comments need real-time collaboration that does not exist. The clipper is a browser extension in its own repo with its own store review. Neither is a card type. |

---

## Architecture

### The board tree

Today a board is a `DeskState` in `researchStates`, keyed by a composite string
(`project:<id>` or `project:<id>::<boardId>`), with names held separately in `customBoards`.
That string encodes one level of nesting and cannot encode more.

Replace the *meaning* of the key, not the key itself:

```ts
interface ResearchBoardNode {
    id: string;              // the existing researchStates key, verbatim
    name: string;
    parentId: string | null; // null = the project's root board
    projectId: string;
}

researchBoards: Record<string, ResearchBoardNode>;
researchStates: Record<string, DeskState>;   // unchanged, same keys
```

Migration moves **no board data at all**. Existing composite keys become opaque ids; the
registry is derived from `researchStates` and `customBoards` on rehydration. New boards get a
`crypto.randomUUID()`. Nesting is `parentId`; breadcrumbs walk it upward.

A nested board appears on its parent canvas as a `DeskWidget` of type `board` whose content
holds `{ boardId }`.

### Widget model additions

Three fields on `DeskWidget`, all optional so every existing widget stays valid:

```ts
parentId?: string | null;  // set = laid out by its column, not by x/y
locked?: boolean;
labelIds?: string[];
```

Columns keep the widget list **flat**. A column is a widget; its children are ordinary widgets
carrying `parentId`. Search, the dossier and every existing traversal keep working unchanged.

Two additions to `DeskState`:

```ts
unsorted?: DeskWidget[];      // the per-board inbox; x/y meaningless here
connections?: Connection[];   // lines are not cards
```

### The dossier

```ts
interface Dossier {
    id: string;
    name: string;
    projectId: string;
    rootBoardId: string;
    includeNested: boolean;
    pinnedTo?: { kind: 'scene' | 'chapter' | 'project'; id: string };
}
```

A saved query. Rendering walks the tree from `rootBoardId` and draws it read-only.

---

## File structure

### New leaf modules — all logic lives here

`vitest.config.ts` collects only `src/**/*.test.ts`, never `.test.tsx`. Anything placed in a
component file cannot be tested in this repo, so every rule below is a leaf module.

| File | Responsibility |
|---|---|
| `src/lib/research/boardTree.ts` | Registry shape, `buildRegistry()`, `breadcrumbFor()`, `childrenOf()`, `descendantIds()`, `canMove()` |
| `src/lib/research/boardMigration.ts` | Derive the registry from legacy `researchStates` + `customBoards` |
| `src/lib/research/unsorted.ts` | Move a card between tray and canvas, drop position |
| `src/lib/research/columns.ts` | `childrenOfColumn()`, `reorderInColumn()`, `groupIntoColumn()`, `ungroup()` |
| `src/lib/research/connections.ts` | `Connection` type, endpoint resolution, orphan pruning |
| `src/lib/research/labels.ts` | Label CRUD, applying, filtering |
| `src/lib/research/boardSearch.ts` | Search across boards and cards, ranked |
| `src/lib/research/linkPreview.ts` | Parse a URL into a link card; embed detection |
| `src/lib/research/dossier.ts` | Dossier type, `collectDossier()` — flattens a board tree to ordered sections |
| `src/lib/research/researchTemplates.ts` | Starter board layouts |

### New components

| File | Responsibility |
|---|---|
| `src/components/editor/research/BoardBreadcrumbs.tsx` | The path, with drag-to-move-up |
| `src/components/editor/research/UnsortedTray.tsx` | The docked inbox |
| `src/components/editor/research/BoardToolRail.tsx` | The six draggable tools |
| `src/components/editor/desk/widgets/BoardCardRenderer.tsx` | Nested board card with content preview |
| `src/components/editor/desk/widgets/ColumnRenderer.tsx` | Titled stack, count, collapse |
| `src/components/editor/desk/widgets/TodoRenderer.tsx` | Checkable list |
| `src/components/editor/desk/widgets/DocumentRenderer.tsx` | Long-form text card |
| `src/components/editor/desk/widgets/SwatchRenderer.tsx` | Colour palette |
| `src/components/editor/desk/widgets/TableRenderer.tsx` | Grid |
| `src/components/editor/desk/widgets/DrawingRenderer.tsx` | Canvas sketch |
| `src/components/editor/desk/widgets/InterviewCardRenderer.tsx` | Interview on the board |
| `src/components/editor/desk/widgets/ScenePinRenderer.tsx` | Scene progress pin |
| `src/components/editor/desk/ConnectionLayer.tsx` | SVG lines over the canvas |
| `src/components/research/DossierPanel.tsx` | The read-only side panel |
| `src/components/research/DossierRenderer.tsx` | Board tree → sections |

---

## Phases

Dependency-ordered. Each produces working, shippable software on its own.

### Phase 1 — The board tree

**Plan:** `2026-09-06-research-phase-1-board-tree.md` (written)

The foundation. Nothing else can be built until a board can contain a board.

- Board registry with `parentId`, derived by migration from the current keys
- `board` widget type and its renderer, with a content preview
- Breadcrumbs, navigate in and out, `Ctrl U` to the parent
- Per-board unsorted tray, with quick capture writing into it
- Six-item tool rail replacing the current three-button toolbar

**Ships:** nesting and the inbox — the two ideas that change how the board is used.

### Phase 2 — Arrangement

**Plan:** to be written at the start of the phase.

- **Columns** — `parentId` on widgets, titled stack, live count, collapse, "Group into column" from multi-select
- **Lines** — `connections` on `DeskState`, drag from a card's corner dot, arrows, curves, labels, orphan pruning when a card is deleted
- **Labels** — per-project label set, applied to cards, filter the canvas by label
- **Locking** — `locked` on `DeskWidget`, excluded from drag and marquee selection
- **Search** — across every board in the project, ranked, `Ctrl F`
- **Shortcuts** — double-click to make a note, `Ctrl ⏎` for another, `Alt`-drag to duplicate, `Space`-drag to pan, arrows to nudge, `/` for the shortcut sheet

**Ships:** a board that stays legible past fifty cards.

### Phase 3 — Card types

**Plan:** to be written at the start of the phase.

- **Link card with preview** — upgrade `reference`: thumbnail, title, description, favicon, each toggleable; embed detection for YouTube, Vimeo, SoundCloud
- **To-do list** — checkable rows, progress in the header
- **Document** — long-form text, reusing the TipTap setup the Writing Zone already has
- **Colour swatch** — palette card
- **Table** — grid with typed columns; no formulas
- **Drawing** — freehand sketch on a canvas element
- **Video / audio** — embedded media cards
- **Research templates** — starter boards, the Research counterpart to Drafting's Writing Methods

**Deliberately not built:** map cards. Thin value for secondary-world fiction; revisit if asked.

**Ships:** parity with Milanote's card inventory.

### Phase 4 — Native cards and the Dossier

**Plan:** to be written at the start of the phase.

This is the half Milanote cannot copy.

- **Live Bible pin** — `biblePinit` reads its entity by id and re-renders when the article changes, instead of holding a copy
- **Consistency flag on the canvas** — drop `consistencyFlags` from `TRAY_WIDGET_TYPES` so the Lore Check's output can live on the board beside what it contradicts
- **Interview card** — run an interview in place on the board, answers stored on the card
- **Scene pin** — a scene's title, word count and progress, linking into the Writing stage
- **Research Dossier** — `collectDossier()` walks a board tree into ordered sections; `DossierPanel` renders it read-only in Drafting and Writing; pinnable to a scene or chapter

**Ships:** the research stage paying off in the other two stages, which is the point of the Workshop.

---

## Risks

**The migration is the only irreversible step.** It rewrites nothing, but it derives a registry
that everything afterwards depends on. Phase 1 pins it with tests over real legacy shapes —
a bare `project:<id>` board, a `::boardId` child, an orphan whose `customBoards` entry is gone,
and an empty workspace.

**`WritingDesk.tsx` is 1,073 lines and its stylesheet is 6,938.** Phase 2 adds columns and
connections to both. Extract `ConnectionLayer` and `ColumnRenderer` as separate files rather
than growing either, and split the research-specific CSS into its own module when the desk
stylesheet is next touched.

**`content: Record<string, any>` is untyped.** Every new card type widens the surface where a
typo is silent. Each new type gets a narrow content interface in its leaf module and a
type-guard tested in `.test.ts`.

**Deferred, not forgotten:** comments (needs collaboration) and the web clipper (needs an
extension repo). Neither blocks any phase here.
