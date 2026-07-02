# Per-Shelf World Bible — Phase 1 (Data Model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move World Bible ownership from projects to worlds (shelves): shared lore per shelf, per-shelf category layouts, with automatic migration of existing data.

**Architecture:** New `worldBibles: Record<WorldKey, WorldBibleConfig>` map in the Zustand store keyed by world id or `'standalone'`; `Entity.worldId` replaces `Entity.projectId` for visibility scoping (projectId stays as provenance); an idempotent migration runs in BOTH hydration paths (zustand persist migrate + Supabase cloud hydrate). ~20 components switch filter scope via small helpers.

**Tech Stack:** Next.js 16 (Turbopack), React 19, TypeScript, Zustand (persist), Vitest, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-07-01-per-shelf-world-bible-design.md`

**Verification baseline before starting:** `npx vitest run` → 35 tests pass; `npm run build` succeeds. If not, stop and report.

**Two scoping rules that MUST NOT be mixed up:**
- **Bible views** (World Bible browser, hierarchy canvas) scope by `activeWorldKey` — "which bible did the user open".
- **Project-context surfaces** (desk widgets, editor suggestions, export) scope by the ACTIVE PROJECT's world — `worldKeyForProject(activeProject)` — NOT `activeWorldKey` (that may point at whatever bible was browsed last).

---

### Task 1: Leaf helpers module + store types/fields

**Files:**
- Create: `src/lib/worldKey.ts`
- Create: `src/lib/worldKey.test.ts`
- Modify: `src/store/workspaceStore.ts` (types ~line 51-85, Entity ~line 244, state interface ~line 405, actions interface near `setWorkspaceMode` decl ~line 595, initial state ~line 1091, action impl ~line 1605, `partializeWorkspace` ~line 995)

`worldKey.ts` is a LEAF module — it must import nothing from the store (the store will import it; this avoids a runtime cycle).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/worldKey.test.ts
import { describe, it, expect } from 'vitest';
import { STANDALONE_KEY, worldKeyForProject, worldKeyForEntity } from './worldKey';

describe('worldKey helpers', () => {
    it('returns the project worldId when linked to a world', () => {
        expect(worldKeyForProject({ worldId: 'w1' })).toBe('w1');
    });

    it('returns standalone for unlinked, null, and undefined projects', () => {
        expect(worldKeyForProject({})).toBe(STANDALONE_KEY);
        expect(worldKeyForProject(null)).toBe(STANDALONE_KEY);
        expect(worldKeyForProject(undefined)).toBe(STANDALONE_KEY);
    });

    it('returns the entity worldId when set, standalone when not', () => {
        expect(worldKeyForEntity({ worldId: 'w2' })).toBe('w2');
        expect(worldKeyForEntity({})).toBe(STANDALONE_KEY);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/worldKey.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/worldKey.ts
/**
 * World-key helpers — LEAF MODULE, no store imports (the store imports this).
 * A WorldKey identifies a shelf's World Bible: a World id, or 'standalone'
 * for the uncategorized shelf.
 */
export type WorldKey = string;

export const STANDALONE_KEY: WorldKey = 'standalone';

/** The shelf key a project belongs to. */
export function worldKeyForProject(p?: { worldId?: string } | null): WorldKey {
    return p?.worldId ?? STANDALONE_KEY;
}

/** The shelf key an entity belongs to. */
export function worldKeyForEntity(e: { worldId?: string }): WorldKey {
    return e.worldId ?? STANDALONE_KEY;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/worldKey.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add store types and fields**

In `src/store/workspaceStore.ts`:

5a. Import at top of file:
```ts
import { WorldKey, worldKeyForProject } from '@/lib/worldKey';
```

5b. After the `WorldBibleLayout` interface (~line 69), add:
```ts
/** Everything a single shelf's World Bible owns. Keyed by WorldKey in the store. */
export interface WorldBibleConfig {
  layout: WorldBibleLayout;
  /** Cover title — defaults to the world name / "Standalones" when unset. */
  coverTitle?: string;
  /** Cover subtitle — defaults to "World Bible" when unset. */
  coverSub?: string;
  /** Cover accent color (hex). */
  tint?: string;
}
```

5c. In the `Entity` interface (after `profile?` ~line 244), add:
```ts
    /** Sprint 69: the world (shelf) this entity belongs to. undefined = standalone shelf. */
    worldId?: string;
