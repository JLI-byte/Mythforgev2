# VN Season Timeline — Phase A: model, layout and export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the season/episode/decision model, the pure layout function that positions every box, and the Ren'Py assembler that walks the new structure. No UI.

**Architecture:** Everything here is a leaf module — data in, data out, no store and no React. `layoutTimeline` computes geometry from structure and focus so nothing about position is ever stored. The Ren'Py generator's primitives (labels, escaping, dialogue, aliases, flags) are untouched; only the assembler that walks the structure is new.

**Tech Stack:** TypeScript, Vitest (jsdom), Zustand 5.

**Spec:** `docs/superpowers/specs/2026-08-19-vn-season-timeline-design.md`

---

## Context you need before starting

**What this replaces.** A previous cycle built a free-floating "branch map" of `vnBlock` widgets connected by curves. It is being replaced by a nested timeline. **Phase A does not delete any of it** — the old code keeps working while the new model is built beside it. Deletion happens in Phase B, once there is something to switch to. Do not remove anything.

**What already exists and must not be reimplemented:**

| Thing | Where | Shape |
|---|---|---|
| `VNFlag` | `src/lib/vnFlags.ts` | `{ id, name, kind: 'bool'\|'counter', initial }` |
| `VNEffect` | `src/lib/vnFlags.ts` | `{ flagId, op: 'set'\|'clear'\|'add', value? }` |
| `VNCondition` | `src/lib/vnFlags.ts` | `{ flagId, op: 'is'\|'not'\|'atLeast'\|'atMost', value? }` |
| `formatDefault` / `formatEffect` / `formatCondition` | `src/lib/vnFlags.ts` | pure Ren'Py fragment builders |
| `toIdentifier` / `toFlagName` | `src/lib/renpyExport.ts` | slugify to a Python identifier |
| `escapeRenpyText` | `src/lib/renpyExport.ts` | escapes `\`, `"`, `[`, `{` |

**Ren'Py facts this phase depends on:**

- Indentation is significant. 4 spaces per level: statements in a label at 4, `menu:` at 4, option strings at 8, option bodies at 12.
- **After an option's block finishes, execution continues past the menu.** This is why "rejoin within the episode" needs no `jump` — it is the language's own default. It is the single most important fact in this plan.
- An option block cannot be empty. An option that does nothing emits `pass`.
- `default x = 0` declares state, `$ x += 1` mutates it, `"Choice" if expr:` guards an option.
- Labels are Python identifiers — no spaces, no hyphens, cannot lead with a digit.

**You cannot run the generated output.** There is no Ren'Py SDK on this machine. Four bugs already reached this codebase in this area, every one invisible to the test suite. Do not weaken a test because it looks fussy.

**Run tests with:** `npm test`. **Baseline: 306 tests across 36 files, `npx tsc --noEmit` exits 0.**

---

## File Structure

**New**

| File | Responsibility |
|---|---|
| `src/lib/vnTimeline.ts` | Season/episode/decision types, `tierForZoom`, `layoutTimeline`. |
| `src/lib/vnTimeline.test.ts` | Tier boundaries and every layout mode. |
| `src/lib/vnTimelineExport.ts` | `buildTimelineScript` — the assembler over seasons and episodes. |
| `src/lib/vnTimelineExport.test.ts` | Emission rules plus a golden two-season script. |

**Modified**

| File | Change |
|---|---|
| `src/store/workspaceStore.ts` | `Project.seasons`, and `Document.seasonId` / `order` / `decisions`. Nothing removed. |

---

### Task 1: Types and the zoom tier

**Files:**
- Create: `src/lib/vnTimeline.ts`
- Create: `src/lib/vnTimeline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/vnTimeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tierForZoom } from './vnTimeline';

describe('tierForZoom', () => {
    it('shows the whole story when zoomed right out', () => {
        expect(tierForZoom(0.2)).toBe('story');
        expect(tierForZoom(0.34)).toBe('story');
    });

    it('shows seasons in the next band', () => {
        expect(tierForZoom(0.35)).toBe('season');
        expect(tierForZoom(0.64)).toBe('season');
    });

    it('shows episode detail in the next band', () => {
        expect(tierForZoom(0.65)).toBe('episode');
        expect(tierForZoom(1.09)).toBe('episode');
    });

    it('shows full decision editors when zoomed in', () => {
        expect(tierForZoom(1.1)).toBe('decision');
        expect(tierForZoom(2)).toBe('decision');
    });

    it('clamps below and above the canvas range rather than returning undefined', () => {
        expect(tierForZoom(0)).toBe('story');
        expect(tierForZoom(99)).toBe('decision');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/vnTimeline.test.ts`
