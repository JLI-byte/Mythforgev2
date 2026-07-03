# World Bible Folders (Phase 3) — Design Spec

**Date:** 2026-07-02
**Status:** Approved design, pending spec review

## Goal

Replace type-derived category membership with a **true folder hierarchy**: articles live in whatever folder the user puts them in, folders nest to any depth, and the Organize view becomes a standard file-explorer tree (add / rename / drag / delete). This is how a user *builds* their World Bible's structure.

## Decisions (locked with user)

1. **True folders** — `Entity.categoryId` gives direct membership. Type (character/location/…) becomes a badge + behavior driver (e.g. character profile view), not a location.
2. **Nested tree** — subfolders to any depth (`WorldBibleRootConfig.parentId` already exists).
3. **The floating-node canvas is replaced** — `HierarchyCanvas` is deleted; a folder tree becomes THE Organize view. The Designer's draft-template flow moves onto the tree too.

## Current State (what this changes)

- Categories (`WorldBibleRootConfig` in `worldBibles[key].layout.roots`) hold `entityTypes`; an article appears in a category because its `type` is in that list.
- Drag-onto-chip in the canvas *changes an article's type* to move it (Phase 2). That coupling ends.
- `WorldBibleRootConfig` fields `x/y/width/height` are canvas-only → become vestigial (kept on the type for backward data compat, no longer read).
- Persist schema is at **version 3** (per-shelf bibles); cloud hydration runs migrations version-blind via a pure function.

---

## Part 1 — Data Model

### Entity

```ts
/** Sprint 71: the folder this article lives in (a WorldBibleRootConfig id
 *  within its world's bible). undefined = Unfiled. */
categoryId?: string;
```

Moving an article = `updateEntity(id, { categoryId })`. Type is untouched by moves.

### Folder semantics

- Folders are the existing roots; `parentId` builds the tree. Top-level = no `parentId`.
- `entityTypes` on a folder is repurposed as **"default article types for this folder"**: used by the strip's new-article type picker and by preset re-filing. It no longer controls membership.
- **Cycle guard:** re-parenting a folder into itself or any of its descendants is rejected (store action validates before writing).

### Store actions

| Action | Change |
|---|---|
| `updateEntity(id, { categoryId })` | Moves an article (existing action, no change needed). |
| `addWorldBibleRoot` / `updateWorldBibleRoot` (rename, re-parent) | Exist. Re-parent gains the cycle guard. |
| `deleteWorldBibleRoot(id)` | **New semantics:** children re-parent to the deleted folder's parent; articles in the folder get `categoryId` = parent's id (or `undefined` → Unfiled when top-level). Nothing is cascade-deleted. |
| `applyBibleLayout(key, layout)` | **New.** Sets `worldBibles[key].layout` AND re-files that world's articles: each entity's `categoryId` = the first new root whose `entityTypes` contains `entity.type` (no match → Unfiled). Presets/reset switch from `setWorldBibleLayout` to this. `setWorldBibleLayout` remains as the low-level primitive. |
| `deleteWorld(id)` | **Additional:** entities moving to standalone get `categoryId` stripped (their folders die with the world). |
| `deleteWorldEntities(key)` | Unchanged. |

### Article creation filing

- **Strip "＋ New article"** (WorldBibleCenter): `categoryId` = the expanded folder's id.
- **InlineEntryCreator / ImportModal**: file by the target world's type→folder mapping (same rule as migration); no match → Unfiled.
- **Designer phantom entity**: stays Unfiled (never rendered in bible views).

### Migration (v3 → v4)

New pure, idempotent `migrateArticleFolders(data)` in its own module, composed with the v3 migration behind one exported `migrateWorkspaceSchema(data)` wrapper. Both hydration paths (zustand persist `migrate` — version bumped to 4 — and the cloud-hydrate call) switch to the wrapper.

Rules:
1. For each world key with ≥1 entity and no stored non-empty layout: **materialize** `DEFAULT_WORLD_BIBLE_LAYOUT` (deep copy, its stable ids are fine per-bible) into `worldBibles[key]` so folders are first-class.
2. Each entity lacking `categoryId`: `categoryId` = first root in its world's layout whose `entityTypes` includes `entity.type`; no match → left Unfiled (no key written).
3. Entities that already have `categoryId` are untouched (idempotency); malformed entries pass through unchanged (same hardening as v3).
4. Nothing is deleted; `x/y/width/height` left in place.

---

## Part 2 — The Folder Tree (new Organize view)

