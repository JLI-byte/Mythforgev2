# Per-Shelf World Bible — Phase 2 (Book Actions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 3D World Bible book becomes a three-action scroll selector (Open → Edit → Organize), backed by a new Edit page (identity, presets, danger zone) and an article-drag tray on the hierarchy canvas.

**Architecture:** Verb state lives inside `WorldBibleBook` (wheel-stepped index over a verbs array, non-passive wheel listener); Bookshelf routes the chosen action and stamps `activeWorldKey`. A new `worldBibleEdit` workspace mode renders `WorldBibleEdit`, which edits `worldBibles[activeWorldKey]` via three new store actions. The Organize tray reuses HierarchyCanvas's existing native HTML5 drag, with `dataTransfer` keys keeping article-drags and type-drags apart.

**Tech Stack:** Next.js 16 (Turbopack), React 19, TypeScript, Zustand, Vitest, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-07-01-per-shelf-world-bible-design.md` (Parts 1–3). Phase 1 (data model) is merged: `worldBibles: Record<WorldKey, WorldBibleConfig>`, `activeWorldKey`, `getWorldBibleConfig`, `worldKeyForEntity`, `STANDALONE_KEY` all exist.

**Verification baseline:** `npx vitest run` → 59 tests pass; `npx tsc --noEmit` clean; `npm run build` succeeds. If not, stop and report.

**Two implementation gotchas baked into this plan:**
1. **Wheel + preventDefault:** React's JSX `onWheel` is attached passively at the root — `preventDefault()` inside it is ignored. The book MUST attach its wheel listener manually: `el.addEventListener('wheel', handler, { passive: false })` in a `useEffect` on a ref.
2. **HTML5 drag disambiguation:** the canvas's existing type-chip drag uses `dataTransfer.setData('type', ...)`. Article drags use `setData('entityId', ...)`. During `dragover` you CANNOT call `getData` (protected) — check `e.dataTransfer.types.includes('entityid')` (types are lowercased). During `drop` you can `getData`.

---

### Task 1: Store additions (mode + three actions, TDD)

**Files:**
- Modify: `src/store/workspaceStore.ts`
- Modify: `src/store/worldBibleActions.test.ts` (add 3 tests)

- [ ] **Step 1: Write the failing tests** — append to the existing `describe` in `worldBibleActions.test.ts` (its `beforeEach` already seeds world w1, projects p1/p2, entities e1 (w1) / e2 (standalone)):

```ts
    it('updateWorldBibleConfig sets identity fields without touching the layout', () => {
        useWorkspaceStore.setState({ worldBibles: { w1: { layout: { roots: [root('keep')] } } } });
        useWorkspaceStore.getState().updateWorldBibleConfig('w1', { coverTitle: 'Aetherium', tint: '#aa3344' });
        const cfg = useWorkspaceStore.getState().worldBibles['w1'];
        expect(cfg.coverTitle).toBe('Aetherium');
        expect(cfg.tint).toBe('#aa3344');
        expect(cfg.layout.roots.map(r => r.label)).toEqual(['keep']);
    });

    it('setWorldBibleLayout replaces the layout, preserving identity fields', () => {
        useWorkspaceStore.setState({ worldBibles: { w1: { layout: { roots: [root('old')] }, coverTitle: 'Aetherium' } } });
        useWorkspaceStore.getState().setWorldBibleLayout('w1', { roots: [root('new')] });
        const cfg = useWorkspaceStore.getState().worldBibles['w1'];
        expect(cfg.layout.roots.map(r => r.label)).toEqual(['new']);
        expect(cfg.coverTitle).toBe('Aetherium');
    });

    it('deleteWorldEntities removes only that world\'s entities', () => {
        useWorkspaceStore.getState().deleteWorldEntities('w1');
        const names = useWorkspaceStore.getState().entities.map(e => e.name);
        expect(names).toEqual(['Docks']); // e1 (Mira, w1) gone; e2 (standalone) stays
    });
```

- [ ] **Step 2: Run to verify failures**

Run: `npx vitest run src/store/worldBibleActions.test.ts`
Expected: FAIL — actions don't exist.

- [ ] **Step 3: Extend the WorkspaceMode union** (anchor: `export type WorkspaceMode =`, ~line 400):

```ts
export type WorkspaceMode = 'worldBible' | 'worldBibleEdit' | 'template' | 'desk' | 'hierarchy' | 'bookshelf';
```

In `setWorkspaceMode` (the implementation), widen the derive condition — both places that test `(mode === 'worldBible' || mode === 'hierarchy')` for KEY DERIVATION become `(mode === 'worldBible' || mode === 'worldBibleEdit' || mode === 'hierarchy')`. Leave the `focusedArticleEntityId` clearing condition as it is.

- [ ] **Step 4: Add the three actions.** Interface declarations next to `setActiveWorldKey` (~line 600):

```ts
    /** Sprint 70: edit a bible's identity fields (cover title/sub/tint). */
    updateWorldBibleConfig: (key: WorldKey, patch: Partial<Omit<WorldBibleConfig, 'layout'>>) => void;
    /** Sprint 70: replace a bible's layout wholesale (presets, reset). */
    setWorldBibleLayout: (key: WorldKey, layout: WorldBibleLayout) => void;
    /** Sprint 70: danger zone — delete every entity belonging to a shelf. */
    deleteWorldEntities: (key: WorldKey) => void;
