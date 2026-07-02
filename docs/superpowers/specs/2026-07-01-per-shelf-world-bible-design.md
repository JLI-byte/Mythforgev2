# Per-Shelf World Bible + Book Actions — Design Spec

**Date:** 2026-07-01
**Status:** Approved design, pending spec review

## Goal

Two things, built together because the second depends on the first:

1. **Per-shelf World Bibles.** Lore belongs to a world (shelf), not a story (project). All stories on a shelf share one bible. Each shelf's book opens its own bible with its own category layout.
2. **The book becomes a three-action selector.** Hovering opens the 3D hardcover book (existing). Scrolling while hovered rolls the page verb — **Open → Edit → Organize** — with a scroll-hero-style word-roll animation. Clicking fires the visible action.

## Current State (what this changes)

- `Project.worldBibleLayout` holds the category layout — per **project**. (`workspaceStore.ts:84`)
- `Entity.projectId` scopes lore to a **project**. (`workspaceStore.ts:220`)
- `World` objects (shelves) exist with `Project.worldId?` links. (`workspaceStore.ts:39`, `:77`)
- The Bookshelf's standalone section uses pseudo-key `'standalone'` (no World record).
- `WorldBibleBook` takes a single `onOpen` → `setWorkspaceMode('worldBible')`. (`Bookshelf.tsx:357`)
- ~20 components filter entities by `e.projectId === activeProjectId`.
- Zustand persist: `version: 2` with `migrate()`. Cloud hydration (`useSupabaseSync.ts:82`) calls `setState(cloud.data)` directly and **bypasses** zustand's migrate.

---

## Part 0 — Data Model: Per-Shelf Bibles

### New types

```ts
/** Everything a single shelf's World Bible owns. */
export interface WorldBibleConfig {
  layout: WorldBibleLayout;      // category roots (existing shape)
  coverTitle?: string;           // defaults to world name / "Standalones"
  coverSub?: string;             // defaults to "World Bible"
  tint?: string;                 // cover accent color (hex)
}

/** Key type: a World id, or 'standalone' for the uncategorized shelf. */
export type WorldKey = string;  // world.id | 'standalone'
```

### Store changes

| Field / Action | Change |
|---|---|
| `worldBibles: Record<WorldKey, WorldBibleConfig>` | **New.** Single home for each bible's layout + identity. |
| `activeWorldKey: WorldKey \| null` | **New.** Which bible is open. Set by the book actions. When entering `worldBible`/`hierarchy` mode without it (e.g. ModeBar nav), derive: `activeProject.worldId ?? 'standalone'`. |
| `setActiveWorldKey(key)` | **New action.** |
| `Entity.worldId?: string` | **New field.** `undefined` = standalone shelf. `Entity.projectId` stays as provenance ("created while writing X") but no longer scopes visibility. |
| `addWorldBibleRoot` / `updateWorldBibleRoot` / `deleteWorldBibleRoot` / `moveWorldBibleType` | Re-point from `projects[].worldBibleLayout` to `worldBibles[activeWorldKey].layout`. Draft flow (`draftHierarchyLayout`) unchanged. |
| `applyHierarchyTemplate(projectId, templateId)` | Signature becomes `(worldKey, templateId)`. |
| `commitDraftHierarchy` (writes draft → layout) | Writes to `worldBibles[activeWorldKey]`. |
| `deleteProject` | **Stops cascade-deleting entities** (`workspaceStore.ts:1165`). Lore belongs to the world; deleting a story keeps its lore. |
| `deleteWorld` | Entities of that world move to standalone (`worldId → undefined`); `worldBibles[worldId]` entry removed. Matches existing "Stories will move to Uncategorized" behavior. |

### Shared helpers (new, in `src/lib/worldBibleNav.ts`)

```ts
/** The shelf key a project belongs to. */
export function worldKeyForProject(project?: Project | null): WorldKey {
  return project?.worldId ?? 'standalone';
}

/** The shelf key an entity belongs to. */
export function worldKeyForEntity(entity: Entity): WorldKey {
  return entity.worldId ?? 'standalone';
}

/** Effective config for a bible — falls back to the default layout. */
export function getWorldBibleConfig(
  worldBibles: Record<WorldKey, WorldBibleConfig>,
  key: WorldKey,
): WorldBibleConfig {
  const cfg = worldBibles[key];
  if (cfg?.layout?.roots?.length) return cfg;
  return { ...cfg, layout: DEFAULT_WORLD_BIBLE_LAYOUT };
}
```

