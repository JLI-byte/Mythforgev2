# Visual Novel Work Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth work type, Visual Novel, for choice-driven branching stories, plus an exporter that produces a single `.rpy` file that drops into an existing Ren'Py project's `game/` folder.

**Architecture:** Scenes stay an ordered list and gain an optional `choices` array. That maps one-to-one onto Ren'Py — a scene is a `label`, its choices are a `menu`, a choice's target is a `jump`. All Ren'Py generation lives in pure functions in `src/lib/renpyExport.ts` so it can be tested without a browser or a Ren'Py install; the download trigger reuses the existing infrastructure in `src/lib/export.ts`.

**Tech Stack:** TypeScript, React 19, Next.js 16, Zustand 5, Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-08-18-visual-novel-work-type-design.md`

---

## Context you need before starting

**You cannot run the output.** No Ren'Py SDK is installed on this machine. Correctness rests entirely on the tests. Do not "simplify" an escaping rule or a label rule because it looks fussy — each one exists because it produces a file that fails to compile.

**Ren'Py syntax facts this plan depends on** (from the official docs, `renpy.org/doc`):

- `label name:` opens a block. `jump name` transfers control and does not return.
- If a label block does not end in `jump` or `return`, execution falls through to whatever text comes next. This plan never relies on that — every block ends explicitly.
- `menu:` presents choices. Each is a quoted string, then optional ` if <flag>`, then `:`, then an indented body.
- `$ flag = True` sets a variable. `default flag = False` declares it, and the docs recommend `default` for every variable that changes so old saves cannot leak values into a new game.
- Every dialogue line is `alias "text"`, and each alias must be declared with `define s = Character("Sylvie")`.

**Indentation is significant in Ren'Py, like Python.** The generated file uses 4 spaces per level: statements inside a label are at 4, `menu:` is at 4, choice strings at 8, choice bodies at 12.

**Run tests with:** `npm test` (Vitest, single run). A single file: `npx vitest run src/lib/renpyExport.test.ts`.

---

## File Structure

**New files**

| File | Responsibility |
|---|---|
| `src/lib/visualNovel.ts` | `VNChoice` type, flag collection, validation. Leaf module — no store, no React. |
| `src/lib/visualNovel.test.ts` | Validation rules. |
| `src/lib/renpyExport.ts` | All Ren'Py text generation. Pure: data in, string out. |
| `src/lib/renpyExport.test.ts` | Escaping, labels, aliases, dialogue parsing, golden file. |
| `src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx` | The fifth sibling zone. |

**Modified files**

| File | Change |
|---|---|
| `src/lib/workTypes.ts` | New `visual-novel` entry; `WritingMode` gains `'visual-novel'`. |
| `src/lib/workTypes.test.ts` | Existing assertions hard-code four types — update to five. |
| `src/store/workspaceStore.ts` | `Project['writingMode']` union; `Scene.choices`. |
| `src/lib/export.ts` | Add `exportAsRenpy` beside the existing exporters. |
| `src/components/editor/desk/widgets/WritingZoneRenderer.tsx` | Register the new zone. |
| `src/components/editor/desk/widgets/WritingZoneRenderer.test.ts` | Assert the new dispatch. |

Tasks 1–8 produce a fully tested exporter with no UI. Tasks 9–11 add the writing zone.

---

### Task 1: Register the Visual Novel work type

Adding a fifth type breaks two existing assertions in `workTypes.test.ts` that hard-code four. Update them first so the failure is intentional.

**Files:**
- Modify: `src/lib/workTypes.ts`
- Modify: `src/lib/workTypes.test.ts:6-17`
- Modify: `src/store/workspaceStore.ts:92`
- Test: `src/lib/workTypes.test.ts`

- [ ] **Step 1: Update the two failing assertions and add a new one**

In `src/lib/workTypes.test.ts`, replace the first two `it(...)` blocks with:

```ts
    it('offers exactly the five choices the new-work flow asks about', () => {
        expect(WORK_TYPES.map(t => t.id)).toEqual([
            'story', 'screenplay', 'script-report', 'lyrics', 'visual-novel',
        ]);
    });

    it('gives every type a writing mode the store accepts', () => {
        const allowed = [
            'novel', 'screenplay', 'markdown', 'poetry', 'real-world', 'visual-novel',
        ];
        for (const t of WORK_TYPES) {
            expect(allowed).toContain(t.writingMode);
        }
    });

    it('recovers the visual novel type from its writing mode', () => {
        expect(getWorkTypeByWritingMode('visual-novel')?.id).toBe('visual-novel');
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/workTypes.test.ts`
Expected: FAIL — the id array is missing `'visual-novel'`, and `getWorkTypeByWritingMode` returns `undefined`.

- [ ] **Step 3: Add the type**

In `src/lib/workTypes.ts`, extend the `WritingMode` union and the `WorkType['id']` union, then append the entry:

```ts
export type WritingMode =
    | 'novel' | 'screenplay' | 'markdown' | 'poetry' | 'real-world' | 'visual-novel';

export interface WorkType {
    id: 'story' | 'screenplay' | 'script-report' | 'lyrics' | 'visual-novel';
    // ...rest unchanged
}
```

Append to `WORK_TYPES` (last element, after `lyrics`):

```ts
    {
        id: 'visual-novel',
        label: 'Visual Novel',
        icon: '🎮',
        desc: 'Choice-driven branching stories',
        writingMode: 'visual-novel',
        // No draft type: the outlining methods assume a linear story, and a
        // branching one is a graph. Leaving it unset keeps the Draft Table
        // unfiltered rather than suggesting a shape that does not fit.
        namePlaceholder: 'e.g. The Lighthouse Summer',
    },
```

- [ ] **Step 4: Widen the store union**

In `src/store/workspaceStore.ts`, line 92, change `Project['writingMode']` to:

```ts
    writingMode: 'novel' | 'screenplay' | 'markdown' | 'poetry' | 'real-world' | 'visual-novel';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/lib/workTypes.test.ts`
Expected: PASS

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/lib/workTypes.ts src/lib/workTypes.test.ts src/store/workspaceStore.ts
git commit -m "feat: register the Visual Novel work type"
```

---

### Task 2: Choice type and flag collection

**Files:**
- Create: `src/lib/visualNovel.ts`
- Create: `src/lib/visualNovel.test.ts`
- Modify: `src/store/workspaceStore.ts` (the `Scene` interface, around line 119)

- [ ] **Step 1: Write the failing test**

Create `src/lib/visualNovel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { collectFlags, type VNScene } from './visualNovel';

const scene = (id: string, choices: VNScene['choices'] = []): VNScene => ({
    id, title: id, content: '', order: 0, choices,
});

describe('collectFlags', () => {
    it('returns every flag a choice sets or requires, sorted and deduped', () => {
        const scenes = [
            scene('a', [
                { id: 'c1', text: 'yes', targetSceneId: 'b', setsFlag: 'agreed' },
                { id: 'c2', text: 'no', targetSceneId: 'c', setsFlag: 'refused' },
            ]),
            scene('b', [
                { id: 'c3', text: 'recall', targetSceneId: 'c', requiresFlag: 'agreed' },
            ]),
        ];
        expect(collectFlags(scenes)).toEqual(['agreed', 'refused']);
    });

    it('returns an empty array when no choice touches a flag', () => {
        expect(collectFlags([scene('a', [
            { id: 'c1', text: 'onward', targetSceneId: 'b' },
        ])])).toEqual([]);
    });

    it('tolerates scenes with no choices at all', () => {
        expect(collectFlags([{ id: 'a', title: 'A', content: '', order: 0 }])).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/visualNovel.test.ts`
Expected: FAIL — cannot resolve `./visualNovel`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/visualNovel.ts`:

```ts
/**
 * Visual novel branching — the choices that lead out of a scene, and the
 * checks worth running before export. LEAF MODULE (no store, no React).
 *
 * A visual novel is a graph, not a list: two choices routinely converge on one
 * scene. Scenes stay an ordered list and carry their outgoing edges, which is
 * exactly the shape Ren'Py wants — a label, a menu, and a jump per choice.
 */

/** One option in a scene's menu. */
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

/**
 * The slice of a Scene the visual novel code needs. Declared structurally so
 * these modules stay leaves — they never import the store.
 */
export interface VNScene {
    id: string;
    title: string;
    content: string;
    order: number;
    choices?: VNChoice[];
}

/**
 * Every flag mentioned anywhere, sorted and deduped. Ren'Py wants a `default`
 * line for each, so a value from an old save cannot leak into a new game.
 */
export function collectFlags(scenes: VNScene[]): string[] {
    const flags = new Set<string>();
    for (const scene of scenes) {
        for (const choice of scene.choices ?? []) {
            if (choice.setsFlag) flags.add(choice.setsFlag);
            if (choice.requiresFlag) flags.add(choice.requiresFlag);
        }
    }
    return [...flags].sort();
}
```

- [ ] **Step 4: Add `choices` to the store's Scene**

In `src/store/workspaceStore.ts`, import the type and add the field to `Scene`:

```ts
import type { VNChoice } from '@/lib/visualNovel';
```

```ts
export interface Scene {
    // ...existing fields unchanged
    /** Visual novel projects only: the choices that lead out of this scene. */
    choices?: VNChoice[];
}
```

No migration is needed — the Supabase schema stores the whole workspace as a single `jsonb` blob in `workspaces.data`.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/lib/visualNovel.test.ts`
Expected: PASS (3 tests)

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/lib/visualNovel.ts src/lib/visualNovel.test.ts src/store/workspaceStore.ts
git commit -m "feat: add VNChoice and flag collection for visual novels"
```

---

### Task 3: Label naming

**Do not reuse `slugify` from `src/lib/export.ts`.** It emits hyphens (`the-meadow`), and a Ren'Py label is a Python-style identifier — hyphens are a syntax error. This task exists because that is the obvious mistake to make.

**Files:**
- Create: `src/lib/renpyExport.ts`
- Create: `src/lib/renpyExport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/renpyExport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildLabelMap } from './renpyExport';

const titled = (id: string, title: string) => ({ id, title });

describe('buildLabelMap', () => {
    it('turns a title into a lowercase underscored label', () => {
        const map = buildLabelMap([titled('1', 'The Meadow')]);
        expect(map.get('1')).toBe('the_meadow');
    });

    it('never emits a hyphen — they are a syntax error in a Ren\'Py label', () => {
        const map = buildLabelMap([titled('1', 'Act One — The Long Goodbye')]);
        expect(map.get('1')).not.toContain('-');
        expect(map.get('1')).toBe('act_one_the_long_goodbye');
    });

    it('collapses punctuation runs and trims the edges', () => {
        expect(buildLabelMap([titled('1', '  ...Well?!  ')]).get('1')).toBe('well');
    });

    it('prefixes titles that start with a digit', () => {
        expect(buildLabelMap([titled('1', '3am')]).get('1')).toBe('s_3am');
    });

    it('prefixes Ren\'Py keywords so they cannot collide with the language', () => {
        expect(buildLabelMap([titled('1', 'Start')]).get('1')).toBe('start_scene');
        expect(buildLabelMap([titled('2', 'Return')]).get('2')).toBe('return_scene');
    });

    it('dedupes identical titles with a numeric suffix', () => {
        const map = buildLabelMap([
            titled('1', 'The Meadow'),
            titled('2', 'The Meadow'),
            titled('3', 'The Meadow'),
        ]);
        expect([map.get('1'), map.get('2'), map.get('3')])
            .toEqual(['the_meadow', 'the_meadow_2', 'the_meadow_3']);
    });

    it('falls back to a usable label when a title has no usable characters', () => {
        expect(buildLabelMap([titled('1', '???')]).get('1')).toBe('scene');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/renpyExport.test.ts`
Expected: FAIL — cannot resolve `./renpyExport`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/renpyExport.ts`:

```ts
/**
 * Ren'Py export — turns a visual novel project into a .rpy file that drops
 * into an existing Ren'Py game's game/ folder. LEAF MODULE, and deliberately
 * pure: data in, string out, no store and no DOM.
 *
 * Nothing here can be verified by running it — the machine has no Ren'Py SDK.
 * The tests are the only safety net, so every rule below exists because
 * breaking it produces a file that fails to compile.
 */

/**
 * Words Ren'Py owns. A label with one of these names shadows the language, so
 * they get a suffix. Not exhaustive — it covers the statement keywords a scene
 * title plausibly collides with.
 */
const RENPY_KEYWORDS = new Set([
    'start', 'menu', 'label', 'jump', 'call', 'return', 'init', 'python',
    'define', 'default', 'scene', 'show', 'hide', 'image', 'transform',
    'pause', 'while', 'if', 'elif', 'else', 'pass', 'screen', 'style',
]);

/**
 * Scene id → Ren'Py label, derived rather than stored so renaming a scene
 * renames its label. Order matters: dedupe suffixes follow the input order.
 */
export function buildLabelMap(scenes: { id: string; title: string }[]): Map<string, string> {
    const taken = new Set<string>();
    const map = new Map<string, string>();

    for (const scene of scenes) {
        let base = scene.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');

        if (!base) base = 'scene';
        if (/^[0-9]/.test(base)) base = `s_${base}`;
        if (RENPY_KEYWORDS.has(base)) base = `${base}_scene`;

        let label = base;
        let n = 2;
        while (taken.has(label)) {
            label = `${base}_${n}`;
            n += 1;
        }

        taken.add(label);
        map.set(scene.id, label);
    }

    return map;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/renpyExport.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/renpyExport.ts src/lib/renpyExport.test.ts
git commit -m "feat: derive Ren'Py labels from scene titles"
```

---

### Task 4: Text escaping

Three characters break a Ren'Py string, plus the backslash that escapes them. **Order matters** — backslash must be escaped first, or the backslashes introduced by the other rules get double-escaped.

**Files:**
- Modify: `src/lib/renpyExport.ts`
- Modify: `src/lib/renpyExport.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/renpyExport.test.ts`, and add `escapeRenpyText` to the import at the top:

```ts
describe('escapeRenpyText', () => {
    it('escapes double quotes, which would otherwise end the string', () => {
        expect(escapeRenpyText('She said "no"')).toBe('She said \\"no\\"');
    });

    it('doubles square brackets, which are variable interpolation', () => {
        expect(escapeRenpyText('[again]')).toBe('[[again]');
    });

    it('doubles curly braces, which are text tags', () => {
        expect(escapeRenpyText('{b}bold{/b}')).toBe('{{b}bold{{/b}');
    });

    it('escapes backslashes first so the other rules are not double-escaped', () => {
        expect(escapeRenpyText('back\\slash')).toBe('back\\\\slash');
        expect(escapeRenpyText('a\\"b')).toBe('a\\\\\\"b');
    });

    it('handles a line that trips all three rules at once', () => {
        expect(escapeRenpyText('She said "no" [again] {sigh}'))
            .toBe('She said \\"no\\" [[again] {{sigh}');
    });

    it('leaves ordinary prose untouched', () => {
        expect(escapeRenpyText('The meadow is gold this time of year.'))
            .toBe('The meadow is gold this time of year.');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/renpyExport.test.ts`
Expected: FAIL — `escapeRenpyText` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/renpyExport.ts`:

```ts
/**
 * Makes a line safe inside a Ren'Py double-quoted string.
 *
 * Backslash goes first on purpose: the later rules introduce backslashes, and
 * escaping them again would corrupt the output. Closing brackets need no
 * escape — only the opening ones are significant.
 */
export function escapeRenpyText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\[/g, '[[')
        .replace(/\{/g, '{{');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/renpyExport.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/renpyExport.ts src/lib/renpyExport.test.ts
git commit -m "feat: escape Ren'Py string metacharacters"
```

---

### Task 5: Dialogue parsing and character aliases

**Files:**
- Modify: `src/lib/renpyExport.ts`
- Modify: `src/lib/renpyExport.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/renpyExport.test.ts`, adding `parseDialogueLine` and `buildAliasMap` to the import:

```ts
describe('parseDialogueLine', () => {
    const cast = new Set(['sylvie', 'me']);

    it('splits a known speaker from their line', () => {
        expect(parseDialogueLine('Sylvie: Hey... umm...', cast))
            .toEqual({ speaker: 'Sylvie', text: 'Hey... umm...' });
    });

    it('matches the speaker regardless of case', () => {
        expect(parseDialogueLine('SYLVIE: Hi', cast).speaker).toBe('SYLVIE');
    });

    it('treats a colon line as narration when the name is not in the cast', () => {
        expect(parseDialogueLine('The sign read: Keep Out', cast))
            .toEqual({ text: 'The sign read: Keep Out' });
    });

    it('treats a plain line as narration', () => {
        expect(parseDialogueLine('The meadow is gold.', cast))
            .toEqual({ text: 'The meadow is gold.' });
    });

    it('trims surrounding whitespace', () => {
        expect(parseDialogueLine('   Me:   Yeah?   ', cast))
            .toEqual({ speaker: 'Me', text: 'Yeah?' });
    });
});

describe('buildAliasMap', () => {
    it('uses the first letter of each name', () => {
        const map = buildAliasMap(['Sylvie', 'Me']);
        expect(map.get('Sylvie')).toBe('s');
        expect(map.get('Me')).toBe('m');
    });

    it('grows the alias when two names share a first letter', () => {
        const map = buildAliasMap(['Sylvie', 'Sam']);
        expect(map.get('Sylvie')).toBe('s');
        expect(map.get('Sam')).toBe('sa');
    });

    it('falls back to a numbered alias when the letters run out', () => {
        const map = buildAliasMap(['S', 'S ', ' S']);
        expect(new Set(map.values()).size).toBe(3);
    });

    it('ignores punctuation and spacing when deriving letters', () => {
        expect(buildAliasMap(["D'Arcy"]).get("D'Arcy")).toBe('d');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/renpyExport.test.ts`
Expected: FAIL — neither function is exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/renpyExport.ts`:

```ts
export interface ParsedLine {
    /** The name as written, when it matched a cast member. */
    speaker?: string;
    text: string;
}

/**
 * Splits `Name: line` into speaker and text, but only when the name is
 * actually in the cast — otherwise "The sign read: Keep Out" would invent a
 * character called "The sign read". Anything unmatched is narration.
 *
 * `cast` holds lowercased names.
 */
export function parseDialogueLine(line: string, cast: Set<string>): ParsedLine {
    const match = line.match(/^\s*([^:]{1,40}):\s+(.*)$/);
    if (match) {
        const name = match[1].trim();
        if (cast.has(name.toLowerCase())) {
            return { speaker: name, text: match[2].trim() };
        }
    }
    return { text: line.trim() };
}

/**
 * Name → short Ren'Py alias, so dialogue reads `s "Hi"` rather than repeating
 * the full name. Grows the alias letter by letter on collision, then falls
 * back to numbering when a name has no letters left to give.
 */
export function buildAliasMap(names: string[]): Map<string, string> {
    const taken = new Set<string>();
    const map = new Map<string, string>();

    for (const name of names) {
        const letters = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'c';

        let alias = letters.slice(0, 1);
        let length = 1;
        while (taken.has(alias) && length < letters.length) {
            length += 1;
            alias = letters.slice(0, length);
        }

        let n = 2;
        while (taken.has(alias)) {
            alias = `${letters.slice(0, 1)}${n}`;
            n += 1;
        }

        taken.add(alias);
        map.set(name, alias);
    }

    return map;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/renpyExport.test.ts`
Expected: PASS (22 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/renpyExport.ts src/lib/renpyExport.test.ts
git commit -m "feat: parse Name-colon dialogue and derive character aliases"
```

---

### Task 6: Assemble the script

This is the task the whole feature rests on. It ends with a golden test asserting a complete, paste-able file.

**Files:**
- Modify: `src/lib/renpyExport.ts`
- Modify: `src/lib/renpyExport.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/renpyExport.test.ts`, adding `buildRenpyScript` to the import and `import type { VNScene } from './visualNovel';`:

```ts
describe('buildRenpyScript', () => {
    const twoBranch: VNScene[] = [
        {
            id: 'meadow', title: 'The Meadow', order: 0,
            content: 'The meadow is gold this time of year.\n\nSylvie: Hey... umm...\nMe: Yeah?',
            choices: [
                { id: 'c1', text: 'Say yes.', targetSceneId: 'partners', setsFlag: 'agreed' },
                { id: 'c2', text: 'Ask what that means.', targetSceneId: 'explain' },
            ],
        },
        { id: 'partners', title: 'Partners', order: 1, content: 'Sylvie: Partners, then.', choices: [] },
        { id: 'explain', title: 'Explain', order: 2, content: 'Me: It is a kind of game.', choices: [
            { id: 'c3', text: 'Say yes now.', targetSceneId: 'partners', requiresFlag: 'agreed' },
        ] },
    ];

    it('emits a complete, paste-able script', () => {
        expect(buildRenpyScript(twoBranch, ['Sylvie', 'Me'], 'Lighthouse Summer')).toBe(
`# Generated by LoreCanvas — Lighthouse Summer
# Drop this file into your Ren'Py project's game/ folder.

define s = Character("Sylvie")
define m = Character("Me")

default agreed = False

label start:
    jump the_meadow

label the_meadow:
    "The meadow is gold this time of year."

    s "Hey... umm..."
    m "Yeah?"

    menu:
        "Say yes.":
            $ agreed = True
            jump partners

        "Ask what that means.":
            jump explain

label partners:
    s "Partners, then."
    return

label explain:
    m "It is a kind of game."

    menu:
        "Say yes now." if agreed:
            jump partners
`);
    });

    it('falls through to the next scene when a scene has no choices', () => {
        const script = buildRenpyScript([
            { id: 'a', title: 'A', order: 0, content: 'One.' },
            { id: 'b', title: 'B', order: 1, content: 'Two.' },
        ], [], 'X');
        expect(script).toContain('label a:\n    "One."\n    jump b');
    });

    it('ends the last choiceless scene with return', () => {
        const script = buildRenpyScript(
            [{ id: 'a', title: 'A', order: 0, content: 'Only.' }], [], 'X');
        expect(script.trimEnd().endsWith('return')).toBe(true);
    });

    it('sorts scenes by order, not array position', () => {
        const script = buildRenpyScript([
            { id: 'b', title: 'B', order: 5, content: 'Second.' },
            { id: 'a', title: 'A', order: 1, content: 'First.' },
        ], [], 'X');
        expect(script).toContain('label start:\n    jump a');
    });

    it('leaves a comment and returns when a choice targets a missing scene', () => {
        const script = buildRenpyScript([
            { id: 'a', title: 'A', order: 0, content: 'Hi.', choices: [
                { id: 'c1', text: 'Go', targetSceneId: 'deleted' },
            ] },
        ], [], 'X');
        expect(script).toContain('# LoreCanvas: this choice targeted a scene that no longer exists');
        expect(script).toContain('            return');
    });

    it('escapes the project name in the header', () => {
        expect(buildRenpyScript([], [], 'A "Quoted" Name'))
            .toContain('# Generated by LoreCanvas — A "Quoted" Name');
    });

    it('produces no output body for a project with no scenes', () => {
        expect(buildRenpyScript([], [], 'Empty')).not.toContain('label start:');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/renpyExport.test.ts`
Expected: FAIL — `buildRenpyScript` is not exported.

- [ ] **Step 3: Write the implementation**

First add this import at the **top** of `src/lib/renpyExport.ts`, with the
other imports — not mid-file, where the linter will flag it:

```ts
import { collectFlags, type VNScene } from './visualNovel';
```

Then append the rest to the bottom of the file:

```ts
const INDENT = '    ';

/**
 * Every name that needs a `define`: the shelf's cast, plus any name used as a
 * speaker in scene text. Typed-but-unknown names are included on purpose, so a
 * speaker is never silently demoted to narration.
 */
function collectSpeakers(scenes: VNScene[], castNames: string[]): string[] {
    const names: string[] = [...castNames];
    const seen = new Set(castNames.map(n => n.toLowerCase()));

    for (const scene of scenes) {
        for (const line of scene.content.split('\n')) {
            const match = line.match(/^\s*([^:]{1,40}):\s+.*$/);
            if (!match) continue;
            const name = match[1].trim();
            if (!name || seen.has(name.toLowerCase())) continue;
            seen.add(name.toLowerCase());
            names.push(name);
        }
    }

    return names;
}

/**
 * The whole .rpy file. Pure — this is what the tests exercise, and the only
 * thing standing between the writer and a file that will not compile.
 */
export function buildRenpyScript(
    scenes: VNScene[],
    castNames: string[],
    projectName: string,
): string {
    const ordered = [...scenes].sort((a, b) => a.order - b.order);
    const labels = buildLabelMap(ordered);
    const speakers = collectSpeakers(ordered, castNames);
    const aliases = buildAliasMap(speakers);
    const cast = new Set(speakers.map(n => n.toLowerCase()));
    const flags = collectFlags(ordered);

    const out: string[] = [
        `# Generated by LoreCanvas — ${projectName}`,
        `# Drop this file into your Ren'Py project's game/ folder.`,
        '',
    ];

    for (const name of speakers) {
        out.push(`define ${aliases.get(name)} = Character("${escapeRenpyText(name)}")`);
    }
    if (speakers.length) out.push('');

    for (const flag of flags) out.push(`default ${flag} = False`);
    if (flags.length) out.push('');

    if (!ordered.length) return `${out.join('\n').trimEnd()}\n`;

    out.push('label start:', `${INDENT}jump ${labels.get(ordered[0].id)}`, '');

    ordered.forEach((scene, index) => {
        out.push(`label ${labels.get(scene.id)}:`);

        for (const raw of scene.content.split('\n')) {
            if (!raw.trim()) {
                out.push('');
                continue;
            }
            const parsed = parseDialogueLine(raw, cast);
            const text = `"${escapeRenpyText(parsed.text)}"`;
            out.push(parsed.speaker
                ? `${INDENT}${aliases.get(parsed.speaker)} ${text}`
                : `${INDENT}${text}`);
        }

        const choices = scene.choices ?? [];

        if (choices.length) {
            out.push('', `${INDENT}menu:`);
            for (const choice of choices) {
                const guard = choice.requiresFlag ? ` if ${choice.requiresFlag}` : '';
                out.push(`${INDENT.repeat(2)}"${escapeRenpyText(choice.text)}"${guard}:`);
                if (choice.setsFlag) {
                    out.push(`${INDENT.repeat(3)}$ ${choice.setsFlag} = True`);
                }
                const target = labels.get(choice.targetSceneId);
                if (target) {
                    out.push(`${INDENT.repeat(3)}jump ${target}`);
                } else {
                    out.push(`${INDENT.repeat(3)}# LoreCanvas: this choice targeted a scene that no longer exists`);
                    out.push(`${INDENT.repeat(3)}return`);
                }
                out.push('');
            }
        } else {
            const next = ordered[index + 1];
            out.push(next ? `${INDENT}jump ${labels.get(next.id)}` : `${INDENT}return`);
            out.push('');
        }
    });

    return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/renpyExport.test.ts`
Expected: PASS (29 tests)

If the golden test fails on whitespace, read the diff carefully before changing the expectation — Ren'Py indentation is significant, and the expected string in the test is the specification.

- [ ] **Step 5: Commit**

```bash
git add src/lib/renpyExport.ts src/lib/renpyExport.test.ts
git commit -m "feat: assemble a complete Ren'Py script from scenes and choices"
```

---

### Task 7: Validation

**Files:**
- Modify: `src/lib/visualNovel.ts`
- Modify: `src/lib/visualNovel.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/visualNovel.test.ts`, adding `validateVisualNovel` to the import:

```ts
describe('validateVisualNovel', () => {
    it('reports a choice pointing at a scene that no longer exists', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Go', targetSceneId: 'gone' },
            ] },
        ]);
        expect(issues).toContainEqual({
            kind: 'broken-jump', sceneId: 'a',
            message: '“Go” points at a scene that no longer exists.',
        });
    });

    it('does not call a scene unreachable when the previous one falls through', () => {
        // 'a' has no choices, so it flows into 'orphan' — which is therefore reached.
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [] },
            { id: 'orphan', title: 'Orphan', content: '', order: 1, choices: [] },
        ]);
        expect(issues.some(i => i.kind === 'unreachable' && i.sceneId === 'orphan')).toBe(false);
    });

    it('does not call the first scene unreachable', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [] },
        ]);
        expect(issues.some(i => i.kind === 'unreachable')).toBe(false);
    });

    it('reports a genuinely unreachable scene', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Go', targetSceneId: 'a' },
            ] },
            { id: 'island', title: 'Island', content: '', order: 1, choices: [
                { id: 'c2', text: 'Stay', targetSceneId: 'island' },
            ] },
        ]);
        expect(issues.some(i => i.kind === 'unreachable' && i.sceneId === 'island')).toBe(true);
    });

    it('reports a choice requiring a flag nothing ever sets', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Recall', targetSceneId: 'a', requiresFlag: 'never_set' },
            ] },
        ]);
        expect(issues.some(i => i.kind === 'unsatisfiable-flag')).toBe(true);
    });

    it('accepts a convergent graph — two choices, one destination', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Left', targetSceneId: 'end' },
                { id: 'c2', text: 'Right', targetSceneId: 'end' },
            ] },
            { id: 'end', title: 'End', content: '', order: 1, choices: [] },
        ]);
        expect(issues).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/visualNovel.test.ts`
Expected: FAIL — `validateVisualNovel` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/visualNovel.ts`:

```ts
export type VNIssueKind =
    | 'broken-jump' | 'unreachable' | 'dead-end' | 'unsatisfiable-flag';

export interface VNIssue {
    kind: VNIssueKind;
    sceneId: string;
    message: string;
}

/**
 * Warnings worth showing before export — never blockers, so a work in progress
 * can always be exported.
 *
 * A scene with no choices falls through to the next by order, so it is only a
 * dead end when there is no next scene.
 */
export function validateVisualNovel(scenes: VNScene[]): VNIssue[] {
    const ordered = [...scenes].sort((a, b) => a.order - b.order);
    const ids = new Set(ordered.map(s => s.id));
    const issues: VNIssue[] = [];

    const targeted = new Set<string>();
    const setFlags = new Set<string>();
    for (const scene of ordered) {
        for (const choice of scene.choices ?? []) {
            targeted.add(choice.targetSceneId);
            if (choice.setsFlag) setFlags.add(choice.setsFlag);
        }
    }

    ordered.forEach((scene, index) => {
        const choices = scene.choices ?? [];

        for (const choice of choices) {
            if (!ids.has(choice.targetSceneId)) {
                issues.push({
                    kind: 'broken-jump', sceneId: scene.id,
                    message: `“${choice.text}” points at a scene that no longer exists.`,
                });
            }
            if (choice.requiresFlag && !setFlags.has(choice.requiresFlag)) {
                issues.push({
                    kind: 'unsatisfiable-flag', sceneId: scene.id,
                    message: `“${choice.text}” needs ${choice.requiresFlag}, which nothing sets.`,
                });
            }
        }

        const isFirst = index === 0;
        const fallsThroughToHere = index > 0 && !(ordered[index - 1].choices ?? []).length;
        if (!isFirst && !targeted.has(scene.id) && !fallsThroughToHere) {
            issues.push({
                kind: 'unreachable', sceneId: scene.id,
                message: `Nothing leads to “${scene.title}”.`,
            });
        }

        if (!choices.length && index === ordered.length - 1 && ordered.length > 1) {
            issues.push({
                kind: 'dead-end', sceneId: scene.id,
                message: `“${scene.title}” ends the story — no choices and nothing after it.`,
            });
        }
    });

    return issues;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/visualNovel.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/visualNovel.ts src/lib/visualNovel.test.ts
git commit -m "feat: validate visual novel branch structure before export"
```

