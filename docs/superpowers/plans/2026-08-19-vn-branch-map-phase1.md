# Visual Novel Branch Map — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data model behind the visual novel branch map — declared flags with booleans and counters, a block model, and an adapter that turns blocks back into the flat scene list the existing Ren'Py exporter already eats.

**Architecture:** All pure leaf modules, no UI. A block is a `Document` holding `Scene`s; choices live on the block and target another block. `flattenBlocksToScenes` puts each block's choices on its last scene and resolves targets to first scenes, so scenes inside a block chain via the fall-through rule that already exists. Only flag emission inside `renpyExport.ts` is rewritten.

**Tech Stack:** TypeScript, Vitest (jsdom), Zustand 5.

**Spec:** `docs/superpowers/specs/2026-08-19-visual-novel-branch-map-design.md`

---

## Context you need before starting

**You cannot run the generated output.** There is no Ren'Py SDK on this machine. The tests are the only safety net. Two bugs already reached `main` in this feature area — a speaker alias emitting the literal string `undefined`, and a flag name with a space producing `default met bob = False`. Both were invisible without a Ren'Py install. Do not weaken a test because it looks fussy.

**Ren'Py facts this phase depends on:**

- `default x = False` / `default x = 0` declares state. The docs recommend `default` for every variable that changes, so an old save cannot leak values into a new game.
- `$ x = True` and `$ x += 1` are inline Python statements.
- A menu choice may carry a guard: `"Kiss her" if mara_trust >= 3:`.
- Flag names are Python identifiers — no spaces, no hyphens, cannot lead with a digit.

**Run tests with:** `npm test` (single run). One file: `npx vitest run src/lib/vnFlags.test.ts`.

**Baseline before you start:** 267 tests across 33 files, `npx tsc --noEmit` exits 0.

---

## File Structure

**New**

| File | Responsibility |
|---|---|
| `src/lib/vnFlags.ts` | `VNFlag` / `VNEffect` / `VNCondition` and the pure functions that turn them into Ren'Py fragments. |
| `src/lib/vnFlags.test.ts` | Every row of the emission table. |
| `src/lib/vnBlocks.ts` | `VNBlock` / `VNBlockChoice` and `flattenBlocksToScenes`. |
| `src/lib/vnBlocks.test.ts` | Adapter behaviour, including the awkward shapes. |

**Modified**

| File | Change |
|---|---|
| `src/lib/visualNovel.ts` | `VNChoice` swaps `setsFlag`/`requiresFlag` for `effects`/`condition`; `collectFlags` removed; `validateVisualNovel` updated. |
| `src/lib/visualNovel.test.ts` | Follows those changes. |
| `src/lib/renpyExport.ts` | `buildRenpyScript` takes a flag registry; flag emission rewritten. |
| `src/lib/renpyExport.test.ts` | Flag tests follow; counter tests added. |
| `src/lib/export.ts` | `exportAsRenpy` passes the registry through. |
| `src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx` | The two free-text flag inputs are removed — they are exactly what this phase replaces. |
| `src/store/workspaceStore.ts` | `Document.choices`, `Project.vnFlags`. |

**A warning about Task 2.** It is a migration and touches six files at once. That is deliberate: `VNChoice` is consumed by the validator, the exporter, the download wrapper and the writing zone, so a partial change leaves the build red. Work through its steps in order and commit once, green.

---

### Task 1: Flag types and Ren'Py emission

