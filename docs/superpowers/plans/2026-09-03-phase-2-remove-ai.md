# Phase 2 — Remove AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete every AI feature from LoreCanvas — roughly 3,500 lines — removing all three hosted-SaaS blockers by deletion rather than by rearchitecting.

**Architecture:** Deletion proceeds from the outside in: API routes first (nothing imports an endpoint), then the components that called them, then the libraries those components used, then the store state, then the dependency. Each task ends with a green `tsc` so the build is never broken across more than one task. The research **board** survives untouched — its cards are ordinary desk widgets — and so do the Article Suggestions and Consistency & Gaps widgets, which Phase 5 repopulates from deterministic rules.

**Tech Stack:** TypeScript (strict), React 19, Next 16, Zustand, Vitest (jsdom).

**Spec:** `../specs/2026-09-03-saas-conversion-design.md` Part 1.

**Note on the test runner:** `vitest.config.ts` includes only `src/**/*.test.ts` — **not** `.test.tsx`.

---

## What survives, and why it must not be deleted

Read this before deleting anything. Several modules look AI-owned and are not.

| Kept | Why |
|------|-----|
| `src/lib/researchBoard.ts` | `makeNoteCard` is called by `HomePage.tsx:13`, outside any AI path. Only `serializeBoard` goes |
| `src/lib/articleSuggestions.ts` | `makeSuggestionsWidget` and `addSuggestionToWidgets` back a real desk widget with its own renderer, and `homeStats.ts` reads it. Only `serializeSuggestions` goes |
| `src/lib/consistencyFlags.ts` | Same shape — `ConsistencyFlagsRenderer`, `WidgetRenderer`, `deskConstants`, `homeStats`. Only `serializeFlags` goes |
| `src/components/editor/desk/widgets/ArticleSuggestionsRenderer.tsx` | Code survives; **its host does not**. `WritingDesk.tsx:27,144` filters `articleSuggestions` off the board via `TRAY_WIDGET_TYPES`, so its only host was the chat trays. Unreachable until Phase 5 builds the rail |
| `src/components/editor/desk/widgets/ConsistencyFlagsRenderer.tsx` | Same — filtered off the board by `TRAY_WIDGET_TYPES`. Unreachable until Phase 5 |
| `src/lib/interviews.ts`, `InterviewEditorModal.tsx`, `InterviewMenu.tsx` | Guides are data and the components are sound, but **both lose their only host**: `InterviewMenu` is rendered solely by `ChatTrays.tsx:92` and `InterviewEditorModal` solely by `ResearchChatPanel.tsx:927`, both deleted here. Do not delete these files — Phase 5 gives them a new host |
| `src/components/editor/research/ResearchBoardBar.tsx` | Board tab switcher, no AI |
| `src/components/editor/ResearchEmptyState.tsx` | Empty state, no AI |
| `customInterviews` in the store | The user's authored interviews. Phase 5 runs them |

**Accepted consequence — read carefully, it is larger than it first looks.** Deleting the chat also
deletes the *only host* for three kept surfaces. Between this phase and Phase 5:

- **Interviews cannot be launched or authored.** `InterviewMenu` and `InterviewEditorModal` have no
  render site once `ChatTrays` and `ResearchChatPanel` are gone.
- **Article Suggestions and Consistency & Gaps are unreachable**, not merely empty. `WritingDesk.tsx:27`
  lists both in `TRAY_WIDGET_TYPES` and line 144 filters them off the board, because they were moved
  into the chat's side trays.

Phase 5 restores all three by building `ResearchRail.tsx` — the tray rail without the chat. This is a
real regression spanning Phases 3 and 4, accepted because the product is unreleased and because
building a host in a deletion phase would mean building it twice.

**A cheaper alternative exists if that gap is unacceptable:** removing `articleSuggestions` and
`consistencyFlags` from `TRAY_WIDGET_TYPES` (a one-line edit) lets both widgets fall back onto the
board immediately. It does not help the interviews, which need a launcher. Take it only if someone is
actively using those boards during Phases 3-4.

---

## File Structure

**Deleted:**

