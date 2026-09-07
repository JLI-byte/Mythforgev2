# Phase 1 — Subtraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce LoreCanvas to the two nouns it claims — manuscript and lore — by withdrawing four work types, deleting ~2,600 lines of clone and dead code, and cutting the music panel.

**Architecture:** The work-type union in `src/lib/workTypes.ts` is the keystone. Narrowing it from five ids to one turns the TypeScript compiler into the worklist: every branch, registry entry and component that assumed five types becomes a compile error. Tests are updated first (they encode the old five-type contract), then the type narrows, then deletions follow the compiler. `pickZone` already falls back to `StoryWritingZone` for unknown modes, so existing projects created as a screenplay or visual novel keep all their content and open in the story zone with no data migration required.

**Tech Stack:** TypeScript (strict), React 19, Next 16, Zustand, Vitest (jsdom).

**Note on the test runner:** `vitest.config.ts` includes only `src/**/*.test.ts` — **not** `.test.tsx`. Component tests in `.tsx` do not run. Every test in this plan is `.test.ts`.

---

## Decisions this plan implements

From the roadmap (`2026-09-03-remediation-roadmap.md`):

1. **Story + lore only** — withdraw Screenplay, Visual Novel, Lyrics, Script/Report.
2. **Cut Music & Soundscapes.** The "trim 46 methods to 6" half of this decision turned out to be **already built** — see Task 9. Social Media Hub and Beta Feedback panel are **kept**.
4. **Withdraw the academic path** — the Script/Report withdrawal in decision 1 removes it.

### Correction to the dossier's cut list

The Completionist walkthrough listed six uncalled store actions for removal (`R3`). Three of them belong to features that decision 2 **kept**, so this plan does not delete them:

| Action | Verified status | Disposition |
|--------|-----------------|-------------|
| `deleteSocialPost` | Social Media Panel exists at `src/components/layout/SocialMediaPanel.tsx` and is kept | **Keep.** Wire in Phase 9 |
| `moveWorldBibleType` | World Bible is the kept differentiator | **Keep.** Wire in Phase 9 |
| `updateGlobalWidgets` | Subscribed at `WritingDesk.tsx:63` but never invoked — a dead subscription, not an unreferenced action | **Delete**, including the subscription line |
| `setSessionWordCount` | Zero component references | **Delete** |
| `setHoveredEntity` | Zero component references | **Delete** |
| `deleteHierarchyTemplate` | Zero component references | **Delete** |

---

## File Structure

**Deleted (~2,600 lines):**

| Path | Lines | Why |
|------|-------|-----|
| `src/components/editor/desk/widgets/zones/ScreenplayWritingZone.tsx` | 452 | Clone of Story zone, differs by 4 lines |
| `src/components/editor/desk/widgets/zones/LyricsWritingZone.tsx` | 452 | Clone of Story zone, differs by 4 lines |
| `src/components/editor/desk/widgets/zones/ReportWritingZone.tsx` | 452 | Clone of Story zone, differs by 4 lines |
| `src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx` | 582 | Work type withdrawn |
| `src/components/editor/ScreenplayEditor.tsx` | — | Work type withdrawn |
| `src/lib/screenplay/ScreenplayNodes.ts`, `ScreenplayKeymap.ts` | — | Work type withdrawn |
| `src/components/editor/vn/` (5 files) | — | Work type withdrawn |
| `src/lib/renpyExport.ts` + `renpyExport.test.ts` | 328 | Exporter for a withdrawn type |
| `src/lib/vnTimelineExport.ts` | 184 | Exporter for a withdrawn type |
| `src/lib/visualNovel.ts` + `visualNovel.test.ts` | 104 | Withdrawn type |
| `src/components/layout/MusicPlayerPanel.tsx` + `.module.css` | — | Decision 2 |
| `src/components/ui/SpotifyPlayer.tsx` + `.module.css` | — | Decision 2 + dead component |
| `src/components/ui/NewWorldModal.tsx` | — | Rendered by nothing |
| `src/components/world/Designer.tsx` | — | Rendered by nothing |
| `src/components/world/profile/CharacterProfile.tsx` | — | Rendered by nothing |
| `src/components/world/ArticleCanvas.tsx` | — | Rendered by nothing |
| `src/components/world/ArticleReadView.tsx` | — | Rendered by nothing |
| `src/components/navigation/BreadcrumbBar.tsx` | — | Rendered by nothing |
| `src/components/ui/ResizeDivider.tsx` | — | Rendered by nothing |

