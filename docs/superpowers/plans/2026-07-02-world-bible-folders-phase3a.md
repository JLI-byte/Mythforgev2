# World Bible Folders — Phase 3A (Data Model + Migration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give articles true folder membership (`Entity.categoryId`) with a v3→v4 migration, folder-aware store actions (delete-reparents, cycle guard, preset re-filing), and creation paths that file new articles — all while the app's UI stays **byte-for-byte identical** (views keep bucketing by type until Phase 3B).

**Architecture:** A leaf `folderTree.ts` module holds the pure tree helpers (descendants, cycle check, type-filing). A pure idempotent `migrateArticleFolders` composes with the existing v3 migration behind one `migrateWorkspaceSchema` wrapper used by BOTH hydration paths. Store actions gain folder semantics; `applyBibleLayout` re-files articles on preset/reset.

**Tech Stack:** Next.js 16 (Turbopack), React 19, TypeScript, Zustand (persist v4), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-02-world-bible-folders-design.md`

**Verification baseline:** `npx vitest run` → 70 tests pass; `npx tsc --noEmit` clean; `npm run build` succeeds. If not, stop and report.

**THE safety property of 3A:** no view reads `categoryId` yet. After every task the app renders and behaves exactly as before — only the data underneath gains folder membership. Any visible UI change in 3A is a bug.

---

### Task 1: `Entity.categoryId` + folder-tree helpers (TDD)

**Files:**
- Create: `src/lib/folderTree.ts`
- Create: `src/lib/folderTree.test.ts`
- Modify: `src/store/workspaceStore.ts` (Entity interface only)

`folderTree.ts` is a LEAF module — it must not import store values (a minimal structural root type keeps it dependency-free, same pattern as `worldKey.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/folderTree.test.ts
import { describe, it, expect } from 'vitest';
import { getDescendantIds, wouldCreateCycle, fileByType } from './folderTree';

const roots = [
    { id: 'a', parentId: undefined, entityTypes: ['character'] },
    { id: 'a1', parentId: 'a', entityTypes: [] },
    { id: 'a1x', parentId: 'a1', entityTypes: [] },
    { id: 'b', parentId: undefined, entityTypes: ['location', 'faction'] },
];

