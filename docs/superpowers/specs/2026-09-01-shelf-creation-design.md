# Creating worlds and books from the Home shelf — design

**Date:** 2026-09-01
**Branch:** `feature/app-styling`
**Status:** approved, not yet implemented

## Problem

The Home world shelf is read-only. You can open a world and open a book, but
starting either means going to the Bookshelf page. The shelf shows you what you
have and gives you no way to add to it.

## Constraint shaping this design

`Bookshelf.tsx` currently has **uncommitted, in-flight work** — 116 insertions
covering `storyStep`, `storySubTypeId`, `storyBrief`, `WorkTypeArtwork` and
`pickSubType`, which is precisely the story-creation modal.

The obvious clean answer — extract both creation flows into shared components
used by the Bookshelf and Home alike — would mean refactoring underneath
unfinished work. This design routes around that file instead, and names the
consolidation as a follow-up for once that work lands.

## The asymmetry that decides the approach

A **world** needs a name. `addWorld` takes genre, tone, tech level, period and
logline, and every one of them has a working default that is editable later on
the Bookshelf. The three-step wizard collects polish, not requirements.

A **book** is real orchestration: project, draft state, document and scene, plus
a work-type choice that sets `writingMode` and `draftTypeId` and shapes what the
app offers afterwards. Creating one without that choice quietly picks for you.

So: worlds are created inline, books route to the flow that already asks the
question.

## 1. New world — a "+" spine

A dashed "+" spine sits at the end of the shelf. Clicking it replaces the panel
contents with an inline form: a single name field, Create and Cancel.

On create the world takes the same defaults the wizard applies — genre
`fantasy`, tech level `medieval`, balanced tone, empty logline, `magicExists`
false, a random `COVER_COLORS` entry — and the new shelf is selected
immediately, so the writer lands inside what they just made.

Create is disabled while the name is blank. Enter submits, Escape cancels.

## 2. New book — a "+" cover

A dashed empty slot follows the story covers in the opened panel. It routes to
the Bookshelf with the existing work-type flow open, pre-filed to the world that
was selected.

The writer keeps the "what am I writing?" question, because the answer is hard
to change afterwards.

## 3. The handoff

A transient store field `pendingNewStoryWorldKey: WorldKey | null`, with actions
`requestNewStory(key)` and `clearPendingNewStory()`.

Home sets it, then switches to `bookshelf` mode. The Bookshelf reads it on
arrival, opens its story modal filed to that world, and clears it.

**It must stay out of `partialize`.** Persisted, a reload would reopen the
creation modal unbidden. It joins `selectedEntityId` and the research-chat
attachment as an explicitly non-persisted field.

The standalone shelf has no world, so `STANDALONE_KEY` maps to `undefined` when
handed to `handleCreateStory`, which already takes an optional world id.

## 4. Where the world defaults live

A new store action:

```ts
createWorld(name: string): string   // returns the new world's id
```

It holds the defaults and the random cover colour, and returns the id so the
caller can select the new shelf.

**Resolved.** The Bookshelf wizard originally applied these same defaults
inline, and this design accepted the duplication rather than edit
`Bookshelf.tsx` while it held uncommitted work. Once that landed, `createWorld`
gained an optional overrides argument and the wizard now calls it, passing only
the fields it collects. Undefined overrides are dropped, so a field the writer
never touched keeps its default instead of clobbering it.

`NewWorldModal.tsx` also builds a world by hand, but nothing mounts it — it is
an orphaned component, not a live third path. `betaSeedData.ts` specifies every
field deliberately for a fixed demo world, so it is not duplicating defaults
either.

## 5. WorldShelf stays presentational

Both affordances arrive as optional props:

```ts
onCreateWorld?: (name: string) => void;
onNewStory?: () => void;
```

The component renders the "+" spine and "+" cover only when the matching prop is
supplied, so it keeps its store-free boundary and the full-page Bookshelf can
later pass its own handlers.

The inline form's input state is local component state. That is UI state, not
data, and does not breach the boundary.

## 6. Empty states

The existing "Your shelf is empty" branch renders before any spines. It gains
the same inline create form, so a writer with nothing can make their first world
without leaving Home — otherwise the "+" spine is unreachable for exactly the
person who most needs it.

## Testing

- `createWorld` — store-level assertions that defaults are applied, a cover
  colour comes from `COVER_COLORS`, the returned id matches the added world, and
  the name is trimmed
- `pendingNewStoryWorldKey` is absent from `partializeWorkspace`

Browser verification: a world created from Home appears on the Bookshelf with
the right defaults; a book started from Home opens the work-type flow pre-filed
to the correct shelf; the standalone shelf routes with no world id; a reload
does not reopen the modal.

## Out of scope

No delete, no rename, no cover editing from Home. Those are destructive or
fiddly and the Bookshelf already has them.
