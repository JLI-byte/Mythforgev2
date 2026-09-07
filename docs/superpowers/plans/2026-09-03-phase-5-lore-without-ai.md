# Phase 5 — Lore Without AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the three lore features Phase 2 deleted — Interviews, Consistency & Gaps, Article Suggestions — as deterministic rules and a self-guided form. Instant, free, unit-testable, and incapable of inventing a finding that is not there.

**Architecture:** One new leaf module (`src/lib/loreRules.ts`) holds every rule as a separately exported pure function, so each is unit-tested in isolation with no React and no store. Two new components sit above it: `InterviewRunner` (a modal form) and `ResearchRail` (the host that mounts the Interviews launcher, the lore-check trigger, and the two existing widget renderers). The rules feed the **existing** `ConsistencyFlag` and `ArticleSuggestion` shapes through a thin adapter, so `ConsistencyFlagsRenderer` and `ArticleSuggestionsRenderer` render rule output without being rewritten. Rules land one per task, each green before the next.

**Tech Stack:** TypeScript (strict), React 19, Next 16, Zustand, Vitest (jsdom).

**Spec:** `../specs/2026-09-03-saas-conversion-design.md` Part 2. **Roadmap:** `2026-09-03-remediation-roadmap.md` Phase 5 (`L1`, `L2`, `L3`).

**Depends on:** Phase 2 (the chat is gone) and Phase 4 (`[[` linking exists, for `broken-link` only).

**Note on the test runner:** `vitest.config.ts:7` includes only `src/**/*.test.ts` — **not** `.test.tsx`. Every logic decision that needs coverage therefore lives in a `.ts` module. `InterviewRunner.tsx` gets no unit test, which is exactly why the article-building half of it is extracted into `src/lib/interviews/index.ts` as pure functions (Task 10) and the component is left with nothing but wiring.

---

## Where the spec and the codebase disagree — the codebase wins

Every one of these was checked by reading the file. **Follow the right-hand column.**

| # | Spec says | The repo actually has | Resolution |
|---|-----------|----------------------|------------|
| S1 | `LoreFinding.severity: 'gap' \| 'inconsistency'` | `ConsistencyFlag.kind: 'contradiction' \| 'gap'` (`consistencyFlags.ts:17`), and `ConsistencyFlagsRenderer.tsx:13` keys `KIND_META` off exactly those two | `LoreFinding.severity` is typed `ConsistencyFlag['kind']`. `broken-link` and `duplicate-name` are `'contradiction'`, not `'inconsistency'`. No lossy mapping, renderer untouched |
| S2 | `LoreFinding { ruleId, severity, entityId?, message }` | The widget stores `{ id, kind, summary, detail? }` | `LoreFinding` keeps `ruleId`/`entityId` (the rules' own vocabulary) and gains `detail?`. `findingToFlag()` adapts it. `id` is derived deterministically from `ruleId` + `entityId`, so a re-run does not multiply flags |
| S3 | `ArticleSuggestion { name, occurrences, sampleSceneId }` | `articleSuggestions.ts:15` — `{ id, name, type, category?, isNewCategory?, reason? }`. `ArticleSuggestionsRenderer` **requires** `id` (React key, dismiss, drag) and `type` (`ENTITY_TYPE_LABELS` lookup at `:163`, entity creation at `:94`) | `suggestArticles()` returns the **existing** `ArticleSuggestion`. `occurrences` and the sample source survive as prose inside `reason` (which the renderer already shows as a tooltip and writes into the created article). No field is added to the interface — nothing would read it |
| S4 | `LoreRuleInput { entities, scenes, documents, worldKey }` | `lonely-category` must name the folder, and "uncategorised" in this codebase means *no folder or a dangling folder id* (`worldAuthoring.ts:274`) | `LoreRuleInput` gains `roots: WorldBibleRootConfig[]`. Without it `lonely-category` can only say "a category" and `uncategorised` cannot detect a dangling `categoryId` |
| S5 | "builds an article: each question an `<h3>`, each answer the paragraph beneath" | `Entity.articleDoc` is **not HTML** — it is a JSON array of grid tabs holding positioned widgets (`worldAuthoring.ts:6-9, 94-97`) | `buildArticleDoc(sections)` is the creation path. Each question becomes an `ArticleSection.heading` (rendered as a `heading` widget, level 2) and each answer its `body`. Same result, right representation |
| S6 | "use `sanitizeHtml` / `escapeHtml` from `src/lib/sanitize.ts` when building article HTML" | `buildArticleDoc` → `bodyToHtml` → `worldAuthoring.escapeHtml` (`:37-44`) already escapes every value | No caller-side HTML escaping. `sanitize.ts` is still used — `sanitizeLabel` on the article **name**, which `buildArticleDoc` never touches. Note: `sanitize.escapeHtml` and `worldAuthoring.escapeHtml` are byte-identical duplicates; consolidating them is Phase 9's business, not this phase's |
| S7 | "`InterviewMenu.onLaunch` opens the runner instead of the chat" | `InterviewMenu` is rendered **only** by `ChatTrays.tsx:92`, and `InterviewEditorModal` **only** by `ResearchChatPanel.tsx:927`. Phase 2 deletes both files | Rewiring `onLaunch` is not enough — after Phase 2 **the launcher is not mounted anywhere**. Phase 5 must build a host. That is Task 12 (`ResearchRail`) |
| S8 | "Findings render on the existing Consistency & Gaps board" | `WritingDesk.tsx:28,144` filters `articleSuggestions`, `consistencyFlags` and `worldUnderstanding` **out** of the board — they only ever rendered inside `ChatTrays` | Same fix: `ResearchRail` hosts both renderers in tray drawers. `WritingDesk`'s filter stays as it is |
| S9 | — | Phase 2's Definition of Done claims "Both suggestion widgets still mount, empty" and "The Interviews menu still lists interviews" | **Both are false** once `ChatTrays.tsx` and `ResearchChatPanel.tsx` are deleted. Do not treat the missing rail as a Phase 2 regression — it is expected, and Task 12 closes it |
| S10 | — | `ConsistencyFlagsRenderer.tsx:29-32` has an "Ask" button calling `setChatAttachment`; nothing consumes `chatAttachment` after Phase 2 | Task 13 removes the dead control. Same task rewrites both renderers' empty-state copy, which still says "ask the assistant" |
| S11 | The World interview "produces many articles grouped into folders" | Only a model could decide that grouping | An interview with no `targetType` now produces **one** article of type `lore`. Stated plainly in the runner's own copy. This is a deliberate reduction, not an oversight |

---

## What already exists and must be reused, not recreated

Phase 2 kept these on purpose. Read each before writing anything.

| Path | What survives | How Phase 5 uses it |
|------|---------------|---------------------|
| `src/lib/articleSuggestions.ts` | `ArticleSuggestion`, `makeSuggestionsWidget`, `addSuggestionToWidgets` | `suggestArticles()` returns this exact interface. `makeSuggestionsWidget` creates the widget on the first run |
| `src/lib/consistencyFlags.ts` | `ConsistencyFlag`, `makeFlagsWidget`, `addFlagToWidgets` | `findingToFlag()` targets this exact interface. `makeFlagsWidget` creates the widget on the first run |
| `src/components/editor/desk/widgets/ArticleSuggestionsRenderer.tsx` | The whole widget — grouping, drag-to-file, Create / Create all | Mounted by `ResearchRail`. Only its empty-state copy changes |
| `src/components/editor/desk/widgets/ConsistencyFlagsRenderer.tsx` | The whole widget | Mounted by `ResearchRail`. Loses the dead "Ask" button; empty-state copy changes |
| `src/lib/interviews/` (`index.ts`, `types.ts`, `builtins.ts`) | `Interview`, `InterviewQuestion`, `BUILTIN_INTERVIEWS`, `makeBlankInterview` | The runner reads them unchanged. `renderInterviewGuide` and `interviewLaunchLine` are AI-only and go |
| `src/components/editor/research/InterviewMenu.tsx` | The dropdown | Mounted by `ResearchRail`; `onLaunch` opens the runner; the `disabled` prop is removed |
| `src/components/editor/research/InterviewEditorModal.tsx` | The authoring modal | Mounted by `ResearchRail` |
| `src/lib/worldAuthoring.ts` | `buildArticleDoc`, `resolveCategoryId`, `articleDocToText` | The article creation path and the article-to-text reader |
| `src/components/editor/WritingDesk.module.css` `.chatTray*` | The whole rail + drawer treatment (`:4963-5098`) | Reused verbatim by `ResearchRail`. The name now lies — renaming `chatTray*` → `loreRail*` belongs to Phase 8's token/naming pass, not here |

**Never write a second copy of any of these.**

---

## File Structure

**New:**

| Path | ~Lines | Why |
|------|--------|-----|
| `src/lib/loreRules.ts` | 300 | LEAF MODULE. Six rules, `runLoreRules`, `findingToFlag`, `suggestArticles`, shared text helpers |
| `src/lib/loreRules.test.ts` | 320 | One `describe` per rule plus the helpers |
| `src/components/editor/research/InterviewRunner.tsx` | 175 | The self-guided form |
| `src/components/editor/research/ResearchRail.tsx` | 170 | Hosts the Interviews launcher, the lore-check trigger, and the two widget trays |

**Modified:**

| Path | Change |
|------|--------|
| `src/lib/worldAuthoring.ts:126` | `stripHtmlText` exported and taught `&nbsp;` |
| `src/lib/interviews/index.ts` | `renderInterviewGuide` + `interviewLaunchLine` deleted; `InterviewAnswer`, `buildInterviewSections`, `interviewDescription` added |
| `src/lib/interviews/interviews.test.ts` | AI-guide blocks deleted; the two new pure functions covered |
| `src/components/editor/research/InterviewMenu.tsx:10-11,51` | `disabled` prop removed |
| `src/components/editor/desk/widgets/ConsistencyFlagsRenderer.tsx` | Dead "Ask" button and `setChatAttachment` removed; empty-state copy rewritten |
| `src/components/editor/desk/widgets/ArticleSuggestionsRenderer.tsx:185` | Empty-state copy rewritten |
| `src/components/editor/ResearchTab.tsx` | `ResearchRail` mounted as the first child of `.researchLayout` |
| `src/components/editor/WritingDesk.module.css` | `.interviewRunner*` rules appended |

---

## Task 1: The lore-rules module — types and shared text helpers

**Files:**
- Modify: `src/lib/worldAuthoring.ts`
- Create: `src/lib/loreRules.ts`
- Create: `src/lib/loreRules.test.ts`

Nothing imports the module yet, so the build is green throughout. `stripHtmlText` is exported rather than copied because it is already the trusted HTML-to-prose reader in this codebase.

- [ ] **Step 1: Write the failing test**

Create `src/lib/loreRules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Document as StoreDocument, Entity, Scene, WorldBibleRootConfig } from '@/store/workspaceStore';
import { buildArticleDoc } from './worldAuthoring';
import {
    mentionsName,
    worldEntities,
    manuscriptText,
    entityText,
    type LoreRuleInput,
} from './loreRules';

// ── Fixtures ────────────────────────────────────────────────

function entity(over: Partial<Entity> & { name: string }): Entity {
    return {
        id: over.id ?? `e-${over.name.toLowerCase().replace(/\s+/g, '-')}`,
        projectId: 'p1',
        name: over.name,
        type: over.type ?? 'character',
        description: over.description ?? 'A description.',
        createdAt: new Date('2026-01-01'),
        ...over,
    };
}

function scene(over: Partial<Scene> & { content: string }): Scene {
    return {
        id: over.id ?? 's1',
        documentId: 'd1',
        projectId: 'p1',
        title: over.title ?? 'Chapter One',
        order: over.order ?? 0,
        createdAt: new Date('2026-01-01'),
        ...over,
    };
}

function folder(id: string, label: string): WorldBibleRootConfig {
    return { id, label, icon: '📁', entityTypes: [] };
}

function input(over: Partial<LoreRuleInput> = {}): LoreRuleInput {
    return {
        entities: [],
        scenes: [],
        documents: [] as StoreDocument[],
        roots: [],
        worldKey: 'standalone',
        ...over,
    };
}

// ── Helpers ─────────────────────────────────────────────────

describe('mentionsName', () => {
    it('matches a whole word, case-insensitively', () => {
        expect(mentionsName('Kestrel walked in.', 'kestrel')).toBe(true);
        expect(mentionsName('the SALT GUILD met', 'Salt Guild')).toBe(true);
    });

    it('does not match a name buried inside a longer word', () => {
        expect(mentionsName('Also, nobody came.', 'Al')).toBe(false);
        expect(mentionsName('Kestrels circled.', 'Kestrel')).toBe(false);
    });

    it('treats punctuation as a boundary and an empty name as no match', () => {
        expect(mentionsName('"Kestrel," she said.', 'Kestrel')).toBe(true);
        expect(mentionsName('anything', '   ')).toBe(false);
    });
});

describe('worldEntities', () => {
    it('keeps only the entities on the shelf being checked', () => {
        const here = entity({ name: 'Kestrel', worldId: 'w1' });
        const elsewhere = entity({ name: 'Other', worldId: 'w2' });
        const standalone = entity({ name: 'Loose' });
        expect(worldEntities(input({ entities: [here, elsewhere, standalone], worldKey: 'w1' })))
            .toEqual([here]);
        expect(worldEntities(input({ entities: [here, elsewhere, standalone], worldKey: 'standalone' })))
            .toEqual([standalone]);
    });
});

describe('manuscriptText', () => {
    it('strips scene and document markup down to prose', () => {
        const texts = manuscriptText(input({
            scenes: [scene({ content: '<p>The <em>Salt</em> Guild&nbsp;met.</p>' })],
        }));
        expect(texts.join('\n')).toContain('Salt');
        expect(texts.join('\n')).not.toContain('<p>');
        expect(texts.join('\n')).not.toContain('&nbsp;');
    });

    it('drops empty bodies rather than emitting blank strings', () => {
        expect(manuscriptText(input({ scenes: [scene({ content: '' })] }))).toEqual([]);
    });
});

describe('entityText', () => {
    it('reads the description and the article body together', () => {
        const e = entity({
            name: 'Kestrel',
            description: 'A thief.',
            articleDoc: buildArticleDoc([{ heading: 'Origins', body: 'Born in Veldrath.' }]),
        });
        const text = entityText(e);
        expect(text).toContain('A thief.');
        expect(text).toContain('Origins');
        expect(text).toContain('Born in Veldrath.');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: FAIL — `Failed to load url ./loreRules` (the module does not exist yet).

- [ ] **Step 3: Export `stripHtmlText` from `worldAuthoring.ts`**

At `src/lib/worldAuthoring.ts:126`, change the declaration and add the `&nbsp;` decode:

```typescript
/** Tags out, entities decoded, blank lines collapsed. Shared with loreRules. */
export function stripHtmlText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
```

- [ ] **Step 4: Create the module**

Create `src/lib/loreRules.ts`:

```typescript
/**
 * Lore rules — LEAF MODULE: pure functions, no store or React imports beyond
 * types, 4-space indent (matches worldKey.ts, researchScope.ts, folderTree.ts).
 *
 * These replace what the deleted research assistant used to guess at. Six named
 * rules find gaps and contradictions in a World Bible; suggestArticles() finds
 * recurring proper nouns in the manuscript that have no article yet. Every rule
 * is exported on its own so it can be unit-tested in isolation, and every
 * finding is reproducible from the same input — no randomness, no network, no
 * model deciding what to mention.
 */

import type {
    Document as StoreDocument,
    Entity,
    EntityType,
    Scene,
    WorldBibleRootConfig,
} from '@/store/workspaceStore';
import type { ArticleSuggestion } from './articleSuggestions';
import type { ConsistencyFlag } from './consistencyFlags';
import { articleDocToText, stripHtmlText } from './worldAuthoring';
import { worldKeyForEntity } from './worldKey';

/** A single rule hit, before it is adapted to the widget's flag shape. */
export interface LoreFinding {
    /** Stable rule name, e.g. 'empty-description'. */
    ruleId: string;
    /**
     * Typed from the widget's own vocabulary, not the spec's. ConsistencyFlag
     * ships with 'contradiction' | 'gap' and its renderer keys a label map off
     * exactly those, so the widget wins and there is no lossy mapping.
     */
    severity: ConsistencyFlag['kind'];
    /** The entity the finding is about, when it is about one. */
    entityId?: string;
    /** One line — becomes the flag summary. */
    message: string;
    /** Optional second line — what to do about it. */
    detail?: string;
}

export interface LoreRuleInput {
    /** Every entity in the workspace; each rule filters to `worldKey` itself. */
    entities: Entity[];
    /** The scenes to scan. The caller decides the scope. */
    scenes: Scene[];
    /** The documents to scan. The caller decides the scope. */
    documents: StoreDocument[];
    /** This shelf's World Bible folders — needed to name a lonely category. */
    roots: WorldBibleRootConfig[];
    /** The shelf being checked. */
    worldKey: string;
}

// ── Shared helpers ──────────────────────────────────────────

/** Escape a string for literal use inside a RegExp. */
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when `name` appears in `text` as a whole word, case-insensitively.
 * Plain substring matching would report "Al" as mentioned by "Also"; letters
 * and digits on either side are what disqualify a match, so punctuation and
 * quotes still count as boundaries.
 */
export function mentionsName(text: string, name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed || !text) return false;
    const pattern = `(^|[^\\p{L}\\p{N}])${escapeRegExp(trimmed)}([^\\p{L}\\p{N}]|$)`;
    return new RegExp(pattern, 'iu').test(text);
}

