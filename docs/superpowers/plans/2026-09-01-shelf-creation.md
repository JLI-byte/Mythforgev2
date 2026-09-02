# Shelf Creation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create worlds and books from the Home shelf — a "+" spine that makes a world inline from a name, and a "+" cover that routes to the Bookshelf's existing work-type flow pre-filed to the selected world.

**Architecture:** A new store action owns world defaults. A transient store field carries the "start a book here" intent across to the Bookshelf. `WorldShelf` gains two optional callback props and stays presentational.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, CSS Modules, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-shelf-creation-design.md`

**Hard constraint:** `src/components/management/Bookshelf.tsx` has uncommitted in-flight work on the story modal. Task 3 makes the smallest possible addition to it — one effect — and touches nothing else in that file.

## File Structure

| File | Responsibility |
|---|---|
| `src/store/workspaceStore.ts` (modify) | `createWorld` action; transient `pendingNewStoryWorldKey` + its two actions. |
| `src/store/shelfCreation.test.ts` (create) | Store-level tests for `createWorld` and persistence exclusion. |
| `src/components/home/WorldShelf.tsx` (modify) | "+" spine, inline name form, "+" cover slot. |
| `src/components/home/WorldShelf.module.css` (modify) | Styles for the above. |
| `src/components/home/HomePage.tsx` (modify) | Wire the callbacks to the store. |
| `src/components/management/Bookshelf.tsx` (modify) | One effect: consume the pending intent on arrival. |

---

### Task 1: Store — createWorld and the pending-story intent

**Files:**
- Modify: `src/store/workspaceStore.ts`
- Create: `src/store/shelfCreation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/store/shelfCreation.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, COVER_COLORS, partializeWorkspace } from './workspaceStore';

describe('createWorld', () => {
    beforeEach(() => {
        useWorkspaceStore.setState({ worlds: [] });
    });

    it('returns the id of the world it added', () => {
        const id = useWorkspaceStore.getState().createWorld('Aethel');
        const worlds = useWorkspaceStore.getState().worlds;
        expect(worlds).toHaveLength(1);
        expect(worlds[0].id).toBe(id);
        expect(worlds[0].name).toBe('Aethel');
    });

    it('trims the name', () => {
        useWorkspaceStore.getState().createWorld('  Rustwater  ');
        expect(useWorkspaceStore.getState().worlds[0].name).toBe('Rustwater');
    });

    it('applies the same defaults the shelf wizard would', () => {
        useWorkspaceStore.getState().createWorld('Mirefall');
        const w = useWorkspaceStore.getState().worlds[0];
        expect(w.genre).toBe('fantasy');
        expect(w.techLevel).toBe('medieval');
        expect(w.tone).toEqual({ darkness: 'balanced', scale: 'balanced', humor: 'balanced' });
        expect(w.logline).toBe('');
        expect(w.magicExists).toBe(false);
        expect(w.timePeriod).toBe('');
        expect(COVER_COLORS).toContain(w.coverColor);
        expect(w.createdAt).toBeInstanceOf(Date);
    });

    it('keeps existing worlds', () => {
        useWorkspaceStore.getState().createWorld('First');
        useWorkspaceStore.getState().createWorld('Second');
        expect(useWorkspaceStore.getState().worlds.map(w => w.name)).toEqual(['First', 'Second']);
    });
});

