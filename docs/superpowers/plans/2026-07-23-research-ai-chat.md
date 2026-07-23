# Research AI Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left-hand AI chat panel to the Research tab, backed by the user's local Claude Code (Max subscription) via the Claude Agent SDK, board-aware, with a Phase-1 "+ Add to board" button on each reply.

**Architecture:** A Next.js Node-runtime route (`/api/research-chat`) calls `query()` from `@anthropic-ai/claude-agent-sdk` with all built-in tools disabled, and streams the reply text back. A client `ResearchChatPanel` renders the conversation and streams the response. `ResearchTab` becomes a two-column layout (chat left, scope-bar + canvas right), serializes the active board into context for each request, and appends a Note card when the user clicks "+ Add to board".

**Tech Stack:** Next.js 16 (React 19), Zustand 5, TypeScript, Vitest. New dependency: `@anthropic-ai/claude-agent-sdk`.

**Spec:** `docs/superpowers/specs/2026-07-23-research-ai-chat-design.md`

**Prerequisite:** the Research tab (`ResearchTab.tsx`, `researchStates` store slice, `researchScope.ts`) is already built and committed. Claude Code must be installed and signed in on Max on the dev machine.

---

## File Structure

**Created:**
- `src/app/api/research-chat/route.ts` — Node-runtime streaming route driving the Agent SDK.
- `src/lib/researchBoard.ts` — `serializeBoard(widgets)` + `makeNoteCard(text, index)` pure helpers.
- `src/lib/researchBoard.test.ts` — unit tests for both helpers.
- `src/components/editor/research/ResearchChatPanel.tsx` — the chat UI.

**Modified:**
- `package.json` / lockfile — add `@anthropic-ai/claude-agent-sdk`.
- `src/components/editor/ResearchTab.tsx` — two-column layout, board context, add-card wiring.
- `src/components/editor/WritingDesk.module.css` — chat panel + two-column layout styles (appended).

---

## Task 1: Install the SDK and build the route — spike the Max-subscription path

**Files:**
- Modify: `package.json`
- Create: `src/app/api/research-chat/route.ts`

This task is the risk spike: it proves an end-to-end reply comes back through the local Claude Code subscription **before** any UI is built. If the SDK demands an `ANTHROPIC_API_KEY`, STOP and report to the user — do not proceed to Task 2.

- [ ] **Step 1: Install the Agent SDK**

Run: `npm install @anthropic-ai/claude-agent-sdk`
Expected: it appears under `dependencies` in `package.json`.

- [ ] **Step 2: Create the route**

Create `src/app/api/research-chat/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Must spawn the local Claude Code process — Node runtime, never edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Default model for the research assistant. */
const RESEARCH_CHAT_MODEL = 'claude-opus-4-8';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Research AI chat — LOCAL ONLY. Drives the user's signed-in Claude Code via
 * the Agent SDK, so replies run on their Max subscription. Built-in file/bash
 * tools are disabled (`tools: []`), so the assistant is purely conversational
 * and can never touch the machine, even under prompt injection from board text.
 */
export async function POST(request: Request) {
    let body: { messages?: ChatMessage[]; board?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const board = typeof body.board === 'string' ? body.board : '';
    if (messages.length === 0) {
        return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const systemPrompt =
        'You are a research assistant embedded in LoreCanvas, a writing app for ' +
        'novelists and worldbuilders. Help the user develop, organize, and ' +
        'interrogate their research. Be concise and concrete. ' +
        (board.trim()
            ? `The user's current research board contains:\n${board}`
            : "The user's research board is currently empty.");

    // Render the conversation as a single prompt string.
    const prompt = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                const q = query({
                    prompt,
                    options: {
                        model: RESEARCH_CHAT_MODEL,
                        systemPrompt,
                        tools: [], // disable ALL built-in tools — conversational only
                        permissionMode: 'default',
                    },
                });
                for await (const message of q) {
                    if (message.type === 'assistant') {
                        for (const block of (message as any).content ?? []) {
                            if (block?.type === 'text' && block.text) {
                                controller.enqueue(encoder.encode(block.text));
                            }
                        }
                    }
                }
            } catch (err) {
                const detail = err instanceof Error ? err.message : 'unknown error';
                controller.enqueue(
                    encoder.encode(
                        `\n\n[Could not reach Claude Code: ${detail}. Make sure Claude Code is installed and signed in.]`,
                    ),
                );
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
}
```

- [ ] **Step 3: Confirm no API key is forcing API billing**

Run: `grep -i ANTHROPIC_API_KEY .env.local 2>/dev/null; echo "exit: $?"`
Expected: no match (`ANTHROPIC_API_KEY` unset). If it IS set, the SDK may bill API usage instead of the subscription — note it and confirm with the user before continuing.

- [ ] **Step 4: Start the dev server and spike a reply**

Start the dev server (via the preview tooling or `npm run dev`), then run:

```bash
curl -N -X POST http://localhost:3000/api/research-chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"Reply with exactly: hello from claude"}],"board":""}'
```

Expected: the text `hello from claude` streams back (wording may vary). If instead you get an error mentioning a missing API key or auth, STOP — the subscription path isn't working; report to the user with the exact message.

- [ ] **Step 5: Verify the assistant message shape (adjust if needed)**

If Step 4 returned the error bubble but Claude Code IS installed/signed in, the `message.content` access may be wrong for the installed SDK version. Add a temporary `console.log(JSON.stringify(message))` inside the loop, re-run the curl, read the dev-server logs, and correct the block-extraction path (e.g. `message.message.content`) to match the real shape. Remove the log once fixed.

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add package.json package-lock.json src/app/api/research-chat/route.ts
git commit -m "feat: research-chat route driving local Claude Code via Agent SDK"
```

