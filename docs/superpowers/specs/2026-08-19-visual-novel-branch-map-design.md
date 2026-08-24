# Visual Novel Branch Map — Design Spec

**Date:** 2026-08-19
**Status:** Approved — Phase 1 planned, Phases 2–3 outlined
**Author:** brainstormed with Claude

## Summary

Give the visual novel work type its own way of drafting: a **branch map** on the
Draft Table made of blocks, connections and tracked flags, rather than the
static prompt cards every other writing method lays down.

The map is not a sketch beside the story — it **is** the story's spine. A block
is a beat that holds real scenes; a connection is a real choice; a flag is real
state. Everything drafted here reaches the `.rpy` export already built.

This spec covers all three phases. **Phase 1 is the data model, flags and the
adapter** — pure, fully tested, no UI. Phases 2 and 3 are outlined here but get
their own plans once Phase 1 is in use.

## Goals

- A block map that shows **decision branches and tracked flags** at a glance.
- Blocks that create and own real scenes, so nothing is drafted twice.
- Flags that are **declared, not typed** — booleans and numeric counters,
  composed from dropdowns.
- A `.rpy` export that keeps working, with no rewrite of the tested generator.
- A drafting flow with momentum: wiring a branch should be one gesture.

## Non-Goals

- Auto-layout, minimap, edge routing around obstacles, collapsing subtrees.
- Free-text conditions or effects. Every operand comes from the flag registry.
- Replacing the existing **Interactive Fiction Map** method — it still serves
  Twine and CYOA writers on the `game` format and is left alone.
- Changing how any other work type uses `Document` or `Scene`.

## Decisions Taken

Four questions settled during brainstorming, each of which removed a large
amount of possible work:

1. **The map is the spine**, not a planning sketch. Blocks create scenes and
   choices directly. Rejected: a freeform sketch you retype into the Writing
   Desk, which drifts the first time you change your mind — which during
   drafting is constantly.
2. **A block is a beat**: a run of scenes that plays straight through, ending
   at a decision. Rejected: one block per scene (a 200-scene AVN becomes an
   unreadable wall, and the main branches drown) and one block per route (too
   coarse to say where a flag is set, so it cannot be the spine).
3. **Flags are booleans and numeric counters.** Rejected: booleans only (no
   affection meters, which AVNs lean on heavily) and free-text expressions (a
   code editor with no syntax checking, feeding a file nobody here can compile
   — the exact shape of the two bugs review caught last time).
4. **A block shows its choices as rows with flag chips** and a connector dot
   per row. Rejected: a minimal card (hides the flags, which the writer
   explicitly wants surfaced) and a tiny node with labelled edges (prettier at
   scale, but editing means clicking thin diagonal lines and labels collide
   once branches cross).

## Existing Architecture Being Reused

- **`Project → Document → Scene`.** In a novel, `Document` is a chapter. For a
  visual novel it is a **block**. Blocks are therefore not a new storage
  concept, and scenes inside a block already have `order`.
- **The Draft Table canvas** (`WritingDesk.tsx`, `variant='draft'`) is already a
  pan/zoom spatial canvas of draggable, persisted widgets. Blocks are a new
  widget type on it; no new canvas engine.
- **The writing-method registry** (`src/lib/writingMethods/`) is data, not code
  — a method is a list of beat cards. The branch map needs structure the
  registry cannot express, so it adds a widget type, but it still gets a
  registry entry as its entry point.
- **`buildRenpyScript`** and its 29 tests. The block model reaches it through an
  adapter rather than a rewrite. See *The exporter does not change*.
- **The fall-through rule**: a scene with no choices emits
  `jump <next scene by order>`. This is what makes scenes *inside* a block
  chain without any new concept.

## Data Model

### Blocks

`Document` gains one optional field:

```ts
/** Visual novel projects only: the decision this beat ends on. */
choices?: VNChoice[];
```

**There are two choice types, and keeping them separate is what lets the
exporter stay still.**

What the writer authors on the map targets a **block**:

```ts
/** A choice as drafted on the branch map. Lives on Document.choices. */
export interface VNBlockChoice {
    id: string;
    text: string;
    /** Block (Document) this jumps to. */
    targetBlockId: string;
    effects?: VNEffect[];
    condition?: VNCondition;
}
```

What the exporter consumes still targets a **scene**, because that is what
`buildRenpyScript` already reads:

```ts
export interface VNChoice {
    id: string;
    text: string;
    targetSceneId: string;      // unchanged
    effects?: VNEffect[];       // replaces setsFlag
    condition?: VNCondition;    // replaces requiresFlag
}
```

The adapter maps `VNBlockChoice → VNChoice`, rewriting `targetBlockId` into the
target block's first scene id. `Scene.choices` stays typed as `VNChoice[]` and
`buildRenpyScript`'s signature does not move.

`setsFlag` and `requiresFlag` are removed from `VNChoice` — they cannot express
counters. That is the one place this change touches already-tested code.

### Flags

New leaf module `src/lib/vnFlags.ts`:

```ts
export type VNFlagKind = 'bool' | 'counter';

export interface VNFlag {
    id: string;
    /** Author-facing name, e.g. 'mara_trust'. Slugified on emission. */
    name: string;
    kind: VNFlagKind;
    /** Starting value. Booleans use 0 or 1. */
    initial: number;
}

/** What a choice does to state when taken. */
export interface VNEffect {
    flagId: string;
    op: 'set' | 'clear' | 'add';
    /** Required for 'add'; ignored otherwise. */
    value?: number;
}

/** When a choice is offered at all. */
export interface VNCondition {
    flagId: string;
    op: 'is' | 'not' | 'atLeast' | 'atMost';
    /** Required for 'atLeast' and 'atMost'; ignored otherwise. */
    value?: number;
}
```

The registry lives on the project:

```ts
/** Visual novel projects only: declared story state. */
vnFlags?: VNFlag[];
```

Effects and conditions reference a flag by **id**, so renaming a flag never
breaks a choice.

### Emission

| Model | Ren'Py |
|---|---|
| `VNFlag` bool, initial 0 | `default told_truth = False` |
| `VNFlag` counter, initial 0 | `default mara_trust = 0` |
| effect `set` | `$ told_truth = True` |
| effect `clear` | `$ told_truth = False` |
| effect `add`, value 1 | `$ mara_trust += 1` |
| condition `is` | `if told_truth` |
| condition `not` | `if not told_truth` |
| condition `atLeast`, 3 | `if mara_trust >= 3` |
| condition `atMost`, 0 | `if mara_trust <= 0` |

Flag names pass through the existing `toIdentifier` path, so a flag called
`met bob` still emits `met_bob`. That protection stays.

## The Exporter Does Not Change

`buildRenpyScript` keeps taking a flat `VNScene[]`. A new adapter in
`src/lib/vnBlocks.ts` converts blocks into that shape:

```ts
export function flattenBlocksToScenes(
    blocks: VNBlock[],
    scenesByBlock: Map<string, VNScene[]>,
): VNScene[]
```

It does exactly two things:

1. Converts each block's `VNBlockChoice[]` to `VNChoice[]` and puts them on that
   block's **last scene**.
2. Resolves each choice's `targetBlockId` to that block's **first scene** id.

Scenes inside a block then chain by themselves via the existing fall-through
rule, and the block's last scene carries the menu. A three-scene block becomes
three labels flowing into each other, with the decision on the last.

Consequences worth stating:

- A block with **no scenes** is skipped entirely, and any choice targeting it is
  re-pointed at the next non-empty block. An empty block is a drafting
  placeholder, not a story beat. If no non-empty block follows, the choice is
  emitted with no target, which `buildRenpyScript` already handles by writing a
  comment and `return`.
- A map where **every** block is empty flattens to an empty scene list, which
  the exporter already renders as a header with no body.
- A block with **no choices** falls through to the next block by order, which is
  the linear-continue case and already correct.
