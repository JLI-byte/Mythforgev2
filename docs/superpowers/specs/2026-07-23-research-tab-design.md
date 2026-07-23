# Research Tab — Design Spec

**Date:** 2026-07-23
**Status:** Approved for Phase 1
**Author:** brainstormed with Claude

## Summary

Add a **Research** tab to the top ModeBar, positioned between **Bookshelf**
and **Draft Table**. Phase 1 ships a spatial research board — a corkboard of
note cards and clippings — built by reusing the existing Writing Desk canvas
engine.

The full vision (chosen by the user as "all of this") is a research space that
eventually holds: reference clippings, freeform documents, an AI research
assistant, and a spatial corkboard. This spec covers **Phase 1 only**
(corkboard + clippings). Later phases are listed but not designed in detail
here.

## Goals

- A new `research` workspace mode with its own tab and icon.
- A blank spatial canvas per research board (no Writing Zone, no writing-method
  library).
- Three card types in Phase 1: **Note**, **Clipping** (image), **Link**.
- Two scope levels the user switches between: **per-project** and
  **per-world/shelf**.
- Boards persist like existing desk/draft boards (debounced local save + cloud
  sync).

## Non-Goals (Phase 1)

- Rich-text document cards (Phase 2).
- AI research assistant (Phase 3 — requires backend/API wiring).
- Collections / folders / board organization beyond the freeform canvas.
- Cross-scope moving of cards (copying a card from project → world).

## Existing Architecture Being Reused

The Writing Desk (`src/components/editor/WritingDesk.tsx`) is already a complete
spatial canvas engine:

- Draggable / resizable widgets with pan + zoom.
- Drag-drop of images from local files and from browser tabs (URL/HTML).
- Per-project persistence via store slices (`deskStates`, `draftStates`), each a
  `DeskState` (`widgets`, `zoom`, `canvasOffset`).
- A `variant` prop already distinguishes `'desk'` (seeds a Writing Zone) from
  `'draft'` (blank canvas, writing-method library).

Existing widget types reused by Research:

- `sticky` → **Note card**
- `image` → **Clipping card** (drag-drop already produces these)
- `reference` → **Link card**

The scope model mirrors two existing patterns:

- Per-project keying, like `deskStates[projectId]` / `draftStates[projectId]`.
- Per-shelf keying via `WorldKey` (`src/lib/worldKey.ts`), like the World Bible
  (`worldBibles[worldKey]`). A project with no world resolves to the
  `standalone` shelf.

## Design

### 1. Navigation & mode

- Add `'research'` to the `WorkspaceMode` union in `workspaceStore.ts`.
- Insert a tab into `MODE_TABS` (`ModeBar.tsx`) between `bookshelf` and
  `template`:
  `{ mode: 'research', label: 'Research', Icon: Telescope }`
  (Telescope from `lucide-react`; final icon is easily swapped.)
- Add a render branch in `page.tsx`: when `workspaceMode === 'research'`, render
  the research canvas.
- The `data-workspace-mode` attribute already reflects the mode for scoped
  theming; no change needed beyond the new value.

### 2. The canvas surface

Reuse the Writing Desk canvas as a third variant: `variant="research"`.

- **Blank canvas:** no seeded Writing Zone (the existing seeding effect already
  early-returns for the draft variant; research follows the same guard).
- **No writing-method library / finder / export** — those are draft-only and
  stay gated behind `isDraft`.
- **Research Add menu:** a small palette exposing only **Note**, **Clipping**,
  **Link** (instead of the full desk palette). Clippings can also be created by
  dragging images onto the canvas, which already works.

### 3. Scope switcher

- A control at the top of the Research tab toggles the active scope:
  **This Project · This World**.
- Scope selection is Research-local UI state (not global). Default: **This
  Project**.
- Resolving the board key:
  - *This Project* → `project:<activeProjectId>`
  - *This World* → `world:<WorldKey>` where the key is derived from the active
    project's world, falling back to the `standalone` shelf when the project has
    no world (reuse `worldKeyForProject`).