---

## Task 2: Board serialization + note-card helpers (TDD)

**Files:**
- Create: `src/lib/researchBoard.ts`
- Test: `src/lib/researchBoard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/researchBoard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serializeBoard, makeNoteCard } from './researchBoard';
import type { DeskWidget } from '@/store/workspaceStore';

function widget(type: DeskWidget['type'], content: Record<string, unknown>): DeskWidget {
  return { id: 'x', type, x: 0, y: 0, width: 10, height: 10, content };
}

describe('serializeBoard', () => {
  it('renders sticky, reference, and image cards with type labels', () => {
    const out = serializeBoard([
      widget('sticky', { text: 'a note' }),
      widget('reference', { title: 'Wikipedia', body: 'castles' }),
      widget('image', { label: 'a map' }),
    ]);
    expect(out).toBe('Note: a note\nLink: Wikipedia — castles\nClipping: a map');
  });

  it('skips cards with no text and returns empty string for an empty board', () => {
    expect(serializeBoard([])).toBe('');
    expect(serializeBoard([widget('sticky', {}), widget('image', {})])).toBe('');
  });
});

describe('makeNoteCard', () => {
  it('makes a sticky widget holding the text, staggered by index', () => {
    const card = makeNoteCard('hello', 2);
    expect(card.type).toBe('sticky');
    expect(card.content).toEqual({ text: 'hello' });
    expect(card.width).toBeGreaterThan(0);
    expect(card.height).toBeGreaterThan(0);
    expect(card.x).toBe(80 + 2 * 24);
    expect(card.y).toBe(80 + 2 * 24);
    expect(typeof card.id).toBe('string');
    expect(card.id.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- researchBoard`
Expected: FAIL — cannot resolve `./researchBoard`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/researchBoard.ts`:

```ts
/**
 * Research board helpers: turn a board's widgets into plain-text context for the
 * AI chat, and build a Note card from an assistant reply. Pure, leaf-level.
 */
import type { DeskWidget } from '@/store/workspaceStore';
import { DEFAULT_DIMS } from '@/components/editor/desk/deskConstants';

/** One line per card, labeled by type. Cards with no text are skipped. */
export function serializeBoard(widgets: DeskWidget[]): string {
    const lines: string[] = [];
    for (const w of widgets) {
        if (w.type === 'sticky') {
            const t = String(w.content?.text ?? '').trim();
            if (t) lines.push(`Note: ${t}`);
        } else if (w.type === 'reference') {
            const title = String(w.content?.title ?? '').trim();
            const bodyText = String(w.content?.body ?? '').trim();
            const joined = [title, bodyText].filter(Boolean).join(' — ');
            if (joined) lines.push(`Link: ${joined}`);
        } else if (w.type === 'image') {
            const label = String(w.content?.label ?? '').trim();
            if (label) lines.push(`Clipping: ${label}`);
        }
    }
    return lines.join('\n');
}