`getProjectLayout(project)` is **removed**; its callers switch to `getWorldBibleConfig`.

### Component sweep

Every consumer that filters entities by project switches to world scope via the helpers. Two flavors:

- **World Bible views** (`WorldBibleCenter`, `WorldBibleNav`, `WorldBibleHome`, `WorldBibleRoot`, `WorldBibleSubcategory`, `HierarchyCanvas`, `ArticleReadView` mentions): scope = `activeWorldKey`.
- **Project-context surfaces** (desk widgets `FamilyTree`/`CharacterArc`/`Pronunciation`/`Timeline`/`OrgChart`/`Relationship`, `EntitySuggestDropdown`, `ExportModal`, `VersionHistoryPanel`, `ModeBar` search, `Designer`): scope = `worldKeyForProject(activeProject)` — a story sees its whole world's lore.

Filter idiom everywhere: `entities.filter(e => worldKeyForEntity(e) === key)`.

### Entity creation

All creation paths set `worldId`:
- `InlineEntryCreator`, `Designer`: from `worldKeyForProject(activeProject)` (store `undefined` when standalone).
- `WorldBibleCenter` new-article form: from `activeWorldKey`.
- `betaSeedData`: seed entities get the seed world's id.

### Migration (v2 → v3)

One **idempotent, pure** function used by BOTH hydration paths:

```ts
export function migratePerShelfBibles(data: any): any
```

Rules:
1. For each entity lacking `worldId`: look up its project → `project.worldId` (or leave `undefined` for standalone). Unknown/missing project → `undefined`.
2. Build `worldBibles` if absent: for each world, adopt the layout from the first of its projects with non-empty `worldBibleLayout.roots`; same for `'standalone'` from standalone projects. Worlds with no custom layout get no entry (default-layout fallback covers them).
3. Old `project.worldBibleLayout` values are left in place but never read again (rollback safety; no data stripped).
4. Idempotency guard: if `data.worldBibles` already exists, only backfill entities that still lack `worldId`.

Wire-up:
- Zustand persist: bump `version: 3`; `migrate()` calls `migratePerShelfBibles`.
- Cloud path: `useSupabaseSync.hydrate()` runs `migratePerShelfBibles(cloud.data)` before `setState` (cloud blobs bypass zustand migrate).

### Edge cases

- Orphan `worldId` (world deleted while offline): `deleteWorld` normalizes locally; a cloud-restored orphan simply reads/writes `worldBibles[thatId]` harmlessly — its entities are unreachable from shelves, so migration ALSO normalizes: any entity whose `worldId` matches no existing world → `undefined`.
- Moving a project to another shelf does **not** move entities — lore belongs to the world it was written into. (Future feature if ever needed.)
- `activeWorldKey` is transient UI state → excluded from `partialize`? **No — persist it**, so reopening the app returns to the same bible. Include in `partializeWorkspace`.

---

## Part 1 — Book Scroll Selector

### Behavior

- Hover opens the book (existing CSS, unchanged).
- The revealed page shows the verb + fixed line: **"Open"** / "the lore" → wheel-down rolls to **"Edit"**, then **"Organize"**, wrapping. Wheel-up goes back.
- Word-roll animation (ported from the 21st.dev scroll-hero effect, adapted from scroll-position-driven to discrete steps): current verb slides up + fades out, next slides in from below, ~300ms, inside an `overflow: hidden` window.
- Wheel handling: `preventDefault` while the pointer is over the book (page must not scroll underneath); one step per event with a **200ms cooldown** (tames trackpad delta storms).
- Click / Enter / Space fires the visible verb's action.
- Keyboard: ArrowUp/ArrowDown cycle verbs (book must be focusable — already `tabIndex={0}`).
- A11y: verb container is `aria-live="polite"`; `aria-label` updates ("Open the World Bible", "Edit the World Bible", "Organize the World Bible").
- `prefers-reduced-motion`: instant verb swap (CSS block already exists in `WorldBibleBook.module.css:348`).

### API change

```ts
interface WorldBibleBookProps {
  title: string;                       // cover title (now from WorldBibleConfig)
  subtitle?: string;                   // cover sub (default "World Bible")
  tint?: string;                       // cover accent
  onAction: (action: 'open' | 'edit' | 'organize') => void;
}
```

The verb-cycling logic lives in a pure helper for testability:

```ts
export function nextVerb(current: number, direction: 1 | -1, count: number): number {
  return (current + direction + count) % count;
}
```

### Bookshelf wiring

Each shelf's book closes over its `worldKey` (`world.id` or `'standalone'`):