```

5d. In the state interface next to `worlds: World[]` (~line 405), add:
```ts
    /** Sprint 69: per-shelf World Bible configs, keyed by world id or 'standalone'. */
    worldBibles: Record<WorldKey, WorldBibleConfig>;
    /** Sprint 69: which shelf's bible is currently open (null = derive from active project). */
    activeWorldKey: WorldKey | null;
```

5e. In the actions interface next to `setWorkspaceMode` (~line 595), add:
```ts
    setActiveWorldKey: (key: WorldKey | null) => void;
```

5f. In the initial state next to `workspaceMode: 'bookshelf'` (~line 1091), add:
```ts
            worldBibles: {},
            activeWorldKey: null,
```

5g. Next to the `setWorkspaceMode` implementation (~line 1605), add:
```ts
            setActiveWorldKey: (key) => set(() => ({ activeWorldKey: key })),
```

5h. In `partializeWorkspace` (~line 995, after `workspaceMode`), add:
```ts
        worldBibles: state.worldBibles,
        activeWorldKey: state.activeWorldKey,
```

- [ ] **Step 6: Verify compile + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean compile, 38 tests pass (35 + 3 new).

- [ ] **Step 7: Commit**

```bash
git add src/lib/worldKey.ts src/lib/worldKey.test.ts src/store/workspaceStore.ts
git commit -m "feat: WorldKey helpers + per-shelf worldBibles store fields"
```

---

### Task 2: `getWorldBibleConfig` (layout fallback)

**Files:**
- Modify: `src/lib/worldBibleNav.ts` (add function; do NOT remove `getProjectLayout` yet — callers still use it until Task 6)
- Create: `src/lib/worldBibleNav.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/worldBibleNav.test.ts
import { describe, it, expect } from 'vitest';
import { getWorldBibleConfig, DEFAULT_WORLD_BIBLE_LAYOUT } from './worldBibleNav';