Expected: FAIL — cannot resolve `./vnTimeline`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/vnTimeline.ts`:

```ts
/**
 * The visual novel timeline's shape and geometry — Story containing Seasons
 * containing Episodes containing Decisions. LEAF MODULE (no store, no React).
 *
 * Layout is computed from the structure on every render and never stored, so
 * the map cannot drift from the story. Focus changes the geometry rather than
 * only the styling: episodes flow left-to-right while scanning, and stack
 * vertically at full width once a season is focused, which is where writing
 * room is wanted.
 */

import type { VNEffect, VNCondition } from './vnFlags';

export interface VNSeason {
    id: string;
    title: string;
    order: number;
}

/** One branch of a decision. */
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

export interface VNDecision {
    id: string;
    /** Major decisions may route to another episode; minor ones never can. */
    kind: 'major' | 'minor';
    /** What the player is deciding. */
    prompt: string;
    order: number;
    options: VNOption[];
}

/**
 * The slice of a Document the timeline needs. Declared structurally so this
 * stays a leaf the store can import, never the reverse.
 */
export interface VNEpisode {
    id: string;
    title: string;
    seasonId?: string;
    order: number;
    decisions?: VNDecision[];
}

export type VNTier = 'story' | 'season' | 'episode' | 'decision';

/**
 * How much detail a box should draw, from the canvas zoom. The canvas runs
 * 0.2 to 2.0; values outside that clamp rather than falling through.
 */