New component `src/components/world/WorldBibleFolderTree.tsx` (+ module CSS), rendered by the existing `'hierarchy'` workspace mode (mode id unchanged — persisted modes keep working). `HierarchyCanvas.tsx` + its CSS are **deleted**.

### Layout & interactions

- Classic tree: folder rows (chevron, icon, name, article count incl. descendants) with articles as leaf rows (type badge + name) under their folder.
- **Expand/collapse** per folder (local UI state; default: top-level expanded).
- **＋ New folder** button in the header (creates top-level) and a per-row "＋" (creates a subfolder inside that row).
- **Rename inline**: clicking the name turns it into an input (the canvas already did this — same store call).
- **Drag & drop** (native HTML5, same pattern/keys as Phase 2):
  - Articles: `dataTransfer 'entityId'` → drop on any folder row → `updateEntity(id, { categoryId })`.
  - Folders: `dataTransfer 'folderId'` → drop on another folder row (re-parent) or the tree root zone (make top-level) → `updateWorldBibleRoot(id, { parentId })`, cycle-guarded.
  - Drop-target highlight; `dragend` clears highlights (Phase 2 lesson).
- **Delete** per row with the two-click confirm + auto-disarm pattern from the Edit page.
- **Unfiled** section at the bottom whenever unfiled articles exist — drag out of it to file them.
- Clicking an article row selects/highlights it; if wiring is cheap (store already has a focused-entity field), it also jumps to the bible browser opened on that article — otherwise v1 ships selection-only and deep-open lands later.

### Draft mode (Designer templates)

The tree takes the same `isDraft` prop the canvas had: folders only (no articles, no Unfiled), operating on `draftHierarchyLayout` via the existing draft branches of the root actions. The Designer's hierarchy-template screen renders the tree instead of the canvas.

---

## Part 3 — Browse views follow folders

- **WorldBibleCenter strips**: strips = top-level folders. Count = articles with `categoryId` in the folder-or-descendants set. Expanded strip shows: direct articles, then one titled section per child folder (its articles + a "and N more in subfolders…" affordance is NOT needed v1 — one level of subfolder sections, deeper articles roll up into their nearest shown section's count). An **Unfiled** strip appears only when unfiled articles exist.
- **WorldBibleNav / WorldBibleHome / WorldBibleRoot / WorldBibleSubcategory** (sidebar drill-down): buckets switch from `type ∈ root.entityTypes` to `categoryId` membership; the type-based subcategory drill level is replaced by child-folder drill. Exact per-file treatment is enumerated at plan time (some of these may collapse into simpler folder listings).
- **Character profiles etc. keyed off `entity.type` are untouched** — type still exists.

## Part 4 — Presets & danger zone

- Preset cards and Reset call `applyBibleLayout` — structure swaps AND every article re-files by its type into the new folders. The all-8-types preset invariant (Phase 2 test) is what guarantees no article is orphaned by a preset.
- Custom folders built by hand are replaced on preset apply (existing two-click confirm covers this).

## Error handling & edge cases

- Folder drop cycle attempt → no-op (guard in store action), tree shows no change.
- Deleting the last top-level folder: allowed; its articles go Unfiled (delete button hidden when it's the only folder? No — allow; Unfiled catches them).
- `categoryId` pointing at a folder that no longer exists (e.g. edited cloud data): treated as Unfiled everywhere (membership checks are id-set based); migration does not need to normalize it.
- Preset/reset on a world with Unfiled articles: re-filing by type also files previously-Unfiled articles (their type maps somewhere — presets cover all 8).

## Testing

**Vitest:**
- `migrateArticleFolders`: materializes default layout only when needed; files by type; leaves existing `categoryId`; idempotent; malformed-entry passthrough; `migrateWorkspaceSchema` composes v3+v4.
- Store: `deleteWorldBibleRoot` re-parents children + re-files articles to parent/Unfiled; `applyBibleLayout` re-files by type incl. previously-Unfiled; cycle guard rejects self/descendant re-parent; `deleteWorld` strips `categoryId`.
- Tree helpers (pure): descendant-id set builder, cycle detection.

**Preview (manual/scripted):** create/rename/nest folders; drag article between folders and out of Unfiled; delete a folder with children + articles; preset apply re-files; strips mirror the tree; draft mode shows folders only.

## Out of Scope

- Multi-select / bulk drag, folder color/icon picker UI (icon stays editable via rename row later), search within the tree.
- Cross-world article moves.
- Removing the vestigial `x/y/width/height` fields from stored data.
