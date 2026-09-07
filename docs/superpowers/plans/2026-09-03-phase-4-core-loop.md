# Phase 4 — The Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the loop close. A writer builds a world, writes a manuscript against it, links the two with `[[`, compiles the book with its front matter, and gets one file out — not thirty.

**Architecture:** One new pure module, `src/lib/manuscript.ts`, becomes the single answer to "what is in this book, in what order, with what pages in front of it". Markdown, DOCX and EPUB stop each deriving that for themselves and become three renderers of one `Manuscript` value, so they cannot disagree. Two smaller leaf modules carry the other two fixes: `src/lib/entityTrigger.ts` (which trigger the cursor is inside) and `src/lib/zoneSelection.ts` (when the binder should follow the store). Every task ends with a green `tsc` and a green suite; the old single-document exporters stay alive until nothing calls them, and are retired in one task near the end.

**Tech Stack:** TypeScript (strict), React 19, Next 16, Zustand, TipTap 3 / ProseMirror, Vitest (jsdom), `docx`, `jszip`, DOMPurify.

**Note on the test runner:** `vitest.config.ts` includes only `src/**/*.test.ts` — **not** `.test.tsx`. Every test below is a `.test.ts` file exercising a pure module. No component is tested by rendering it.

**Bundle rules this plan preserves:**

- `docx` stays behind `await import('docx')` (`src/lib/export.ts:106`). The new DOCX builder keeps that line.
- `mammoth` stays behind `await import('mammoth')` (`src/components/ui/ImportModal.tsx:89,150`). Untouched.
- `jszip` is statically imported at `src/lib/epub.ts:8`. This plan adds no second static runtime import to that module.
- `sanitizeHtml` from `src/lib/sanitize.ts` remains the only sanitiser. `escapeHtml` from the same module is used for generated markup.

**Note on a concurrent branch.** While this plan was being written, another session briefly had an uncommitted refactor of `src/lib/export.ts` in the tree — splitting `exportAsDocx` into `buildDocxDocument` (returning `Docx.Document`) plus a thin download wrapper — alongside a `src/lib/export.test.ts` checking the EPUB binary layout. Both were reverted before this plan was finished, so `export.ts` is back to its committed shape. That work belongs to Phase 3's item `21` and may land again at any time. **This plan is written to tolerate either state:** every edit below names the function it changes rather than a line number, and Tasks 5 and 10 say explicitly what to do if that split has landed. Check first:

```bash
grep -n "buildDocxDocument" src/lib/export.ts; ls src/lib/export.test.ts 2>/dev/null
```

---

## What the roadmap got wrong, verified against the code

Read this before starting. Three roadmap statements did not survive checking.

### 1. The `@` mention extension is **not** "used in the editor"

Roadmap item `2e` says: *"The `@` mention extension (`EntitySuggest`, used in the editor) already proves the pattern works — study it and follow it."*

`EntitySuggest` is registered in exactly one place:

```
$ grep -rn "EntitySuggest" src --include=*.tsx --include=*.ts | grep -v "src/lib/EntitySuggest.ts"
src/components/editor/EntitySuggestDropdown.tsx:5    (the dropdown itself)
src/components/editor/ScreenplayEditor.tsx:15,16,34  (the only registration)
```

`ScreenplayEditor.tsx` is **deleted by Phase 1, Task 3**. The editor that actually renders story scenes is `src/components/editor/desk/DeskTipTapEditor.tsx`, and its extension list (`:31-40`) is `StarterKit, Underline, TextStyle, FontFamily, FontSize, Highlight, Color, TextAlign` — no `EntityMark`, no `EntitySuggest`, and no `EntitySuggestDropdown` mounted anywhere near it.

**Consequence:** when Phase 4 begins, `@` mentions are dead code, not a working precedent. Item `2e` is therefore **not** "build entity linking following the `@` pattern". It is: mount the existing `EntityMark` + `EntitySuggest` + `EntitySuggestDropdown` into `DeskTipTapEditor`, with `[[` working. Tasks 11 and 12 do this.

Phase 1 does **not** delete `EntityMark.ts`, `EntitySuggest.ts` or `EntitySuggestDropdown.tsx` (its Task 7 list holds seven components, none of them these), so all three are waiting to be wired.

**The trigger is hardcoded, not configurable.** `EntitySuggest` has no `addOptions()` and takes no configuration. Its trigger lives in one regex inside the plugin's `apply`:

```
src/lib/EntitySuggest.ts:57    const match = textBefore.match(/@([\w\s]*)$/);
```

So this is a mount **plus** a minimal parameterisation, not a mount plus an option. Task 11 lifts that regex into a leaf module that answers for both triggers and reports which one fired; the extension keeps its single plugin key and gains one field of state. Nothing else about the extension changes.

**Decision — `@` is kept alongside `[[`, not replaced.** They are given different jobs, and the difference is what makes `[[` worth having:

- `@name` — link an entry that **already exists**. Picks from the list; no result means no result.
- `[[name` — **create** an entry at the point of inspiration. Its first row is always `Create "name"`, with existing matches below it.

The README only ever promised `[[`, and Task 13 makes that claim true. `@` is kept because keeping it costs one entry in a pattern array and one branch in the dropdown, while removing it would mean deleting a working code path that a writer with a large World Bible wants — the fast link that does not offer to create a duplicate. Task 13 documents both, so the README stops under-describing what the app does rather than the app being trimmed to match an out-of-date README.

### 2. The dropdown will not position correctly on the desk without a change

`EntitySuggestDropdown` computes viewport coordinates from `coordsAtPos` and renders a `position: fixed` box:

```
src/components/editor/EntitySuggestDropdown.module.css:2   position: fixed;
src/components/editor/EntitySuggestDropdown.tsx:42-43       const coords = activeEditor.view.coordsAtPos(state.from);
                                                            setPosition({ top: coords.bottom + window.scrollY, left: coords.left + window.scrollX });
```

That works in the screenplay editor, which renders in an ordinary document flow. It will **not** work inside the desk, for three separate reasons, each verified:

| Problem | Evidence | Effect |
|---------|----------|--------|
| A transformed ancestor becomes the containing block for `position: fixed` | `WritingDesk.tsx:647` sets `transform: translate(...) scale(zoom)` inline on `.deskCanvasInner`, and `WritingDesk.module.css:37-43` gives it `transform-origin: 0 0`. Canvas widgets — including the writing zone — render inside it (`WritingDesk.tsx:651`) | The dropdown's viewport coordinates are re-interpreted relative to the canvas layer **and scaled by `zoom`**. At any zoom but 1.0, or after any pan, it lands in the wrong place |
| The viewport clips its descendants | `WritingDesk.module.css:11-14` — `.deskViewport { position: relative; overflow: hidden; }` | A dropdown near the bottom or right edge of the prose column is cut off |
| Scroll is counted twice | The element is `position: fixed` (already viewport-relative) but the code adds `window.scrollY` / `window.scrollX` | Latent today because the screenplay page does not scroll; it becomes a visible offset anywhere the window scrolls |

**Fix, in Task 12 Step 3:** render the dropdown through `createPortal(…, document.body)`, which escapes every transformed and clipping ancestor, and drop the two scroll addends so the `fixed` coordinates mean what they say. `createPortal` is already the established escape hatch in this subtree — `StoryWritingZone.tsx:14,448` uses it for focus mode. This is a five-line change to a file that is being edited anyway, and it also fixes the latent scroll bug for the screenplay editor's successor.

### 3. `InlineEntryCreator`'s focus-return event has no listener

`src/components/world/InlineEntryCreator.tsx:46-48` says the modal dispatches an event "that WritingEditor listens for". Nothing listens:

```
$ grep -rn "returnFocusToEditor" src
src/components/world/InlineEntryCreator.tsx:52   (the dispatch, and nothing else)
```

Task 12 adds the first listener.

### 4. `2e.2`'s "consistency checker" claim is already Phase 2's job

Phase 2, Task 8, Step 4 removes *"the four AI providers, the consistency checker, local models, and image generation"* from the README. Item `2e.2` lists the consistency checker again. Task 13 is written to correct **whatever remains** and to assert the end state, rather than assuming Phase 2 left it there.

### What the roadmap got right

- Item `02` is real. `ExportModal.tsx:34` filters scenes to `activeDocumentId`, and a Document **is** a chapter (`StoryWritingZone.tsx:359` renders `Chapter {idx + 1}` per document). A 30-chapter novel is 30 files, and `epub.ts` makes each of those files a "book" whose chapters are that one chapter's scenes.
- Item `03` is real, and item `15c` is the same defect seen from the other end. `DraftExport.exportToDesk` (`:116-118`) writes `setActiveDocument` / `setActiveScene` into the **store**, while `StoryWritingZone` reads its chapter from the **widget** (`:97` — `content.documentId`). The store moves; the binder does not. `ExportModal` reads the store, which the binder never writes — so Export is bound to a document the writer may never have opened.
- Item `11` is real. Nothing anywhere emits a title page, a copyright page, a dedication or a contents list; `epub.ts` builds a nav document but no front matter, and there is no compile step.

---

## The data model, confirmed

| Concept | Store type | Ordering |
|---------|-----------|----------|
| Book | `Project` (`workspaceStore.ts:97`) | — |
| Chapter | `Document` (`workspaceStore.ts:121`) | **No `order` field for stories.** The `order?` at `:132` is documented "Visual novel projects only". `StoryWritingZone.tsx:81-86` sorts by `createdAt`, and manuscript assembly must match it |
| Section | `Scene` (`workspaceStore.ts:137`) | `order: number` at `:143` |

Chapter order is therefore `createdAt` ascending, ties broken by `id` so the sequence never shuffles between two exports of the same book.

---

## File Structure

**Created:**

| Path | Why |
|------|-----|
| `src/lib/manuscript.ts` | Manuscript assembly, chapter ordering, front matter. Leaf module |
| `src/lib/manuscript.test.ts` | Its suite |
| `src/lib/manuscriptMarkdown.test.ts` | Covers `buildManuscriptMarkdown` in `export.ts` |
| `src/lib/zoneSelection.ts` | When the binder should follow the store. Leaf module |
| `src/lib/zoneSelection.test.ts` | Its suite |
| `src/lib/entityTrigger.ts` | Which trigger (`@` or `[[`) the cursor is inside. Leaf module |
| `src/lib/entityTrigger.test.ts` | Its suite |
| `src/store/frontMatter.test.ts` | Covers `selectProjectFrontMatter` |

**Modified:**

| Path | Change |
|------|--------|
| `src/lib/export.ts` | Exports `htmlToMarkdown`; adds `buildManuscriptMarkdown`, `exportManuscriptAsMarkdown`, `htmlToDocxParagraphs`, `buildManuscriptDocxDocument`, `exportManuscriptAsDocx`. Task 10 retires `exportAsMarkdown`, `exportAsDocx`, `buildMarkdownContent` (and `buildDocxDocument` if it exists) |
| `src/lib/epub.ts` | Adds `buildManuscriptEpubZip`, `buildManuscriptEpubBlob`, `exportManuscriptAsEpub`. Task 10 retires `buildEpubZip`, `buildEpubBlob`, `exportAsEpub` |
| `src/lib/epub.test.ts` | Rewritten against the manuscript shape |
| `src/lib/export.test.ts` | Retargeted at the manuscript builder in Task 10 — **only if the file exists**; it does not on the committed tree |
| `src/store/workspaceStore.ts` | `Project.frontMatter`; `selectProjectFrontMatter` |
| `src/lib/EntitySuggest.ts` | Matching delegated to `entityTrigger.ts`; state gains `trigger` |
| `src/components/editor/EntitySuggestDropdown.tsx` | A "Create" row for `[[`; listens for the created entity; returns focus; portalled to the body and its double-counted scroll offset removed, so it positions correctly on the transformed, clipping desk canvas |
| `src/components/editor/desk/DeskTipTapEditor.tsx` | Registers `EntityMark` + `EntitySuggest`, mounts the dropdown |
| `src/components/world/InlineEntryCreator.tsx` | Dispatches `lorecanvas:entityCreated` |
| `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx` | Chapter/scene selection writes to, and follows, the store |
| `src/components/ui/ExportModal.tsx` | Becomes the compile step |
| `src/components/ui/ExportModal.module.css` | Compile-step styles |
| `README.md` | The remaining false claims |

**Deleted:** no files. Task 10 removes six now-unused exported functions — `exportAsMarkdown`, `exportAsDocx`, `buildMarkdownContent`, `buildEpubZip`, `buildEpubBlob`, `exportAsEpub` — plus `buildDocxDocument` if the concurrent split has landed.

---

## Task 1: Assemble a manuscript from chapters and sections

