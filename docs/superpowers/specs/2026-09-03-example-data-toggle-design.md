# Example data toggle — design

**Date:** 2026-09-03
**Branch:** `feature/app-styling`
**Status:** approved, not yet implemented

## Problem

The app ships an example world — "The Shattered Realm", a fully furnished
fantasy setting with three projects across three writing modes. It is the only
way to see what a populated LoreCanvas looks like without building one.

Right now it is a one-way door. A "Load Example" button on the empty Writing
Desk seeds it, and nothing removes it. `removeBetaData` exists and is correct,
but nothing calls it — a dead export. Once you load the example you live with
it, mixed in beside your real work on every shelf, in every switcher, and in
every count.

The writer wants a toggle: on to see it, off to put it away.

## What already exists

`src/lib/betaSeedData.ts` holds both halves:

- `seedBetaData(store)` — creates 1 world, 3 projects, 9 documents, 27 scenes
  and 18 entities
- `removeBetaData(store)` — cascades the deletion in the right order
  (entities → scenes → documents → projects → world)

Both locate the seed by matching the world **name** against the string
`'The Shattered Realm'`.

Only `seedBetaData` is wired, from `EmptyDeskWelcome.tsx`.

## The constraint that decides the approach

87 components read these collections straight off the store:

| Collection | Components reading it |
|---|---|
| `entities` | 29 |
| `projects` | 27 |
| `documents` | 11 |
| `scenes` | 11 |
| `worlds` | 9 |

A "hide" implemented as filtering would mean teaching every one of those read
sites — plus every count, search and export path — to skip seeded records. That
is not a toggle, it is a rewrite, and every missed site is a bug that shows the
example data where it should not be.

So hiding happens **at the data, not at the read**.

## Approach: stash, don't filter and don't delete

Two new pieces of persisted state:

```ts
exampleDataOn: boolean;
stashedExample: StashedExample | null;
```

where

```ts
interface StashedExample {
    worlds: World[];
    projects: Project[];
    documents: Document[];
    scenes: Scene[];
    entities: Entity[];
}
```

**Toggling off** lifts the example records out of the live arrays and parks them
in `stashedExample`. **Toggling on** splices them back and clears the stash.

Every component keeps working untouched — it simply sees shorter arrays. And
because the stash holds the real records, anything the writer changed inside the
example world rides along and comes back exactly as they left it.

Nothing is ever deleted. That is the point: this project has already lost work
once to a sync bug, and a destructive toggle is not worth the convenience.

### First turn-on

If `stashedExample` is null and no example world is present, toggling on calls
`seedBetaData` to build it fresh. After that the stash is the source of truth.

## Identity by id, not by name

Matching on the world name breaks the moment someone renames the example world,
and renaming it is a reasonable thing to do if you decide to keep it and make it
yours.

A third piece of persisted state fixes this:

```ts
exampleWorldId: string | null;
```

`seedBetaData` records the id of the world it creates. Selection then runs off
that id and is immune to renaming.

**Migration.** A writer who already loaded the example has no
`exampleWorldId`. On first read, if it is null, fall back to the name lookup
once, adopt whatever id it finds, and persist it. After that the name is never
consulted again.

## New leaf module

`src/lib/exampleData.ts` — a LEAF MODULE: pure functions, no store or React
imports, 4-space indent, matching `goalSchedule.ts` and `writingDays.ts`.

```ts
/** Every record belonging to the example world, by id. */
export interface ExampleSelection {
    worldIds: Set<string>;
    projectIds: Set<string>;
    documentIds: Set<string>;
    sceneIds: Set<string>;
    entityIds: Set<string>;
}

export function selectExampleRecords(
    source: StashedExample,
    worldId: string,
): ExampleSelection;

export function partitionExample(
    source: StashedExample,
    worldId: string,
): { kept: StashedExample; stashed: StashedExample };
```