---

### Task 8: Wire the download

Reuses the module-private `downloadFile` and `slugify` already in `export.ts`, following the existing split between pure content-building and download-triggering.

**Files:**
- Modify: `src/lib/export.ts`

- [ ] **Step 1: Add the exporter**

At the top of `src/lib/export.ts`, add to the existing imports:

```ts
import { buildRenpyScript } from '@/lib/renpyExport';
import type { VNScene } from '@/lib/visualNovel';
```

Append at the end of the file, beside `exportWorldBible`:

```ts
/**
 * Exports a visual novel project as a single .rpy file.
 *
 * Ren'Py auto-loads every .rpy under game/, so this drops in alongside the
 * user's own options.rpy and screens.rpy without overwriting anything.
 */
export function exportAsRenpy(
    scenes: VNScene[],
    castNames: string[],
    projectName: string,
): void {
    const script = buildRenpyScript(scenes, castNames, projectName);
    const safeName = projectName?.trim() || 'visual-novel';
    downloadFile(script, `${slugify(safeName)}.rpy`, 'text/plain');
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 3: Verify nothing regressed**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 4: Commit**

```bash
git add src/lib/export.ts
git commit -m "feat: download a visual novel project as a .rpy file"
```

---

### Task 9: Create and register the writing zone

Mechanical. The zone starts as an exact clone of `StoryWritingZone`, exactly as the other three siblings did — the choices strip comes in Task 10.

**Files:**
- Create: `src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx`
- Modify: `src/components/editor/desk/widgets/WritingZoneRenderer.tsx`
- Modify: `src/components/editor/desk/widgets/WritingZoneRenderer.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/components/editor/desk/widgets/WritingZoneRenderer.test.ts`, add the import and extend the first two tests:

```ts
import { VisualNovelWritingZone } from './zones/VisualNovelWritingZone';
```

```ts
    it('sends each writing mode to the zone built for it', () => {
        expect(pickZone('novel')).toBe(StoryWritingZone);
        expect(pickZone('screenplay')).toBe(ScreenplayWritingZone);
        expect(pickZone('markdown')).toBe(ReportWritingZone);
        expect(pickZone('poetry')).toBe(LyricsWritingZone);
        expect(pickZone('visual-novel')).toBe(VisualNovelWritingZone);
    });
