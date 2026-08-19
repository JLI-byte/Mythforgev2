# Visual Novel Work Type — Design Spec

**Date:** 2026-08-18
**Status:** Approved for v1
**Author:** brainstormed with Claude

## Summary

Add a fifth work type, **Visual Novel**, for choice-driven branching stories,
and an exporter that turns a project into a single `.rpy` file that drops into
an existing Ren'Py game's `game/` folder.

The writing experience is a **linked scene list**: scenes stay an ordered list
as they are today, and each scene carries the choices that lead out of it.
That model maps one-to-one onto Ren'Py — a scene is a `label`, its choices are
a `menu`, and a choice's target is a `jump` — so the exporter is a pure
serializer with no invented semantics to translate.

v1 is export-only and browser-only. No Ren'Py SDK is required to use
LoreCanvas, and none is assumed to be installed.

## Goals

- A `visual-novel` work type that opens its own writing zone.
- Scenes that carry outgoing **choices**, each pointing at another scene.
- **Simple flags**: a choice can set a named flag, and a choice can require one
  to be visible.
- Dialogue written as `Name: line`, with unmatched lines treated as narration.
- Character definitions generated from the World Bible.
- A one-click export producing a valid, paste-able `.rpy` file.
- Pre-export **validation** for broken jumps, unreachable scenes, dead ends,
  and unsatisfiable flags.

## Non-Goals (v1)

Each of these is a real feature, deliberately deferred.

- **Assets.** No `scene bg`, `show sprite`, or `play music`, and no asset
  pipeline. Backgrounds and sprites are added by hand in Ren'Py.
- **Numeric state.** Flags only — no affection counters, arithmetic, or
  comparisons.
- **Re-import.** One direction only. No Ren'Py parser.
- **Full project generation.** LoreCanvas does not produce a runnable Ren'Py
  project, ship a `screens.rpy`/`gui.rpy` template, or launch the SDK. See
  *Rejected Alternatives*.
- **Graph / map view.** The linked list is the editor. A generated map is the
  obvious v2.
- **`call` / `return` and local labels.** Plain `jump` only.

## Background: how Ren'Py works

Confirmed against the official documentation (`renpy.org/doc`), not from
memory. The parts that constrain this design:

- A script is a set of **labels** wired together by **jumps**. `label name:`
  opens a block; `jump name` transfers control and does not return.
- A `menu:` block presents choices. Each choice is a string followed by a
  colon and an indented body, which conventionally ends in a `jump`.
- Choices can be conditional: `"Fly above." if drank_tea:`.
- State is plain variables. `default drank_tea = False` declares one;
  `$ drank_tea = True` sets it. The docs recommend `default` for every
  variable that changes, so values from an old save cannot leak into a new game.
- Every dialogue line is `character "text"`, so speakers must be declared up
  front with `define s = Character("Sylvie")`.
- **Ren'Py auto-loads every `.rpy` file under `game/`.** This is what makes the
  integration seamless: the export is an additive file that sits alongside the
  user's own `options.rpy`, `screens.rpy`, and GUI. Nothing is overwritten.

## Existing Architecture Being Reused

- **`src/lib/export.ts`** — already serialises projects to Markdown and DOCX,
  already owns the Blob download bridge and filename slugify, and already
  separates pure content-building (`buildMarkdownContent`) from
  download-triggering (`exportAsMarkdown`). The Ren'Py export follows that
  split rather than introducing a second download path.
- **`src/lib/worldKey.ts`** — `worldKeyForProject` / `worldKeyForEntity` give
  the shelf a project and its cast share.
- **`src/lib/workTypes.ts`** — `WORK_TYPES` already pins each type to a
  `writingMode`, and `getWorkTypeByWritingMode` recovers the type from a
  project. Adding an entry plus a new mode is the whole change.
- **`WritingZoneRenderer.tsx`** — dispatches work type id → zone via the
  `ZONES` record. The zones are deliberate clones under `zones/`, each free to
  diverge. The visual novel zone is the fifth sibling.
- **`Scene`** (`src/store/workspaceStore.ts`) already has `id`, `title`,
  `content`, and `order`. It gains one optional field.
- **Persistence needs no migration.** The Supabase schema stores the entire
  workspace as a single `jsonb` blob (`workspaces.data`), so adding fields to
  `Scene` requires no schema change and no backfill.

## Data Model

New leaf module `src/lib/visualNovel.ts` (no store, no React), matching the
convention used by `workTypes.ts` and `workSubTypes.ts`.

```ts
export interface VNChoice {
    id: string;
    /** What the player sees. */
    text: string;
    /** Scene this jumps to. */
    targetSceneId: string;
    /** Flag set when this choice is taken. */
    setsFlag?: string;
    /** Choice is only shown when this flag is set. */
    requiresFlag?: string;
}
```

`Scene` gains `choices?: VNChoice[]`. The field is only populated for visual
novel projects; every other work type ignores it.

The new work type entry:

```ts
{
    id: 'visual-novel',
    label: 'Visual Novel',
    icon: '🎮',
    desc: 'Choice-driven branching stories',
    writingMode: 'visual-novel',
    namePlaceholder: 'e.g. The Lighthouse Summer',
}
```

