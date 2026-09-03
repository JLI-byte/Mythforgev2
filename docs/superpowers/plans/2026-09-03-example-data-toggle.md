# Example Data Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the writer switch the built-in example world on and off from Settings, without ever deleting it or anything they wrote inside it.

**Architecture:** Toggling off lifts the example records out of the five live store arrays and parks them in a persisted `stashedExample` bucket; toggling on splices them back. Because the records leave the arrays entirely, none of the 87 components that read those arrays need to change. A pure leaf module computes which records belong to the example; the store action does the moving.

**Tech Stack:** TypeScript, Zustand (with `persist`), Vitest, React 19, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-09-03-example-data-toggle-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/exampleData.ts` (create) | Pure cascade: given the five arrays and a world id, decide which records belong to the example and split them out. No store or React import. |
| `src/lib/exampleData.test.ts` (create) | Unit tests for the cascade and the partition. |
| `src/store/workspaceStore.ts` (modify) | Three persisted fields, one action `setExampleData`, and the partialize entries. |
| `src/store/exampleData.test.ts` (create) | Store-level tests: round trip preserves edits, active pointers clear, nothing is deleted. |
| `src/lib/betaSeedData.ts` (modify) | `seedBetaData` returns the world id it created. `removeBetaData` is deleted. |
| `src/components/ui/SettingsModal.tsx` (modify) | The toggle, in a new section following the existing pattern. |
| `src/components/editor/desk/EmptyDeskWelcome.tsx` (modify) | "Load Example" calls the store action instead of seeding directly. |

**Conventions this codebase uses that you must follow:**

- `src/lib/*.ts` leaf modules use **4-space indent** and open with a doc comment naming them a LEAF MODULE. They define their own structural types rather than importing from the store — see `src/lib/writingDays.ts` and `src/lib/goalSchedule.ts`.
- `src/components/**/*.tsx` mostly use **2-space indent**, but some older files use 4. Match whatever the file you are editing already uses.
- **Vitest does not typecheck.** `npx vitest run` passing does not mean the code compiles. You must run `npx tsc --noEmit` separately, and it must report zero errors.

---

### Task 1: The pure cascade

**Files:**
- Create: `src/lib/exampleData.ts`
- Test: `src/lib/exampleData.test.ts`

Field names, confirmed against `src/store/workspaceStore.ts`:

- `World` has `id`
- `Project` has `id` and `worldId?: string` (optional)
- `Document` has `id` and `projectId: string`
- `Scene` has `id`, `documentId: string` **and** `projectId: string`
- `Entity` has `id` and `projectId: string`

A scene carries both foreign keys, so the cascade matches a scene if **either** its
document or its project is in the example. That sweeps up a scene whose document was
deleted, which matching on `documentId` alone would strand.

- [ ] **Step 1: Write the failing test**

Create `src/lib/exampleData.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { partitionExample, selectExampleRecords } from './exampleData';

const source = {
    worlds: [{ id: 'w-ex' }, { id: 'w-mine' }],
    projects: [
        { id: 'p1', worldId: 'w-ex' },
        { id: 'p2', worldId: 'w-ex' },
        { id: 'p3', worldId: 'w-mine' },
        { id: 'p4' },
    ],
    documents: [
        { id: 'd1', projectId: 'p1' },
        { id: 'd2', projectId: 'p2' },
        { id: 'd3', projectId: 'p3' },
    ],
    scenes: [
        { id: 's1', documentId: 'd1', projectId: 'p1' },
        { id: 's2', documentId: 'd2', projectId: 'p2' },
        { id: 's3', documentId: 'd3', projectId: 'p3' },
        { id: 's4', documentId: 'gone', projectId: 'p1' },
    ],
    entities: [
        { id: 'e1', projectId: 'p1' },
        { id: 'e2', projectId: 'p3' },
    ],
};