```

Implementations next to the `setActiveWorldKey` implementation. Note: the store must now also VALUE-import `worldKeyForEntity` (extend the existing `import { worldKeyForProject, type WorldKey } from '@/lib/worldKey';` line):

```ts
            updateWorldBibleConfig: (key, patch) =>
                set((state) => ({
                    worldBibles: {
                        ...state.worldBibles,
                        [key]: {
                            layout: state.worldBibles[key]?.layout ?? { roots: [] },
                            ...state.worldBibles[key],
                            ...patch,
                        },
                    },
                })),

            setWorldBibleLayout: (key, layout) =>
                set((state) => ({
                    worldBibles: {
                        ...state.worldBibles,
                        [key]: { ...state.worldBibles[key], layout },
                    },
                })),

            deleteWorldEntities: (key) =>
                set((state) => {
                    logger.info('World bible cleared of articles:', key);
                    return { entities: state.entities.filter(e => worldKeyForEntity(e) !== key) };
                }),
```

(`updateWorldBibleConfig`'s spread order matters: the `layout:` default is listed FIRST so an existing config's real layout overrides it; identity `patch` last. An `{ roots: [] }` layout renders as the default via `getWorldBibleConfig`'s fallback, so identity-only configs behave correctly.)

- [ ] **Step 5: Run tests + compile**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 62 tests pass (59 + 3), tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/store/workspaceStore.ts src/store/worldBibleActions.test.ts
git commit -m "feat: worldBibleEdit mode + bible identity/layout/clear store actions"
```

---

### Task 2: Presets module (TDD)