**Modified:**

| Path | Change |
|------|--------|
| `src/lib/workTypes.ts` | Union narrows to `'story'`; `WORK_TYPES` drops to one entry; `WritingMode` drops the withdrawn modes |
| `src/lib/workTypes.test.ts` | Rewritten for the one-type contract |
| `src/components/editor/desk/widgets/WritingZoneRenderer.tsx` | `ZONES` registry drops to one entry |
| `src/components/editor/desk/widgets/WritingZoneRenderer.test.ts` | Rewritten |
| `src/store/normaliseWithdrawnModes.ts` | **Created** — migration step |
| `src/store/normaliseWithdrawnModes.test.ts` | **Created** |
| `src/store/migrateWorkspaceSchema.ts` | Chain gains the new step |
| `src/store/workspaceStore.ts` | Four dead actions removed from interface + implementation |
| `src/app/page.tsx` | `MusicPlayerPanel` import and render removed |
| `src/components/editor/WritingDesk.tsx:63` | Dead `updateGlobalWidgets` subscription removed |
| `src/lib/writingMethods/index.ts` | Removes the unused `STARTER_METHODS` export |
| `README.md` | Withdrawn types removed from the feature list |

---

## Task 1: Narrow the work-type union to Story

**Files:**
- Modify: `src/lib/workTypes.ts`
- Test: `src/lib/workTypes.test.ts`

- [ ] **Step 1: Rewrite the test for the one-type contract**

Replace the entire contents of `src/lib/workTypes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { WORK_TYPES, getWorkType, getWorkTypeByWritingMode } from './workTypes';
import { getDraftType } from './writingMethods/draftTypes';

describe('WORK_TYPES', () => {
    it('offers exactly one choice — the product is manuscript and lore', () => {
        expect(WORK_TYPES.map(t => t.id)).toEqual(['story']);
    });

    it('gives every type a writing mode the store accepts', () => {
        const allowed = ['novel', 'real-world'];
        for (const t of WORK_TYPES) {
            expect(allowed).toContain(t.writingMode);
        }
    });

    it('only names draft types that actually exist', () => {
        for (const t of WORK_TYPES) {
            if (!t.draftTypeId) continue;
            expect(getDraftType(t.draftTypeId), `${t.id} → ${t.draftTypeId}`).toBeDefined();
        }
    });

    it('gives every type a label, icon and its own name placeholder', () => {
        const placeholders = new Set<string>();
        for (const t of WORK_TYPES) {
            expect(t.label.trim()).not.toBe('');
            expect(t.icon.trim()).not.toBe('');
            expect(t.desc.trim()).not.toBe('');
            expect(t.namePlaceholder.trim()).not.toBe('');
            placeholders.add(t.namePlaceholder);
        }
        expect(placeholders.size).toBe(WORK_TYPES.length);
    });
});

describe('getWorkType', () => {
    it('finds the story type by id', () => {
        expect(getWorkType('story')?.writingMode).toBe('novel');
    });

    it('returns undefined for withdrawn types', () => {
        expect(getWorkType('screenplay')).toBeUndefined();
        expect(getWorkType('script-report')).toBeUndefined();
        expect(getWorkType('lyrics')).toBeUndefined();
        expect(getWorkType('visual-novel')).toBeUndefined();
    });

    it('returns undefined for unknown, null or empty ids', () => {
        expect(getWorkType('nonsense')).toBeUndefined();
        expect(getWorkType(null)).toBeUndefined();
        expect(getWorkType(undefined)).toBeUndefined();
        expect(getWorkType('')).toBeUndefined();
    });
});

describe('getWorkTypeByWritingMode', () => {
    it('recovers the story type from its mode', () => {
        expect(getWorkTypeByWritingMode('novel')?.id).toBe('story');
    });

    it('returns undefined for withdrawn modes, so legacy projects fall back', () => {
        expect(getWorkTypeByWritingMode('screenplay')).toBeUndefined();
        expect(getWorkTypeByWritingMode('markdown')).toBeUndefined();
        expect(getWorkTypeByWritingMode('poetry')).toBeUndefined();
        expect(getWorkTypeByWritingMode('visual-novel')).toBeUndefined();
    });

    it('returns undefined for real-world and for missing modes', () => {
        expect(getWorkTypeByWritingMode('real-world')).toBeUndefined();
        expect(getWorkTypeByWritingMode(null)).toBeUndefined();
        expect(getWorkTypeByWritingMode(undefined)).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/workTypes.test.ts`

