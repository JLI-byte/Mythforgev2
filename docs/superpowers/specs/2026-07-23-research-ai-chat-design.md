# Research AI Chat — Design Spec

**Date:** 2026-07-23
**Status:** Approved for Phase 1
**Author:** brainstormed with Claude
**Depends on:** the Research tab ([2026-07-23-research-tab-design.md](2026-07-23-research-tab-design.md)) — must be built first.

## Summary

Add an AI chat panel to the left side of the Research tab. The assistant is
backed by the user's **local Claude Code** (via the Claude Agent SDK), so
replies run on their Max subscription with no separate API bill. The chat is
**board-aware** — it receives the text of the current research board's cards as
context — and each reply can be dropped onto the board as a Note card via an
**"+ Add to board"** button.

This is a **local/desktop-only** feature: it drives the local Claude Code
install and cannot work on a deployed multi-user site.

## Goals (Phase 1)

- A left-hand chat panel in the Research tab: message list, input box, streaming
  replies.
- Backend server route that talks to local Claude Code through the Claude Agent
  SDK, locked down so the assistant cannot touch the filesystem or run commands.
- Board-aware: each request includes the current board's card text as context,
  respecting the This Project / This World scope toggle.
- "+ Add to board" button on each assistant reply that creates a Note card on the
  current board.
- Panel is always visible (works as a plain assistant when no project is active).

## Non-Goals (Phase 1)

- **Model-driven card creation** (the model calling an `add_research_card` tool)
  — deferred to Phase 2.
- Anthropic API-key backend (portable, separate billing) — explicitly not chosen;
  the panel's backend is a single route so it could be swapped later.
- Persisting chat history across reloads (Phase 1 chat is in-memory per session).
- Multi-conversation threads, retries, or editing prior messages.
- Any deployment/multi-user support.

## Prerequisites & Key Risk

- **Claude Code must be installed and signed in on Max** on the machine running
  the app. The Next.js server process spawns it.
- **New dependency:** `@anthropic-ai/claude-agent-sdk`.
- **KEY VERIFICATION (highest-risk item):** confirm — against the Claude Agent
  SDK docs (`code.claude.com/docs/en/agent-sdk`) — that the SDK uses the local
  Claude Code credentials (the Max subscription) and **not** an Anthropic API
  key. In particular: the server environment running the route must **not** set
  `ANTHROPIC_API_KEY`, or the SDK may bill API usage instead of using the
  subscription. The implementation plan's first task is a spike that proves a
  round-trip reply comes back through the subscription before any UI is built.

## Existing Architecture Being Reused

- **Research tab wrapper** (`src/components/editor/ResearchTab.tsx`) owns the
  scope switcher and the resolved `scopeKey`. It is the natural place to read the
  active board and to add cards, and to host the new two-column layout.
- **Board storage:** `researchStates[scopeKey]` (a `DeskState`) holds the board's
  `widgets`. Cards are `sticky` (Note), `image` (Clipping), `reference` (Link).
- **Adding a card:** `updateResearchState(scopeKey, { widgets })` appends a
  widget. New Note cards reuse `DEFAULT_DIMS.sticky` and the `sticky` widget shape
  (`content: { text }`).
- **Reading a card's text:** sticky → `content.text`; reference → `content.title`
  / `content.url`; image → `content.label` / `content.caption`.

## Design

### 1. Layout

`ResearchTab` becomes a two-column flex row:

