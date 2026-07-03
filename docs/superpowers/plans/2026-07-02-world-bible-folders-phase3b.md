# World Bible Folders — Phase 3B (Folder Tree UI + View Sweep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Phase 3A's dormant folder data visible: a file-explorer folder tree replaces the HierarchyCanvas as the Organize view, and every browse surface (strips + sidebar drill-down) switches from type-bucketing to true `categoryId` membership, with Unfiled surfacing.

**Architecture:** New `WorldBibleFolderTree` (recursive rows, native HTML5 drag with the established `entityId`/`folderId` dataTransfer channels, two-click+auto-disarm deletes) rendered by the existing `'hierarchy'` mode and by the Designer's draft flow. `HierarchyCanvas` is deleted. The sidebar's type-based Subcategory level is deleted; `WorldBibleRoot` becomes a uniform folder view (child-folder cards + absorbed article grid). One new pure helper `folderMemberSet` powers counts everywhere.

**Tech Stack:** Next.js 16 (Turbopack), React 19, TypeScript, Zustand, Vitest, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-07-02-world-bible-folders-design.md` (Parts 2–3). Phase 3A (merged): `Entity.categoryId`, folder-aware store actions (`deleteWorldBibleRoot` re-parents + re-files world-scoped, cycle guard, `applyBibleLayout`), `fileByType`/`getDescendantIds`/`wouldCreateCycle` in `src/lib/folderTree.ts`, v4 migration filed every article.

**Verification baseline:** `npx vitest run` → 88 tests; `npx tsc --noEmit` clean; `npm run build` succeeds.

**Design decisions locked at plan time (from spec deferrals):**
- Article click in the tree = select/highlight only (deep-open is NOT cheap: `focusedArticleEntityId` only auto-closes a panel — no open path exists). Deep-open lands later.
- Sidebar: `WBView`'s `subcategory` level is REMOVED; folder drill recurses through the existing `{ level: 'root', root: <folderId> }` shape. `WorldBibleSubcategory` is deleted; its card grid + favorite toggle + creator are absorbed into `WorldBibleRoot`.
- `WorldBibleHome` category cards show CHILD-FOLDER pills (was: type pills). Counts everywhere = folder member set (self + descendants).
- Unfiled = `!e.categoryId || !validIds.has(e.categoryId)` (dangling ids count as unfiled, per spec edge case).
- Tree root drop-zone accepts FOLDER drops only (make top-level). Articles can't be dropped there (no accidental unfiling); dragging an article out of Unfiled files it into the target folder.

---

### Task 1: `folderMemberSet` helper (TDD)

**Files:**
- Modify: `src/lib/folderTree.ts`, `src/lib/folderTree.test.ts`

- [ ] **Step 1: Failing tests** — append to the existing describe (which defines `roots` = a/a1/a1x/b):

```ts
    it('folderMemberSet includes the folder itself plus all descendants', () => {
        expect([...folderMemberSet(roots, 'a')].sort()).toEqual(['a', 'a1', 'a1x']);
        expect([...folderMemberSet(roots, 'b')]).toEqual(['b']);
    });

    it('folderMemberSet tolerates unknown ids', () => {
        expect([...folderMemberSet(roots, 'nope')]).toEqual(['nope']);
    });
```
(Import `folderMemberSet` in the test file's import line.)

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — append to `folderTree.ts`:

```ts
/** The folder itself plus every descendant — the membership set for counts. */
export function folderMemberSet(
    roots: ReadonlyArray<FolderLike | null | undefined>,
    folderId: string,
): Set<string> {
    const out = getDescendantIds(roots, folderId);
    out.add(folderId);
    return out;
}
```

- [ ] **Step 4: Verify + commit** — `npx vitest run` (90 = 88 + 2), `npx tsc --noEmit`.

```bash
git add src/lib/folderTree.ts src/lib/folderTree.test.ts
git commit -m "feat: folderMemberSet helper for folder-scoped counts"
```

---

### Task 2: `WorldBibleFolderTree` replaces the canvas

**Files:**
- Create: `src/components/world/WorldBibleFolderTree.tsx`
- Create: `src/components/world/WorldBibleFolderTree.module.css`
- Modify: `src/app/page.tsx` (hierarchy branch)
- Modify: `src/components/world/Designer.tsx` (draft render, ~line 284)
- Delete: `src/components/world/HierarchyCanvas.tsx`, `src/components/world/HierarchyCanvas.module.css`

- [ ] **Step 1: Component** — create with EXACTLY this content:

```tsx
// src/components/world/WorldBibleFolderTree.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useWorkspaceStore, EntityType, WorldBibleRootConfig } from '@/store/workspaceStore';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';
import { folderMemberSet } from '@/lib/folderTree';
import styles from './WorldBibleFolderTree.module.css';