describe('folderTree helpers', () => {
    it('getDescendantIds returns all nested ids, excluding the folder itself', () => {
        expect([...getDescendantIds(roots, 'a')].sort()).toEqual(['a1', 'a1x']);
        expect([...getDescendantIds(roots, 'b')]).toEqual([]);
    });

    it('wouldCreateCycle rejects self and descendants, allows valid moves', () => {
        expect(wouldCreateCycle(roots, 'a', 'a')).toBe(true);    // into itself
        expect(wouldCreateCycle(roots, 'a', 'a1x')).toBe(true);  // into own grandchild
        expect(wouldCreateCycle(roots, 'a1', 'b')).toBe(false);  // sideways is fine
        expect(wouldCreateCycle(roots, 'a', undefined)).toBe(false); // to top level
    });

    it('fileByType returns the first folder holding the type, else undefined', () => {
        expect(fileByType(roots, 'character')).toBe('a');
        expect(fileByType(roots, 'faction')).toBe('b');
        expect(fileByType(roots, 'magic')).toBeUndefined();
    });

    it('helpers tolerate malformed root entries', () => {
        const messy = [null, { id: 'x' }, ...roots] as never[];
        expect(fileByType(messy, 'character')).toBe('a');
        expect([...getDescendantIds(messy, 'a')].sort()).toEqual(['a1', 'a1x']);
    });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib/folderTree.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/folderTree.ts
/**
 * Folder-tree helpers — LEAF MODULE, no store value imports.
 * Operates on the structural shape of WorldBibleRootConfig entries so it can
 * run against live layouts, drafts, and raw persisted blobs alike.
 */

export interface FolderLike {
    id: string;
    parentId?: string;
    entityTypes?: string[];
}

/** Every id nested underneath folderId (children, grandchildren, …). */
export function getDescendantIds(roots: ReadonlyArray<FolderLike | null | undefined>, folderId: string): Set<string> {
    const valid = roots.filter((r): r is FolderLike => !!r && typeof r === 'object' && typeof r.id === 'string');
    const out = new Set<string>();
    let frontier = [folderId];
    while (frontier.length) {
        const next: string[] = [];
        for (const r of valid) {
            if (r.parentId !== undefined && frontier.includes(r.parentId) && !out.has(r.id)) {
                out.add(r.id);
                next.push(r.id);
            }
        }
        frontier = next;
    }
    return out;
}

/** True when re-parenting folderId under newParentId would make a loop. */
export function wouldCreateCycle(
    roots: ReadonlyArray<FolderLike | null | undefined>,
    folderId: string,
    newParentId: string | undefined,
): boolean {
    if (newParentId === undefined) return false;      // becoming top-level is always safe
    if (newParentId === folderId) return true;        // into itself
    return getDescendantIds(roots, folderId).has(newParentId);
}

/** First folder whose entityTypes contains the type — the default filing rule. */
export function fileByType(
    roots: ReadonlyArray<FolderLike | null | undefined>,
    type: string,
): string | undefined {
    for (const r of roots) {
        if (r && typeof r === 'object' && Array.isArray(r.entityTypes) && r.entityTypes.includes(type)) {
            return r.id;
        }
    }
    return undefined;
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lib/folderTree.test.ts` → PASS (4).

- [ ] **Step 5: Add the Entity field.** In `src/store/workspaceStore.ts`, in the `Entity` interface directly after the `worldId?: string;` line (Sprint 69 comment):

```ts
    /** Sprint 71: the folder (WorldBibleRootConfig id in this world's bible)
     *  this article lives in. undefined = Unfiled. Dormant until Phase 3B UI. */
    categoryId?: string;
```

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit && npx vitest run` — 74 tests (70 + 4).

```bash
git add src/lib/folderTree.ts src/lib/folderTree.test.ts src/store/workspaceStore.ts
git commit -m "feat: Entity.categoryId + folder-tree leaf helpers"
```

---

### Task 2: Migration v4 + schema wrapper (TDD)

**Files:**
- Create: `src/store/migrateArticleFolders.ts`
- Create: `src/store/migrateArticleFolders.test.ts`
- Create: `src/store/migrateWorkspaceSchema.ts` (tiny wrapper; tested inside the same test file)

- [ ] **Step 1: Write the failing tests**

```ts
// src/store/migrateArticleFolders.test.ts
import { describe, it, expect } from 'vitest';
import { migrateArticleFolders } from './migrateArticleFolders';
import { migrateWorkspaceSchema } from './migrateWorkspaceSchema';

const customLayout = {
    roots: [
        { id: 'crew', label: 'Crew', icon: '🚀', entityTypes: ['character', 'faction', 'species'] },
        { id: 'places', label: 'Places', icon: '🪐', entityTypes: ['location'] },
    ],
};

function baseData() {
    return {
        worlds: [{ id: 'w1', name: 'Aether' }],
        projects: [{ id: 'p1', name: 'S1', worldId: 'w1' }],
        worldBibles: { w1: { layout: JSON.parse(JSON.stringify(customLayout)) } },
        entities: [
            { id: 'e1', projectId: 'p1', worldId: 'w1', name: 'Mira', type: 'character' },
            { id: 'e2', projectId: 'p1', worldId: 'w1', name: 'Dock', type: 'location' },
            { id: 'e3', projectId: 'p1', worldId: 'w1', name: 'Rune', type: 'magic' }, // no folder holds magic
            { id: 'e4', projectId: 'p1', name: 'Loose', type: 'lore' },                 // standalone world
        ],
    };
}

describe('migrateArticleFolders', () => {
    it('files entities into the first folder holding their type', () => {
        const out = migrateArticleFolders(baseData());
        expect(out.entities[0].categoryId).toBe('crew');
        expect(out.entities[1].categoryId).toBe('places');
    });

    it('leaves entities unfiled when no folder holds their type', () => {
        const out = migrateArticleFolders(baseData());
        expect(Object.prototype.hasOwnProperty.call(out.entities[2], 'categoryId')).toBe(false);
    });

    it('materializes the default layout for worlds with entities but no stored layout', () => {
        const out = migrateArticleFolders(baseData());
        // e4 is standalone; standalone has no stored bible → default materialized
        expect(out.worldBibles.standalone.layout.roots.map((r: { label: string }) => r.label))
            .toContain('Things');
        expect(out.entities[3].categoryId).toBe('things'); // lore files into Things
    });

    it('does not materialize layouts for worlds with zero entities', () => {
        const data = baseData();
        data.entities = data.entities.filter(e => e.worldId === 'w1');
        const out = migrateArticleFolders(data);
        expect(out.worldBibles.standalone).toBeUndefined();
    });

    it('never touches entities that already have a categoryId', () => {
        const data = baseData();
        (data.entities[0] as { categoryId?: string }).categoryId = 'places'; // user filed Mira manually
        const out = migrateArticleFolders(data);
        expect(out.entities[0].categoryId).toBe('places');
    });

    it('is idempotent', () => {
        const once = migrateArticleFolders(baseData());
        const twice = migrateArticleFolders(once);
        expect(twice).toEqual(once);
    });

    it('passes malformed entries and non-object input through unchanged', () => {
        expect(migrateArticleFolders(null as never)).toBeNull();
        const data = baseData();
        (data.entities as unknown[]).unshift(null);
        const out = migrateArticleFolders(data);
        expect(out.entities[0]).toBeNull();
        expect(out.entities[1].categoryId).toBe('crew');
    });
});

describe('migrateWorkspaceSchema', () => {
    it('composes v3 then v4 on a raw pre-v3 blob', () => {
        const raw = {
            worlds: [{ id: 'w1', name: 'Aether' }],
            projects: [{ id: 'p1', worldId: 'w1', worldBibleLayout: JSON.parse(JSON.stringify(customLayout)) }],
            entities: [{ id: 'e1', projectId: 'p1', name: 'Mira', type: 'character' }],
        };
        const out = migrateWorkspaceSchema(raw);
        expect(out.entities[0].worldId).toBe('w1');        // v3 ran
        expect(out.entities[0].categoryId).toBe('crew');   // v4 ran on v3's output
    });
});
```

- [ ] **Step 2: Run to verify failure** — modules not found.

- [ ] **Step 3: Implement the migration**

```ts
// src/store/migrateArticleFolders.ts
import { DEFAULT_WORLD_BIBLE_LAYOUT } from '@/lib/worldBibleNav';
import { fileByType } from '@/lib/folderTree';

/**
 * v3 → v4 migration: true folder membership for articles.
 *
 * Pure and idempotent — runs on raw persisted blobs from BOTH hydration
 * paths (via migrateWorkspaceSchema), so it must tolerate anything and
 * never assume it runs once.
 *
 * 1. Worlds that hold entities but have no stored non-empty layout get the
 *    DEFAULT layout materialized (deep copy; its stable ids are per-bible).
 * 2. Entities without categoryId are filed into the first folder of their
 *    world's layout whose entityTypes contains their type. No match → left
 *    Unfiled (no key written). Existing categoryId is never touched.
 */
export function migrateArticleFolders(data: Record<string, any>): Record<string, any> {
    if (!data || typeof data !== 'object') return data;

    const entities: any[] = Array.isArray(data.entities) ? data.entities : [];
    const worldBibles: Record<string, any> =
        data.worldBibles && typeof data.worldBibles === 'object' ? { ...data.worldBibles } : {};

    // Which world keys actually hold entities?
    const keysWithEntities = new Set<string>();
    for (const e of entities) {
        if (e && typeof e === 'object') keysWithEntities.add(e.worldId ?? 'standalone');
    }

    // 1 — materialize the default layout where entities exist but no layout does
    for (const key of keysWithEntities) {
        const roots = worldBibles[key]?.layout?.roots;
        if (!Array.isArray(roots) || roots.length === 0) {
            worldBibles[key] = {
                ...worldBibles[key],
                layout: JSON.parse(JSON.stringify(DEFAULT_WORLD_BIBLE_LAYOUT)),
            };
        }
    }

    // 2 — file unfiled entities by type (already-filed entities returned by reference,
    //     which keeps re-runs deep-equal → idempotent)
    const nextEntities = entities.map(e => {
        if (!e || typeof e !== 'object') return e;
        if (Object.prototype.hasOwnProperty.call(e, 'categoryId')) return e;
        const key = e.worldId ?? 'standalone';
        const roots = worldBibles[key]?.layout?.roots;
        const target = Array.isArray(roots) ? fileByType(roots, e.type) : undefined;
        if (target === undefined) return e; // stays Unfiled, no key written
        return { ...e, categoryId: target };
    });

    return { ...data, entities: nextEntities, worldBibles };
}
```

```ts
// src/store/migrateWorkspaceSchema.ts
import { migratePerShelfBibles } from './migratePerShelfBibles';
import { migrateArticleFolders } from './migrateArticleFolders';

/**
 * The full, ordered workspace-schema migration chain. Both hydration paths
 * (zustand persist migrate + Supabase cloud hydrate) call THIS — never the
 * individual steps — so a blob at any historical version comes out current.
 * Every step is idempotent, so re-running the chain is always safe.
 */
export function migrateWorkspaceSchema(data: Record<string, any>): Record<string, any> {
    return migrateArticleFolders(migratePerShelfBibles(data));
}
```

(Idempotency note: re-runs return a new top-level object holding the SAME entity references for anything already filed — `toEqual` compares deep equality, which holds. Do NOT weaken the tests to make this pass.)

- [ ] **Step 4: Run tests** — `npx vitest run src/store/migrateArticleFolders.test.ts` → PASS (8). Full suite: 82.

- [ ] **Step 5: Commit**

```bash
git add src/store/migrateArticleFolders.ts src/store/migrateArticleFolders.test.ts src/store/migrateWorkspaceSchema.ts
git commit -m "feat: v4 article-folder migration behind a composed schema wrapper"
```

---

### Task 3: Wire the wrapper into both hydration paths

**Files:**
- Modify: `src/store/workspaceStore.ts` (import ~line 6; persist config ~line 2250)
- Modify: `src/lib/supabase/useSupabaseSync.ts` (import ~line 7; hydrate ~line 86)

- [ ] **Step 1: Store.** Change the import `import { migratePerShelfBibles } from './migratePerShelfBibles';` → `import { migrateWorkspaceSchema } from './migrateWorkspaceSchema';`. In the persist config: `version: 3,` → `version: 4,`; add a doc-comment line `* version: 4 — Article folder membership (entity.categoryId).`; and the migrate return at ~line 2250:

```ts
                // v4: full schema chain (per-shelf bibles + article folders).
                // Idempotent — safe even if the cloud path already migrated it.
                return migrateWorkspaceSchema(persistedState ?? {});
```

- [ ] **Step 2: Cloud path.** In `useSupabaseSync.ts`: import swap to `migrateWorkspaceSchema` from `@/store/migrateWorkspaceSchema`, and line ~86 becomes `useWorkspaceStore.setState(migrateWorkspaceSchema(cloud.data));` (keep the surrounding comment, adjusting "migrations" wording if needed).

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npx vitest run && npm run build` (82 tests). Grep check: `grep -rn "migratePerShelfBibles" src/ --include=*.ts | grep -v test | grep -v migrateWorkspaceSchema` → only the definition file remains.

- [ ] **Step 4: Commit**

```bash
git add src/store/workspaceStore.ts src/lib/supabase/useSupabaseSync.ts
git commit -m "feat: run composed schema migration (v4) in both hydration paths"
```

---

### Task 4: Folder-aware store actions (TDD)

**Files:**
- Modify: `src/store/workspaceStore.ts`
- Modify: `src/store/worldBibleActions.test.ts`

- [ ] **Step 1: Failing behavior tests** — append to the existing describe (its `beforeEach` seeds w1 + standalone p2 + entities e1 (Mira, w1) / e2 (Docks, standalone); the `root(id)` helper builds `{ id, label:id, icon, entityTypes: [] }`):

```ts
    it('deleteWorldBibleRoot re-parents children and re-files articles to the parent', () => {
        useWorkspaceStore.setState({
            worldBibles: { w1: { layout: { roots: [
                { ...root('top'), entityTypes: [] },
                { ...root('mid'), parentId: 'top' },
                { ...root('leaf'), parentId: 'mid' },
            ] } } },
            entities: [
                { id: 'e1', projectId: 'p1', worldId: 'w1', categoryId: 'mid', name: 'Mira', type: 'character' } as never,
            ],
            activeWorldKey: 'w1',
        });
        useWorkspaceStore.getState().deleteWorldBibleRoot('mid');
        const s = useWorkspaceStore.getState();
        const roots = s.worldBibles['w1'].layout.roots;
        expect(roots.map(r => r.id)).toEqual(['top', 'leaf']);
        expect(roots.find(r => r.id === 'leaf')?.parentId).toBe('top'); // child re-parented, not deleted
        expect(s.entities[0].categoryId).toBe('top');                    // article moved up
    });

    it('deleteWorldBibleRoot on a top-level folder unfiles its articles', () => {
        useWorkspaceStore.setState({
            worldBibles: { w1: { layout: { roots: [root('solo'), root('other')] } } },
            entities: [
                { id: 'e1', projectId: 'p1', worldId: 'w1', categoryId: 'solo', name: 'Mira', type: 'character' } as never,
            ],
            activeWorldKey: 'w1',
        });
        useWorkspaceStore.getState().deleteWorldBibleRoot('solo');
        expect(useWorkspaceStore.getState().entities[0].categoryId).toBeUndefined();
    });

    it('updateWorldBibleRoot rejects cyclic re-parenting', () => {
        useWorkspaceStore.setState({
            worldBibles: { w1: { layout: { roots: [
                root('top'),
                { ...root('kid'), parentId: 'top' },
            ] } } },
            activeWorldKey: 'w1',
        });
        useWorkspaceStore.getState().updateWorldBibleRoot('top', { parentId: 'kid' });
        expect(useWorkspaceStore.getState().worldBibles['w1'].layout.roots
            .find(r => r.id === 'top')?.parentId).toBeUndefined(); // unchanged
    });

    it('applyBibleLayout re-files every article by type, including unfiled ones', () => {
        useWorkspaceStore.setState({
            worldBibles: { w1: { layout: { roots: [root('old')] } } },
            entities: [
                { id: 'e1', projectId: 'p1', worldId: 'w1', categoryId: 'old', name: 'Mira', type: 'character' } as never,
                { id: 'e2', projectId: 'p1', worldId: 'w1', name: 'Ghost', type: 'lore' } as never, // unfiled
                { id: 'e3', projectId: 'p2', name: 'Docks', type: 'location' } as never,            // other world — untouched
            ],
        });
        useWorkspaceStore.getState().applyBibleLayout('w1', { roots: [
            { ...root('chars'), entityTypes: ['character'] as never },
            { ...root('archive'), entityTypes: ['lore'] as never },
        ] });
        const s = useWorkspaceStore.getState();
        expect(s.entities.find(e => e.id === 'e1')?.categoryId).toBe('chars');
        expect(s.entities.find(e => e.id === 'e2')?.categoryId).toBe('archive');
        expect(s.entities.find(e => e.id === 'e3')?.categoryId).toBeUndefined();
    });

    it('deleteWorld strips categoryId from lore moving to standalone', () => {
        useWorkspaceStore.setState({
            entities: [
                { id: 'e1', projectId: 'p1', worldId: 'w1', categoryId: 'people', name: 'Mira', type: 'character' } as never,
            ],
        });
        useWorkspaceStore.getState().deleteWorld('w1');
        const e = useWorkspaceStore.getState().entities.find(x => x.id === 'e1');
        expect(e?.worldId).toBeUndefined();
        expect(e?.categoryId).toBeUndefined();
    });
```

- [ ] **Step 2: Run to verify failures.**

- [ ] **Step 3: Imports.** Extend the store's folder imports: `import { wouldCreateCycle } from '@/lib/folderTree';` and `import { fileByType } from '@/lib/folderTree';` (one line). `worldKeyForEntity` is already imported.

- [ ] **Step 4: Rewrite `deleteWorldBibleRoot`** (current body at ~line 1752 — the cascade/freed-types logic is REPLACED; both branches):

```ts
            deleteWorldBibleRoot: (id, isDraft) =>
                set((state) => {
                    const layout = isDraft
                        ? state.draftHierarchyLayout
                        : (state.activeWorldKey
                            ? state.worldBibles[state.activeWorldKey]?.layout
                                ?? JSON.parse(JSON.stringify(DEFAULT_WORLD_BIBLE_LAYOUT))
                            : undefined);
                    if (!layout) return state;

                    const removed = layout.roots.find(r => r.id === id);
                    if (!removed) return state;
                    const parentId = removed.parentId;

                    // Children re-parent to the deleted folder's parent — nothing cascades.
                    const remaining = layout.roots
                        .filter(r => r.id !== id)
                        .map(r => (r.parentId === id ? { ...r, parentId } : r));
                    const nextLayout = { ...layout, roots: remaining };

                    if (isDraft) {
                        return { draftHierarchyLayout: nextLayout };
                    }

                    // Articles in the deleted folder move up (top-level → Unfiled).
                    return {
                        ...withActiveBibleLayout(state, () => nextLayout),
                        entities: state.entities.map(e =>
                            e.categoryId === id ? { ...e, categoryId: parentId } : e
                        ),
                    };
                }),
```

- [ ] **Step 5: Cycle guard in `updateWorldBibleRoot`.** At the TOP of its `set((state) => {` body (before the draft branch), insert:

```ts
                    // Folder re-parenting must never create a loop.
                    if (updates.parentId !== undefined) {
                        const layout = isDraft
                            ? state.draftHierarchyLayout
                            : (state.activeWorldKey ? state.worldBibles[state.activeWorldKey]?.layout : undefined);
                        if (layout && wouldCreateCycle(layout.roots, id, updates.parentId)) return state;
                    }
```

(NOTE: `updates.parentId !== undefined` means "this update sets a parent". Making a folder top-level passes `parentId: undefined`, which skips the guard — correct, and matches `wouldCreateCycle`'s own undefined handling.)

- [ ] **Step 6: `applyBibleLayout`.** Interface declaration next to `setWorldBibleLayout`'s:

```ts
    /** Sprint 71: replace a bible's layout AND re-file its articles by type. */
    applyBibleLayout: (key: WorldKey, layout: WorldBibleLayout) => void;
```

Implementation next to `setWorldBibleLayout`'s:

```ts
            applyBibleLayout: (key, layout) =>
                set((state) => ({
                    worldBibles: {
                        ...state.worldBibles,
                        [key]: { ...state.worldBibles[key], layout },
                    },
                    // Re-file this world's articles into the new structure by type
                    // (covers previously-unfiled ones too; presets span all 8 types).
                    entities: state.entities.map(e => {
                        if (worldKeyForEntity(e) !== key) return e;
                        return { ...e, categoryId: fileByType(layout.roots, e.type) };
                    }),
                })),
```

- [ ] **Step 7: `deleteWorld` strips categoryId.** In its existing entities map, change `e.worldId === id ? { ...e, worldId: undefined } : e` → `e.worldId === id ? { ...e, worldId: undefined, categoryId: undefined } : e`.

- [ ] **Step 8: Verify + commit** — `npx vitest run && npx tsc --noEmit` (87 tests: 82 + 5).

```bash
git add src/store/workspaceStore.ts src/store/worldBibleActions.test.ts
git commit -m "feat: folder-aware bible actions (reparenting delete, cycle guard, refile-on-apply)"
```

---

### Task 5: Creation paths file articles; Edit page uses applyBibleLayout

**Files:**
- Modify: `src/components/world/WorldBibleCenter.tsx` (`handleCreate`)
- Modify: `src/components/world/InlineEntryCreator.tsx`
- Modify: `src/components/ui/ImportModal.tsx`
- Modify: `src/components/world/WorldBibleEdit.tsx` (2 callsites)

- [ ] **Step 1: WorldBibleCenter.** In `handleCreate` (the strip creator — `root` is the expanded folder in scope), add to the `addEntity({...})` literal after `worldId`:

```ts
            categoryId: root.id,
```

- [ ] **Step 2: InlineEntryCreator.** It already subscribes `projectWorldKey` (selectProjectWorldKey). Add subscriptions `const worldBibles = useWorkspaceStore((state) => state.worldBibles);` and imports `import { getWorldBibleConfig } from '@/lib/worldBibleNav';` + `import { fileByType } from '@/lib/folderTree';`. In `handleSubmit`, before the `newEntity` literal:

```ts
        const layout = getWorldBibleConfig(worldBibles, projectWorldKey).layout;
```

and in the literal, after `worldId`:

```ts
            categoryId: fileByType(layout.roots, type),
```

- [ ] **Step 3: ImportModal.** Same pattern against the import's TARGET world: `const targetKey = selectedWorldId || 'standalone';` computed where entities are built (`selectedWorldId` is the Target World dropdown state used at the project-creation line), `const layout = getWorldBibleConfig(worldBibles, targetKey).layout;` (subscribe `worldBibles`, import both helpers), and in each imported-entity literal: `categoryId: fileByType(layout.roots, entityType),` using whatever local variable holds that entity's type in the loop (read the file; keep its naming).

- [ ] **Step 4: Edit page.** In `WorldBibleEdit.tsx`, replace BOTH `setWorldBibleLayout(activeWorldKey, ...)` calls (preset apply + danger-zone reset) with `applyBibleLayout(activeWorldKey, ...)`, and swap the subscription `const setWorldBibleLayout = useWorkspaceStore(s => s.setWorldBibleLayout);` → `const applyBibleLayout = useWorkspaceStore(s => s.applyBibleLayout);`.

- [ ] **Step 5: Verify** — `npx tsc --noEmit && npx vitest run && npm run build` (87). Eslint the 4 touched files — no NEW issues vs baseline.

- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "feat: creation paths file articles into folders; presets refile on apply"
```

---

### Task 6: Full verification (no new code)

- [ ] **Step 1: Statics** — `npx tsc --noEmit && npx vitest run && npm run build`; eslint repo compare vs baseline (no new issues).

- [ ] **Step 2: Preview — invisibility check (THE 3A property).** Load the app: bookshelf, World Bible strips, Edit page, Organize canvas must look and behave EXACTLY as before (views don't read categoryId yet). No console errors.

- [ ] **Step 3: Preview — migration data check.** In the browser: `JSON.parse(localStorage.getItem('lorecanvas-workspace'))` → `version === 4`; any pre-existing entities carry a `categoryId` matching the folder whose `entityTypes` holds their type; worlds with entities have materialized layouts.

- [ ] **Step 4: Preview — behavior spot-checks via UI.** Create an article from an expanded strip → its stored entity has `categoryId` = that folder's id. Apply a preset from the Edit page → entities' categoryIds now point at the new preset roots (check via localStorage), and the strips still show the same articles (type-derived display unchanged).

- [ ] **Step 5: Cleanup + report.** Remove any test articles created (UI-driven; verify cloud state too if a sync fired — the Phase 2 gotchas memory applies). Report pass/fail per check. Any failure: STOP before 3B.

---

## Phase 3B preview (separate plan, written after 3A lands)

`WorldBibleFolderTree` component replacing HierarchyCanvas (deleted), draft-mode port for Designer templates, strips + sidebar views switching to `categoryId` membership, Unfiled surfacing. Spec Parts 2–3.