```

The existing `'never sends two modes to the same zone'` test needs no change — it derives its count from `WORK_TYPES`, so it starts asserting five automatically.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/editor/desk/widgets/WritingZoneRenderer.test.ts`
Expected: FAIL — cannot resolve `./zones/VisualNovelWritingZone`.

- [ ] **Step 3: Clone the story zone**

```bash
cp src/components/editor/desk/widgets/zones/StoryWritingZone.tsx \
   src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx
```

In the new file, replace the doc comment with:

```tsx
/**
 * VisualNovelWritingZone — the writing zone for a choice-driven visual novel.
 *
 * One of five sibling zones, cloned from the story zone so each medium can
 * diverge without disturbing the others. Reached when a project's writingMode
 * is 'visual-novel'; see WritingZoneRenderer for the dispatch.
 *
 * What makes this one different is the choices strip beneath the editor: a
 * visual novel is a graph, and a scene's outgoing choices are the edges.
 */
```

Then rename the component on the export line (line 26 in the clone):

```tsx
export function VisualNovelWritingZone({ content, onChange, onChangeImmediate, widget, onDragStart, onDeleteWidget, onDockChange, onManualSave, onAddAtCenter }: WritingZoneProps) {
```

- [ ] **Step 4: Register it**

In `WritingZoneRenderer.tsx`, add the import beside its siblings and one entry to `ZONES`:

```tsx
import { VisualNovelWritingZone } from './zones/VisualNovelWritingZone';
```

```tsx
const ZONES: Record<string, React.ComponentType<WritingZoneProps>> = {
    'story': StoryWritingZone,
    'screenplay': ScreenplayWritingZone,
    'script-report': ReportWritingZone,
    'lyrics': LyricsWritingZone,
    'visual-novel': VisualNovelWritingZone,
};
```

Also update the file's doc comment: it says "four siblings", which is now five.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/components/editor/desk/widgets/WritingZoneRenderer.test.ts`
Expected: PASS

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx \
        src/components/editor/desk/widgets/WritingZoneRenderer.tsx \
        src/components/editor/desk/widgets/WritingZoneRenderer.test.ts
git commit -m "feat: add the visual novel writing zone"
```

---

### Task 10: Choices strip

**Files:**
- Modify: `src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx`

- [ ] **Step 1: Confirm what the cloned zone already gives you**

No new store action is needed — a choice edit is a scene update. The clone
already has everything required:

| Name | Where | What it is |
|---|---|---|
| `updateScene` | already subscribed near the top | `(id, updates: Partial<Omit<Scene, 'id' \| 'documentId' \| 'projectId' \| 'createdAt'>>) => void` — `{ choices }` is a valid update |
| `projectScenes` | line ~76 | every scene in the project, via `useShallow` |
| `activeScene` | line ~127 | the selected scene, **or `null`** when the binder is on "all" or "cover" |
| `editorSlot` | line ~178 | the JSX holding the editor — the strip renders beneath this |

`activeScene` being nullable is why the render in Step 3 is guarded.

- [ ] **Step 2: Add the strip component**

Add near the bottom of `VisualNovelWritingZone.tsx`, above the main component's export:

```tsx
interface ChoicesStripProps {
    scene: { id: string; choices?: VNChoice[] };
    /** Every scene in the project, for the target dropdown. */
    scenes: { id: string; title: string }[];
    onChange: (choices: VNChoice[]) => void;
}

