# Visual Novel Branch Map — Phases 2 & 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 1 data model into a working branch map on the Draft Table — blocks you can edit, flags you can declare, choices you can wire, and curves drawn between them.

**Architecture:** A block is a `vnBlock` widget whose `content` is just `{ blockId }`; the `Document` it names holds the title and choices, and its `Scene`s are the beats inside. The renderer creates its own beat when it has none, so both widget-creation paths in `WritingDesk.tsx` work untouched. Edges are an SVG layer inside the same transformed div the widgets live in, so they need no coordinate conversion.

**Tech Stack:** TypeScript, React 19, Next.js 16, Zustand 5, Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-08-19-visual-novel-branch-map-design.md`

---

## Context you need before starting

**Phase 1 is done and green.** These exist and are tested — use them, do not reimplement:

| Thing | Where | Shape |
|---|---|---|
| `VNFlag` | `src/lib/vnFlags.ts` | `{ id, name, kind: 'bool'\|'counter', initial }` |
| `VNEffect` | `src/lib/vnFlags.ts` | `{ flagId, op: 'set'\|'clear'\|'add', value? }` |
| `VNCondition` | `src/lib/vnFlags.ts` | `{ flagId, op: 'is'\|'not'\|'atLeast'\|'atMost', value? }` |
| `VNBlockChoice` | `src/lib/vnBlocks.ts` | `{ id, text, targetBlockId, effects?, condition? }` |
| `Document.choices` | `workspaceStore.ts` | `VNBlockChoice[]` |
| `Project.vnFlags` | `workspaceStore.ts` | `VNFlag[]` |

**Store actions, exact signatures:**

```ts
addDocument: (document: Document) => void
updateDocument: (id: string, updates: Partial<Omit<Document, 'id'|'projectId'|'createdAt'>>) => void
updateProject: (id: string, updates: Partial<Omit<Project, 'id'|'createdAt'>>) => void
```

**How the canvas works** — read before touching anything visual:

- Widgets are `DeskWidget { id, type, x, y, width, height, content, dock?, scope?, scopeId? }`.
- `WritingDesk.tsx:636` renders them inside one div carrying `transform: translate(offsetX, offsetY) scale(zoom)`, each absolutely positioned at `left: w.x, top: w.y`.
- **Anything else inside that div shares the widget coordinate space.** The edge layer in Task 5 draws straight from `w.x`/`w.y` with no conversion. This is the most important fact in this plan.
- `WidgetRenderer.tsx:58` is a `switch (widget.type)`.
- `DEFAULT_DIMS` in `deskConstants.ts` is `Record<DeskWidgetType, {w,h}>` — adding to the type union makes missing entries a **compile error**, which is how you will be reminded.
- `PALETTE_ITEMS` in `deskConstants.ts` lists what the palette offers.
- A renderer gets `{ content, onChange }` and may read the store directly — `CharacterStateRenderer.tsx` is the precedent.

**Why the renderer seeds its own beat.** There are two places a widget gets created — `addAtCenter` (~line 551) and the palette drop handler (~line 471) — and both build `content: {}`. Rather than patch both, the block renderer creates its beat whenever `content.blockId` is missing. One code path, and it also covers blocks seeded by the method library.

**Block ordering.** `Document` has no `order` field. Blocks order by `createdAt`, matching how `StoryWritingZone` sorts `projectDocs`. The first block created is the story's entry point.

**Run tests with:** `npm test`. **Baseline: 295 tests across 35 files, `npx tsc --noEmit` exits 0.**

---

## File Structure

**New**

| File | Responsibility |
|---|---|
| `src/lib/vnBlockView.ts` | Pure label helpers for effects/conditions as shown on a block. |
| `src/lib/vnBlockView.test.ts` | Those helpers. |
| `src/components/editor/desk/widgets/VNBlockRenderer.tsx` | The block widget. |
| `src/components/editor/desk/widgets/VNFlagsRenderer.tsx` | The flag registry panel. |
| `src/components/editor/desk/widgets/VNEdgeLayer.tsx` | SVG curves between blocks. |

**Modified**

| File | Change |
|---|---|
| `src/store/workspaceStore.ts` | `DeskWidgetType` gains `'vnBlock'`, `'vnFlags'`. |
| `src/components/editor/desk/deskConstants.ts` | `DEFAULT_DIMS` + `PALETTE_ITEMS` entries. |
| `src/components/editor/desk/widgets/WidgetRenderer.tsx` | Two dispatch cases. |
| `src/lib/writingMethods/draftTypes.ts` | A `visual-novel` draft type. |
| `src/lib/writingMethods/methods/mediums.ts` | The *Visual Novel Branch Map* method. |
| `src/lib/writingMethods/index.ts` | `buildMethodWidgets` special-cases that method. |
| `src/lib/workTypes.ts` + test | Wire `draftTypeId`. |
| `src/components/editor/WritingDesk.tsx` | Render the edge layer (Task 5 only). |
| `src/components/editor/WritingDesk.module.css` | Styles throughout. |

---

# PHASE 2 — a working branch editor

### Task 1: The block widget

**Files:**
- Create: `src/lib/vnBlockView.ts`, `src/lib/vnBlockView.test.ts`
- Create: `src/components/editor/desk/widgets/VNBlockRenderer.tsx`
- Modify: `src/store/workspaceStore.ts`, `src/components/editor/desk/deskConstants.ts`, `src/components/editor/desk/widgets/WidgetRenderer.tsx`, `src/components/editor/WritingDesk.module.css`

- [ ] **Step 1: Write the failing test**

Create `src/lib/vnBlockView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { describeEffect, describeCondition } from './vnBlockView';
import type { VNFlag } from './vnFlags';