const CONFIRM_TIMEOUT_MS = 4000;

const TYPE_ICONS: Record<EntityType, string> = {
    character: '👤', location: '📍', faction: '📦', artifact: '⚔️',
    lore: '🧙', magic: '🔮', religion: '📜', species: '🌿',
};

interface WorldBibleFolderTreeProps {
    /** Draft mode: edits draftHierarchyLayout, folders only (no articles). */
    isDraft?: boolean;
}

/**
 * WorldBibleFolderTree — the Organize view. A standard file-explorer tree:
 * nested folders (add / inline rename / drag to re-nest / two-click delete)
 * with this world's articles filed inside them. Replaces the old free-floating
 * HierarchyCanvas. Drag an article row onto a folder row to re-file it; drag
 * a folder onto another folder to nest it (the store's cycle guard rejects
 * loops). An Unfiled section catches articles without a valid folder.
 */
export default function WorldBibleFolderTree({ isDraft }: WorldBibleFolderTreeProps) {
    const worldBibles = useWorkspaceStore(s => s.worldBibles);
    const activeWorldKey = useWorkspaceStore(s => s.activeWorldKey) ?? STANDALONE_KEY;
    const draftLayout = useWorkspaceStore(s => s.draftHierarchyLayout);
    const entities = useWorkspaceStore(s => s.entities);
    const addWorldBibleRoot = useWorkspaceStore(s => s.addWorldBibleRoot);
    const updateWorldBibleRoot = useWorkspaceStore(s => s.updateWorldBibleRoot);
    const deleteWorldBibleRoot = useWorkspaceStore(s => s.deleteWorldBibleRoot);
    const updateEntity = useWorkspaceStore(s => s.updateEntity);

    const layout = isDraft
        ? (draftLayout ?? { roots: [] })
        : getWorldBibleConfig(worldBibles, activeWorldKey).layout;
    const roots = layout.roots;
    const validIds = new Set(roots.map(r => r.id));

    const worldEntities = isDraft
        ? []
        : entities.filter(e => worldKeyForEntity(e) === activeWorldKey);
    const unfiled = worldEntities.filter(e => !e.categoryId || !validIds.has(e.categoryId));

    // UI state
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [confirming, setConfirming] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null); // folder id or '__root__'
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

    // Armed deletes auto-disarm (same pattern as the Edit page).
    useEffect(() => {
        if (!confirming) return;
        const t = setTimeout(() => setConfirming(null), CONFIRM_TIMEOUT_MS);
        return () => clearTimeout(t);
    }, [confirming]);

    const toggle = (id: string) =>
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });

    const addFolder = (parentId?: string) => {
        addWorldBibleRoot({
            id: crypto.randomUUID(),
            label: 'New Folder',
            icon: '📁',
            entityTypes: [],
            parentId,
        }, isDraft);
        if (parentId) setCollapsed(prev => { const n = new Set(prev); n.delete(parentId); return n; });
    };

    const handleDelete = (id: string) => {
        if (confirming !== id) { setConfirming(id); return; }
        deleteWorldBibleRoot(id, isDraft);
        setConfirming(null);
    };

    /** Shared drop handler for folder rows and the root zone. */
    const handleDrop = (e: React.DragEvent, targetFolderId: string | undefined) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(null);
        const entityId = e.dataTransfer.getData('entityId');
        const folderId = e.dataTransfer.getData('folderId');
        if (entityId && targetFolderId !== undefined && !isDraft) {
            updateEntity(entityId, { categoryId: targetFolderId });
        } else if (folderId && folderId !== targetFolderId) {
            // Store cycle guard silently rejects loops.
            updateWorldBibleRoot(folderId, { parentId: targetFolderId }, isDraft);
        }
    };

    /** dragover can't read getData; dataTransfer type keys are lowercased. */
    const acceptsDrag = (e: React.DragEvent, allowArticles: boolean) => {
        const t = e.dataTransfer.types;
        return t.includes('folderid') || (allowArticles && !isDraft && t.includes('entityid'));
    };

    const renderArticleRow = (entity: (typeof worldEntities)[number], depth: number) => (
        <div
            key={entity.id}
            className={`${styles.articleRow} ${selectedArticleId === entity.id ? styles.articleSelected : ''}`}
            style={{ paddingLeft: 34 + depth * 18 }}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('entityId', entity.id)}
            onDragEnd={() => setDragOverId(null)}
            onClick={() => setSelectedArticleId(entity.id)}
        >
            <span className={styles.articleIcon}>{TYPE_ICONS[entity.type]}</span>
            <span className={styles.articleName}>{entity.name}</span>
        </div>
    );

    const renderFolder = (folder: WorldBibleRootConfig, depth: number): React.ReactNode => {
        const children = roots.filter(r => r.parentId === folder.id);
        const articles = worldEntities.filter(e => e.categoryId === folder.id);
        const memberIds = folderMemberSet(roots, folder.id);
        const count = worldEntities.filter(e => e.categoryId && memberIds.has(e.categoryId)).length;
        const isCollapsed = collapsed.has(folder.id);
        const hasContents = children.length > 0 || articles.length > 0;

        return (
            <div key={folder.id}>
                <div
                    className={`${styles.folderRow} ${dragOverId === folder.id ? styles.dropTarget : ''}`}
                    style={{ paddingLeft: 8 + depth * 18 }}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('folderId', folder.id); }}
                    onDragEnd={() => setDragOverId(null)}
                    onDragOver={(e) => {
                        if (acceptsDrag(e, true)) { e.preventDefault(); e.stopPropagation(); setDragOverId(folder.id); }
                    }}
                    onDragLeave={() => setDragOverId(prev => prev === folder.id ? null : prev)}
                    onDrop={(e) => handleDrop(e, folder.id)}
                >
                    <button
                        className={styles.chevron}
                        onClick={() => toggle(folder.id)}
                        aria-label={isCollapsed ? 'Expand folder' : 'Collapse folder'}
                        disabled={!hasContents}
                    >
                        {hasContents ? (isCollapsed ? '▸' : '▾') : '·'}
                    </button>
                    <span className={styles.folderIcon}>{folder.icon}</span>
                    <input
                        className={styles.folderName}
                        value={folder.label}
                        onChange={(e) => updateWorldBibleRoot(folder.id, { label: e.target.value }, isDraft)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    {!isDraft && <span className={styles.count}>{count}</span>}
                    <div className={styles.rowActions}>
                        <button
                            className={styles.rowBtn}
                            title="Add subfolder"
                            onClick={() => addFolder(folder.id)}
                        >
                            ＋
                        </button>
                        <button
                            className={`${styles.rowBtn} ${confirming === folder.id ? styles.rowBtnDanger : ''}`}
                            title="Delete folder (contents move up)"
                            onClick={() => handleDelete(folder.id)}
                        >
                            {confirming === folder.id ? 'Sure?' : '×'}
                        </button>
                    </div>
                </div>
                {!isCollapsed && (
                    <>
                        {children.map(child => renderFolder(child, depth + 1))}
                        {articles.map(a => renderArticleRow(a, depth))}
                    </>
                )}
            </div>
        );
    };

    const topFolders = roots.filter(r => !r.parentId);

    return (
        <main className={styles.main}>
            <div
                className={`${styles.treePanel} ${dragOverId === '__root__' ? styles.dropTarget : ''}`}
                onDragOver={(e) => {
                    // Root zone accepts folders only (drag out to top level).
                    if (e.dataTransfer.types.includes('folderid')) { e.preventDefault(); setDragOverId('__root__'); }
                }}
                onDragLeave={() => setDragOverId(prev => prev === '__root__' ? null : prev)}
                onDrop={(e) => handleDrop(e, undefined)}
            >
                <div className={styles.header}>
                    <h2 className={styles.title}>{isDraft ? 'Template folders' : 'Organize'}</h2>
                    <button className={styles.newFolderBtn} onClick={() => addFolder(undefined)}>
                        ＋ New folder
                    </button>
                </div>
                <p className={styles.hint}>
                    {isDraft
                        ? 'Design the folder structure — drag folders to nest them.'
                        : 'Drag articles into folders. Drag folders onto each other to nest them.'}
                </p>

                <div className={styles.tree}>
                    {topFolders.map(f => renderFolder(f, 0))}
                    {topFolders.length === 0 && (
                        <p className={styles.empty}>No folders yet — create one to get started.</p>
                    )}
                </div>

                {!isDraft && unfiled.length > 0 && (
                    <div className={styles.unfiled}>
                        <h3 className={styles.unfiledTitle}>Unfiled</h3>
                        <p className={styles.unfiledHint}>Drag these into a folder to file them.</p>
                        {unfiled.map(a => renderArticleRow(a, 0))}
                    </div>
                )}
            </div>
        </main>
    );
}
```

- [ ] **Step 2: CSS module** — create with EXACTLY this content:

```css
/* WorldBibleFolderTree — file-explorer style Organize view (Sprint 72) */