Expected: FAIL — `expected [ 'story', 'screenplay', 'script-report', 'lyrics', 'visual-novel' ] to deeply equal [ 'story' ]`

- [ ] **Step 3: Narrow the type**

Replace the entire contents of `src/lib/workTypes.ts`:

```typescript
/**
 * Work types — the first question when starting something new: WHAT are you
 * writing? LEAF MODULE (no store, no React).
 *
 * There is one, deliberately. Screenplay, Script/Report, Lyrics and Visual
 * Novel were withdrawn in Phase 1: each opened a clone of the story editor and
 * promised format-specific behaviour that was never built. The product is a
 * manuscript and the lore behind it.
 *
 * The type is kept as a list rather than collapsed away because the work-type
 * question is still asked at creation, and because a second first-class format
 * may earn its place later — but it will arrive finished, not as a clone.
 */

/** Mirrors Project['writingMode'] in the workspace store. */
export type WritingMode = 'novel' | 'real-world';

export interface WorkType {
    id: 'story';
    label: string;
    icon: string;
    desc: string;
    /** Editor the project opens in. */
    writingMode: WritingMode;
    /** Draft Table type id (from DRAFT_TYPES), when one genuinely fits. */
    draftTypeId?: string;
    /** Placeholder for the name field, so the example suits the work. */
    namePlaceholder: string;
}

export const WORK_TYPES: WorkType[] = [
    {
        id: 'story',
        label: 'Story',
        icon: '📖',
        desc: 'Novels, short fiction, anything prose',
        writingMode: 'novel',
        draftTypeId: 'novel',
        namePlaceholder: 'e.g. The Long Winter',
    },
];

export function getWorkType(id: string | null | undefined): WorkType | undefined {
    return WORK_TYPES.find(t => t.id === id);
}

/**
 * Recovers the work type from a project's writing mode — projects store the
 * mode, not the type they were created from. Undefined for 'real-world' and for
 * any withdrawn mode still sitting on a legacy project, both of which fall back
 * to the story zone.
 */
export function getWorkTypeByWritingMode(
    mode: string | null | undefined,
): WorkType | undefined {
    return WORK_TYPES.find(t => t.writingMode === mode);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/workTypes.test.ts`

Expected: PASS — 9 tests.

- [ ] **Step 5: Capture the compiler's worklist**

Run: `npx tsc --noEmit --pretty false > ../phase1-worklist.txt 2>&1; cat ../phase1-worklist.txt`

Expected: a list of errors in the files that assumed five work types. This is the checklist for Tasks 2–4. Do not fix them yet.

- [ ] **Step 6: Commit**

```bash
git add src/lib/workTypes.ts src/lib/workTypes.test.ts
git commit -m "refactor: narrow work types to Story

Screenplay, Script/Report, Lyrics and Visual Novel each opened a clone of
the story editor and promised format behaviour that was never built. The
build is intentionally broken by this commit; the following commits follow
the compiler through the deletions."
```

---

## Task 2: Delete the three clone zones and the visual novel zone

**Files:**
- Delete: `src/components/editor/desk/widgets/zones/ScreenplayWritingZone.tsx`
- Delete: `src/components/editor/desk/widgets/zones/LyricsWritingZone.tsx`
- Delete: `src/components/editor/desk/widgets/zones/ReportWritingZone.tsx`
- Delete: `src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx`
- Modify: `src/components/editor/desk/widgets/WritingZoneRenderer.tsx`
- Test: `src/components/editor/desk/widgets/WritingZoneRenderer.test.ts`

- [ ] **Step 1: Rewrite the test**

Replace the entire contents of `src/components/editor/desk/widgets/WritingZoneRenderer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pickZone } from './WritingZoneRenderer';
import { StoryWritingZone } from './zones/StoryWritingZone';

describe('pickZone', () => {
    it('sends the novel mode to the story zone', () => {
        expect(pickZone('novel')).toBe(StoryWritingZone);
    });

    it('falls back to the story zone for real-world and unset modes', () => {
        expect(pickZone('real-world')).toBe(StoryWritingZone);
        expect(pickZone(undefined)).toBe(StoryWritingZone);
        expect(pickZone(null)).toBe(StoryWritingZone);
        expect(pickZone('nonsense')).toBe(StoryWritingZone);
    });

    it('opens legacy projects of withdrawn types in the story zone, with their content intact', () => {
        expect(pickZone('screenplay')).toBe(StoryWritingZone);
        expect(pickZone('markdown')).toBe(StoryWritingZone);
        expect(pickZone('poetry')).toBe(StoryWritingZone);
        expect(pickZone('visual-novel')).toBe(StoryWritingZone);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/editor/desk/widgets/WritingZoneRenderer.test.ts`