| Path | Lines | Why |
|------|-------|-----|
| `src/app/api/research-chat/route.ts` | 384 | Spawns Claude Code on the server, billing the operator's Max plan |
| `src/app/api/ai-settings/route.ts` | — | Unauthenticated write to a global cross-tenant settings file |
| `src/app/api/ai-settings/test/route.ts` | — | SSRF sink |
| `src/app/api/local-models/route.ts` | — | SSRF sink |
| `src/app/api/openrouter-credits/route.ts` | — | Leaks the operator's balance to every tenant |
| `src/lib/researchToolDefs.ts` | 311 | AI tool definitions |
| `src/lib/aiSettings.ts` + `.test.ts` | 265 | AI settings model |
| `src/lib/aiSettingsStore.ts` | 83 | The global filesystem settings store |
| `src/lib/localServer.ts` | 98 | `spawn('ollama serve')` |
| `src/lib/comfyClient.ts` | 131 | Local image generation |
| `src/lib/comfyWorkflow.ts` + `.test.ts` | 256 | Local image generation |
| `src/lib/researchChatTypes.ts` | — | Chat message types + `sanitizeChatHistories` |
| `src/components/editor/research/ResearchChatPanel.tsx` | 950 | The chat |
| `src/components/editor/research/ChatModelPicker.tsx` | 140 | Model picker |
| `src/components/editor/research/CreditTracker.tsx` | 60 | OpenRouter balance chip |
| `src/components/editor/research/ContextRing.tsx` | 56 | Context gauge |
| `src/components/editor/research/ChatTrays.tsx` | 135 | Chat-side trays |
| `src/components/ui/AISettingsSection.tsx` | — | Settings panel |

**Modified:**

| Path | Change |
|------|--------|
| `src/components/editor/ResearchTab.tsx` | Chat panel, resizer and collapse state removed; board becomes the whole layout |
| `src/components/ui/SettingsModal.tsx:6,248` | `AISettingsSection` import and render removed |
| `src/store/workspaceStore.ts` | `chatHistories` removed from interface, initial state, `partializeWorkspace`, `onRehydrateStorage` and `deleteResearchBoard`; `setChatHistory` deleted |
| `src/lib/researchBoard.ts` + `.test.ts` | `serializeBoard` removed |
| `src/lib/articleSuggestions.ts` + `.test.ts` | `serializeSuggestions` removed |
| `src/lib/consistencyFlags.ts` + `.test.ts` | `serializeFlags` removed |
| `src/components/editor/WritingDesk.module.css` | Chat-panel layout rules removed |
| `package.json` | `@anthropic-ai/claude-agent-sdk` removed |

---

## Task 1: Delete the five API routes

**Files:**
- Delete: `src/app/api/research-chat/route.ts`
- Delete: `src/app/api/ai-settings/route.ts`, `src/app/api/ai-settings/test/route.ts`
- Delete: `src/app/api/local-models/route.ts`
- Delete: `src/app/api/openrouter-credits/route.ts`

Endpoints are imported by nothing, so this is a clean standalone deletion. The client code that *fetches* them still exists and is removed in Tasks 3–5; until then those fetches would 404, which is why the build stays green.

- [ ] **Step 1: Confirm only `dev-login` remains**

Run: `find src/app/api -name "route.ts"`

Expected, after deleting: only `src/app/api/dev-login/route.ts`.

- [ ] **Step 2: Delete the routes**

```bash
git rm -r src/app/api/research-chat src/app/api/ai-settings src/app/api/local-models src/app/api/openrouter-credits
```

- [ ] **Step 3: Verify the type check still passes**

Run: `npx tsc --noEmit --pretty false`

Expected: no output. Nothing imports a route handler.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete the five AI API routes