**Files:**
- Create: `src/lib/vnFlags.ts`
- Create: `src/lib/vnFlags.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/vnFlags.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    formatDefault, formatEffect, formatCondition, type VNFlag,
} from './vnFlags';

const bool = (name: string, initial = 0): VNFlag =>
    ({ id: `f-${name}`, name, kind: 'bool', initial });
const counter = (name: string, initial = 0): VNFlag =>
    ({ id: `f-${name}`, name, kind: 'counter', initial });

describe('formatDefault', () => {
    it('declares a boolean as False when it starts off', () => {
        expect(formatDefault(bool('told_truth'), 'told_truth'))
            .toBe('default told_truth = False');
    });

    it('declares a boolean as True when it starts on', () => {
        expect(formatDefault(bool('has_key', 1), 'has_key'))
            .toBe('default has_key = True');
    });

    it('declares a counter with its numeric start', () => {
        expect(formatDefault(counter('mara_trust'), 'mara_trust'))
            .toBe('default mara_trust = 0');
    });

    it('declares a counter that does not start at zero', () => {
        expect(formatDefault(counter('hp', 10), 'hp')).toBe('default hp = 10');
    });

    it('uses the identifier it is given, not the flag name', () => {
        // The caller has already slugified 'met bob' into 'met_bob'.
        expect(formatDefault(bool('met bob'), 'met_bob'))
            .toBe('default met_bob = False');
    });
});

describe('formatEffect', () => {
    it('sets a boolean', () => {
        expect(formatEffect({ flagId: 'x', op: 'set' }, 'told_truth'))
            .toBe('$ told_truth = True');
    });

    it('clears a boolean', () => {
        expect(formatEffect({ flagId: 'x', op: 'clear' }, 'told_truth'))
            .toBe('$ told_truth = False');
    });

    it('adds to a counter', () => {
        expect(formatEffect({ flagId: 'x', op: 'add', value: 2 }, 'mara_trust'))
            .toBe('$ mara_trust += 2');
    });

    it('subtracts by adding a negative', () => {
        expect(formatEffect({ flagId: 'x', op: 'add', value: -1 }, 'mara_trust'))
            .toBe('$ mara_trust += -1');
    });

    it('defaults an add with no value to 1', () => {
        expect(formatEffect({ flagId: 'x', op: 'add' }, 'mara_trust'))
            .toBe('$ mara_trust += 1');
    });
});

describe('formatCondition', () => {
    it('tests a boolean is set', () => {
        expect(formatCondition({ flagId: 'x', op: 'is' }, 'told_truth'))
            .toBe('told_truth');
    });

    it('tests a boolean is not set', () => {
        expect(formatCondition({ flagId: 'x', op: 'not' }, 'told_truth'))
            .toBe('not told_truth');
    });

    it('tests a counter floor', () => {
        expect(formatCondition({ flagId: 'x', op: 'atLeast', value: 3 }, 'mara_trust'))
            .toBe('mara_trust >= 3');
    });

    it('tests a counter ceiling', () => {
        expect(formatCondition({ flagId: 'x', op: 'atMost', value: 0 }, 'mara_trust'))
            .toBe('mara_trust <= 0');
    });

    it('defaults a missing comparison value rather than emitting undefined', () => {
        expect(formatCondition({ flagId: 'x', op: 'atLeast' }, 'n')).toBe('n >= 1');
        expect(formatCondition({ flagId: 'x', op: 'atMost' }, 'n')).toBe('n <= 0');
    });
});

```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/vnFlags.test.ts`
Expected: FAIL — cannot resolve `./vnFlags`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/vnFlags.ts`:

```ts
/**
 * Declared story state for visual novels — the flags a branch map tracks, and
 * the Ren'Py fragments they turn into. LEAF MODULE (no store, no React).
 *
 * Flags are declared rather than typed, and every effect and condition is
 * assembled from a registry entry plus an operator. Nothing here accepts a
 * free-text expression: the generated file cannot be compiled on this machine,
 * so it has to be valid by construction.
 *
 * These functions take the flag's already-slugified identifier rather than
 * deriving it, so this module stays a leaf and the slugifier can live beside
 * the label logic in renpyExport.
 */

export type VNFlagKind = 'bool' | 'counter';

export interface VNFlag {
    id: string;
    /** Author-facing name. Slugified into an identifier before emission. */
    name: string;
    kind: VNFlagKind;
    /** Starting value. Booleans use 0 for off, anything else for on. */
    initial: number;
}

/** What a choice does to state when it is taken. */
export interface VNEffect {
    flagId: string;
    op: 'set' | 'clear' | 'add';
    /** Used by 'add'. Negative subtracts. Defaults to 1. */
    value?: number;
}

/** Whether a choice is offered at all. */
export interface VNCondition {
    flagId: string;
    op: 'is' | 'not' | 'atLeast' | 'atMost';
    /** Used by 'atLeast' and 'atMost'. */
    value?: number;
}

/**
 * The `default` line declaring a flag. Ren'Py's docs ask for one per variable
 * that changes, so a value from an old save cannot leak into a new game.
 */
export function formatDefault(flag: VNFlag, identifier: string): string {
    const value = flag.kind === 'bool'
        ? (flag.initial ? 'True' : 'False')
        : `${flag.initial}`;
    return `default ${identifier} = ${value}`;
}

/** The inline Python statement a choice runs when taken. */
export function formatEffect(effect: VNEffect, identifier: string): string {
    switch (effect.op) {
        case 'set': return `$ ${identifier} = True`;
        case 'clear': return `$ ${identifier} = False`;
        case 'add': return `$ ${identifier} += ${effect.value ?? 1}`;
    }
}

/** The guard expression for a menu choice, without the leading `if`. */
export function formatCondition(condition: VNCondition, identifier: string): string {
    switch (condition.op) {
        case 'is': return identifier;
        case 'not': return `not ${identifier}`;
        case 'atLeast': return `${identifier} >= ${condition.value ?? 1}`;
        case 'atMost': return `${identifier} <= ${condition.value ?? 0}`;
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/vnFlags.test.ts`
Expected: PASS — 15 tests.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/lib/vnFlags.ts src/lib/vnFlags.test.ts
git commit -m "feat: declared flags with booleans and counters"
```

---

### Task 2: Migrate VNChoice from single flags to effects and conditions

`setsFlag` and `requiresFlag` are single strings and cannot express a counter. They are replaced by `effects[]` and `condition`. Six files reference them, so this task changes all six and commits once, green.

**Files:**
- Modify: `src/lib/visualNovel.ts`
- Modify: `src/lib/visualNovel.test.ts`
- Modify: `src/lib/renpyExport.ts`
- Modify: `src/lib/renpyExport.test.ts`
- Modify: `src/lib/export.ts`
- Modify: `src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx`

- [ ] **Step 1: Change the VNChoice type**

In `src/lib/visualNovel.ts`, add the import and replace the two flag fields:

```ts
import type { VNEffect, VNCondition } from './vnFlags';
```

```ts
export interface VNChoice {
    id: string;
    /** What the player sees. */
    text: string;
    /** Scene this jumps to. */
    targetSceneId: string;
    /** What taking this choice does to story state. */
    effects?: VNEffect[];
    /** Choice is only offered when this holds. */
    condition?: VNCondition;
}
```

- [ ] **Step 2: Delete collectFlags and update the validator**

`collectFlags` derived flag names from choices. Flags are now declared in a registry, so it has no job. Delete the whole function from `src/lib/visualNovel.ts`.

Then replace the flag half of `validateVisualNovel`. The `setFlags` set becomes a set of flag ids that some effect writes to, and the unsatisfiable check reads `condition`:

```ts
    const targeted = new Set<string>();
    const writtenFlags = new Set<string>();
    for (const scene of ordered) {
        for (const choice of scene.choices ?? []) {
            targeted.add(choice.targetSceneId);
            for (const effect of choice.effects ?? []) writtenFlags.add(effect.flagId);
        }
    }
```

and inside the per-choice loop:

```ts
            if (choice.condition && !writtenFlags.has(choice.condition.flagId)) {
                issues.push({
                    kind: 'unsatisfiable-flag', sceneId: scene.id,
                    message: `“${choice.text}” depends on state that nothing sets.`,
                });
            }
```

- [ ] **Step 3: Update visualNovel.test.ts**

Remove the entire `describe('collectFlags', ...)` block and its import of `collectFlags`.

In the `validateVisualNovel` block, replace the unsatisfiable-flag test with:

```ts
    it('reports a choice depending on state nothing ever sets', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Recall', targetSceneId: 'a',
                  condition: { flagId: 'f-never', op: 'is' } },
            ] },
        ]);
        expect(issues.some(i => i.kind === 'unsatisfiable-flag')).toBe(true);
    });

    it('accepts a condition whose flag some effect writes', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Tell her', targetSceneId: 'b',
                  effects: [{ flagId: 'f-truth', op: 'set' }] },
            ] },
            { id: 'b', title: 'B', content: '', order: 1, choices: [
                { id: 'c2', text: 'Recall', targetSceneId: 'b',
                  condition: { flagId: 'f-truth', op: 'is' } },
            ] },
        ]);
        expect(issues.some(i => i.kind === 'unsatisfiable-flag')).toBe(false);
    });