/** A Note (sticky) card holding `text`, lightly staggered by `index`. */
export function makeNoteCard(text: string, index = 0): DeskWidget {
    const dims = DEFAULT_DIMS.sticky;
    return {
        id: crypto.randomUUID(),
        type: 'sticky',
        x: 80 + index * 24,
        y: 80 + index * 24,
        width: dims.w,
        height: dims.h,
        content: { text },
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- researchBoard`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/researchBoard.ts src/lib/researchBoard.test.ts
git commit -m "feat: research board serialization and note-card helpers"
```

---

## Task 3: ResearchChatPanel component

**Files:**
- Create: `src/components/editor/research/ResearchChatPanel.tsx`

No unit test (no React test harness in this project; verified in the browser in Task 5).

- [ ] **Step 1: Create the component**

Create `src/components/editor/research/ResearchChatPanel.tsx`:

```tsx
"use client";

import React, { useRef, useState } from 'react';
import styles from '../WritingDesk.module.css';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ResearchChatPanelProps {
    /** null when no project is active — add-to-board is then disabled. */
    scopeKey: string | null;
    /** Reads the current board as plain text at send time. */
    getBoardContext: () => string;
    /** Appends the given text to the current board as a Note card. */
    onAddCard: (text: string) => void;
}

export function ResearchChatPanel({ scopeKey, getBoardContext, onAddCard }: ResearchChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        });
    };

    const send = async () => {
        const text = input.trim();
        if (!text || isStreaming) return;

        const outgoing: ChatMessage[] = [...messages, { role: 'user', content: text }];
        setMessages([...outgoing, { role: 'assistant', content: '' }]);
        setInput('');
        setIsStreaming(true);
        scrollToBottom();

        const appendToAssistant = (chunk: string) => {
            setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                    next[next.length - 1] = { ...last, content: last.content + chunk };
                }
                return next;
            });
            scrollToBottom();
        };

        try {
            const res = await fetch('/api/research-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: outgoing, board: getBoardContext() }),
            });
            if (!res.ok || !res.body) {
                const info = await res.json().catch(() => ({ error: 'Request failed' }));
                appendToAssistant(`[${info.error ?? 'Request failed'}]`);
                return;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                appendToAssistant(decoder.decode(value, { stream: true }));
            }
        } catch (err) {
            const detail = err instanceof Error ? err.message : 'network error';
            appendToAssistant(`\n\n[Chat failed: ${detail}]`);
        } finally {
            setIsStreaming(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <div className={styles.researchChat}>
            <div className={styles.researchChatHeader}>Research Assistant</div>

            <div className={styles.researchChatScroll} ref={scrollRef}>
                {messages.length === 0 && (
                    <div className={styles.researchChatEmpty}>
                        Ask about your research board, or anything else.
                    </div>
                )}
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`${styles.researchChatMsg} ${m.role === 'user' ? styles.researchChatMsgUser : styles.researchChatMsgAssistant}`}
                    >
                        <div className={styles.researchChatMsgBody}>{m.content}</div>
                        {m.role === 'assistant' && m.content.trim() && (
                            <button
                                className={styles.researchChatAddBtn}
                                disabled={!scopeKey}
                                title={scopeKey ? 'Add this reply to the board as a note' : 'Select a project first'}
                                onClick={() => onAddCard(m.content)}
                            >
                                + Add to board
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className={styles.researchChatInputRow}>
                <textarea
                    className={styles.researchChatInput}
                    placeholder="Message the research assistant…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={2}
                />
                <button className={styles.researchChatSendBtn} onClick={send} disabled={isStreaming || !input.trim()}>
                    {isStreaming ? '…' : 'Send'}
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/research/ResearchChatPanel.tsx
git commit -m "feat: ResearchChatPanel streaming chat UI"
```

---

## Task 4: Wire the panel into ResearchTab + styles

**Files:**
- Modify: `src/components/editor/ResearchTab.tsx`
- Modify: `src/components/editor/WritingDesk.module.css` (append)

- [ ] **Step 1: Append the layout + chat styles**

Append to the END of `src/components/editor/WritingDesk.module.css`:

```css

/* ── Research Tab two-column layout + AI chat ───────────── */
.researchLayout {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
  min-height: 0;
}

.researchMain {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.researchChat {
  display: flex;
  flex-direction: column;
  flex: 0 0 320px;
  width: 320px;
  min-height: 0;
  border-right: 1px solid var(--border, rgba(128, 128, 128, 0.2));
  background: var(--surface, rgba(128, 128, 128, 0.04));
}

.researchChatHeader {
  flex: 0 0 auto;
  padding: 10px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text, inherit);
  border-bottom: 1px solid var(--border, rgba(128, 128, 128, 0.2));
}

.researchChatScroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.researchChatEmpty {
  color: var(--muted, #888);
  font-size: 0.8rem;
  margin: auto;
  text-align: center;
  padding: 0 12px;
}

.researchChatMsg {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
}

.researchChatMsgUser {
  align-items: flex-end;
}

.researchChatMsgBody {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.82rem;
  line-height: 1.4;
  padding: 8px 10px;
  border-radius: 10px;
}

.researchChatMsgUser .researchChatMsgBody {
  background: var(--accent, #4a6fa5);
  color: #fff;
}

.researchChatMsgAssistant .researchChatMsgBody {
  background: var(--surface-2, rgba(128, 128, 128, 0.12));
  color: var(--text, inherit);
}

.researchChatAddBtn {
  align-self: flex-start;
  font-size: 0.68rem;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--border, rgba(128, 128, 128, 0.3));
  background: transparent;
  color: var(--muted, #888);
  cursor: pointer;
}

.researchChatAddBtn:hover:not(:disabled) {
  color: var(--text, inherit);
  border-color: var(--accent, #4a6fa5);
}

.researchChatAddBtn:disabled {
  opacity: 0.4;
  cursor: default;
}

.researchChatInputRow {
  flex: 0 0 auto;
  display: flex;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--border, rgba(128, 128, 128, 0.2));
}

.researchChatInput {
  flex: 1 1 auto;
  resize: none;
  font-family: inherit;
  font-size: 0.82rem;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(128, 128, 128, 0.25));
  background: var(--bg, transparent);
  color: var(--text, inherit);
}

.researchChatSendBtn {
  flex: 0 0 auto;
  align-self: flex-end;
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  background: var(--accent, #4a6fa5);
  color: #fff;
  cursor: pointer;
}

.researchChatSendBtn:disabled {
  opacity: 0.5;
  cursor: default;
}
```

- [ ] **Step 2: Rewrite ResearchTab for the two-column layout**

Replace the entire contents of `src/components/editor/ResearchTab.tsx` with:

```tsx
"use client";

import React, { useCallback, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { researchScopeKey, type ResearchScope } from '@/lib/researchScope';
import { serializeBoard, makeNoteCard } from '@/lib/researchBoard';
import WritingDesk from './WritingDesk';
import { ResearchEmptyState } from './ResearchEmptyState';
import { ResearchChatPanel } from './research/ResearchChatPanel';
import styles from './WritingDesk.module.css';

/**
 * Research Tab — an AI chat panel (left) beside a blank spatial board (right).
 * Owns the project/world scope switcher, feeds the active board to the chat as
 * context, and appends assistant replies to the board as Note cards on request.
 */
export default function ResearchTab() {
  const [scope, setScope] = useState<ResearchScope>('project');
  const activeProject = useWorkspaceStore(s =>
    s.projects.find(p => p.id === s.activeProjectId) ?? null
  );
  const scopeKey = researchScopeKey(scope, activeProject);

  // Read the board imperatively at call time so the chat panel doesn't
  // re-render on every board edit.
  const getBoardContext = useCallback(() => {
    if (!scopeKey) return '';
    const board = useWorkspaceStore.getState().researchStates[scopeKey];
    return serializeBoard(board?.widgets ?? []);
  }, [scopeKey]);

  const handleAddCard = useCallback((text: string) => {
    if (!scopeKey) return;
    const store = useWorkspaceStore.getState();
    const current = store.researchStates[scopeKey]?.widgets ?? [];
    store.updateResearchState(scopeKey, {
      widgets: [...current, makeNoteCard(text, current.length)],
    });
  }, [scopeKey]);

  return (
    <div className={styles.researchLayout}>
      <ResearchChatPanel
        scopeKey={scopeKey}
        getBoardContext={getBoardContext}
        onAddCard={handleAddCard}
      />
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
}
```

- [ ] **Step 3: Type-check and run the suite**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm test`
Expected: all tests pass (including the new `researchBoard` tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/ResearchTab.tsx src/components/editor/WritingDesk.module.css
git commit -m "feat: Research tab AI chat panel with board context and add-to-board"
```

---

## Task 5: Browser verification (local, requires Claude Code)

**Files:** none (manual verification with the preview tools).

- [ ] **Step 1: Open the app and the Research tab**

Start the dev server, sign in / select a project, and click the Research tab.
Expected: a chat panel on the left, scope bar + canvas on the right.

- [ ] **Step 2: Streaming reply**

Type "Say hello in five words" and send. Confirm a reply streams in token-by-token, and the Send button re-enables afterward.

- [ ] **Step 3: Board awareness**

Add a couple of Note/Link cards on the board (via the Add menu). In chat, ask "Summarize what's on my research board." Confirm the reply reflects the card text.

- [ ] **Step 4: Add to board**

Click "+ Add to board" on an assistant reply. Confirm a Note card appears on the canvas with that text, and that it persists after a page reload.

- [ ] **Step 5: Scope + no-project behavior**

Switch This Project ↔ This World and confirm the assistant's board context follows the active board. Then confirm the chat panel is still present with no project selected (empty board context; "+ Add to board" disabled).

- [ ] **Step 6: Error state**

Temporarily sign out of Claude Code (or rename it off PATH) and send a message. Confirm the panel shows a clear inline error rather than hanging. Restore Claude Code afterward.

- [ ] **Step 7: Final checks**

Run: `npm test`
Expected: all pass.
Run: `npx tsc --noEmit`
Expected: no errors.
```