research-chat spawned Claude Code on the server and authenticated as the
operator's own OAuth profile, billing every customer's chat to one personal
subscription. ai-settings wrote a single global file shared by all tenants.
local-models and ai-settings/test fetched a user-supplied URL server-side.
openrouter-credits returned the operator's balance to every caller."
```

---

## Task 2: Remove the AI settings panel

**Files:**
- Modify: `src/components/ui/SettingsModal.tsx:6,248`
- Delete: `src/components/ui/AISettingsSection.tsx` and its `.module.css` if one exists beside it

- [ ] **Step 1: Remove the import and the render**

In `src/components/ui/SettingsModal.tsx`, delete line 6:

```typescript
import AISettingsSection from './AISettingsSection';
```

and the render at line 248:

```tsx
<AISettingsSection />
```

If that render sits inside a tab, section heading or wrapper that now contains nothing, delete the wrapper too — an empty "AI" tab is worse than no tab.

- [ ] **Step 2: Delete the component**

```bash
git rm src/components/ui/AISettingsSection.tsx
ls src/components/ui/AISettingsSection.module.css 2>/dev/null && git rm src/components/ui/AISettingsSection.module.css
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep -i aisettings`

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove the AI settings panel

It rendered for every signed-in user and wrote one global server-side file,
so any customer could overwrite every other customer's provider config and
API keys, and it printed the server's home directory path to the browser."
```

---

## Task 3: Strip the chat out of the Research tab

**Files:**
- Modify: `src/components/editor/ResearchTab.tsx`

The board, scope bar, board bar and empty state all stay. Only the chat column goes.

- [ ] **Step 1: Remove the chat imports**

In `src/components/editor/ResearchTab.tsx`, delete these imports:

```typescript
import { MessageSquare } from 'lucide-react';
import { ResearchChatPanel, type ToolEvent } from './research/ResearchChatPanel';
```

and narrow the three helper imports so the deleted serialisers are no longer pulled in:

```typescript
import { makeNoteCard } from '@/lib/researchBoard';
import { addSuggestionToWidgets, type ArticleSuggestion } from '@/lib/articleSuggestions';
import { addFlagToWidgets, type ConsistencyFlag } from '@/lib/consistencyFlags';
```

- [ ] **Step 2: Remove the chat render**

Replace the outer return's chat branch. The whole `{chatCollapsed ? (…) : (…)}` block — the reopen button, `<ResearchChatPanel …/>` and the `researchResizer` separator — is deleted, leaving:

```tsx
  return (
    <div className={styles.researchLayout}>
      <div className={styles.researchMain}>
        {scopeKey ? (
          <>
            <div className={styles.researchScopeBar}>
              <button
                className={`${styles.researchScopeBtn} ${scope === 'project' ? styles.researchScopeBtnActive : ''}`}
                onClick={() => setScope('project')}
              >
                This Project
              </button>
              <button
                className={`${styles.researchScopeBtn} ${scope === 'world' ? styles.researchScopeBtnActive : ''}`}
                onClick={() => setScope('world')}
              >
                This World
              </button>
            </div>
            {baseScopeKey && (
              <ResearchBoardBar
                baseScopeKey={baseScopeKey}
                activeBoardId={activeBoardId}
                onSelect={setActiveBoardId}
              />
            )}
            <div className={styles.researchCanvasHost}>
              <WritingDesk variant="research" scopeKey={scopeKey} />
            </div>
          </>
        ) : (
          <ResearchEmptyState />
        )}
      </div>
    </div>
  );
```

- [ ] **Step 3: Remove the now-dead chat state and handlers**

Delete every remaining symbol that only existed to serve the chat: `chatCollapsed`, `setChatCollapsed`, `chatWidth`, `startResize`, `getContext`, `handleToolEvent`, and the `ToolEvent` type usage. Let the compiler find them:

Run: `npx tsc --noEmit --pretty false 2>&1 | grep ResearchTab`

Work through each error. **Keep `makeNoteCard`, `addSuggestionToWidgets` and `addFlagToWidgets` imports only if something still calls them after `handleToolEvent` is gone** — if nothing does, remove those imports too and Phase 5 reintroduces them. Do not delete the library functions themselves.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false 2>&1 | grep -E "ResearchTab|ResearchChatPanel"`

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/ResearchTab.tsx
git commit -m "refactor: strip the chat column from the Research tab

The board, scope bar and board switcher are unchanged. Phase 5 adds the
interview runner in place of what the chat delivered."
```

---

## Task 4: Delete the chat components

**Files:**
- Delete: `src/components/editor/research/ResearchChatPanel.tsx`, `ChatModelPicker.tsx`, `CreditTracker.tsx`, `ContextRing.tsx`, `ChatTrays.tsx`

- [ ] **Step 1: Confirm nothing outside this set imports them**