.main { width: 100%; height: 100%; overflow-y: auto; background: var(--background); }
.treePanel { max-width: 720px; margin: 0 auto; padding: 32px 24px 80px; min-height: 100%; }
.treePanel.dropTarget { outline: 2px dashed var(--accent); outline-offset: -6px; border-radius: 12px; }

.header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.title { font-size: 1.4rem; font-weight: 700; color: var(--foreground); margin: 0; }
.newFolderBtn { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--foreground); font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.newFolderBtn:hover { border-color: var(--accent); }
.hint { color: var(--muted, #888); font-size: 0.8rem; margin: 0 0 18px; }

.tree { display: flex; flex-direction: column; gap: 2px; }

.folderRow {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 8px; border-radius: 8px;
    border: 1px solid transparent;
    cursor: grab;
}
.folderRow:hover { background: var(--surface); }
.folderRow:hover .rowActions { opacity: 1; }
.folderRow.dropTarget { border-color: var(--accent); background: var(--surface); }

.chevron { width: 20px; height: 20px; border: none; background: none; color: var(--muted, #888); cursor: pointer; font-size: 0.7rem; padding: 0; }
.chevron:disabled { cursor: default; opacity: 0.4; }
.folderIcon { flex: none; }
.folderName {
    flex: 1; min-width: 0;
    border: none; background: transparent; color: var(--foreground);
    font-size: 0.92rem; font-weight: 600; padding: 2px 4px; border-radius: 4px;
}
.folderName:focus { outline: 1px solid var(--accent); background: var(--background); }
.count { flex: none; font-size: 0.72rem; color: var(--muted, #888); background: var(--background); border: 1px solid var(--border); border-radius: 999px; padding: 1px 8px; }

.rowActions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.12s; }
.rowBtn { width: 26px; height: 22px; border: none; border-radius: 5px; background: transparent; color: var(--muted, #888); cursor: pointer; font-size: 0.85rem; line-height: 1; }
.rowBtn:hover { background: var(--border); color: var(--foreground); }
.rowBtnDanger { width: auto; padding: 0 8px; background: rgba(220, 80, 80, 0.15); color: #e07070; font-size: 0.72rem; font-weight: 700; }

.articleRow {
    display: flex; align-items: center; gap: 8px;
    padding: 4px 8px; border-radius: 6px; cursor: grab;
    color: var(--foreground);
}
.articleRow:hover { background: var(--surface); }
.articleSelected { background: var(--surface); outline: 1px solid var(--accent); }
.articleIcon { flex: none; font-size: 0.8rem; }
.articleName { flex: 1; min-width: 0; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.empty { color: var(--muted, #888); font-size: 0.88rem; padding: 18px 4px; }

.unfiled { margin-top: 26px; border-top: 1px solid var(--border); padding-top: 14px; }
.unfiledTitle { font-size: 0.95rem; font-weight: 700; color: var(--foreground); margin: 0 0 2px; }
.unfiledHint { color: var(--muted, #888); font-size: 0.75rem; margin: 0 0 8px; }
```

- [ ] **Step 3: Route it.** `src/app/page.tsx`: replace the lazy import `const HierarchyCanvas = lazy(() => import('@/components/world/HierarchyCanvas'));` with `const WorldBibleFolderTree = lazy(() => import('@/components/world/WorldBibleFolderTree'));` and the mode-chain branch `<HierarchyCanvas />` → `<WorldBibleFolderTree />`.

- [ ] **Step 4: Designer draft port.** In `Designer.tsx` (~line 284 area), the hierarchy-template screen renders `<HierarchyCanvas isDraft ... />` — swap import + usage to `<WorldBibleFolderTree isDraft />` (READ the surrounding code; keep every prop/flow around it — apply/save-template buttons etc. stay).

- [ ] **Step 5: Delete** `HierarchyCanvas.tsx` + `HierarchyCanvas.module.css`. Then `grep -rn "HierarchyCanvas" src/` → zero hits.

- [ ] **Step 6: Verify** — `npx tsc --noEmit && npx vitest run && npm run build` (90). Eslint touched files vs baseline.

- [ ] **Step 7: Commit**

```bash
git add -A src/
git commit -m "feat: folder tree replaces hierarchy canvas as the organize view"
```

---

### Task 3: Strips follow folders (WorldBibleCenter)

**Files:**
- Modify: `src/components/world/WorldBibleCenter.tsx`
- Modify: `src/components/world/WorldBibleCenter.module.css` (small additions)

- [ ] **Step 1: Membership plumbing.** Import `folderMemberSet` from `@/lib/folderTree`. After `worldEntities` is computed, add:

```ts
    const topFolders = layout.roots.filter(r => !r.parentId);
    const validIds = new Set(layout.roots.map(r => r.id));
    const unfiledEntities = worldEntities.filter(e => !e.categoryId || !validIds.has(e.categoryId));
```

Strip count math becomes: `const stripCount = topFolders.length + (unfiledEntities.length > 0 ? 1 : 0) + 1;` and the strip map iterates `topFolders` instead of `layout.roots`.

- [ ] **Step 2: Per-strip membership.** Inside the strip map, replace `const bucketEntities = worldEntities.filter(e => root.entityTypes.includes(e.type));` with:

```ts
                    const memberIds = folderMemberSet(layout.roots, root.id);
                    const bucketEntities = worldEntities.filter(e => e.categoryId && memberIds.has(e.categoryId));
                    const directArticles = bucketEntities.filter(e => e.categoryId === root.id);
                    const childFolders = layout.roots.filter(r => r.parentId === root.id);
```

- [ ] **Step 3: Expanded strip body.** Extract the existing entity-card JSX into a local `renderCard(entity)` helper (same markup: thumb/color block, name, article badge). The expanded inner becomes: the existing head + creator UNCHANGED, but the grid section is replaced by:

```tsx
                                        {bucketEntities.length === 0 ? (
                                            <p className={styles.stripEmpty}>
                                                No articles in {root.label.toLowerCase()} yet — add your first article below.
                                            </p>
                                        ) : (
                                            <>
                                                {directArticles.length > 0 && (
                                                    <div className={styles.entityGrid}>
                                                        {directArticles.map(renderCard)}
                                                    </div>
                                                )}
                                                {childFolders.map(child => {
                                                    const childMembers = folderMemberSet(layout.roots, child.id);
                                                    const childArticles = worldEntities.filter(e => e.categoryId && childMembers.has(e.categoryId));
                                                    if (childArticles.length === 0) return null;
                                                    return (
                                                        <div key={child.id} className={styles.subfolderSection}>
                                                            <h3 className={styles.subfolderTitle}>
                                                                {child.icon} {child.label}
                                                                <span className={styles.subfolderCount}>{childArticles.length}</span>
                                                            </h3>
                                                            <div className={styles.entityGrid}>
                                                                {childArticles.map(renderCard)}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        )}
```

(One level of subfolder sections — grandchild articles roll up into their nearest child section, per spec.)

- [ ] **Step 4: Unfiled strip.** After the `topFolders.map(...)` strips and BEFORE the Add Category strip, when `unfiledEntities.length > 0` render one extra strip (same `<article>` structure, `key="__unfiled__"`, icon `🗂️`, label `Unfiled`, background `#3a3a44`, positioned at index `topFolders.length`): expanded body = head + a plain `entityGrid` of `unfiledEntities.map(renderCard)` — NO new-article creator inside it. (The Add Category strip's index shifts by the extra strip — keep the `left` math consistent by tracking the running index.)

- [ ] **Step 5: Vestigial x/y.** In `handleAddCategory`, drop the `x: 120, y: 120` fields.

- [ ] **Step 6: CSS additions** — append to `WorldBibleCenter.module.css`:

```css
.subfolderSection { margin-top: 18px; }
.subfolderTitle { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; font-weight: 700; margin: 0 0 8px; }
.subfolderCount { font-size: 0.7rem; opacity: 0.75; background: rgba(0,0,0,0.25); border-radius: 999px; padding: 1px 8px; }
```

- [ ] **Step 7: Verify + commit** — statics + build; eslint vs baseline.

```bash
git add -A src/
git commit -m "feat: world bible strips browse by folder membership with unfiled strip"
```

---

### Task 4: Sidebar drill-down goes folder-based

**Files:**
- Modify: `src/lib/worldBibleNav.ts` (`WBView`)
- Modify: `src/components/world/WorldBible.tsx` (router)
- Modify: `src/components/world/WorldBibleNav.tsx` (breadcrumb)
- Modify: `src/components/world/WorldBibleHome.tsx` (cards + pills)
- Modify: `src/components/world/WorldBibleRoot.tsx` (becomes the folder view; absorbs the article grid)
- Modify: `src/components/world/WorldBibleRoot.module.css` (absorb needed card styles)
- Delete: `src/components/world/WorldBibleSubcategory.tsx`, `WorldBibleSubcategory.module.css`

- [ ] **Step 1: WBView.** In `worldBibleNav.ts`, remove the `subcategory` variant:

```ts
export type WBView =
    | { level: 'home' }
    | { level: 'root'; root: string }   // root = any folder id — drill recurses through this
    | { level: 'entry'; entityId: string };
```

- [ ] **Step 2: Router.** In `WorldBible.tsx`: delete the `subcategory` route block and the `WorldBibleSubcategory` import.

- [ ] **Step 3: Breadcrumb.** In `WorldBibleNav.tsx`: delete the `case 'subcategory'` block (and the now-unused `SUBCATEGORY_LABELS` import IF the `entry` case no longer needs it — the entry case uses it for the type label; keep it if so). Upgrade `case 'root'` to show the folder PATH (walk `parentId` chain, root-first, capped at 3 shown segments):

```ts
            case 'root': {
                const byId = new Map(layout.roots.map(r => [r.id, r]));
                const path: string[] = [];
                let cur = byId.get(currentView.root);
                while (cur) { path.unshift(cur.label); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
                const shown = path.slice(-3);
                return (
                    <>
                        <span className={styles.crumbMuted}>World Bible</span>
                        {shown.map((label, i) => (
                            <React.Fragment key={i}>
                                <span className={styles.crumbSep}>›</span>
                                {i === shown.length - 1 ? <span>{label}</span> : <span className={styles.crumbMuted}>{label}</span>}
                            </React.Fragment>
                        ))}
                    </>
                );
            }
```
(Ensure `React` is imported for `React.Fragment` — it already is via the default import.)

- [ ] **Step 4: Home.** In `WorldBibleHome.tsx`:
  - Import `folderMemberSet` from `@/lib/folderTree`; drop the now-unused `SUBCATEGORY_LABELS`/`SUBCATEGORY_ICONS` imports and the `countForType` helper.
  - Category cards iterate `layout.roots.filter(r => !r.parentId)`.
  - Card count: `const memberIds = folderMemberSet(layout.roots, root.id); const count = filteredEntities.filter(e => e.categoryId && memberIds.has(e.categoryId)).length;`
  - Pills become CHILD FOLDERS (compute the member set once per child, not per entity):

```tsx
                                <div className={styles.subcategoryPills}>
                                    {layout.roots.filter(r => r.parentId === root.id).map(child => {
                                        const childMembers = folderMemberSet(layout.roots, child.id);
                                        const childCount = filteredEntities.filter(e => e.categoryId && childMembers.has(e.categoryId)).length;
                                        return (
                                            <span key={child.id} className={styles.subcategoryPill}>
                                                {child.icon} {child.label} ({childCount})
                                            </span>
                                        );
                                    })}
                                </div>
```
  When a card has no children, this renders an empty pills row — acceptable (or skip the wrapper when empty; implementer's choice).
  - Remove the `as any` on the navigate call (`root: root.id` is already a string).
  - Add an Unfiled card AFTER the folder cards when unfiled articles exist (same card markup, icon `🗂️`, label `Unfiled`, `onClick` DISABLED for v1 — `title="File these from the Organize view"`, no chevron): `const validIds = new Set(layout.roots.map(r => r.id)); const unfiledCount = filteredEntities.filter(e => !e.categoryId || !validIds.has(e.categoryId)).length;`

- [ ] **Step 5: Root → folder view.** Rewrite `WorldBibleRoot.tsx`'s body (keep the component name/file and its custom-category button):
  - Keep: header (folder label), the `+ Custom Category` button (drop its `x/y` fields; it already sets `parentId: root`).
  - Child-folder cards: `layout.roots.filter(r => r.parentId === root)` — same card style as before but `onClick={() => onNavigate({ level: 'root', root: child.id })}`, count via `folderMemberSet`.
  - Article grid: absorb `WorldBibleSubcategory`'s card grid verbatim (image area w/ type-color fallback, favorite toggle via `toggleEntityFavorite`, name + description, `onClick` → `{ level: 'entry', entityId }`), but the list is `worldEntities.filter(e => e.categoryId === root)` (direct articles only — deeper ones are reached by drilling into child folders). Bring `ENTITY_TYPE_COLORS` and the needed store subscriptions (`toggleEntityFavorite`, `openInlineCreator`) across, plus a `+ New Entry` button (opens `openInlineCreator()`), and Subcategory's empty state (generic copy: "Nothing filed here yet").
  - Copy the required card-grid CSS classes from `WorldBibleSubcategory.module.css` into `WorldBibleRoot.module.css` (rename-collision-free — check existing class names first).

- [ ] **Step 6: Delete** the two Subcategory files. `grep -rn "WorldBibleSubcategory" src/` → zero. Also `grep -rn "'subcategory'" src/` → zero.

- [ ] **Step 7: Verify + commit** — statics + build; eslint vs baseline.

```bash
git add -A src/
git commit -m "feat: sidebar drill-down navigates folders instead of type buckets"
```

---

### Task 5: Seed data files its articles

**Files:**
- Modify: `src/lib/betaSeedData.ts`

- [ ] **Step 1:** The seed world has no stored bible layout, so its views use the DEFAULT fallback whose stable folder ids are `people` / `places` / `things` / `world`. Add near the top of the file:

```ts
/** Default-layout folder for each seeded entity type (ids from DEFAULT_WORLD_BIBLE_LAYOUT). */
const SEED_FOLDER: Record<string, string> = {
    character: 'people', faction: 'people', species: 'people',
    location: 'places',
    artifact: 'things', lore: 'things',
    magic: 'world', religion: 'world',
};
```

- [ ] **Step 2:** Every seeded `store.addEntity({...})` literal (18 of them) gains `categoryId: SEED_FOLDER['<its type>'],` — hardcode the resolved string per literal or reference the map with the literal's type string; keep the file's existing one-line style.

- [ ] **Step 3: Verify + commit** — `npx tsc --noEmit && npx vitest run` (90).

```bash
git add src/lib/betaSeedData.ts
git commit -m "feat: seeded articles land filed in their default folders"
```

---

### Task 6: Full verification (no new code)

- [ ] **Step 1: Statics** — `npx tsc --noEmit && npx vitest run && npm run build`; repo eslint baseline-neutral.

- [ ] **Step 2: Preview — the tree.** Book → Organize (or nav): tree shows folders with counts. Create top folder + subfolder; rename inline; collapse/expand. Drag a folder onto another (nests), onto its own descendant (no-op — cycle guard), onto the panel background (goes top-level). Two-click delete with auto-disarm; deleting a folder with a child + article → child re-parents, article moves up.

- [ ] **Step 3: Preview — articles.** Create an article from a strip → appears in that folder in the tree. Drag it to another folder → strips reflect the move (it's now in the other strip). Drag from Unfiled (make one by deleting its top-level folder) into a folder.

- [ ] **Step 4: Preview — strips + sidebar.** Strips = top-level folders; expanded strip shows direct articles + child-folder sections; Unfiled strip only when needed. Sidebar: Home cards (folder counts + child pills) → drill into folder → child cards + article grid → entry. Breadcrumb shows the folder path.

- [ ] **Step 5: Preview — presets & draft.** Edit page: apply a preset → tree + strips re-group, nothing orphaned. Designer → hierarchy template: tree renders in draft mode (folders only, no articles/Unfiled).

- [ ] **Step 6: Cleanup + report.** Remove all test worlds/folders/articles from localStorage AND cloud (session gotchas memory applies: cloud-newer overwrites; use UI-driven cleanup or SQL). Report pass/fail per check.