- When there is no active project, the tab shows the same empty-state welcome
  the desk uses (no project selected).

### 4. Storage

Add one persisted store slice keyed by a composite scope key, keeping the
existing `DeskState` shape:

```ts
researchStates: Record<string, DeskState>   // key: `project:<id>` | `world:<worldKey>`
updateResearchState(scopeKey: string, updates: Partial<DeskState>): void
```

- A single map (composite key) is preferred over two parallel maps: one action,
  one persisted field, and it naturally supports both scopes.
- Add `researchStates` to `partializeWorkspace` so it is included in both local
  persistence and Supabase cloud sync (the two must agree on the payload).
- Reuse the existing debounced localStorage adapter and cloud-sync path — no new
  persistence machinery.

### 5. Wiring the canvas to the scope key

The Writing Desk currently derives its data slice directly from
`activeProjectId` (`isDraft ? draftStates[id] : deskStates[id]`). Research needs
the slice to come from the composite scope key instead.

Implementation approach (detail deferred to the plan):

- Extend the desk's data-source selection so the `research` variant reads/writes
  `researchStates[scopeKey]`, where `scopeKey` is supplied by the Research tab's
  scope switcher.
- Prefer a thin `ResearchTab` wrapper that owns the scope-switcher state and the
  Add menu, then renders the shared canvas with the resolved scope key — keeping
  scope logic out of the already-large `WritingDesk` body. Whether this is a
  wrapper + prop or a small internal branch is an implementation decision for
  the plan; the design requirement is only that research reads/writes the
  correct scoped slice.

## Data Flow

1. User clicks the **Research** tab → `setWorkspaceMode('research')`.
2. `page.tsx` renders the research canvas.
3. Scope switcher resolves a `scopeKey` from the active project / its world.
4. Canvas reads `researchStates[scopeKey]` (widgets, zoom, offset).
5. User adds Note/Clipping/Link cards or drags in images → `updateResearchState`
   writes back to that scope key.
6. Debounced localStorage + cloud sync persist the board.
7. Switching scope re-resolves the key and swaps to that board's widgets.

## Error Handling & Edge Cases

- **No active project:** show the existing empty desk welcome; scope switcher is
  inert until a project is chosen.
- **Project with no world:** *This World* resolves to the `standalone` shelf, so
  the toggle still works and never dead-ends.
- **Empty board:** render a lightweight research-specific empty state prompting
  the user to add a card or drag in an image.
- **Persistence quota:** inherits the existing try/catch around
  `localStorage.setItem`; a full quota fails silently for that write, consistent
  with current behavior.

## Testing

- **Unit:** scope-key resolution (project vs world, world-less project →
  standalone). Pure function, table-driven.
- **Unit:** store action `updateResearchState` writes to the correct composite
  key and leaves other keys untouched (immutability).
- **Integration/E2E (Playwright):**
  - Research tab appears between Bookshelf and Draft Table and activates.
  - Adding a Note card persists across a reload.
  - Switching scope swaps boards and each retains its own cards.
  - Dragging an image onto the board creates a Clipping card.
- **Visual:** board renders correctly in light and dark themes.

## Later Phases (not designed here)

- **Phase 2 — Document cards:** rich-text research documents as a card type,
  reusing the TipTap editor already used for articles/scenes.
- **Phase 3 — AI research assistant:** a docked assistant (chat/search) that can
  gather findings and drop them onto the board. Requires backend/API wiring
  (Claude); heaviest phase, intentionally last.
- **Later — Collections/folders:** optional organization above the freeform
  canvas.

## Files Touched (Phase 1, anticipated)

- `src/store/workspaceStore.ts` — `WorkspaceMode` union, `researchStates` slice +
  action, `partializeWorkspace`.
- `src/components/navigation/ModeBar.tsx` — new `MODE_TABS` entry.
- `src/app/page.tsx` — render branch for `research`.
- `src/components/editor/WritingDesk.tsx` (+ desk subcomponents) — `research`
  variant data-source wiring and Research Add menu, or a new `ResearchTab`
  wrapper around the shared canvas.
- Tests as listed above.