- Blocks must occupy a **contiguous run of scene `order` values**. The adapter
  renumbers on export rather than trusting the store, so dragging blocks around
  the canvas cannot corrupt the export.

Only the flag-emission part of `renpyExport.ts` changes. Labels, escaping,
dialogue parsing, aliases, fall-through and the golden test are untouched.

## Canvas and Interaction (Phases 2–3)

Outlined, not planned in detail here.

**Block widget** (`vnBlock`): title, scene count with scene names beneath, then
one row per choice — choice text, its flag chips (`+bold`, `trust −1`), and a
connector dot. A `+ choice` row at the bottom.

**Flags panel** (`vnFlags` widget): the declared registry. Flags can also be
created inline from a choice row, so declaring one never interrupts drafting.

**Edge layer**: an SVG overlay drawing a curve per choice from its dot to the
target block. Edges are **derived every render, never stored**, so they cannot
go stale when a block moves or a choice changes.

**Drag-to-connect**: drag a choice's dot onto a block to wire it. Dropping on
empty canvas **creates a block there, already connected** — the difference
between mapping a branch in one gesture and four.

**Entry point**: a new draft type `visual-novel` (format `game`) and a method
entry, *Visual Novel Branch Map*, seeding a working shape rather than a blank
page:

```
Prologue → [decision] → Route A ↘
                     → Route B ↗ Converge → Ending
```

Four blocks and one flag, showing convergence immediately — the thing writers
forget to draft and later regret.

## Phasing

| Phase | Delivers | Usable on its own? |
|---|---|---|
| **1** | Flags, block model, adapter, exporter flag rewrite | Pure logic + tests. No UI. |
| **2** | Block widget, flags panel, targets via **dropdown** | **Yes — a working branch editor** |
| **3** | Edge layer, drag-to-connect | The visual map |

Phase 2 is deliberately usable without Phase 3. If the edge layer slips, the
tool still works; it just has dropdowns instead of curves.

## Testing

Ren'Py still cannot be run here — there is no SDK on this machine — so the
tests remain the only safety net.

**`vnFlags.test.ts`**

- Every row of the emission table above
- `default` lines for both kinds, including a non-zero initial
- Flag names that are not identifiers (`met bob`) still emit safely
- An effect referencing a deleted flag is dropped, not emitted as `undefined`

**`vnBlocks.test.ts`**

- Choices land on the block's last scene
- A target block resolves to its first scene
- A block with no scenes is skipped, and inbound choices re-point past it
- A single-scene block (last scene is also first)
- A block with no choices falls through to the next block
- Scene `order` is renumbered contiguously across blocks
- A convergent map: two blocks whose choices target the same third block

**`renpyExport.test.ts`** — extended, not rewritten: counter `default`, `+=`,
and `>=` emission, plus a golden test for a two-route story with a counter gate.

## Risks

- **The flag refactor touches green code.** `setsFlag`/`requiresFlag` are
  replaced, so the exporter's flag emission and its tests change. Contained to
  one area, but it is the only place this disturbs something already passing.
- **`Document` is shared by all five work types.** `choices` is additive and
  ignored elsewhere, but a shared table now carries visual-novel-specific data.
- **Coordinate math (Phase 3).** Drag-to-connect on a pan/zoom canvas is the
  classic source of "the line lands 40px off". Isolated to the edge layer.

## Rejected Alternatives

**Making this a data-only writing method.** The registry lays static prompt
cards; it cannot express connections between them. The existing *Interactive
Fiction Map* method already has the right topics — Branch Nodes, State
Variables, Convergence Points — as prompts, and the gap between that and a real
branch map is exactly what this feature is.

**Rewriting the exporter to treat a block as a label.** Cleaner on paper: one
`label` per block, scenes concatenated inside. But the fall-through rule already
chains scenes for free, so the adapter buys the same result without touching a
tested generator. Revisit only if per-block labels become necessary for their
own sake.

**Storing edges.** Connections are a projection of `choices`; storing them would
create a second source of truth that can disagree with the first.