**Files:**
- Create: `src/lib/worldBiblePresets.ts`
- Create: `src/lib/worldBiblePresets.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/worldBiblePresets.test.ts
import { describe, it, expect } from 'vitest';
import { BIBLE_PRESETS, createPresetLayout } from './worldBiblePresets';

const ALL_TYPES = ['character', 'location', 'faction', 'artifact', 'lore', 'magic', 'religion', 'species'].sort();

describe('worldBiblePresets', () => {
    it('ships exactly four presets', () => {
        expect(BIBLE_PRESETS.map(p => p.id)).toEqual(['standard', 'fantasy', 'scifi', 'ttrpg']);
    });

    it.each(BIBLE_PRESETS.map(p => [p.id, p] as const))(
        '%s covers all 8 entity types exactly once',
        (_id, preset) => {
            const types = preset.categories.flatMap(c => c.entityTypes);
            expect([...types].sort()).toEqual(ALL_TYPES);          // none missing
            expect(new Set(types).size).toBe(types.length);        // none duplicated
        },
    );

    it('createPresetLayout mints fresh root ids on every call', () => {
        const a = createPresetLayout(BIBLE_PRESETS[0]);
        const b = createPresetLayout(BIBLE_PRESETS[0]);
        expect(a.roots.length).toBe(BIBLE_PRESETS[0].categories.length);
        expect(a.roots.map(r => r.id)).not.toEqual(b.roots.map(r => r.id));
        expect(a.roots.every(r => r.x !== undefined && r.y !== undefined)).toBe(true);
    });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib/worldBiblePresets.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/worldBiblePresets.ts
import { EntityType, WorldBibleLayout } from '@/store/workspaceStore';

/** A built-in category structure for a shelf's World Bible. */
export interface BiblePreset {
    id: 'standard' | 'fantasy' | 'scifi' | 'ttrpg';
    name: string;
    description: string;
    categories: { label: string; icon: string; entityTypes: EntityType[] }[];
}

/**
 * Every preset MUST cover all 8 entity types exactly once — applying a
 * preset only re-groups articles, it can never orphan them. Enforced by
 * worldBiblePresets.test.ts.
 */
export const BIBLE_PRESETS: BiblePreset[] = [
    {
        id: 'standard',
        name: 'Standard',
        description: 'The default grouping — people, places, things, systems.',
        categories: [
            { label: 'People', icon: '👤', entityTypes: ['character', 'faction', 'species'] },
            { label: 'Places', icon: '📍', entityTypes: ['location'] },
            { label: 'Things', icon: '📦', entityTypes: ['artifact', 'lore'] },
            { label: 'World Systems', icon: '🌍', entityTypes: ['magic', 'religion'] },
        ],
    },
    {
        id: 'fantasy',
        name: 'Fantasy',
        description: 'Realms, races, relics — classic high-fantasy shelves.',
        categories: [
            { label: 'Characters', icon: '🧙', entityTypes: ['character'] },
            { label: 'Realms', icon: '🏰', entityTypes: ['location'] },
            { label: 'Peoples & Races', icon: '🧬', entityTypes: ['species', 'faction'] },
            { label: 'Magic & Faith', icon: '✨', entityTypes: ['magic', 'religion'] },
            { label: 'Relics & Legends', icon: '📜', entityTypes: ['artifact', 'lore'] },
        ],
    },
    {
        id: 'scifi',
        name: 'Sci-fi',
        description: 'Stations, species, tech — built for spacefaring worlds.',
        categories: [
            { label: 'Characters', icon: '🧑‍🚀', entityTypes: ['character'] },
            { label: 'Worlds & Stations', icon: '🪐', entityTypes: ['location'] },
            { label: 'Factions', icon: '🛰️', entityTypes: ['faction'] },
            { label: 'Species', icon: '👽', entityTypes: ['species'] },
            { label: 'Tech & Artifacts', icon: '🔧', entityTypes: ['artifact', 'magic'] },
            { label: 'Archives & Beliefs', icon: '📡', entityTypes: ['lore', 'religion'] },
        ],
    },
    {
        id: 'ttrpg',
        name: 'TTRPG',
        description: 'Party, bestiary, loot — organized like a campaign binder.',
        categories: [
            { label: 'Party & NPCs', icon: '🎲', entityTypes: ['character'] },
            { label: 'Locations', icon: '🗺️', entityTypes: ['location'] },
            { label: 'Factions & Guilds', icon: '⚔️', entityTypes: ['faction'] },
            { label: 'Bestiary', icon: '🐉', entityTypes: ['species'] },
            { label: 'Items & Loot', icon: '💎', entityTypes: ['artifact'] },
            { label: 'Magic & Deities', icon: '🔮', entityTypes: ['magic', 'religion'] },
            { label: 'Lore & Quests', icon: '📜', entityTypes: ['lore'] },
        ],
    },
];

/** Fresh layout instance — new root ids on every apply, spaced for the canvas. */
export function createPresetLayout(preset: BiblePreset): WorldBibleLayout {
    return {
        roots: preset.categories.map((c, i) => ({
            id: crypto.randomUUID(),
            label: c.label,
            icon: c.icon,
            entityTypes: [...c.entityTypes],
            x: 100 + (i % 3) * 400,
            y: 100 + Math.floor(i / 3) * 400,
        })),
    };
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lib/worldBiblePresets.test.ts` → PASS (6: 1 + 4 parametrized + 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/worldBiblePresets.ts src/lib/worldBiblePresets.test.ts
git commit -m "feat: four built-in world bible layout presets"
```

---

### Task 3: Book verb selector (scroll-to-choose)

**Files:**
- Create: `src/components/management/bookVerbs.ts`
- Create: `src/components/management/bookVerbs.test.ts`
- Modify: `src/components/management/WorldBibleBook.tsx` (full component below)
- Modify: `src/components/management/WorldBibleBook.module.css`
- Modify: `src/components/management/Bookshelf.tsx` (book render, ~line 359)

- [ ] **Step 1: Failing test for the cycle helper**

```ts
// src/components/management/bookVerbs.test.ts
import { describe, it, expect } from 'vitest';
import { BOOK_VERBS, nextVerb } from './bookVerbs';

describe('bookVerbs', () => {
    it('exposes Open, Edit, Organize in order', () => {
        expect(BOOK_VERBS.map(v => v.label)).toEqual(['Open', 'Edit', 'Organize']);
    });
    it('wraps forward and backward', () => {
        expect(nextVerb(0, 1, 3)).toBe(1);
        expect(nextVerb(2, 1, 3)).toBe(0);   // wraps forward
        expect(nextVerb(0, -1, 3)).toBe(2);  // wraps backward
    });
});
```

Run: `npx vitest run src/components/management/bookVerbs.test.ts` → FAIL.

- [ ] **Step 2: Implement the helper**

```ts
// src/components/management/bookVerbs.ts
/** The three actions a shelf's World Bible book offers, in scroll order. */
export const BOOK_VERBS = [
    { id: 'open', label: 'Open' },
    { id: 'edit', label: 'Edit' },
    { id: 'organize', label: 'Organize' },
] as const;

export type BookAction = (typeof BOOK_VERBS)[number]['id'];

/** Wheel-step cycling with wrap-around in both directions. */
export function nextVerb(current: number, direction: 1 | -1, count: number): number {
    return (current + direction + count) % count;
}
```

Run the test → PASS (2).

- [ ] **Step 3: Rewrite `WorldBibleBook.tsx`** — full new component (3D structure and cover unchanged except identity props + the page action):

```tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { BOOK_VERBS, BookAction, nextVerb } from './bookVerbs';
import styles from './WorldBibleBook.module.css';

/** One wheel notch per step; tames trackpad delta storms. */
const WHEEL_COOLDOWN_MS = 200;

interface WorldBibleBookProps {
    /** Cover title (bible coverTitle, falling back to the world name). */
    title: string;
    /** Cover subtitle — defaults to "World Bible". */
    subtitle?: string;
    /** Cover accent color (hex) — overrides the greyscale cover when set. */
    tint?: string;
    /** Fires the verb currently showing on the open page. */
    onAction: (action: BookAction) => void;
}

/**
 * WorldBibleBook — a 3D hardcover book (ported from codepen.io/fivera/pen/kQJzxP)
 * that fronts each shelf. Hovering swings the cover open; scrolling while
 * hovered rolls the page verb (Open → Edit → Organize, wrapping); clicking
 * fires the visible verb.
 */
export default function WorldBibleBook({ title, subtitle, tint, onAction }: WorldBibleBookProps) {
    const [verbIndex, setVerbIndex] = useState(0);
    const bookRef = useRef<HTMLElement>(null);
    const cooldownRef = useRef(0);

    // React's JSX onWheel is passive at the root — preventDefault is ignored
    // there. Attach a non-passive listener so scrolling the book doesn't
    // scroll the bookshelf underneath.
    useEffect(() => {
        const el = bookRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const now = Date.now();
            if (now - cooldownRef.current < WHEEL_COOLDOWN_MS) return;
            cooldownRef.current = now;
            setVerbIndex(i => nextVerb(i, e.deltaY > 0 ? 1 : -1, BOOK_VERBS.length));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const verb = BOOK_VERBS[verbIndex];

    return (
        <div className={styles.wrap}>
            <figure
                ref={bookRef}
                className={styles.book}
                role="button"
                tabIndex={0}
                aria-label={`${verb.label} the ${title} World Bible`}
                onClick={() => onAction(verb.id)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onAction(verb.id);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setVerbIndex(i => nextVerb(i, 1, BOOK_VERBS.length));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setVerbIndex(i => nextVerb(i, -1, BOOK_VERBS.length));
                    }
                }}
            >
                {/* Front */}
                <ul className={styles.hardcoverFront}>
                    <li>
                        <div
                            className={styles.coverDesign}
                            style={tint ? { backgroundColor: tint, backgroundImage: 'none' } : undefined}
                        >
                            <h2 className={styles.coverTitle}>{title}</h2>
                            <p className={styles.coverSub}>{subtitle ?? 'World Bible'}</p>
                        </div>
                    </li>
                    <li></li>
                </ul>

                {/* Pages */}
                <ul className={styles.page}>
                    <li></li>
                    <li>
                        <div className={styles.pageAction} aria-live="polite">
                            <span key={verbIndex} className={styles.pageVerb}>{verb.label}</span>
                            <span className={styles.pageHint}>the lore</span>
                            <span className={styles.pageScrollHint}>scroll ↕</span>
                        </div>
                    </li>
                    <li></li>
                    <li></li>
                    <li></li>
                </ul>

                {/* Back */}
                <ul className={styles.hardcoverBack}>
                    <li></li>
                    <li></li>
                </ul>
                <ul className={styles.bookSpine}>
                    <li></li>
                    <li></li>
                </ul>
            </figure>
            <span className={styles.label}>World Bible</span>
        </div>
    );
}
```

(The `key={verbIndex}` remount is what triggers the roll-in animation per step — the scroll-hero word-swap feel, adapted to discrete wheel steps.)

- [ ] **Step 4: CSS** — in `WorldBibleBook.module.css`, REPLACE the existing `.pageHint` block with:

```css
/* page-side action selector, revealed when the book opens */
.pageAction {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 2px;
    overflow: hidden;
}

.pageVerb {
    display: block;
    color: #3a3a42;
    font-size: 0.95rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    animation: lc-verb-roll 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}
@keyframes lc-verb-roll {
    from { transform: translateY(90%); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
}

.pageHint {
    color: #6b6b70;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.pageScrollHint {
    margin-top: 10px;
    color: #9a9aa0;
    font-size: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}
```

And extend the existing reduced-motion block:

```css
@media (prefers-reduced-motion: reduce) {
    .hardcoverFront,
    .page > li {
        transition: none;
    }
    .pageVerb {
        animation: none;
    }
}
```

- [ ] **Step 5: Bookshelf wiring** — replace the book render (~line 359; `worldId`, `title`, `isUncategorized` are in scope; `setActiveWorldKey` already subscribed):

```tsx
                    <WorldBibleBook
                        title={bibleCfg.coverTitle ?? (isUncategorized ? 'Standalones' : title)}
                        subtitle={bibleCfg.coverSub}
                        tint={bibleCfg.tint}
                        onAction={(action) => {
                            setActiveWorldKey(worldKey);
                            if (action === 'open') setWorkspaceMode('worldBible');
                            else if (action === 'edit') setWorkspaceMode('worldBibleEdit');
                            else setWorkspaceMode('hierarchy');
                        }}
                    />
```

Above it in the same render scope add:

```ts
                const worldKey = isUncategorized ? STANDALONE_KEY : worldId;
                const bibleCfg = getWorldBibleConfig(worldBibles, worldKey);
```

(place per the file's actual structure — the shelf-render function body), plus at component level: subscribe `const worldBibles = useWorkspaceStore(state => state.worldBibles);` and import `getWorldBibleConfig` from `@/lib/worldBibleNav`. If the existing code already computes an equivalent of `worldKey` inline, reuse it rather than duplicating.

- [ ] **Step 6: Verify** — `npx tsc --noEmit && npx vitest run` (70 expected: 62 + 6 from Task 2 + 2) and `npm run build`.

- [ ] **Step 7: Commit**

```bash
git add -A src/
git commit -m "feat: world bible book scroll-selects Open/Edit/Organize"
```

---

### Task 4: Edit page — mode wiring + identity section

**Files:**
- Modify: `src/app/page.tsx` (mode switch, ~line 170)
- Create: `src/components/world/WorldBibleEdit.tsx`
- Create: `src/components/world/WorldBibleEdit.module.css`

- [ ] **Step 1: Route the mode.** In `page.tsx`, import `WorldBibleEdit` and add a branch to the mode chain (~line 170):

```tsx
                {workspaceMode === 'worldBible' ? (
                  <WorldBibleCenter />
                ) : workspaceMode === 'worldBibleEdit' ? (
                  <WorldBibleEdit />
                ) : workspaceMode === 'template' ? (
```

- [ ] **Step 2: Component skeleton + identity section**

```tsx
// src/components/world/WorldBibleEdit.tsx
"use client";

import React, { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';
import { BIBLE_PRESETS, createPresetLayout } from '@/lib/worldBiblePresets';
import styles from './WorldBibleEdit.module.css';

/**
 * WorldBibleEdit — the book's "Edit" destination. Edits the active shelf's
 * bible: cover identity, layout presets, and the danger zone.
 */
export default function WorldBibleEdit() {
    const worldBibles = useWorkspaceStore(s => s.worldBibles);
    const activeWorldKey = useWorkspaceStore(s => s.activeWorldKey) ?? STANDALONE_KEY;
    const worlds = useWorkspaceStore(s => s.worlds);
    const entities = useWorkspaceStore(s => s.entities);
    const updateWorldBibleConfig = useWorkspaceStore(s => s.updateWorldBibleConfig);
    const setWorldBibleLayout = useWorkspaceStore(s => s.setWorldBibleLayout);
    const deleteWorldEntities = useWorkspaceStore(s => s.deleteWorldEntities);
    const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);

    // Two-click confirm state: which destructive control is armed.
    const [confirming, setConfirming] = useState<string | null>(null);

    const cfg = getWorldBibleConfig(worldBibles, activeWorldKey);
    const world = worlds.find(w => w.id === activeWorldKey);
    const defaultTitle = world?.name ?? 'Standalones';
    const articleCount = entities.filter(e => worldKeyForEntity(e) === activeWorldKey).length;
    const hasCustomLayout = !!worldBibles[activeWorldKey]?.layout?.roots?.length;

    const applyPreset = (presetId: string) => {
        const preset = BIBLE_PRESETS.find(p => p.id === presetId);
        if (!preset) return;
        if (hasCustomLayout && confirming !== `preset-${presetId}`) {
            setConfirming(`preset-${presetId}`);
            return;
        }
        setWorldBibleLayout(activeWorldKey, createPresetLayout(preset));
        setConfirming(null);
    };

    return (
        <div className={styles.container}>
            <div className={styles.inner}>
                <button className={styles.backBtn} onClick={() => setWorkspaceMode('bookshelf')}>
                    ← Bookshelf
                </button>
                <h1 className={styles.title}>Edit — {cfg.coverTitle ?? defaultTitle}</h1>
                <p className={styles.subtitle}>Settings for this shelf&rsquo;s World Bible.</p>

                {/* ── Book identity ── */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Book identity</h2>
                    <div className={styles.identityGrid}>
                        <div className={styles.fields}>
                            <label className={styles.field}>
                                <span>Cover title</span>
                                <input
                                    value={cfg.coverTitle ?? ''}
                                    placeholder={defaultTitle}
                                    onChange={(e) => updateWorldBibleConfig(activeWorldKey, { coverTitle: e.target.value || undefined })}
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Subtitle</span>
                                <input
                                    value={cfg.coverSub ?? ''}
                                    placeholder="World Bible"
                                    onChange={(e) => updateWorldBibleConfig(activeWorldKey, { coverSub: e.target.value || undefined })}
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Cover tint</span>
                                <div className={styles.tintRow}>
                                    <input
                                        type="color"
                                        value={cfg.tint ?? '#34343c'}
                                        onChange={(e) => updateWorldBibleConfig(activeWorldKey, { tint: e.target.value })}
                                    />
                                    {cfg.tint && (
                                        <button
                                            className={styles.tintClear}
                                            onClick={() => updateWorldBibleConfig(activeWorldKey, { tint: undefined })}
                                        >
                                            Reset to grey
                                        </button>
                                    )}
                                </div>
                            </label>
                        </div>
                        {/* Live flat preview of the cover */}
                        <div
                            className={styles.coverPreview}
                            style={cfg.tint ? { backgroundColor: cfg.tint, backgroundImage: 'none' } : undefined}
                        >
                            <span className={styles.previewTitle}>{cfg.coverTitle || defaultTitle}</span>
                            <span className={styles.previewSub}>{cfg.coverSub || 'World Bible'}</span>
                        </div>
                    </div>
                </section>

                {/* ── Layout presets ── */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Layout presets</h2>
                    <p className={styles.sectionHint}>
                        Swaps the category structure only — articles are never deleted, just re-grouped.
                    </p>
                    <div className={styles.presetGrid}>
                        {BIBLE_PRESETS.map(preset => (
                            <div key={preset.id} className={styles.presetCard}>
                                <div className={styles.presetHead}>
                                    <b>{preset.name}</b>
                                    <span>{preset.description}</span>
                                </div>
                                <div className={styles.presetChips}>
                                    {preset.categories.map(c => (
                                        <span key={c.label} className={styles.presetChip}>{c.icon} {c.label}</span>
                                    ))}
                                </div>
                                <button className={styles.presetApply} onClick={() => applyPreset(preset.id)}>
                                    {confirming === `preset-${preset.id}` ? 'Replace current layout?' : 'Apply'}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Danger zone ── */}
                <section className={`${styles.section} ${styles.danger}`}>
                    <h2 className={styles.sectionTitle}>Danger zone</h2>
                    <div className={styles.dangerRow}>
                        <div>
                            <b>Reset layout to Standard</b>
                            <span>Replaces custom categories with the default four.</span>
                        </div>
                        <button
                            className={styles.dangerBtn}
                            onClick={() => {
                                if (confirming !== 'reset') { setConfirming('reset'); return; }
                                setWorldBibleLayout(activeWorldKey, createPresetLayout(BIBLE_PRESETS[0]));
                                setConfirming(null);
                            }}
                        >
                            {confirming === 'reset' ? 'Really reset?' : 'Reset layout'}
                        </button>
                    </div>
                    <div className={styles.dangerRow}>
                        <div>
                            <b>Clear all articles</b>
                            <span>{articleCount} article{articleCount === 1 ? '' : 's'} in this bible. This can&rsquo;t be undone.</span>
                        </div>
                        <button
                            className={styles.dangerBtn}
                            disabled={articleCount === 0}
                            onClick={() => {
                                if (confirming !== 'clear') { setConfirming('clear'); return; }
                                deleteWorldEntities(activeWorldKey);
                                setConfirming(null);
                            }}
                        >
                            {confirming === 'clear' ? `Delete ${articleCount} article${articleCount === 1 ? '' : 's'}?` : 'Clear articles'}
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: CSS module** — `WorldBibleEdit.module.css`, matching the app's dark-surface style (`var(--background)`, `var(--surface)`, `var(--border)`, `var(--foreground)`, `var(--muted, #888)`, `var(--accent)`):

```css
.container { width: 100%; height: 100%; overflow-y: auto; background: var(--background); }
.inner { max-width: 860px; margin: 0 auto; padding: 40px 32px 80px; }
.backBtn { background: none; border: none; color: var(--muted, #888); font-size: 0.9rem; cursor: pointer; padding: 0; margin-bottom: 20px; }
.backBtn:hover { color: var(--foreground); }
.title { font-size: 1.7rem; font-weight: 700; color: var(--foreground); margin: 0 0 4px; }
.subtitle { color: var(--muted, #888); font-size: 0.9rem; margin: 0 0 32px; }

.section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 22px 24px; margin-bottom: 22px; }
.sectionTitle { font-size: 1.05rem; font-weight: 700; color: var(--foreground); margin: 0 0 12px; }
.sectionHint { color: var(--muted, #888); font-size: 0.82rem; margin: -6px 0 14px; }

.identityGrid { display: grid; grid-template-columns: 1fr 170px; gap: 24px; align-items: start; }
.fields { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; color: var(--muted, #888); }
.field input[type="text"], .field input:not([type]) { padding: 9px 11px; border-radius: 8px; border: 1px solid var(--border); background: var(--background); color: var(--foreground); font-size: 0.9rem; }
.tintRow { display: flex; align-items: center; gap: 10px; }
.tintRow input[type="color"] { width: 46px; height: 32px; padding: 2px; border: 1px solid var(--border); border-radius: 6px; background: var(--background); cursor: pointer; }
.tintClear { background: none; border: none; color: var(--muted, #888); font-size: 0.78rem; cursor: pointer; text-decoration: underline; }

.coverPreview {
    aspect-ratio: 160 / 220; border-radius: 4px 10px 10px 4px;
    background-color: #34343c; background-image: linear-gradient(to bottom, #3d3d46 58%, #2e2e36 0%);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    padding: 0 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}
.previewTitle { color: #f2f2f2; font-weight: 700; font-size: 0.95rem; text-align: center; }
.previewSub { color: rgba(255,255,255,0.55); font-size: 0.55rem; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; }

.presetGrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.presetCard { border: 1px solid var(--border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.presetHead { display: flex; flex-direction: column; gap: 2px; }
.presetHead b { color: var(--foreground); font-size: 0.95rem; }
.presetHead span { color: var(--muted, #888); font-size: 0.78rem; }
.presetChips { display: flex; flex-wrap: wrap; gap: 6px; }
.presetChip { font-size: 0.72rem; padding: 4px 8px; border-radius: 999px; background: var(--background); border: 1px solid var(--border); color: var(--foreground); }
.presetApply { align-self: flex-start; padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--background); color: var(--foreground); font-size: 0.82rem; font-weight: 600; cursor: pointer; }
.presetApply:hover { border-color: var(--accent); }

.danger { border-color: rgba(220, 80, 80, 0.45); }
.dangerRow { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 0; }
.dangerRow + .dangerRow { border-top: 1px solid var(--border); }
.dangerRow b { display: block; color: var(--foreground); font-size: 0.9rem; }
.dangerRow span { color: var(--muted, #888); font-size: 0.78rem; }
.dangerBtn { padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(220, 80, 80, 0.6); background: transparent; color: #e07070; font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
.dangerBtn:hover:not(:disabled) { background: rgba(220, 80, 80, 0.12); }
.dangerBtn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npx vitest run && npm run build` (70 tests).

- [ ] **Step 5: Commit**

```bash
git add -A src/
git commit -m "feat: world bible edit page (identity, presets, danger zone)"
```

---

### Task 5: Organize — article tray with drag-onto-chip

**Files:**
- Modify: `src/components/world/HierarchyCanvas.tsx`
- Modify: `src/components/world/HierarchyCanvas.module.css`

The canvas's existing drag is NATIVE HTML5 (`draggable` + `dataTransfer.setData('type', ...)` — see `handleTypeDragStart`:204, `handleTypeDrop`:211, `handleCanvasDrop`:233, and the chips at line ~352). Articles use the same mechanism with a different data key.

- [ ] **Step 1: Subscriptions + tray state.** Add to the component:

```ts
import { worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';
// subscriptions:
const entities = useWorkspaceStore(state => state.entities);
const updateEntity = useWorkspaceStore(state => state.updateEntity);
const activeWorldKey = useWorkspaceStore(state => state.activeWorldKey) ?? STANDALONE_KEY;
// tray state:
const [trayFilter, setTrayFilter] = useState('');
const [dragOverChip, setDragOverChip] = useState<string | null>(null); // `${rootId}:${type}`
```

```ts
const trayEntities = entities.filter(e =>
    worldKeyForEntity(e) === activeWorldKey &&
    e.name.toLowerCase().includes(trayFilter.toLowerCase())
);
```

- [ ] **Step 2: Guard the EXISTING drop handlers against article payloads.** First line of BOTH `handleTypeDrop` and `handleCanvasDrop`:

```ts
        if (e.dataTransfer.getData('entityId')) return; // article drags only land on type chips
```

- [ ] **Step 3: Chip drop handling.** Add the handler:

```ts
    /** Re-files an article: drop onto a type chip sets the entity's type. */
    const handleArticleDropOnChip = (e: React.DragEvent, type: EntityType) => {
        const entityId = e.dataTransfer.getData('entityId');
        setDragOverChip(null);
        if (!entityId) return; // a type-chip drag — let it bubble to the node handler
        e.preventDefault();
        e.stopPropagation();
        updateEntity(entityId, { type });
    };
```

And extend the chip JSX (line ~352) — note `dragover` can only inspect `types` (lowercased), not `getData`:

```tsx
                                            {n.entityTypes.map(type => {
                                                const chipKey = `${n.id}:${type}`;
                                                return (
                                                    <div
                                                        key={type}
                                                        className={`${styles.nodeChip} ${dragOverChip === chipKey ? styles.chipDropTarget : ''}`}
                                                        draggable
                                                        onDragStart={(e) => handleTypeDragStart(e, type, n.id)}
                                                        onDragOver={(e) => {
                                                            if (e.dataTransfer.types.includes('entityid')) {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setDragOverChip(chipKey);
                                                            }
                                                        }}
                                                        onDragLeave={() => setDragOverChip(prev => prev === chipKey ? null : prev)}
                                                        onDrop={(e) => handleArticleDropOnChip(e, type)}
                                                    >
                                                        <span>{TYPE_ICONS[type]} {ENTITY_TYPE_LABELS[type]}</span>
                                                    </div>
                                                );
                                            })}
```

- [ ] **Step 4: Tray JSX.** Inside `<main className={styles.main}>`, AFTER the `canvasViewport` div (hidden in draft mode — drafts design structure, not real data):

```tsx
            {!isDraft && (
                <aside className={styles.articleTray}>
                    <div className={styles.trayHeader}>
                        <b>Articles</b>
                        <input
                            className={styles.trayFilter}
                            placeholder="Filter…"
                            value={trayFilter}
                            onChange={(e) => setTrayFilter(e.target.value)}
                        />
                    </div>
                    <p className={styles.trayHint}>Drag an article onto a category chip to re-file it.</p>
                    <div className={styles.trayList}>
                        {trayEntities.map(entity => (
                            <div
                                key={entity.id}
                                className={styles.trayCard}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('entityId', entity.id)}
                            >
                                <span className={styles.trayIcon}>{TYPE_ICONS[entity.type]}</span>
                                <span className={styles.trayName}>{entity.name}</span>
                                <span className={styles.trayType}>{ENTITY_TYPE_LABELS[entity.type]}</span>
                            </div>
                        ))}
                        {trayEntities.length === 0 && (
                            <div className={styles.trayEmpty}>No articles in this world yet.</div>
                        )}
                    </div>
                </aside>
            )}
```

- [ ] **Step 5: CSS** — append to `HierarchyCanvas.module.css` (check `.main` is `position: relative` or flex — adjust tray positioning to the file's existing layout; the tray should be a right-side column ~260px wide, full height):

```css
/* --- Article tray (Sprint 70: drag articles onto type chips) --- */

.articleTray {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 260px;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-left: 1px solid var(--border);
    z-index: 20;
}
.trayHeader { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 14px 8px; color: var(--foreground); }
.trayFilter { flex: 1; min-width: 0; padding: 6px 9px; border-radius: 7px; border: 1px solid var(--border); background: var(--background); color: var(--foreground); font-size: 0.8rem; }
.trayHint { padding: 0 14px 10px; margin: 0; color: var(--muted, #888); font-size: 0.72rem; }
.trayList { flex: 1; overflow-y: auto; padding: 0 10px 14px; display: flex; flex-direction: column; gap: 6px; }
.trayCard {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 8px;
    background: var(--background); border: 1px solid var(--border);
    cursor: grab; user-select: none;
}
.trayCard:active { cursor: grabbing; }
.trayIcon { flex: none; }
.trayName { flex: 1; min-width: 0; color: var(--foreground); font-size: 0.82rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trayType { flex: none; color: var(--muted, #888); font-size: 0.68rem; }
.trayEmpty { padding: 20px 6px; color: var(--muted, #888); font-size: 0.8rem; text-align: center; }

.chipDropTarget {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}
```

(If `.main` is not positioned, add `position: relative;` to it. If the tray overlaps the canvas scroll area awkwardly, give `.canvasViewport` a `margin-right: 260px` when not draft — implementer judgment, note the choice.)

- [ ] **Step 6: Verify** — `npx tsc --noEmit && npx vitest run && npm run build` (70 tests).

- [ ] **Step 7: Commit**

```bash
git add -A src/
git commit -m "feat: hierarchy canvas article tray with drag-onto-chip refiling"
```

---

### Task 6: Full verification (no new code)

- [ ] **Step 1: Statics** — `npx tsc --noEmit && npx vitest run && npm run build`; eslint on all touched files shows no NEW issues vs baseline (repo has pre-existing noise — compare, don't fix unrelated).

- [ ] **Step 2: Preview — book selector.** On the Bookshelf: hover a shelf's book (cover swings open, page shows "Open / the lore / scroll ↕"). Dispatch wheel events on the `figure` → verb rolls Open → Edit → Organize → wraps to Open; wheel-up goes back. Click on "Edit" → lands on the Edit page with the right shelf's title; ArrowDown+Enter works; the bookshelf page does NOT scroll while wheeling over the book.

- [ ] **Step 3: Preview — Edit page.** Change cover title/subtitle/tint → flat preview updates live; back to Bookshelf → the 3D book cover shows the new identity. Apply the Fantasy preset → confirm prompt when layout customized → World Bible strips re-group accordingly (no articles lost). Danger zone: Reset restores the standard four; Clear shows the correct count, deletes only this shelf's articles.

- [ ] **Step 4: Preview — Organize tray.** Book → Organize → canvas shows this shelf's layout + right-side tray listing its articles. Drag a tray card onto a different category's type chip (synthesize DragEvents with a `new DataTransfer()` carrying `entityId`) → entity's type changes → article appears under the new category in the World Bible strips. Type-chip drags between nodes still work (regression check). Draft mode shows no tray.

- [ ] **Step 5: Cleanup + report.** Remove any test worlds/articles created during verification from BOTH localStorage and the live store (UI-driven), reload to confirm the user's real workspace is intact. Report pass/fail per check.