Expected: FAIL — `pickZone('screenplay')` still returns `ScreenplayWritingZone`.

- [ ] **Step 3: Shrink the registry**

In `src/components/editor/desk/widgets/WritingZoneRenderer.tsx`, replace the doc comment, the five zone imports and the `ZONES` record with:

```typescript
/**
 * WritingZoneRenderer — hands the desk's centre widget to the writing zone
 * built for the project's medium.
 *
 * There is one zone. Four siblings were deleted in Phase 1: three were clones
 * of this one differing by four lines each, and the fourth served a withdrawn
 * work type. The dispatch is kept because it is the seam a genuinely different
 * second format would arrive through, and because legacy projects still carry
 * withdrawn writingMode values that must land somewhere.
 *
 * This file stays the only thing WidgetRenderer knows about, so the dispatch
 * can change without touching the desk.
 */

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getWorkTypeByWritingMode } from '@/lib/workTypes';
import { WritingZoneProps } from './zones/zoneTypes';
import { StoryWritingZone } from './zones/StoryWritingZone';

/** Work type id → the zone written for it. */
const ZONES: Record<string, React.ComponentType<WritingZoneProps>> = {
    'story': StoryWritingZone,
};
```

Leave `pickZone` and `WritingZoneRenderer` below it unchanged — the existing fallback already does the right thing.

- [ ] **Step 4: Delete the four zone files**

```bash
git rm src/components/editor/desk/widgets/zones/ScreenplayWritingZone.tsx \
       src/components/editor/desk/widgets/zones/LyricsWritingZone.tsx \
       src/components/editor/desk/widgets/zones/ReportWritingZone.tsx \
       src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/editor/desk/widgets/WritingZoneRenderer.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git rm --cached -r --ignore-unmatch . >/dev/null 2>&1 || true
git add -A src/components/editor/desk/widgets
git commit -m "refactor: delete the three clone zones and the VN zone

1,938 lines. ScreenplayWritingZone, LyricsWritingZone and ReportWritingZone
differed from StoryWritingZone by a doc comment and a function name."
```

---

## Task 3: Delete the screenplay editor and its ProseMirror nodes

**Files:**
- Delete: `src/components/editor/ScreenplayEditor.tsx`
- Delete: `src/lib/screenplay/ScreenplayNodes.ts`
- Delete: `src/lib/screenplay/ScreenplayKeymap.ts`
- Modify: whichever files the compiler reports (from Task 1 Step 5)

- [ ] **Step 1: Find every reference**

Run: `grep -rn "ScreenplayEditor\|ScreenplayNodes\|ScreenplayKeymap\|screenplay/" src --include=*.ts --include=*.tsx`