`WritingMode` and `Project['writingMode']` both gain `'visual-novel'`.

## The Mapping

| LoreCanvas | Ren'Py |
|---|---|
| Scene | `label meadow:` |
| `Sylvie: Hey...` | `s "Hey..."` |
| line with no `Name:` prefix | `"..."` narration |
| scene's choices | `menu:` |
| choice → target | `jump partners` |
| `setsFlag` | `$ agreed = True` |
| `requiresFlag` | `"text" if agreed:` |
| every flag used anywhere | `default agreed = False` |
| World Bible character | `define s = Character("Sylvie")` |

### Worked example

A scene titled *The Meadow* with this content:

```
The meadow is gold this time of year.

Sylvie: Hey... umm...
Me: Yeah?
Sylvie: Will you be my artist for a visual novel?
```

and two choices — *Say yes.* → **Partners**, setting `agreed`; and
*Ask what that means.* → **Explain** — exports as:

```renpy
label the_meadow:
    "The meadow is gold this time of year."
    s "Hey... umm..."
    m "Yeah?"
    s "Will you be my artist for a visual novel?"

    menu:
        "Say yes.":
            $ agreed = True
            jump partners

        "Ask what that means.":
            jump explain
```

## Export

`src/lib/renpyExport.ts` is a **pure function** — scenes in, string out. No
store access, no DOM. That keeps it trivially unit-testable and is where
virtually all the correctness risk lives.

### File shape

```renpy
# Generated by LoreCanvas — <project name>
# Drop this file into your Ren'Py project's game/ folder.

define s = Character("Sylvie")
define m = Character("Me")

default agreed = False

label start:
    jump the_meadow

label the_meadow:
    ...
```

### Label naming

Scene titles become label names, **derived at export time** rather than stored,
so there is a single source of truth and renaming a scene renames its label.

**The existing `slugify` in `src/lib/export.ts` must not be used here.** It
emits hyphens (`the-meadow`), which are invalid in a Ren'Py label — labels are
Python-style identifiers. `renpyExport.ts` needs its own `toLabel()`. The
existing `slugify` is still the right tool for the download **filename**.

- Lowercase; non-alphanumeric runs collapse to a single `_`.
- Leading digits are prefixed, since a label cannot start with a number.
- Collisions get a numeric suffix (`the_meadow_2`).
- Ren'Py keywords (`start`, `menu`, `label`, `jump`, `return`, `init`,
  `python`, `define`, `default`, `scene`, `show`, `hide`, `call`, `pause`,
  `while`, `if`) are prefixed so they cannot collide with the language.

### Entry point

The first scene by `order` is reached indirectly:

```renpy
label start:
    jump the_meadow
```

The indirection means reordering scenes never breaks the entry point.

### Scenes without choices

Ren'Py falls through to the next statement when a label block does not end in
`jump` or `return`, but relying on textual adjacency is fragile — reordering
scenes would silently rewire the story. The exporter is therefore explicit:

- A scene with no choices emits `jump <next scene by order>` as its last line.
- The **last** scene, if it has no choices, emits `return` to end the game.

This makes every edge in the exported script deliberate, and means the
*dead end* validation only fires where a scene genuinely has nowhere to go.

**Order is the story's spine.** A scene that ends a branch must be ordered
last, or fall-through will run it straight into an unrelated branch's opening.
This is a real authoring hazard, and the reason the *dead end* and
*unreachable* warnings exist — between them they catch a misplaced ending.

An earlier draft tried to avoid the hazard by treating `choices: undefined`
(fall through) as different from `choices: []` (explicit ending). That was
rejected: it makes an invisible distinction load-bearing, which the editor
would have to preserve exactly, and clearing the last choice in the UI would
silently change where the story goes. One rule, `choices ?? []`, is safer.

### Dialogue parsing

For each line of scene content:

1. If it matches `^\s*([^:]{1,40}):\s(.+)$` and the name resolves to a known
   speaker, emit `<alias> "<escaped rest>"`.
2. Otherwise emit `"<escaped line>"` as narration.
3. Blank lines are preserved as blank lines.

A name that is typed but not in the World Bible still gets a character
definition, so a speaker is never silently demoted to narration.

### Escaping

Three rules, all mandatory. Each has a golden test.

| Character | Emitted as | Why |
|---|---|---|
| `"` | `\"` | Ends the Ren'Py string |
| `[` | `[[` | Variable interpolation |
| `{` | `{{` | Text tag |

Without these, a line such as `She said "no" [again]` produces a file that
fails to compile.

### Character aliases

Characters are **scoped to the shelf, not the project** — entities carry a
`worldId`, and a project shares its shelf's cast. The selector is the one
already used by `CharacterStateRenderer.tsx` and `RelationshipMapRenderer.tsx`:

```ts
entities.filter(
    e => worldKeyForEntity(e) === worldKeyForProject(project)
        && e.type === 'character'
)
```

`worldKeyForEntity` and `worldKeyForProject` come from `src/lib/worldKey.ts`;
`Entity.name` is the display name. Names typed in scene text that match no
entity are added to the cast, so a speaker is never silently demoted to
narration.