**Files:**
- Create: `src/lib/manuscript.ts`
- Create: `src/lib/manuscript.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/manuscript.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { orderChapters, orderSections, assembleManuscript, type ChapterLike, type SectionLike } from './manuscript';

export const chapter = (id: string, title: string, createdAt: string, projectId = 'p1'): ChapterLike =>
    ({ id, projectId, title, createdAt });

export const section = (id: string, documentId: string, title: string, order: number, content: string): SectionLike =>
    ({ id, documentId, title, content, order });

describe('orderChapters', () => {
    it('orders by creation time, which is the only order a story chapter has', () => {
        const docs = [
            chapter('c', 'Third', '2026-03-01T00:00:00Z'),
            chapter('a', 'First', '2026-01-01T00:00:00Z'),
            chapter('b', 'Second', '2026-02-01T00:00:00Z'),
        ];
        expect(orderChapters(docs, 'p1').map(d => d.title)).toEqual(['First', 'Second', 'Third']);
    });

    it('breaks ties on id so two exports of one book agree', () => {
        const docs = [
            chapter('z', 'Zed', '2026-01-01T00:00:00Z'),
            chapter('a', 'Ay', '2026-01-01T00:00:00Z'),
        ];
        expect(orderChapters(docs, 'p1').map(d => d.id)).toEqual(['a', 'z']);
    });

    it('leaves other projects out', () => {
        const docs = [
            chapter('a', 'Mine', '2026-01-01T00:00:00Z'),
            chapter('b', 'Theirs', '2026-01-02T00:00:00Z', 'p2'),
        ];
        expect(orderChapters(docs, 'p1').map(d => d.id)).toEqual(['a']);
    });
});

describe('orderSections', () => {
    it('orders by the order field and ignores other chapters', () => {
        const scenes = [
            section('s2', 'a', 'Two', 1, '<p>two</p>'),
            section('s9', 'b', 'Elsewhere', 0, '<p>nope</p>'),
            section('s1', 'a', 'One', 0, '<p>one</p>'),
        ];
        expect(orderSections(scenes, 'a').map(s => s.title)).toEqual(['One', 'Two']);
    });
});

describe('assembleManuscript', () => {
    const docs = [
        chapter('a', 'Chapter One', '2026-01-01T00:00:00Z'),
        chapter('b', 'Chapter Two', '2026-02-01T00:00:00Z'),
    ];
    const scenes = [
        section('s1', 'a', 'Opening', 0, '<p>alpha</p>'),
        section('s2', 'a', 'Closing', 1, '<p>beta</p>'),
        section('s3', 'b', 'Only', 0, '<p>gamma</p>'),
    ];

    it('carries every chapter, not just one', () => {
        const m = assembleManuscript({ title: 'My Book' }, docs, scenes, 'p1');
        expect(m.chapters.map(c => c.title)).toEqual(['Chapter One', 'Chapter Two']);
        expect(m.chapters[0].sections.map(s => s.html)).toEqual(['<p>alpha</p>', '<p>beta</p>']);
    });

    it('honours an explicit include list', () => {
        const m = assembleManuscript({ title: 'My Book' }, docs, scenes, 'p1', { includedChapterIds: ['b'] });
        expect(m.chapters.map(c => c.id)).toEqual(['b']);
    });

    it('names untitled chapters and sections rather than emitting blanks', () => {
        const m = assembleManuscript(
            { title: '' },
            [chapter('a', '', '2026-01-01T00:00:00Z')],
            [section('s1', 'a', '', 0, '')],
            'p1',
        );
        expect(m.title).toBe('Untitled');
        expect(m.chapters[0].title).toBe('Untitled Chapter');
        expect(m.chapters[0].sections[0].title).toBe('Untitled');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/manuscript.test.ts`

Expected: FAIL — `Error: Failed to resolve import "./manuscript" from "src/lib/manuscript.test.ts". Does the file exist?`

- [ ] **Step 3: Write the module**

Create `src/lib/manuscript.ts`:

```typescript
/**
 * Manuscript assembly — LEAF MODULE (no store or React import).
 *
 * A LoreCanvas book is a project holding Documents (chapters), each holding
 * ordered Scenes (sections). Every exporter needs the same three answers:
 * which chapters are in, what order they run in, and what pages sit in front
 * of chapter one. This module answers all three and hands back one plain
 * `Manuscript` value, so Markdown, DOCX and EPUB agree by construction rather
 * than by three separate derivations that drift.
 *
 * Structural shapes are declared here rather than imported from the store, so
 * the arithmetic stays testable and the module stays leaf-level.
 */

/** The structural shape of a store Document. */
export interface ChapterLike {
    id: string;
    projectId: string;
    title: string;
    createdAt: Date | string | number;
}

/** The structural shape of a store Scene. */
export interface SectionLike {
    id: string;
    documentId: string;
    title: string;
    content: string;
    order: number;
}

export interface ManuscriptSection {
    id: string;
    title: string;
    /** The writer's own HTML. Sanitised by whichever exporter emits markup. */
    html: string;
}

export interface ManuscriptChapter {
    id: string;
    title: string;
    sections: ManuscriptSection[];
}

export interface ManuscriptMeta {
    title: string;
    author?: string;
}

export interface Manuscript {
    title: string;
    author: string;
    chapters: ManuscriptChapter[];
}

export interface AssembleOptions {
    /** When given, only these chapter ids are compiled — still in book order. */
    includedChapterIds?: string[] | null;
}

/** ms since epoch for a createdAt that may have come back from JSON as a string. */
function createdMs(value: Date | string | number): number {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/**
 * Chapters in reading order.
 *
 * A story Document carries no `order` — the field on it is documented "Visual
 * novel projects only" — so creation time is the order, the same rule the
 * binder spine already uses. Ties break on id so two exports of one book never
 * disagree about which chapter came first.
 */
export function orderChapters(documents: ChapterLike[], projectId: string): ChapterLike[] {
    return documents
        .filter(d => d.projectId === projectId)
        .slice()
        .sort((a, b) =>
            createdMs(a.createdAt) - createdMs(b.createdAt)
            || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The sections of one chapter, in order. */
export function orderSections(sections: SectionLike[], documentId: string): SectionLike[] {
    return sections
        .filter(s => s.documentId === documentId)
        .slice()
        .sort((a, b) => a.order - b.order);
}

/** The whole book: every included chapter, each with its ordered sections. */
export function assembleManuscript(
    meta: ManuscriptMeta,
    documents: ChapterLike[],
    sections: SectionLike[],
    projectId: string,
    options: AssembleOptions = {},
): Manuscript {
    const included = options.includedChapterIds ? new Set(options.includedChapterIds) : null;

    const chapters: ManuscriptChapter[] = orderChapters(documents, projectId)
        .filter(d => !included || included.has(d.id))
        .map(d => ({
            id: d.id,
            title: d.title || 'Untitled Chapter',
            sections: orderSections(sections, d.id).map(s => ({
                id: s.id,
                title: s.title || 'Untitled',
                html: s.content || '',
            })),
        }));

    return {
        title: meta.title || 'Untitled',
        author: meta.author?.trim() || '',
        chapters,
    };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/manuscript.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/manuscript.ts src/lib/manuscript.test.ts
git commit -m "feat: assemble a whole manuscript from its chapters

A story Document has no order field — the one on it is visual-novel only — so
chapters order by createdAt, matching the binder spine, with id as the
tie-break so two exports of one book never disagree."
```

---

## Task 2: Front matter and the compile summary

**Files:**
- Modify: `src/lib/manuscript.ts`
- Modify: `src/lib/manuscript.test.ts`

Front-matter pages are **generated** markup built from escaped text. No user HTML reaches an exporter through this path, so a copyright line cannot smuggle a `<script>` into an EPUB.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/manuscript.test.ts`:

```typescript
import {
    resolveFrontMatter,
    DEFAULT_FRONT_MATTER,
    buildFrontMatterPages,
    manuscriptWordCount,
    assembleChapter,
} from './manuscript';

describe('resolveFrontMatter', () => {
    it('fills in everything a project never set', () => {
        expect(resolveFrontMatter(undefined)).toEqual(DEFAULT_FRONT_MATTER);
        expect(resolveFrontMatter(null)).toEqual(DEFAULT_FRONT_MATTER);
    });

    it('keeps what the writer did set', () => {
        expect(resolveFrontMatter({ dedication: 'For Ada', contents: false }))
            .toEqual({ ...DEFAULT_FRONT_MATTER, dedication: 'For Ada', contents: false });
    });
});

describe('buildFrontMatterPages', () => {
    const chapters = [
        { id: 'a', title: 'Chapter One', sections: [] },
        { id: 'b', title: 'Chapter Two', sections: [] },
    ];

    it('emits a title page, a copyright page, a dedication and a contents list', () => {
        const pages = buildFrontMatterPages(
            { title: 'My Book', author: 'Jane Roe' },
            chapters,
            resolveFrontMatter({ copyright: '(c) 2026 Jane Roe', dedication: 'For Ada' }),
        );
        expect(pages.map(p => p.id)).toEqual([
            'front-title', 'front-copyright', 'front-dedication', 'front-contents',
        ]);
        expect(pages[0].title).toBe('My Book');
        expect(pages[0].lines).toEqual(['Jane Roe']);
        expect(pages[1].lines).toEqual(['(c) 2026 Jane Roe']);
        expect(pages[3].html).toContain('Chapter Two');
    });

    it('omits every page the writer left blank or switched off', () => {
        const pages = buildFrontMatterPages(
            { title: 'My Book' },
            chapters,
            resolveFrontMatter({ titlePage: false, contents: false }),
        );
        expect(pages).toEqual([]);
    });

    it('drops the contents page when there are no chapters to list', () => {
        const pages = buildFrontMatterPages({ title: 'Empty' }, [], resolveFrontMatter({}));
        expect(pages.map(p => p.id)).toEqual(['front-title']);
    });

    it('escapes front-matter text so a copyright line cannot inject markup', () => {
        const pages = buildFrontMatterPages(
            { title: 'X' },
            [],
            resolveFrontMatter({ titlePage: false, copyright: '<script>alert(1)</script>' }),
        );
        expect(pages[0].html).not.toContain('<script>');
        expect(pages[0].html).toContain('&lt;script&gt;');
    });
});

describe('assembleManuscript front matter', () => {
    it('puts the pages on the manuscript itself', () => {
        const m = assembleManuscript(
            { title: 'My Book', author: 'Jane Roe' },
            [chapter('a', 'Chapter One', '2026-01-01T00:00:00Z')],
            [section('s1', 'a', 'Opening', 0, '<p>alpha</p>')],
            'p1',
            { frontMatter: { dedication: 'For Ada' } },
        );
        expect(m.pages.map(p => p.id)).toEqual(['front-title', 'front-dedication', 'front-contents']);
    });
});

describe('assembleChapter', () => {
    it('is a manuscript of one chapter, with no front matter', () => {
        const doc = chapter('a', 'Chapter One', '2026-01-01T00:00:00Z');
        const m = assembleChapter({ title: 'My Book', author: 'Jane Roe' }, doc, [
            section('s1', 'a', 'Opening', 0, '<p>alpha</p>'),
            section('s9', 'b', 'Elsewhere', 0, '<p>nope</p>'),
        ]);
        expect(m.pages).toEqual([]);
        expect(m.chapters).toHaveLength(1);
        expect(m.chapters[0].sections.map(s => s.title)).toEqual(['Opening']);
        expect(m.title).toBe('Chapter One');
        expect(m.author).toBe('Jane Roe');
    });
});