Expected: a short list. Note each file — these are the imports to remove in Step 3.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/editor/ScreenplayEditor.tsx
git rm -r src/lib/screenplay
```

- [ ] **Step 2b: Do NOT delete the entity-mention machinery it orphans**

`ScreenplayEditor.tsx:14-16,33-34` is the **only** place these three are mounted:

- `src/lib/EntitySuggest.ts`
- `src/lib/EntityMark.ts`
- `src/components/editor/EntitySuggestDropdown.tsx` (+ its `.module.css`)

Deleting the screenplay editor therefore removes the `@` entity-mention feature from the product, and
leaves those three files with no mount point. **Leave all three on disk.** The prose editor
(`DeskTipTapEditor.tsx:31-32`) loads only `StarterKit` and `FontSize` today; Phase 4 mounts this
machinery there with a `[[` trigger, which is what turns roadmap item `2e` from "build entity linking"
into "rewire the entity linking that already works".

Verify they survive this task:

```bash
ls src/lib/EntitySuggest.ts src/lib/EntityMark.ts src/components/editor/EntitySuggestDropdown.tsx
```

Expected: all three listed. A `tsc` pass will not complain about them — unmounted modules are not
compile errors — so this is a manual check, and an eslint unused-export warning here is expected and
should not be "fixed" by deleting them.

- [ ] **Step 3: Remove every import and use the grep found**

For each file listed in Step 1, delete the import line and the JSX or call site that used it. Where a component conditionally rendered `ScreenplayEditor` for `writingMode === 'screenplay'`, delete the whole branch — legacy screenplay projects now render the story editor by design.

`src/lib/sanitize.ts` references `data-screenplay-type` in its `ADD_ATTR` allow-list. **Leave that entry in place.** Existing users' saved screenplay HTML still carries the attribute, and stripping it would silently alter stored prose on the next sanitise pass.

- [ ] **Step 4: Verify the screenplay surface is gone**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep -i screenplay`

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete the screenplay editor and nodes

Withdrawn work type. sanitize.ts keeps data-screenplay-type in its allow-list
so previously saved screenplay HTML is not altered on the next sanitise.

This was also the only mount point for EntitySuggest, EntityMark and
EntitySuggestDropdown, so @ entity mentions stop working here. All three
modules are deliberately kept: Phase 4 mounts them in the prose editor
with a [[ trigger."
```

---

## Task 4: Delete the visual novel surfaces and exporters

**Files:**
- Delete: `src/components/editor/vn/` (5 files)
- Delete: `src/lib/renpyExport.ts`, `src/lib/renpyExport.test.ts`
- Delete: `src/lib/vnTimelineExport.ts`
- Delete: `src/lib/visualNovel.ts`, `src/lib/visualNovel.test.ts`

- [ ] **Step 1: Find every reference**

Run: `grep -rn "renpyExport\|vnTimelineExport\|visualNovel\|editor/vn" src --include=*.ts --include=*.tsx`

Expected: references in `src/lib/export.ts`, the VN timeline toolbar, and the store. Note each.

- [ ] **Step 2: Delete the files**

```bash
git rm -r src/components/editor/vn
git rm src/lib/renpyExport.ts src/lib/renpyExport.test.ts \
       src/lib/vnTimelineExport.ts \
       src/lib/visualNovel.ts src/lib/visualNovel.test.ts
```

- [ ] **Step 3: Remove every import and use**

For each file from Step 1, delete the import and the call site. In `src/lib/export.ts`, remove the Ren'Py export entry from whatever menu or switch offers it.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep -iE "renpy|vntimeline|visualnovel|editor/vn"`

Expected: no output.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`

Expected: PASS. The `renpyExport` and `visualNovel` suites are gone; nothing else referenced them.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: delete the visual novel surfaces and exporters

616 lines across renpyExport, vnTimelineExport and visualNovel, plus the
five components under editor/vn. The Ren'Py output was valid but three
connections short of usable; the work type is withdrawn rather than finished."
```

---

## Task 5: Normalise withdrawn writing modes on hydrate

**Files:**
- Create: `src/store/normaliseWithdrawnModes.ts`
- Create: `src/store/normaliseWithdrawnModes.test.ts`
- Modify: `src/store/migrateWorkspaceSchema.ts`

**Why this task exists:** `pickZone` already falls back safely, so nothing is broken without this. But a project whose `writingMode` is `'visual-novel'` now describes a mode that does not exist, and every future reader of that field has to know the withdrawal history to interpret it. This normalises the data once, in the existing idempotent chain, so the stored state stays honest. Scene and document content is untouched.

- [ ] **Step 1: Write the failing test**

Create `src/store/normaliseWithdrawnModes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normaliseWithdrawnModes } from './normaliseWithdrawnModes';

describe('normaliseWithdrawnModes', () => {
    it('rewrites withdrawn modes to novel', () => {
        const out = normaliseWithdrawnModes({
            projects: [
                { id: 'a', writingMode: 'screenplay' },
                { id: 'b', writingMode: 'poetry' },
                { id: 'c', writingMode: 'markdown' },
                { id: 'd', writingMode: 'visual-novel' },
            ],
        });
        expect(out.projects.map((p: any) => p.writingMode))
            .toEqual(['novel', 'novel', 'novel', 'novel']);
    });

    it('leaves novel and real-world alone', () => {
        const out = normaliseWithdrawnModes({
            projects: [
                { id: 'a', writingMode: 'novel' },
                { id: 'b', writingMode: 'real-world' },
            ],
        });
        expect(out.projects.map((p: any) => p.writingMode))
            .toEqual(['novel', 'real-world']);
    });

    it('does not mutate the input', () => {
        const input = { projects: [{ id: 'a', writingMode: 'screenplay' }] };
        normaliseWithdrawnModes(input);
        expect(input.projects[0].writingMode).toBe('screenplay');
    });

    it('is idempotent', () => {
        const once = normaliseWithdrawnModes({
            projects: [{ id: 'a', writingMode: 'lyrics' }],
        });
        expect(normaliseWithdrawnModes(once)).toEqual(once);
    });

    it('preserves every other field on the project', () => {
        const out = normaliseWithdrawnModes({
            projects: [{ id: 'a', writingMode: 'screenplay', title: 'Salt', wordCount: 900 }],
        });
        expect(out.projects[0]).toEqual({
            id: 'a', writingMode: 'novel', title: 'Salt', wordCount: 900,
        });
    });

    it('tolerates a blob with no projects array', () => {
        expect(normaliseWithdrawnModes({})).toEqual({});
        expect(normaliseWithdrawnModes({ projects: undefined })).toEqual({ projects: undefined });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store/normaliseWithdrawnModes.test.ts`

Expected: FAIL — `Failed to resolve import "./normaliseWithdrawnModes"`.

- [ ] **Step 3: Write the migration step**

Create `src/store/normaliseWithdrawnModes.ts`:

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any -- raw persisted blobs are
   untyped by design at the migration boundary. */

/**
 * Phase 1 withdrew the Screenplay, Script/Report, Lyrics and Visual Novel work
 * types. Projects created under them still carry their writingMode, which now
 * names a mode that does not exist.
 *
 * Nothing breaks without this — pickZone already falls back to the story zone —
 * but the stored value would be a claim about the product that is no longer
 * true. This rewrites it once. Manuscript content is never touched: a
 * screenplay's scenes are still its scenes, now opened in the story editor.
 */

const WITHDRAWN = new Set(['screenplay', 'markdown', 'poetry', 'visual-novel']);

export function normaliseWithdrawnModes(data: Record<string, any>): Record<string, any> {
    if (!Array.isArray(data.projects)) return data;

    let changed = false;
    const projects = data.projects.map((p: any) => {
        if (!p || !WITHDRAWN.has(p.writingMode)) return p;
        changed = true;
        return { ...p, writingMode: 'novel' };
    });

    return changed ? { ...data, projects } : data;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/store/normaliseWithdrawnModes.test.ts`

Expected: PASS — 6 tests.

- [ ] **Step 5: Add it to the migration chain**

In `src/store/migrateWorkspaceSchema.ts`, add the import and extend the chain:

```typescript
import { migratePerShelfBibles } from './migratePerShelfBibles';
import { migrateArticleFolders } from './migrateArticleFolders';
import { normaliseWithdrawnModes } from './normaliseWithdrawnModes';

export function migrateWorkspaceSchema(data: Record<string, any>): Record<string, any> {
    return normaliseWithdrawnModes(migrateArticleFolders(migratePerShelfBibles(data)));
}
```

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/store/normaliseWithdrawnModes.ts src/store/normaliseWithdrawnModes.test.ts src/store/migrateWorkspaceSchema.ts
git commit -m "feat: normalise withdrawn writing modes on hydrate

Projects created as a screenplay, report, lyric or visual novel now store
writingMode 'novel'. Content is untouched; only the mode label changes."
```

---

## Task 6: Cut Music & Soundscapes

**Files:**
- Delete: `src/components/layout/MusicPlayerPanel.tsx`, `MusicPlayerPanel.module.css`
- Delete: `src/components/ui/SpotifyPlayer.tsx`, `SpotifyPlayer.module.css`
- Modify: `src/app/page.tsx:8` (import), `src/app/page.tsx:241` (render)

- [ ] **Step 1: Find every reference**

Run: `grep -rn "MusicPlayerPanel\|SpotifyPlayer\|musicPanel\|isMusicOpen" src --include=*.ts --include=*.tsx`

Expected: the import and render in `src/app/page.tsx`, plus any open/close state and the control that toggles it.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/layout/MusicPlayerPanel.tsx \
       src/components/layout/MusicPlayerPanel.module.css \
       src/components/ui/SpotifyPlayer.tsx \
       src/components/ui/SpotifyPlayer.module.css
```

- [ ] **Step 3: Remove the import, the render and the toggle**

In `src/app/page.tsx`, delete the import at line 8 and the `<MusicPlayerPanel … />` render at line 241. Delete the state variable that controlled its visibility and the button that toggled it — a control that opens nothing is worse than no control.

If the store holds music state, remove those keys from the store interface, the implementation and `partializeWorkspace`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep -iE "music|spotify"`

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: cut the Music & Soundscapes panel

Not manuscript, not lore, not momentum. Writers already have a music player."
```

---

## Task 7: Delete the seven components nothing renders

**Files:**
- Delete: `src/components/ui/NewWorldModal.tsx`, `src/components/world/Designer.tsx`, `src/components/world/profile/CharacterProfile.tsx`, `src/components/world/ArticleCanvas.tsx`, `src/components/world/ArticleReadView.tsx`, `src/components/navigation/BreadcrumbBar.tsx`, `src/components/ui/ResizeDivider.tsx`

`SpotifyPlayer` was the eighth and went in Task 6.

- [ ] **Step 1: Confirm each is genuinely unrendered**

Run this and read the output before deleting anything:

```bash
for f in NewWorldModal Designer CharacterProfile ArticleCanvas ArticleReadView BreadcrumbBar ResizeDivider; do
  echo "== $f: $(grep -rn "<$f[ />]" src --include=*.tsx | wc -l) JSX uses"
done
```

Expected: `0 JSX uses` for all seven. **If any is non-zero, stop and do not delete that file** — a dossier finding was wrong and the item needs re-checking.

- [ ] **Step 2: Delete them**

```bash
git rm src/components/ui/NewWorldModal.tsx \
       src/components/world/Designer.tsx \
       src/components/world/profile/CharacterProfile.tsx \
       src/components/world/ArticleCanvas.tsx \
       src/components/world/ArticleReadView.tsx \
       src/components/navigation/BreadcrumbBar.tsx \
       src/components/ui/ResizeDivider.tsx
```

Delete any `.module.css` sitting beside them with the same basename.

- [ ] **Step 3: Remove now-dangling imports**

Run: `npx tsc --noEmit --pretty false 2>&1 | head -40`

Delete each import the compiler names. Some files import these without rendering them — that is why they showed zero JSX uses.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false`

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete seven components nothing renders"
```

---

## Task 8: Delete four dead store actions and one dead subscription

**Files:**
- Modify: `src/store/workspaceStore.ts` — remove `setSessionWordCount`, `setHoveredEntity`, `deleteHierarchyTemplate`, `updateGlobalWidgets` from both the interface and the implementation
- Modify: `src/components/editor/WritingDesk.tsx:63`

**Keep** `deleteSocialPost` and `moveWorldBibleType` — they belong to the Social Media Hub and the World Bible, both of which survive. They are wired up in Phase 7.

- [ ] **Step 1: Confirm each is dead**

```bash
for a in setSessionWordCount setHoveredEntity deleteHierarchyTemplate; do
  echo "== $a: $(grep -rn "$a" src --include=*.tsx | wc -l) component refs"
done
echo "== updateGlobalWidgets:"; grep -rn "updateGlobalWidgets" src --include=*.tsx
```

Expected: `0 component refs` for the first three. For `updateGlobalWidgets`, exactly one line — the subscription at `WritingDesk.tsx:63`, with no call site. **If any shows a call site, stop and leave that action in place.**

- [ ] **Step 2: Remove the dead subscription**

In `src/components/editor/WritingDesk.tsx`, delete line 63:

```typescript
  const updateGlobalWidgets = useWorkspaceStore(s => s.updateGlobalWidgets);
```

- [ ] **Step 3: Remove the four actions from the store**

In `src/store/workspaceStore.ts`, delete the interface declaration and the implementation for each of `setSessionWordCount`, `setHoveredEntity`, `deleteHierarchyTemplate`, `updateGlobalWidgets`.

If any of them is the only writer of a persisted state key, remove that key from the interface, the initial state and `partializeWorkspace` too. Check with:

```bash
grep -n "hoveredEntity\|sessionWordCount\|globalWidgets" src/store/workspaceStore.ts
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/workspaceStore.ts src/components/editor/WritingDesk.tsx
git commit -m "refactor: delete four uncalled store actions

deleteSocialPost and moveWorldBibleType are deliberately kept — the Social
Hub and World Bible both survive Phase 1 and both are wired in Phase 9."
```

---

## Task 9: Delete the unused STARTER_METHODS export

**Files:**
- Modify: `src/lib/writingMethods/index.ts`

**This task is much smaller than the dossier implies. Read this before starting.**

The Focus walkthrough asked to "cut 46 writing methods down to six, keep the library as a
drawer". Verification shows **that design is already built and already shipping.**
`src/components/editor/desk/MethodLibrary.tsx` has three-tier progressive disclosure:

| Tier | Shows | Control |
|------|-------|---------|
| Default | `Recommended for <draft type>` — a short list | — |
| 2 | `methodsForType(draftType)` | "Browse all N methods for <type> ▾" (line 126) |
| 3 | All 46, grouped by family | "Show every method, all formats" (line 147) |

A user never faces 46 methods unless they ask twice. **No UI work is required, and none should
be done** — building a `<details>` drawer here would duplicate an existing, better one.

What is genuinely wrong is smaller: `STARTER_METHODS` (`src/lib/writingMethods/index.ts:26`)
filters the six methods flagged `starter: true` and is imported by **zero components**. It is an
unused export — dead code of exactly the kind Task 7 and Task 8 remove.

- [ ] **Step 1: Confirm the disclosure exists**

Run: `grep -n "isBrowsingAll\|isShowingEverything\|Recommended for" src/components/editor/desk/MethodLibrary.tsx`

Expected: matches at roughly lines 43, 44, 60, 114, 126, 131, 146, 147 — the three tiers.
**If these are absent, stop.** The verification behind this task was wrong and the original
"six + drawer" task needs writing after all.

- [ ] **Step 2: Confirm STARTER_METHODS has no consumer**

Run: `grep -rn "STARTER_METHODS" src`

Expected: exactly one line — the declaration in `src/lib/writingMethods/index.ts`.
**If any component imports it, stop and leave it in place.**

- [ ] **Step 3: Delete the export**

In `src/lib/writingMethods/index.ts`, delete these two lines:

```typescript
/** The six flagship methods shown before "browse all". */
export const STARTER_METHODS: WritingMethod[] = WRITING_METHODS.filter(m => m.starter);
```

**Leave the `starter` flag on the method records themselves.** It is a truthful piece of
editorial metadata about which six methods are flagship, it costs nothing, and a future
first-run experience (Phase 5) is the natural consumer.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/writingMethods/index.ts
git commit -m "refactor: delete the unused STARTER_METHODS export

The method picker already does three-tier disclosure — recommended, then
all for the draft type, then everything — so the six-method export never
found a consumer. The starter flag stays on the records for Phase 5."
```

---

## Task 10: Correct the README and run the full regression

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Remove the withdrawn types from the README**

Delete every mention of Screenplay, Script/Report, Lyrics and Visual Novel as supported work types, and remove the Ren'Py export claim.

**Leave the `[[` claim in place** — decision 3 is to implement it, and Phase 3 does exactly that. The other three false claims (offline/no-account, four AI providers, the consistency checker) are also corrected in Phase 3, alongside the feature work that makes the correction accurate.

- [ ] **Step 2: Full type check**

Run: `npx tsc --noEmit --pretty false`

Expected: no output.

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`

Expected: PASS, with the `renpyExport`, `visualNovel` and old five-type suites gone.

- [ ] **Step 4: Lint**

**Baseline:** `npx eslint src` reports **377 problems (248 errors, 129 warnings)** on the tree as it
stands — measured, not estimated, and mostly pre-existing `no-explicit-any` in `workspaceStore.ts`.
Clean is not achievable and is not the gate. The gate is **no increase**: deletions should move this
number DOWN. If it rises, a deletion left something behind — fix it rather than suppressing it.

```bash
npx eslint src 2>&1 | tail -1
```

Expected: a total of 377 or lower.

- [ ] **Step 5: Production build**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 6: Measure what came out**

```bash
git diff --stat HEAD~9
```

Expected: roughly 2,600 deletions. Record the real number — Phase 6 estimates its own scope from what is left.

- [ ] **Step 7: Manual smoke test**

Start the dev server and confirm, in order:

1. Home loads, the shelf renders, no console errors.
2. Creating new work offers **Story only**.
3. An existing project opens in the story editor with all its scenes present.
4. If a legacy screenplay or visual-novel project exists, it opens in the story editor with its prose intact.
5. The Draft Table method picker shows six methods and a "More methods (40)" drawer that opens.
6. No music panel, and no control that opens one.
7. The World Bible and the Social Media Hub both still work — neither was in scope.

- [ ] **Step 8: Commit**

```bash
git add README.md
git commit -m "docs: remove withdrawn work types from the README

The [[ claim stays — Phase 3 implements it rather than retracting it."
```

---

## Definition of done

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green
- [ ] `npx eslint src` total is 377 or lower (it was 377 before this phase)
- [ ] `npm run build` succeeds
- [ ] Work-type picker offers Story only
- [ ] A legacy screenplay project opens in the story editor with its content intact
- [ ] Method picker shows 6, drawer holds 40, total still 46
- [ ] No music panel and no orphaned control that would open one
- [ ] World Bible and Social Media Hub unaffected
- [ ] ~2,600 lines deleted