Each speaker gets a short alias derived from its initials, deduped with a
numeric suffix, emitted as `define <alias> = Character("<name>")`.

### Delivery

**Reuse the existing export infrastructure** rather than building a second
download path. `src/lib/export.ts` already owns the Blob bridge
(`downloadFile`) and the filename `slugify`, and already separates pure
content-building from download-triggering — `buildMarkdownContent` versus
`exportAsMarkdown`. This feature follows the same split:

- `buildRenpyScript(scenes, characters, projectName): string` — pure, lives in
  `renpyExport.ts`, and is what the tests exercise.
- `exportAsRenpy(...)` — lives in `export.ts` beside `exportAsMarkdown` and
  `exportWorldBible`, calls `buildRenpyScript`, then `downloadFile(script,
  `${slugify(name)}.rpy`, 'text/plain')`.

`downloadFile` is currently module-private; `exportAsRenpy` living in the same
file means it stays private and no new export surface is created.

No filesystem access and no Electron work — this works in the browser build as
it exists today.

## Validation

Run before export; results are shown as **warnings, not blockers**, so a work
in progress can always be exported.

| Check | Meaning |
|---|---|
| Broken jump | A choice targets a scene that no longer exists |
| Unreachable | No choice anywhere targets this scene, and it is not the first |
| Dead end | A scene has no choices and no following scene by order |
| Unsatisfiable flag | A choice requires a flag that no choice ever sets |

This is the part a plain text editor cannot do, and it is a meaningful reason
to write a branching story here rather than directly in Ren'Py.

## Authoring UI

`zones/VisualNovelWritingZone.tsx` begins as a clone of `StoryWritingZone` —
binder left, editor centre — and diverges in one place: a **choices strip**
beneath the editor listing the current scene's outgoing choices.

Each choice row has four controls:

- The text the player sees
- A target-scene dropdown
- Optional *sets flag*
- Optional *requires flag*

Export and validation warnings live in the same strip.

## Files

**New**

- `src/lib/visualNovel.ts` — types, flag helpers, validation
- `src/lib/visualNovel.test.ts`
- `src/lib/renpyExport.ts` — `buildRenpyScript`, pure
- `src/lib/renpyExport.test.ts`
- `src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx`

**Modified**

- `src/lib/workTypes.ts` — new entry, `WritingMode` gains `'visual-novel'`
- `src/store/workspaceStore.ts` — `Project['writingMode']` union,
  `Scene.choices`
- `src/lib/export.ts` — add `exportAsRenpy` beside the existing exporters
- `src/components/editor/desk/widgets/WritingZoneRenderer.tsx` — register zone
- `src/components/editor/desk/widgets/WritingZoneRenderer.test.ts` — assert
  `visual-novel` dispatches to the new zone

## Testing

Vitest, matching the style of `workTypes.test.ts`.

**`renpyExport.test.ts`** carries the weight:

- Dialogue parsing — `Name:` lines versus narration
- All three escaping rules, including a combined case
- Menu generation with and without flags
- `default` emission for every flag used
- `toLabel` — underscores not hyphens, dedupe, leading digits, keyword
  collision. A regression test asserts no label contains `-`, since reaching
  for the existing `slugify` is the obvious mistake here.
- `label start:` indirection
- Fall-through: a choiceless scene emits `jump <next>`, and a choiceless final
  scene emits `return`
- A golden test asserting complete, paste-able output for a small two-branch
  story that converges

**`visualNovel.test.ts`** covers the four validation rules, including a
convergent graph (two choices, one destination) to confirm convergence is not
misreported as an error.

## Risks

**The output cannot be run.** No Ren'Py SDK is installed, so correctness rests
on the tests matching the documented syntax rather than on a game launching.

Mitigations: the syntax in this spec was taken from the official documentation
rather than recalled; the exporter is a pure function; and the golden test
contains a complete `.rpy` file that can be pasted into a Ren'Py project
verbatim. Installing the free SDK later validates the whole feature in minutes.

## Rejected Alternatives

**Generating a full playable Ren'Py project.** Technically possible, but it
means shipping a frozen copy of `screens.rpy` (~1500 lines) and `gui.rpy`
(~400 lines) plus roughly 40 GUI PNGs — all of which Ren'Py regenerates on
every release. LoreCanvas would inherit permanent maintenance of a template it
did not write and could not test across versions. Ren'Py's own
**Template Projects** feature (a `project.json` containing
`{ "type": "template" }`) is the correct route if this is ever wanted: the
user's SDK generates a version-matched project and LoreCanvas fills in the
story. Deferred, not discarded.

**Node-graph authoring.** A pan/zoom canvas with drag-and-drop nodes shows
branch structure better, but it is a large build and writing prose inside a
small node is awkward. The linked list ships first; a generated read-only map
is the natural v2.

**Nested outline authoring.** Rejected outright: visual novels converge — the
official Ren'Py sample has two branches both ending in `jump marry` — and a
tree cannot express two paths rejoining without duplicating everything
downstream.