function ChoicesStrip({ scene, scenes, onChange }: ChoicesStripProps) {
    const choices = scene.choices ?? [];

    const update = (id: string, patch: Partial<VNChoice>) =>
        onChange(choices.map(c => (c.id === id ? { ...c, ...patch } : c)));

    const add = () =>
        onChange([...choices, {
            id: `choice-${Date.now()}`,
            text: '',
            targetSceneId: scenes.find(s => s.id !== scene.id)?.id ?? scene.id,
        }]);

    const remove = (id: string) => onChange(choices.filter(c => c.id !== id));

    return (
        <div className={styles.choicesStrip}>
            <h4>Choices</h4>

            {choices.length === 0 && (
                <p className={styles.choicesEmpty}>
                    No choices — this scene flows into the next one.
                </p>
            )}

            {choices.map(choice => (
                <div key={choice.id} className={styles.choiceRow}>
                    <input
                        value={choice.text}
                        placeholder="What the player sees"
                        onChange={e => update(choice.id, { text: e.target.value })}
                    />
                    <select
                        value={choice.targetSceneId}
                        onChange={e => update(choice.id, { targetSceneId: e.target.value })}
                    >
                        {scenes.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                    </select>
                    <input
                        value={choice.setsFlag ?? ''}
                        placeholder="sets flag"
                        onChange={e => update(choice.id, { setsFlag: e.target.value || undefined })}
                    />
                    <input
                        value={choice.requiresFlag ?? ''}
                        placeholder="needs flag"
                        onChange={e => update(choice.id, { requiresFlag: e.target.value || undefined })}
                    />
                    <button type="button" onClick={() => remove(choice.id)} aria-label="Remove choice">
                        ×
                    </button>
                </div>
            ))}

            <button type="button" onClick={add}>Add choice</button>
        </div>
    );
}
```

Add the import at the top of the file:

```tsx
import type { VNChoice } from '@/lib/visualNovel';
```

- [ ] **Step 3: Render it**

Render `<ChoicesStrip>` directly beneath where `editorSlot` is placed in the
component's returned JSX. The guard matters: `activeScene` is `null` while the
binder is on "all" or "cover", and a choice needs a scene to belong to.

```tsx
{activeScene && (
    <ChoicesStrip
        scene={activeScene}
        scenes={projectScenes}
        onChange={choices => updateScene(activeScene.id, { choices })}
    />
)}
```

Reuse the existing `projectScenes` and `activeScene` — do not add new selectors.

- [ ] **Step 4: Add the styles**

In `src/components/editor/WritingDesk.module.css`, append:

```css
.choicesStrip {
    border-top: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.12));
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.choicesEmpty {
    margin: 0;
    opacity: 0.6;
    font-size: 0.85rem;
}

