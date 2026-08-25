# Visual Novel Season Timeline — Design Spec

**Date:** 2026-08-19
**Status:** Approved — supersedes the branch-map drafting surface
**Author:** brainstormed with Claude

## Summary

Rework visual novel drafting from a free-floating branch map into a **nested
timeline**: Story contains Seasons, Seasons contain Episodes, Episodes contain
Decisions. Boxes within boxes, read top to bottom, matching how episodic visual
novels are actually released.

Everything lives on one screen. Clicking a season or episode **frames** it —
the canvas zooms and pans so that box fills the view — and blocks redraw at the
level of detail that zoom deserves. Layout itself changes with focus:
horizontal for scanning, vertical for working.

This **replaces** the branch-map canvas built in the previous cycle. The flag
system and the Ren'Py generator's core survive intact.

## Goals

- Four nested levels: Story → Season → Episode → Decision.
- Start by choosing a number of seasons, break those into episodes, then place
  decisions inside episodes.
- **Major** decisions (change the story's direction) and **minor** decisions
  (set flags, colour a scene). Unlimited of both per episode.
- Click-to-focus with smart framing. No modals, no second window, no manual
  zooming in and out.
- Level-of-detail rendering: previews when zoomed out, full editors when in.
- Branches **rejoin within their episode by default**, with cross-episode
  routes available as an explicit escape hatch.
- Export to Ren'Py, unchanged in quality from what exists.

## Non-Goals

- Migrating existing `Document.choices` data. See *Replacing the branch map*.
- Auto-layout beyond the deterministic nesting described here.
- Reordering seasons or episodes by drag. Order is a field; a control for
  changing it can come later.
- More than one effect per option. The model holds `effects[]`; the editor
  exposes one, as today.

## Decisions Taken

1. **Rejoin within the episode by default, cross-episode routes when wanted.**
   An option with no `routeToEpisodeId` rejoins and carries on. Rejected:
   forcing every branch to route, which multiplies episodes per route and is
   how episodic projects stop shipping.
2. **Major and minor are distinguished by whether they can route.** Minor
   decisions never get a route control. Rejected: a purely cosmetic label,
   which would leave the distinction unenforced and therefore meaningless.
3. **Episodes flow horizontally when scanning, vertically when focused.**
   Rejected: a strict single column at all times — ten seasons of twelve
   episodes becomes a 120-box thread one box wide, useless zoomed out.
4. **Layout is computed, never stored.** Rejected: storing x/y per box, which
   is what the branch map did and what let the map drift from the story.

## Existing Architecture Being Reused

- **`Project → Document → Scene`.** A `Document` becomes an **Episode**.
  Scenes inside it are unchanged — they remain the Writing Desk's concern.
- **`src/lib/vnFlags.ts`** — `VNFlag`, `VNEffect`, `VNCondition` and the three
  Ren'Py formatters. Untouched.
- **`src/lib/renpyExport.ts`** — `toIdentifier`, `toFlagName`, `buildLabelMap`,
  `escapeRenpyText`, `parseDialogueLine`, `buildAliasMap`, and flag emission,
  all covered by 40 tests. The assembler changes; none of these do.
- **The canvas's pan and zoom** (`WritingDesk.tsx:636`). Widgets sit inside one
  transformed div, so anything drawn there shares their coordinate space.
  Focus-framing is the existing fit-to-content maths scoped to one box.
- **`VNFlagsRenderer`** — the flag registry panel, unchanged.

## Data Model

### Seasons

New, on the project:

```ts
export interface VNSeason {
    id: string;
    title: string;
    order: number;
}
// Project gains: seasons?: VNSeason[]
```

### Episodes

`Document` gains three fields:

```ts
/** Visual novel projects only: the season this episode belongs to. */
seasonId?: string;
/** Position within its season. */
order?: number;
/** The decisions the player makes during this episode, in order. */
decisions?: VNDecision[];
```

`choices?: VNBlockChoice[]` is **removed**.

### Decisions and options

```ts
export interface VNDecision {
    id: string;
    /** Major decisions may route to another episode; minor ones never can. */
    kind: 'major' | 'minor';
    /** What the player is deciding. */
    prompt: string;
    order: number;
    options: VNOption[];
}

export interface VNOption {
    id: string;
    text: string;
    effects?: VNEffect[];
    condition?: VNCondition;
    /**
     * Cross-episode route. Undefined means rejoin and carry on, which is the
     * default and the common case. Only ever set on a major decision.
     */
    routeToEpisodeId?: string;
}
```

**`routeToEpisodeId` being optional is the whole rejoin rule.** The common case
requires no input, and a line on the map only ever appears where a writer
deliberately left the normal path.

## Layout

A pure function, in `src/lib/vnTimeline.ts`:

```ts
export type VNBoxKind = 'story' | 'season' | 'episode' | 'decision';

export interface VNBox {
    id: string;
    kind: VNBoxKind;
    parentId?: string;
    title: string;
    /** Rendered small, as a title bar only. */
    collapsed: boolean;
    x: number; y: number; width: number; height: number;
}

export interface VNFocus {
    kind: 'season' | 'episode';
    id: string;
}

/**
 * The slice of a Document the layout needs. Declared structurally so
 * vnTimeline stays a leaf module the store can import, never the reverse.
 */
export interface VNEpisode {
    id: string;
    title: string;
    seasonId?: string;
    order: number;
    decisions?: VNDecision[];
}

export function layoutTimeline(
    seasons: VNSeason[],
    episodes: VNEpisode[],
    focus?: VNFocus,
): VNBox[];
```

Decisions arrive on their episodes rather than as a fourth argument — the
function needs them both to size an episode box and to emit `decision` boxes
inside a focused one.

**Episodes with no `seasonId`** belong to an implicit season rendered first and
titled "Unsorted". Nothing is ever invisible because it was created before
seasons existed, or because its season was deleted.

Positions are derived every render. Nothing about geometry is persisted, so the
map cannot disagree with the story.

### Focus changes the geometry

| Focus | Seasons | Episodes |
|---|---|---|
| none | all expanded, stacked vertically | flow left-to-right, wrapping |
| a season | that one expanded, siblings collapsed to a bar | stacked vertically, full width |
| an episode | its season expanded, other seasons collapsed | that one expanded, siblings collapsed to a bar |

Horizontal flow is for comparing seasons at a glance. Vertical is for working
inside one, where width buys legibility.

## Getting Started

A visual novel project's Draft Table opens on a setup step: **how many seasons,
and how many episodes each?** Answering it creates the seasons and the episodes
in one go, and the writer lands on a populated timeline rather than a blank
canvas.

Both numbers stay editable afterwards — a season can be added, and an episode
appended to any season — so the setup is a head start, not a commitment.

## Level of Detail

The canvas zoom already runs 0.2 to 2.0. Each box receives a `tier` derived
from the current zoom and renders accordingly:

| Zoom | Tier | A box shows |
|---|---|---|
| 0.20–0.35 | `story` | Season bars, episode counts |
| 0.35–0.65 | `season` | Episode cards with `◆2 ◇1` decision counts |
| 0.65–1.10 | `episode` | Each decision: prompt, destination, flag chips |
| 1.10–2.00 | `decision` | Full editors — options, effects, conditions, routes |

One `tier` prop, one set of boxes. No separate views to keep in sync.

## Focus Framing

Clicking a season or episode computes the zoom that fits its box in the
viewport with padding, clamps it to the canvas range, centres it, and animates
the transform. Crossing a tier threshold flips the detail level automatically,
so focusing an episode lands the writer in episode detail without touching a
zoom control.

Escape, or clicking the parent frame, steps focus back out one level.

## Export

An episode becomes a label named from its season and episode numbers plus its
title: `label s1e2_the_bar:`.

Decisions emit in order:

- A **minor** decision, and any **rejoining** option, emits no jump. Ren'Py
  continues past a menu once an option's block completes, so rejoining is the
  language's own default and costs nothing.
- A **cross-episode route** emits `jump <target episode label>`.
- Each episode ends with an implicit `jump` to the next episode by order, or
  `return` if it is the last.

```renpy
label s1e2_the_bar:
    menu:
        "Order a drink":
            $ bold = True
        "Say nothing":
            pass

    menu:
        "Ask her name":
            $ mara_trust += 1
            jump s1e4_night_walk
        "Keep quiet":
            pass

    jump s1e3_morning
```

An option whose block would otherwise be empty emits `pass`, because Ren'Py
requires a non-empty block.

## Replacing the Branch Map

Deleted: the `vnBlock` widget and its renderer, drag-to-connect,
`flattenBlocksToScenes`, `VNBlockChoice`, and `Document.choices`.

Kept in reduced form: `VNEdgeLayer`, drawing **only** cross-episode routes.
Local flow is implied by position, so a line now always means "this leaves the
normal path" — a far better signal than the previous map, where every
connection was a line and none stood out.

**No data migration.** `Document.choices` is days old with one throwaway
project's use. The field is removed outright; any existing value is ignored and
dropped on the next write.

## Testing

The previous cycle shipped 306 passing tests alongside a component that crashed
the workspace on first click. The lesson shapes this plan:

- **`layoutTimeline` is pure and carries the hard logic** — nesting, wrapping,
  collapse, both focus modes, box containment. Tested directly, no browser.
- **Tier selection is a pure function of zoom.** Tested at every boundary.
- **A golden export test** takes two seasons with major, minor and
  cross-route decisions through to a complete `.rpy`.
- **Browser verification is a required step, not a nicety.** Every bug that
  mattered last time — a `useShallow` render loop, an effect that re-fired, a
  default target pointing off-map, a stale closure — was invisible to the test
  suite and obvious within a minute of clicking.

Specifically, on any new store selector: **never build objects inside a
`useShallow` selector.** `useShallow` compares elements with `Object.is`, so a
`.map(d => ({ ... }))` inside one makes every snapshot look changed and spins an
infinite render loop. Select stored objects; reshape after.

## Risks

- **Scope.** This replaces most of two phases of recent work. Accepted
  deliberately; the pieces worth keeping are named above.
- **Focus animation and tier flipping interact.** Crossing a threshold mid-tween
  could flicker between detail levels. Tier should be derived from the
  animation's *target* zoom, not its instantaneous value.
- **Collapsed siblings must stay clickable.** A collapsed season is the only way
  back to it, so its bar needs to remain a hit target at every tier.