const flags: VNFlag[] = [
    { id: 'f1', name: 'told_truth', kind: 'bool', initial: 0 },
    { id: 'f2', name: 'mara_trust', kind: 'counter', initial: 0 },
];

describe('describeEffect', () => {
    it('labels setting a boolean', () => {
        expect(describeEffect({ flagId: 'f1', op: 'set' }, flags)).toBe('+told_truth');
    });

    it('labels clearing a boolean', () => {
        expect(describeEffect({ flagId: 'f1', op: 'clear' }, flags)).toBe('−told_truth');
    });

    it('labels adding to a counter', () => {
        expect(describeEffect({ flagId: 'f2', op: 'add', value: 1 }, flags))
            .toBe('mara_trust +1');
    });

    it('shows a negative add with its sign', () => {
        expect(describeEffect({ flagId: 'f2', op: 'add', value: -2 }, flags))
            .toBe('mara_trust −2');
    });

    it('names a deleted flag rather than rendering undefined', () => {
        expect(describeEffect({ flagId: 'gone', op: 'set' }, flags)).toBe('+(deleted flag)');
    });
});

describe('describeCondition', () => {
    it('labels a boolean test', () => {
        expect(describeCondition({ flagId: 'f1', op: 'is' }, flags)).toBe('needs told_truth');
    });

    it('labels a negated boolean test', () => {
        expect(describeCondition({ flagId: 'f1', op: 'not' }, flags))
            .toBe('needs not told_truth');
    });

    it('labels a counter floor', () => {
        expect(describeCondition({ flagId: 'f2', op: 'atLeast', value: 3 }, flags))
            .toBe('needs mara_trust ≥ 3');
    });

    it('labels a counter ceiling', () => {
        expect(describeCondition({ flagId: 'f2', op: 'atMost', value: 0 }, flags))
            .toBe('needs mara_trust ≤ 0');
    });

    it('names a deleted flag rather than rendering undefined', () => {
        expect(describeCondition({ flagId: 'gone', op: 'is' }, flags))
            .toBe('needs (deleted flag)');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/vnBlockView.test.ts`
Expected: FAIL — cannot resolve `./vnBlockView`.

- [ ] **Step 3: Write the helpers**

Create `src/lib/vnBlockView.ts`:

```ts
/**
 * Short labels for what a choice does to story state, as shown on the branch
 * map. LEAF MODULE (no store, no React).
 *
 * Separate from vnFlags because those emit Ren'Py; these are for a human
 * glancing at a block. A deleted flag reads as "(deleted flag)" rather than
 * rendering `undefined` into the UI.
 */

import type { VNEffect, VNCondition, VNFlag } from './vnFlags';

const MISSING = '(deleted flag)';

function nameOf(flagId: string, flags: VNFlag[]): string {
    return flags.find(f => f.id === flagId)?.name ?? MISSING;
}

/** Chip text for a choice's effect, e.g. `+bold` or `mara_trust +1`. */
export function describeEffect(effect: VNEffect, flags: VNFlag[]): string {
    const name = nameOf(effect.flagId, flags);
    switch (effect.op) {
        case 'set': return `+${name}`;
        case 'clear': return `−${name}`;
        case 'add': {
            const value = effect.value ?? 1;
            return value < 0 ? `${name} −${Math.abs(value)}` : `${name} +${value}`;
        }
    }
}

/** Chip text for a choice's gate, e.g. `needs mara_trust ≥ 3`. */
export function describeCondition(condition: VNCondition, flags: VNFlag[]): string {
    const name = nameOf(condition.flagId, flags);
    switch (condition.op) {
        case 'is': return `needs ${name}`;
        case 'not': return `needs not ${name}`;
        case 'atLeast': return `needs ${name} ≥ ${condition.value ?? 1}`;
        case 'atMost': return `needs ${name} ≤ ${condition.value ?? 0}`;
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/vnBlockView.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Register the widget types**

In `src/store/workspaceStore.ts`, replace the `DeskWidgetType` union (line ~304) with:

```ts
export type DeskWidgetType = 'writingZone' | 'sticky' | 'reference' | 'image' | 'biblePinit' | 'sceneControl' | 'characterState' | 'continuity' | 'structure' | 'research' | 'progress' | 'relMap' | 'draftNav' | 'beatCard' | 'articleSuggestions' | 'consistencyFlags' | 'worldUnderstanding' | 'vnBlock' | 'vnFlags' | 'untyped';
```

In `src/components/editor/desk/deskConstants.ts`, add to `DEFAULT_DIMS` (before `untyped`):

```ts
  vnBlock: { w: 320, h: 300 },
  vnFlags: { w: 280, h: 240 },
```

and append to `PALETTE_ITEMS`:

```ts
  { type: 'vnBlock',       icon: '🔀', label: 'Story Block' },
  { type: 'vnFlags',       icon: '🚩', label: 'Story Flags' },
```

`DEFAULT_DIMS` is `Record<DeskWidgetType, …>`, so `tsc` will fail until both entries exist. That is intentional.

- [ ] **Step 6: Write the block renderer**

Create `src/components/editor/desk/widgets/VNBlockRenderer.tsx`:

```tsx
"use client";

/**
 * VNBlockRenderer — one beat on the visual novel branch map.
 *
 * A block is a run of scenes that plays straight through and ends at a
 * decision. The widget holds only `{ blockId }`; the Document it names owns
 * the title and choices, and its Scenes are the beats inside. Nothing about
 * the graph lives on the canvas, so the map cannot drift from the story.
 */

import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { VNBlockChoice } from '@/lib/vnBlocks';
import { describeEffect, describeCondition } from '@/lib/vnBlockView';
import styles from '../../WritingDesk.module.css';

export function VNBlockRenderer({ content, onChange }: { content: any; onChange: (c: any) => void }) {
    const blockId: string | undefined = content?.blockId;

    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const addDocument = useWorkspaceStore(s => s.addDocument);
    const updateDocument = useWorkspaceStore(s => s.updateDocument);

    const block = useWorkspaceStore(s => s.documents.find(d => d.id === blockId));
    const sceneTitles = useWorkspaceStore(useShallow(s =>
        s.scenes
            .filter(sc => sc.documentId === blockId)
            .sort((a, b) => a.order - b.order)
            .map(sc => sc.title),
    ));
    const blocks = useWorkspaceStore(useShallow(s =>
        s.documents
            .filter(d => d.projectId === activeProjectId)
            .map(d => ({ id: d.id, title: d.title })),
    ));
    const flags = useWorkspaceStore(useShallow(s =>
        s.projects.find(p => p.id === activeProjectId)?.vnFlags ?? [],
    ));

    // A block dragged from the palette, or seeded by the method library,
    // arrives with no beat behind it. Create one on first render so the card
    // is never orphaned. This is why neither widget-creation path in
    // WritingDesk needs to know about story blocks.
    useEffect(() => {
        if (blockId || !activeProjectId) return;
        const beatId = crypto.randomUUID();
        addDocument({
            id: beatId,
            projectId: activeProjectId,
            title: content?.seedTitle || 'New Beat',
            content: '',
            createdAt: new Date(),
        });
        onChange({ ...content, blockId: beatId });
    }, [blockId, activeProjectId, content, addDocument, onChange]);

    if (!block) {
        return (
            <div className={styles.vnBlock}>
                <p className={styles.vnBlockMissing}>Setting up this beat…</p>
            </div>
        );
    }

    const choices = block.choices ?? [];
    const setChoices = (next: VNBlockChoice[]) => updateDocument(block.id, { choices: next });

    const updateChoice = (id: string, patch: Partial<VNBlockChoice>) =>
        setChoices(choices.map(c => (c.id === id ? { ...c, ...patch } : c)));

    const addChoice = () =>
        setChoices([...choices, {
            id: crypto.randomUUID(),
            text: '',
            targetBlockId: blocks.find(b => b.id !== block.id)?.id ?? block.id,
        }]);

    const removeChoice = (id: string) => setChoices(choices.filter(c => c.id !== id));

    return (
        <div className={styles.vnBlock} data-vn-block-id={block.id}>
            <div className={styles.vnBlockHeader}>
                <input
                    className={styles.vnBlockTitle}
                    value={block.title}
                    onMouseDown={e => e.stopPropagation()}
                    onChange={e => updateDocument(block.id, { title: e.target.value })}
                />
                <div className={styles.vnBlockScenes}>
                    {sceneTitles.length === 0
                        ? 'No scenes yet'
                        : `${sceneTitles.length} scene${sceneTitles.length === 1 ? '' : 's'} · ${sceneTitles.join(' · ')}`}
                </div>
            </div>

            <div className={styles.vnBlockChoices}>
                {choices.length === 0 && (
                    <p className={styles.vnBlockEmpty}>
                        No choices — this beat flows into the next one.
                    </p>
                )}

                {choices.map(choice => (
                    <div key={choice.id} className={styles.vnChoiceRow}>
                        <input
                            className={styles.vnChoiceText}
                            value={choice.text}
                            placeholder="What the player sees"
                            onMouseDown={e => e.stopPropagation()}
                            onChange={e => updateChoice(choice.id, { text: e.target.value })}
                        />

                        <button
                            type="button"
                            className={styles.vnChoiceRemove}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => removeChoice(choice.id)}
                            aria-label="Remove choice"
                        >
                            ×
                        </button>

                        <div className={styles.vnChoiceChips}>
                            {(choice.effects ?? []).map((effect, i) => (
                                <span key={i} className={styles.vnChipEffect}>
                                    {describeEffect(effect, flags)}
                                </span>
                            ))}
                            {choice.condition && (
                                <span className={styles.vnChipCondition}>
                                    {describeCondition(choice.condition, flags)}
                                </span>
                            )}
                        </div>

                        <select
                            className={styles.vnChoiceTarget}
                            value={choice.targetBlockId}
                            onMouseDown={e => e.stopPropagation()}
                            onChange={e => updateChoice(choice.id, { targetBlockId: e.target.value })}
                        >
                            {blocks.map(b => (
                                <option key={b.id} value={b.id}>{b.title}</option>
                            ))}
                        </select>
                    </div>
                ))}

                <button
                    type="button"
                    className={styles.vnAddChoice}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={addChoice}
                >
                    + choice
                </button>
            </div>
        </div>
    );
}
```

**Every interactive element stops mousedown propagation** because the canvas starts a widget drag on mousedown. Without it, clicking into a text field drags the block instead of placing a cursor.

- [ ] **Step 7: Dispatch it**

In `src/components/editor/desk/widgets/WidgetRenderer.tsx`, add the import and one case beside `beatCard`:

```tsx
import { VNBlockRenderer } from './VNBlockRenderer';
```

```tsx
    case 'vnBlock':     return <VNBlockRenderer content={content} onChange={handleChange} />;
```

- [ ] **Step 8: Add the styles**

Append to `src/components/editor/WritingDesk.module.css`:

```css
.vnBlock {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
    font-size: 0.82rem;
}

.vnBlockHeader {
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.12));
}

.vnBlockTitle {
    width: 100%;
    border: none;
    background: transparent;
    font: inherit;
    font-weight: 600;
    font-size: 0.92rem;
    padding: 0;
}

.vnBlockScenes {
    opacity: 0.55;
    font-size: 0.72rem;
    margin-top: 0.15rem;
}

.vnBlockMissing {
    padding: 0.75rem;
    opacity: 0.6;
    font-size: 0.78rem;
}

.vnBlockChoices {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.4rem 0.6rem 0.6rem;
}

.vnBlockEmpty {
    margin: 0;
    opacity: 0.5;
    font-size: 0.74rem;
}

.vnChoiceRow {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: "text remove" "chips chips" "target target";
    gap: 0.25rem 0.4rem;
    align-items: center;
    padding: 0.3rem;
    border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.1));
    border-radius: 6px;
}

.vnChoiceText { grid-area: text; border: none; background: transparent; font: inherit; min-width: 0; }
.vnChoiceChips { grid-area: chips; display: flex; flex-wrap: wrap; gap: 0.25rem; }
.vnChoiceTarget { grid-area: target; font: inherit; font-size: 0.74rem; min-width: 0; }
.vnChoiceRemove { grid-area: remove; border: none; background: transparent; cursor: pointer; opacity: 0.5; }
.vnChoiceRemove:hover { opacity: 1; }

.vnChipEffect,
.vnChipCondition {
    font-size: 0.66rem;
    padding: 0.08rem 0.35rem;
    border-radius: 4px;
    white-space: nowrap;
}

.vnChipEffect { background: rgba(124, 92, 255, 0.18); color: #b9a6ff; }
.vnChipCondition { background: rgba(90, 160, 90, 0.18); color: #9ad19a; }

.vnAddChoice {
    align-self: flex-start;
    border: none;
    background: transparent;
    cursor: pointer;
    opacity: 0.6;
    font: inherit;
    font-size: 0.74rem;
    padding: 0.15rem 0;
}

.vnAddChoice:hover { opacity: 1; }
```

- [ ] **Step 9: Verify**

Run: `npm test`
Expected: all pass — 305 tests across 36 files.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 10: Commit**

```bash
git add src/lib/vnBlockView.ts src/lib/vnBlockView.test.ts src/components/editor/desk/widgets/VNBlockRenderer.tsx src/store/workspaceStore.ts src/components/editor/desk/deskConstants.ts src/components/editor/desk/widgets/WidgetRenderer.tsx src/components/editor/WritingDesk.module.css
git commit -m "feat: story blocks on the branch map canvas"
```

---

### Task 2: Flag effects and conditions on a choice

All dropdowns, never free text — free text is what produced `default met bob = False`.

**Files:**
- Modify: `src/components/editor/desk/widgets/VNBlockRenderer.tsx`
- Modify: `src/components/editor/WritingDesk.module.css`

- [ ] **Step 1: Add the editor component**

In `VNBlockRenderer.tsx`, add this import:

```tsx
import type { VNEffect, VNCondition, VNFlag } from '@/lib/vnFlags';
```

and this component above `VNBlockRenderer`:

```tsx
interface ChoiceStateEditorProps {
    choice: VNBlockChoice;
    flags: VNFlag[];
    onChange: (patch: Partial<VNBlockChoice>) => void;
}

/**
 * The state controls for one choice: what it does, and what it needs.
 *
 * Every operand comes from the declared registry — there is no free-text path
 * into the generated script, because nothing here can be compiled to find out
 * it was wrong.
 *
 * One effect per choice is deliberate. A choice moving two counters at once is
 * real but rare, and the data model already holds `effects[]`, so a second
 * needs no migration when it is wanted.
 */
function ChoiceStateEditor({ choice, flags, onChange }: ChoiceStateEditorProps) {
    const effect = choice.effects?.[0];
    const condition = choice.condition;

    const setEffect = (next: VNEffect | undefined) =>
        onChange({ effects: next ? [next] : undefined });

    const flagById = (id: string) => flags.find(f => f.id === id);

    if (!flags.length) {
        return (
            <div className={styles.vnChoiceState}>
                <span className={styles.vnStateHint}>
                    Add a Story Flags card to track state.
                </span>
            </div>
        );
    }

    return (
        <div className={styles.vnChoiceState} onMouseDown={e => e.stopPropagation()}>
            <label className={styles.vnStateRow}>
                <span>does</span>
                <select
                    value={effect?.flagId ?? ''}
                    onChange={e => {
                        const flagId = e.target.value;
                        if (!flagId) return setEffect(undefined);
                        const flag = flagById(flagId);
                        setEffect({
                            flagId,
                            op: flag?.kind === 'counter' ? 'add' : 'set',
                            value: flag?.kind === 'counter' ? 1 : undefined,
                        });
                    }}
                >
                    <option value="">nothing</option>
                    {flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>

                {effect && flagById(effect.flagId)?.kind === 'bool' && (
                    <select
                        value={effect.op}
                        onChange={e => setEffect({ ...effect, op: e.target.value as VNEffect['op'] })}
                    >
                        <option value="set">on</option>
                        <option value="clear">off</option>
                    </select>
                )}

                {effect && flagById(effect.flagId)?.kind === 'counter' && (
                    <input
                        type="number"
                        className={styles.vnStateNumber}
                        value={effect.value ?? 1}
                        onChange={e => setEffect({ ...effect, op: 'add', value: Number(e.target.value) })}
                    />
                )}
            </label>

            <label className={styles.vnStateRow}>
                <span>needs</span>
                <select
                    value={condition?.flagId ?? ''}
                    onChange={e => {
                        const flagId = e.target.value;
                        if (!flagId) return onChange({ condition: undefined });
                        const flag = flagById(flagId);
                        onChange({
                            condition: {
                                flagId,
                                op: flag?.kind === 'counter' ? 'atLeast' : 'is',
                                value: flag?.kind === 'counter' ? 1 : undefined,
                            },
                        });
                    }}
                >
                    <option value="">nothing</option>
                    {flags.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>

                {condition && flagById(condition.flagId)?.kind === 'bool' && (
                    <select
                        value={condition.op}
                        onChange={e => onChange({ condition: { ...condition, op: e.target.value as VNCondition['op'] } })}
                    >
                        <option value="is">is set</option>
                        <option value="not">is not set</option>
                    </select>
                )}

                {condition && flagById(condition.flagId)?.kind === 'counter' && (
                    <>
                        <select
                            value={condition.op}
                            onChange={e => onChange({ condition: { ...condition, op: e.target.value as VNCondition['op'] } })}
                        >
                            <option value="atLeast">≥</option>
                            <option value="atMost">≤</option>
                        </select>
                        <input
                            type="number"
                            className={styles.vnStateNumber}
                            value={condition.value ?? 1}
                            onChange={e => onChange({ condition: { ...condition, value: Number(e.target.value) } })}
                        />
                    </>
                )}
            </label>
        </div>
    );
}
```

- [ ] **Step 2: Render it in the choice row**

Immediately after the `<select className={styles.vnChoiceTarget}>` element's closing tag, add:

```tsx
                        <ChoiceStateEditor
                            choice={choice}
                            flags={flags}
                            onChange={patch => updateChoice(choice.id, patch)}
                        />
```

- [ ] **Step 3: Update the row grid and add styles**

In `src/components/editor/WritingDesk.module.css`, replace the `.vnChoiceRow` rule with:

```css
.vnChoiceRow {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: "text remove" "chips chips" "target target" "state state";
    gap: 0.25rem 0.4rem;
    align-items: center;
    padding: 0.3rem;
    border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.1));
    border-radius: 6px;
}
```

and append:

```css
.vnChoiceState {
    grid-area: state;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.vnStateRow {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    opacity: 0.85;
}

.vnStateRow > span { opacity: 0.6; min-width: 2.6rem; }
.vnStateRow select { font: inherit; font-size: 0.7rem; max-width: 7rem; }
.vnStateNumber { width: 3.2rem; font: inherit; font-size: 0.7rem; }
.vnStateHint { font-size: 0.68rem; opacity: 0.45; }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 305 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/desk/widgets/VNBlockRenderer.tsx src/components/editor/WritingDesk.module.css
git commit -m "feat: set flag effects and conditions from a choice row"
```

---

### Task 3: The flags panel

The dropdowns in Task 2 stay empty until flags can be declared.

**Files:**
- Create: `src/components/editor/desk/widgets/VNFlagsRenderer.tsx`
- Modify: `src/components/editor/desk/widgets/WidgetRenderer.tsx`
- Modify: `src/components/editor/WritingDesk.module.css`

- [ ] **Step 1: Write the renderer**

Create `src/components/editor/desk/widgets/VNFlagsRenderer.tsx`:

```tsx
"use client";

/**
 * VNFlagsRenderer — the declared state a branch map tracks.
 *
 * Flags are declared here and chosen from dropdowns everywhere else, so no
 * free text ever reaches the generated Ren'Py. A boolean remembers whether
 * something happened; a counter accumulates, which is what affection routes
 * are built from.
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import type { VNFlag } from '@/lib/vnFlags';
import styles from '../../WritingDesk.module.css';

export function VNFlagsRenderer() {
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const updateProject = useWorkspaceStore(s => s.updateProject);
    const flags = useWorkspaceStore(useShallow(s =>
        s.projects.find(p => p.id === activeProjectId)?.vnFlags ?? [],
    ));

    if (!activeProjectId) return null;

    const setFlags = (next: VNFlag[]) => updateProject(activeProjectId, { vnFlags: next });

    const addFlag = () => setFlags([...flags, {
        id: crypto.randomUUID(),
        name: `flag_${flags.length + 1}`,
        kind: 'bool',
        initial: 0,
    }]);

    const updateFlag = (id: string, patch: Partial<VNFlag>) =>
        setFlags(flags.map(f => (f.id === id ? { ...f, ...patch } : f)));

    const removeFlag = (id: string) => setFlags(flags.filter(f => f.id !== id));

    return (
        <div className={styles.vnFlagsPanel} onMouseDown={e => e.stopPropagation()}>
            {flags.length === 0 && (
                <p className={styles.vnBlockEmpty}>
                    No flags yet. A flag is what the story remembers.
                </p>
            )}

            {flags.map(flag => (
                <div key={flag.id} className={styles.vnFlagRow}>
                    <input
                        className={styles.vnFlagName}
                        value={flag.name}
                        onChange={e => updateFlag(flag.id, { name: e.target.value })}
                    />
                    <select
                        value={flag.kind}
                        onChange={e => updateFlag(flag.id, {
                            kind: e.target.value as VNFlag['kind'],
                            initial: 0,
                        })}
                    >
                        <option value="bool">on / off</option>
                        <option value="counter">counter</option>
                    </select>
                    <input
                        type="number"
                        className={styles.vnStateNumber}
                        value={flag.initial}
                        title="Starting value"
                        onChange={e => updateFlag(flag.id, { initial: Number(e.target.value) })}
                    />
                    <button
                        type="button"
                        className={styles.vnChoiceRemove}
                        onClick={() => removeFlag(flag.id)}
                        aria-label={`Remove ${flag.name}`}
                    >
                        ×
                    </button>
                </div>
            ))}

            <button type="button" className={styles.vnAddChoice} onClick={addFlag}>
                + flag
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Dispatch it**

In `WidgetRenderer.tsx`:

```tsx
import { VNFlagsRenderer } from './VNFlagsRenderer';
```

```tsx
    case 'vnFlags':     return <VNFlagsRenderer />;
```

- [ ] **Step 3: Add the styles**

Append to `src/components/editor/WritingDesk.module.css`:

```css
.vnFlagsPanel {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.6rem;
    height: 100%;
    overflow: auto;
    font-size: 0.78rem;
}

.vnFlagRow {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    gap: 0.3rem;
    align-items: center;
}

.vnFlagName {
    border: none;
    background: transparent;
    font: inherit;
    font-family: ui-monospace, monospace;
    font-size: 0.74rem;
    min-width: 0;
}

.vnFlagRow select { font: inherit; font-size: 0.7rem; }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 305 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/desk/widgets/VNFlagsRenderer.tsx src/components/editor/desk/widgets/WidgetRenderer.tsx src/components/editor/WritingDesk.module.css
git commit -m "feat: declare story flags from the branch map"
```

---

### Task 4: The entry point

A writer should reach the branch map by choosing it, not by knowing which palette icons to drag.

**Files:**
- Modify: `src/lib/writingMethods/draftTypes.ts`, `src/lib/writingMethods/methods/mediums.ts`, `src/lib/writingMethods/index.ts`, `src/lib/workTypes.ts`, `src/lib/workTypes.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/workTypes.test.ts`, add inside the `WORK_TYPES` describe block:

```ts
    it('sends a visual novel to the branch map draft type', () => {
        expect(getWorkType('visual-novel')!.draftTypeId).toBe('visual-novel');
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/workTypes.test.ts`
Expected: FAIL — `draftTypeId` is `undefined`.

- [ ] **Step 3: Add the draft type**

In `src/lib/writingMethods/draftTypes.ts`, append to `DRAFT_TYPES`:

```ts
    {
        id: 'visual-novel',
        label: 'Visual Novel',
        icon: '🔀',
        desc: 'Choice-driven branching stories',
        format: 'game',
        recommended: ['vn-branch-map', 'interactive-fiction', 'three-clue-rule'],
        finderWhy: 'Draft the decision branches and the state they track, then write into them.',
    },
```

- [ ] **Step 4: Add the method**

In `src/lib/writingMethods/methods/mediums.ts`, add immediately before the existing `interactive-fiction` entry:

```ts
    {
        id: 'vn-branch-map',
        name: 'Visual Novel Branch Map',
        family: 'game',
        formats: ['game'],
        tagline: 'Beats wired by choices, with the state each one changes.',
        bestFor: 'visual novels, AVNs, romance routes',
        beats: [
            { label: 'Prologue', guidance: 'Everything before the first real decision. One beat, however many scenes it takes.', placeholder: 'e.g. Arrival, the bar, she sits down' },
            { label: 'First Decision', guidance: 'The choice that opens the routes. Each option should promise a different story, not a different sentence.', placeholder: 'e.g. Ask her name / keep quiet' },
            { label: 'Route A', guidance: 'One side of the branch. Note what state it sets — that is what makes the convergence read differently later.', placeholder: 'e.g. Bold route, sets mara_trust +1' },
            { label: 'Route B', guidance: 'The other side. It should reach the same convergence by a different road.', placeholder: 'e.g. Shy route' },
            { label: 'Convergence', guidance: 'Where the routes rejoin so the story stays writable. Good convergence remembers — gate a choice here on what happened earlier.', placeholder: 'e.g. The morning after — different if she trusts you' },
            { label: 'Ending', guidance: 'Where it lands. A beat with no choices ends the game.', placeholder: 'e.g. Goodnight' },
        ],
    },
```

- [ ] **Step 5: Make the method lay blocks, not beat cards**

In `src/lib/writingMethods/index.ts`, add a branch at the very top of `buildMethodWidgets`, leaving the existing body as the fallthrough:

```ts
export function buildMethodWidgets(method: WritingMethod, startX = 60, startY = 60): DeskWidget[] {
    // The branch map is a graph, not a row of prompts: its beats become story
    // blocks, which carry choices and connect to each other. A beat card
    // cannot express an edge.
    if (method.id === 'vn-branch-map') {
        return method.beats.map((beat, i) => ({
            id: crypto.randomUUID(),
            type: 'vnBlock' as const,
            x: startX + (i % 3) * 360,
            y: startY + Math.floor(i / 3) * 340,
            width: 320,
            height: 300,
            content: { seedTitle: beat.label },
            dock: null,
        }));
    }

    return method.beats.map((beat, i) => ({
```

Seeded widgets carry `seedTitle` and no `blockId`; the renderer's effect from Task 1 creates the beat with that title on first render.

- [ ] **Step 6: Wire the work type**

In `src/lib/workTypes.ts`, on the `visual-novel` entry, add `draftTypeId` and delete the comment above it that says it has no draft type, which is now wrong:

```ts
        writingMode: 'visual-novel',
        draftTypeId: 'visual-novel',
        namePlaceholder: 'e.g. The Lighthouse Summer',
```

- [ ] **Step 7: Verify**

Run: `npm test`
Expected: all pass — 306 tests. The existing test `'only names draft types that actually exist'` now also covers the new wiring.

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

- [ ] **Step 8: Commit**

```bash
git add src/lib/writingMethods/draftTypes.ts src/lib/writingMethods/methods/mediums.ts src/lib/writingMethods/index.ts src/lib/workTypes.ts src/lib/workTypes.test.ts
git commit -m "feat: seed a branch map from the method library"
```

---

# PHASE 3 — the visual map

### Task 5: Drawing the edges

**Files:**
- Create: `src/components/editor/desk/widgets/VNEdgeLayer.tsx`
- Modify: `src/components/editor/WritingDesk.tsx`, `src/components/editor/WritingDesk.module.css`

- [ ] **Step 1: Write the edge layer**

Create `src/components/editor/desk/widgets/VNEdgeLayer.tsx`:

```tsx
"use client";

/**
 * VNEdgeLayer — the curves between story blocks on a branch map.
 *
 * Rendered INSIDE the canvas's transformed div, so widget x/y are already the
 * right coordinate space and no conversion is needed. Edges are derived from
 * each block's choices every render and never stored: a connection is a
 * projection of the data, and storing it would create a second source of
 * truth that can disagree with the first.
 */

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore, type DeskWidget } from '@/store/workspaceStore';
import styles from '../../WritingDesk.module.css';

/**
 * The SVG is anchored well up and left of the canvas origin so curves between
 * blocks at negative coordinates are not clipped. Path points are shifted by
 * the same amount to compensate.
 */
const ORIGIN = 4000;

export function VNEdgeLayer({ widgets }: { widgets: DeskWidget[] }) {
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const blocks = useWorkspaceStore(useShallow(s =>
        s.documents
            .filter(d => d.projectId === activeProjectId && d.choices?.length)
            .map(d => ({ id: d.id, choices: d.choices ?? [] })),
    ));

    const blockWidgets = widgets.filter(w => w.type === 'vnBlock' && w.content?.blockId);
    if (!blockWidgets.length || !blocks.length) return null;

    // Block id → its card. A block with no card on this canvas simply has no
    // edge drawn; that is not an error.
    const cardFor = new Map(blockWidgets.map(w => [w.content.blockId as string, w]));

    const edges: { key: string; d: string }[] = [];

    for (const block of blocks) {
        const from = cardFor.get(block.id);
        if (!from) continue;

        block.choices.forEach((choice, i) => {
            const to = cardFor.get(choice.targetBlockId);
            if (!to || to.id === from.id) return;

            // Leave the source's right edge, arrive at the target's left.
            const x1 = from.x + from.width + ORIGIN;
            const y1 = from.y + 70 + i * 26 + ORIGIN;
            const x2 = to.x + ORIGIN;
            const y2 = to.y + 40 + ORIGIN;
            const bend = Math.max(40, Math.abs(x2 - x1) / 2);

            edges.push({
                key: `${block.id}-${choice.id}`,
                d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
            });
        });
    }

    if (!edges.length) return null;

    return (
        <svg className={styles.vnEdgeLayer} aria-hidden="true">
            <defs>
                <marker id="vn-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" className={styles.vnEdgeArrow} />
                </marker>
            </defs>
            {edges.map(edge => (
                <path key={edge.key} d={edge.d} className={styles.vnEdgePath}
                      markerEnd="url(#vn-arrow)" />
            ))}
        </svg>
    );
}
```

- [ ] **Step 2: Render it inside the transformed canvas**

In `src/components/editor/WritingDesk.tsx`, add the import:

```tsx
import { VNEdgeLayer } from './desk/widgets/VNEdgeLayer';
```

Find line ~636:

```tsx
        <div ref={canvasRef} className={styles.deskCanvasInner} style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})` }}>
```

Immediately inside it, before the ghost box div, add:

```tsx
          <VNEdgeLayer widgets={canvasWidgets} />
```

**It must go inside that div.** Outside it, the curves will not pan or zoom with the blocks.

- [ ] **Step 3: Add the styles**

Append to `src/components/editor/WritingDesk.module.css`:

```css
.vnEdgeLayer {
    position: absolute;
    left: -4000px;
    top: -4000px;
    width: 12000px;
    height: 12000px;
    overflow: visible;
    pointer-events: none;
    z-index: 0;
}

.vnEdgePath {
    fill: none;
    stroke: rgba(124, 92, 255, 0.55);
    stroke-width: 2;
}

.vnEdgeArrow { fill: rgba(124, 92, 255, 0.55); }
```

The `-4000px` offsets must match the `ORIGIN` constant in the component. `pointer-events: none` keeps the layer from stealing clicks from the blocks above it.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 306 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/desk/widgets/VNEdgeLayer.tsx src/components/editor/WritingDesk.tsx src/components/editor/WritingDesk.module.css
git commit -m "feat: draw the branches between story blocks"
```

---

### Task 6: Drag to connect

**Files:**
- Modify: `src/components/editor/desk/widgets/VNBlockRenderer.tsx`, `src/components/editor/WritingDesk.module.css`

- [ ] **Step 1: Add the drag handler**

In `VNBlockRenderer`, add this after `removeChoice` and before the `return`:

```tsx
    /**
     * Wire a choice by dragging onto another block.
     *
     * The drop target is found with elementFromPoint rather than by comparing
     * coordinates: the canvas is panned and zoomed, and asking the browser
     * what sits under the cursor is exact where re-deriving the transform is
     * a reliable source of off-by-a-few-pixels bugs.
     */
    const startConnect = (choiceId: string) => {
        const paint = (x: number, y: number) => {
            const card = (document.elementFromPoint(x, y) as HTMLElement | null)
                ?.closest('[data-vn-block-id]');
            document.querySelectorAll('[data-vn-block-id]').forEach(node =>
                node.classList.toggle(styles.vnBlockDropTarget, node === card));
            return card as HTMLElement | null;
        };

        const onMove = (e: MouseEvent) => { paint(e.clientX, e.clientY); };

        const onUp = (e: MouseEvent) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);

            const card = paint(e.clientX, e.clientY);
            document.querySelectorAll('[data-vn-block-id]').forEach(node =>
                node.classList.remove(styles.vnBlockDropTarget));

            const targetBlockId = card?.dataset.vnBlockId;
            if (targetBlockId && targetBlockId !== block.id) {
                updateChoice(choiceId, { targetBlockId });
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
```

- [ ] **Step 2: Add the connector dot**

The target dropdown stays — it is the keyboard-accessible path and the fallback. The dot is the fast one.

In the choice row, immediately after the remove button, add:

```tsx
                        <button
                            type="button"
                            className={styles.vnChoiceDot}
                            title="Drag to a block to connect"
                            aria-label="Drag to connect this choice"
                            onMouseDown={e => {
                                e.stopPropagation();
                                e.preventDefault();
                                startConnect(choice.id);
                            }}
                        />
```

- [ ] **Step 3: Update the grid and add styles**

In `src/components/editor/WritingDesk.module.css`, replace `.vnChoiceRow` with:

```css
.vnChoiceRow {
    display: grid;
    grid-template-columns: 1fr auto auto;
    grid-template-areas: "text remove dot" "chips chips chips" "target target target" "state state state";
    gap: 0.25rem 0.4rem;
    align-items: center;
    padding: 0.3rem;
    border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.1));
    border-radius: 6px;
}
```

and append:

```css
.vnChoiceDot {
    grid-area: dot;
    width: 12px;
    height: 12px;
    padding: 0;
    border: 2px solid rgba(124, 92, 255, 0.8);
    border-radius: 50%;
    background: transparent;
    cursor: crosshair;
}

.vnChoiceDot:hover { background: rgba(124, 92, 255, 0.8); }

.vnBlockDropTarget {
    outline: 2px solid rgba(124, 92, 255, 0.9);
    outline-offset: 2px;
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0

Run: `npm test`
Expected: all pass — 306 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/desk/widgets/VNBlockRenderer.tsx src/components/editor/WritingDesk.module.css
git commit -m "feat: wire a choice by dragging onto a block"
```

---

## Done when

- `npm test` passes at roughly 306 tests across 36 files
- `npx tsc --noEmit` exits 0
- A Visual Novel project's Draft Table offers **Visual Novel Branch Map**, and applying it lays six blocks, each backed by a beat
- Declaring a counter flag makes it selectable on every choice row
- Wiring a choice draws a curve that survives dragging, panning and zooming
- Exporting from the Writing Desk still produces a valid `.rpy`

## Not in this plan

Auto-layout, minimap, edge routing around obstacles, collapsing subtrees, and multiple effects per choice.

**Drop-on-empty-canvas to create a connected block** was in the spec and is deliberately deferred. It needs a widget-creation callback threaded into the renderer, which the `WidgetRenderer` contract does not currently carry, plus a screen-to-canvas coordinate conversion — the one piece of coordinate maths the rest of this design avoids. Dragging onto an existing block covers the common case; this is the accelerator, and it deserves its own pass.

**An empty block's outgoing choices are dropped on export**, because there is no last scene to hang the menu on. Nothing warns about it. Now that the map lets a writer wire a beat before writing scenes into it, this is reachable — it wants a validation warning in a follow-up.