.choiceRow {
    display: grid;
    grid-template-columns: 2fr 1.5fr 1fr 1fr auto;
    gap: 0.5rem;
    align-items: center;
}
```

- [ ] **Step 5: Verify in the browser**

Start the preview, create a project with the Visual Novel type, add two scenes, and add a choice on the first pointing at the second. Confirm the choice persists after a reload.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx \
        src/components/editor/WritingDesk.module.css
git commit -m "feat: edit scene choices in the visual novel zone"
```

---

### Task 11: Export button and warnings

**Files:**
- Modify: `src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx`

- [ ] **Step 1: Add the export control**

Add the imports:

```tsx
import { exportAsRenpy } from '@/lib/export';
import { validateVisualNovel } from '@/lib/visualNovel';
import { worldKeyForProject, worldKeyForEntity } from '@/lib/worldKey';
```

Inside the main component, select the shelf's cast using the pattern already used by `CharacterStateRenderer.tsx`:

```tsx
const project = useWorkspaceStore(s => s.projects.find(p => p.id === s.activeProjectId));
const castNames = useWorkspaceStore(useShallow(s =>
    s.entities
        .filter(e => worldKeyForEntity(e) === worldKeyForProject(project) && e.type === 'character')
        .map(e => e.name),
));
```

- [ ] **Step 2: Render the button and warnings**