```
┌─ researchLayout (flex row) ─────────────────────────────┐
│ ┌ ResearchChatPanel ┐ ┌ researchMain (flex col) ──────┐ │
│ │  messages          │ │  scope bar (This Project…)    │ │
│ │  …                 │ │  ┌ canvas host ─────────────┐ │ │
│ │  [input] [send]    │ │  │  WritingDesk variant=…    │ │ │
│ └────────────────────┘ │  └──────────────────────────┘ │ │
│                        └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

- Chat panel is a fixed-width left column (with a sensible default, e.g. 320px),
  collapsible via a toggle. Resizing is a nice-to-have, not required for Phase 1.
- The panel is **always rendered**, including in the no-project empty state (the
  right column still shows `ResearchEmptyState`; the chat works as a plain
  assistant with empty board context).

### 2. Chat panel component

`src/components/editor/research/ResearchChatPanel.tsx`

- Local React state: `messages: { role: 'user' | 'assistant'; content: string }[]`,
  the input value, and a streaming/loading flag.
- On send: append the user message, POST to `/api/research-chat` with the full
  message list plus the serialized board context, then append an assistant
  message that fills in as tokens stream.
- Each assistant message renders an **"+ Add to board"** button that calls
  `onAddCard(message.content)`.
- Props: `scopeKey: string | null`, `boardContext: string`,
  `onAddCard: (text: string) => void`.
- Errors (route failure, Claude Code not installed / not logged in) render as an
  inline assistant-style error bubble with a plain-language message — never a
  silent failure.

### 3. Board context

- `ResearchTab` reads `researchStates[scopeKey]` and serializes the board into a
  compact plain-text block: one line per card, labeled by type (Note / Link /
  Clipping) with its text. Empty when `scopeKey` is null or the board has no
  cards.
- This string is passed to the panel as `boardContext` and sent with each
  request. A pure helper (`serializeBoard(widgets)`) keeps this testable.

### 4. Add-to-board

- `ResearchTab` passes `onAddCard(text)` to the panel. It appends a `sticky`
  widget to the current board:
  - `type: 'sticky'`, `content: { text }`, `width/height` from
    `DEFAULT_DIMS.sticky`, placed at a lightly-staggered position so repeated adds
    don't stack exactly.
  - Persisted via `updateResearchState(scopeKey, { widgets: [...existing, card] })`.
- Disabled / no-op when `scopeKey` is null (no active board to add to); the button
  reflects that state.

### 5. Backend route

`src/app/api/research-chat/route.ts`

- `POST` handler. `export const runtime = 'nodejs'` (must spawn a subprocess) and
  `export const dynamic = 'force-dynamic'`.
- Request body: `{ messages: {role, content}[], board: string }`.
- Builds a system prompt: the assistant is a worldbuilding/writing research
  assistant; include the `board` context; instruct concise, source-aware answers.
- Calls the Claude Agent SDK `query(...)` with:
  - `model` default `claude-opus-4-8`.
  - The built-in file/bash/edit/web tools **disabled** (locked-down conversational
    agent) — exact option names confirmed against the Agent SDK docs.
  - Streaming enabled.
- Streams the assistant text back to the client as a `ReadableStream` of text
  chunks; the client appends them live.
- On failure (SDK throws, Claude Code missing/unauthenticated), return a non-2xx
  with a JSON `{ error }` the panel surfaces verbatim.

### 6. Model & subscription

- Default model `claude-opus-4-8`.
- The route relies on local Claude Code auth (Max). The server env must not set
  `ANTHROPIC_API_KEY` (see Key Risk). If a hard requirement to force subscription
  auth exists in the SDK, set it explicitly per the SDK docs.

## Data Flow

1. User types in the panel → panel appends the user message and POSTs
   `{ messages, board }` to `/api/research-chat`.
2. Route builds the system prompt (with board context) and calls the Agent SDK,
   which drives local Claude Code (Max subscription).
3. Assistant text streams back; the panel fills in the assistant message live.
4. User clicks "+ Add to board" on a reply → `onAddCard(text)` appends a sticky to
   `researchStates[scopeKey]` → the card appears on the canvas and persists.
5. Switching scope (project ↔ world) re-derives `boardContext` from the newly
   active board.

## Error Handling & Edge Cases

- **Claude Code not installed / not logged in:** the SDK call fails; the route
  returns `{ error }`; the panel shows a clear inline message telling the user to
  install / sign into Claude Code.
- **No active project:** chat still works (empty board context); "+ Add to board"
  is disabled.
- **Empty board:** context block is empty; the assistant is told the board is
  empty.
- **Stream interrupted:** the partial assistant text remains; a trailing error
  note is appended.
- **Never runs destructive tools:** built-in file/bash tools are disabled, so the
  assistant cannot modify the user's machine even under prompt injection from
  board content.

## Testing

- **Unit:** `serializeBoard(widgets)` — sticky/link/clipping rendering, empty
  board, mixed types. Pure function, table-driven.
- **Unit:** the add-card helper appends a correctly-shaped sticky widget to the
  right scope key and leaves others untouched (immutability).
- **Manual / integration (local, requires Claude Code):**
  - Panel renders on the left; sending a message streams a reply.
  - Ask "summarize my board" with cards present → reply reflects the cards.
  - "+ Add to board" creates a Note card that persists across reload.
  - Scope toggle changes which board the assistant sees.
  - With Claude Code signed out, the panel shows the clear error state.
- **Spike (Task 1 of the plan):** prove a round-trip reply comes back via the Max
  subscription (no API key) before building UI.

## Later Phases (not designed here)

- **Phase 2 — model-driven cards:** expose an `add_research_card` tool to the
  model via the Agent SDK so it can place cards itself; handle the tool-call
  round-trip and render tool activity in the panel.
- **Later:** persist chat history per board; multiple threads; retry/edit;
  optional Anthropic API-key backend for a deployed build.

## Files Touched (Phase 1, anticipated)

- `package.json` — add `@anthropic-ai/claude-agent-sdk`.
- `src/app/api/research-chat/route.ts` — new streaming route (Node runtime).
- `src/components/editor/research/ResearchChatPanel.tsx` — new chat UI.
- `src/components/editor/ResearchTab.tsx` — two-column layout; derive
  `boardContext`; provide `onAddCard`.
- `src/lib/researchBoard.ts` (+ test) — `serializeBoard(widgets)` and the
  add-card widget helper.
- `src/components/editor/WritingDesk.module.css` (or a new module) — chat panel +
  layout styles.