describe('selectExampleRecords', () => {
    it('cascades world to projects, documents, scenes and entities', () => {
        const sel = selectExampleRecords(source, 'w-ex');
        expect([...sel.worldIds]).toEqual(['w-ex']);
        expect([...sel.projectIds].sort()).toEqual(['p1', 'p2']);
        expect([...sel.documentIds].sort()).toEqual(['d1', 'd2']);
        expect([...sel.entityIds]).toEqual(['e1']);
    });

    it('sweeps a scene whose document is gone but whose project is the example', () => {
        const sel = selectExampleRecords(source, 'w-ex');
        expect([...sel.sceneIds].sort()).toEqual(['s1', 's2', 's4']);
    });

    it('leaves a project with no worldId alone', () => {
        const sel = selectExampleRecords(source, 'w-ex');
        expect(sel.projectIds.has('p4')).toBe(false);
    });

    it('returns empty sets for a world id that is not present', () => {
        const sel = selectExampleRecords(source, 'nope');
        expect(sel.worldIds.size).toBe(0);
        expect(sel.projectIds.size).toBe(0);
        expect(sel.sceneIds.size).toBe(0);
    });
});

describe('partitionExample', () => {
    it('splits every array into disjoint halves whose union is the input', () => {
        const { kept, stashed } = partitionExample(source, 'w-ex');
        for (const key of ['worlds', 'projects', 'documents', 'scenes', 'entities'] as const) {
            const keptIds = kept[key].map(r => r.id);
            const stashedIds = stashed[key].map(r => r.id);
            expect(keptIds.filter(id => stashedIds.includes(id))).toEqual([]);
            expect([...keptIds, ...stashedIds].sort())
                .toEqual(source[key].map(r => r.id).sort());
        }
    });

    it('puts the example world in stashed and the writer world in kept', () => {
        const { kept, stashed } = partitionExample(source, 'w-ex');
        expect(stashed.worlds.map(w => w.id)).toEqual(['w-ex']);
        expect(kept.worlds.map(w => w.id)).toEqual(['w-mine']);
    });

    it('stashes nothing when the world id is absent', () => {
        const { kept, stashed } = partitionExample(source, 'nope');
        expect(stashed.projects).toEqual([]);
        expect(kept.projects).toHaveLength(4);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/exampleData.test.ts`
Expected: FAIL — `Failed to resolve import "./exampleData"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/exampleData.ts`:

```typescript
/**
 * Which records belong to the built-in example world — LEAF MODULE
 * (no store or React import).
 *
 * The example world can be switched off, which moves its records out of the
 * live arrays into a stash rather than deleting them. Both halves of that
 * move — and anything else that needs to ask "is this record part of the
 * example?" — resolve it here, so there is one definition of the cascade.
 *
 * Types are structural on purpose: the store passes its real World/Project/
 * Document/Scene/Entity arrays in and gets arrays of the same concrete types
 * back, without this module depending on the store.
 */

/**
 * The example world's name. Lives here, not in betaSeedData, because that
 * module is 54KB and is loaded through a dynamic import to keep it out of the
 * main bundle — a static import of a constant from it would drag the whole
 * payload back in. Only used to adopt an example world seeded before ids were
 * recorded; everything else selects by id.
 */
export const SEED_WORLD_NAME = 'The Shattered Realm';

interface HasId { id: string }
interface ProjectLike extends HasId { worldId?: string }
interface DocumentLike extends HasId { projectId: string }
interface SceneLike extends HasId { documentId: string; projectId: string }
interface EntityLike extends HasId { projectId: string }

/** The five arrays the cascade walks. */
export interface ExampleCollections<
    W extends HasId,
    P extends ProjectLike,
    D extends DocumentLike,
    S extends SceneLike,
    E extends EntityLike,
> {
    worlds: W[];
    projects: P[];
    documents: D[];
    scenes: S[];
    entities: E[];
}

/** Every record belonging to the example world, by id. */
export interface ExampleSelection {
    worldIds: Set<string>;
    projectIds: Set<string>;
    documentIds: Set<string>;
    sceneIds: Set<string>;
    entityIds: Set<string>;
}

export function selectExampleRecords<
    W extends HasId,
    P extends ProjectLike,
    D extends DocumentLike,
    S extends SceneLike,
    E extends EntityLike,
>(source: ExampleCollections<W, P, D, S, E>, worldId: string): ExampleSelection {
    const worldIds = new Set(
        source.worlds.filter(w => w.id === worldId).map(w => w.id),
    );
    // A project with no worldId is a standalone and never part of the example.
    const projectIds = new Set(
        source.projects.filter(p => p.worldId !== undefined && worldIds.has(p.worldId))
            .map(p => p.id),
    );
    const documentIds = new Set(
        source.documents.filter(d => projectIds.has(d.projectId)).map(d => d.id),
    );
    // A scene carries both keys. Matching either sweeps up a scene whose
    // document has been deleted, which matching documentId alone would strand.
    const sceneIds = new Set(
        source.scenes
            .filter(s => documentIds.has(s.documentId) || projectIds.has(s.projectId))
            .map(s => s.id),
    );
    const entityIds = new Set(
        source.entities.filter(e => projectIds.has(e.projectId)).map(e => e.id),
    );
    return { worldIds, projectIds, documentIds, sceneIds, entityIds };
}

/**
 * Split the collections into what stays and what goes into the stash.
 * The two halves are disjoint and their union is the input.
 */
export function partitionExample<
    W extends HasId,
    P extends ProjectLike,
    D extends DocumentLike,
    S extends SceneLike,
    E extends EntityLike,
>(
    source: ExampleCollections<W, P, D, S, E>,
    worldId: string,
): {
    kept: ExampleCollections<W, P, D, S, E>;
    stashed: ExampleCollections<W, P, D, S, E>;
} {
    const sel = selectExampleRecords(source, worldId);
    const split = <T extends HasId>(rows: T[], ids: Set<string>) => ({
        kept: rows.filter(r => !ids.has(r.id)),
        stashed: rows.filter(r => ids.has(r.id)),
    });

    const w = split(source.worlds, sel.worldIds);
    const p = split(source.projects, sel.projectIds);
    const d = split(source.documents, sel.documentIds);
    const s = split(source.scenes, sel.sceneIds);
    const e = split(source.entities, sel.entityIds);

    return {
        kept: {
            worlds: w.kept, projects: p.kept, documents: d.kept,
            scenes: s.kept, entities: e.kept,
        },
        stashed: {
            worlds: w.stashed, projects: p.stashed, documents: d.stashed,
            scenes: s.stashed, entities: e.stashed,
        },
    };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/exampleData.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/lib/exampleData.ts src/lib/exampleData.test.ts
git commit -m "feat: pure cascade for the example world's records"
```

---

### Task 2: `seedBetaData` reports the world it made, and `removeBetaData` goes

**Files:**
- Modify: `src/lib/betaSeedData.ts:88` (signature), `src/lib/betaSeedData.ts:822-853` (delete)

Selecting the example by world *name* breaks the moment the writer renames it. The
store will key off an id instead, so the seeder has to hand that id back.

`removeBetaData` is a dead export — nothing calls it (verify with the grep in Step 1).
Its whole purpose is the destructive removal this design rejects, and its cascade now
lives in `selectExampleRecords`. Delete it rather than leave a second, untested,
destructive path to the same records.

- [ ] **Step 1: Confirm `removeBetaData` really is unused**

Run: `grep -rn "removeBetaData" src --include=*.ts --include=*.tsx | grep -v "betaSeedData.ts"`
Expected: no output. If anything prints, stop and report it — the plan assumed a dead export.

- [ ] **Step 2: Change the return type**

In `src/lib/betaSeedData.ts`, change line 88 from:

```typescript
export function seedBetaData(store: WorkspaceState): void {
  // Guard — don't seed twice
  if (store.worlds.some(w => w.name === 'The Shattered Realm')) return;
```

to:

```typescript
/**
 * Build the example world. Returns the id of the world it created, or the id of
 * the existing one if it was already seeded — the caller records this so the
 * example can be found later by id rather than by a name the writer may change.
 */
export function seedBetaData(store: WorkspaceState): string {
  const existing = store.worlds.find(w => w.name === SEED_WORLD_NAME);
  if (existing) return existing.id;
```

- [ ] **Step 3: Import the name constant and return the id**

`SEED_WORLD_NAME` is declared in `src/lib/exampleData.ts` (Task 1), not here — this
module is 54KB and reached through a dynamic import, so nothing outside it may import
a constant from it. Add to the imports at the top of `src/lib/betaSeedData.ts`:

```typescript
import { SEED_WORLD_NAME } from '@/lib/exampleData';
```

Then at the very end of the `seedBetaData` function body — after the last `store.add*`
call and before its closing brace — add:

```typescript
  return worldId;
```

- [ ] **Step 4: Delete `removeBetaData`**

Delete the entire `export function removeBetaData(store: WorkspaceState): void { ... }`
block (it starts at line 822 and runs to its closing brace around line 853).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. If it complains that `WorkspaceState` is now unused, leave the
import — `seedBetaData` still takes it.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass (406 before this plan started, plus the 7 from Task 1).

- [ ] **Step 7: Commit**

```bash
git add src/lib/betaSeedData.ts
git commit -m "refactor: seedBetaData returns its world id, removeBetaData deleted"
```

---

### Task 3: Store state and persistence

**Files:**
- Modify: `src/store/workspaceStore.ts` (interface ~line 578, initial state ~line 1294, partialize ~line 1183)
- Test: `src/store/exampleData.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/store/exampleData.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, partializeWorkspace } from './workspaceStore';

describe('example data state', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            worlds: [], projects: [], documents: [], scenes: [], entities: [],
            exampleDataOn: false, stashedExample: null, exampleWorldId: null,
        });
    });

    it('starts off with nothing stashed', () => {
        const s = useWorkspaceStore.getState();
        expect(s.exampleDataOn).toBe(false);
        expect(s.stashedExample).toBeNull();
        expect(s.exampleWorldId).toBeNull();
    });

    it('persists all three fields', () => {
        const persisted = partializeWorkspace(useWorkspaceStore.getState());
        expect(persisted).toHaveProperty('exampleDataOn');
        expect(persisted).toHaveProperty('stashedExample');
        expect(persisted).toHaveProperty('exampleWorldId');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store/exampleData.test.ts`
Expected: FAIL — `expect(received).toHaveProperty("exampleDataOn")`.

- [ ] **Step 3: Add the interface fields**

In `src/store/workspaceStore.ts`, immediately after the `isTypewriterMode: boolean;`
declaration (line 578), add:

```typescript

    /**
     * Whether the built-in example world is currently shown. Off moves its
     * records into stashedExample rather than deleting them.
     */
    exampleDataOn: boolean;

    /**
     * The example world's records while it is switched off. Holds the real
     * records, including any edits the writer made, so toggling back on
     * restores exactly what was there.
     */
    stashedExample: StashedExample | null;

    /**
     * The example world's id, recorded at seed time. Selection runs off this
     * rather than the world's name, which the writer is free to change.
     */
    exampleWorldId: string | null;
```

- [ ] **Step 4: Add the `StashedExample` type**

In `src/store/workspaceStore.ts`, directly above the `WorkspaceState` interface that
contains `worlds: World[];` (line 504), add:

```typescript
/** The example world's five collections, held aside while it is switched off. */
export interface StashedExample {
    worlds: World[];
    projects: Project[];
    documents: Document[];
    scenes: Scene[];
    entities: Entity[];
}
```

- [ ] **Step 5: Add the initial values**

In the store's initial state, immediately after `isTypewriterMode: false,` (line 1294), add:

```typescript
            exampleDataOn: false,
            stashedExample: null,
            exampleWorldId: null,
```

- [ ] **Step 6: Add the partialize entries**

In `partializeWorkspace` (line 1183), immediately after `isTypewriterMode: state.isTypewriterMode,`, add:

```typescript
        exampleDataOn: state.exampleDataOn,
        stashedExample: state.stashedExample,
        exampleWorldId: state.exampleWorldId,
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/store/exampleData.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add src/store/workspaceStore.ts src/store/exampleData.test.ts
git commit -m "feat: persisted state for the example data toggle"
```

---

### Task 4: The `setExampleData` action

**Files:**
- Modify: `src/store/workspaceStore.ts` (action signature ~line 839, implementation ~line 1625)
- Test: `src/store/exampleData.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `src/store/exampleData.test.ts`, inside the same file but as a new `describe`:

```typescript
describe('setExampleData', () => {
    /** A tiny stand-in for the real seed: one world, one project, one doc, one scene. */
    function seedFixture() {
        useWorkspaceStore.setState({
            worlds: [
                { id: 'w-ex', name: 'The Shattered Realm' } as never,
                { id: 'w-mine', name: 'Aethel' } as never,
            ],
            projects: [
                { id: 'p-ex', name: 'The Shard Archivist', worldId: 'w-ex' } as never,
                { id: 'p-mine', name: 'My Book', worldId: 'w-mine' } as never,
            ],
            documents: [
                { id: 'd-ex', projectId: 'p-ex', content: 'original' } as never,
                { id: 'd-mine', projectId: 'p-mine', content: 'mine' } as never,
            ],
            scenes: [{ id: 's-ex', documentId: 'd-ex', projectId: 'p-ex' } as never],
            entities: [{ id: 'e-ex', projectId: 'p-ex' } as never],
            exampleDataOn: true,
            exampleWorldId: 'w-ex',
            stashedExample: null,
        });
    }

    beforeEach(() => {
        useWorkspaceStore.setState({
            worlds: [], projects: [], documents: [], scenes: [], entities: [],
            exampleDataOn: false, stashedExample: null, exampleWorldId: null,
            activeProjectId: null, activeDocumentId: null, activeSceneId: null,
        });
    });

    it('off removes exactly the example records and keeps the writer\'s own', () => {
        seedFixture();
        useWorkspaceStore.getState().setExampleData(false);
        const s = useWorkspaceStore.getState();
        expect(s.worlds.map(w => w.id)).toEqual(['w-mine']);
        expect(s.projects.map(p => p.id)).toEqual(['p-mine']);
        expect(s.documents.map(d => d.id)).toEqual(['d-mine']);
        expect(s.scenes).toEqual([]);
        expect(s.entities).toEqual([]);
        expect(s.exampleDataOn).toBe(false);
    });

    it('off stashes rather than deletes', () => {
        seedFixture();
        useWorkspaceStore.getState().setExampleData(false);
        const stash = useWorkspaceStore.getState().stashedExample;
        expect(stash).not.toBeNull();
        expect(stash!.worlds.map(w => w.id)).toEqual(['w-ex']);
        expect(stash!.scenes.map(x => x.id)).toEqual(['s-ex']);
        expect(stash!.entities.map(x => x.id)).toEqual(['e-ex']);
    });

    it('round trip returns an edit made inside the example', () => {
        seedFixture();
        useWorkspaceStore.setState({
            documents: useWorkspaceStore.getState().documents.map(d =>
                d.id === 'd-ex' ? ({ ...d, content: 'my edit' } as never) : d),
        });
        useWorkspaceStore.getState().setExampleData(false);
        useWorkspaceStore.getState().setExampleData(true);
        const doc = useWorkspaceStore.getState().documents.find(d => d.id === 'd-ex');
        expect((doc as unknown as { content: string }).content).toBe('my edit');
        expect(useWorkspaceStore.getState().stashedExample).toBeNull();
        expect(useWorkspaceStore.getState().exampleDataOn).toBe(true);
    });

    it('off clears active pointers that referred to the example', () => {
        seedFixture();
        useWorkspaceStore.setState({
            activeProjectId: 'p-ex', activeDocumentId: 'd-ex', activeSceneId: 's-ex',
        });
        useWorkspaceStore.getState().setExampleData(false);
        const s = useWorkspaceStore.getState();
        expect(s.activeProjectId).toBeNull();
        expect(s.activeDocumentId).toBeNull();
        expect(s.activeSceneId).toBeNull();
    });

    it('off leaves active pointers that referred to the writer\'s own work', () => {
        seedFixture();
        useWorkspaceStore.setState({ activeProjectId: 'p-mine', activeDocumentId: 'd-mine' });
        useWorkspaceStore.getState().setExampleData(false);
        const s = useWorkspaceStore.getState();
        expect(s.activeProjectId).toBe('p-mine');
        expect(s.activeDocumentId).toBe('d-mine');
    });

    it('off with no example world present just sets the flag', () => {
        useWorkspaceStore.setState({
            worlds: [{ id: 'w-mine', name: 'Aethel' } as never],
            exampleDataOn: true, exampleWorldId: null, stashedExample: null,
        });
        expect(() => useWorkspaceStore.getState().setExampleData(false)).not.toThrow();
        const s = useWorkspaceStore.getState();
        expect(s.exampleDataOn).toBe(false);
        expect(s.stashedExample).toBeNull();
        expect(s.worlds).toHaveLength(1);
    });

    it('adopts an example world seeded before ids were recorded', () => {
        seedFixture();
        useWorkspaceStore.setState({ exampleWorldId: null });
        useWorkspaceStore.getState().setExampleData(false);
        expect(useWorkspaceStore.getState().exampleWorldId).toBe('w-ex');
        expect(useWorkspaceStore.getState().stashedExample!.worlds.map(w => w.id))
            .toEqual(['w-ex']);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/store/exampleData.test.ts`
Expected: FAIL — `useWorkspaceStore.getState().setExampleData is not a function`.

- [ ] **Step 3: Add the action signature**

In `src/store/workspaceStore.ts`, immediately after the `toggleTypewriterMode: () => void;`
declaration (line 839), add:

```typescript

    /**
     * Show or hide the built-in example world. Hiding moves its records into
     * stashedExample; showing splices them back, or seeds fresh if there is
     * nothing stashed and nothing already present.
     */
    setExampleData: (on: boolean) => void;
```

- [ ] **Step 4: Add the import**

At the top of `src/store/workspaceStore.ts`, alongside the other `@/lib` imports
(they sit at lines 6-16), add:

```typescript
import { partitionExample, SEED_WORLD_NAME } from '@/lib/exampleData';
```

Both come from the leaf module. Nothing may be statically imported from
`@/lib/betaSeedData` — it is 54KB and only ever reached through the `import()` inside
the action, which is what keeps it out of the main bundle.

- [ ] **Step 5: Implement the action**

In `src/store/workspaceStore.ts`, immediately after the `toggleTypewriterMode`
implementation (line 1625-1626), add:

```typescript
            setExampleData: (on) => {
                const state = get();

                if (on) {
                    const stash = state.stashedExample;
                    if (stash) {
                        // Splice the records back exactly as they were stashed.
                        set({
                            worlds: [...state.worlds, ...stash.worlds],
                            projects: [...state.projects, ...stash.projects],
                            documents: [...state.documents, ...stash.documents],
                            scenes: [...state.scenes, ...stash.scenes],
                            entities: [...state.entities, ...stash.entities],
                            stashedExample: null,
                            exampleDataOn: true,
                        });
                        return;
                    }
                    // Nothing stashed — build it. The seeder mutates the store
                    // through its own actions, so this runs outside set().
                    void import('@/lib/betaSeedData').then(({ seedBetaData }) => {
                        const worldId = seedBetaData(get());
                        set({ exampleWorldId: worldId, exampleDataOn: true });
                    });
                    return;
                }

                // Off. Resolve the world by id, falling back once to the name
                // for an example seeded before ids were recorded.
                let worldId = state.exampleWorldId;
                if (!worldId) {
                    worldId = state.worlds.find(w => w.name === SEED_WORLD_NAME)?.id ?? null;
                }
                if (!worldId || !state.worlds.some(w => w.id === worldId)) {
                    // Already gone — nothing to stash.
                    set({ exampleDataOn: false });
                    return;
                }

                const { kept, stashed } = partitionExample(
                    {
                        worlds: state.worlds,
                        projects: state.projects,
                        documents: state.documents,
                        scenes: state.scenes,
                        entities: state.entities,
                    },
                    worldId,
                );

                // A pointer into a stashed record would leave the desk holding a
                // reference to something no longer in its array.
                const stashedProjects = new Set(stashed.projects.map(p => p.id));
                const stashedDocuments = new Set(stashed.documents.map(d => d.id));
                const stashedScenes = new Set(stashed.scenes.map(s => s.id));

                set({
                    ...kept,
                    stashedExample: stashed,
                    exampleWorldId: worldId,
                    exampleDataOn: false,
                    activeProjectId: state.activeProjectId && stashedProjects.has(state.activeProjectId)
                        ? null : state.activeProjectId,
                    activeDocumentId: state.activeDocumentId && stashedDocuments.has(state.activeDocumentId)
                        ? null : state.activeDocumentId,
                    activeSceneId: state.activeSceneId && stashedScenes.has(state.activeSceneId)
                        ? null : state.activeSceneId,
                });
            },
```

- [ ] **Step 6: Confirm the seed payload stayed out of the main bundle**

Run: `grep -n "from '@/lib/betaSeedData'" src/store/workspaceStore.ts`
Expected: no output. The only reference to that module in the store must be the
`await import('@/lib/betaSeedData')` inside the action. A static import would pull
54KB into every page load.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/store/exampleData.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add src/store/workspaceStore.ts src/store/exampleData.test.ts
git commit -m "feat: setExampleData stashes and restores the example world"
```

---

### Task 5: The Settings toggle

**Files:**
- Modify: `src/components/ui/SettingsModal.tsx` (after the "Editor Behavior" section, ~line 226)

This file uses **4-space indent**. Match it.

- [ ] **Step 1: Read the existing pattern**

Read `src/components/ui/SettingsModal.tsx` lines 214-227. The "Editor Behavior" section
is the template: a `<section className={styles.section}>` carrying the inline border-top
style, a `<div className={styles.providerHeader}>` with an `<h3>`, then a `<label>`
wrapping a checkbox.

- [ ] **Step 2: Subscribe to the state**

Near the other `useWorkspaceStore` selector calls at the top of the component, add:

```typescript
    const exampleDataOn = useWorkspaceStore(s => s.exampleDataOn);
    const setExampleData = useWorkspaceStore(s => s.setExampleData);
```

- [ ] **Step 3: Add the section**

Immediately after the closing `</section>` of "Editor Behavior" (line 226) and before
`<AISettingsSection />`, add:

```tsx
                    <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div className={styles.providerHeader}>
                            <h3>Example Data</h3>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={exampleDataOn}
                                onChange={(e) => setExampleData(e.target.checked)}
                            />
                            Show example data (a sample world with three projects, so you can see a populated workspace)
                        </label>
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                            Turning this off puts the example away without deleting it. Anything you
                            wrote inside it comes back when you turn it on again.
                        </p>
                    </section>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SettingsModal.tsx
git commit -m "feat: example data toggle in Settings"
```

---

### Task 6: Rewire the Writing Desk button

**Files:**
- Modify: `src/components/editor/desk/EmptyDeskWelcome.tsx:40-57`

This file uses **2-space indent**. Match it.

The button keeps its `isSeeding` pending state — the first turn-on still dynamically
imports the 50KB seed module, so there is still a moment to cover.

- [ ] **Step 1: Replace the handler**

In `src/components/editor/desk/EmptyDeskWelcome.tsx`, replace this block:

```tsx
  const [isSeeding, setIsSeeding] = useState(false);
  const handleLoadExample = async () => {
    setIsSeeding(true);
    try {
      // Dynamically imported so the 50KB example world stays out of the main bundle.
      const { seedBetaData } = await import('@/lib/betaSeedData');
      seedBetaData(useWorkspaceStore.getState());
      const seeded = useWorkspaceStore.getState().projects;
      if (seeded.length > 0) {
        const newest = [...seeded].sort((a, b) =>
          new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
        )[0];
        handleSelect(newest.id);
      }
    } finally {
      setIsSeeding(false);
    }
  };
```

with:

```tsx
  const [isSeeding, setIsSeeding] = useState(false);
  const handleLoadExample = async () => {
    setIsSeeding(true);
    try {
      // One piece of state, two ways in: this and the Settings toggle.
      useWorkspaceStore.getState().setExampleData(true);
      // The first turn-on seeds through a dynamic import, so the projects
      // are not in the store synchronously. Wait for one to appear.
      const seeded = await waitForProjects();
      if (seeded.length > 0) {
        const newest = [...seeded].sort((a, b) =>
          new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
        )[0];
        handleSelect(newest.id);
      }
    } finally {
      setIsSeeding(false);
    }
  };
```

- [ ] **Step 2: Add the wait helper**

Directly above the `EmptyDeskWelcome` component declaration in the same file, add:

```tsx
/**
 * The first turn-on seeds behind a dynamic import, so projects land a tick or
 * two later. Poll briefly rather than guess a fixed delay.
 */
async function waitForProjects(timeoutMs = 3000): Promise<Project[]> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const projects = useWorkspaceStore.getState().projects;
    if (projects.length > 0) return projects;
    await new Promise(r => setTimeout(r, 50));
  }
  return useWorkspaceStore.getState().projects;
}
```

Add `Project` to the existing `@/store/workspaceStore` type import at the top of the file
if it is not already imported.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/desk/EmptyDeskWelcome.tsx
git commit -m "feat: Load Example drives the same toggle as Settings"
```

---

### Task 7: Verify it in the running app

**Files:** none — this is a browser pass.

Vitest does not render this app, so the round trip has to be seen working.

- [ ] **Step 1: Start the dev server**

Use the Browser pane's `preview_start` with `{name: "dev"}` from `.claude/launch.json`.
Do **not** run the dev server through Bash.

- [ ] **Step 2: Turn the example on**

Sign-in is required to reach the workspace and only the user can do that; if the app is
sitting at `/welcome`, ask them to sign in before continuing.

Open Settings, tick "Show example data". Confirm "The Shattered Realm" appears on the
Bookshelf with three projects.

- [ ] **Step 3: Edit something inside it**

Open one of its documents, type a recognisable word, and let it save.

- [ ] **Step 4: Toggle off and check the count**

Untick the toggle. In the browser console, confirm the records left the arrays and
landed in the stash:

```javascript
const s = JSON.parse(localStorage.getItem('lorecanvas-workspace')).state;
({ worlds: s.worlds.length, projects: s.projects.length,
   stashedProjects: s.stashedExample?.projects.length ?? 0,
   on: s.exampleDataOn });
```

Expected: `stashedProjects` is 3, `on` is false, and the example world is absent from
`worlds`.

- [ ] **Step 5: Toggle on and confirm the edit survived**

Tick it again. Open the same document. The word you typed is still there.

- [ ] **Step 6: Check both themes**

The new Settings section uses `var(--border)` and `var(--muted)`, both of which are
theme tokens. Switch between light and dark and confirm the section reads correctly in
each.

- [ ] **Step 7: Commit any fixes**

If the browser pass turned up a defect, fix it, re-run `npx tsc --noEmit` and
`npx vitest run`, then commit.

---

## Self-review notes

**Spec coverage.** Stash-not-filter → Task 3 and 4. Identity by id with name fallback →
Task 2 (constant, returned id) and Task 4 (fallback branch, tested). Leaf module → Task 1.
`removeBetaData` deleted → Task 2. Active pointers cleared → Task 4, two tests. Persistence
→ Task 3. Settings UI → Task 5. Empty desk rewire → Task 6. Edge cases: world deleted by
hand → Task 4 "just sets the flag" test; own world sharing the name → covered by selecting
on id, which the adoption test exercises.

**Naming consistency.** `StashedExample` is declared in the store (Task 3) and used there;
the leaf module uses its own structural `ExampleCollections` and never imports store types,
which is why the two names coexist. `setExampleData`, `exampleDataOn`, `stashedExample`,
`exampleWorldId`, `SEED_WORLD_NAME`, `selectExampleRecords`, `partitionExample` are spelled
identically everywhere they appear.

**Two things the implementer should watch.**

1. The `on` branch with an empty stash resolves asynchronously through `import()`.
   `setExampleData(true)` therefore returns before the world exists, which is why Task 6
   polls rather than reading the store on the next line.

2. `src/lib/betaSeedData.ts` is 54KB and is deliberately reached only through
   `await import()`. **Nothing may statically import from it** — not even a string
   constant, because that pulls the entire module into the main bundle and silently
   undoes the code-splitting. This is why `SEED_WORLD_NAME` lives in the leaf module
   and `betaSeedData` imports it, rather than the other way round. Task 4 Step 6
   guards this with a grep.