export function tierForZoom(zoom: number): VNTier {
    if (zoom < 0.35) return 'story';
    if (zoom < 0.65) return 'season';
    if (zoom < 1.1) return 'episode';
    return 'decision';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/vnTimeline.test.ts`
Expected: PASS — 5 tests.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/lib/vnTimeline.ts src/lib/vnTimeline.test.ts
git commit -m "feat: season timeline types and zoom tiers"
```

---

### Task 2: Laying out the timeline

This is the heart of the feature. Every box's position comes from here, so it carries the logic that a component would otherwise hide.

**Files:**
- Modify: `src/lib/vnTimeline.ts`
- Modify: `src/lib/vnTimeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add `layoutTimeline`, `UNSORTED_SEASON_ID`, and the types to the import in `src/lib/vnTimeline.test.ts`, then APPEND:

```ts
import type { VNSeason, VNEpisode, VNBox } from './vnTimeline';

const season = (id: string, order: number): VNSeason =>
    ({ id, title: id, order });

const episode = (id: string, seasonId: string | undefined, order: number, decisions = 0): VNEpisode => ({
    id, title: id, seasonId, order,
    decisions: Array.from({ length: decisions }, (_, i) => ({
        id: `${id}-d${i}`, kind: 'minor' as const, prompt: `d${i}`, order: i, options: [],
    })),
});

const byId = (boxes: VNBox[], id: string) => boxes.find(b => b.id === id);
const kinds = (boxes: VNBox[], kind: string) => boxes.filter(b => b.kind === kind);

describe('layoutTimeline', () => {
    it('wraps everything in one story box', () => {
        const boxes = layoutTimeline([season('s1', 0)], [episode('e1', 's1', 0)]);
        const story = kinds(boxes, 'story');
        expect(story).toHaveLength(1);
        expect(story[0].x).toBe(0);
        expect(story[0].y).toBe(0);
    });

    it('orders seasons by their order field, not array position', () => {
        const boxes = layoutTimeline(
            [season('late', 5), season('early', 1)],
            [],
        );
        const seasons = kinds(boxes, 'season');
        expect(seasons.map(b => b.id)).toEqual(['early', 'late']);
        expect(seasons[0].y).toBeLessThan(seasons[1].y);
    });

    it('puts a parent before its children so a parent cannot paint over them', () => {
        const boxes = layoutTimeline([season('s1', 0)], [episode('e1', 's1', 0)]);
        expect(boxes.findIndex(b => b.id === 's1'))
            .toBeLessThan(boxes.findIndex(b => b.id === 'e1'));
    });

    it('flows episodes left to right while scanning', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('e1', 's1', 0), episode('e2', 's1', 1)],
        );
        expect(byId(boxes, 'e2')!.x).toBeGreaterThan(byId(boxes, 'e1')!.x);
        expect(byId(boxes, 'e2')!.y).toBe(byId(boxes, 'e1')!.y);
    });

    it('wraps to a second row when a season has many episodes', () => {
        const eps = Array.from({ length: 12 }, (_, i) => episode(`e${i}`, 's1', i));
        const boxes = layoutTimeline([season('s1', 0)], eps);
        const rows = new Set(kinds(boxes, 'episode').map(b => b.y));
        expect(rows.size).toBeGreaterThan(1);
    });

    it('stacks episodes vertically once a season is focused', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('e1', 's1', 0), episode('e2', 's1', 1)],
            { kind: 'season', id: 's1' },
        );
        expect(byId(boxes, 'e2')!.y).toBeGreaterThan(byId(boxes, 'e1')!.y);
        expect(byId(boxes, 'e2')!.x).toBe(byId(boxes, 'e1')!.x);
    });

    it('gives a focused season wider episodes than a scanned one', () => {
        const scan = layoutTimeline([season('s1', 0)], [episode('e1', 's1', 0)]);
        const focused = layoutTimeline([season('s1', 0)], [episode('e1', 's1', 0)],
            { kind: 'season', id: 's1' });
        expect(byId(focused, 'e1')!.width).toBeGreaterThan(byId(scan, 'e1')!.width);
    });

    it('collapses the seasons that are not focused', () => {
        const boxes = layoutTimeline(
            [season('s1', 0), season('s2', 1)],
            [episode('e1', 's1', 0), episode('e2', 's2', 0)],
            { kind: 'season', id: 's1' },
        );
        expect(byId(boxes, 's1')!.collapsed).toBe(false);
        expect(byId(boxes, 's2')!.collapsed).toBe(true);
        expect(byId(boxes, 's2')!.height).toBeLessThan(byId(boxes, 's1')!.height);
    });

    it('draws no episodes inside a collapsed season', () => {
        const boxes = layoutTimeline(
            [season('s1', 0), season('s2', 1)],
            [episode('e1', 's1', 0), episode('e2', 's2', 0)],
            { kind: 'season', id: 's1' },
        );
        expect(byId(boxes, 'e2')).toBeUndefined();
    });

    it('expands only the focused episode and collapses its siblings', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('e1', 's1', 0, 3), episode('e2', 's1', 1, 3)],
            { kind: 'episode', id: 'e1' },
        );
        expect(byId(boxes, 'e1')!.collapsed).toBe(false);
        expect(byId(boxes, 'e2')!.collapsed).toBe(true);
        expect(byId(boxes, 'e1')!.height).toBeGreaterThan(byId(boxes, 'e2')!.height);
    });

    it('emits decision boxes only for the focused episode', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('e1', 's1', 0, 2), episode('e2', 's1', 1, 2)],
            { kind: 'episode', id: 'e1' },
        );
        const decisions = kinds(boxes, 'decision');
        expect(decisions).toHaveLength(2);
        expect(decisions.every(d => d.parentId === 'e1')).toBe(true);
    });

    it('emits no decision boxes when nothing is focused', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)], [episode('e1', 's1', 0, 4)]);
        expect(kinds(boxes, 'decision')).toHaveLength(0);
    });

    it('focusing an episode expands the season holding it', () => {
        const boxes = layoutTimeline(
            [season('s1', 0), season('s2', 1)],
            [episode('e1', 's2', 0)],
            { kind: 'episode', id: 'e1' },
        );
        expect(byId(boxes, 's2')!.collapsed).toBe(false);
        expect(byId(boxes, 's1')!.collapsed).toBe(true);
    });

    it('gathers episodes with no season into an Unsorted lane, listed first', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('orphan', undefined, 0), episode('e1', 's1', 0)],
        );
        const unsorted = byId(boxes, UNSORTED_SEASON_ID);
        expect(unsorted).toBeDefined();
        expect(unsorted!.y).toBeLessThan(byId(boxes, 's1')!.y);
        expect(byId(boxes, 'orphan')!.parentId).toBe(UNSORTED_SEASON_ID);
    });

    it('treats an episode whose season was deleted as unsorted', () => {
        const boxes = layoutTimeline([season('s1', 0)], [episode('e1', 'gone', 0)]);
        expect(byId(boxes, 'e1')!.parentId).toBe(UNSORTED_SEASON_ID);
    });

    it('adds no Unsorted lane when every episode has a season', () => {
        const boxes = layoutTimeline([season('s1', 0)], [episode('e1', 's1', 0)]);
        expect(byId(boxes, UNSORTED_SEASON_ID)).toBeUndefined();
    });

    it('keeps every box inside its parent', () => {
        const boxes = layoutTimeline(
            [season('s1', 0)],
            [episode('e1', 's1', 0, 2)],
            { kind: 'episode', id: 'e1' },
        );
        for (const box of boxes) {
            if (!box.parentId) continue;
            const parent = byId(boxes, box.parentId)!;
            expect(box.x).toBeGreaterThanOrEqual(parent.x);
            expect(box.y).toBeGreaterThanOrEqual(parent.y);
            expect(box.x + box.width).toBeLessThanOrEqual(parent.x + parent.width);
        }
    });

    it('handles a project with no seasons and no episodes', () => {
        const boxes = layoutTimeline([], []);
        expect(kinds(boxes, 'story')).toHaveLength(1);
        expect(kinds(boxes, 'season')).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/vnTimeline.test.ts`
Expected: FAIL — `layoutTimeline` is not exported.

- [ ] **Step 3: Write the implementation**

APPEND to `src/lib/vnTimeline.ts`:

```ts
export type VNBoxKind = 'story' | 'season' | 'episode' | 'decision';

export interface VNBox {
    id: string;
    kind: VNBoxKind;
    parentId?: string;
    title: string;
    /** Drawn as a title bar only, with no contents. */
    collapsed: boolean;
    x: number; y: number; width: number; height: number;
}

export interface VNFocus {
    kind: 'season' | 'episode';
    id: string;
}

/** The lane episodes fall into with no season, or one that was deleted. */
export const UNSORTED_SEASON_ID = '__unsorted__';
/** The single outermost box. */
export const STORY_BOX_ID = '__story__';

const PAD = 24;
const SEASON_HEADER = 40;
const EPISODE_HEADER = 32;
const DECISION_H = 28;
const GAP = 16;
const SEASON_GAP = 28;
const COLLAPSED_H = 44;
const SEASON_W = 1160;
const EP_SCAN_W = 208;
const EP_SCAN_H = 116;
const EP_FOCUS_W = SEASON_W - PAD * 2;

function episodeHeight(episode: VNEpisode, expanded: boolean): number {
    if (!expanded) return COLLAPSED_H;
    return EPISODE_HEADER + (episode.decisions?.length ?? 0) * DECISION_H + PAD;
}

/**
 * Every box on the timeline, positioned. Parents are emitted before their
 * children so a parent drawn later cannot paint over them.
 *
 * With no focus, episodes wrap left-to-right so a season's shape reads at a
 * glance. With a focus, they stack vertically at full width — the same
 * structure, laid out for working rather than scanning.
 */
export function layoutTimeline(
    seasons: VNSeason[],
    episodes: VNEpisode[],
    focus?: VNFocus,
): VNBox[] {
    const known = new Set(seasons.map(s => s.id));
    const isUnsorted = (e: VNEpisode) => !e.seasonId || !known.has(e.seasonId);

    const lanes: VNSeason[] = [
        ...(episodes.some(isUnsorted)
            ? [{ id: UNSORTED_SEASON_ID, title: 'Unsorted', order: -1 }]
            : []),
        ...[...seasons].sort((a, b) => a.order - b.order),
    ];

    const episodesIn = (laneId: string) =>
        episodes
            .filter(e => laneId === UNSORTED_SEASON_ID ? isUnsorted(e) : e.seasonId === laneId)
            .sort((a, b) => a.order - b.order);

    const focusedEpisode = focus?.kind === 'episode'
        ? episodes.find(e => e.id === focus.id)
        : undefined;

    const focusedLaneId = focus?.kind === 'season'
        ? focus.id
        : focusedEpisode
            ? (isUnsorted(focusedEpisode) ? UNSORTED_SEASON_ID : focusedEpisode.seasonId!)
            : undefined;

    const boxes: VNBox[] = [];
    let y = PAD;

    for (const lane of lanes) {
        if (focus && lane.id !== focusedLaneId) {
            boxes.push({
                id: lane.id, kind: 'season', title: lane.title,
                collapsed: true, x: PAD, y, width: SEASON_W, height: COLLAPSED_H,
            });
            y += COLLAPSED_H + SEASON_GAP;
            continue;
        }

        const eps = episodesIn(lane.id);
        const innerTop = y + SEASON_HEADER;
        const children: VNBox[] = [];
        let innerHeight = 0;

        if (!focus) {
            const perRow = Math.max(1, Math.floor((SEASON_W - PAD * 2 + GAP) / (EP_SCAN_W + GAP)));
            eps.forEach((ep, i) => {
                children.push({
                    id: ep.id, kind: 'episode', parentId: lane.id, title: ep.title,
                    collapsed: false,
                    x: PAD * 2 + (i % perRow) * (EP_SCAN_W + GAP),
                    y: innerTop + Math.floor(i / perRow) * (EP_SCAN_H + GAP),
                    width: EP_SCAN_W, height: EP_SCAN_H,
                });
            });
            const rows = Math.ceil(eps.length / perRow);
            innerHeight = rows ? rows * EP_SCAN_H + (rows - 1) * GAP : 0;
        } else {
            let ey = innerTop;
            for (const ep of eps) {
                const expanded = !focusedEpisode || focusedEpisode.id === ep.id;
                const height = episodeHeight(ep, expanded);

                children.push({
                    id: ep.id, kind: 'episode', parentId: lane.id, title: ep.title,
                    collapsed: !expanded,
                    x: PAD * 2, y: ey, width: EP_FOCUS_W, height,
                });

                if (focusedEpisode?.id === ep.id) {
                    [...(ep.decisions ?? [])]
                        .sort((a, b) => a.order - b.order)
                        .forEach((decision, i) => {
                            children.push({
                                id: decision.id, kind: 'decision', parentId: ep.id,
                                title: decision.prompt, collapsed: false,
                                x: PAD * 3,
                                y: ey + EPISODE_HEADER + i * DECISION_H,
                                width: EP_FOCUS_W - PAD * 2, height: DECISION_H,
                            });
                        });
                }

                ey += height + GAP;
            }
            innerHeight = eps.length ? ey - innerTop - GAP : 0;
        }

        const height = SEASON_HEADER + innerHeight + PAD;
        boxes.push({
            id: lane.id, kind: 'season', title: lane.title,
            collapsed: false, x: PAD, y, width: SEASON_W, height,
        });
        boxes.push(...children);

        y += height + SEASON_GAP;
    }

    const storyHeight = Math.max(lanes.length ? y - SEASON_GAP + PAD : PAD * 2, PAD * 2);

    return [
        {
            id: STORY_BOX_ID, kind: 'story', title: 'Story', collapsed: false,
            x: 0, y: 0, width: SEASON_W + PAD * 2, height: storyHeight,
        },
        ...boxes,
    ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/vnTimeline.test.ts`
Expected: PASS — 23 tests.

If a test fails, fix the IMPLEMENTATION, not the test. If after careful analysis you believe a test's expectation is itself wrong, STOP and report DONE_WITH_CONCERNS explaining precisely what and why. Do not edit a test to match whatever the code produced.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/lib/vnTimeline.ts src/lib/vnTimeline.test.ts
git commit -m "feat: lay out the season timeline from structure and focus"
```

---

### Task 3: Store fields

Purely additive. Nothing is removed — the old branch map keeps working until Phase B replaces it.

**Files:**
- Modify: `src/store/workspaceStore.ts`

- [ ] **Step 1: Add the imports**

Beside the existing visual novel type imports:

```ts
import type { VNSeason, VNDecision } from '@/lib/vnTimeline';
```

- [ ] **Step 2: Add the Project field**

On the `Project` interface, beside `vnFlags`:

```ts
    /** Visual novel projects only: the seasons its episodes are grouped into. */
    seasons?: VNSeason[];
```

- [ ] **Step 3: Add the Document fields**

On the `Document` interface, beside the existing `choices`:

```ts
    /** Visual novel projects only: the season this episode belongs to. */
    seasonId?: string;
    /** Visual novel projects only: position within its season. */
    order?: number;
    /** Visual novel projects only: the decisions made during this episode. */
    decisions?: VNDecision[];
```

Leave `choices?: VNBlockChoice[]` in place. Phase B removes it.

No migration is needed — the Supabase schema stores the whole workspace as one `jsonb` blob.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 329 tests across 37 files.

- [ ] **Step 5: Commit**

```bash
git add src/store/workspaceStore.ts
git commit -m "feat: store seasons, and episode order and decisions"
```

---

### Task 4: The Ren'Py assembler

**Files:**
- Create: `src/lib/vnTimelineExport.ts`
- Create: `src/lib/vnTimelineExport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/vnTimelineExport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildTimelineScript, episodeLabels } from './vnTimelineExport';
import type { VNSeason, VNEpisode } from './vnTimeline';
import type { VNFlag } from './vnFlags';

const S1: VNSeason = { id: 's1', title: 'Season One', order: 0 };
const S2: VNSeason = { id: 's2', title: 'Season Two', order: 1 };

describe('episodeLabels', () => {
    it('names a label from its season and episode numbers', () => {
        const labels = episodeLabels([S1], [
            { id: 'e1', title: 'The Bar', seasonId: 's1', order: 0 },
        ]);
        expect(labels.get('e1')).toBe('s1e1_the_bar');
    });

    it('numbers episodes from one within each season', () => {
        const labels = episodeLabels([S1, S2], [
            { id: 'a', title: 'A', seasonId: 's1', order: 0 },
            { id: 'b', title: 'B', seasonId: 's1', order: 1 },
            { id: 'c', title: 'C', seasonId: 's2', order: 0 },
        ]);
        expect([labels.get('a'), labels.get('b'), labels.get('c')])
            .toEqual(['s1e1_a', 's1e2_b', 's2e1_c']);
    });

    it('never emits a hyphen, which is a syntax error in a label', () => {
        const labels = episodeLabels([S1], [
            { id: 'e1', title: 'Act One — The Long Goodbye', seasonId: 's1', order: 0 },
        ]);
        expect(labels.get('e1')).not.toContain('-');
    });

    it('falls back when a title has no usable characters', () => {
        const labels = episodeLabels([S1], [
            { id: 'e1', title: '???', seasonId: 's1', order: 0 },
        ]);
        expect(labels.get('e1')).toBe('s1e1_untitled');
    });
});

describe('buildTimelineScript', () => {
    const flags: VNFlag[] = [
        { id: 'f-bold', name: 'bold', kind: 'bool', initial: 0 },
        { id: 'f-trust', name: 'mara_trust', kind: 'counter', initial: 0 },
    ];

    it('emits a minor decision as a menu with no jumps', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'minor', prompt: 'A drink?', order: 0, options: [
                    { id: 'o1', text: 'Order one', effects: [{ flagId: 'f-bold', op: 'set' }] },
                    { id: 'o2', text: 'Say nothing' },
                ] },
            ] },
        ], [], 'X', flags);

        expect(script).toContain('    menu:\n        "Order one":\n            $ bold = True\n');
        expect(script).toContain('        "Say nothing":\n            pass\n');
        expect(script).not.toContain('jump s1e1');
    });

    it('emits pass for an option that does nothing, since a block cannot be empty', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'minor', prompt: 'p', order: 0, options: [
                    { id: 'o1', text: 'Shrug' },
                ] },
            ] },
        ], [], 'X', []);
        expect(script).toContain('        "Shrug":\n            pass');
    });

    it('emits a jump only for an option that routes to another episode', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'major', prompt: 'p', order: 0, options: [
                    { id: 'o1', text: 'Leave', routeToEpisodeId: 'e3' },
                    { id: 'o2', text: 'Stay' },
                ] },
            ] },
            { id: 'e2', title: 'Morning', seasonId: 's1', order: 1 },
            { id: 'e3', title: 'Night Walk', seasonId: 's1', order: 2 },
        ], [], 'X', []);

        expect(script).toContain('            jump s1e3_night_walk');
        expect(script).toContain('        "Stay":\n            pass');
    });

    it('falls through to the next episode by order', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'One', seasonId: 's1', order: 0 },
            { id: 'e2', title: 'Two', seasonId: 's1', order: 1 },
        ], [], 'X', []);
        expect(script).toContain('label s1e1_one:\n    jump s1e2_two');
    });

    it('carries on into the next season', () => {
        const script = buildTimelineScript([S1, S2], [
            { id: 'e1', title: 'Last', seasonId: 's1', order: 0 },
            { id: 'e2', title: 'First', seasonId: 's2', order: 0 },
        ], [], 'X', []);
        expect(script).toContain('label s1e1_last:\n    jump s2e1_first');
    });

    it('ends the final episode with return', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Only', seasonId: 's1', order: 0 },
        ], [], 'X', []);
        expect(script.trimEnd().endsWith('return')).toBe(true);
    });

    it('guards an option with its condition', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'major', prompt: 'p', order: 0, options: [
                    { id: 'o1', text: 'Kiss her',
                      condition: { flagId: 'f-trust', op: 'atLeast', value: 3 } },
                ] },
            ] },
        ], [], 'X', flags);
        expect(script).toContain('        "Kiss her" if mara_trust >= 3:');
    });

    it('declares every flag in the registry', () => {
        const script = buildTimelineScript([S1], [], [], 'X', flags);
        expect(script).toContain('default bold = False');
        expect(script).toContain('default mara_trust = 0');
    });

    it('emits decisions in order', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd2', kind: 'minor', prompt: 'second', order: 1, options: [{ id: 'b', text: 'B' }] },
                { id: 'd1', kind: 'minor', prompt: 'first', order: 0, options: [{ id: 'a', text: 'A' }] },
            ] },
        ], [], 'X', []);
        expect(script.indexOf('"A"')).toBeLessThan(script.indexOf('"B"'));
    });

    it('skips a decision with no options rather than emitting an empty menu', () => {
        const script = buildTimelineScript([S1], [
            { id: 'e1', title: 'Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'minor', prompt: 'p', order: 0, options: [] },
            ] },
        ], [], 'X', []);
        expect(script).not.toContain('menu:');
    });

    it('emits a complete, paste-able two-season script', () => {
        const episodes: VNEpisode[] = [
            { id: 'e1', title: 'The Bar', seasonId: 's1', order: 0, decisions: [
                { id: 'd1', kind: 'minor', prompt: 'A drink?', order: 0, options: [
                    { id: 'o1', text: 'Order one', effects: [{ flagId: 'f-bold', op: 'set' }] },
                    { id: 'o2', text: 'Say nothing' },
                ] },
                { id: 'd2', kind: 'major', prompt: 'Ask her name?', order: 1, options: [
                    { id: 'o3', text: 'Ask', effects: [{ flagId: 'f-trust', op: 'add', value: 1 }] },
                    { id: 'o4', text: 'Leave', routeToEpisodeId: 'e3' },
                ] },
            ] },
            { id: 'e2', title: 'Morning', seasonId: 's1', order: 1 },
            { id: 'e3', title: 'Alone', seasonId: 's2', order: 0, decisions: [
                { id: 'd3', kind: 'major', prompt: 'Go back?', order: 0, options: [
                    { id: 'o5', text: 'Go back', condition: { flagId: 'f-trust', op: 'atLeast', value: 1 } },
                ] },
            ] },
        ];

        expect(buildTimelineScript([S1, S2], episodes, ['Mara'], 'Lighthouse', flags)).toBe(
`# Generated by LoreCanvas — Lighthouse
# Drop this file into your Ren'Py project's game/ folder.

define m = Character("Mara")

default bold = False
default mara_trust = 0

label start:
    jump s1e1_the_bar

label s1e1_the_bar:
    menu:
        "Order one":
            $ bold = True

        "Say nothing":
            pass

    menu:
        "Ask":
            $ mara_trust += 1

        "Leave":
            jump s2e1_alone

    jump s1e2_morning

label s1e2_morning:
    jump s2e1_alone

label s2e1_alone:
    menu:
        "Go back" if mara_trust >= 1:
            pass

    return
`);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/vnTimelineExport.test.ts`
Expected: FAIL — cannot resolve `./vnTimelineExport`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/vnTimelineExport.ts`:

```ts
/**
 * The Ren'Py assembler for the season timeline. LEAF MODULE, and pure: data
 * in, string out.
 *
 * Nothing here can be verified by running it — this machine has no Ren'Py SDK
 * — so the tests are the only safety net.
 *
 * The rule that shapes everything: Ren'Py continues past a menu once an
 * option's block finishes. So "rejoin within the episode" is the language's
 * own default and emits no jump at all. The only jumps written are a
 * cross-episode route, and the implicit hand-off to the next episode.
 */

import {
    toIdentifier, escapeRenpyText, buildAliasMap, buildFlagNameMap,
} from './renpyExport';
import { formatDefault, formatEffect, formatCondition, type VNFlag } from './vnFlags';
import type { VNSeason, VNEpisode } from './vnTimeline';

const INDENT = '    ';

/** Episodes in play order: by season order, then by episode order. */
function inPlayOrder(seasons: VNSeason[], episodes: VNEpisode[]): VNEpisode[] {
    const rank = new Map(
        [...seasons].sort((a, b) => a.order - b.order).map((s, i) => [s.id, i]),
    );
    return [...episodes].sort((a, b) => {
        const sa = rank.get(a.seasonId ?? '') ?? Number.MAX_SAFE_INTEGER;
        const sb = rank.get(b.seasonId ?? '') ?? Number.MAX_SAFE_INTEGER;
        return sa - sb || a.order - b.order;
    });
}

/**
 * Episode id → label, as `s1e2_the_bar`. Season and episode numbers come from
 * play order rather than from any stored index, so inserting an episode
 * renumbers the ones after it exactly as a reader would expect.
 */
export function episodeLabels(
    seasons: VNSeason[],
    episodes: VNEpisode[],
): Map<string, string> {
    const seasonNumber = new Map(
        [...seasons].sort((a, b) => a.order - b.order).map((s, i) => [s.id, i + 1]),
    );

    const counters = new Map<string, number>();
    const taken = new Set<string>();
    const labels = new Map<string, string>();

    for (const episode of inPlayOrder(seasons, episodes)) {
        const sKey = episode.seasonId ?? '';
        const sNum = seasonNumber.get(sKey) ?? 0;
        const eNum = (counters.get(sKey) ?? 0) + 1;
        counters.set(sKey, eNum);

        const slug = toIdentifier(episode.title, 'untitled', '_episode');
        const base = `s${sNum}e${eNum}_${slug}`;

        let label = base;
        let n = 2;
        while (taken.has(label)) {
            label = `${base}_${n}`;
            n += 1;
        }

        taken.add(label);
        labels.set(episode.id, label);
    }

    return labels;
}

/** Speakers needing a `define`, from the cast plus any name used in prose. */
function collectSpeakers(castNames: string[]): string[] {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const name of castNames) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(name);
    }
    return names;
}

/**
 * The whole .rpy file for a season timeline.
 *
 * `castNames` seeds the character definitions. Scene prose is not yet part of
 * the timeline model — the Writing Desk owns it — so this emits structure and
 * state, which is what a draft is for.
 */
export function buildTimelineScript(
    seasons: VNSeason[],
    episodes: VNEpisode[],
    castNames: string[],
    projectName: string,
    flags: VNFlag[] = [],
): string {
    const ordered = inPlayOrder(seasons, episodes);
    const labels = episodeLabels(seasons, episodes);

    const speakers = collectSpeakers(castNames);
    const aliases = buildAliasMap(speakers);

    const flagNames = buildFlagNameMap(flags);

    const out: string[] = [
        `# Generated by LoreCanvas — ${projectName}`,
        `# Drop this file into your Ren'Py project's game/ folder.`,
        '',
    ];

    for (const name of speakers) {
        out.push(`define ${aliases.get(name)} = Character("${escapeRenpyText(name)}")`);
    }
    if (speakers.length) out.push('');

    for (const flag of [...flags].sort((a, b) => a.name.localeCompare(b.name))) {
        out.push(formatDefault(flag, flagNames.get(flag.id)!));
    }
    if (flags.length) out.push('');

    if (!ordered.length) return `${out.join('\n').trimEnd()}\n`;

    out.push('label start:', `${INDENT}jump ${labels.get(ordered[0].id)}`, '');

    ordered.forEach((episode, index) => {
        out.push(`label ${labels.get(episode.id)}:`);

        const decisions = [...(episode.decisions ?? [])]
            .sort((a, b) => a.order - b.order)
            .filter(d => d.options.length);

        for (const decision of decisions) {
            out.push(`${INDENT}menu:`);

            for (const option of decision.options) {
                const identifier = option.condition
                    ? flagNames.get(option.condition.flagId)
                    : undefined;
                const guard = option.condition && identifier
                    ? ` if ${formatCondition(option.condition, identifier)}`
                    : '';
                out.push(`${INDENT.repeat(2)}"${escapeRenpyText(option.text)}"${guard}:`);

                const body: string[] = [];
                for (const effect of option.effects ?? []) {
                    const name = flagNames.get(effect.flagId);
                    // A flag deleted from the registry leaves dangling effects.
                    // Skipping beats emitting `$ undefined = True`.
                    if (!name) continue;
                    body.push(formatEffect(effect, name));
                }

                // Only a route writes a jump. Everything else rejoins, which
                // Ren'Py does on its own once the block ends.
                const target = option.routeToEpisodeId
                    ? labels.get(option.routeToEpisodeId)
                    : undefined;
                if (target) body.push(`jump ${target}`);

                // A menu option's block cannot be empty.
                if (!body.length) body.push('pass');

                for (const line of body) out.push(`${INDENT.repeat(3)}${line}`);
                out.push('');
            }
        }

        const next = ordered[index + 1];
        out.push(next ? `${INDENT}jump ${labels.get(next.id)}` : `${INDENT}return`);
        out.push('');
    });

    return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
```

**Two helpers in `renpyExport.ts` are currently module-private and must be exported** so both assemblers share one implementation. Add `export` to each — change nothing else about them:

```ts
export function toIdentifier(raw: string, fallback: string, keywordSuffix: string): string {
```

```ts
export function buildFlagNameMap(flags: VNFlag[]): Map<string, string> {
```

`buildFlagNameMap` is the one that dedupes flag identifiers, so two flags named `met bob` and `met-bob` cannot collapse onto the same Ren'Py variable. Sharing it rather than writing a second copy is the point.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/vnTimelineExport.test.ts`
Expected: PASS — 15 tests.

If the golden test fails, read the diff extremely carefully. Ren'Py indentation is significant and the expected string is the specification. Fix the implementation, never the expectation — unless you are confident the expectation contradicts the Ren'Py rules at the top of this plan, in which case STOP and report it.

Run: `npm test`
Expected: all pass — 344 tests across 38 files.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/lib/vnTimelineExport.ts src/lib/vnTimelineExport.test.ts src/lib/renpyExport.ts
git commit -m "feat: assemble a Ren'Py script from seasons and episodes"
```

---

## Done when

- `npm test` passes at roughly 344 tests across 38 files
- `npx tsc --noEmit` exits 0
- `layoutTimeline` positions boxes correctly in both scanning and focused modes, with collapse and containment covered
- A two-season timeline with major, minor and cross-route decisions produces a complete, correctly indented `.rpy`

## Not in this phase

No UI. Nothing renders. The old branch map is untouched and still works — Phase B deletes it once the timeline can replace it.