describe('getWorldBibleConfig', () => {
    const custom = { layout: { roots: [{ id: 'r1', label: 'Crew', icon: '🚀', entityTypes: ['character' as const] }] } };

    it('returns the stored config when it has a non-empty layout', () => {
        expect(getWorldBibleConfig({ w1: custom }, 'w1')).toBe(custom);
    });

    it('falls back to the default layout for unknown keys', () => {
        const cfg = getWorldBibleConfig({}, 'nope');
        expect(cfg.layout).toEqual(DEFAULT_WORLD_BIBLE_LAYOUT);
    });

    it('keeps identity fields while falling back on an empty layout', () => {
        const cfg = getWorldBibleConfig({ w1: { layout: { roots: [] }, coverTitle: 'Aether' } }, 'w1');
        expect(cfg.coverTitle).toBe('Aether');
        expect(cfg.layout).toEqual(DEFAULT_WORLD_BIBLE_LAYOUT);
    });

    it('handles an undefined map', () => {
        expect(getWorldBibleConfig(undefined, 'w1').layout).toEqual(DEFAULT_WORLD_BIBLE_LAYOUT);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/worldBibleNav.test.ts`
Expected: FAIL — `getWorldBibleConfig` not exported.

- [ ] **Step 3: Implement in `worldBibleNav.ts`**

Add `WorldBibleConfig` to the existing type-only import from the store, then append:

```ts
/**
 * Effective config for a shelf's World Bible — falls back to the default
 * layout when the shelf has no custom layout yet. Identity fields
 * (coverTitle etc.) pass through untouched.
 */
export function getWorldBibleConfig(
  worldBibles: Record<string, WorldBibleConfig> | undefined,
  key: string,
): WorldBibleConfig {
  const cfg = worldBibles?.[key];
  if (cfg?.layout?.roots?.length) return cfg;
  return { ...cfg, layout: DEFAULT_WORLD_BIBLE_LAYOUT };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/worldBibleNav.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/worldBibleNav.ts src/lib/worldBibleNav.test.ts
git commit -m "feat: getWorldBibleConfig with default-layout fallback"
```

---

### Task 3: Migration function (TDD)

**Files:**
- Create: `src/store/migratePerShelfBibles.ts`
- Create: `src/store/migratePerShelfBibles.test.ts`

Pure, idempotent, no store imports (it runs on raw persisted blobs).

- [ ] **Step 1: Write the failing tests**

```ts
// src/store/migratePerShelfBibles.test.ts
import { describe, it, expect } from 'vitest';
import { migratePerShelfBibles } from './migratePerShelfBibles';

const layoutA = { roots: [{ id: 'a', label: 'A', icon: '📦', entityTypes: ['lore'] }] };

function baseData() {
    return {
        worlds: [{ id: 'w1', name: 'Aether' }],
        projects: [
            { id: 'p1', name: 'Story One', worldId: 'w1', worldBibleLayout: layoutA },
            { id: 'p2', name: 'Story Two', worldId: 'w1' },
            { id: 'p3', name: 'Loose Story' }, // standalone
        ],
        entities: [
            { id: 'e1', projectId: 'p1', name: 'Mira', type: 'character' },
            { id: 'e2', projectId: 'p3', name: 'The Docks', type: 'location' },
            { id: 'e3', projectId: 'ghost', name: 'Orphan', type: 'lore' },
        ],
    };
}

describe('migratePerShelfBibles', () => {
    it('backfills entity.worldId from the project link', () => {
        const out = migratePerShelfBibles(baseData());
        expect(out.entities[0].worldId).toBe('w1');
    });

    it('leaves standalone and unknown-project entities without worldId', () => {
        const out = migratePerShelfBibles(baseData());
        expect(out.entities[1].worldId).toBeUndefined();
        expect(out.entities[2].worldId).toBeUndefined();
    });

    it('normalizes entities whose worldId points at a deleted world', () => {
        const data = baseData();
        (data.entities[0] as any).worldId = 'deleted-world';
        const out = migratePerShelfBibles(data);
        expect(out.entities[0].worldId).toBeUndefined();
    });

    it('adopts the first non-empty project layout per world', () => {
        const out = migratePerShelfBibles(baseData());
        expect(out.worldBibles.w1.layout.roots).toEqual(layoutA.roots);
        expect(out.worldBibles.w1.layout.roots).not.toBe(layoutA.roots); // deep copy
    });

    it('adopts a standalone project layout under the standalone key', () => {
        const data = baseData();
        (data.projects[2] as any).worldBibleLayout = layoutA;
        const out = migratePerShelfBibles(data);
        expect(out.worldBibles.standalone.layout.roots).toEqual(layoutA.roots);
    });

    it('creates no entry for worlds with no custom layout', () => {
        const data = baseData();
        delete (data.projects[0] as any).worldBibleLayout;
        const out = migratePerShelfBibles(data);
        expect(out.worldBibles.w1).toBeUndefined();
    });

    it('is idempotent: second run changes nothing', () => {
        const once = migratePerShelfBibles(baseData());
        const twice = migratePerShelfBibles(once);
        expect(twice).toEqual(once);
    });

    it('does not rebuild an existing worldBibles map but still backfills entities', () => {
        const data = { ...baseData(), worldBibles: { w1: { layout: { roots: [] } } } };
        const out = migratePerShelfBibles(data);
        expect(out.worldBibles.w1.layout.roots).toEqual([]); // untouched
        expect(out.entities[0].worldId).toBe('w1');           // still backfilled
    });

    it('passes through non-object input unchanged', () => {
        expect(migratePerShelfBibles(null as any)).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/migratePerShelfBibles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/store/migratePerShelfBibles.ts
/**
 * v2 → v3 migration: per-shelf World Bibles.
 *
 * Pure and idempotent — runs on raw persisted blobs from BOTH hydration
 * paths (zustand persist migrate + Supabase cloud hydrate), so it must
 * never assume it runs only once, and must not import store code.
 *
 * 1. Backfills entity.worldId from the entity's project → world link.
 * 2. Normalizes worldIds that point at deleted worlds back to standalone.
 * 3. Builds the worldBibles map (once) by adopting each world's first
 *    non-empty per-project layout. Old project.worldBibleLayout values are
 *    left in place, unread, as rollback safety.
 */
export function migratePerShelfBibles(data: Record<string, any>): Record<string, any> {
    if (!data || typeof data !== 'object') return data;

    const worlds: any[] = Array.isArray(data.worlds) ? data.worlds : [];
    const projects: any[] = Array.isArray(data.projects) ? data.projects : [];
    const entities: any[] = Array.isArray(data.entities) ? data.entities : [];

    const worldIds = new Set(worlds.map(w => w?.id));
    const projectWorld = new Map(projects.map(p => [p?.id, p?.worldId]));

    // 1 + 2 — backfill and normalize entity.worldId
    const nextEntities = entities.map(e => {
        let worldId: string | undefined = e.worldId ?? projectWorld.get(e.projectId);
        if (worldId !== undefined && !worldIds.has(worldId)) worldId = undefined;
        if (worldId === e.worldId) return e;
        const next = { ...e, worldId };
        if (worldId === undefined) delete next.worldId;
        return next;
    });

    // 3 — build worldBibles once
    let worldBibles = data.worldBibles;
    if (!worldBibles || typeof worldBibles !== 'object') {
        const built: Record<string, any> = {};
        for (const p of projects) {
            const key = p?.worldId && worldIds.has(p.worldId) ? p.worldId : 'standalone';
            if (built[key]) continue;
            const roots = p?.worldBibleLayout?.roots;
            if (Array.isArray(roots) && roots.length > 0) {
                built[key] = { layout: JSON.parse(JSON.stringify({ roots })) };
            }
        }
        worldBibles = built;
    }

    return { ...data, entities: nextEntities, worldBibles };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/migratePerShelfBibles.test.ts`
Expected: PASS (9 tests).

Note on the idempotency test: `toEqual(once)` requires stable output — entities unchanged on re-run return the same objects, and `worldBibles` short-circuits when present. If the test fails on `delete next.worldId` semantics, the `worldId === e.worldId` early return already covers the both-undefined case.

- [ ] **Step 5: Commit**

```bash
git add src/store/migratePerShelfBibles.ts src/store/migratePerShelfBibles.test.ts
git commit -m "feat: idempotent per-shelf bible migration (v2->v3)"
```

---

### Task 4: Wire migration into both hydration paths

**Files:**
- Modify: `src/store/workspaceStore.ts` (~line 2155: `version` + `migrate`)
- Modify: `src/lib/supabase/useSupabaseSync.ts` (~line 82)

- [ ] **Step 1: Bump persist version and call the migration**

In `workspaceStore.ts`, import at top:
```ts
import { migratePerShelfBibles } from './migratePerShelfBibles';
```

Change `version: 2,` → `version: 3,` and update the doc comment to add:
```
             * version: 3 — Per-shelf World Bibles (entity.worldId + worldBibles map).
```

Change the migrate return (line ~2177):
```ts
                // v3: per-shelf World Bibles. Idempotent — safe even if the
                // blob was already migrated by the cloud-hydrate path.
                return migratePerShelfBibles(persistedState ?? {});
```

- [ ] **Step 2: Migrate cloud blobs before setState**

In `useSupabaseSync.ts`, import:
```ts
import { migratePerShelfBibles } from '@/store/migratePerShelfBibles';
```

Change line 82 from:
```ts
          useWorkspaceStore.setState(cloud.data);
```
to:
```ts
          // Cloud blobs bypass zustand's persist migrate — apply schema
          // migrations here. Idempotent, so double-migration is harmless.
          useWorkspaceStore.setState(migratePerShelfBibles(cloud.data));
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/store/workspaceStore.ts src/lib/supabase/useSupabaseSync.ts
git commit -m "feat: run per-shelf bible migration in both hydration paths"
```

---

### Task 5: Re-point store bible actions to `worldBibles[activeWorldKey]`

**Files:**
- Modify: `src/store/workspaceStore.ts` (actions at ~1613–1756, ~1812–1820, `deleteProject` ~1158, `deleteWorld` ~1130, `setWorkspaceMode` ~1605)
- Create: `src/store/worldBibleActions.test.ts`

- [ ] **Step 1: Write failing behavior tests**

```ts
// src/store/worldBibleActions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

const root = (id: string) => ({ id, label: id, icon: '📦', entityTypes: [] as never[] });

describe('per-shelf bible store actions', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            worlds: [{ id: 'w1', name: 'Aether' } as never],
            projects: [
                { id: 'p1', name: 'S1', worldId: 'w1' } as never,
                { id: 'p2', name: 'Loose' } as never,
            ],
            entities: [
                { id: 'e1', projectId: 'p1', worldId: 'w1', name: 'Mira', type: 'character' } as never,
                { id: 'e2', projectId: 'p2', name: 'Docks', type: 'location' } as never,
            ],
            worldBibles: {},
            activeWorldKey: 'w1',
            activeProjectId: 'p1',
        });
    });

    it('addWorldBibleRoot writes to the active world bible, seeded from default', () => {
        useWorkspaceStore.getState().addWorldBibleRoot(root('custom') as never);
        const bible = useWorkspaceStore.getState().worldBibles['w1'];
        const labels = bible.layout.roots.map(r => r.label);
        expect(labels).toContain('custom');
        expect(labels).toContain('People'); // default seeded, not lost
    });

    it('deleteProject keeps the world lore', () => {
        useWorkspaceStore.getState().deleteProject('p1');
        expect(useWorkspaceStore.getState().entities.find(e => e.id === 'e1')).toBeTruthy();
    });

    it('deleteWorld moves lore to standalone and drops the bible entry', () => {
        useWorkspaceStore.setState({ worldBibles: { w1: { layout: { roots: [root('x')] } } } });
        useWorkspaceStore.getState().deleteWorld('w1');
        const s = useWorkspaceStore.getState();
        expect(s.entities.find(e => e.id === 'e1')?.worldId).toBeUndefined();
        expect(s.worldBibles['w1']).toBeUndefined();
    });

    it('setWorkspaceMode derives activeWorldKey from the active project when unset', () => {
        useWorkspaceStore.setState({ activeWorldKey: null, activeProjectId: 'p2' });
        useWorkspaceStore.getState().setWorkspaceMode('worldBible');
        expect(useWorkspaceStore.getState().activeWorldKey).toBe('standalone');
    });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `npx vitest run src/store/worldBibleActions.test.ts`
Expected: FAIL (actions still write to projects; deleteProject still cascades entities).

- [ ] **Step 3: Add a layout-mutation helper**

Define at module scope, ABOVE the `create()` call (after the interface declarations), so all bible actions share it. It seeds first-time custom layouts from the default so adding a category doesn't wipe the standard four (deliberate fix of a latent per-project bug):

```ts
import { DEFAULT_WORLD_BIBLE_LAYOUT } from '@/lib/worldBibleNav';

/**
 * Applies fn to the active shelf's bible layout. First-time customization
 * seeds from the DEFAULT layout (deep copy) so user edits start from
 * People/Places/Things/World Systems instead of an empty layout.
 */
function withActiveBibleLayout(
    state: Pick<WorkspaceState, 'activeWorldKey' | 'worldBibles'>,
    fn: (layout: WorldBibleLayout) => WorldBibleLayout,
): Partial<WorkspaceState> {
    const key = state.activeWorldKey;
    if (!key) return {};
    const existing = state.worldBibles[key]?.layout;
    const current: WorldBibleLayout = existing?.roots?.length
        ? existing
        : JSON.parse(JSON.stringify(DEFAULT_WORLD_BIBLE_LAYOUT));
    return {
        worldBibles: {
            ...state.worldBibles,
            [key]: { ...state.worldBibles[key], layout: fn(current) },
        },
    };
}
```

(`worldBibleNav.ts`'s store imports are type-only and erased at runtime, so this import creates no cycle. Task 6 removes its last store-value coupling anyway.)

- [ ] **Step 4: Rewrite the five actions (draft branches unchanged)**

`addWorldBibleRoot` non-draft branch (replace lines ~1619–1630):
```ts
                    return withActiveBibleLayout(state, (layout) => ({
                        ...layout,
                        roots: [...layout.roots, root],
                    }));
```

`updateWorldBibleRoot` non-draft branch (replace ~1645–1660):
```ts
                    return withActiveBibleLayout(state, (layout) => ({
                        ...layout,
                        roots: layout.roots.map(r => r.id === id ? { ...r, ...updates } : r),
                    }));
```

`deleteWorldBibleRoot` (~1663–1703): change the layout source line to
```ts
                    const layout = isDraft
                        ? state.draftHierarchyLayout
                        : (state.activeWorldKey
                            ? state.worldBibles[state.activeWorldKey]?.layout
                                ?? JSON.parse(JSON.stringify(DEFAULT_WORLD_BIBLE_LAYOUT))
                            : undefined);
```
(The seeded fallback matters: the canvas DISPLAYS the default categories before any customization, so deleting one must work — not silently no-op.)
and the non-draft return to
```ts
                    return withActiveBibleLayout(state, () => nextLayout);
```
(The cascade/reassign logic between stays as-is.)

`moveWorldBibleType` non-draft branch (replace ~1721–1740):
```ts
                    return withActiveBibleLayout(state, (layout) => ({
                        ...layout,
                        roots: layout.roots.map(r => {
                            if (r.id === fromRootId) return { ...r, entityTypes: r.entityTypes.filter(t => t !== type) };
                            if (r.id === toRootId) return { ...r, entityTypes: [...new Set([...r.entityTypes, type])] };
                            return r;
                        }),
                    }));
```

`applyDraftHierarchyToProject` (~1745–1756) — rename to `applyDraftHierarchy` (update the actions interface declaration AND all callers — `grep -rn "applyDraftHierarchyToProject" src/`):
```ts
            applyDraftHierarchy: () =>
                set((state) => {
                    if (!state.draftHierarchyLayout) return state;
                    return withActiveBibleLayout(state, () => state.draftHierarchyLayout!);
                }),
```

`applyHierarchyTemplate` (~1812): change signature `(projectId, templateId)` → `(worldKey: WorldKey, templateId: string)` in interface + impl:
```ts
            applyHierarchyTemplate: (worldKey, templateId) => set(state => {
                const template = state.hierarchyTemplates.find(t => t.id === templateId);
                if (!template) return state;
                return {
                    worldBibles: {
                        ...state.worldBibles,
                        [worldKey]: {
                            ...state.worldBibles[worldKey],
                            layout: JSON.parse(JSON.stringify(template.layout)),
                        },
                    },
                };
            }),
```
Update its callers (`grep -rn "applyHierarchyTemplate" src/`) to pass `activeWorldKey ?? 'standalone'`.

- [ ] **Step 5: Delete-behavior changes**

`deleteProject` (~1158): remove the entities cascade line and the selectedEntityId project check:
```ts
            deleteProject: (id) =>
                set((state) => {
                    logger.info('Project deleted (lore stays with its world):', id);
                    return {
                        projects: state.projects.filter(p => p.id !== id),
                        documents: state.documents.filter(d => d.projectId !== id),
                        scenes: state.scenes.filter(s => s.projectId !== id),
                        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
                        activeDocumentId: state.documents.find(d => d.id === state.activeDocumentId)?.projectId === id ? null : state.activeDocumentId,
                        activeSceneId: state.scenes.find(s => s.id === state.activeSceneId)?.projectId === id ? null : state.activeSceneId,
                    };
                }),
```

`deleteWorld` (~1130): add entity + bible handling:
```ts
            deleteWorld: (id) =>
                set((state) => {
                    logger.info('World deleted (reassigning orphans):', id);
                    const { [id]: _removed, ...remainingBibles } = state.worldBibles;
                    return {
                        worlds: state.worlds.filter(w => w.id !== id),
                        projects: state.projects.map(p =>
                            p.worldId === id ? { ...p, worldId: undefined, updatedAt: new Date() } : p
                        ),
                        // Lore moves to the standalone shelf, mirroring projects
                        entities: state.entities.map(e =>
                            e.worldId === id ? { ...e, worldId: undefined } : e
                        ),
                        worldBibles: remainingBibles,
                        activeWorldKey: state.activeWorldKey === id ? null : state.activeWorldKey,
                    };
                }),
```

- [ ] **Step 6: Derive `activeWorldKey` on mode entry**

Replace `setWorkspaceMode` (~1605):
```ts
            setWorkspaceMode: (mode) => set((state) => {
                let activeWorldKey = state.activeWorldKey;
                if ((mode === 'worldBible' || mode === 'hierarchy') && !activeWorldKey) {
                    activeWorldKey = worldKeyForProject(
                        state.projects.find(p => p.id === state.activeProjectId)
                    );
                }
                return {
                    workspaceMode: mode,
                    activeWorldKey,
                    focusedArticleEntityId: (mode === 'worldBible' || mode === 'hierarchy')
                        ? null
                        : state.focusedArticleEntityId,
                };
            }),
```

- [ ] **Step 7: Run tests + compile**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, including the 4 new behavior tests. TS errors in components that still call old signatures (`applyHierarchyTemplate`, `applyDraftHierarchyToProject`) must be fixed in this task at their callsites (mechanical rename / pass `activeWorldKey`).

- [ ] **Step 8: Commit**

```bash
git add -A src/
git commit -m "feat: bible store actions operate on worldBibles[activeWorldKey]"
```

---

### Task 6: Sweep A — World Bible views scope by `activeWorldKey`

**Files (exact filter lines from repo grep):**
- `src/components/world/WorldBibleCenter.tsx:75` (+ layout source ~line 39, new-article creator, `handleAddCategory`)
- `src/components/world/WorldBibleNav.tsx:44`
- `src/components/world/WorldBibleHome.tsx:55`
- `src/components/world/WorldBibleRoot.tsx:35`
- `src/components/world/WorldBibleSubcategory.tsx:49`
- `src/components/world/HierarchyCanvas.tsx:41`
- `src/components/world/ArticleReadView.tsx` (mentions scan, ~line 40-150)
- `src/components/management/Bookshelf.tsx:357` (book opens ITS bible)
- `src/lib/worldBibleNav.ts` (delete `getProjectLayout` once callers are gone)

Uniform pattern for entity filters:
```ts
// OLD
const projectEntities = entities.filter(e => e.projectId === activeProjectId);
// NEW
import { worldKeyForEntity } from '@/lib/worldKey';
const activeWorldKey = useWorkspaceStore(state => state.activeWorldKey) ?? 'standalone';
const worldEntities = entities.filter(e => worldKeyForEntity(e) === activeWorldKey);
```
Rename the local variable at each site (`projectEntities` → `worldEntities`) and update its usages in the file.

- [ ] **Step 1: WorldBibleCenter**
  - Filter line 75 → world pattern above.
  - Layout: replace `getProjectLayout(activeProject)` with `getWorldBibleConfig(worldBibles, activeWorldKey).layout` (subscribe `worldBibles` from the store).
  - New-article creator: created entity gets `worldId: activeWorldKey === 'standalone' ? undefined : activeWorldKey` (keep `projectId: activeProjectId ?? ''` as provenance; if no active project, empty string is acceptable provenance).
  - `handleAddCategory` works unchanged (store action now targets the active bible).

- [ ] **Step 2: WorldBibleNav / WorldBibleHome / WorldBibleRoot / WorldBibleSubcategory / HierarchyCanvas**
  - Apply the uniform filter pattern at the listed lines.
  - HierarchyCanvas line 41: layout source becomes `getWorldBibleConfig(worldBibles, activeWorldKey).layout` for the non-draft branch (draft branch unchanged).

- [ ] **Step 3: ArticleReadView mentions scan across the whole world**

`findEntityMentions` currently scans only `entity.projectId`'s scenes. Change its signature to accept projects and scan all of the entity's world:
```ts
import { worldKeyForEntity, worldKeyForProject } from '@/lib/worldKey';

// inside the component, replace the projectId arg:
const worldKey = worldKeyForEntity(entity);
const worldProjectIds = new Set(
    projects.filter(p => worldKeyForProject(p) === worldKey).map(p => p.id)
);
// findEntityMentions filters: scenes.filter(s => worldProjectIds.has(s.projectId))
```
(`projects` is already subscribed in this component at line 133.)

- [ ] **Step 4: Bookshelf — each book opens its own bible**

At line ~357, the shelf render context provides the world (or the standalone section). Change:
```ts
// OLD
onOpen={() => setWorkspaceMode('worldBible')}
// NEW  (worldKey = world.id in the world-shelf render path, 'standalone' in the standalone section)
onOpen={() => { setActiveWorldKey(worldKey); setWorkspaceMode('worldBible'); }}
```
Subscribe `setActiveWorldKey` from the store. Locate the shelf-render helper's world parameter to source `worldKey` (`world?.id ?? 'standalone'`).

- [ ] **Step 5: Delete `getProjectLayout`**

Run: `grep -rn "getProjectLayout" src/` — expected: only the definition remains. Delete it from `worldBibleNav.ts`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src/components/world/ src/components/management/Bookshelf.tsx`
Expected: clean (pre-existing `<img>` warnings allowed).

- [ ] **Step 7: Commit**

```bash
git add -A src/
git commit -m "feat: world bible views scope entities and layout by activeWorldKey"
```

---

### Task 7: Sweep B — project-context surfaces scope by the ACTIVE PROJECT's world

**Files (exact lines):**
- `src/components/world/article-grid/widgets/FamilyTreeWidget.tsx:36`
- `src/components/world/article-grid/widgets/CharacterArcWidget.tsx:30`
- `src/components/world/article-grid/widgets/PronunciationWidget.tsx:25`
- `src/components/world/article-grid/widgets/TimelineWidget.tsx:26`
- `src/components/world/article-grid/widgets/OrgChartWidget.tsx:35`
- `src/components/world/article-grid/widgets/RelationshipWidget.tsx:44` (line 51 filters SCENES — leave it)
- `src/components/editor/EntitySuggestDropdown.tsx:57`
- `src/components/ui/ExportModal.tsx:33`
- `src/components/layout/VersionHistoryPanel.tsx:66` (line 61 filters SCENES — leave it)
- `src/components/navigation/ModeBar.tsx:169-178`

**IMPORTANT:** these use the active PROJECT's world — NOT `activeWorldKey`. Add one selector to `workspaceStore.ts` (exported near `partializeWorkspace`):
```ts
/** WorldKey of the ACTIVE PROJECT's shelf — for desk/editor surfaces. */
export const selectProjectWorldKey = (state: WorkspaceState): WorldKey =>
    worldKeyForProject(state.projects.find(p => p.id === state.activeProjectId));
```

Uniform pattern:
```ts
// OLD
const projectEntities = entities.filter(e => e.projectId === activeProjectId);
// NEW
import { worldKeyForEntity } from '@/lib/worldKey';
import { selectProjectWorldKey } from '@/store/workspaceStore';
const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);
const worldEntities = entities.filter(e => worldKeyForEntity(e) === projectWorldKey);
```

- [ ] **Step 1:** Apply to the six widgets (each keeps any extra conditions, e.g. `&& e.type === 'character'`).
- [ ] **Step 2:** Apply to `EntitySuggestDropdown` (the `[[` mention list — a story now suggests its whole world's lore).
- [ ] **Step 3:** Apply to `ExportModal` (exports the world's lore section).
- [ ] **Step 4:** Apply to `VersionHistoryPanel:66` (entity snapshots list).
- [ ] **Step 5:** ModeBar search subtitle (~line 169) — world name instead of project name:
```ts
const world = worlds.find(w => w.id === e.worldId);
// subtitle: `${e.type} · ${world?.name ?? 'Standalone'}`
```
(subscribe `worlds`; keep `projectId: e.projectId` in the hit object for navigation fallback).
- [ ] **Step 6:** Verify: `npx tsc --noEmit && npx vitest run`
- [ ] **Step 7: Commit**

```bash
git add -A src/
git commit -m "feat: desk and editor surfaces read lore from the active project's world"
```

---

### Task 8: Entity creation paths set `worldId`

**Files:**
- `src/components/world/InlineEntryCreator.tsx` (~line 65)
- `src/components/ui/ImportModal.tsx` (its `addEntity` call — grep inside the file)
- `src/components/world/Designer.tsx:46-54` (phantom entity)
- `src/lib/betaSeedData.ts` (seed entities — world is created at line 84 `const worldId = uuid()`)

- [ ] **Step 1: InlineEntryCreator** — after `projectId: activeProjectId` add the world link:
```ts
import { selectProjectWorldKey } from '@/store/workspaceStore';
// in component: const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);
const newEntity: Entity = {
    id: crypto.randomUUID(),
    projectId: activeProjectId,
    worldId: projectWorldKey === 'standalone' ? undefined : projectWorldKey,
    name,
    type,
    description,
    createdAt: new Date(),
};
```

- [ ] **Step 2: ImportModal** — same `worldId` line in its entity construction.
- [ ] **Step 3: Designer phantom** — add `worldId: projectWorldKey === 'standalone' ? undefined : projectWorldKey,` (same selector).
- [ ] **Step 4: betaSeedData** — every seeded entity belonging to the seed world gets `worldId,` (the local const from line 84). Grep the file for `store.addEntity(` / entity literals and add the field.
- [ ] **Step 5:** Verify: `npx tsc --noEmit && npx vitest run && npm run build`
- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "feat: entity creation paths link new lore to the world"
```

---

### Task 9: Full verification (no code)

- [ ] **Step 1: Static + unit + build**

Run: `npx tsc --noEmit && npx eslint src/ && npx vitest run && npm run build`
Expected: 0 TS errors; eslint 0 errors (pre-existing `<img>` warnings OK); all tests pass (35 baseline + ~20 new); build succeeds.

- [ ] **Step 2: Preview — migration**

With the dev preview running and the existing signed-in workspace: reload the app. Existing entities must appear in the World Bible exactly as before (backfilled `worldId`). Check `localStorage['lorecanvas-workspace']` → `state.entities[*].worldId` populated where projects are on shelves; `state.worldBibles` exists.

- [ ] **Step 3: Preview — per-shelf isolation**

1. Create two shelves (worlds) A and B via the Bookshelf wizard, one story in each.
2. Open shelf A's World Bible book → create an article.
3. Back to Bookshelf → open shelf B's book → the article must NOT appear.
4. Open story A's writing desk → `[[` suggestion shows the article; story B's desk does not.

- [ ] **Step 4: Preview — shared lore within a shelf**

Add a second story to shelf A → its desk `[[` suggestions include shelf A's article.

- [ ] **Step 5: Preview — delete behaviors**

Delete story A₁ → article persists in shelf A's bible. Delete shelf A → article appears in the Standalones bible.

- [ ] **Step 6: Report**

Summarize results with pass/fail per check. Any failure: STOP and fix before Phase 2.

---

## Phase 2 preview (separate plan, written after Phase 1 lands)

Book scroll selector (Open/Edit/Organize verb roll), `worldBibleEdit` mode + Edit page (identity, presets, danger zone), HierarchyCanvas article tray with drag-onto-type-chip. Spec sections: Parts 1–3.