Inside `ChoicesStrip`'s parent, beneath the strip:

```tsx
{(() => {
    const issues = validateVisualNovel(projectScenes);
    return (
        <div className={styles.exportBar}>
            <button
                type="button"
                onClick={() => exportAsRenpy(projectScenes, castNames, project?.name ?? 'visual-novel')}
            >
                Export to Ren'Py
            </button>
            {issues.length > 0 && (
                <ul className={styles.exportIssues}>
                    {issues.map((issue, i) => <li key={i}>{issue.message}</li>)}
                </ul>
            )}
        </div>
    );
})()}
```

Warnings never block the export — the button stays enabled.

- [ ] **Step 3: Add the styles**

Append to `src/components/editor/WritingDesk.module.css`:

```css
.exportBar {
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.exportIssues {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.8rem;
    opacity: 0.75;
}
```

- [ ] **Step 4: Verify end to end**

Start the preview. In a Visual Novel project with two scenes and one choice between them, click **Export to Ren'Py**. Open the downloaded `.rpy` in a text editor and confirm:

- It opens with the `# Generated by LoreCanvas` header
- Every `label` uses underscores, never hyphens
- The `menu:` block is indented 4 spaces, choice strings 8, choice bodies 12
- The last scene ends in `return`

Then delete the target scene and confirm a broken-jump warning appears.

Run: `npm test`
Expected: PASS, all suites.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx \
        src/components/editor/WritingDesk.module.css
git commit -m "feat: export a visual novel to Ren'Py from the writing zone"
```

---

## Done when

- `npm test` passes, including 29 tests in `renpyExport.test.ts` and 9 in `visualNovel.test.ts`
- `npx tsc --noEmit` exits 0
- Creating a project offers **Visual Novel** as a fifth work type
- A scene's choices persist across a reload
- Export downloads a `.rpy` whose labels contain no hyphens and whose final scene ends in `return`

## Deferred (spec non-goals — do not build these)

Assets (`scene bg`, `show`, `play music`), numeric variables, re-import of `.rpy`, full Ren'Py project generation, the graph map view, and `call`/`return` with local labels.