`StashedExample` doubles as the input type. It is exactly the five arrays the
functions operate on, so the module never depends on the full
`WorkspaceState` — the store passes its five arrays in and gets two of the same
shape back.

The cascade is the one `removeBetaData` already performs: the world, the
projects pointing at it, the documents under those projects, the scenes under
those documents, and the entities under those projects.

### Delete `removeBetaData`

Once the toggle exists, `removeBetaData` is a dead export whose only purpose was
the destructive removal this design deliberately rejects. Its selection logic
moves to `selectExampleRecords` and its deletes are not wanted anywhere. Remove
it rather than leaving a second, destructive path to the same records that
nothing calls and nobody has tested.

## Store action

```ts
setExampleData: (on: boolean) => void;
```

**On:**
1. If `stashedExample` is non-null, concatenate each array back and set the
   stash to null.
2. Otherwise call `seedBetaData` and record `exampleWorldId`.
3. Set `exampleDataOn: true`.

**Off:**
1. Resolve `exampleWorldId` (with the one-time name fallback). If there is no
   example world present, set `exampleDataOn: false` and stop — nothing to
   stash.
2. `partitionExample` the five arrays.
3. Clear any active pointer that now refers to a stashed record:
   `activeProjectId`, `activeDocumentId`, `activeSceneId`. Leaving them set
   would point the Writing Desk at a record no longer in its array.
4. Commit `kept` to the arrays, `stashed` to `stashedExample`,
   `exampleDataOn: false`.

Both branches are a single `set()` so the arrays and the flag never disagree
mid-update.

## Persistence

`exampleDataOn`, `stashedExample` and `exampleWorldId` all join
`partializeWorkspace`. The stash must persist — an unpersisted stash is a
delete with extra steps — and persisting it means it syncs to Supabase and
survives a device switch like every other field.

## Edge cases

**The writer deletes the example world by hand while the toggle is on.** Step 1
of the off path finds nothing and simply sets the flag false. Toggling on again
finds a null stash and re-seeds.

**A stashed record's project is deleted while stashed.** Cannot happen — stashed
records are out of the arrays entirely, so no store action can reach them.

**Toggling on when the writer has since created their own world named "The
Shattered Realm".** Selection runs off `exampleWorldId`, not the name, so their
world is never touched.

## UI

**Settings.** A new section in `SettingsModal.tsx`, following the exact pattern
of "Editor Behavior" — a `<section className={styles.section}>` with the
established inline border-top style, an `<h3>` in a `providerHeader` div, and a
`<label>` wrapping a checkbox. The label reads:

> Show example data (a sample world with three projects, so you can see a
> populated workspace)

**Empty Writing Desk.** `EmptyDeskWelcome.tsx` keeps its "Load Example" button.
It now calls `setExampleData(true)` rather than importing and calling
`seedBetaData` itself. One piece of state, two ways in — the desk is where a new
writer meets the app, and Settings is where they put the example away.

The button keeps its existing `isSeeding` pending state, since the first
turn-on still dynamically imports the 50KB seed module.

## Testing

**Leaf module** (`src/lib/exampleData.test.ts`) — pure, no store:

- `selectExampleRecords` cascades correctly: a world with two projects, each
  with a document, each with two scenes, plus three entities, yields exactly
  those ids and nothing belonging to a second unrelated world
- `partitionExample` returns disjoint `kept` and `stashed` whose union is the
  input, for every one of the five arrays
- A project whose `worldId` points at a deleted world is not swept into the
  selection

**Store:**

- Round trip: seed, edit a document's content, toggle off, toggle on — the
  document comes back with the edit intact
- Toggle off removes exactly the example records and leaves the writer's own
  projects, worlds and entities in place
- Toggle off clears `activeProjectId` when it pointed at an example project, and
  leaves it alone when it pointed at the writer's own
- `stashedExample` is present in `partializeWorkspace`
- Toggling off with no example world present sets the flag and does not throw

## Out of scope

No second example world, no per-project hiding, no choosing which example to
load. One example, one toggle.
