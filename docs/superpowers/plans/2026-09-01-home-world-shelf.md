# Home World Shelf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home bento's "Your world" tile with a shelf of world spines — click a spine and it opens beside the shelf, showing the stories inside and that world's article count.

**Architecture:** A pure leaf module (`worldShelves.ts`) derives `Shelf[]` from the store's worlds, projects and entities. A presentational component (`WorldShelf`) renders that array at one of two sizes and never touches the store. `HomePage` wires the two together. Keeping the component store-free is what lets the Bookshelf page mount it later at `size="page"` without a rewrite.

**Tech Stack:** Next.js 15 app router, React 19, TypeScript, Zustand, CSS Modules, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-home-world-shelf-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/worldShelves.ts` (create) | Pure derivation of `Shelf[]`. No store, no React. |
| `src/lib/worldShelves.test.ts` (create) | Unit tests for the derivation. |
| `src/components/home/WorldShelf.tsx` (create) | Presentational spine shelf plus opened panel. |
| `src/components/home/WorldShelf.module.css` (create) | Spine, panel and size-variant styles. |
| `src/components/home/HomePage.tsx` (modify) | Derive shelves, hold selection, render the tile. |
| `src/components/home/HomePage.module.css` (modify) | `.tileWorld` span change; drop dead article-list classes. |

Leaf-module conventions to follow: `src/lib/homeStats.ts` and `src/lib/goalSchedule.ts` — 4-space indent, a module doc comment naming it a leaf module, named exports only.

---

### Task 1: Shelf derivation module

**Files:**
- Create: `src/lib/worldShelves.ts`
- Create: `src/lib/worldShelves.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/worldShelves.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    buildShelves,
    spineFraction,
    STANDALONE_SHELF_NAME,
    SPINE_MIN_FRACTION,
} from './worldShelves';
import { STANDALONE_KEY } from './worldKey';

const world = (id: string, name: string, createdAt: string, coverColor = '#4A6FA5') =>
    ({ id, name, createdAt, coverColor });

const project = (id: string, name: string, worldId?: string, updatedAt = '2026-01-01T00:00:00.000Z') =>
    ({ id, name, worldId, updatedAt, createdAt: '2026-01-01T00:00:00.000Z', coverColor: '#333' });

describe('buildShelves', () => {
    it('groups projects under the world they belong to', () => {
        const worlds = [world('w1', 'Aethel', '2026-01-01T00:00:00.000Z')];
        const projects = [project('p1', 'The Salt Road', 'w1'), project('p2', 'Nine Winters', 'w1')];

        const shelves = buildShelves(worlds, projects, []);

        expect(shelves).toHaveLength(1);
        expect(shelves[0].key).toBe('w1');
        expect(shelves[0].name).toBe('Aethel');
        expect(shelves[0].stories).toHaveLength(2);
    });

    it('emits a Standalones shelf only when a project has no world', () => {
        const worlds = [world('w1', 'Aethel', '2026-01-01T00:00:00.000Z')];

        expect(buildShelves(worlds, [project('p1', 'Bound', 'w1')], [])).toHaveLength(1);

        const withLoose = buildShelves(worlds, [project('p2', 'Loose')], []);
        expect(withLoose).toHaveLength(2);
        expect(withLoose[1].key).toBe(STANDALONE_KEY);
        expect(withLoose[1].name).toBe(STANDALONE_SHELF_NAME);
        expect(withLoose[1].isStandalone).toBe(true);
    });

    it('files a project pointing at a deleted world under Standalones', () => {
        const shelves = buildShelves([], [project('p1', 'Orphan', 'gone')], []);

        expect(shelves).toHaveLength(1);
        expect(shelves[0].key).toBe(STANDALONE_KEY);
        expect(shelves[0].stories.map(s => s.name)).toEqual(['Orphan']);
    });

    it('counts articles per world and re-files orphaned ones', () => {
        const worlds = [world('w1', 'Aethel', '2026-01-01T00:00:00.000Z')];
        const entities = [{ worldId: 'w1' }, { worldId: 'w1' }, { worldId: 'gone' }, {}];

        const shelves = buildShelves(worlds, [project('p1', 'Loose')], entities);

        expect(shelves[0].articleCount).toBe(2);
        expect(shelves[1].articleCount).toBe(2);
    });

    it('orders worlds by creation with Standalones always last', () => {
        const worlds = [
            world('w2', 'Mirefall', '2026-05-01T00:00:00.000Z'),
            world('w1', 'Aethel', '2026-01-01T00:00:00.000Z'),
        ];

        const shelves = buildShelves(worlds, [project('p1', 'Loose')], []);

        expect(shelves.map(s => s.name)).toEqual(['Aethel', 'Mirefall', STANDALONE_SHELF_NAME]);
    });

    it('keeps a world with no stories on the shelf', () => {
        const shelves = buildShelves([world('w1', 'Empty', '2026-01-01T00:00:00.000Z')], [], []);

        expect(shelves).toHaveLength(1);
        expect(shelves[0].stories).toEqual([]);
    });

    it('orders stories within a shelf by most recently touched', () => {
        const worlds = [world('w1', 'Aethel', '2026-01-01T00:00:00.000Z')];
        const projects = [
            project('old', 'Older', 'w1', '2026-01-01T00:00:00.000Z'),
            project('new', 'Newer', 'w1', '2026-08-01T00:00:00.000Z'),
        ];

        expect(buildShelves(worlds, projects, [])[0].stories.map(s => s.name))
            .toEqual(['Newer', 'Older']);
    });

    it('falls back to the project createdAt when updatedAt is missing', () => {
        const worlds = [world('w1', 'Aethel', '2026-01-01T00:00:00.000Z')];
        const projects = [{
            id: 'p1', name: 'No update stamp', worldId: 'w1',
            createdAt: '2026-04-04T00:00:00.000Z', coverColor: '#333',
        }];

        expect(buildShelves(worlds, projects, [])[0].stories[0].updatedAt)
            .toBe(new Date('2026-04-04T00:00:00.000Z').getTime());
    });
});