```bash
for f in ResearchChatPanel ChatModelPicker CreditTracker ContextRing ChatTrays; do
  echo "== $f: $(grep -rn "$f" src --include=*.tsx --include=*.ts | grep -v "src/components/editor/research/" | wc -l) outside refs"
done
```

Expected: `0 outside refs` for all five. **If any is non-zero, stop** — Task 3 missed a call site.

- [ ] **Step 2: Delete them**

```bash
git rm src/components/editor/research/ResearchChatPanel.tsx \
       src/components/editor/research/ChatModelPicker.tsx \
       src/components/editor/research/CreditTracker.tsx \
       src/components/editor/research/ContextRing.tsx \
       src/components/editor/research/ChatTrays.tsx
```

Delete any `.module.css` beside them with a matching basename.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --pretty false`

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete the research chat components"
```

---

## Task 5: Delete the AI libraries

**Files:**
- Delete: `src/lib/researchToolDefs.ts`, `src/lib/aiSettings.ts`, `src/lib/aiSettings.test.ts`, `src/lib/aiSettingsStore.ts`, `src/lib/localServer.ts`, `src/lib/comfyClient.ts`, `src/lib/comfyWorkflow.ts`, `src/lib/comfyWorkflow.test.ts`

- [ ] **Step 1: Confirm nothing imports them**

```bash
grep -rn "researchToolDefs\|aiSettingsStore\|from '@/lib/aiSettings'\|localServer\|comfyClient\|comfyWorkflow" src --include=*.ts --include=*.tsx
```

Expected: matches only inside the files being deleted. **Anything else means an earlier task left a reference** — fix that first.

- [ ] **Step 2: Delete them**

```bash
git rm src/lib/researchToolDefs.ts \
       src/lib/aiSettings.ts src/lib/aiSettings.test.ts \
       src/lib/aiSettingsStore.ts \
       src/lib/localServer.ts \
       src/lib/comfyClient.ts \
       src/lib/comfyWorkflow.ts src/lib/comfyWorkflow.test.ts
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all remaining tests PASS. The `aiSettings` and `comfyWorkflow` suites are gone with their modules.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete the AI libraries

Removes the last os.homedir() write, the last child_process.spawn, and the
last server-side fetch to a user-supplied URL in src/."
```

---

## Task 6: Remove chat history from the store

**Files:**
- Modify: `src/store/workspaceStore.ts` — lines 16, 761, 1265, 1360, 2426–2438, 2638–2639
- Delete: `src/lib/researchChatTypes.ts`
- Test: `src/store/chatHistoriesRemoved.test.ts` (create)

Persisted `chatHistories` blobs stay in existing users' localStorage. They are simply ignored — an unknown key in the rehydrated object is harmless, and `partializeWorkspace` will not write it back, so it disappears on the next save.

- [ ] **Step 1: Write the failing test**

Create `src/store/chatHistoriesRemoved.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { partializeWorkspace } from './workspaceStore';

describe('partializeWorkspace after AI removal', () => {
    it('does not persist chat histories', () => {
        const state = { chatHistories: { 'board::1': [{ role: 'user', content: 'hi' }] } } as never;
        expect(partializeWorkspace(state)).not.toHaveProperty('chatHistories');
    });

    it('still persists the research boards the chat used to sit beside', () => {
        const state = {
            customBoards: { 'p1': [{ id: 'b1', name: 'Lore' }] },
            researchStates: { 'p1::b1': { widgets: [] } },
        } as never;
        const out = partializeWorkspace(state);
        expect(out).toHaveProperty('customBoards');
        expect(out).toHaveProperty('researchStates');
    });
});
```

`partializeWorkspace` is already exported at `src/store/workspaceStore.ts:1219`, so this test imports it directly — no change needed to make it testable.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/store/chatHistoriesRemoved.test.ts`

Expected: FAIL — `expected { chatHistories: … } not to have property "chatHistories"`.

- [ ] **Step 3: Remove chatHistories from the store**

In `src/store/workspaceStore.ts`, make these six edits:

1. **Line 16** — delete the import:
```typescript
import { sanitizeChatHistories, type ChatMessage as ResearchChatMessage } from '@/lib/researchChatTypes';
```

2. **Line 761** — delete the interface field:
```typescript
    chatHistories: Record<string, ResearchChatMessage[]>;