describe('pendingNewStoryWorldKey', () => {
    it('round-trips through its actions', () => {
        useWorkspaceStore.getState().requestNewStory('world-1');
        expect(useWorkspaceStore.getState().pendingNewStoryWorldKey).toBe('world-1');
        useWorkspaceStore.getState().clearPendingNewStory();
        expect(useWorkspaceStore.getState().pendingNewStoryWorldKey).toBeNull();
    });

    it('is NOT persisted — a reload must not reopen the creation modal', () => {
        useWorkspaceStore.getState().requestNewStory('world-1');
        const persisted = partializeWorkspace(useWorkspaceStore.getState());
        expect('pendingNewStoryWorldKey' in persisted).toBe(false);
    });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/store/shelfCreation.test.ts`
Expected: FAIL — `createWorld is not a function`.

- [ ] **Step 3: Add the state and actions**

In `src/store/workspaceStore.ts`, add to the `WorkspaceState` interface near the other world fields:

```ts
    /**
     * Set when the writer asks to start a book from somewhere that does not own
     * the creation flow (the Home shelf), and consumed by the Bookshelf on
     * arrival. Intentionally not persisted — a reload must not reopen the modal.
     */
    pendingNewStoryWorldKey: string | null;
```

Add to the actions section of the interface:

```ts
    /** Create a world from a name alone, with the shelf wizard's defaults. Returns its id. */
    createWorld: (name: string) => string;
    requestNewStory: (worldKey: string | null) => void;
    clearPendingNewStory: () => void;
```

Add to the initial state, beside `worlds: []`:

```ts
            pendingNewStoryWorldKey: null,
```

Add the implementations beside `addWorld`:

```ts
            createWorld: (name) => {
                const world: World = {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    // The same defaults the shelf wizard applies. Duplicated on
                    // purpose while Bookshelf.tsx has uncommitted work in it;
                    // the wizard should call this once that lands.
                    genre: 'fantasy',
                    tone: { darkness: 'balanced', scale: 'balanced', humor: 'balanced' },
                    logline: '',
                    magicExists: false,
                    techLevel: 'medieval',
                    timePeriod: '',
                    coverColor: COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)],
                    createdAt: new Date(),
                };
                set((state) => ({ worlds: [...state.worlds, world] }));
                return world.id;
            },

            requestNewStory: (worldKey) => set(() => ({ pendingNewStoryWorldKey: worldKey })),
            clearPendingNewStory: () => set(() => ({ pendingNewStoryWorldKey: null })),
```

Do NOT add `pendingNewStoryWorldKey` to `partializeWorkspace`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/store/shelfCreation.test.ts && npx tsc --noEmit --pretty false`
Expected: 6 tests pass, tsc silent.

- [ ] **Step 5: Commit**

```bash
git add src/store/workspaceStore.ts src/store/shelfCreation.test.ts
git commit -m "feat: create a world from a name, and carry a new-book intent"
```

---

### Task 2: The shelf affordances

**Files:**
- Modify: `src/components/home/WorldShelf.module.css`
- Modify: `src/components/home/WorldShelf.tsx`

- [ ] **Step 1: Styles**

Append to `src/components/home/WorldShelf.module.css`:

```css
/* ── Creating ─────────────────────────────────────────── */

.addSpine {
  width: var(--spine-w);
  height: calc(100% - 12px);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(255, 255, 255, 0.22);
  border-radius: 2px 2px 1px 1px;
  background: none;
  color: var(--muted, #8b8b95);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, transform 0.18s ease;
}
.addSpine:hover {
  color: var(--foreground, #f2f0ef);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-5px);
}
.addSpine:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }

.addCover {
  width: var(--cover-w);
  height: var(--cover-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(255, 255, 255, 0.22);
  border-radius: 2px 4px 4px 2px;
  background: none;
  color: var(--muted, #8b8b95);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
.addCover:hover {
  color: var(--foreground, #f2f0ef);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}
.addCover:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }

.createForm {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}
.createLabel {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
}
.createHint {
  margin: 0;
  font-size: 0.74rem;
  color: var(--muted, #8b8b95);
}
.createInput {
  width: 100%;
  max-width: 320px;
  padding: 8px 10px;
  font-size: 0.9rem;
  color: var(--foreground, #f2f0ef);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.15s ease;
}
.createInput:focus { border-color: #8ab4ff; }

.createActions { display: flex; gap: 8px; }
.createSave {
  padding: 7px 16px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #0f1116;
  background: var(--foreground, #f2f0ef);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.createSave:disabled { opacity: 0.4; cursor: not-allowed; }
.createCancel {
  padding: 7px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted, #8b8b95);
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.createCancel:hover { color: var(--foreground, #f2f0ef); }

@media (prefers-reduced-motion: reduce) {
  .addSpine, .addCover { transition: none; }
}
```