describe('spineFraction', () => {
    it('gives an empty world the shortest spine', () => {
        expect(spineFraction(0)).toBe(SPINE_MIN_FRACTION);
    });

    it('grows with story count', () => {
        expect(spineFraction(3)).toBeGreaterThan(spineFraction(1));
    });

    it('clamps so a huge world does not blow out the shelf', () => {
        expect(spineFraction(6)).toBe(1);
        expect(spineFraction(400)).toBe(1);
    });

    it('treats a negative count as empty', () => {
        expect(spineFraction(-5)).toBe(SPINE_MIN_FRACTION);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/worldShelves.test.ts`

Expected: FAIL with `Failed to resolve import "./worldShelves"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/worldShelves.ts`:

```ts
/**
 * World shelves — LEAF MODULE (no store, no React import).
 *
 * Turns the flat worlds/projects/entities collections into the shape a shelf
 * renders: one entry per world, each holding the stories written in it and how
 * many World Bible articles it owns. Projects with no world — or pointing at a
 * world that has since been deleted — collect on a Standalones shelf rather
 * than disappearing.
 */

import { STANDALONE_KEY, type WorldKey } from './worldKey';

export const STANDALONE_SHELF_NAME = 'Standalones';
/** Neutral grey: standalones are the absence of a world, not a world of their own. */
export const STANDALONE_SHELF_COLOR = '#3a3a44';

export interface ShelfStory {
    id: string;
    name: string;
    coverColor: string;
    coverImageUrl?: string;
    /** ms since epoch; updatedAt when present, else createdAt. */
    updatedAt: number;
}

export interface Shelf {
    key: WorldKey;
    name: string;
    coverColor: string;
    stories: ShelfStory[];
    articleCount: number;
    isStandalone: boolean;
}

interface WorldLike {
    id: string;
    name: string;
    coverColor?: string;
    createdAt: Date | string;
}

interface ProjectLike {
    id: string;
    name: string;
    coverColor?: string;
    coverImageUrl?: string;
    worldId?: string;
    createdAt: Date | string;
    updatedAt?: Date | string;
}

interface EntityLike {
    worldId?: string;
}

function toTime(v: Date | string | undefined): number {
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
}

export function buildShelves(
    worlds: WorldLike[],
    projects: ProjectLike[],
    entities: EntityLike[],
): Shelf[] {
    const knownWorldIds = new Set(worlds.map(w => w.id));

    /** A reference to a deleted world is not a world — it belongs with the loose books. */
    const resolveKey = (worldId?: string): WorldKey =>
        worldId && knownWorldIds.has(worldId) ? worldId : STANDALONE_KEY;

    const storiesByKey = new Map<WorldKey, ShelfStory[]>();
    for (const p of projects) {
        const key = resolveKey(p.worldId);
        const list = storiesByKey.get(key) ?? [];
        list.push({
            id: p.id,
            name: p.name,
            coverColor: p.coverColor || STANDALONE_SHELF_COLOR,
            coverImageUrl: p.coverImageUrl,
            updatedAt: toTime(p.updatedAt) || toTime(p.createdAt),
        });
        storiesByKey.set(key, list);
    }
    for (const list of storiesByKey.values()) {
        list.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    const articlesByKey = new Map<WorldKey, number>();
    for (const e of entities) {
        const key = resolveKey(e.worldId);
        articlesByKey.set(key, (articlesByKey.get(key) ?? 0) + 1);
    }

    const shelves: Shelf[] = [...worlds]
        .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))
        .map(w => ({
            key: w.id,
            name: w.name,
            coverColor: w.coverColor || STANDALONE_SHELF_COLOR,
            stories: storiesByKey.get(w.id) ?? [],
            articleCount: articlesByKey.get(w.id) ?? 0,
            isStandalone: false,
        }));

    // Standalones earns a spine only when something is actually loose.
    if ((storiesByKey.get(STANDALONE_KEY) ?? []).length > 0) {
        shelves.push({
            key: STANDALONE_KEY,
            name: STANDALONE_SHELF_NAME,
            coverColor: STANDALONE_SHELF_COLOR,
            stories: storiesByKey.get(STANDALONE_KEY) ?? [],
            articleCount: articlesByKey.get(STANDALONE_KEY) ?? 0,
            isStandalone: true,
        });
    }

    return shelves;
}

/**
 * Spine height as a fraction of the shelf, from story count.
 *
 * Clamped at both ends: a one-story and a two-story world should still look
 * different, and a forty-story world must not blow out the shelf. The encoding
 * is a hint, not a scale.
 */
export const SPINE_MIN_FRACTION = 0.62;
export const SPINE_FULL_AT = 6;

export function spineFraction(storyCount: number): number {
    const reach = Math.min(1, Math.max(0, storyCount) / SPINE_FULL_AT);
    return SPINE_MIN_FRACTION + (1 - SPINE_MIN_FRACTION) * reach;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/worldShelves.test.ts`

Expected: PASS, 12 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit --pretty false`

Expected: exits silently with no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/worldShelves.ts src/lib/worldShelves.test.ts
git commit -m "feat: derive world shelves from worlds, projects and articles"
```

---

### Task 2: The WorldShelf component

**Files:**
- Create: `src/components/home/WorldShelf.module.css`
- Create: `src/components/home/WorldShelf.tsx`

This task has no unit tests. The component is presentational, and this repo verifies Home surfaces in the browser preview (Task 4). Do not build a component-test harness — none exists here, and adding one is out of scope.

- [ ] **Step 1: Write the CSS module**

Create `src/components/home/WorldShelf.module.css`:

```css
/* WorldShelf — world spines with the opened world beside them */

.shelf {
  --spine-w: 22px;
  --shelf-h: 88px;
  --cover-w: 30px;
  --cover-h: 42px;
  display: flex;
  gap: 10px;
  align-items: stretch;
  min-width: 0;
}

.sizePage {
  --spine-w: 30px;
  --shelf-h: 150px;
  --cover-w: 46px;
  --cover-h: 64px;
}

/* Spines */

.spines {
  display: flex;
  gap: 5px;
  align-items: flex-end;
  height: var(--shelf-h);
  flex-shrink: 0;
}

.spine {
  width: var(--spine-w);
  padding: 0;
  border: none;
  border-radius: 2px 2px 1px 1px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: transform 0.18s cubic-bezier(0.23, 1, 0.32, 1), filter 0.18s ease;
  /* A spine is a board seen edge-on: one lit edge, one shadowed. */
  box-shadow:
    inset 2px 0 0 rgba(255, 255, 255, 0.18),
    inset -2px 0 0 rgba(0, 0, 0, 0.28);
}

.spine:hover { transform: translateY(-3px); filter: brightness(1.15); }
.spine:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }

.spineSelected { transform: translateY(-6px); filter: brightness(1.22); }

.spineLabel {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: calc(var(--shelf-h) - 12px);
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.sizePage .spineLabel { font-size: 12px; }

/* Opened world */

.panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 12px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.panelName {
  margin: 0;
  font-size: 0.94rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panelMeta {
  margin: 0;
  font-size: 0.74rem;
  color: var(--muted, #8b8b95);
}

.covers {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.cover {
  width: var(--cover-w);
  height: var(--cover-h);
  padding: 0;
  border: none;
  border-radius: 2px 3px 3px 2px;
  background-size: cover;
  background-position: center;
  cursor: pointer;
  box-shadow: inset 3px 0 0 rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease;
}
.cover:hover { transform: translateY(-2px); }
.cover:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }

.noStories {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted, #8b8b95);
}

.bibleLink {
  align-self: flex-start;
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--foreground, #f2f0ef);
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.15s ease;
}
.bibleLink:hover { opacity: 1; }

/* Empty shelf */

.empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.emptyText {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.5;
  color: var(--muted, #8b8b95);
}

@media (max-width: 620px) {
  .shelf { flex-direction: column; }
  .panel {
    padding-left: 0;
    padding-top: 10px;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spine, .cover { transition: none; }
}
```

- [ ] **Step 2: Write the component**

Create `src/components/home/WorldShelf.tsx`:

```tsx
"use client";

import React, { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { spineFraction, type Shelf } from '@/lib/worldShelves';
import type { WorldKey } from '@/lib/worldKey';
import styles from './WorldShelf.module.css';

/**
 * A shelf of world spines, with the selected world opened beside them.
 *
 * Purely presentational — it takes a prepared Shelf[] and reports clicks. That
 * is what lets the Home tile and, later, the Bookshelf page render the same
 * component at different sizes without either owning the other's data wiring.
 */

interface WorldShelfProps {
    shelves: Shelf[];
    size: 'tile' | 'page';
    selectedKey: WorldKey | null;
    onSelect: (key: WorldKey) => void;
    onOpenStory: (projectId: string) => void;
    onOpenBible: (key: WorldKey) => void;
    /** Rendered under the message when there are no shelves at all. */
    emptyAction?: React.ReactNode;
}

/** How many covers fit before the panel starts to crowd. */
const MAX_VISIBLE_COVERS = 6;

export function WorldShelf({
    shelves, size, selectedKey, onSelect, onOpenStory, onOpenBible, emptyAction,
}: WorldShelfProps) {
    // Declared before any early return — hooks must run unconditionally.
    const spineRefs = useRef<(HTMLButtonElement | null)[]>([]);

    if (shelves.length === 0) {
        return (
            <div className={styles.empty}>
                <p className={styles.emptyText}>
                    Your shelf is empty. Create a world and the stories you write in it live here.
                </p>
                {emptyAction}
            </div>
        );
    }

    // Selection always resolves to a real shelf, so the panel is never blank.
    const selected = shelves.find(s => s.key === selectedKey) ?? shelves[0];

    // Arrow keys walk the shelf, which is what a row of spines invites.
    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        let next: number | null = null;
        if (e.key === 'ArrowRight') next = Math.min(shelves.length - 1, index + 1);
        else if (e.key === 'ArrowLeft') next = Math.max(0, index - 1);
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = shelves.length - 1;
        if (next === null) return;
        e.preventDefault();
        onSelect(shelves[next].key);
        spineRefs.current[next]?.focus();
    };

    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

    return (
        <div className={`${styles.shelf} ${size === 'page' ? styles.sizePage : ''}`}>
            <div className={styles.spines} role="tablist" aria-label="Your worlds">
                {shelves.map((shelf, i) => {
                    const isSelected = shelf.key === selected.key;
                    return (
                        <button
                            key={shelf.key}
                            ref={el => { spineRefs.current[i] = el; }}
                            role="tab"
                            aria-selected={isSelected}
                            className={`${styles.spine} ${isSelected ? styles.spineSelected : ''}`}
                            style={{
                                height: `calc(var(--shelf-h) * ${spineFraction(shelf.stories.length)})`,
                                background: shelf.coverColor,
                            }}
                            title={`${shelf.name} — ${plural(shelf.stories.length, 'story', 'stories')}`}
                            onClick={() => onSelect(shelf.key)}
                            onKeyDown={e => handleKeyDown(e, i)}
                        >
                            <span className={styles.spineLabel}>{shelf.name}</span>
                        </button>
                    );
                })}
            </div>

            <div className={styles.panel}>
                <h3 className={styles.panelName}>{selected.name}</h3>
                <p className={styles.panelMeta}>
                    {plural(selected.stories.length, 'story', 'stories')}
                    {' · '}
                    {plural(selected.articleCount, 'article', 'articles')}
                </p>

                {selected.stories.length > 0 ? (
                    <div className={styles.covers}>
                        {selected.stories.slice(0, MAX_VISIBLE_COVERS).map(story => (
                            <button
                                key={story.id}
                                className={styles.cover}
                                style={story.coverImageUrl
                                    ? { backgroundImage: `url(${story.coverImageUrl})` }
                                    : { background: story.coverColor }}
                                title={story.name}
                                aria-label={`Open ${story.name}`}
                                onClick={() => onOpenStory(story.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <p className={styles.noStories}>No stories in this world yet.</p>
                )}

                <button className={styles.bibleLink} onClick={() => onOpenBible(selected.key)}>
                    Open world bible <ArrowRight size={13} />
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit --pretty false && npx eslint src/components/home/WorldShelf.tsx`

Expected: both silent.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/WorldShelf.tsx src/components/home/WorldShelf.module.css
git commit -m "feat: add the world spine shelf component"
```

---

### Task 3: Wire the shelf into Home

**Files:**
- Modify: `src/components/home/HomePage.module.css`
- Modify: `src/components/home/HomePage.tsx`

- [ ] **Step 1: Widen the tile**

In `src/components/home/HomePage.module.css`, change the `.tileWorld` rule from:

```css
.tileWorld     { grid-column: span 1; }
```

to:

```css
.tileWorld     { grid-column: span 2; }
```

Leave every other span alone — the reorder happens in the JSX, not the CSS.

- [ ] **Step 2: Delete the dead article-list styles**

In the same file, delete the `.worldList`, `.worldRow`, `.worldType` and `.worldCount` rules. Nothing references them once Step 5 lands.

- [ ] **Step 3: Add imports and store selectors**

In `src/components/home/HomePage.tsx`, add two new imports:

```tsx
import { buildShelves } from '@/lib/worldShelves';
import { WorldShelf } from './WorldShelf';
```

Replace the existing `@/lib/worldKey` import line — currently
`import { worldKeyForProject, worldKeyForEntity } from '@/lib/worldKey';` — with:

```tsx
import { STANDALONE_KEY, type WorldKey } from '@/lib/worldKey';
```

Both old names become unused once Step 4 deletes the `worldEntities` memo, which is
their only caller in this file.

Then drop `worldCounts` from the `@/lib/homeStats` import, keeping the rest of that
import list intact.

Add these beside the existing store selectors:

```tsx
  const worlds = useWorkspaceStore(s => s.worlds);
  const setActiveWorldKey = useWorkspaceStore(s => s.setActiveWorldKey);
```

- [ ] **Step 4: Replace the world derivation**

Delete these three blocks from `HomePage.tsx`:

- the `worldEntities` memo (filters entities to the active project's world)
- the `world` memo (`worldCounts(worldEntities)`)
- nothing else — `activeProject` stays, the quick-capture box still uses it

Add in their place:

```tsx
  // Shelves cover every world, not just the active one — the tile exists to move
  // between worlds, so scoping it to the current one would defeat the point.
  const shelves = useMemo(
    () => buildShelves(worlds ?? [], projects, entities),
    [worlds, projects, entities],
  );

  const [selectedShelfKey, setSelectedShelfKey] = useState<WorldKey | null>(null);

  const openStory = (projectId: string) => {
    setActiveProject(projectId);
    setWorkspaceMode('desk');
  };

  const openBible = (key: WorldKey) => {
    // The standalone shelf has no world of its own; null is its world key.
    setActiveWorldKey(key === STANDALONE_KEY ? null : key);
    setWorkspaceMode('worldBible');
  };
```

The `spotlight` state read `worldEntities`, which no longer exists. Repoint it at `entities`:

```tsx
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  useEffect(() => {
    if (entities.length > 0) {
      setSpotlightIndex(Math.floor(Math.random() * entities.length));
    }
  }, [entities.length]);
  const spotlight = entities[spotlightIndex] ?? null;
```

- [ ] **Step 5: Replace the tile body and move it up**

Delete the entire existing `tileWorld` block — from `<div className={\`${styles.tile} ${styles.tileWorld}\`}>` through its closing `</div>`, including the `{/* World at a glance */}` comment above it.

Insert this **directly above** the `{/* From your world */}` comment:

```tsx
          {/* Your worlds — spines you open to reach the stories inside */}
          <div className={`${styles.tile} ${styles.tileWorld}`}>
            <div className={styles.tileHead}>
              <span className={styles.tileLabel}><Globe size={14} /> Your worlds</span>
              <span className={styles.tileHint}>
                {shelves.length} {shelves.length === 1 ? 'shelf' : 'shelves'}
              </span>
            </div>
            <WorldShelf
              shelves={shelves}
              size="tile"
              selectedKey={selectedShelfKey}
              onSelect={setSelectedShelfKey}
              onOpenStory={openStory}
              onOpenBible={openBible}
              emptyAction={
                <button className={styles.tileLink} onClick={() => setWorkspaceMode('bookshelf')}>
                  Go to the Bookshelf <ArrowRight size={14} />
                </button>
              }
            />
          </div>
```

- [ ] **Step 6: Verify the bento order**

Run:

```bash
grep -n "tileHeatmap\|tileWorld\|tileLore\|tileAttention\|tileLinks" src/components/home/HomePage.tsx
```

Expected: line numbers ascend in the order `tileHeatmap`, `tileWorld`, `tileLore`, `tileAttention`, `tileLinks`. That gives a full row of world + "From your world", then attention + "Jump to", leaving the single empty grid slot beside "Jump to" where it already sits today.

- [ ] **Step 7: Check for orphaned CSS classes**

Run:

```bash
grep -n "worldList\|worldRow\|worldType\|worldCount" src/components/home/HomePage.module.css src/components/home/HomePage.tsx
```

Expected: no matches.

- [ ] **Step 8: Typecheck, lint and test**

Run: `npx tsc --noEmit --pretty false && npx eslint src/components/home/ && npx vitest run`

Expected: tsc silent; eslint reports only the pre-existing `react-hooks/set-state-in-effect` warning on the spotlight effect; every test passes.

- [ ] **Step 9: Commit**

```bash
git add src/components/home/HomePage.tsx src/components/home/HomePage.module.css
git commit -m "feat: put the world shelf on the Home bento"
```

---

### Task 4: Verify in the browser

**Files:** none unless a defect turns up.

The dev server is the `dev` entry in `.claude/launch.json`. Start it with the Browser pane (`preview_start` with `{name: "dev"}`) — never run a dev server through Bash.

- [ ] **Step 1: Create test data**

The account holds one standalone project and no worlds, so most states are unreachable without seeding. On the Bookshelf page use `+ New Shelf` to create two worlds; add two stories to the first and one to the second. Leave the existing project standalone so all three shelf kinds are on screen at once.

- [ ] **Step 2: Check the populated state**

On Home, confirm:
- Three spines — two worlds then Standalones, in that order
- The two-story world's spine is visibly taller than the one-story world's
- The first shelf is open by default, showing the right story and article counts
- The tile spans two bento columns with "From your world" beside it

- [ ] **Step 3: Check the interactions**

- Click each spine: the panel swaps and the selected spine leans out
- Click a story cover: lands in the Writing Desk on that project
- Back on Home, click "Open world bible": lands in the World Bible for that world
- Tab to a spine, then ArrowRight / ArrowLeft / Home / End: selection follows focus

- [ ] **Step 4: Check the edge states**

- A world with no stories shows "No stories in this world yet." and still offers its bible link
- Narrow the pane below 620px: the panel stacks under the spines with no horizontal overflow

- [ ] **Step 5: Check for errors**

Read console messages filtered to errors. The Browser pane retains console output across reloads, so confirm any error is live by checking whether the page actually rendered rather than trusting the buffer.

Expected: no new errors from `WorldShelf` or `HomePage`.

- [ ] **Step 6: Confirm the data survives a reload**

Reload and confirm the worlds and stories are still there. The console should log `keeping local workspace` or `applied cloud workspace` with matching item counts, from the sync fix in `src/lib/workspaceConflict.ts`.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: <what the browser pass actually found>"
```

If nothing needed fixing, skip this step. Do not create an empty commit.
