# Home world shelf — design

**Date:** 2026-09-01
**Branch:** `feature/app-styling`
**Status:** approved, not yet implemented

## Problem

The Home bento's "Your world" tile lists World Bible article counts by type
("Characters 12, Places 8"). It answers a question nobody asks on landing. It
does not say what the writer is actually working on, and it does not connect to
the stories.

Separately, the Bookshelf page renders each world as a full-width horizontal
band — a 3D World Bible book plus a diamond grid of story covers. That layout
does not scale past a handful of worlds, and it cannot be reused anywhere
smaller.

## Goal

Replace the tile's contents with a **shelf of world spines**. Clicking a spine
opens that world beside it, revealing the stories inside. Build it as one
component that also works at full-page size, so the Bookshelf page can adopt the
same metaphor later without a rewrite.

## Scope

**In:** the shared shelf component, its data derivation, and its use in the Home
tile.

**Out, deliberately:** drag-to-reshelve, world creation, story creation, and the
shelf wizard. Those live on the Bookshelf page and stay there until that page is
migrated. Migrating it is a separate piece of work with its own spec.

## Data model

Worlds and projects already relate the way this feature needs:

- `World` — the setting: `id`, `name`, `genre`, `coverColor`, `createdAt`
- `Project` — a story, optionally pointing at a world via `worldId`
- Projects with no `worldId` belong to a **Standalones** pseudo-shelf, matching
  existing Bookshelf behaviour
- `Entity` (World Bible article) is scoped by `worldId`, resolved through
  `worldKeyForEntity`

No schema change is required.

### New leaf module: `src/lib/worldShelves.ts`

Pure, no store or React import, unit tested — following the pattern of
`homeStats.ts` and `goalSchedule.ts`.

```ts
export interface ShelfStory {
  id: string;
  name: string;
  coverColor: string;
  coverImageUrl?: string;
  updatedAt: number;
}

export interface Shelf {
  key: WorldKey;          // world id, or STANDALONE_KEY
  name: string;
  coverColor: string;
  stories: ShelfStory[];
  articleCount: number;
  isStandalone: boolean;
}

export function buildShelves(
  worlds: World[],
  projects: Project[],
  entities: { worldId?: string }[],
): Shelf[];
```

**Ordering:** worlds by `createdAt` ascending, Standalones always last. Not by
recency — spines that reshuffle between visits stop being findable, which
defeats the point of a shelf.

**Standalones shelf** is emitted only when at least one project has no
`worldId`.

## Component

`WorldShelf` — `src/components/home/WorldShelf.tsx` plus its own CSS module.

Presentational only. It receives a `Shelf[]` and callbacks; it never touches the
store. That is what lets the Bookshelf page mount it later at a different size
with no change to the component.

```ts
interface WorldShelfProps {
  shelves: Shelf[];
  size: 'tile' | 'page';
  selectedKey: WorldKey | null;
  onSelect: (key: WorldKey) => void;
  onOpenStory: (projectId: string) => void;
  onOpenBible: (key: WorldKey) => void;
}
```

`size` drives spine width, spine height range, and story-cover size through CSS
custom properties, not through branching markup.

### Spines

- **Height encodes story count.** A world with six books stands taller than one
  with one. Deterministic, so it never jitters between renders, and it carries
  information rather than being decorative.
- Colour is the world's `coverColor`; Standalones gets a neutral grey.
- The world name runs vertically along the spine. Below a legible threshold the
  name is dropped and exposed via `title`/`aria-label` instead of being
  squeezed.
- The selected spine leans out from the shelf.

### Opened panel

Sits beside the spines and shows:

- World name
- `3 stories · 41 articles` — this is where the article counts the tile used to
  show now live, scoped per world instead of globally
- Story covers, using each project's `coverImageUrl` or `coverColor`
- An "Open world bible" link

### Interactions

- Click or keyboard-activate a spine → select that shelf
- Click a story → `setActiveProject(id)` then `setWorkspaceMode('desk')`, the
  same path "Recent projects" already uses
- Click "Open world bible" → `setActiveWorldKey(key)` then
  `setWorkspaceMode('worldBible')`
- Spines are a roving-tabindex group: arrow keys move between spines, Enter or
  Space selects

## Home integration

`HomePage` derives shelves with `useMemo`, holds `selectedKey` in local state,
and renders `<WorldShelf size="tile" />`.

### Bento layout

`.tileWorld` changes from `grid-column: span 1` to `span 2`, and the tiles after
the heatmap are reordered to:

```
world(2), lore(2), attention(1), links(2)
```

This yields a full row of world + "From your world", then attention + "Jump to".
The one empty grid slot lands beside "Jump to" — where it already sits today —
so the layout is no worse while the world tile doubles in width.

Responsive behaviour is unchanged in kind: at ≤1000px the bento is 2 columns and
the world tile spans both; at ≤620px it spans the single column and the opened
panel stacks beneath the spines.

## Empty states

| Condition | Tile shows |
|---|---|
| No worlds and no projects | "Your shelf is empty" plus a button to the Bookshelf |
| Standalone projects but no worlds | The Standalones spine, opened by default |
| Worlds exist, nothing selected yet | First shelf opened by default |

A tile showing only closed spines would waste its second column, so something is
always open.

## Testing

**Unit — `src/lib/worldShelves.test.ts`:**

- Groups projects under their world by `worldId`
- Emits a Standalones shelf only when unassigned projects exist
- Counts articles per world through `worldKeyForEntity`
- Orders worlds by `createdAt` with Standalones last
- Handles a world with no stories, and projects referencing a deleted world
  (they fall to Standalones rather than vanishing)

**Component:** covered by live verification in the browser preview — spine
selection, story click routing to the desk, bible link routing, keyboard
navigation, and the three empty states. Consistent with how the rest of the Home
bento is verified.

## Risks

- **A single world makes the shelf look thin.** Accepted: the empty states keep
  the tile useful, and the shape earns itself as worlds accumulate.
- **Growing the tile pushes "Jump to" further down.** Accepted; the gap is not
  made worse than it is today.
- **Spine-height-by-story-count compresses at the extremes** — a 1-story and a
  2-story world barely differ, and a 40-story world would blow out. Height is
  clamped to a range, so the encoding is a hint, not a precise scale.

## Follow-up, not in this spec

Migrating the Bookshelf page to `WorldShelf size="page"`. That requires rehoming
the shelf wizard, drag-to-reshelve, story creation, and the 3D World Bible book
verb-selector, and deserves its own design pass.