```

The other tests in that block use no flags and need no change.

- [ ] **Step 4: Rewrite flag emission in renpyExport.ts**

Replace the `collectFlags` import with the flag helpers:

```ts
import type { VNScene } from './visualNovel';
import {
    formatDefault, formatEffect, formatCondition, type VNFlag,
} from './vnFlags';
```

Give `buildRenpyScript` a fourth parameter with a default, so existing three-argument calls keep compiling:

```ts
export function buildRenpyScript(
    scenes: VNScene[],
    castNames: string[],
    projectName: string,
    flags: VNFlag[] = [],
): string {
```

Replace the line `const flags = collectFlags(ordered);` — it is gone; the registry is now a parameter. Add an identifier lookup beside the alias map:

```ts
    // Flag id → the identifier it is emitted as. Built once so a `default`
    // line and every `$` and `if` that touches the flag always agree.
    const flagNames = new Map(flags.map(f => [f.id, toFlagName(f.name)]));
```

Replace the `default` emission loop:

```ts
    for (const flag of [...flags].sort((a, b) => a.name.localeCompare(b.name))) {
        out.push(formatDefault(flag, flagNames.get(flag.id)!));
    }
    if (flags.length) out.push('');
```

Replace the guard and the effect emission inside the choice loop:

```ts
                const identifier = choice.condition
                    ? flagNames.get(choice.condition.flagId)
                    : undefined;
                const guard = choice.condition && identifier
                    ? ` if ${formatCondition(choice.condition, identifier)}`
                    : '';
                out.push(`${INDENT.repeat(2)}"${escapeRenpyText(choice.text)}"${guard}:`);

                for (const effect of choice.effects ?? []) {
                    const name = flagNames.get(effect.flagId);
                    // A flag deleted from the registry leaves dangling effects.
                    // Skipping beats emitting `$ undefined = True`.
                    if (!name) continue;
                    out.push(`${INDENT.repeat(3)}${formatEffect(effect, name)}`);
                }
```

- [ ] **Step 5: Pass the registry through export.ts**

In `src/lib/export.ts`, add the type import and the parameter:

```ts
import type { VNFlag } from '@/lib/vnFlags';
```

```ts
export function exportAsRenpy(
    scenes: VNScene[],
    castNames: string[],
    projectName: string,
    flags: VNFlag[] = [],
): void {
    const script = buildRenpyScript(scenes, castNames, projectName, flags);
    const safeName = projectName?.trim() || 'visual-novel';
    downloadFile(script, `${slugify(safeName)}.rpy`, 'text/plain');
}
```

- [ ] **Step 6: Remove the free-text flag inputs from the writing zone**

In `src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx`, `ChoicesStrip` has two `<input>` elements bound to `choice.setsFlag` and `choice.requiresFlag`. Those fields no longer exist, so the file will not compile until they go. Delete both inputs:

```tsx
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
```

Then narrow the row grid, which sized five columns:

```css
.choiceRow {
    display: grid;
    grid-template-columns: 2fr 1.5fr auto;
    gap: 0.5rem;
    align-items: center;
}
```

in `src/components/editor/WritingDesk.module.css`. Do not add flag controls back — dropdown-based ones arrive in Phase 2. Free text is what this phase exists to remove.

- [ ] **Step 7: Update the exporter's flag tests**

In `src/lib/renpyExport.test.ts`, add to the imports:

```ts
import type { VNFlag } from './vnFlags';
```

Replace the golden test's fixture and expectation. The `twoBranch` fixture's choices become:

```ts
            choices: [
                { id: 'c1', text: 'Say yes.', targetSceneId: 'partners',
                  effects: [{ flagId: 'f-agreed', op: 'set' }] },
                { id: 'c2', text: 'Ask what that means.', targetSceneId: 'explain' },
            ],
```

and the third scene's choice becomes:

```ts
        { id: 'explain', title: 'Explain', order: 1, content: 'Me: It is a kind of game.', choices: [
            { id: 'c3', text: 'Say yes now.', targetSceneId: 'partners',
              condition: { flagId: 'f-agreed', op: 'is' } },
        ] },
```

Add the registry above the fixture:

```ts
    const AGREED: VNFlag[] = [
        { id: 'f-agreed', name: 'agreed', kind: 'bool', initial: 0 },
    ];
```

and pass it in the golden assertion:

```ts
        expect(buildRenpyScript(twoBranch, ['Sylvie', 'Me'], 'Lighthouse Summer', AGREED)).toBe(
```

The expected string is **unchanged** — `default agreed = False`, `$ agreed = True` and `"Say yes now." if agreed:` all still come out identically. That is the point of the refactor: the output is the same, the model behind it is richer.

Replace the old "emits flag names as identifiers" test with:

```ts
    it('emits flag names as identifiers, whatever the writer typed', () => {
        const script = buildRenpyScript([{
            id: 'a', title: 'A', order: 0, content: 'Hi.',
            choices: [
                { id: 'c1', text: 'Go', targetSceneId: 'a',
                  effects: [{ flagId: 'f1', op: 'set' }] },
                { id: 'c2', text: 'Recall', targetSceneId: 'a',
                  condition: { flagId: 'f1', op: 'is' } },
            ],
        }], [], 'X', [{ id: 'f1', name: 'met bob', kind: 'bool', initial: 0 }]);
        expect(script).toContain('default met_bob = False');
        expect(script).toContain('$ met_bob = True');
        expect(script).toContain('"Recall" if met_bob:');
        expect(script).not.toContain('met bob');
    });

    it('emits counter state as numbers, not booleans', () => {
        const script = buildRenpyScript([{
            id: 'a', title: 'A', order: 0, content: 'Hi.',
            choices: [
                { id: 'c1', text: 'Be kind', targetSceneId: 'a',
                  effects: [{ flagId: 'f1', op: 'add', value: 1 }] },
                { id: 'c2', text: 'Kiss her', targetSceneId: 'a',
                  condition: { flagId: 'f1', op: 'atLeast', value: 3 } },
            ],
        }], [], 'X', [{ id: 'f1', name: 'mara_trust', kind: 'counter', initial: 0 }]);
        expect(script).toContain('default mara_trust = 0');
        expect(script).toContain('$ mara_trust += 1');
        expect(script).toContain('"Kiss her" if mara_trust >= 3:');
    });

    it('skips an effect whose flag was deleted rather than emitting undefined', () => {
        const script = buildRenpyScript([{
            id: 'a', title: 'A', order: 0, content: 'Hi.',
            choices: [
                { id: 'c1', text: 'Go', targetSceneId: 'a',
                  effects: [{ flagId: 'f-deleted', op: 'set' }] },
            ],
        }], [], 'X', []);
        expect(script).not.toContain('undefined');
        expect(script).toContain('"Go":');
    });
```

- [ ] **Step 8: Run everything**

Run: `npm test`
Expected: all pass. Count moves from 267 to about 285 — three `collectFlags` tests removed, the new flag tests added.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

If `tsc` still reports `setsFlag` or `requiresFlag` anywhere, that file was missed — search with `grep -rn "setsFlag\|requiresFlag" src/` and fix it.

- [ ] **Step 9: Commit**

```bash
git add src/lib/visualNovel.ts src/lib/visualNovel.test.ts src/lib/renpyExport.ts src/lib/renpyExport.test.ts src/lib/export.ts src/components/editor/desk/widgets/zones/VisualNovelWritingZone.tsx src/components/editor/WritingDesk.module.css
git commit -m "refactor: choices carry flag effects and conditions"
```

---

### Task 3: The block model and the adapter

**Files:**
- Create: `src/lib/vnBlocks.ts`
- Create: `src/lib/vnBlocks.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/vnBlocks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { flattenBlocksToScenes, type VNBlock } from './vnBlocks';
import type { VNScene } from './visualNovel';

const block = (id: string, order: number, choices: VNBlock['choices'] = []): VNBlock =>
    ({ id, title: id, order, choices });

const scene = (id: string, order: number): VNScene =>
    ({ id, title: id, content: `${id} text`, order });

describe('flattenBlocksToScenes', () => {
    it('puts a block\'s choices on its last scene', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Go', targetBlockId: 'b2' }]),
            block('b2', 1),
        ];
        const scenes = new Map([
            ['b1', [scene('s1', 0), scene('s2', 1)]],
            ['b2', [scene('s3', 0)]],
        ]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out.find(s => s.id === 's1')!.choices ?? []).toEqual([]);
        expect(out.find(s => s.id === 's2')!.choices).toHaveLength(1);
    });

    it('resolves a target block to that block\'s first scene', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Go', targetBlockId: 'b2' }]),
            block('b2', 1),
        ];
        const scenes = new Map([
            ['b1', [scene('s1', 0)]],
            ['b2', [scene('s2', 0), scene('s3', 1)]],
        ]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out.find(s => s.id === 's1')!.choices![0].targetSceneId).toBe('s2');
    });

    it('renumbers scene order contiguously across blocks', () => {
        const blocks = [block('b1', 0), block('b2', 1)];
        const scenes = new Map([
            ['b1', [scene('s1', 7), scene('s2', 9)]],
            ['b2', [scene('s3', 2)]],
        ]);
        expect(flattenBlocksToScenes(blocks, scenes).map(s => s.order))
            .toEqual([0, 1, 2]);
    });

    it('orders blocks by their own order, not map insertion', () => {
        const blocks = [block('late', 5), block('early', 1)];
        const scenes = new Map([
            ['late', [scene('s2', 0)]],
            ['early', [scene('s1', 0)]],
        ]);
        expect(flattenBlocksToScenes(blocks, scenes).map(s => s.id))
            .toEqual(['s1', 's2']);
    });

    it('carries effects and conditions through unchanged', () => {
        const blocks = [
            block('b1', 0, [{
                id: 'c1', text: 'Go', targetBlockId: 'b2',
                effects: [{ flagId: 'f1', op: 'add', value: 2 }],
                condition: { flagId: 'f2', op: 'atLeast', value: 3 },
            }]),
            block('b2', 1),
        ];
        const scenes = new Map([['b1', [scene('s1', 0)]], ['b2', [scene('s2', 0)]]]);
        const choice = flattenBlocksToScenes(blocks, scenes)
            .find(s => s.id === 's1')!.choices![0];

        expect(choice.effects).toEqual([{ flagId: 'f1', op: 'add', value: 2 }]);
        expect(choice.condition).toEqual({ flagId: 'f2', op: 'atLeast', value: 3 });
    });

    it('handles a single-scene block, where last is also first', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Go', targetBlockId: 'b1' }]),
        ];
        const scenes = new Map([['b1', [scene('s1', 0)]]]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out).toHaveLength(1);
        expect(out[0].choices![0].targetSceneId).toBe('s1');
    });

    it('skips an empty block and re-points choices past it', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Go', targetBlockId: 'empty' }]),
            block('empty', 1),
            block('b3', 2),
        ];
        const scenes = new Map([
            ['b1', [scene('s1', 0)]],
            ['empty', []],
            ['b3', [scene('s3', 0)]],
        ]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out.map(s => s.id)).toEqual(['s1', 's3']);
        expect(out[0].choices![0].targetSceneId).toBe('s3');
    });

    it('leaves the target empty when nothing follows an empty block', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Go', targetBlockId: 'empty' }]),
            block('empty', 1),
        ];
        const scenes = new Map([['b1', [scene('s1', 0)]], ['empty', []]]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out[0].choices![0].targetSceneId).toBe('');
    });

    it('returns nothing when every block is empty', () => {
        const blocks = [block('b1', 0), block('b2', 1)];
        const scenes = new Map([['b1', []], ['b2', []]]);
        expect(flattenBlocksToScenes(blocks, scenes)).toEqual([]);
    });

    it('supports convergence — two blocks targeting the same third', () => {
        const blocks = [
            block('b1', 0, [{ id: 'c1', text: 'Left', targetBlockId: 'b3' }]),
            block('b2', 1, [{ id: 'c2', text: 'Right', targetBlockId: 'b3' }]),
            block('b3', 2),
        ];
        const scenes = new Map([
            ['b1', [scene('s1', 0)]],
            ['b2', [scene('s2', 0)]],
            ['b3', [scene('s3', 0)]],
        ]);
        const out = flattenBlocksToScenes(blocks, scenes);

        expect(out.find(s => s.id === 's1')!.choices![0].targetSceneId).toBe('s3');
        expect(out.find(s => s.id === 's2')!.choices![0].targetSceneId).toBe('s3');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/vnBlocks.test.ts`
Expected: FAIL — cannot resolve `./vnBlocks`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/vnBlocks.ts`:

```ts
/**
 * Blocks — the beats a visual novel branch map is drawn from, and the adapter
 * that turns them back into the flat scene list the Ren'Py exporter eats.
 * LEAF MODULE (no store, no React).
 *
 * A block is a run of scenes that plays straight through, ending at a decision.
 * Storing choices on the block rather than a scene means adding a scene to a
 * beat cannot move the decision to the wrong place.
 *
 * The exporter is untouched by all of this. Scenes inside a block chain by
 * themselves, because a scene with no choices already emits a jump to the next
 * scene by order — so flattening only has to put each block's choices on its
 * last scene and point them at the target block's first.
 */

import type { VNChoice, VNScene } from './visualNovel';
import type { VNEffect, VNCondition } from './vnFlags';

/** A choice as drafted on the map: it targets a block, not a scene. */
export interface VNBlockChoice {
    id: string;
    text: string;
    targetBlockId: string;
    effects?: VNEffect[];
    condition?: VNCondition;
}

/** A beat on the branch map. Backed by a Document in the store. */
export interface VNBlock {
    id: string;
    title: string;
    order: number;
    choices?: VNBlockChoice[];
}

/**
 * Blocks and their scenes as one ordered scene list.
 *
 * Empty blocks are drafting placeholders rather than story beats, so they are
 * dropped and anything aiming at one is re-pointed at the next block that has
 * scenes. A choice with nowhere left to go gets an empty target, which
 * buildRenpyScript already renders as a comment and `return`.
 */
export function flattenBlocksToScenes(
    blocks: VNBlock[],
    scenesByBlock: Map<string, VNScene[]>,
): VNScene[] {
    const ordered = [...blocks].sort((a, b) => a.order - b.order);

    const scenesFor = (blockId: string): VNScene[] =>
        [...(scenesByBlock.get(blockId) ?? [])].sort((a, b) => a.order - b.order);

    // Block id → the scene a jump into it should land on. An empty block
    // forwards to whatever comes next, so a placeholder never breaks a branch.
    const entryScene = new Map<string, string>();
    let carried: string[] = [];
    for (const b of ordered) {
        const first = scenesFor(b.id)[0];
        if (first) {
            entryScene.set(b.id, first.id);
            for (const pending of carried) entryScene.set(pending, first.id);
            carried = [];
        } else {
            carried.push(b.id);
        }
    }
    for (const pending of carried) entryScene.set(pending, '');

    const out: VNScene[] = [];
    let order = 0;

    for (const b of ordered) {
        const scenes = scenesFor(b.id);
        if (!scenes.length) continue;

        scenes.forEach((scene, index) => {
            const isLast = index === scenes.length - 1;
            const choices: VNChoice[] | undefined = isLast && b.choices?.length
                ? b.choices.map(c => ({
                    id: c.id,
                    text: c.text,
                    targetSceneId: entryScene.get(c.targetBlockId) ?? '',
                    effects: c.effects,
                    condition: c.condition,
                }))
                : undefined;

            out.push({ ...scene, order: order++, choices });
        });
    }

    return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/vnBlocks.test.ts`
Expected: PASS — 10 tests.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/lib/vnBlocks.ts src/lib/vnBlocks.test.ts
git commit -m "feat: flatten branch-map blocks into the exporter's scene list"
```

---

### Task 4: Store fields and an end-to-end golden test

**Files:**
- Modify: `src/store/workspaceStore.ts`
- Modify: `src/lib/vnBlocks.test.ts`

- [ ] **Step 1: Add the store fields**

In `src/store/workspaceStore.ts`, add the imports beside the existing `VNChoice` one:

```ts
import type { VNBlockChoice } from '@/lib/vnBlocks';
import type { VNFlag } from '@/lib/vnFlags';
```

Add one field to `Document`:

```ts
    /** Visual novel projects only: the decision this beat ends on. */
    choices?: VNBlockChoice[];
```

Add one field to `Project`:

```ts
    /** Visual novel projects only: declared story state for the branch map. */
    vnFlags?: VNFlag[];
```

Both are optional and ignored by every other work type. No migration is needed — the Supabase schema stores the whole workspace as a single `jsonb` blob.

- [ ] **Step 2: Write the end-to-end golden test**

This is the proof that Phase 1 works: blocks and flags in, a complete `.rpy` out. Append to `src/lib/vnBlocks.test.ts`, adding these imports at the top:

```ts
import { buildRenpyScript } from './renpyExport';
import type { VNFlag } from './vnFlags';
```

```ts
describe('blocks through to Ren\'Py', () => {
    it('turns a two-route map with a counter into a complete script', () => {
        const blocks: VNBlock[] = [
            { id: 'open', title: 'Opening Night', order: 0, choices: [
                { id: 'c1', text: 'Ask her name.', targetBlockId: 'bold',
                  effects: [{ flagId: 'f-trust', op: 'add', value: 1 }] },
                { id: 'c2', text: 'Keep quiet.', targetBlockId: 'shy' },
            ] },
            { id: 'bold', title: 'Bold', order: 1, choices: [
                { id: 'c3', text: 'Kiss her.', targetBlockId: 'end',
                  condition: { flagId: 'f-trust', op: 'atLeast', value: 1 } },
            ] },
            { id: 'shy', title: 'Shy', order: 2, choices: [
                { id: 'c4', text: 'Go home.', targetBlockId: 'end' },
            ] },
            { id: 'end', title: 'Ending', order: 3 },
        ];

        const scenes = new Map<string, VNScene[]>([
            ['open', [
                { id: 's1', title: 'Arrival', content: 'Rain off the water.', order: 0 },
                { id: 's2', title: 'The Bar', content: 'Mara: Evening.', order: 1 },
            ]],
            ['bold', [{ id: 's3', title: 'Bold', content: 'Mara: Bold of you.', order: 0 }]],
            ['shy', [{ id: 's4', title: 'Shy', content: 'The silence held.', order: 0 }]],
            ['end', [{ id: 's5', title: 'End', content: 'Mara: Goodnight.', order: 0 }]],
        ]);

        const flags: VNFlag[] = [
            { id: 'f-trust', name: 'mara_trust', kind: 'counter', initial: 0 },
        ];

        const script = buildRenpyScript(
            flattenBlocksToScenes(blocks, scenes), ['Mara'], 'Lighthouse', flags);

        expect(script).toBe(
`# Generated by LoreCanvas — Lighthouse
# Drop this file into your Ren'Py project's game/ folder.

define m = Character("Mara")

default mara_trust = 0

label start:
    jump arrival

label arrival:
    "Rain off the water."
    jump the_bar

label the_bar:
    m "Evening."

    menu:
        "Ask her name.":
            $ mara_trust += 1
            jump bold

        "Keep quiet.":
            jump shy

label bold:
    m "Bold of you."

    menu:
        "Kiss her." if mara_trust >= 1:
            jump end

label shy:
    "The silence held."

    menu:
        "Go home.":
            jump end

label end:
    m "Goodnight."
    return
`);
    });
});
```

Note what this proves: the two scenes inside the `open` block became two labels chaining with `jump the_bar`, and the block's menu landed on the second one. That chaining is the existing fall-through rule doing the work, with no exporter change.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/lib/vnBlocks.test.ts`
Expected: PASS — 11 tests.

If the golden assertion fails, read the diff carefully. Ren'Py indentation is significant and the expected string is the specification. Fix `flattenBlocksToScenes`, never the expected output — unless you are confident the expectation itself contradicts the Ren'Py rules at the top of this plan, in which case stop and report it rather than editing the test to match your code.

- [ ] **Step 4: Run everything**

Run: `npm test`
Expected: all pass — about 296 tests.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/store/workspaceStore.ts src/lib/vnBlocks.test.ts
git commit -m "feat: store branch-map blocks and the flag registry"
```

---

## Done when

- `npm test` passes at roughly 296 tests across 35 files
- `npx tsc --noEmit` exits 0
- `grep -rn "setsFlag\|requiresFlag" src/` returns nothing
- A block map with a counter gate produces a complete, correctly indented `.rpy` through `flattenBlocksToScenes` → `buildRenpyScript`

## Not in this phase

The block widget, the flags panel, the edge layer and drag-to-connect are Phases 2 and 3. Nothing in this plan renders anything. The writing zone loses its two free-text flag inputs and gains no replacement until Phase 2 — that is intended, not an oversight.