- [ ] **Step 2: Component**

In `src/components/home/WorldShelf.tsx`:

Add `Plus` to the `lucide-react` import alongside `ArrowRight`, and `useState` to the React import.

Add to `WorldShelfProps`:

```ts
    /** Supplied to offer world creation; omit to render a read-only shelf. */
    onCreateWorld?: (name: string) => void;
    /** Supplied to offer book creation in the opened world. */
    onNewStory?: () => void;
```

Add local state beside the existing hooks, ABOVE the early return:

```ts
    const [creating, setCreating] = useState(false);
    const [draftName, setDraftName] = useState('');
```

Add this helper after `plural`:

```tsx
    const submitWorld = () => {
        const name = draftName.trim();
        if (!name || !onCreateWorld) return;
        onCreateWorld(name);
        setDraftName('');
        setCreating(false);
    };

    const createForm = (
        <div className={styles.createForm}>
            <p className={styles.createLabel}>Name your world</p>
            <input
                className={styles.createInput}
                value={draftName}
                autoFocus
                placeholder="Aethel"
                aria-label="World name"
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') submitWorld();
                    if (e.key === 'Escape') { setDraftName(''); setCreating(false); }
                }}
            />
            <p className={styles.createHint}>
                Genre and tone get sensible defaults — refine them on the Bookshelf.
            </p>
            <div className={styles.createActions}>
                <button className={styles.createSave} onClick={submitWorld} disabled={!draftName.trim()}>
                    Create
                </button>
                <button
                    className={styles.createCancel}
                    onClick={() => { setDraftName(''); setCreating(false); }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
```

In the empty-shelf branch, offer the same form rather than only a link out — otherwise the "+" spine is unreachable for the writer with nothing:

```tsx
    if (shelves.length === 0) {
        return (
            <div className={styles.empty}>
                {creating && onCreateWorld ? createForm : (
                    <>
                        <p className={styles.emptyText}>
                            Your shelf is empty. Create a world and the stories you write in it live here.
                        </p>
                        {onCreateWorld && (
                            <button className={styles.createSave} onClick={() => setCreating(true)}>
                                Create a world
                            </button>
                        )}
                        {emptyAction}
                    </>
                )}
            </div>
        );
    }
```

After the spines `.map(...)` and inside the `.spines` container, add the "+" spine:

```tsx
                {onCreateWorld && (
                    <button
                        className={styles.addSpine}
                        title="New world"
                        aria-label="New world"
                        onClick={() => setCreating(true)}
                    >
                        <Plus size={16} />
                    </button>
                )}
```

Replace the panel's contents so the form takes over when creating. Wrap the existing panel children in `{creating && onCreateWorld ? createForm : (<>...existing...</>)}`.

In the covers row, after the mapped covers and the overflow badge, add:

```tsx
            {onNewStory && (
              <button
                className={styles.addCover}
                title={`New book in ${selected.name}`}
                aria-label={`New book in ${selected.name}`}
                onClick={onNewStory}
              >
                <Plus size={18} />
              </button>
            )}
```

The "no stories yet" branch must also offer it, so an empty world is not a dead end — render the covers row whenever `onNewStory` is supplied, even with no stories.

- [ ] **Step 3: Checks**