```ts
onAction={(a) => {
  setActiveWorldKey(worldKey);
  if (a === 'open') setWorkspaceMode('worldBible');
  if (a === 'edit') setWorkspaceMode('worldBibleEdit');
  if (a === 'organize') setWorkspaceMode('hierarchy');
}}
```

`WorkspaceMode` union gains `'worldBibleEdit'` (`workspaceStore.ts:400`); `page.tsx` mode switch renders the new Edit page for it.

---

## Part 2 — "Edit" Page (`worldBibleEdit` mode)

New component: `src/components/world/WorldBibleEdit.tsx` (+ module CSS). Operates on `worldBibles[activeWorldKey]`. Back button → `setWorkspaceMode('bookshelf')`.

### Section 1: Book identity

- **Cover title** — text input, default = world name (or "Standalones"). Stored as `coverTitle`.
- **Subtitle** — text input, default "World Bible". Stored as `coverSub`.
- **Cover tint** — color input applied as the cover accent. Stored as `tint`.
- `WorldBibleBook` cover reads these (falls back to current greyscale styling when unset).
- Live preview: a small rendering of the book cover updates as you type.

### Section 2: Layout presets

Four built-in presets (constants in a new `src/lib/worldBiblePresets.ts`). Applying replaces `layout.roots` only — **articles are never deleted**; entity types are only re-grouped. Every preset covers all 8 entity types so nothing becomes unreachable.

| Preset | Categories (entityTypes) |
|---|---|
| **Standard** | People (character, faction, species) · Places (location) · Things (artifact, lore) · World Systems (magic, religion) |
| **Fantasy** | Characters (character) · Realms (location) · Peoples & Races (species, faction) · Magic & Faith (magic, religion) · Relics & Legends (artifact, lore) |
| **Sci-fi** | Characters (character) · Worlds & Stations (location) · Factions (faction) · Species (species) · Tech & Artifacts (artifact, magic) · Archives & Beliefs (lore, religion) |
| **TTRPG** | Party & NPCs (character) · Locations (location) · Factions & Guilds (faction) · Bestiary (species) · Items & Loot (artifact) · Magic & Deities (magic, religion) · Lore & Quests (lore) |

Each preset card shows its category chips. Clicking one applies immediately if the current layout is untouched-default; otherwise a two-click confirm ("Replace current layout?") — same confirm pattern as shelf delete.

Preset roots get fresh UUIDs on apply (never share ids across bibles).

### Section 3: Danger zone

- **Reset layout to Standard** — two-click confirm; sets `layout` to the Standard preset.
- **Clear all articles** — deletes every entity with this `worldKey`; two-click confirm showing the count ("Delete 12 articles? This can't be undone.").

---

## Part 3 — "Organize" (HierarchyCanvas + article drag)

- `HierarchyCanvas` re-points from `project.worldBibleLayout` to `worldBibles[activeWorldKey]` (draft flow preserved).
- **New: article tray** — a right-side panel listing the bible's entities (icon + name, text filter box). Follows the canvas's existing mouse-based drag pattern (same as the type-chip palette drag).
- Drag an article card onto a **type chip** inside a category node → `updateEntity(id, { type: chipType })`. Dropping on the chip (not the node) keeps multi-type categories unambiguous.
- Chip highlights on hover-with-payload; tray card shows grab cursor.
- Articles are always visible in the tray (organizing = re-typing them; they never leave the world).

---

## Testing

**Vitest (unit):**
- `migratePerShelfBibles`: backfills `worldId` from project links; adopts first non-empty layout per world; standalone handling; orphan normalization; idempotent on double-run; leaves already-migrated data alone.
- `nextVerb`: wraps both directions.
- `worldKeyForProject` / `worldKeyForEntity` / `getWorldBibleConfig` fallback.
- Preset invariant: every preset covers all 8 `EntityType`s exactly once (no type in two categories, none missing).

**Preview (manual/scripted):**
- Wheel-cycle verbs on a hovered book; click each verb → correct mode + correct `activeWorldKey`.
- Two shelves with different layouts/articles stay isolated.
- Story A creates a character → visible while writing story B on the same shelf.
- Edit page identity changes reflect on the 3D cover; preset apply re-groups strips; danger-zone confirms.
- Organize: drag article onto a type chip → article moves category in the World Bible strips.

## Out of Scope

- Moving entities between worlds via UI (future).
- Per-shelf theming beyond the book cover tint.
- Nested categories beyond the existing `parentId` support.
- Supabase schema changes — the workspace stays one JSONB blob.