```
and the `setChatHistory` declaration beside the other action signatures.

3. **Line 1265** — delete from `partializeWorkspace`:
```typescript
        chatHistories: sanitizeChatHistories(state.chatHistories),
```

4. **Line 1360** — delete from the initial state:
```typescript
            chatHistories: {},
```

5. **Lines 2426–2438** — in `deleteResearchBoard`, drop the chat cleanup so the action becomes:
```typescript
            deleteResearchBoard: (baseScopeKey, boardId) =>
                set((state) => {
                    const nextBoards = (state.customBoards[baseScopeKey] ?? []).filter(b => b.id !== boardId);
                    // Drop the deleted board's canvas state too.
                    const boardKey = `${baseScopeKey}::${boardId}`;
                    const { [boardKey]: _removed, ...restStates } = state.researchStates;
                    return {
                        customBoards: { ...state.customBoards, [baseScopeKey]: nextBoards },
                        researchStates: restStates,
                    };
                }),
```
and delete the whole `setChatHistory` implementation that follows it.

6. **Lines 2638–2639** — delete the rehydration guard:
```typescript
                    if (!state.chatHistories || typeof state.chatHistories !== 'object') {
                        state.chatHistories = {};
                    }
```

- [ ] **Step 4: Delete the types module**

```bash
git rm src/lib/researchChatTypes.ts
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/store/chatHistoriesRemoved.test.ts`

Expected: PASS — 2 tests.

- [ ] **Step 6: Full check**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove chat history from the workspace store

Also removes sanitizeChatHistories from partializeWorkspace, which ran
synchronously on every set() as part of the persist path."
```

---

## Task 7: Remove the three AI-context serialisers

**Files:**
- Modify: `src/lib/researchBoard.ts`, `src/lib/researchBoard.test.ts`
- Modify: `src/lib/articleSuggestions.ts`, `src/lib/articleSuggestions.test.ts`
- Modify: `src/lib/consistencyFlags.ts`, `src/lib/consistencyFlags.test.ts`

Each of these three modules exists to build desk widgets and **stays**. Only the function that flattened widgets into AI prompt context goes.

- [ ] **Step 1: Confirm each has no remaining caller**

```bash
for f in serializeBoard serializeSuggestions serializeFlags; do
  echo "== $f: $(grep -rn "$f" src --include=*.ts --include=*.tsx | grep -v ".test.ts" | grep -c .) non-test refs"
done
```

Expected: `1 non-test refs` each — the declaration itself. **If any shows 2 or more, stop** and remove the caller first.

- [ ] **Step 2: Delete the three functions**

Remove `serializeBoard` from `src/lib/researchBoard.ts`, `serializeSuggestions` from `src/lib/articleSuggestions.ts`, and `serializeFlags` from `src/lib/consistencyFlags.ts`. Leave `makeNoteCard`, `makeSuggestionsWidget`, `addSuggestionToWidgets`, `makeFlagsWidget` and `addFlagToWidgets` exactly as they are.

Update the doc comment at the top of `src/lib/researchBoard.ts`, which currently says the module turns board widgets into text for the AI chat:

```typescript
/**
 * Research board helpers: build the cards a board is made of. Pure, leaf-level.
 */
```

- [ ] **Step 3: Delete their tests**

In each `.test.ts`, delete the `describe` block for the removed function. Leave every other block untouched — `makeNoteCard`, the widget builders and the `addTo…` helpers all keep their coverage.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --pretty false && npx vitest run`

Expected: no compiler output; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove the three AI-context serialisers

serializeBoard, serializeSuggestions and serializeFlags existed only to
flatten widgets into prompt text. The widget builders they sat beside are
untouched — Phase 5 repopulates both boards from deterministic rules."
```

---

## Task 8: Remove the dependency and clean the layout

**Files:**
- Modify: `package.json`
- Modify: `src/components/editor/WritingDesk.module.css`
- Modify: `README.md`

- [ ] **Step 1: Confirm nothing imports the SDK**

Run: `grep -rn "claude-agent-sdk" src`

Expected: no output.

- [ ] **Step 2: Remove it**

```bash
npm uninstall @anthropic-ai/claude-agent-sdk
```

- [ ] **Step 3: Remove the orphaned chat layout rules**