describe('manuscriptWordCount', () => {
    it('counts the words in the body, not the tags', () => {
        const m = {
            title: 'X', author: '', pages: [], chapters: [
                { id: 'a', title: 'One', sections: [{ id: 's1', title: 'S', html: '<p>one two</p><p>three</p>' }] },
            ],
        };
        expect(manuscriptWordCount(m)).toBe(3);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/manuscript.test.ts`

Expected: FAIL — `SyntaxError: [vite] The requested module '/src/lib/manuscript.ts' does not provide an export named 'resolveFrontMatter'`.

- [ ] **Step 3: Add front matter to the module**

In `src/lib/manuscript.ts`, add the import directly under the doc comment:

```typescript
import { escapeHtml } from '@/lib/sanitize';
```

Add these types beside `ManuscriptSection`:

```typescript
/** What the writer chose on the compile step. Stored on the project. */
export interface FrontMatter {
    titlePage: boolean;
    contents: boolean;
    /** Blank means the page is omitted entirely. */
    copyright: string;
    dedication: string;
}

export const DEFAULT_FRONT_MATTER: FrontMatter = {
    titlePage: true,
    contents: true,
    copyright: '',
    dedication: '',
};

/** A front-matter page. Generated markup only — never the writer's own HTML. */
export interface ManuscriptPage {
    id: string;
    title: string;
    /** Body markup, without the heading: the exporters add that themselves. */
    html: string;
    /** The same body as plain-text lines, for Markdown and DOCX. */
    lines: string[];
}
```

Add `pages: ManuscriptPage[];` to the `Manuscript` interface, above `chapters`, and add this field to `AssembleOptions`:

```typescript
    /** The compile step's choices. Defaults are filled in when omitted. */
    frontMatter?: Partial<FrontMatter> | null;
```

Add these functions above `assembleManuscript`:

```typescript
/** Fills in anything a project has never set. */
export function resolveFrontMatter(partial?: Partial<FrontMatter> | null): FrontMatter {
    return { ...DEFAULT_FRONT_MATTER, ...(partial ?? {}) };
}

/** Free text to trimmed, non-empty lines. Front-matter text is never rich. */
function textLines(text: string): string[] {
    return text.split(/\n+/).map(line => line.trim()).filter(Boolean);
}

/**
 * The pages that run before chapter one.
 *
 * Each is built from escaped text, so nothing a writer types into the compile
 * step's copyright or dedication field can reach an exporter as markup.
 */
export function buildFrontMatterPages(
    meta: ManuscriptMeta,
    chapters: ManuscriptChapter[],
    fm: FrontMatter,
): ManuscriptPage[] {
    const pages: ManuscriptPage[] = [];
    const title = meta.title || 'Untitled';
    const author = meta.author?.trim() || '';

    if (fm.titlePage) {
        pages.push({
            id: 'front-title',
            title,
            html: author ? `<p>${escapeHtml(author)}</p>` : '',
            lines: author ? [author] : [],
        });
    }

    const copyright = textLines(fm.copyright);
    if (copyright.length > 0) {
        pages.push({
            id: 'front-copyright',
            title: 'Copyright',
            html: copyright.map(l => `<p>${escapeHtml(l)}</p>`).join(''),
            lines: copyright,
        });
    }

    const dedication = textLines(fm.dedication);
    if (dedication.length > 0) {
        pages.push({
            id: 'front-dedication',
            title: 'Dedication',
            html: dedication.map(l => `<p>${escapeHtml(l)}</p>`).join(''),
            lines: dedication,
        });
    }

    if (fm.contents && chapters.length > 0) {
        const titles = chapters.map(c => c.title);
        pages.push({
            id: 'front-contents',
            title: 'Contents',
            html: `<ol>${titles.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ol>`,
            lines: titles,
        });
    }

    return pages;
}

/** Words across every chapter body — what the compile step reports. */
export function manuscriptWordCount(m: Manuscript): number {
    return m.chapters.reduce((total, c) => total + c.sections.reduce(
        (n, s) => n + s.html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length,
        0), 0);
}
```

In `assembleManuscript`, replace the `return` statement with:

```typescript
    const resolvedTitle = meta.title || 'Untitled';
    return {
        title: resolvedTitle,
        author: meta.author?.trim() || '',
        pages: buildFrontMatterPages(
            { title: resolvedTitle, author: meta.author },
            chapters,
            resolveFrontMatter(options.frontMatter),
        ),
        chapters,
    };
```

Add at the end of the file:

```typescript
/**
 * One chapter on its own — a manuscript of one, with no front matter.
 *
 * "This chapter" and "the whole book" are then the same code path with a
 * different chapter list, so they cannot format differently.
 */
export function assembleChapter(
    meta: ManuscriptMeta,
    document: ChapterLike,
    sections: SectionLike[],
): Manuscript {
    return assembleManuscript(
        { title: document.title || meta.title, author: meta.author },
        [document],
        sections,
        document.projectId,
        {
            frontMatter: { titlePage: false, contents: false, copyright: '', dedication: '' },
            includedChapterIds: [document.id],
        },
    );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/manuscript.test.ts`

Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/manuscript.ts src/lib/manuscript.test.ts
git commit -m "feat: front matter pages for the manuscript

Title page, copyright, dedication and contents, each omitted when the writer
leaves it blank. Every page is generated from escaped text, so nothing typed
into a copyright field reaches an exporter as markup."
```

---

## Task 3: Store the front-matter choices on the project

**Files:**
- Modify: `src/store/workspaceStore.ts` — the `Project` interface at `:97-119`, and beside `selectProjectWorldKey` at `:1210`
- Create: `src/store/frontMatter.test.ts`

No migration step is needed: the field is optional and every read goes through `resolveFrontMatter`, which supplies the defaults.

- [ ] **Step 1: Write the failing test**

Create `src/store/frontMatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { selectProjectFrontMatter, type WorkspaceState } from './workspaceStore';
import { DEFAULT_FRONT_MATTER } from '@/lib/manuscript';

function stateWith(project: Record<string, unknown> | null): WorkspaceState {
    return {
        activeProjectId: project ? 'p1' : null,
        projects: project ? [project] : [],
    } as unknown as WorkspaceState;
}

describe('selectProjectFrontMatter', () => {
    it('gives a project that has never been compiled the defaults', () => {
        expect(selectProjectFrontMatter(stateWith({ id: 'p1', name: 'Book' })))
            .toEqual(DEFAULT_FRONT_MATTER);
    });

    it('gives the defaults when there is no active project at all', () => {
        expect(selectProjectFrontMatter(stateWith(null))).toEqual(DEFAULT_FRONT_MATTER);
    });

    it('merges what the writer saved over the defaults', () => {
        const state = stateWith({ id: 'p1', name: 'Book', frontMatter: { dedication: 'For Ada' } });
        expect(selectProjectFrontMatter(state))
            .toEqual({ ...DEFAULT_FRONT_MATTER, dedication: 'For Ada' });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store/frontMatter.test.ts`

Expected: FAIL — `SyntaxError: [vite] The requested module '/src/store/workspaceStore.ts' does not provide an export named 'selectProjectFrontMatter'`.

- [ ] **Step 3: Add the field and the selector**

In `src/store/workspaceStore.ts`, add to the import block beside `import type { ProjectBrief } from '@/lib/workSubTypes';` (line 15):

```typescript
import { resolveFrontMatter, type FrontMatter } from '@/lib/manuscript';
```

In the `Project` interface, directly after `authorName?: string;` (line 109):

```typescript
    /** Compile-step choices: title page, copyright, dedication, contents. */
    frontMatter?: FrontMatter;
```

Directly below `selectProjectWorldKey` (lines 1210-1211), add:

```typescript
/**
 * The active project's front-matter choices, with defaults filled in. Every
 * reader goes through here, so a project saved before the compile step existed
 * still gets a title page and a contents list.
 */
export const selectProjectFrontMatter = (state: WorkspaceState): FrontMatter =>
    resolveFrontMatter(state.projects.find(p => p.id === state.activeProjectId)?.frontMatter);
```

`updateProject` (`:805`) already takes `Partial<Omit<Project, 'id' | 'createdAt'>>`, so no new action is needed. `partializeWorkspace` (`:1222`) persists `projects` wholesale, so the field syncs with no further change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/store/frontMatter.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 5: Full check**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/workspaceStore.ts src/store/frontMatter.test.ts
git commit -m "feat: persist the compile step's front matter on the project

Optional field, read through resolveFrontMatter, so no migration is needed and
a project written before the compile step existed still gets a title page."
```

---

## Task 4: Export the whole manuscript as Markdown

**Files:**
- Modify: `src/lib/export.ts`
- Create: `src/lib/manuscriptMarkdown.test.ts`

`exportAsMarkdown` stays alive until Task 10, so the build is green either way.

- [ ] **Step 1: Write the failing test**

Create `src/lib/manuscriptMarkdown.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildManuscriptMarkdown } from './export';
import { assembleManuscript, type ChapterLike, type SectionLike } from './manuscript';

const docs: ChapterLike[] = [
    { id: 'a', projectId: 'p1', title: 'Chapter One', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', projectId: 'p1', title: 'Chapter Two', createdAt: '2026-02-01T00:00:00Z' },
];
const scenes: SectionLike[] = [
    { id: 's1', documentId: 'a', title: 'Opening', order: 0, content: '<p>The <strong>first</strong> line.</p>' },
    { id: 's2', documentId: 'a', title: 'Closing', order: 1, content: '<p>The last line.</p>' },
    { id: 's3', documentId: 'b', title: 'Only', order: 0, content: '<p>Elsewhere.</p>' },
];

const bare = { titlePage: false, contents: false };

describe('buildManuscriptMarkdown', () => {
    it('writes every chapter into one document', () => {
        const md = buildManuscriptMarkdown(
            assembleManuscript({ title: 'My Book' }, docs, scenes, 'p1', { frontMatter: bare }));
        expect(md).toContain('# Chapter One');
        expect(md).toContain('# Chapter Two');
        expect(md).toContain('## Opening');
        expect(md).toContain('## Closing');
        expect(md).toContain('## Only');
    });

    it('keeps the chapters in book order', () => {
        const md = buildManuscriptMarkdown(
            assembleManuscript({ title: 'My Book' }, docs, scenes, 'p1', { frontMatter: bare }));
        expect(md.indexOf('# Chapter One')).toBeLessThan(md.indexOf('# Chapter Two'));
    });

    it('puts the front matter in front of chapter one', () => {
        const md = buildManuscriptMarkdown(assembleManuscript(
            { title: 'My Book', author: 'Jane Roe' }, docs, scenes, 'p1',
            { frontMatter: { dedication: 'For Ada' } }));
        expect(md.indexOf('# My Book')).toBe(0);
        expect(md).toContain('Jane Roe');
        expect(md.indexOf('# Dedication')).toBeLessThan(md.indexOf('# Chapter One'));
        expect(md.indexOf('# Contents')).toBeLessThan(md.indexOf('# Chapter One'));
    });

    it('converts the writer inline formatting rather than emitting tags', () => {
        const md = buildManuscriptMarkdown(
            assembleManuscript({ title: 'X' }, docs, scenes, 'p1', { frontMatter: bare }));
        expect(md).toContain('**first**');
        expect(md).not.toContain('<strong>');
        expect(md).not.toContain('<p>');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/manuscriptMarkdown.test.ts`

Expected: FAIL — `SyntaxError: [vite] The requested module '/src/lib/export.ts' does not provide an export named 'buildManuscriptMarkdown'`.

- [ ] **Step 3: Add the builder and the download**

In `src/lib/export.ts`, add to the import block below `import { escapeHtml, sanitizeHtml } from '@/lib/sanitize';`:

```typescript
import type { Manuscript } from '@/lib/manuscript';
```

Change the declaration of `htmlToMarkdown` from `function htmlToMarkdown(` to `export function htmlToMarkdown(` — the manuscript builder needs it and it is otherwise unchanged.

Then add, directly after `exportAsMarkdown`:

```typescript
/**
 * The whole manuscript as Markdown: front-matter pages, then every chapter and
 * its sections. Pure — the download wrapper below is separate, so this is
 * testable without a DOM download.
 */
export function buildManuscriptMarkdown(manuscript: Manuscript): string {
    const blocks: string[] = [];

    manuscript.pages.forEach(page => {
        blocks.push(`# ${page.title}`);
        page.lines.forEach(line => blocks.push(line));
    });

    manuscript.chapters.forEach(chapter => {
        blocks.push(`# ${chapter.title}`);
        chapter.sections.forEach(section => {
            blocks.push(`## ${section.title}`);
            const body = htmlToMarkdown(section.html).trim();
            if (body) blocks.push(body);
        });
    });

    return `${blocks.join('\n\n')}\n`;
}

/** Downloads the compiled manuscript as one .md file. */
export function exportManuscriptAsMarkdown(manuscript: Manuscript): void {
    downloadFile(
        buildManuscriptMarkdown(manuscript),
        `${slugify(manuscript.title) || 'manuscript'}.md`,
        'text/markdown',
    );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/manuscriptMarkdown.test.ts`

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export.ts src/lib/manuscriptMarkdown.test.ts
git commit -m "feat: Markdown export of the whole manuscript

Thirty chapters used to mean thirty files stitched by hand. One file now,
front matter first."
```

---

## Task 5: Export the whole manuscript as DOCX

**Files:**
- Modify: `src/lib/manuscript.ts`, `src/lib/manuscript.test.ts`
- Modify: `src/lib/export.ts`

The docx library is described as a list of plain descriptors first, so the layout decisions — which headings break a page — are testable without loading `docx`. The dynamic `await import('docx')` is preserved.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/manuscript.test.ts`:

```typescript
import { manuscriptDocxOutline } from './manuscript';

describe('manuscriptDocxOutline', () => {
    const build = () => assembleManuscript(
        { title: 'My Book', author: 'Jane Roe' },
        [
            chapter('a', 'Chapter One', '2026-01-01T00:00:00Z'),
            chapter('b', 'Chapter Two', '2026-02-01T00:00:00Z'),
        ],
        [
            section('s1', 'a', 'Opening', 0, '<p>alpha</p>'),
            section('s2', 'b', 'Only', 0, '<p>beta</p>'),
        ],
        'p1',
        { frontMatter: { dedication: 'For Ada' } },
    );

    it('starts each front-matter page and each chapter on its own page', () => {
        const outline = manuscriptDocxOutline(build());
        const breaks = outline
            .filter(b => b.kind === 'heading1' && b.pageBreakBefore)
            .map(b => (b as { text: string }).text);
        expect(breaks).toEqual(['Dedication', 'Contents', 'Chapter One', 'Chapter Two']);
    });

    it('does not break before the very first page', () => {
        const outline = manuscriptDocxOutline(build());
        expect(outline[0]).toEqual({ kind: 'heading1', text: 'My Book', pageBreakBefore: false });
    });

    it('gives every section a heading and a body', () => {
        const outline = manuscriptDocxOutline(build());
        expect(outline).toContainEqual({ kind: 'heading2', text: 'Opening' });
        expect(outline).toContainEqual({ kind: 'body', html: '<p>alpha</p>' });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/manuscript.test.ts`

Expected: FAIL — `SyntaxError: [vite] The requested module '/src/lib/manuscript.ts' does not provide an export named 'manuscriptDocxOutline'`.

- [ ] **Step 3: Add the outline to `manuscript.ts`**

Append to `src/lib/manuscript.ts`:

```typescript
/**
 * A word-processor block, independent of any library. Keeping the layout
 * decisions — what is a heading, what starts a new page — in a plain value
 * means they can be tested without loading the DOCX writer.
 */
export type DocxBlock =
    | { kind: 'heading1'; text: string; pageBreakBefore: boolean }
    | { kind: 'heading2'; text: string }
    | { kind: 'text'; text: string }
    | { kind: 'body'; html: string };

/** The manuscript as an ordered run of word-processor blocks. */
export function manuscriptDocxOutline(manuscript: Manuscript): DocxBlock[] {
    const blocks: DocxBlock[] = [];
    let started = false;

    manuscript.pages.forEach(page => {
        blocks.push({ kind: 'heading1', text: page.title, pageBreakBefore: started });
        started = true;
        page.lines.forEach(line => blocks.push({ kind: 'text', text: line }));
    });

    manuscript.chapters.forEach(chapter => {
        blocks.push({ kind: 'heading1', text: chapter.title, pageBreakBefore: started });
        started = true;
        chapter.sections.forEach(section => {
            blocks.push({ kind: 'heading2', text: section.title });
            blocks.push({ kind: 'body', html: section.html });
        });
    });

    return blocks;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/manuscript.test.ts`

Expected: PASS — 18 tests.

- [ ] **Step 5: Add the DOCX builder and download**

In `src/lib/export.ts`, widen the manuscript import to:

```typescript
import { manuscriptDocxOutline, type Manuscript } from '@/lib/manuscript';
```

Add this helper directly above `exportAsDocx` (or above `buildDocxDocument`, if the concurrent split has landed — the helper's body is the same either way). It is the paragraph walk currently inlined inside that function, lifted out so both builders share it:

```typescript
/**
 * One scene's HTML as DOCX paragraphs. `Paragraph` and `TextRun` are passed in
 * rather than imported, because the docx library is only ever loaded on demand.
 */
function htmlToDocxParagraphs(
    parser: DOMParser,
    html: string,
    Paragraph: typeof Docx.Paragraph,
    TextRun: typeof Docx.TextRun,
): Docx.Paragraph[] {
    const parsed = parser.parseFromString(html, 'text/html');
    const out: Docx.Paragraph[] = [];

    Array.from(parsed.querySelectorAll('p')).forEach(pNode => {
        // An empty paragraph is a deliberate line break — keep it.
        if (!pNode.textContent?.trim()) {
            out.push(new Paragraph({ text: '' }));
            return;
        }

        const runs: Docx.TextRun[] = [];
        pNode.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                if (child.textContent) runs.push(new TextRun({ text: child.textContent }));
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const element = child as HTMLElement;
                const isBold = element.tagName === 'STRONG' || element.tagName === 'B';
                const isItalic = element.tagName === 'EM' || element.tagName === 'I';
                // Entity spans carry no visual decoration on export — plain text.
                runs.push(new TextRun({
                    text: element.textContent || '',
                    bold: isBold,
                    italics: isItalic,
                }));
            }
        });

        out.push(new Paragraph({ children: runs }));
    });

    return out;
}
```

Then add, directly after `exportAsDocx`:

```typescript
/**
 * The whole manuscript as a docx Document, formatted to standard manuscript
 * requirements: Times New Roman 12pt, 1.5 spacing, one-inch margins, each
 * chapter starting on a new page. Returned unpacked so tests and the download
 * wrapper can each do what they need with it.
 */
export async function buildManuscriptDocxDocument(manuscript: Manuscript): Promise<Docx.Document> {
    // Loaded on demand — keeps the ~500KB docx library out of the main app bundle.
    const { Document: DocxDocument, Paragraph, TextRun } = await import('docx');
    const parser = new DOMParser();
    const docxParagraphs: Docx.Paragraph[] = [];

    manuscriptDocxOutline(manuscript).forEach(block => {
        if (block.kind === 'heading1') {
            docxParagraphs.push(new Paragraph({
                text: block.text,
                heading: 'Heading1',
                pageBreakBefore: block.pageBreakBefore,
                spacing: { after: 400 },
            }));
        } else if (block.kind === 'heading2') {
            docxParagraphs.push(new Paragraph({ text: block.text, heading: 'Heading2' }));
        } else if (block.kind === 'text') {
            docxParagraphs.push(new Paragraph({ text: block.text }));
        } else {
            docxParagraphs.push(...htmlToDocxParagraphs(parser, block.html, Paragraph, TextRun));
        }
    });

    return new DocxDocument({
        sections: [
            {
                properties: {
                    page: {
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                    },
                },
                children: docxParagraphs,
            },
        ],
        styles: {
            default: {
                document: {
                    run: { font: 'Times New Roman', size: 24 },
                    paragraph: { spacing: { line: 360, before: 120, after: 120 } },
                },
                heading1: {
                    run: { font: 'Times New Roman', size: 48, bold: true, color: '000000' },
                },
                heading2: {
                    run: { font: 'Times New Roman', size: 32, bold: true, color: '000000' },
                    paragraph: { spacing: { before: 240, after: 120 } },
                },
            },
        },
    });
}

/** Builds the manuscript .docx and triggers a browser download. */
export async function exportManuscriptAsDocx(manuscript: Manuscript): Promise<Blob> {
    const { Packer } = await import('docx');
    const blob = await Packer.toBlob(await buildManuscriptDocxDocument(manuscript));
    downloadFile(blob, `${slugify(manuscript.title) || 'manuscript'}.docx`, blob.type);
    return blob;
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 7: Confirm docx is still lazy**

Run: `grep -n "from 'docx'" src/lib/export.ts`

Expected: only `import type * as Docx from 'docx';`. Every value import must remain inside an `await import('docx')`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/manuscript.ts src/lib/manuscript.test.ts src/lib/export.ts
git commit -m "feat: DOCX export of the whole manuscript

Chapters start on their own pages. The layout decisions live in a plain
descriptor list so they are testable without loading the docx writer, which
stays behind its dynamic import."
```

---

## Task 6: Export the whole manuscript as EPUB

**Files:**
- Modify: `src/lib/epub.ts`
- Modify: `src/lib/epub.test.ts`

Today `buildEpubZip` maps one **scene** to one EPUB chapter, so a single-chapter export produces a "book" whose chapters are that chapter's scenes. The manuscript builder maps one **document** to one EPUB chapter, with its sections as `<h2>` inside. `jszip` stays the module's one static runtime import.

- [ ] **Step 1: Write the failing test**

Replace the whole of `src/lib/epub.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { buildManuscriptEpubZip } from './epub';
import { assembleManuscript, type ChapterLike, type SectionLike } from './manuscript';

const docs: ChapterLike[] = [
    { id: 'a', projectId: 'p1', title: 'Chapter One', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', projectId: 'p1', title: 'Chapter Two', createdAt: '2026-02-01T00:00:00Z' },
];
const scenes: SectionLike[] = [
    { id: 's1', documentId: 'a', title: 'Opening', order: 0, content: '<p>alpha</p>' },
    { id: 's2', documentId: 'a', title: 'Closing', order: 1, content: '<p>beta</p>' },
    { id: 's3', documentId: 'b', title: 'Only', order: 0, content: '<p>gamma</p>' },
];
const bare = { titlePage: false, contents: false };

const book = (frontMatter: Record<string, unknown> = bare) => assembleManuscript(
    { title: 'My Book', author: 'Jane Roe' }, docs, scenes, 'p1', { frontMatter },
);

describe('buildManuscriptEpubZip', () => {
    it('produces a valid EPUB container structure', async () => {
        const zip = await buildManuscriptEpubZip(book(), { identifier: 'fixed-id' });
        expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip');
        expect(zip.file('META-INF/container.xml')).not.toBeNull();
        expect(zip.file('OEBPS/content.opf')).not.toBeNull();
        expect(zip.file('OEBPS/nav.xhtml')).not.toBeNull();
    });

    it('gives each chapter one file, not each scene', async () => {
        const zip = await buildManuscriptEpubZip(book(), { identifier: 'fixed-id' });
        expect(zip.file('OEBPS/chapter-1.xhtml')).not.toBeNull();
        expect(zip.file('OEBPS/chapter-2.xhtml')).not.toBeNull();
        expect(zip.file('OEBPS/chapter-3.xhtml')).toBeNull();

        const ch1 = await zip.file('OEBPS/chapter-1.xhtml')!.async('string');
        expect(ch1).toContain('Chapter One');
        expect(ch1).toContain('Opening');
        expect(ch1).toContain('Closing');
        expect(ch1).toContain('alpha');
        expect(ch1).toContain('beta');
    });

    it('puts the front matter in the spine before chapter one', async () => {
        const zip = await buildManuscriptEpubZip(
            book({ titlePage: true, contents: true, copyright: '', dedication: 'For Ada' }),
            { identifier: 'fixed-id' },
        );
        const opf = await zip.file('OEBPS/content.opf')!.async('string');
        expect(opf.indexOf('idref="front-1"')).toBeLessThan(opf.indexOf('idref="chapter-1"'));
        expect(zip.file('OEBPS/front-1.xhtml')).not.toBeNull();
        const dedication = await zip.file('OEBPS/front-2.xhtml')!.async('string');
        expect(dedication).toContain('For Ada');
    });

    it('lists every chapter in the navigation document', async () => {
        const zip = await buildManuscriptEpubZip(book(), { identifier: 'fixed-id' });
        const nav = await zip.file('OEBPS/nav.xhtml')!.async('string');
        expect(nav).toContain('Chapter One');
        expect(nav).toContain('Chapter Two');
    });

    it('carries the title and author into the package metadata', async () => {
        const zip = await buildManuscriptEpubZip(book(), { identifier: 'fixed-id' });
        const opf = await zip.file('OEBPS/content.opf')!.async('string');
        expect(opf).toContain('<dc:title>My Book</dc:title>');
        expect(opf).toContain('<dc:creator>Jane Roe</dc:creator>');
    });

    it('sanitizes scene HTML in the output', async () => {
        const zip = await buildManuscriptEpubZip(
            assembleManuscript(
                { title: 'X' },
                [docs[0]],
                [{ id: 's1', documentId: 'a', title: 'Ch', order: 0, content: '<p>ok</p><script>alert(1)</script>' }],
                'p1',
                { frontMatter: bare },
            ),
            { identifier: 'fixed-id' },
        );
        const ch1 = await zip.file('OEBPS/chapter-1.xhtml')!.async('string');
        expect(ch1).not.toContain('<script>');
        expect(ch1).not.toContain('alert(1)');
    });

    it('still produces a spine for an empty manuscript', async () => {
        const zip = await buildManuscriptEpubZip(
            assembleManuscript({ title: 'Empty' }, [], [], 'p1', { frontMatter: bare }),
            { identifier: 'fixed-id' },
        );
        const opf = await zip.file('OEBPS/content.opf')!.async('string');
        expect(opf).toContain('<itemref');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/epub.test.ts`

Expected: FAIL — `SyntaxError: [vite] The requested module '/src/lib/epub.ts' does not provide an export named 'buildManuscriptEpubZip'`.

- [ ] **Step 3: Add the manuscript EPUB builder**

In `src/lib/epub.ts`, add to the imports:

```typescript
import type { Manuscript } from '@/lib/manuscript';
```

Make `EpubOptions.title` optional — the manuscript now carries it. Change line 13 from `title: string;` to:

```typescript
    /** Overrides the manuscript's own title on the cover and in the metadata. */
    title?: string;
```

Rename `chapterXhtml` to `pageXhtml` and give it an `epub:type`, replacing lines 29-45 with:

```typescript
function pageXhtml(title: string, bodyHtml: string, epubType: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <section epub:type="${epubType}" xmlns:epub="http://www.idpf.org/2007/ops">
    <h1>${escapeHtml(title)}</h1>
    ${bodyHtml || '<p></p>'}
  </section>
</body>
</html>`;
}

/** A chapter's sections as one XHTML body: an h2 per section, then its prose. */
function chapterBody(sections: { title: string; html: string }[]): string {
    return sections
        .map(s => `<h2>${escapeHtml(s.title)}</h2>\n    ${toXhtml(sanitizeHtml(s.html || ''))}`)
        .join('\n    ');
}

/** Front-matter page ids map to the EPUB structural semantics vocabulary. */
const FRONT_EPUB_TYPES: Record<string, string> = {
    'front-title': 'titlepage',
    'front-copyright': 'copyright-page',
    'front-dedication': 'dedication',
    'front-contents': 'frontmatter',
};
```

Because `chapterXhtml` no longer exists, fix its one remaining caller inside `buildEpubZip` (currently `oebps.file(ch.href, chapterXhtml(ch.title, ch.html));`):

```typescript
        oebps.file(ch.href, pageXhtml(ch.title, toXhtml(ch.html) || '<p></p>', 'chapter'));
```

Then add these three functions at the end of the file:

```typescript
/**
 * Builds the manuscript as a JSZip instance (so tests can read entries directly
 * without depending on Blob support in the test environment).
 *
 * One EPUB chapter per LoreCanvas chapter, its scenes as h2 sections inside —
 * a reader's chapter list should match the writer's, not their scene list.
 */
export async function buildManuscriptEpubZip(
    manuscript: Manuscript,
    opts: EpubOptions = {},
): Promise<JSZip> {
    const zip = new JSZip();
    const identifier = opts.identifier
        || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'lorecanvas-export');
    const title = opts.title || manuscript.title || 'Untitled';
    const author = opts.author || manuscript.author || 'Unknown Author';

    // 1. mimetype — MUST be the first entry and stored (uncompressed).
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // 2. Container pointing at the OPF package.
    zip.folder('META-INF')!.file('container.xml', `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

    const oebps = zip.folder('OEBPS')!;
    oebps.file('style.css',
        'body{font-family:Georgia,serif;line-height:1.6;margin:5%;}'
        + 'h1{font-size:1.4em;margin:1em 0;}h2{font-size:1.1em;margin:1.5em 0 0.5em;}');

    // 3. Front matter, then chapters. Both become ordinary spine entries.
    const entries: { id: string; href: string; title: string; xhtml: string; inNav: boolean }[] = [];

    manuscript.pages.forEach((page, i) => {
        const id = `front-${i + 1}`;
        entries.push({
            id,
            href: `${id}.xhtml`,
            title: page.title,
            xhtml: pageXhtml(page.title, page.html, FRONT_EPUB_TYPES[page.id] ?? 'frontmatter'),
            inNav: false,
        });
    });

    manuscript.chapters.forEach((chapter, i) => {
        const id = `chapter-${i + 1}`;
        entries.push({
            id,
            href: `${id}.xhtml`,
            title: chapter.title,
            xhtml: pageXhtml(chapter.title, chapterBody(chapter.sections), 'chapter'),
            inNav: true,
        });
    });

    // Guard against an empty manuscript producing a spine-less (invalid) EPUB.
    if (entries.length === 0) {
        entries.push({
            id: 'chapter-1',
            href: 'chapter-1.xhtml',
            title,
            xhtml: pageXhtml(title, '', 'chapter'),
            inNav: true,
        });
    }

    for (const entry of entries) {
        oebps.file(entry.href, entry.xhtml);
    }

    // 4. Navigation document (EPUB 3 toc) — chapters, as a reader expects.
    const navSource = entries.filter(e => e.inNav);
    const navItems = (navSource.length > 0 ? navSource : entries)
        .map(e => `      <li><a href="${e.href}">${escapeHtml(e.title)}</a></li>`)
        .join('\n');
    oebps.file('nav.xhtml', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><meta charset="utf-8"/><title>Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`);

    // 5. OPF package: metadata + manifest + spine.
    const manifestItems = entries
        .map(e => `    <item id="${e.id}" href="${e.href}" media-type="application/xhtml+xml"/>`)
        .join('\n');
    const spineItems = entries
        .map(e => `    <itemref idref="${e.id}"/>`)
        .join('\n');
    const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    oebps.file('content.opf', `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${identifier}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:creator>${escapeHtml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`);

    return zip;
}

/** Builds an EPUB Blob from a compiled manuscript. */
export async function buildManuscriptEpubBlob(
    manuscript: Manuscript,
    opts: EpubOptions = {},
): Promise<Blob> {
    const zip = await buildManuscriptEpubZip(manuscript, opts);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

/** Builds the EPUB and triggers a browser download. */
export async function exportManuscriptAsEpub(
    manuscript: Manuscript,
    opts: EpubOptions = {},
): Promise<void> {
    const blob = await buildManuscriptEpubBlob(manuscript, opts);
    const slug = (opts.title || manuscript.title || 'book')
        .toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || 'book';
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${slug}.epub`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/epub.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 5: Verify jszip did not gain a sibling**

Run: `grep -n "^import" src/lib/epub.ts`

Expected: four lines — `jszip`, the store types, `@/lib/sanitize`, and `@/lib/manuscript`. Only `jszip` is a runtime value import.

- [ ] **Step 6: Full check**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS. If `src/lib/export.test.ts` exists on this branch, its `buildEpubZip` suites still pass too — that function is untouched until Task 10.

- [ ] **Step 7: Commit**

```bash
git add src/lib/epub.ts src/lib/epub.test.ts
git commit -m "feat: EPUB export of the whole manuscript

One EPUB chapter per LoreCanvas chapter, its scenes as sections inside, and
the front matter ahead of chapter one in the spine. A single-chapter EPUB
inverted the format's purpose."
```

---

## Task 7: Decide, purely, when the binder should follow the store

**Files:**
- Create: `src/lib/zoneSelection.ts`
- Create: `src/lib/zoneSelection.test.ts`

This is the arithmetic behind roadmap items `03` and `15c`. Task 8 wires it in.

- [ ] **Step 1: Write the failing test**

Create `src/lib/zoneSelection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reconcileZoneSelection, type SceneLike } from './zoneSelection';

const scenes: SceneLike[] = [
    { id: 's1', documentId: 'a', order: 0 },
    { id: 's2', documentId: 'a', order: 1 },
    { id: 's3', documentId: 'b', order: 0 },
    { id: 's4', documentId: 'b', order: 1 },
];
const docIds = ['a', 'b'];

describe('reconcileZoneSelection', () => {
    it('follows the store to a chapter the binder is not showing', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' },
            { documentId: 'b', sceneId: 's4' },
            scenes, docIds,
        )).toEqual({ documentId: 'b', sceneId: 's4' });
    });

    it('lands on the new chapter first scene when the store names none', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' },
            { documentId: 'b', sceneId: null },
            scenes, docIds,
        )).toEqual({ documentId: 'b', sceneId: 's3' });
    });

    it('leaves the binder alone when it is already on that chapter', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 'all' },
            { documentId: 'a', sceneId: 's2' },
            scenes, docIds,
        )).toBeNull();
    });

    it('ignores a store scene that belongs to a different chapter', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' },
            { documentId: 'b', sceneId: 's1' },
            scenes, docIds,
        )).toEqual({ documentId: 'b', sceneId: 's3' });
    });

    it('ignores the binder own view states, which are not scene ids', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' },
            { documentId: 'b', sceneId: 'cover' },
            scenes, docIds,
        )).toEqual({ documentId: 'b', sceneId: 's3' });
    });

    it('shows a sceneless chapter whole rather than pointing at nothing', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' },
            { documentId: 'c', sceneId: null },
            scenes, ['a', 'b', 'c'],
        )).toEqual({ documentId: 'c', sceneId: 'all' });
    });

    it('does nothing when the store points at no chapter, or a deleted one', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' }, { documentId: null, sceneId: null }, scenes, docIds,
        )).toBeNull();
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' }, { documentId: 'gone', sceneId: null }, scenes, docIds,
        )).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/zoneSelection.test.ts`

Expected: FAIL — `Error: Failed to resolve import "./zoneSelection" from "src/lib/zoneSelection.test.ts". Does the file exist?`

- [ ] **Step 3: Write the module**

Create `src/lib/zoneSelection.ts`:

```typescript
/**
 * Writing-zone selection — LEAF MODULE (no store or React import).
 *
 * Which chapter is open is remembered twice: the binder keeps it on its own
 * desk widget, and the rest of the app — Export, the Draft Table's "to the
 * Writing Desk", the command palette, Home's resume card — says it through the
 * store. Two memories of one fact drift. Build chapters from an outline and the
 * store moves while the binder stays on the empty chapter you started from, so
 * success looks exactly like failure.
 *
 * This decides, purely, when the binder should follow the store. The reverse
 * direction is a plain write: the binder tells the store on every pick.
 */

export interface ZoneSelection {
    documentId: string;
    sceneId: string;
}

export interface ActiveSelection {
    documentId: string | null;
    sceneId: string | null;
}

export interface SceneLike {
    id: string;
    documentId: string;
    order: number;
}

/**
 * Values the binder stores in place of a scene id: "show the whole chapter"
 * and "show the book information page". Neither is the store's business.
 */
const PSEUDO_SCENES = new Set(['all', 'cover']);

/**
 * What the binder should show, or null when it is already right.
 *
 * It follows the store only to a DIFFERENT chapter that still exists. Within
 * one chapter the binder keeps its own view, so changing scene in the desk
 * never yanks a writer out of the whole-chapter view.
 */
export function reconcileZoneSelection(
    zone: ZoneSelection,
    active: ActiveSelection,
    scenes: SceneLike[],
    documentIds: string[],
): ZoneSelection | null {
    const target = active.documentId;
    if (!target) return null;
    if (!documentIds.includes(target)) return null;
    if (target === zone.documentId) return null;

    const chapterScenes = scenes
        .filter(s => s.documentId === target)
        .slice()
        .sort((a, b) => a.order - b.order);

    const named = active.sceneId && !PSEUDO_SCENES.has(active.sceneId)
        ? chapterScenes.find(s => s.id === active.sceneId)
        : undefined;

    return {
        documentId: target,
        // A chapter with no scenes yet shows whole rather than pointing at nothing.
        sceneId: (named ?? chapterScenes[0])?.id ?? 'all',
    };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/zoneSelection.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/zoneSelection.ts src/lib/zoneSelection.test.ts
git commit -m "feat: decide when the binder should follow the store

Two memories of one fact — the desk widget's chapter and the store's — drift
apart the moment anything but the binder opens a chapter."
```

---

## Task 8: Land on what the writer just made

**Files:**
- Modify: `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`

Closes roadmap items `03` and `15c` in one change: the binder writes its selection to the store on every pick, and follows the store when something else moves it.

- [ ] **Step 1: Subscribe to the store's selection**

In `src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`, add to the import block:

```typescript
import { reconcileZoneSelection } from '@/lib/zoneSelection';
```

Beside the other store subscriptions at lines 28-32, add:

```typescript
  const storeActiveDocumentId = useWorkspaceStore(s => s.activeDocumentId);
  const storeActiveSceneId = useWorkspaceStore(s => s.activeSceneId);
  const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
  const setActiveScene = useWorkspaceStore(s => s.setActiveScene);
```

- [ ] **Step 2: Make every chapter pick write to the store**

Replace `setActiveDocId` (lines 98-101) with a shared `selectChapter` plus a thin `setActiveDocId`:

```typescript
  /**
   * Open a chapter. The store is told as well as the widget, so Export and the
   * breadcrumb name the chapter the writer is actually looking at.
   * setActiveDocument picks that chapter's first scene for the store; 'all' and
   * 'cover' stay the binder's own view, not the store's.
   */
  const selectChapter = (docId: string, sceneId: string) => {
    (onChangeImmediate ?? onChange)({ ...content, documentId: docId, sceneId });
    setActiveDocument(docId);
    if (sceneId && sceneId !== 'all' && sceneId !== 'cover') setActiveScene(sceneId);
  };

  const setActiveDocId = (id: string) => {
    const firstScene = projectScenes.filter(s => s.documentId === id).sort((a, b) => a.order - b.order)[0];
    selectChapter(id, firstScene?.id || '');
  };
```

`selectChapter` reads `projectScenes`, declared at line 87. If the compiler reports use-before-declaration, move this pair to sit immediately below that declaration — `content`, `onChange` and `onChangeImmediate` are props, so they are in scope throughout.

- [ ] **Step 3: Make every scene pick write to the store**

Replace `setActiveSceneId` (lines 106-113) with:

```typescript
  const setActiveSceneId = (id: string) => {
    if (id && id !== 'all' && id !== 'cover') setActiveScene(id);
    // If book mode is active, clicking a scene scrolls instead of switching view
    if (isBookMode && id !== 'book' && id !== 'cover') {
      (onChangeImmediate ?? onChange)({ ...content, sceneId: id });
    } else {
      (onChangeImmediate ?? onChange)({ ...content, sceneId: id, viewType: id === 'book' ? 'book' : 'standard' });
    }
  };
```

- [ ] **Step 4: Route the spine handlers and the new-chapter button through it**

The chapter header's `onClick` at lines 338-340 currently writes the widget directly. Replace it with:

```typescript
                      onClick={() => selectChapter(doc.id, 'all')}
```

In the arrow's `onClick` at lines 344-352, replace the `if (!isDocActive)` branch body:

```typescript
                          if (!isDocActive) {
                            selectChapter(doc.id, scenes[0]?.id || '');
                            setIsSceneListCollapsed(false);
                          } else {
                            setIsSceneListCollapsed(prev => !prev);
                          }
```

In `handleAddChapter` (lines 162-169), replace the final line `onChange({ ...content, documentId: nid, sceneId: sid });` with:

```typescript
    selectChapter(nid, sid);
```

- [ ] **Step 5: Follow the store when something else moves it**

Add this effect directly below the existing seeding effect at lines 130-133:

```typescript
  // Something outside the binder opened a chapter — the Draft Table's outline
  // export, the command palette, Home's "resume where you left off". Follow it,
  // so the writer lands on what they just made instead of the chapter they left.
  useEffect(() => {
    const next = reconcileZoneSelection(
      { documentId: activeDocId, sceneId: activeSceneId },
      { documentId: storeActiveDocumentId, sceneId: storeActiveSceneId },
      projectScenes,
      projectDocs.map(d => d.id),
    );
    if (next) {
      (onChangeImmediate ?? onChange)({ ...content, documentId: next.documentId, sceneId: next.sceneId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeActiveDocumentId, storeActiveSceneId, activeDocId, activeSceneId, projectScenes, projectDocs]);
```

No loop is possible: `selectChapter` writes the same chapter id to both memories, and `reconcileZoneSelection` returns `null` the moment they agree.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep StoryWritingZone`

Expected: no output.

Run: `npx vitest run && npx eslint src/components/editor/desk/widgets/zones/StoryWritingZone.tsx`

Expected: all tests PASS; no lint errors.

- [ ] **Step 7: Manual check**

Start the dev server. On the Draft Table, apply any method, type into two beat cards, then **Export → To the Writing Desk**. Confirm the desk opens on the **first chapter it just built**, with the outline text in it — not on the chapter you were on before.

Then click a different chapter in the spine and press Ctrl+E. Confirm Export names the chapter on screen.

- [ ] **Step 8: Commit**

```bash
git add src/components/editor/desk/widgets/zones/StoryWritingZone.tsx
git commit -m "fix: land on the chapter that was just made

Exporting an outline wrote setActiveDocument to the store while the binder
read its chapter from its own widget, so it opened the old empty chapter and
success was indistinguishable from failure. The binder now writes to the store
on every pick and follows it when anything else moves."
```

---

## Task 9: Turn Export into the compile step

**Files:**
- Modify: `src/components/ui/ExportModal.tsx`
- Modify: `src/components/ui/ExportModal.module.css`

Closes roadmap items `02`, `11` and the visible half of `15c`.

- [ ] **Step 1: Replace the modal**

Replace the whole of `src/components/ui/ExportModal.tsx` with:

```tsx
"use client";

import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import styles from './ExportModal.module.css';
import {
    useWorkspaceStore,
    selectProjectWorldKey,
    selectProjectFrontMatter,
} from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';
import {
    assembleManuscript,
    assembleChapter,
    manuscriptWordCount,
    orderChapters,
    type FrontMatter,
    type Manuscript,
} from '@/lib/manuscript';
import {
    exportManuscriptAsMarkdown,
    exportManuscriptAsDocx,
    exportWorldBible,
} from '@/lib/export';
import { exportManuscriptAsEpub } from '@/lib/epub';

/**
 * ExportModal — the compile step.
 *
 * Choose what goes in the book (front matter, which chapters), then take it out
 * in one file. "This chapter" is the same code path with a one-chapter list,
 * and it is bound to the document the desk actually has open.
 */
interface ExportModalProps {
    onClose: () => void;
}

type Scope = 'manuscript' | 'chapter';

export default function ExportModal({ onClose }: ExportModalProps) {
    const documents = useWorkspaceStore(state => state.documents);
    const scenes = useWorkspaceStore(state => state.scenes);
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const projects = useWorkspaceStore(state => state.projects);
    const allEntities = useWorkspaceStore(state => state.entities);
    const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);
    const frontMatter = useWorkspaceStore(selectProjectFrontMatter);
    const updateProject = useWorkspaceStore(state => state.updateProject);

    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [excludedIds, setExcludedIds] = useState<string[]>([]);
    const [scope, setScope] = useState<Scope>('manuscript');

    const activeProject = projects.find(p => p.id === activeProjectId);
    const activeDocument = documents.find(d => d.id === activeDocumentId);
    const worldEntities = allEntities.filter(e => worldKeyForEntity(e) === projectWorldKey);

    const chapters = activeProjectId ? orderChapters(documents, activeProjectId) : [];
    const includedChapterIds = chapters.map(c => c.id).filter(id => !excludedIds.includes(id));

    const meta = { title: activeProject?.name ?? 'Untitled', author: activeProject?.authorName };

    const wholeBook: Manuscript | null = activeProjectId
        ? assembleManuscript(meta, documents, scenes, activeProjectId, { frontMatter, includedChapterIds })
        : null;

    const oneChapter: Manuscript | null = activeDocument
        ? assembleChapter(meta, activeDocument, scenes)
        : null;

    const target = scope === 'chapter' ? oneChapter : wholeBook;
    const canExport = !!target && !isExporting;
    const chapterCount = target?.chapters.length ?? 0;
    const words = target ? manuscriptWordCount(target) : 0;

    const patchFrontMatter = (patch: Partial<FrontMatter>) => {
        if (!activeProjectId) return;
        updateProject(activeProjectId, { frontMatter: { ...frontMatter, ...patch } });
    };

    const toggleChapter = (id: string) => {
        setExcludedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const runExport = async (label: string, run: (m: Manuscript) => void | Promise<void>) => {
        if (!target) return;
        setExportError(null);
        setIsExporting(true);
        try {
            await run(target);
        } catch (err: unknown) {
            setExportError(err instanceof Error ? err.message : `Unknown error during ${label} export`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleWorldBibleExport = () => {
        if (!activeProject) return;
        setExportError(null);
        try {
            exportWorldBible(worldEntities, activeProject.name);
        } catch (err: unknown) {
            setExportError(err instanceof Error ? err.message : 'Unknown error exporting World Bible');
        }
    };

    const hasEntities = worldEntities.length > 0;
    const uniqueTypesCount = new Set(worldEntities.map(e => e.type)).size;

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Compile &amp; Export</h2>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close Export Modal"><X size={18} /></button>
                </div>

                <div className={styles.content}>
                    <section className={styles.section}>
                        <div className={styles.scopeTabs}>
                            <button
                                className={`${styles.scopeTab} ${scope === 'manuscript' ? styles.scopeTabActive : ''}`}
                                onClick={() => setScope('manuscript')}
                            >
                                Whole manuscript
                            </button>
                            <button
                                className={`${styles.scopeTab} ${scope === 'chapter' ? styles.scopeTabActive : ''}`}
                                onClick={() => setScope('chapter')}
                                disabled={!activeDocument}
                            >
                                This chapter
                            </button>
                        </div>

                        <p className={styles.subtext}>
                            {scope === 'chapter'
                                ? <>Just the chapter open on the desk: <strong>{activeDocument?.title || 'Untitled'}</strong></>
                                : <>{chapterCount} chapter{chapterCount === 1 ? '' : 's'} &middot; {words.toLocaleString()} words</>}
                        </p>
                    </section>

                    {scope === 'manuscript' && (
                        <>
                            <section className={styles.sectionDivider}>
                                <h3>Front matter</h3>
                                <div className={styles.compileGrid}>
                                    <label className={styles.compileToggle}>
                                        <input
                                            type="checkbox"
                                            checked={frontMatter.titlePage}
                                            onChange={e => patchFrontMatter({ titlePage: e.target.checked })}
                                        />
                                        Title page
                                    </label>
                                    <label className={styles.compileToggle}>
                                        <input
                                            type="checkbox"
                                            checked={frontMatter.contents}
                                            onChange={e => patchFrontMatter({ contents: e.target.checked })}
                                        />
                                        Contents
                                    </label>
                                </div>

                                <div className={styles.compileField}>
                                    <label htmlFor="compile-copyright">Copyright page</label>
                                    <textarea
                                        id="compile-copyright"
                                        rows={2}
                                        placeholder={`(c) ${new Date().getFullYear()} ${activeProject?.authorName || 'Your name'}. All rights reserved.`}
                                        value={frontMatter.copyright}
                                        onChange={e => patchFrontMatter({ copyright: e.target.value })}
                                    />
                                </div>

                                <div className={styles.compileField}>
                                    <label htmlFor="compile-dedication">Dedication</label>
                                    <textarea
                                        id="compile-dedication"
                                        rows={2}
                                        placeholder="For someone."
                                        value={frontMatter.dedication}
                                        onChange={e => patchFrontMatter({ dedication: e.target.value })}
                                    />
                                </div>
                                <p className={styles.subtext}>Leave a field blank and its page is left out.</p>
                            </section>

                            <section className={styles.sectionDivider}>
                                <h3>Chapters</h3>
                                {chapters.length === 0 ? (
                                    <p className={styles.subtext}>This project has no chapters yet.</p>
                                ) : (
                                    <div className={styles.chapterList}>
                                        {chapters.map((chapter, i) => (
                                            <label key={chapter.id} className={styles.chapterRow}>
                                                <input
                                                    type="checkbox"
                                                    checked={!excludedIds.includes(chapter.id)}
                                                    onChange={() => toggleChapter(chapter.id)}
                                                />
                                                <span className={styles.chapterIndex}>{i + 1}</span>
                                                <span className={styles.chapterTitle}>{chapter.title || 'Untitled Chapter'}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    <section className={styles.sectionDivider}>
                        <h3>Download</h3>
                        <div className={styles.actionRow}>
                            <button
                                className={styles.exportBtn}
                                onClick={() => runExport('Markdown', m => exportManuscriptAsMarkdown(m))}
                                disabled={!canExport}
                            >
                                <span className={styles.icon}><Download size={16} /></span>
                                Markdown (.md)
                            </button>

                            <button
                                className={styles.exportBtn}
                                onClick={() => runExport('Word', m => exportManuscriptAsDocx(m))}
                                disabled={!canExport}
                            >
                                {isExporting ? <span className={styles.spinner}></span> : (
                                    <>
                                        <span className={styles.icon}><Download size={16} /></span>
                                        Word (.docx)
                                    </>
                                )}
                            </button>

                            <button
                                className={styles.exportBtn}
                                onClick={() => runExport('EPUB', m => exportManuscriptAsEpub(m, {
                                    title: m.title,
                                    author: activeProject?.authorName || undefined,
                                }))}
                                disabled={!canExport}
                            >
                                {isExporting ? <span className={styles.spinner}></span> : (
                                    <>
                                        <span className={styles.icon}><Download size={16} /></span>
                                        EPUB (.epub)
                                    </>
                                )}
                            </button>
                        </div>
                    </section>

                    <section className={styles.sectionDivider}>
                        <h3>Export World Bible</h3>

                        <div className={styles.actionRow}>
                            <div className={styles.fullWidthButtonWrapper} title={!hasEntities ? "Add entities to your World Bible first" : ""}>
                                <button
                                    className={`${styles.exportBtn} ${styles.fullWidthBtn}`}
                                    onClick={handleWorldBibleExport}
                                    disabled={!hasEntities || isExporting}
                                >
                                    <span className={styles.icon}><Download size={16} /></span>
                                    Download World Bible (.md)
                                </button>
                            </div>
                        </div>
                        <p className={styles.subtext}>
                            {hasEntities
                                ? `${worldEntities.length} entities across ${uniqueTypesCount} types`
                                : 'No entities found. Add entries to the World Bible.'
                            }
                        </p>
                    </section>

                    {exportError && (
                        <div className={styles.errorBox}>
                            {exportError}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Add the compile-step styles**

Append to `src/components/ui/ExportModal.module.css`:

```css
.scopeTabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
}

.scopeTab {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-secondary);
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
}

.scopeTab:hover:not(:disabled) {
    background: var(--surface);
    color: var(--text-primary);
}

.scopeTab:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.scopeTabActive,
.scopeTabActive:hover:not(:disabled) {
    background: var(--accent);
    border-color: var(--accent);
    color: #ffffff;
}

.compileGrid {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 0.75rem;
}

.compileToggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--text-primary);
    cursor: pointer;
}

.compileField {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-bottom: 0.75rem;
}

.compileField label {
    font-size: 0.78rem;
    color: var(--text-secondary);
}

.compileField textarea {
    width: 100%;
    resize: vertical;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.85rem;
}

.compileField textarea:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}

.chapterList {
    display: flex;
    flex-direction: column;
    max-height: 190px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
}

.chapterRow {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    color: var(--text-primary);
    cursor: pointer;
}

.chapterRow:not(:last-child) {
    border-bottom: 1px solid var(--border);
}

.chapterIndex {
    min-width: 1.5rem;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}

.chapterTitle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
```

These reuse the `--border`, `--surface`, `--accent`, `--text-primary` and `--text-secondary` variables the file already relies on. Phase 8 writes the token file and will normalise them with the rest.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src/components/ui/ExportModal.tsx`

Expected: no compiler output; all tests PASS; no lint errors.

- [ ] **Step 4: Manual check**

Start the dev server, open a project with at least two chapters, and press Ctrl+E.

1. "Whole manuscript" reports the real chapter and word counts.
2. Type a dedication; it survives closing and reopening the modal — it lives on the project.
3. Untick a chapter; the counts drop.
4. Download the Markdown and open it: every ticked chapter is in one file, front matter first.
5. Download the EPUB and open it in Calibre or Apple Books: the contents list names chapters, not scenes.
6. Download the Word file: each chapter starts on a new page.
7. Switch to "This chapter": it names the chapter the desk is showing, and its download contains only that chapter.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ExportModal.tsx src/components/ui/ExportModal.module.css
git commit -m "feat: Export becomes the compile step

Choose front matter and which chapters go in, then take the whole book out in
one file. 'This chapter' is the same path with a one-chapter list, bound to the
document the desk actually has open."
```

---

## Task 10: Retire the single-document exporters

**Files:**
- Modify: `src/lib/export.ts`
- Modify: `src/lib/epub.ts`
- Modify: `src/lib/export.test.ts` (only if it exists on this branch)

Nothing calls them after Task 9. Removing them stops a future caller re-introducing the one-chapter book.

- [ ] **Step 1: Confirm each has no remaining non-test caller**

```bash
for f in exportAsMarkdown exportAsDocx buildDocxDocument buildMarkdownContent buildEpubZip buildEpubBlob exportAsEpub; do
  echo "== $f: $(grep -rn "$f" src --include=*.ts --include=*.tsx | grep -v "\.test\.ts" | grep -c .) non-test refs"
done
```

Expected: `1 non-test refs` for each function that exists, and `0` for `buildDocxDocument` unless the concurrent split has landed — in which case it shows `2` (its declaration plus the `exportAsDocx` wrapper, which is also going). **Any other number means a caller is still live** — remove that caller first.

- [ ] **Step 2: Retarget any suite still exercising them**

```bash
ls src/lib/export.test.ts 2>/dev/null && grep -n "buildEpubZip\|buildDocxDocument\|exportAsDocx\|exportAsMarkdown" src/lib/export.test.ts
```

If the file does not exist, skip this step. If it does (Phase 3's item `21` landed its EPUB binary-layout checks there), change its import from `buildEpubZip` to `buildManuscriptEpubZip` and build its fixture with `assembleManuscript`, exactly as `epub.test.ts` now does:

```typescript
import { buildManuscriptEpubZip } from './epub';
import { assembleManuscript } from './manuscript';

const book = assembleManuscript(
    { title: 'My Book' },
    [{ id: 'a', projectId: 'p1', title: 'One', createdAt: '2026-01-01T00:00:00Z' }],
    [{ id: 's1', documentId: 'a', title: 'Opening', order: 0, content: '<p>a</p>' }],
    'p1',
    { frontMatter: { titlePage: false, contents: false } },
);
```

Its assertions about the mimetype's position, the stored-not-deflated flag, and every spine `idref` resolving to a real file all hold unchanged — those are properties of the archive, not of the chapter mapping. **Keep them.** They are the only checks that the EPUB is actually openable.

- [ ] **Step 3: Delete the functions**

In `src/lib/export.ts`, delete `exportAsMarkdown`, `exportAsDocx`, `buildMarkdownContent`, and `buildDocxDocument` if it exists — each with its doc comment. Keep `htmlToMarkdown`, `downloadFile`, `slugify`, `htmlToDocxParagraphs`, `exportWorldBible`, the three manuscript exporters, the Google Drive helpers, `parseFdxToHtml`, `sanitizeImportedHtml` and `markdownToBasicHtml`.

In `src/lib/epub.ts`, delete `buildEpubZip`, `buildEpubBlob` and `exportAsEpub`. The `import type { Document as MFDocument, Scene } from '@/store/workspaceStore';` line then has no remaining use — delete it too.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: no compiler output; all tests PASS; no lint errors. An unused-import warning means something was left behind — fix it rather than suppressing it.

- [ ] **Step 5: Confirm epub.ts no longer depends on the store**

Run: `grep -n "workspaceStore" src/lib/epub.ts`

Expected: no output. `epub.ts` now takes a `Manuscript` and nothing else.

- [ ] **Step 6: Commit**

```bash
git add src/lib/export.ts src/lib/epub.ts
# add src/lib/export.test.ts too, if Step 2 retargeted it
git commit -m "refactor: retire the single-document exporters

exportAsMarkdown, exportAsDocx, buildMarkdownContent, buildEpubZip,
buildEpubBlob and exportAsEpub each produced a book of one chapter. Removing
them keeps a future caller from re-introducing that. Any EPUB binary-layout
checks move to the manuscript builder unchanged."
```

---

## Task 11: Recognise both entity triggers

**Files:**
- Create: `src/lib/entityTrigger.ts`
- Create: `src/lib/entityTrigger.test.ts`
- Modify: `src/lib/EntitySuggest.ts`

One matcher for both `@` and `[[`, so a single ProseMirror plugin and a single dropdown serve them. The `@`-only regex being replaced is at `src/lib/EntitySuggest.ts:57`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/entityTrigger.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { matchEntityTrigger, MAX_QUERY_LENGTH } from './entityTrigger';

describe('matchEntityTrigger', () => {
    it('recognises a bare trigger with nothing typed yet', () => {
        expect(matchEntityTrigger('She walked into [[')).toEqual({ trigger: '[[', query: '', length: 2 });
        expect(matchEntityTrigger('She met @')).toEqual({ trigger: '@', query: '', length: 1 });
    });

    it('captures the name being typed after each trigger', () => {
        expect(matchEntityTrigger('in [[The Iron Gate')).toEqual({ trigger: '[[', query: 'The Iron Gate', length: 15 });
        expect(matchEntityTrigger('met @Kell')).toEqual({ trigger: '@', query: 'Kell', length: 5 });
    });

    it('allows the punctuation real names carry', () => {
        expect(matchEntityTrigger('[[Anne-Marie O')).toEqual({ trigger: '[[', query: 'Anne-Marie O', length: 14 });
    });

    it('returns null when the cursor is not inside a trigger', () => {
        expect(matchEntityTrigger('just ordinary prose')).toBeNull();
        expect(matchEntityTrigger('')).toBeNull();
    });

    it('gives up after a double space — the writer moved on', () => {
        expect(matchEntityTrigger('@Kell  ')).toBeNull();
        expect(matchEntityTrigger('[[Kell  ')).toBeNull();
    });

    it('gives up once the name is implausibly long', () => {
        expect(matchEntityTrigger(`@${'a'.repeat(MAX_QUERY_LENGTH + 1)}`)).toBeNull();
    });

    it('lets the later trigger win when the writer changes their mind', () => {
        expect(matchEntityTrigger('@Kell went to [[Iron')).toEqual({ trigger: '[[', query: 'Iron', length: 6 });
        expect(matchEntityTrigger('[[Iron and then @Kell')).toEqual({ trigger: '@', query: 'Kell', length: 5 });
    });

    it('measures length back from the cursor, trigger included', () => {
        const text = 'x [[Gate';
        const m = matchEntityTrigger(text)!;
        expect(text.length - m.length).toBe(2);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/entityTrigger.test.ts`

Expected: FAIL — `Error: Failed to resolve import "./entityTrigger" from "src/lib/entityTrigger.test.ts". Does the file exist?`

- [ ] **Step 3: Write the module**

Create `src/lib/entityTrigger.ts`:

```typescript
/**
 * Entity trigger matching — LEAF MODULE (no store or React import).
 *
 * Two ways to reach the World Bible from inside a sentence: `@` links an entry
 * that already exists, `[[` offers to create one on the spot. They are the same
 * shape — a trigger, then the name being typed — so one matcher answers for
 * both and the ProseMirror plugin stays a thin wrapper around it.
 *
 * Neither trigger character appears in the name run, so the two patterns are
 * mutually exclusive by construction: whichever trigger the cursor sits inside
 * is the only one whose run can still reach the end of the text.
 */

export type EntityTrigger = '@' | '[[';

export interface TriggerMatch {
    trigger: EntityTrigger;
    /** The name typed after the trigger. Empty right after the trigger itself. */
    query: string;
    /** Characters back from the cursor the trigger starts, trigger included. */
    length: number;
}

/** Characters a world-entry name may contain while it is being typed. */
const NAME_RUN = "[\\w \\-'\u2019]";

const PATTERNS: { trigger: EntityTrigger; re: RegExp }[] = [
    { trigger: '[[', re: new RegExp(`\\[\\[(${NAME_RUN}*)$`) },
    { trigger: '@', re: new RegExp(`@(${NAME_RUN}*)$`) },
];

/** Longest a name can get before the trigger is assumed abandoned. */
export const MAX_QUERY_LENGTH = 30;

/**
 * The trigger the cursor is currently inside, or null.
 *
 * `textBefore` is the text immediately preceding the cursor. When both could
 * match, the one that starts later wins — its match is the shorter one.
 */
export function matchEntityTrigger(textBefore: string): TriggerMatch | null {
    let best: TriggerMatch | null = null;

    for (const { trigger, re } of PATTERNS) {
        const m = textBefore.match(re);
        if (!m) continue;

        const query = m[1];
        if (query.endsWith('  ') || query.length > MAX_QUERY_LENGTH) continue;

        const length = query.length + trigger.length;
        if (!best || length < best.length) best = { trigger, query, length };
    }

    return best;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/entityTrigger.test.ts`

Expected: PASS — 8 tests.

- [ ] **Step 5: Point the plugin at it**

In `src/lib/EntitySuggest.ts`, add the import:

```typescript
import { matchEntityTrigger, type EntityTrigger } from '@/lib/entityTrigger';
```

Replace the state interface and initial value (lines 7-19) with:

```typescript
export interface EntitySuggestState {
  active: boolean;
  /** Which trigger opened it: '@' links an entry, '[[' offers to create one. */
  trigger: EntityTrigger;
  query: string;         // text after the trigger being typed
  from: number;          // position of the trigger's first character in doc
  to: number;            // current cursor position
}

const initialState: EntitySuggestState = {
  active: false,
  trigger: '@',
  query: '',
  from: 0,
  to: 0,
};
```

Replace everything in `apply` from the comment above `const match = textBefore.match(...)` (lines 54-67) with:

```typescript
            const match = matchEntityTrigger(textBefore);
            if (!match) return { ...initialState };

            return {
              active: true,
              trigger: match.trigger,
              query: match.query,
              from: pos - match.length,
              to: pos,
            };
```

Update the extension's doc comment (lines 21-24) to:

```typescript
/**
 * EntitySuggest — TipTap extension that detects `@name` and `[[name` typing
 * and exposes plugin state for the React dropdown to read. The matching itself
 * lives in entityTrigger.ts, so it can be tested without an editor.
 */
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/entityTrigger.ts src/lib/entityTrigger.test.ts src/lib/EntitySuggest.ts
git commit -m "feat: recognise [[ alongside @ in the suggest plugin

One matcher for both triggers, extracted so it can be tested without an
editor. @ links an entry that exists; [[ will offer to create one."
```

---

## Task 12: Wire `[[` and `@` into the manuscript editor

**Files:**
- Modify: `src/components/world/InlineEntryCreator.tsx`
- Modify: `src/components/editor/EntitySuggestDropdown.tsx`
- Modify: `src/components/editor/desk/DeskTipTapEditor.tsx`

This is where item `2e` actually lands. Read findings 1 and 2 at the top of this plan first: `EntitySuggest` was only ever registered in `ScreenplayEditor.tsx`, which Phase 1 deleted, so **both** triggers are being introduced to the prose editor here — and the dropdown needs a portal and a coordinate fix before it will sit in the right place on the desk.

- [ ] **Step 1: Tell the world when an entry is created**

In `src/components/world/InlineEntryCreator.tsx`, replace the `closeAndReturnFocus` helper and its comment (lines 44-53) with:

```typescript
    /**
     * Close the modal and hand focus back to the editor. The editor listens for
     * this rather than being wired to the modal directly, so neither has to
     * know the other exists.
     */
    const closeAndReturnFocus = () => {
        closeInlineCreator();
        window.dispatchEvent(new CustomEvent('lorecanvas:returnFocusToEditor'));
    };
```

Then in `handleSubmit`, replace `addEntity(newEntity);` (line 84) with:

```typescript
        // Save to global state, say what was made, and dismiss.
        addEntity(newEntity);
        window.dispatchEvent(new CustomEvent('lorecanvas:entityCreated', {
            detail: { id: newEntity.id, name: newEntity.name },
        }));
```

Cancelling and the backdrop still dispatch only `returnFocusToEditor`, so nothing is inserted when the writer changes their mind — and the `[[Name` they typed stays where it is.

- [ ] **Step 2: Give the dropdown a Create row**

In `src/components/editor/EntitySuggestDropdown.tsx`:

Add `createPortal` to the React import (line 3 currently imports from `react`; the portal comes from `react-dom`):

```typescript
import { createPortal } from 'react-dom';
```

Add to the store subscriptions beside line 16:

```typescript
  const openInlineCreator = useWorkspaceStore(s => s.openInlineCreator);
```

Add `trigger: '@',` to the `useState` initial value (lines 18-20):

```typescript
  const [pluginState, setPluginState] = useState<EntitySuggestState>({
    active: false, trigger: '@', query: '', from: 0, to: 0,
  });
```

Add a ref beside `dropdownRef` (line 23):

```typescript
  /** Where a [[ creation should be inserted once the modal saves. */
  const pendingRangeRef = useRef<{ from: number; to: number } | null>(null);
```

Every `setMeta(entitySuggestPluginKey, …)` payload must now carry the trigger. In both places that reset it (lines 82-84 and 107-109), change the object to:

```typescript
        active: false, trigger: '@', query: '', from: 0, to: 0,
```

Add these two handlers directly below `selectEntity` (which ends at line 86):

```typescript
  /** Insert an entity's name, marked, over a remembered range. */
  const insertEntityAt = useCallback((from: number, to: number, entityId: string, entityName: string) => {
    if (!activeEditor) return;
    activeEditor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, {
        type: 'text',
        text: entityName,
        marks: [{ type: 'entityMark', attrs: { entityId } }],
      })
      .run();
  }, [activeEditor]);

  /** "Create «name»" — hand off to the World Bible's inline creator. */
  const startCreate = useCallback(() => {
    if (!activeEditor) return;
    // Remember the range but do not delete it: if the writer cancels, what they
    // typed must still be there.
    pendingRangeRef.current = { from: pluginState.from, to: pluginState.to };
    activeEditor.view.dispatch(
      activeEditor.state.tr.setMeta(entitySuggestPluginKey, {
        active: false, trigger: '@', query: '', from: 0, to: 0,
      })
    );
    openInlineCreator(pluginState.query.trim());
  }, [activeEditor, pluginState.from, pluginState.to, pluginState.query, openInlineCreator]);
```

Add the window listeners below the keyboard effect (which ends at line 118):

```typescript
  // The inline creator saved an entry we asked for — drop it in where [[ was.
  useEffect(() => {
    if (!activeEditor) return;

    const onCreated = (e: Event) => {
      const range = pendingRangeRef.current;
      pendingRangeRef.current = null;
      const detail = (e as CustomEvent<{ id: string; name: string }>).detail;
      if (!range || !detail?.id) return;
      insertEntityAt(range.from, range.to, detail.id, detail.name);
    };

    const onReturnFocus = () => {
      // Cancelled: leave what was typed alone, just give the cursor back.
      pendingRangeRef.current = null;
      activeEditor.chain().focus().run();
    };

    window.addEventListener('lorecanvas:entityCreated', onCreated);
    window.addEventListener('lorecanvas:returnFocusToEditor', onReturnFocus);
    return () => {
      window.removeEventListener('lorecanvas:entityCreated', onCreated);
      window.removeEventListener('lorecanvas:returnFocusToEditor', onReturnFocus);
    };
  }, [activeEditor, insertEntityAt]);
```

`onCreated` runs before `onReturnFocus` because the modal dispatches in that order, so the range is consumed before it is cleared.

Make Enter reach the Create row when nothing matched — replace the `Enter` branch of the keyboard handler (lines 100-103) with:

```typescript
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const entity = filtered[selectedIndex];
        if (entity) selectEntity(entity.id, entity.name);
        else if (pluginState.trigger === '[[') startCreate();
```

and extend that effect's dependency array (line 118) to:

```typescript
  }, [pluginState.active, pluginState.trigger, filtered, selectedIndex, selectEntity, startCreate, activeEditor]);
```

**Fix the coordinates.** The box is `position: fixed` (`EntitySuggestDropdown.module.css:2`), so its coordinates are already viewport-relative and the scroll addends double-count. In the position effect (lines 42-43), replace:

```typescript
        const coords = activeEditor.view.coordsAtPos(state.from);
        setPosition({ top: coords.bottom + window.scrollY, left: coords.left + window.scrollX });
```

with:

```typescript
        // coordsAtPos returns viewport coordinates, and the dropdown is
        // position:fixed — adding scroll would count it twice.
        const coords = activeEditor.view.coordsAtPos(state.from);
        setPosition({ top: coords.bottom + 6, left: coords.left });
```

Finally, render the Create row **and portal the whole thing to `document.body`**. The desk puts every canvas widget inside `.deskCanvasInner`, which carries a `transform` (`WritingDesk.tsx:647`) — that makes it the containing block for `position: fixed` descendants and scales them by the desk's zoom — and inside `.deskViewport`, which is `overflow: hidden` (`WritingDesk.module.css:11-14`). A portal to the body escapes both, and matches how `StoryWritingZone.tsx:448` already escapes the same subtree for focus mode.

Replace the return block (lines 122-152) with:

```tsx
  const showCreate = pluginState.trigger === '[[';

  // Portalled to the body: the desk's canvas layer is transformed (which would
  // re-anchor and scale a position:fixed child) and its viewport clips
  // overflow. Neither can be allowed to move or crop the picker.
  const menu = (
    <div
      ref={dropdownRef}
      className={styles.dropdown}
      style={{ top: position.top, left: position.left }}
    >
      {showCreate && (
        <button
          className={styles.item}
          onMouseDown={(e) => { e.preventDefault(); startCreate(); }}
        >
          <span className={styles.itemIcon}>+</span>
          <span className={styles.itemName}>
            {pluginState.query.trim() ? `Create "${pluginState.query.trim()}"` : 'Create a new entry'}
          </span>
          <span className={styles.itemType}>new</span>
        </button>
      )}

      {filtered.length === 0 ? (
        !showCreate && (
          <div className={styles.noResults}>
            No entities match &quot;{pluginState.query || '@'}&quot;
          </div>
        )
      ) : (
        filtered.map((entity, i) => (
          <button
            key={entity.id}
            className={`${styles.item} ${i === selectedIndex ? styles.itemActive : ''}`}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent editor blur
              selectEntity(entity.id, entity.name);
            }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <span className={styles.itemIcon}>
              {getEntityIcon(entity.type)}
            </span>
            <span className={styles.itemName}>{entity.name}</span>
            <span className={styles.itemType}>{entity.type}</span>
          </button>
        ))
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(menu, document.body) : menu;
```

- [ ] **Step 3: Register both in the prose editor**

In `src/components/editor/desk/DeskTipTapEditor.tsx`, add these imports below line 15:

```typescript
import { EntityMark } from '@/lib/EntityMark';
import { EntitySuggest } from '@/lib/EntitySuggest';
import EntitySuggestDropdown from '../EntitySuggestDropdown';
```

Add the two extensions to the list (lines 31-40), after `TextAlign`:

```typescript
      EntityMark,
      EntitySuggest,
```

Add the editor ref below the `useSeedWritingBaseline` call (which ends at line 72), matching the pattern the screenplay editor used at `ScreenplayEditor.tsx:82-85`:

```typescript
  // The suggest dropdown reads the live editor through a ref, so it survives
  // the editor being rebuilt when the scene or the spellcheck setting changes.
  const editorRef = useRef<Editor | null>(null);
  useEffect(() => { editorRef.current = editor ?? null; }, [editor]);
```

Render the dropdown beside the editor body — replace lines 234-236 with:

```tsx
      <div className={styles.deskEditorBody} onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
      <EntitySuggestDropdown editorRef={editorRef} />
```

`Editor` is already imported as a type on line 5 (`import { useEditor, EditorContent, type Editor } from '@tiptap/react';`), and `useRef` on line 3.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run && npx eslint src`

Expected: no compiler output; all tests PASS; no lint errors.

- [ ] **Step 5: Manual check — this is the item the README has been promising**

Start the dev server, open a project with at least one World Bible entry, and click into a scene.

1. Type `@` — the dropdown lists entries in this project's world. Pick one: the name appears underlined (`.entity-tag`, `globals.css:313-321`) and hovering it shows the preview card.
2. Type `[[Ashfall Keep` — the dropdown's first row reads `Create "Ashfall Keep"`. Click it: the New World Entry modal opens with the name filled in.
3. Save it. The modal closes, focus returns to the scene, and `[[Ashfall Keep` is replaced by a marked `Ashfall Keep`.
4. Type `[[Something` and press Escape in the modal instead. Nothing is inserted, and the text you typed is still there.
5. The new entry is in the World Bible, on the right shelf.
6. **Positioning.** Zoom the desk out to about 50% with the zoom control, pan the canvas, then type `[[` again. The dropdown must appear directly under the cursor at its normal size — not offset, not shrunk, not clipped at the edge of the writing column. Repeat once near the bottom edge of the prose column: it must overhang the desk rather than being cut off. Then dock the writing zone and confirm the same.
7. Export the manuscript as Markdown: the entity name is plain text with no `<span>` around it (`htmlToMarkdown` strips `.entity-tag` spans while keeping their text).

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/desk/DeskTipTapEditor.tsx \
        src/components/editor/EntitySuggestDropdown.tsx \
        src/components/world/InlineEntryCreator.tsx
git commit -m "feat: [[ creates a world entry from inside the manuscript

The README has promised this since the first commit. EntitySuggest was only
ever registered in ScreenplayEditor, which Phase 1 deleted, so both triggers
land in the prose editor here: @ links an entry, [[ creates one.

The picker is portalled to the body — the desk's canvas layer is transformed,
which would re-anchor and scale a position:fixed child, and its viewport clips
overflow — and no longer adds page scroll to coordinates that were already
viewport-relative. The inline creator now says what it made, which is the
first listener its focus-return event has ever had."
```

---

## Task 13: Correct the README and run the full regression

**Files:**
- Modify: `README.md`

Closes roadmap item `2e.2`. Phases 1 and 2 already removed the withdrawn work types and every AI claim; what remains is the offline/no-account claim, the export claim (now three formats and a whole book), and a wrong port number.

- [ ] **Step 1: Confirm what Phases 1 and 2 left behind**

```bash
grep -n -i "offline\|no account\|local-first\|consistency\|anthropic\|openai\|gemini\|ollama\|3000" README.md
```

Expected: the offline / local-first lines and the `localhost:3000` line. **If an AI or consistency-checker line is still there, Phase 2's Task 8 Step 4 was not completed** — remove it here rather than leaving it.

- [ ] **Step 2: Verify the account claim against the code**

```bash
grep -n "isLoginPage\|redirect" src/proxy.ts | head
```

Expected: the proxy redirects unauthenticated requests to `/login`. An account is required; "no account required" is false.

- [ ] **Step 3: Verify the port**

```bash
grep -n '"dev"' package.json
```

Expected: `"dev": "next dev -p 4000"`. The README says 3000.

- [ ] **Step 4: Rewrite the affected sections**

Replace the README from its title through the end of "Getting Started" with the following. The fenced block below is shown with four backticks so its inner shell fence survives — copy the inner content, not the outer fence.

````markdown
# LoreCanvas

A creative writing and worldbuilding tool for novelists, storytellers, and
worldbuilders.

## What It Does

LoreCanvas keeps your world bible inside your writing, not beside it. Type `[[`
anywhere in a scene to create a world entry without leaving your writing flow,
and `@` to link one you have already written. Characters, locations, factions,
artifacts, and lore all live alongside your manuscript.

## Core Features

- **Inline entity creation** — type `[[` to create world entries at the point of inspiration
- **Entity linking** — type `@` to link an entry you already wrote
- **World Bible** — every entry filed on the shelf its story belongs to
- **Compile & export** — assemble the whole manuscript with its front matter and
  download it as Markdown, Word (.docx) or EPUB
- **Dark/light mode** — full theme support

## Accounts and your data

LoreCanvas is an account-based app: sign in before you can write. Your workspace
is cached in the browser so a short network drop does not interrupt you, and it
syncs to your account so it follows you between devices. It is not an offline
product and it does not work without an account.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Zustand
- Tiptap

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:4000](http://localhost:4000) to start writing.
````

Delete the "API Key (Optional)" section entirely if Phase 2 has not already.

- [ ] **Step 5: Assert the false claims are gone**

```bash
grep -n -i "offline\|no account required\|local-first\|consistency checker\|anthropic\|openai\|gemini\|ollama\|localhost:3000" README.md
```

Expected: no output.

- [ ] **Step 6: Full regression**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src
npm run build
```

Expected: all four clean.

- [ ] **Step 7: Confirm the bundle rules held**

```bash
grep -c "await import('docx')" src/lib/export.ts
grep -c "await import('mammoth')" src/components/ui/ImportModal.tsx
grep -c "^import JSZip" src/lib/epub.ts
grep -c "^import .* from 'docx'" src/lib/export.ts
```

Expected: `2` (the manuscript builder and its packer), `2`, `1`, and `1` — the last being the type-only `import type * as Docx from 'docx'`.

- [ ] **Step 8: Commit**

```bash
git add README.md
git commit -m "docs: correct the last false README claims

[[ is now real, so the claim stays and gains its @ counterpart. LoreCanvas
requires an account and syncs to the cloud, so 'offline-first, no account
required' goes. Export is three formats and a whole book. The dev server has
been on port 4000 since it moved off 3000."
```

---

## Definition of done

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green
- [ ] `npx eslint src` clean
- [ ] `npm run build` succeeds
- [ ] A multi-chapter project exports as **one** `.md`, **one** `.docx` and **one** `.epub`
- [ ] The EPUB's contents list names chapters, not scenes, and it opens in Calibre or Apple Books
- [ ] The DOCX starts each chapter on a new page
- [ ] Title page, copyright, dedication and contents appear when filled in and are absent when blank
- [ ] The front-matter text survives closing and reopening the modal — it lives on the project
- [ ] Unticking a chapter in the compile step removes it from all three formats
- [ ] "This chapter" names the chapter the desk is showing, and exports only it
- [ ] `grep -rn "exportAsMarkdown\|exportAsDocx\|buildDocxDocument\|buildEpubZip\|exportAsEpub\|buildMarkdownContent" src` returns nothing
- [ ] Typing `[[` in a scene offers to create a world entry; saving inserts the marked name
- [ ] Cancelling the creation leaves the typed text alone and inserts nothing
- [ ] Typing `@` in a scene links an existing entry, and the mark shows the hover preview
- [ ] The picker lands under the cursor at full size with the desk zoomed out and panned, and is not clipped at the edge of the writing column
- [ ] Exporting an outline from the Draft Table lands the desk on the chapter it just built
- [ ] `grep -n -i "offline\|no account required\|localhost:3000" README.md` returns nothing

---

## What Phase 5 picks up

- `broken-link` in `src/lib/loreRules.ts` needs the `entityMark` spans this phase finally starts producing in prose scenes. Before Task 12, `data-entity-id` appeared only in screenplay content, which Phase 1 deleted — so Phase 5's link rule has nothing to check until this phase lands.
- `suggestArticles()` looks for capitalised names with no matching entity. `[[` is the fast path a writer takes to resolve what it finds.

## Explicitly out of scope

- `lazy()`-ing the ExportModal — that is Phase 10, item `3f`.
- Verifying the exported `.docx` and `.epub` open in real readers as a **tracked** item — that is Phase 3, item `21`. Another session was seen starting it in `src/lib/export.test.ts`; Task 10 retargets that suite if it has landed. The manual checks above are a developer smoke test, not that item.
- Accessibility work on the new compile-step controls — Phase 6 owns dialogs, live regions and accessible names, and will reach this modal with the rest.