```bash
npx tsc --noEmit --pretty false
npx eslint src/components/home/WorldShelf.tsx
```
Both silent. If eslint complains about hooks after an early return, move `useState` above it.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/WorldShelf.tsx src/components/home/WorldShelf.module.css
git commit -m "feat: offer world and book creation from the shelf"
```

---

### Task 3: Wire Home and consume the intent on the Bookshelf

**Files:**
- Modify: `src/components/home/HomePage.tsx`
- Modify: `src/components/management/Bookshelf.tsx`

- [ ] **Step 1: Home**

In `src/components/home/HomePage.tsx`, add the store selectors beside the others:

```tsx
  const createWorld = useWorkspaceStore(s => s.createWorld);
  const requestNewStory = useWorkspaceStore(s => s.requestNewStory);
```

Add the handlers beside `openBible`:

```tsx
  const handleCreateWorld = (name: string) => {
    // Select what was just made, so the writer lands inside it.
    setSelectedShelfKey(createWorld(name));
  };

  const handleNewStory = () => {
    // The Bookshelf owns the work-type flow; hand it the shelf to file under.
    requestNewStory(selectedShelfKey ?? shelves[0]?.key ?? null);
    setWorkspaceMode('bookshelf');
  };
```

Pass them to `<WorldShelf ... onCreateWorld={handleCreateWorld} onNewStory={handleNewStory} />`.

- [ ] **Step 2: Bookshelf — the smallest possible addition**

In `src/components/management/Bookshelf.tsx`, add two selectors beside the existing ones:

```tsx
    const pendingNewStoryWorldKey = useWorkspaceStore(s => s.pendingNewStoryWorldKey);
    const clearPendingNewStory = useWorkspaceStore(s => s.clearPendingNewStory);
```

Add this effect after the existing Escape-key effect. Add nothing else to this file:

```tsx
    /**
     * Home can ask for a new book but does not own the work-type flow, so it
     * leaves the shelf id here and routes over. Consume it once and clear it.
     */
    useEffect(() => {
        if (!pendingNewStoryWorldKey) return;
        handleCreateStory(
            pendingNewStoryWorldKey === STANDALONE_KEY ? undefined : pendingNewStoryWorldKey,
        );
        clearPendingNewStory();
    }, [pendingNewStoryWorldKey, clearPendingNewStory]);
```

Import `STANDALONE_KEY` from `@/lib/worldKey` if it is not already imported.

`handleCreateStory` is defined in this component and is stable enough for this use; do not add it to the dependency array, which would re-fire the effect on every render.

- [ ] **Step 3: Checks**

```bash
npx tsc --noEmit --pretty false
npx eslint src/components/home/ src/components/management/Bookshelf.tsx
npx vitest run
```

`tsc` silent; the only acceptable eslint messages are pre-existing ones (the spotlight `set-state-in-effect`, and any already present in `Bookshelf.tsx`); all tests pass.

Confirm the Bookshelf diff is ONLY the two selectors and the one effect:

```bash
git diff --stat src/components/management/Bookshelf.tsx
```

This file has uncommitted in-flight work — your diff must sit alongside it, not reformat or reorganise anything.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/HomePage.tsx src/components/management/Bookshelf.tsx
git commit -m "feat: start worlds and books from the Home shelf"
```

Note `Bookshelf.tsx` carries pre-existing uncommitted work; committing it here also commits that work. Check with the user before staging it, or stage only the hunks you added.

---

### Task 4: Verify in the browser

- [ ] **Step 1:** From Home, click the "+" spine, name a world, Create. It appears as a new spine and is selected.
- [ ] **Step 2:** Go to the Bookshelf. The new world is there as a shelf with the wizard's defaults.
- [ ] **Step 3:** Back on Home, select a world, click the "+" cover. The Bookshelf opens with the work-type modal, filed to that world. Complete it and confirm the book lands on the right shelf.
- [ ] **Step 4:** Repeat from the Standalones shelf — the modal should open with no world pre-filed.
- [ ] **Step 5:** Trigger the flow, then reload before completing it. The modal must NOT reopen.
- [ ] **Step 6:** Check the console for errors, remembering the Browser pane retains output across reloads.