The two-column research layout no longer has a second column. In `src/components/editor/WritingDesk.module.css`, delete the rules that styled the removed chat: `.researchChatReopen` and `.researchResizer`, plus any `.researchChat*` rule with no remaining consumer. Confirm each is dead before deleting it:

```bash
for c in researchChatReopen researchResizer; do
  echo "== $c: $(grep -rn "styles.$c" src --include=*.tsx | wc -l) uses"
done
```

Expected: `0 uses` each.

Then check whether `.researchLayout` still needs its two-column grid or flex definition. It now wraps a single child, so a leftover `grid-template-columns` with two tracks will leave an empty column. Adjust it to a single-column layout.

- [ ] **Step 4: Correct the README**

Remove every claim about AI features: the four AI providers, the consistency checker, local models, and image generation. This closes part of roadmap item `2e.2` by deletion rather than correction.

- [ ] **Step 5: Full regression**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src
npm run build
```

Expected: `tsc` silent, tests green, `npm run build` succeeds.

**Baseline:** `npx eslint src` reports **377 problems (248 errors, 129 warnings)** on the tree as it
stands — measured, not estimated, and mostly pre-existing `no-explicit-any` in `workspaceStore.ts`.
Clean is not achievable and is not the gate. The gate is **no increase**: deletions should move this
number DOWN. If it rises, a deletion left something behind — fix it rather than suppressing it.

```bash
npx eslint src 2>&1 | tail -1
```

Expected: a total of 377 or lower.

- [ ] **Step 6: Measure**

```bash
git diff --stat HEAD~7 | tail -1
```

Record the deletion count. The spec estimates ~3,500 lines. Phase 8 sizes its own
scope from what is left, so the real number matters.

- [ ] **Step 7: Manual smoke test**

Start the dev server and confirm:

1. Home loads, no console errors.
2. Settings opens and has **no AI section**, and no empty tab where it was.
3. The Research tab opens, shows the scope bar and board switcher, and **fills the full width** with no empty column or stray resizer.
4. A research board still accepts cards, and existing boards still show theirs.
5. Article Suggestions and Consistency & Gaps are **not reachable from the board** — `TRAY_WIDGET_TYPES` still filters them and their tray host is gone. Expected until Phase 5.
6. There is **no Interviews menu anywhere** — its only render site went with `ChatTrays`. Expected until Phase 5. Confirm `src/lib/interviews.ts`, `InterviewMenu.tsx` and `InterviewEditorModal.tsx` still exist on disk and were not deleted.
7. The World Bible and the Writing Desk are unaffected.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove the Claude Agent SDK and the chat layout

Completes Phase 2. No os.homedir(), no child_process.spawn, and no
server-side fetch to a user-supplied URL remain anywhere in src/."
```

---

## Definition of done

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green
- [ ] `npx eslint src` total is 377 or lower (it was 377 before Phase 1)
- [ ] `npm run build` succeeds
- [ ] `grep -rn "os.homedir\|child_process\|claude-agent-sdk" src` returns nothing
- [ ] `find src/app/api -name route.ts` returns only `dev-login`
- [ ] Settings has no AI section and no empty tab
- [ ] The Research tab fills its width; boards and cards work
- [ ] `InterviewMenu.tsx`, `InterviewEditorModal.tsx`, `interviews.ts`, `ArticleSuggestionsRenderer.tsx` and `ConsistencyFlagsRenderer.tsx` all still exist on disk (they are hostless, not deleted)
- [ ] `grep -n "TRAY_WIDGET_TYPES" src/components/editor/WritingDesk.tsx` still matches — Phase 5 owns that decision, not this phase
- [ ] ~3,500 lines deleted

---

## What Phase 5 picks up

Stated here so the temporary gaps are not mistaken for bugs:

- **A host for all three surfaces** — `ResearchRail.tsx`, the tray rail with the chat removed. Without
  it, `InterviewMenu`, `InterviewEditorModal`, `ArticleSuggestionsRenderer` and
  `ConsistencyFlagsRenderer` have no render site at all.
- The interview runner itself → `InterviewRunner`
- Consistency & Gaps content → `loreRules.ts`
- Article Suggestions content → `suggestArticles()`
- A decision on `TRAY_WIDGET_TYPES`: rail-hosted, or returned to the board