/** The entities on the shelf being checked. */
export function worldEntities(input: LoreRuleInput): Entity[] {
    return input.entities.filter(e => worldKeyForEntity(e) === input.worldKey);
}

/** Scene and document bodies, stripped to prose. Empty bodies are dropped. */
export function manuscriptText(input: LoreRuleInput): string[] {
    return [...input.scenes, ...input.documents]
        .map(item => stripHtmlText(item.content ?? ''))
        .filter(text => text.length > 0);
}

/** One entity's own prose: its description plus its article body. */
export function entityText(entity: Entity): string {
    return [(entity.description ?? '').trim(), articleDocToText(entity.articleDoc)]
        .filter(part => part.length > 0)
        .join('\n');
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 6: Full check**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS. Exporting `stripHtmlText` breaks nothing — it had no callers outside its own module.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: the lore-rules leaf module, its types and text helpers

Six deterministic rules land one per commit on top of this. mentionsName
uses word boundaries because plain substring matching reports 'Al' as
mentioned by the word 'Also'. stripHtmlText moves from private to exported
so the rules read HTML the same way serializeWorld already did."
```

---

## Task 2: Rule — `empty-description`

**Files:**
- Modify: `src/lib/loreRules.ts`, `src/lib/loreRules.test.ts`

- [ ] **Step 1: Write the failing test**

Add the import and the block to `src/lib/loreRules.test.ts`. Extend the existing import statement to include `ruleEmptyDescription`, then append:

```typescript
describe('ruleEmptyDescription', () => {
    it('flags an entity with a blank description', () => {
        const findings = ruleEmptyDescription(input({
            entities: [entity({ name: 'Kestrel', description: '   ' })],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('empty-description');
        expect(findings[0].severity).toBe('gap');
        expect(findings[0].entityId).toBe('e-kestrel');
        expect(findings[0].message).toContain('Kestrel');
    });

    it('leaves a described entity alone', () => {
        expect(ruleEmptyDescription(input({
            entities: [entity({ name: 'Kestrel', description: 'A thief.' })],
        }))).toEqual([]);
    });

    it('ignores entities on another shelf', () => {
        expect(ruleEmptyDescription(input({
            entities: [entity({ name: 'Kestrel', description: '', worldId: 'w2' })],
            worldKey: 'w1',
        }))).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: FAIL — `TypeError: ruleEmptyDescription is not a function`. The earlier 7 tests still pass.

- [ ] **Step 3: Implement the rule**

Append to `src/lib/loreRules.ts`:

```typescript
// ── Rules ───────────────────────────────────────────────────

/** An article with no description shows a blank preview and hover card. */
export function ruleEmptyDescription(input: LoreRuleInput): LoreFinding[] {
    return worldEntities(input)
        .filter(e => !(e.description ?? '').trim())
        .map(e => ({
            ruleId: 'empty-description',
            severity: 'gap' as const,
            entityId: e.id,
            message: `“${e.name}” has no description`,
            detail: 'Open the article and write a line or two — it is what previews and hover cards show.',
        }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: empty-description lore rule"
```

---

## Task 3: Rule — `uncategorised`

**Files:**
- Modify: `src/lib/loreRules.ts`, `src/lib/loreRules.test.ts`

"Uncategorised" here means what `serializeWorld` already means by unfiled (`worldAuthoring.ts:274`): no `categoryId`, **or** a `categoryId` no folder claims. The second case is the one that actually bites — deleting a folder leaves its articles pointing at nothing.

- [ ] **Step 1: Write the failing test**

Add `ruleUncategorised` to the import and append:

```typescript
describe('ruleUncategorised', () => {
    it('flags an entity with no folder', () => {
        const findings = ruleUncategorised(input({
            entities: [entity({ name: 'Kestrel' })],
            roots: [folder('f1', 'People')],
        }));
        expect(findings.map(f => f.ruleId)).toEqual(['uncategorised']);
        expect(findings[0].severity).toBe('gap');
        expect(findings[0].message).toContain('Kestrel');
    });

    it('flags an entity pointing at a folder that no longer exists', () => {
        expect(ruleUncategorised(input({
            entities: [entity({ name: 'Kestrel', categoryId: 'deleted-folder' })],
            roots: [folder('f1', 'People')],
        }))).toHaveLength(1);
    });

    it('leaves a properly filed entity alone', () => {
        expect(ruleUncategorised(input({
            entities: [entity({ name: 'Kestrel', categoryId: 'f1' })],
            roots: [folder('f1', 'People')],
        }))).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: FAIL — `TypeError: ruleUncategorised is not a function`.

- [ ] **Step 3: Implement the rule**

Append to `src/lib/loreRules.ts`:

```typescript
/**
 * An article filed nowhere, or filed into a folder that has since been
 * deleted. Both land in Unfiled, so both read the same way to the writer.
 */
export function ruleUncategorised(input: LoreRuleInput): LoreFinding[] {
    const folderIds = new Set(input.roots.map(r => r.id));
    return worldEntities(input)
        .filter(e => !e.categoryId || !folderIds.has(e.categoryId))
        .map(e => ({
            ruleId: 'uncategorised',
            severity: 'gap' as const,
            entityId: e.id,
            message: `“${e.name}” is not filed in any folder`,
            detail: 'Drag it into a World Bible folder so it stops living in Unfiled.',
        }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: uncategorised lore rule

Also catches a dangling categoryId, which is what deleting a folder
leaves behind — the same failure the writer sees as 'Unfiled'."
```

---

## Task 4: Rule — `duplicate-name`

**Files:**
- Modify: `src/lib/loreRules.ts`, `src/lib/loreRules.test.ts`

- [ ] **Step 1: Write the failing test**

Add `ruleDuplicateName` to the import and append:

```typescript
describe('ruleDuplicateName', () => {
    it('flags two entities sharing a name, ignoring case', () => {
        const findings = ruleDuplicateName(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel' }),
                entity({ id: 'b', name: 'kestrel' }),
            ],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('duplicate-name');
        expect(findings[0].severity).toBe('contradiction');
        expect(findings[0].entityId).toBe('a');
        expect(findings[0].message).toContain('2 articles');
    });

    it('reports one finding per clashing name, not one per entity', () => {
        const findings = ruleDuplicateName(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel' }),
                entity({ id: 'b', name: 'Kestrel' }),
                entity({ id: 'c', name: 'Kestrel' }),
            ],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain('3 articles');
    });

    it('does not flag distinct names, and never flags across shelves', () => {
        expect(ruleDuplicateName(input({
            entities: [entity({ id: 'a', name: 'Kestrel' }), entity({ id: 'b', name: 'Veldrath' })],
        }))).toEqual([]);
        expect(ruleDuplicateName(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel', worldId: 'w1' }),
                entity({ id: 'b', name: 'Kestrel', worldId: 'w2' }),
            ],
            worldKey: 'w1',
        }))).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: FAIL — `TypeError: ruleDuplicateName is not a function`.

- [ ] **Step 3: Implement the rule**

Append to `src/lib/loreRules.ts`:

```typescript
/**
 * Two articles on one shelf answering to the same name. Every name-resolving
 * path in the app — findEntityByName, @ mentions, [[…]] links — picks the
 * first match, so the second article becomes unreachable by name.
 */
export function ruleDuplicateName(input: LoreRuleInput): LoreFinding[] {
    const groups = new Map<string, Entity[]>();
    for (const e of worldEntities(input)) {
        const key = e.name.trim().toLowerCase();
        if (!key) continue;
        groups.set(key, [...(groups.get(key) ?? []), e]);
    }

    const findings: LoreFinding[] = [];
    for (const group of groups.values()) {
        if (group.length < 2) continue;
        findings.push({
            ruleId: 'duplicate-name',
            severity: 'contradiction',
            entityId: group[0].id,
            message: `${group.length} articles are named “${group[0].name}”`,
            detail: 'Rename one or merge them — links and @ mentions can only ever reach the first.',
        });
    }
    return findings;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: PASS — 16 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: duplicate-name lore rule"
```

---

## Task 5: Rule — `lonely-category`

**Files:**
- Modify: `src/lib/loreRules.ts`, `src/lib/loreRules.test.ts`

Exactly one member, per the spec. An **empty** folder is not flagged — a freshly created folder is empty on purpose and nagging about it would be noise.

- [ ] **Step 1: Write the failing test**

Add `ruleLonelyCategory` to the import and append:

```typescript
describe('ruleLonelyCategory', () => {
    it('flags a folder holding exactly one article, and names it', () => {
        const findings = ruleLonelyCategory(input({
            entities: [entity({ name: 'Kestrel', categoryId: 'f1' })],
            roots: [folder('f1', 'People')],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('lonely-category');
        expect(findings[0].severity).toBe('gap');
        expect(findings[0].message).toContain('People');
        expect(findings[0].entityId).toBeUndefined();
    });

    it('leaves an empty folder alone — a new folder is empty on purpose', () => {
        expect(ruleLonelyCategory(input({ roots: [folder('f1', 'People')] }))).toEqual([]);
    });

    it('leaves a folder with two or more articles alone', () => {
        expect(ruleLonelyCategory(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel', categoryId: 'f1' }),
                entity({ id: 'b', name: 'Veldrath', categoryId: 'f1' }),
            ],
            roots: [folder('f1', 'People')],
        }))).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: FAIL — `TypeError: ruleLonelyCategory is not a function`.

- [ ] **Step 3: Implement the rule**

Append to `src/lib/loreRules.ts`:

```typescript
/**
 * A folder with exactly one article in it: either there is more to write, or
 * the folder should be merged into a bigger one. An empty folder is left
 * alone — a folder made a minute ago is empty on purpose.
 */
export function ruleLonelyCategory(input: LoreRuleInput): LoreFinding[] {
    const entities = worldEntities(input);
    return input.roots
        .filter(root => entities.filter(e => e.categoryId === root.id).length === 1)
        .map(root => ({
            ruleId: 'lonely-category',
            severity: 'gap' as const,
            message: `The “${root.label}” folder holds only one article`,
            detail: 'Either it has more to hold and you have not written it yet, or it belongs inside a bigger folder.',
        }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: PASS — 19 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: lonely-category lore rule

An empty folder is deliberately not flagged — a folder created a minute
ago is empty on purpose, and nagging about it is noise."
```

---

## Task 6: Rule — `never-referenced`

**Files:**
- Modify: `src/lib/loreRules.ts`, `src/lib/loreRules.test.ts`

- [ ] **Step 1: Write the failing test**

Add `ruleNeverReferenced` to the import and append:

```typescript
describe('ruleNeverReferenced', () => {
    it('flags an entity no scene and no other article names', () => {
        const findings = ruleNeverReferenced(input({
            entities: [entity({ name: 'Kestrel' })],
            scenes: [scene({ content: '<p>Nobody came.</p>' })],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('never-referenced');
        expect(findings[0].severity).toBe('gap');
        expect(findings[0].entityId).toBe('e-kestrel');
    });

    it('does not flag an entity a scene names', () => {
        expect(ruleNeverReferenced(input({
            entities: [entity({ name: 'Kestrel' })],
            scenes: [scene({ content: '<p>Then <strong>Kestrel</strong> arrived.</p>' })],
        }))).toEqual([]);
    });

    it('does not flag an entity another article names', () => {
        expect(ruleNeverReferenced(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel' }),
                entity({ id: 'b', name: 'Veldrath', description: 'The city Kestrel fled.' }),
            ],
            scenes: [],
        }).map(f => f.entityId)).toEqual(['b']);
    });

    it('does not let an entity vouch for itself', () => {
        expect(ruleNeverReferenced(input({
            entities: [entity({ name: 'Kestrel', description: 'Kestrel is a thief.' })],
        }))).toHaveLength(1);
    });

    it('does not count a name buried inside a longer word', () => {
        expect(ruleNeverReferenced(input({
            entities: [entity({ name: 'Kestrel' })],
            scenes: [scene({ content: '<p>Two kestrels circled overhead.</p>' })],
        }))).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: FAIL — `TypeError: ruleNeverReferenced is not a function`.

- [ ] **Step 3: Implement the rule**

Append to `src/lib/loreRules.ts`:

```typescript
/**
 * An article nothing points at: its name appears in no scene, no chapter, and
 * no other article. Either it has not made it into the story yet, or it is
 * spelled differently there. An article does not vouch for itself.
 */
export function ruleNeverReferenced(input: LoreRuleInput): LoreFinding[] {
    const entities = worldEntities(input);
    const manuscript = manuscriptText(input).join('\n');
    const articles = entities.map(e => ({ id: e.id, text: entityText(e) }));

    return entities
        .filter(e => {
            const name = e.name.trim();
            if (!name) return false;
            if (mentionsName(manuscript, name)) return false;
            return !articles.some(a => a.id !== e.id && mentionsName(a.text, name));
        })
        .map(e => ({
            ruleId: 'never-referenced',
            severity: 'gap' as const,
            entityId: e.id,
            message: `“${e.name}” is never mentioned anywhere`,
            detail: 'No scene, chapter or other article names it. Either it is not in the story yet, or it is spelled differently there.',
        }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: PASS — 24 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: never-referenced lore rule

Whole-word matching, not substring: 'kestrels circled' must not count as
a mention of Kestrel, or the rule quietly stops finding anything."
```

---

## Task 7: Rule — `broken-link`

**Files:**
- Modify: `src/lib/loreRules.ts`, `src/lib/loreRules.test.ts`

**Depends on Phase 4.** The rule detects **both** representations a broken link can take, so it does not matter which one Phase 4 chose:

1. **Literal `[[Target]]`** left in the prose. A `[[` link that resolves becomes a mark; one that does not resolve has nothing to become, so it stays literal. This is the common case.
2. **A dangling `data-entity-id`.** `EntityMark` (`src/lib/EntityMark.ts:49`) serialises a resolved reference as `data-entity-id` on a `span.entity-tag`, and `sanitizeHtml` (`src/lib/sanitize.ts:67`) preserves that attribute. Deleting the article afterwards leaves the attribute pointing at nothing.

Both are scanned against the **raw** source, not the stripped prose, because case 2 lives in an attribute and `articleDoc` stores its HTML JSON-escaped (`data-entity-id=\"…\"`).

- [ ] **Step 1: Write the failing test**

Add `ruleBrokenLink`, `extractWikiLinks` and `extractEntityIdRefs` to the import and append:

```typescript
describe('extractWikiLinks', () => {
    it('pulls every distinct target out, taking the left half of a piped link', () => {
        expect(extractWikiLinks('See [[Veldrath]] and [[Kestrel|the thief]] and [[Veldrath]].'))
            .toEqual(['Veldrath', 'Kestrel']);
    });

    it('ignores empty, blank and unclosed brackets', () => {
        expect(extractWikiLinks('[[]] and [[   ]] and [[unclosed text')).toEqual([]);
    });
});

describe('extractEntityIdRefs', () => {
    it('reads plain and JSON-escaped attributes alike', () => {
        expect(extractEntityIdRefs('<span data-entity-id="e-1">A</span>')).toEqual(['e-1']);
        expect(extractEntityIdRefs('{"html":"<span data-entity-id=\\"e-2\\">A</span>"}')).toEqual(['e-2']);
    });
});

describe('ruleBrokenLink', () => {
    it('flags a [[link]] with no matching article', () => {
        const findings = ruleBrokenLink(input({
            entities: [entity({ name: 'Kestrel' })],
            scenes: [scene({ content: '<p>She fled to [[Veldrath]].</p>' })],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('broken-link');
        expect(findings[0].severity).toBe('contradiction');
        expect(findings[0].message).toContain('[[Veldrath]]');
        expect(findings[0].detail).toContain('Chapter One');
    });

    it('does not flag a [[link]] that resolves, ignoring case', () => {
        expect(ruleBrokenLink(input({
            entities: [entity({ name: 'Veldrath' })],
            scenes: [scene({ content: '<p>She fled to [[veldrath]].</p>' })],
        }))).toEqual([]);
    });

    it('flags a mark pointing at a deleted article', () => {
        const findings = ruleBrokenLink(input({
            entities: [entity({ id: 'kept', name: 'Kestrel' })],
            scenes: [scene({ content: '<p><span data-entity-id="gone">Veldrath</span></p>' })],
        }));
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain('Chapter One');
    });

    it('does not flag a mark that still resolves', () => {
        expect(ruleBrokenLink(input({
            entities: [entity({ id: 'kept', name: 'Kestrel' })],
            scenes: [scene({ content: '<p><span data-entity-id="kept">Kestrel</span></p>' })],
        }))).toEqual([]);
    });

    it('reports one finding per broken target, however often it appears', () => {
        expect(ruleBrokenLink(input({
            scenes: [
                scene({ id: 's1', content: '[[Veldrath]] again [[Veldrath]]' }),
                scene({ id: 's2', title: 'Chapter Two', content: '[[Veldrath]]' }),
            ],
        }))).toHaveLength(1);
    });

    it('scans article bodies too', () => {
        expect(ruleBrokenLink(input({
            entities: [entity({
                name: 'Kestrel',
                articleDoc: buildArticleDoc([{ heading: 'Home', body: 'Raised in [[Veldrath]].' }]),
            })],
        }))).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: FAIL — `TypeError: extractWikiLinks is not a function`.

- [ ] **Step 3: Implement the rule**

Append to `src/lib/loreRules.ts`:

```typescript
/** Every distinct `[[Target]]` in the text. `[[Target|label]]` yields Target. */
export function extractWikiLinks(text: string): string[] {
    const found: string[] = [];
    const seen = new Set<string>();
    const pattern = /\[\[([^[\]]+?)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        const target = match[1].split('|')[0].trim();
        const key = target.toLowerCase();
        if (!target || seen.has(key)) continue;
        seen.add(key);
        found.push(target);
    }
    return found;
}

/**
 * Every distinct entity id referenced by an entity mark. Matches both the
 * plain attribute and the JSON-escaped form articleDoc stores.
 */
export function extractEntityIdRefs(html: string): string[] {
    const found: string[] = [];
    const seen = new Set<string>();
    const pattern = /data-entity-id=\\?["']([^"'\\]+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
        const id = match[1].trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        found.push(id);
    }
    return found;
}

/**
 * A link with nothing on the other end. Two shapes, because a link can break
 * two ways: a `[[Target]]` never resolved to an article at all, or a resolved
 * mark's article was deleted afterwards and its data-entity-id now dangles.
 * Scanned against raw source — the id lives in an attribute, and articleDoc
 * stores its HTML JSON-escaped.
 */
export function ruleBrokenLink(input: LoreRuleInput): LoreFinding[] {
    const entities = worldEntities(input);
    const names = new Set(entities.map(e => e.name.trim().toLowerCase()));
    const ids = new Set(entities.map(e => e.id));

    const sources = [
        ...input.scenes.map(s => ({ label: s.title, raw: s.content ?? '' })),
        ...input.documents.map(d => ({ label: d.title, raw: d.content ?? '' })),
        ...entities.map(e => ({ label: e.name, raw: `${e.description ?? ''}\n${e.articleDoc ?? ''}` })),
    ];

    const findings: LoreFinding[] = [];
    const reported = new Set<string>();

    for (const source of sources) {
        const where = source.label.trim() || 'Untitled';

        for (const target of extractWikiLinks(source.raw)) {
            const key = `name:${target.toLowerCase()}`;
            if (names.has(target.toLowerCase()) || reported.has(key)) continue;
            reported.add(key);
            findings.push({
                ruleId: 'broken-link',
                severity: 'contradiction',
                message: `[[${target}]] links to an article that does not exist`,
                detail: `First seen in “${where}”. Create “${target}”, or fix the spelling in the link.`,
            });
        }

        for (const id of extractEntityIdRefs(source.raw)) {
            const key = `id:${id}`;
            if (ids.has(id) || reported.has(key)) continue;
            reported.add(key);
            findings.push({
                ruleId: 'broken-link',
                severity: 'contradiction',
                message: `A link in “${where}” points at a deleted article`,
                detail: 'The article it referenced no longer exists. Re-link it, or remove the link.',
            });
        }
    }

    return findings;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: PASS — 33 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: broken-link lore rule

Detects both shapes a broken link takes: a [[Target]] that never resolved,
and an entity mark whose article was deleted afterwards. Scanning raw
source rather than stripped prose is what makes the second case visible."
```

---

## Task 8: `runLoreRules` and the flag adapter

**Files:**
- Modify: `src/lib/loreRules.ts`, `src/lib/loreRules.test.ts`

- [ ] **Step 1: Write the failing test**

Add `runLoreRules`, `findingToFlag` and `LORE_RULES` to the import and append:

```typescript
describe('runLoreRules', () => {
    it('runs all six rules and returns every finding', () => {
        expect(LORE_RULES).toHaveLength(6);
        const findings = runLoreRules(input({
            entities: [
                entity({ id: 'a', name: 'Kestrel', description: '' }),
                entity({ id: 'b', name: 'Kestrel', description: 'A thief.', categoryId: 'f1' }),
            ],
            scenes: [scene({ content: '<p>She fled to [[Veldrath]].</p>' })],
            roots: [folder('f1', 'People')],
        }));
        expect(new Set(findings.map(f => f.ruleId))).toEqual(new Set([
            'empty-description', 'uncategorised', 'never-referenced',
            'lonely-category', 'broken-link', 'duplicate-name',
        ]));
    });

    it('returns nothing for an empty world', () => {
        expect(runLoreRules(input())).toEqual([]);
    });

    it('is deterministic — the same input gives the identical result', () => {
        const args = input({
            entities: [entity({ name: 'Kestrel', description: '' })],
            roots: [folder('f1', 'People')],
        });
        expect(runLoreRules(args)).toEqual(runLoreRules(args));
    });
});

describe('findingToFlag', () => {
    it('maps a finding onto the widget shape the renderer already reads', () => {
        const flag = findingToFlag({
            ruleId: 'empty-description',
            severity: 'gap',
            entityId: 'e-kestrel',
            message: '“Kestrel” has no description',
            detail: 'Write a line or two.',
        });
        expect(flag.kind).toBe('gap');
        expect(flag.summary).toBe('“Kestrel” has no description');
        expect(flag.detail).toBe('Write a line or two.');
        expect(flag.id).toBe('empty-description:e-kestrel');
    });

    it('gives a finding with no entity a stable id derived from its message', () => {
        const finding = {
            ruleId: 'lonely-category' as const,
            severity: 'gap' as const,
            message: 'The “People” folder holds only one article',
        };
        expect(findingToFlag(finding).id).toBe(findingToFlag(finding).id);
        expect(findingToFlag(finding).id.startsWith('lonely-category:')).toBe(true);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: FAIL — the `runLoreRules` block errors on its first assertion: `LORE_RULES` is `undefined`, because the export does not exist yet.

- [ ] **Step 3: Implement**

Append to `src/lib/loreRules.ts`:

```typescript
// ── Composition ─────────────────────────────────────────────

/** Every rule, in the order findings are reported. */
export const LORE_RULES = [
    ruleEmptyDescription,
    ruleUncategorised,
    ruleNeverReferenced,
    ruleLonelyCategory,
    ruleBrokenLink,
    ruleDuplicateName,
] as const;

/** Run every rule over one shelf. Pure: same input, same findings, always. */
export function runLoreRules(input: LoreRuleInput): LoreFinding[] {
    return LORE_RULES.flatMap(rule => rule(input));
}

/**
 * Adapt a finding to the shape the Consistency & Gaps widget already renders.
 * The id is derived, not random, so re-running the check updates the board
 * instead of stacking a second copy of every finding on it.
 */
export function findingToFlag(finding: LoreFinding): ConsistencyFlag {
    return {
        id: `${finding.ruleId}:${finding.entityId ?? finding.message.toLowerCase()}`,
        kind: finding.severity,
        summary: finding.message,
        detail: finding.detail,
    };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: PASS — 38 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: runLoreRules composes the six rules, findingToFlag adapts them

The flag id is derived from the rule and the entity rather than randomly
generated, so running the check twice updates the board instead of
doubling it."
```

---

## Task 9: `suggestArticles`

**Files:**
- Modify: `src/lib/loreRules.ts`, `src/lib/loreRules.test.ts`

Two exported functions so the counting is testable without the suggestion shape: `countProperNounCandidates(texts)` does the extraction, `suggestArticles(input)` filters and adapts.

- [ ] **Step 1: Write the failing test**

Add `suggestArticles`, `countProperNounCandidates` and `SUGGESTION_MIN_OCCURRENCES` to the import and append:

```typescript
describe('countProperNounCandidates', () => {
    it('counts a capitalised word wherever it appears', () => {
        const counts = countProperNounCandidates(['Kestrel ran. Then Kestrel stopped.']);
        expect(counts.find(c => c.name === 'Kestrel')?.occurrences).toBe(2);
    });

    it('keeps a capitalised run together as one candidate', () => {
        const counts = countProperNounCandidates(['The Crimson King waited.']);
        expect(counts.map(c => c.name)).toContain('The Crimson King');
        expect(counts.map(c => c.name)).not.toContain('Crimson');
    });

    it('does not let a sentence-opening grammar word swallow the name after it', () => {
        expect(countProperNounCandidates(['Then Kestrel stopped.']).map(c => c.name))
            .toEqual(['Kestrel']);
    });

    it('drops a common English word that only started a sentence', () => {
        const counts = countProperNounCandidates(['The door closed.\nShe waited.\nThen nothing.']);
        expect(counts.map(c => c.name)).toEqual([]);
    });

    it('keeps a common word when it is not sentence-initial', () => {
        const counts = countProperNounCandidates(['They called her She Who Waits.']);
        expect(counts.map(c => c.name)).toContain('She Who Waits');
    });

    it('records the index of the text a candidate first appeared in', () => {
        const counts = countProperNounCandidates(['nothing here.', 'Kestrel arrived.']);
        expect(counts.find(c => c.name === 'Kestrel')?.sourceIndex).toBe(1);
    });
});

describe('suggestArticles', () => {
    const thrice = '<p>Kestrel ran.</p><p>Then Kestrel stopped.</p><p>Later, Kestrel slept.</p>';

    it('suggests a name recurring at least three times with no article', () => {
        const suggestions = suggestArticles(input({ scenes: [scene({ content: thrice })] }));
        expect(suggestions.map(s => s.name)).toEqual(['Kestrel']);
        expect(suggestions[0].id).toBe('suggest:kestrel');
        expect(suggestions[0].type).toBe('lore');
        expect(suggestions[0].category).toBeUndefined();
        expect(suggestions[0].reason).toContain('3 times');
        expect(suggestions[0].reason).toContain('Chapter One');
    });

    it('does not suggest a name that already has an article, ignoring case', () => {
        expect(suggestArticles(input({
            entities: [entity({ name: 'kestrel' })],
            scenes: [scene({ content: thrice })],
        }))).toEqual([]);
    });

    it('does not suggest a name appearing only twice', () => {
        expect(suggestArticles(input({
            scenes: [scene({ content: '<p>Kestrel ran.</p><p>Then Kestrel stopped.</p>' })],
        }))).toEqual([]);
        expect(SUGGESTION_MIN_OCCURRENCES).toBe(3);
    });

    it('orders the most frequent first', () => {
        const suggestions = suggestArticles(input({
            scenes: [scene({ content: `${thrice}<p>Veldrath. Veldrath. Veldrath. Veldrath.</p>` })],
        }));
        expect(suggestions.map(s => s.name)).toEqual(['Veldrath', 'Kestrel']);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: FAIL — `TypeError: countProperNounCandidates is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/loreRules.ts`:

```typescript
// ── Article suggestions ─────────────────────────────────────

/** A name must recur this often before it is worth suggesting an article for. */
export const SUGGESTION_MIN_OCCURRENCES = 3;

/** Frequency says nothing about what a name *is*, so it lands in the neutral bucket. */
export const SUGGESTION_DEFAULT_TYPE: EntityType = 'lore';

/**
 * Words that are capitalised by grammar rather than by being names. Applied
 * only to a ONE-WORD candidate that opened a sentence — "The Crimson King"
 * and a mid-sentence "She Who Waits" are both untouched by it.
 */
const COMMON_SENTENCE_STARTERS = new Set([
    'a', 'after', 'all', 'also', 'an', 'and', 'another', 'any', 'around', 'as',
    'at', 'back', 'because', 'before', 'behind', 'below', 'beside', 'both',
    'but', 'by', 'down', 'each', 'even', 'every', 'first', 'for', 'from', 'he',
    'her', 'here', 'his', 'how', 'i', 'if', 'in', 'inside', 'instead', 'it',
    'its', 'just', 'last', 'later', 'like', 'maybe', 'more', 'most', 'much',
    'my', 'near', 'neither', 'never', 'next', 'no', 'none', 'nor', 'not',
    'nothing', 'now', 'of', 'on', 'once', 'one', 'only', 'or', 'other', 'our',
    'out', 'outside', 'over', 'perhaps', 'she', 'so', 'some', 'someone',
    'something', 'still', 'such', 'than', 'that', 'the', 'their', 'them',
    'then', 'there', 'these', 'they', 'this', 'those', 'though', 'through',
    'to', 'together', 'too', 'under', 'until', 'up', 'was', 'we', 'well',
    'what', 'when', 'where', 'which', 'while', 'who', 'why', 'with', 'without',
    'yes', 'yet', 'you', 'your',
]);

/**
 * The sentence-initial common words that routinely belong to a name. "The
 * Crimson King" keeps its "The"; "Then Kestrel stopped." must not become a
 * candidate called "Then Kestrel", which is the single most common way a
 * frequency counter loses track of a name.
 */
const NAME_LEADING_WORDS = new Set(['the']);

/** A candidate proper noun and how often it was seen. */
export interface NameCount {
    /** The name as first written, e.g. "The Crimson King". */
    name: string;
    occurrences: number;
    /** Index of the first text it appeared in. */
    sourceIndex: number;
}

function startsCapital(word: string): boolean {
    return /^["'“‘(]*\p{Lu}/u.test(word);
}

/** Strip surrounding punctuation, keeping internal apostrophes and hyphens. */
function trimWord(word: string): string {
    return word
        .replace(/^[^\p{L}\p{N}]+/u, '')
        .replace(/[^\p{L}\p{N}'’]+$/u, '');
}

/**
 * Capitalised words and runs of them, counted across the given texts. A run is
 * greedy, so "The Crimson King" is one candidate rather than three, and a run
 * stops at the word carrying a comma or dash. A one-word candidate that opened
 * a sentence is dropped when it is a common English word.
 */
export function countProperNounCandidates(texts: string[]): NameCount[] {
    const counts = new Map<string, NameCount>();

    texts.forEach((text, sourceIndex) => {
        for (const sentence of text.split(/[.!?…]+[\s"'”’)]*|\n+/u)) {
            const words = sentence.trim().split(/\s+/).filter(Boolean);
            let i = 0;
            while (i < words.length) {
                if (!startsCapital(words[i])) {
                    i += 1;
                    continue;
                }
                const atSentenceStart = i === 0;
                const run: string[] = [];
                while (i < words.length && startsCapital(words[i])) {
                    const cleaned = trimWord(words[i]);
                    if (cleaned) run.push(cleaned);
                    const runEnds = /[,;:—–]$/.test(words[i]);
                    i += 1;
                    if (runEnds) break;
                }
                // "Then Kestrel" — drop a sentence-initial grammar word that
                // merged into the run, unless it plausibly belongs to the name.
                const leading = (run[0] ?? '').toLowerCase();
                const body = atSentenceStart && run.length > 1
                    && COMMON_SENTENCE_STARTERS.has(leading) && !NAME_LEADING_WORDS.has(leading)
                    ? run.slice(1)
                    : run;

                const name = body.join(' ');
                if (!name) continue;
                if (body.length === 1 && atSentenceStart && COMMON_SENTENCE_STARTERS.has(name.toLowerCase())) {
                    continue;
                }
                const key = name.toLowerCase();
                const seen = counts.get(key);
                counts.set(key, seen
                    ? { ...seen, occurrences: seen.occurrences + 1 }
                    : { name, occurrences: 1, sourceIndex });
            }
        }
    });

    return [...counts.values()];
}

/**
 * Names the writer keeps using that have no article yet. Returns the EXISTING
 * ArticleSuggestion shape so ArticleSuggestionsRenderer works unchanged — the
 * occurrence count and the source live in `reason`, which the widget shows as
 * a tooltip and writes into the created article.
 */
export function suggestArticles(input: LoreRuleInput): ArticleSuggestion[] {
    const known = new Set(worldEntities(input).map(e => e.name.trim().toLowerCase()));
    const sources = [
        ...input.scenes.map(s => ({ title: s.title, text: stripHtmlText(s.content ?? '') })),
        ...input.documents.map(d => ({ title: d.title, text: stripHtmlText(d.content ?? '') })),
    ];

    return countProperNounCandidates(sources.map(s => s.text))
        .filter(c => c.occurrences >= SUGGESTION_MIN_OCCURRENCES)
        .filter(c => !known.has(c.name.toLowerCase()))
        .sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name))
        .map(c => ({
            id: `suggest:${c.name.toLowerCase()}`,
            name: c.name,
            type: SUGGESTION_DEFAULT_TYPE,
            reason: `Appears ${c.occurrences} times in your writing (first in “${sources[c.sourceIndex]?.title.trim() || 'Untitled'}”) with no article yet.`,
        }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/loreRules.test.ts`

Expected: PASS — 48 tests.

- [ ] **Step 5: Full check**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src/lib/loreRules.ts src/lib/loreRules.test.ts`

Expected: all three clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: suggestArticles finds recurring names with no article

The three-occurrence threshold is SUGGESTION_MIN_OCCURRENCES, not a
literal. Suggestions use the existing ArticleSuggestion interface, so the
existing renderer needs no change: the count and the source scene ride in
reason, which the widget already shows and already writes into the
article it creates."
```

---

## Task 10: Building an article out of interview answers

**Files:**
- Modify: `src/lib/interviews/index.ts`, `src/lib/interviews/interviews.test.ts`

The runner is a `.tsx` file, so vitest will never see it. Everything about it worth testing — turning question/answer pairs into article sections and a description — lives here instead. `renderInterviewGuide` and `interviewLaunchLine` existed only to brief the deleted model and go with them.

- [ ] **Step 1: Write the failing test**

In `src/lib/interviews/interviews.test.ts`, replace the whole `describe('renderInterviewGuide', …)` block and the whole `describe('interviewLaunchLine', …)` block with:

```typescript
describe('buildInterviewSections', () => {
    it('turns each answered question into a heading and its prose', () => {
        const sections = buildInterviewSections([
            { prompt: 'Who is this character?', answer: 'A thief called Kestrel.' },
            { prompt: 'What do they want?', answer: 'Out.' },
        ]);
        expect(sections).toEqual([
            { heading: 'Who is this character?', body: 'A thief called Kestrel.' },
            { heading: 'What do they want?', body: 'Out.' },
        ]);
    });

    it('omits a skipped question entirely rather than leaving an empty heading', () => {
        const sections = buildInterviewSections([
            { prompt: 'Who is this character?', answer: 'A thief.' },
            { prompt: 'What do they want?', answer: '   ' },
            { prompt: 'Their wound?', answer: '' },
        ]);
        expect(sections).toHaveLength(1);
        expect(sections[0].heading).toBe('Who is this character?');
    });

    it('returns nothing when every question was skipped', () => {
        expect(buildInterviewSections([{ prompt: 'Q', answer: '  ' }])).toEqual([]);
    });
});

describe('interviewDescription', () => {
    it('takes the first line of the first answered question', () => {
        expect(interviewDescription([
            { prompt: 'Q1', answer: '  ' },
            { prompt: 'Q2', answer: 'A thief called Kestrel.\nMore below.' },
        ])).toBe('A thief called Kestrel.');
    });

    it('clips a long first line and marks it', () => {
        const long = 'x'.repeat(300);
        const out = interviewDescription([{ prompt: 'Q', answer: long }], 240);
        expect(out).toHaveLength(241);
        expect(out.endsWith('…')).toBe(true);
    });

    it('is empty when nothing was answered', () => {
        expect(interviewDescription([{ prompt: 'Q', answer: '' }])).toBe('');
    });
});
```

Update the import at the top of the file to:

```typescript
import {
    BUILTIN_INTERVIEWS,
    makeBlankInterview,
    buildInterviewSections,
    interviewDescription,
} from './index';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/interviews/interviews.test.ts`

Expected: FAIL — `TypeError: buildInterviewSections is not a function`. The two `built-in interviews` tests still pass.

- [ ] **Step 3: Rewrite `src/lib/interviews/index.ts`**

Replace the whole file with:

```typescript
/**
 * Interview registry: the built-in skills, plus the pure pieces that turn a
 * finished interview into a World Bible article.
 *
 * Custom interviews live in the workspace store, not here — combine them with
 * BUILTIN_INTERVIEWS at the call site.
 *
 * The runner is a component and vitest only collects `.test.ts`, so everything
 * about it that has a right and a wrong answer lives in this module instead.
 */

import type { Interview } from './types';
import type { ArticleSection } from '@/lib/worldAuthoring';

export type { Interview, InterviewQuestion } from './types';
export { BUILTIN_INTERVIEWS } from './builtins';

/** A blank custom interview with one starter question, for the editor. */
export function makeBlankInterview(id: string): Interview {
    return {
        id,
        title: 'Untitled Interview',
        icon: '📝',
        tagline: '',
        questions: [{ label: 'Question 1', prompt: '', seeds: '' }],
    };
}

/** One question as it was asked, and what the writer typed back. */
export interface InterviewAnswer {
    /** The question, verbatim — it becomes the section heading. */
    prompt: string;
    /** The answer. Empty or whitespace means the question was skipped. */
    answer: string;
}

/**
 * Turn a finished interview into article sections: the question is the
 * heading, the answer is the prose beneath it, and a skipped question is
 * omitted entirely rather than left as a heading with nothing under it.
 *
 * The result goes to buildArticleDoc, which escapes every value on the way in,
 * so no caller-side escaping is needed here.
 */
export function buildInterviewSections(answers: InterviewAnswer[]): ArticleSection[] {
    return answers
        .filter(a => a.answer.trim().length > 0)
        .map(a => ({ heading: a.prompt.trim(), body: a.answer.trim() }));
}

/** The article's one-line description: the first line of the first answer. */
export function interviewDescription(answers: InterviewAnswer[], maxLength = 240): string {
    const first = answers.find(a => a.answer.trim())?.answer.trim() ?? '';
    const line = first.split('\n')[0].trim();
    return line.length > maxLength ? `${line.slice(0, maxLength).trim()}…` : line;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/interviews/interviews.test.ts`

Expected: PASS — 8 tests.

- [ ] **Step 5: Confirm the deleted helpers had no other caller**

Run: `grep -rn "renderInterviewGuide\|interviewLaunchLine" src`

Expected: no output. Both were called only from `ResearchChatPanel.tsx`, which Phase 2 deleted.

- [ ] **Step 6: Full check**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: build a World Bible article out of interview answers

renderInterviewGuide and interviewLaunchLine went with the model they
briefed. buildInterviewSections and interviewDescription replace them, and
they live in a .ts module because vitest.config.ts collects only .test.ts
— the runner component itself will never be unit-tested."
```

---

## Task 11: The interview runner

**Files:**
- Create: `src/components/editor/research/InterviewRunner.tsx`
- Modify: `src/components/editor/WritingDesk.module.css`

No test — vitest does not collect `.tsx`. Task 10 already covered every decision the component makes; what is left is wiring, verified by the smoke test in Task 14.

A ten-question interview runs eleven steps: the article's **name**, then the ten questions. That is where the spec's "4 of 11" comes from.

- [ ] **Step 1: Create the component**

Create `src/components/editor/research/InterviewRunner.tsx`:

```tsx
"use client";

import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
    useWorkspaceStore,
    selectProjectWorldKey,
    type Entity,
    type EntityType,
} from '@/store/workspaceStore';
import { STANDALONE_KEY } from '@/lib/worldKey';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { buildArticleDoc, resolveCategoryId } from '@/lib/worldAuthoring';
import { sanitizeLabel } from '@/lib/sanitize';
import {
    buildInterviewSections,
    interviewDescription,
    type Interview,
    type InterviewAnswer,
} from '@/lib/interviews';
import styles from '../WritingDesk.module.css';

interface InterviewRunnerProps {
    interview: Interview;
    onClose: () => void;
    /** Called with the new entity's id once the article has been created. */
    onCreated?: (entityId: string) => void;
}

/** An interview that declares no target type produces one general article. */
const FALLBACK_TYPE: EntityType = 'lore';

/**
 * Runs an interview as a self-guided form. Step 0 names the article; steps 1..n
 * ask the interview's questions one at a time with Back, Skip and a progress
 * readout. Answers live in local state — nothing is written until Finish, which
 * builds a single World Bible article through the ordinary creation path.
 *
 * Every question is always asked, in order, exactly as written. That is the
 * point: the old model chose which to ask and how to reword them, so the
 * article's shape changed run to run.
 */
export function InterviewRunner({ interview, onClose, onCreated }: InterviewRunnerProps) {
    const questions = interview.questions.filter(q => q.prompt.trim());
    const totalSteps = questions.length + 1;

    const [step, setStep] = useState(0);
    const [name, setName] = useState('');
    const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));

    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const worldKey = useWorkspaceStore(selectProjectWorldKey);
    const worldBibles = useWorkspaceStore(s => s.worldBibles);
    const addEntity = useWorkspaceStore(s => s.addEntity);

    const trimmedName = name.trim();
    const isNameStep = step === 0;
    const isLastStep = step === totalSteps - 1;
    const answeredCount = answers.filter(a => a.trim()).length;
    const canFinish = Boolean(activeProjectId) && trimmedName.length > 0;

    const setAnswer = (value: string) =>
        setAnswers(prev => prev.map((a, i) => (i === step - 1 ? value : a)));

    const back = () => setStep(s => Math.max(0, s - 1));
    const next = () => setStep(s => Math.min(totalSteps - 1, s + 1));
    const skip = () => { setAnswer(''); next(); };

    const finish = () => {
        if (!activeProjectId || !trimmedName) return;
        const pairs: InterviewAnswer[] = questions.map((q, i) => ({
            prompt: q.prompt,
            answer: answers[i],
        }));
        const type = interview.targetType ?? FALLBACK_TYPE;
        const roots = getWorldBibleConfig(worldBibles, worldKey).layout.roots;
        const entity: Entity = {
            id: crypto.randomUUID(),
            projectId: activeProjectId,
            worldId: worldKey === STANDALONE_KEY ? undefined : worldKey,
            categoryId: resolveCategoryId(roots, undefined, type),
            name: sanitizeLabel(trimmedName),
            type,
            description: interviewDescription(pairs),
            articleDoc: buildArticleDoc(buildInterviewSections(pairs)),
            createdAt: new Date(),
        };
        addEntity(entity);
        onCreated?.(entity.id);
        onClose();
    };

    return (
        <div className={styles.interviewEditorBackdrop} onClick={onClose}>
            <div
                className={`${styles.interviewEditorModal} ${styles.interviewRunnerModal}`}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`${interview.title} interview`}
            >
                <div className={styles.interviewEditorHeader}>
                    <h2 className={styles.interviewEditorTitle}>
                        {interview.icon} {interview.title}
                        <span className={styles.interviewRunnerProgress}>{step + 1} of {totalSteps}</span>
                    </h2>
                    <button className={styles.interviewEditorClose} onClick={onClose} title="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.interviewRunnerBody}>
                    {isNameStep ? (
                        <>
                            <span className={styles.interviewRunnerLabel}>Name</span>
                            <p className={styles.interviewRunnerQuestion}>
                                What should this article be called?
                            </p>
                            <input
                                className={styles.interviewEditorInput}
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder={`Name your ${interview.title.toLowerCase()}`}
                                aria-label="Article name"
                                autoFocus
                            />
                            {!interview.targetType && (
                                <p className={styles.interviewRunnerNote}>
                                    This interview writes one article covering everything you answer.
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <span className={styles.interviewRunnerLabel}>{questions[step - 1].label}</span>
                            <p className={styles.interviewRunnerQuestion}>{questions[step - 1].prompt}</p>
                            <textarea
                                className={styles.interviewRunnerAnswer}
                                value={answers[step - 1]}
                                onChange={e => setAnswer(e.target.value)}
                                placeholder="As much or as little as you like — Skip if you would rather not answer."
                                aria-label={questions[step - 1].label || 'Answer'}
                                rows={6}
                                autoFocus
                            />
                        </>
                    )}
                </div>

                <div className={styles.interviewEditorActions}>
                    <button className={styles.interviewEditorCancel} onClick={back} disabled={step === 0}>
                        Back
                    </button>
                    <div className={styles.interviewEditorActionsRight}>
                        <span className={styles.interviewRunnerCount}>
                            {answeredCount} of {questions.length} answered
                        </span>
                        {!isNameStep && !isLastStep && (
                            <button className={styles.interviewEditorCancel} onClick={skip}>Skip</button>
                        )}
                        {isLastStep ? (
                            <button className={styles.interviewEditorSave} onClick={finish} disabled={!canFinish}>
                                Finish &amp; create article
                            </button>
                        ) : (
                            <button
                                className={styles.interviewEditorSave}
                                onClick={next}
                                disabled={isNameStep && !trimmedName}
                            >
                                Next
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Append the styles**

At the **end** of `src/components/editor/WritingDesk.module.css` (after `.interviewEditor*`, so the width override wins on equal specificity):

```css
/* ── Interview runner ───────────────────────────────────── */

.interviewRunnerModal {
  width: min(620px, 100%);
}

.interviewRunnerProgress {
  margin-left: 10px;
  font-size: 0.75rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--muted, #999);
}

.interviewRunnerBody {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  overflow-y: auto;
}

.interviewRunnerLabel {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent, #6c8cff);
}

.interviewRunnerQuestion {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.45;
  color: var(--text, inherit);
}

.interviewRunnerNote {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--muted, #999);
}

.interviewRunnerAnswer {
  width: 100%;
  min-height: 150px;
  padding: 10px 12px;
  font: inherit;
  line-height: 1.5;
  color: var(--text, inherit);
  background: var(--surface, rgba(128, 128, 128, 0.06));
  border: 1px solid var(--border, rgba(128, 128, 128, 0.25));
  border-radius: 8px;
  resize: vertical;
}

.interviewRunnerAnswer:focus {
  outline: none;
  border-color: var(--accent, #6c8cff);
}

.interviewRunnerCount {
  align-self: center;
  margin-right: 6px;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--muted, #999);
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --pretty false && npx eslint src/components/editor/research/InterviewRunner.tsx`

Expected: no output from either. The component is not mounted yet; Task 12 mounts it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: InterviewRunner asks the questions the model used to

One question at a time, Back / Skip / Finish, a progress readout, and
nothing written until Finish. Every question is always asked, in order,
exactly as written — the article's shape no longer changes run to run."
```

---

## Task 12: The research rail — mount the launcher and both widgets

**Files:**
- Create: `src/components/editor/research/ResearchRail.tsx`

This is the task that closes S7, S8 and S9. `ChatTrays.tsx` was the only host for `InterviewMenu` and both widget renderers, and Phase 2 deleted it. `ResearchRail` is `ChatTrays` minus the chat and minus the AI-set "What I Understand" tray, plus the lore-check trigger.

It reuses the `.chatTray*` rules verbatim: `.chatTrayRail` is already `position: relative; flex: 0 0 auto` and `.chatTrayDrawer` opens at `left: 100%`, so dropping the rail in as the first child of the flex-row `.researchLayout` needs **no CSS change**.

**The lore check replaces, it does not append.** A rule that has stopped firing must stop showing — a deterministic checker states the world as it is now. This is the same content-swap `ChatTrays.onSuggestChange` already used (`ChatTrays.tsx:56-70`), and it is why `makeFlagsWidget` / `makeSuggestionsWidget` are used for the create-if-absent half.

- [ ] **Step 1: Create the component**

Create `src/components/editor/research/ResearchRail.tsx`:

```tsx
"use client";

import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
    useWorkspaceStore,
    selectProjectWorldKey,
    type DeskWidget,
    type DeskWidgetType,
} from '@/store/workspaceStore';
import { worldKeyForProject } from '@/lib/worldKey';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { runLoreRules, findingToFlag, suggestArticles } from '@/lib/loreRules';
import { makeFlagsWidget, type ConsistencyFlag } from '@/lib/consistencyFlags';
import { makeSuggestionsWidget, type ArticleSuggestion } from '@/lib/articleSuggestions';
import { ArticleSuggestionsRenderer } from '../desk/widgets/ArticleSuggestionsRenderer';
import { ConsistencyFlagsRenderer } from '../desk/widgets/ConsistencyFlagsRenderer';
import { InterviewMenu } from './InterviewMenu';
import { InterviewRunner } from './InterviewRunner';
import { InterviewEditorModal } from './InterviewEditorModal';
import { BUILTIN_INTERVIEWS, makeBlankInterview, type Interview } from '@/lib/interviews';
import styles from '../WritingDesk.module.css';

type TrayId = 'suggestions' | 'flags';

interface ResearchRailProps {
    /** Composite research scope key — the board the trays read and write. */
    scopeKey: string | null;
}

/** Put `content` into the board's single widget of `type`, creating it if absent. */
function setWidgetContent(
    widgets: DeskWidget[],
    type: DeskWidgetType,
    make: () => DeskWidget,
    content: Record<string, unknown>,
): DeskWidget[] {
    const existing = widgets.find(w => w.type === type);
    if (!existing) return [...widgets, make()];
    return widgets.map(w => (w.id === existing.id ? { ...w, content: { ...w.content, ...content } } : w));
}

/**
 * The Research tab's left rail: launch an interview, run the lore check, and
 * open either result tray. It is what the chat's tray rail was, minus the chat
 * — the two widget renderers have no other host, since WritingDesk filters
 * both types off the board itself.
 */
export function ResearchRail({ scopeKey }: ResearchRailProps) {
    const [active, setActive] = useState<TrayId | null>(null);
    const [running, setRunning] = useState<Interview | null>(null);
    const [editing, setEditing] = useState<{ interview: Interview; existing: boolean } | null>(null);

    const widgets = useWorkspaceStore(s => (scopeKey ? s.researchStates[scopeKey]?.widgets : undefined)) ?? [];
    const updateResearchState = useWorkspaceStore(s => s.updateResearchState);
    const customInterviews = useWorkspaceStore(s => s.customInterviews);
    const addInterview = useWorkspaceStore(s => s.addInterview);
    const updateInterview = useWorkspaceStore(s => s.updateInterview);
    const deleteInterview = useWorkspaceStore(s => s.deleteInterview);
    const worldKey = useWorkspaceStore(selectProjectWorldKey);

    const interviews: Interview[] = [...BUILTIN_INTERVIEWS, ...customInterviews];

    const suggestionsWidget = widgets.find(w => w.type === 'articleSuggestions');
    const flagsWidget = widgets.find(w => w.type === 'consistencyFlags');
    const suggestions: ArticleSuggestion[] = suggestionsWidget?.content?.suggestions ?? [];
    const flags: ConsistencyFlag[] = flagsWidget?.content?.flags ?? [];

    // ── Lore check ──────────────────────────────────────────
    // Read the world imperatively: the rail must not re-render on every
    // keystroke in a scene just because it could one day check them.
    const runCheck = () => {
        if (!scopeKey) return;
        const s = useWorkspaceStore.getState();
        const projectIds = new Set(
            s.projects.filter(p => worldKeyForProject(p) === worldKey).map(p => p.id),
        );
        const input = {
            entities: s.entities,
            scenes: s.scenes.filter(x => projectIds.has(x.projectId)),
            documents: s.documents.filter(x => projectIds.has(x.projectId)),
            roots: getWorldBibleConfig(s.worldBibles, worldKey).layout.roots,
            worldKey,
        };

        const nextFlags = runLoreRules(input).map(findingToFlag);
        const nextSuggestions = suggestArticles(input);

        let next = s.researchStates[scopeKey]?.widgets ?? [];
        next = setWidgetContent(next, 'consistencyFlags', () => makeFlagsWidget(nextFlags), { flags: nextFlags });
        next = setWidgetContent(next, 'articleSuggestions', () => makeSuggestionsWidget(nextSuggestions), { suggestions: nextSuggestions });
        updateResearchState(scopeKey, { widgets: next });
        setActive(nextFlags.length || !nextSuggestions.length ? 'flags' : 'suggestions');
    };

    // ── Tray edits ──────────────────────────────────────────
    const onSuggestionsChange = (c: { suggestions: ArticleSuggestion[] }) => {
        if (!scopeKey) return;
        updateResearchState(scopeKey, {
            widgets: setWidgetContent(widgets, 'articleSuggestions', () => makeSuggestionsWidget(c.suggestions), c),
        });
    };

    const onFlagsChange = (c: { flags: ConsistencyFlag[] }) => {
        if (!scopeKey) return;
        updateResearchState(scopeKey, {
            widgets: setWidgetContent(widgets, 'consistencyFlags', () => makeFlagsWidget(c.flags), c),
        });
    };

    // ── Interviews ──────────────────────────────────────────
    const saveInterview = (interview: Interview) => {
        if (editing?.existing) updateInterview(interview.id, interview);
        else addInterview(interview);
        setEditing(null);
    };

    const removeInterview = () => {
        if (editing?.existing) deleteInterview(editing.interview.id);
        setEditing(null);
    };

    const tabs: { id: TrayId; icon: string; label: string; badge?: number }[] = [
        { id: 'suggestions', icon: '📝', label: 'Article Suggestions', badge: suggestions.length || undefined },
        { id: 'flags', icon: '⚠️', label: 'Consistency & Gaps', badge: flags.length || undefined },
    ];

    return (
        <div className={styles.chatTrayRail}>
            <button
                className={styles.chatTrayTab}
                onClick={runCheck}
                disabled={!scopeKey}
                title="Check this world for gaps, broken links and duplicate names"
                aria-label="Run the lore check"
            >
                <span className={styles.chatTrayTabIcon}>🔍</span>
            </button>
            <InterviewMenu
                interviews={interviews}
                variant="rail"
                onLaunch={setRunning}
                onNew={() => setEditing({ interview: makeBlankInterview(crypto.randomUUID()), existing: false })}
                onEdit={iv => setEditing(
                    iv.builtIn
                        ? { interview: { ...iv, id: crypto.randomUUID(), builtIn: false, title: `${iv.title} (copy)` }, existing: false }
                        : { interview: iv, existing: true },
                )}
            />

            <span className={styles.chatTrayDivider} />

            {tabs.map(t => (
                <button
                    key={t.id}
                    className={`${styles.chatTrayTab} ${active === t.id ? styles.chatTrayTabActive : ''}`}
                    onClick={() => setActive(a => (a === t.id ? null : t.id))}
                    title={t.label}
                    aria-label={t.label}
                    aria-pressed={active === t.id}
                >
                    <span className={styles.chatTrayTabIcon}>{t.icon}</span>
                    {typeof t.badge === 'number' && <span className={styles.chatTrayBadge}>{t.badge}</span>}
                </button>
            ))}

            {active && (
                <div className={styles.chatTrayDrawer}>
                    <button className={styles.chatTrayClose} onClick={() => setActive(null)} title="Close tray">
                        <X size={18} />
                    </button>
                    <div className={styles.chatTrayDrawerBody}>
                        {active === 'suggestions' && (
                            <ArticleSuggestionsRenderer content={{ suggestions }} onChange={onSuggestionsChange} />
                        )}
                        {active === 'flags' && (
                            <ConsistencyFlagsRenderer content={{ flags }} onChange={onFlagsChange} />
                        )}
                    </div>
                </div>
            )}

            {running && <InterviewRunner interview={running} onClose={() => setRunning(null)} />}

            {editing && (
                <InterviewEditorModal
                    interview={editing.interview}
                    canDelete={editing.existing}
                    onSave={saveInterview}
                    onDelete={removeInterview}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit --pretty false && npx eslint src/components/editor/research/ResearchRail.tsx`

Expected: no output from either. `InterviewMenu` still declares an optional `disabled` prop; not passing it is legal, and Task 13 removes it.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: ResearchRail hosts the interviews launcher and both lore trays

ChatTrays was the only place InterviewMenu and the two widget renderers
were ever mounted — WritingDesk filters both widget types off the board —
so deleting the chat in Phase 2 left all three unreachable. This is that
rail without the chat, plus the lore-check trigger.

The check replaces both lists rather than appending to them: a rule that
has stopped firing has to stop showing."
```

---

## Task 13: Wire the rail in, and clear the leftovers

**Files:**
- Modify: `src/components/editor/ResearchTab.tsx`
- Modify: `src/components/editor/research/InterviewMenu.tsx`
- Modify: `src/components/editor/desk/widgets/ConsistencyFlagsRenderer.tsx`
- Modify: `src/components/editor/desk/widgets/ArticleSuggestionsRenderer.tsx`

- [ ] **Step 1: Mount the rail**

In `src/components/editor/ResearchTab.tsx`, add the import beside the existing `ResearchBoardBar` one:

```typescript
import { ResearchRail } from './research/ResearchRail';
```

and make the rail the first child of `.researchLayout`, where the chat used to be:

```tsx
  return (
    <div className={styles.researchLayout}>
      <ResearchRail scopeKey={scopeKey} />
      <div className={styles.researchMain}>
```

Nothing else in the file changes.

- [ ] **Step 2: Remove `InterviewMenu`'s dead `disabled` prop**

In `src/components/editor/research/InterviewMenu.tsx`, delete lines 10-11:

```typescript
    /** Disabled while a message is streaming. */
    disabled?: boolean;
```

remove it from the destructure on line 24, and delete line 51:

```tsx
                disabled={disabled}
```

There is no stream left to block on, and a launcher that can be disabled by nothing is a control the reader has to reason about for no reason.

- [ ] **Step 3: Remove the dead "Ask" control from the flags widget**

In `src/components/editor/desk/widgets/ConsistencyFlagsRenderer.tsx`, delete the store import (line 4), the `setChatAttachment` selector (line 25), the whole `ask` function (lines 29-32), and the Ask button (line 56). Rewrite the empty state. The file's head becomes:

```tsx
"use client";

import React from 'react';
import type { ConsistencyFlag } from '@/lib/consistencyFlags';
import styles from '../../WritingDesk.module.css';
```

the doc comment becomes:

```tsx
/**
 * Consistency & Gaps widget — everything the lore rules found on the last run:
 * empty descriptions, unfiled articles, articles nothing references, lonely
 * folders, broken links and duplicate names. Each can be dismissed; running
 * the check again rebuilds the list from the world as it stands.
 */
```

the empty state becomes:

```tsx
                    <div className={styles.suggestEmpty}>
                        Nothing flagged. Run the lore check (🔍) to look for empty descriptions, unfiled articles, broken links and duplicate names.
                    </div>
```

and the actions row loses the Ask button, leaving:

```tsx
                        <div className={styles.flagActions}>
                            <button className={styles.flagDismiss} onClick={() => dismiss(f.id)} title="Dismiss">Dismiss</button>
                        </div>
```

- [ ] **Step 4: Correct the suggestions widget's empty state**

In `src/components/editor/desk/widgets/ArticleSuggestionsRenderer.tsx`, replace the empty-state copy at line 185:

```tsx
                        Run the lore check (🔍) and names you keep using that have no article yet will appear here — drag one onto a folder to file it.
```

and update the doc comment at line 39-44:

```tsx
/**
 * Article Suggestions widget — names the lore check found recurring in your
 * writing with no World Bible article yet. Each is grouped under the folder it
 * would be filed in (or Unfiled), can be dragged between groups to re-file, and
 * created into a real article on demand.
 */
```

- [ ] **Step 5: Verify nothing dead is left**

```bash
grep -rn "setChatAttachment" src/components/editor/desk
grep -rn "disabled" src/components/editor/research/InterviewMenu.tsx
npx tsc --noEmit --pretty false
npx eslint src
```

Expected: the first two produce no output; the last two are clean. An unused-import warning from eslint means a deletion in step 3 left something behind — fix it rather than suppress it.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: mount the research rail and clear the chat's leftovers

The Interviews launcher had no disabled state left to honour, and the
flags widget's Ask button pushed an attachment onto a chat that no longer
reads it — a control that looked live and did nothing. Both empty states
still told the reader to ask the assistant."
```

---

## Task 14: Regression and smoke test

**Files:** none — verification only.

- [ ] **Step 1: Full regression**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src
npm run build
```

Expected: all four clean.

- [ ] **Step 2: Confirm no AI crept back in**

```bash
grep -rn "os.homedir\|child_process\|claude-agent-sdk\|renderInterviewGuide\|interviewLaunchLine" src
```

Expected: no output. Phase 5 adds no network call and no dependency.

- [ ] **Step 3: Confirm the leaf-module convention held**

```bash
grep -n "from '@/store\|from 'react'" src/lib/loreRules.ts
```

Expected: exactly one line — `import type { … } from '@/store/workspaceStore';`. A **type-only** store import is the convention (`worldAuthoring.ts:11` does the same); a value import or any React import is a violation.

- [ ] **Step 4: Smoke test the interviews**

Start the dev server, open a project, go to the Research tab.

1. The rail shows 🔍, 🧭 and the two tray tabs.
2. 🧭 lists the five built-ins and any custom interviews. Nothing is disabled.
3. Launch **Character**. The runner opens on "What should this article be called?", showing **1 of 11**. Next is disabled until a name is typed.
4. Next reaches question 1 with its label above the prompt. **Back** returns to the name, which is still there.
5. Answer question 1, **Skip** question 2, answer question 3. The footer count tracks answered questions, not steps.
6. Reach step 11 and press **Finish & create article**. The modal closes.
7. Open the World Bible: the article exists, named as typed, filed under the character folder, with a heading per **answered** question and the answer beneath it. **The skipped question is absent entirely** — no empty heading.
8. Launch **World** (no target type). Step 0 shows the "one article" note. It creates one `lore` article.
9. The pencil on a built-in opens an editable **copy**; the pencil on a custom interview edits it in place and offers Delete.

- [ ] **Step 5: Smoke test the lore rules**

1. Create an article with an empty description, leave a second one Unfiled, give two articles the same name, and type `[[Nowhere]]` into a scene.
2. Press 🔍. The ⚠️ tray badge shows a count and the drawer opens.
3. Every flag reads plainly and names the article. Contradictions render with the ⚠️ icon, gaps with 🕳️.
4. Fix the empty description and press 🔍 again — **that flag is gone**, and the others remain. This is the replace-not-append behaviour.
5. Dismiss a flag. The count drops. Press 🔍 again — a dismissed finding that is still true comes back. That is correct for a checker.

- [ ] **Step 6: Smoke test the suggestions**

1. Write a scene using an invented name three or more times.
2. Press 🔍, open the 📝 tray. The name is listed under Unfiled with a "Appears N times…" tooltip.
3. Drag it onto a folder; the group changes. Press ＋; the article is created and the chip disappears.
4. Press 🔍 again — the name is **not** suggested a second time, because it now has an article.
5. Confirm ordinary sentence openers ("The", "She", "Then") are not suggested.

- [ ] **Step 7: Confirm nothing else regressed**

1. The board still accepts cards, and the scope bar and board switcher still work.
2. The drawer opens **over** the board and closes cleanly; the board is not squashed.
3. The World Bible and the Writing Desk are unaffected.
4. Home's counts of flags and suggestions (`homeStats.ts:176-195`) move after a lore check.

- [ ] **Step 8: Commit any smoke-test fixes**

```bash
git add -A
git commit -m "fix: Phase 5 smoke-test corrections"
```

Skip this step if nothing needed fixing.

---

## Definition of done

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green
- [ ] `npx eslint src` clean
- [ ] `npm run build` succeeds
- [ ] `src/lib/loreRules.ts` imports nothing from the store but types, and nothing from React
- [ ] All six rules are separately exported and separately covered: `empty-description`, `uncategorised`, `never-referenced`, `lonely-category`, `broken-link`, `duplicate-name`
- [ ] `runLoreRules` returns the identical result for the identical input
- [ ] The suggestion threshold is `SUGGESTION_MIN_OCCURRENCES`, not a literal `3`
- [ ] `suggestArticles` returns the **existing** `ArticleSuggestion` interface; `findingToFlag` returns the **existing** `ConsistencyFlag` interface
- [ ] `ArticleSuggestionsRenderer` and `ConsistencyFlagsRenderer` render rule output with no change to their props or their data shape
- [ ] Every interview question is asked, in order; a skipped question leaves no trace in the article
- [ ] The Interviews launcher is mounted and reachable; the runner opens from it
- [ ] `grep -rn "renderInterviewGuide\|interviewLaunchLine" src` returns nothing
- [ ] No dead "Ask" button, and no empty state that mentions an assistant
- [ ] No new dependency, and no network call outside Supabase

---

## Known limits, stated so they are decisions

- **The World interview writes one article, not a folder tree.** Only a model could decide that grouping. Said plainly in the runner (S11).
- **Suggestions have no type.** Frequency cannot tell a character from a city, so every suggestion is `lore` and the writer re-files it. `SUGGESTION_DEFAULT_TYPE` names the choice.
- **`addSuggestionToWidgets` / `addFlagToWidgets` lose their runtime caller.** Replace-not-append is the right semantics for a checker, so the rail swaps the lists directly. Both functions keep their tests and their exports; whether they stay is Phase 9's dead-code call, not this phase's.
- **`.chatTray*` CSS now styles a chat-free rail.** Renaming it to `.loreRail*` touches three files for no behaviour change; it belongs to Phase 8's naming pass.
- **`sanitize.escapeHtml` and `worldAuthoring.escapeHtml` are byte-identical duplicates.** Consolidating them is out of scope here.
- **Rules read `description` and `articleDoc`, not the legacy `articleBlocks`.** This matches what `serializeWorld` already read, so the rules see exactly what the World Bible outline sees.
