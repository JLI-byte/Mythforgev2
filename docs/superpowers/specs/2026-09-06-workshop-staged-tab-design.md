# The Workshop — Staged Tab Design

**Date:** 2026-09-06
**Status:** Approved

## Goal

Merge the Draft Table and Writing Desk into a single tab called **the Workshop**, moving through three stages: **Research → Drafting → Writing**.

## Why this is small

The Draft Table and Writing Desk are already the same React component. `WritingDesk` takes a `variant` prop, and the three existing variants map exactly onto the three stages:

| | Research | Drafting | Writing |
|---|---|---|---|
| `variant` | `'research'` | `'draft'` | `'desk'` |
| Board slice | `researchStates` | `draftStates` | `deskStates` |
| Global widgets | none | none | yes |
| Seeded Writing Zone | no | no | yes |
| Toolbar | Note / Clipping / Link | Writing Methods / Export | standard |

So this is a **navigation and shell change**, not a rewrite. No canvas code changes.

## Decisions

Three questions were settled before design:

1. **Research returns as stage 1.** It was removed in `62b2464`. Bringing it back rehomes `ResearchRail` — the interviews launcher and the Lore Check — which are currently orphaned with no host.
2. **One board per stage.** Switching stages swaps the canvas. This is what exists today, so no user data moves and no board migration is needed.
3. **Free navigation.** Any stage is clickable at any time. No gating.

## Architecture

### Where "stage" lives

Stage is a **sub-mode**: one workspace mode (`'desk'`), plus a separately persisted `deskStage`.

The alternative — keeping three workspace modes and drawing them as one tab — was rejected. It leaves the store, the mode bar and deep links as three things wearing a costume, so "one tab" would only be true visually.

### Layout

```
┌─ Workshop ────────────────────────────────┐
│  [ Research ] [ Drafting ] [ Writing ]    │  ← StageRail
├───────────────────────────────────────────┤
│                                           │
│   the active stage's canvas               │
│                                           │
└───────────────────────────────────────────┘
```

### Stage → body

| Stage | Renders |
|---|---|
| `research` | `<ResearchTab />` (restored, hosts `ResearchRail`) |
| `draft` | `<WritingDesk variant="draft" />` |
| `write` | `<WritingDesk variant="desk" />` |

## Store changes

- `WORKSPACE_MODES` drops `'template'`. One mode, `'desk'`, covers all three stages.
- New state `deskStage: DeskStage`, default `'write'`, added to `partialize` so it persists.
- New action `setDeskStage(stage)`.

### Legacy mapping

Two legacy mode strings must keep working:

| Legacy `workspaceMode` | Becomes |
|---|---|
| `'template'` | mode `'desk'`, stage `'draft'` |
| `'research'` | mode `'desk'`, stage `'research'` |

This mapping runs in **two** places:

1. **The rehydration guard** (`workspaceStore.ts`), *before* the existing "unknown mode → home" reset. Without this, anyone whose last session ended on the Draft Table lands on Home instead of the Drafting stage.
2. **The `?view=` handler** (`page.tsx`), so existing `?view=template` and `?view=research` links land on the right stage.

## Components

### New

| File | Responsibility |
|---|---|
| `src/lib/deskStages.ts` | Leaf module: stage list, labels, `variantForStage()`, `resolveLegacyMode()` |
| `src/lib/deskStages.test.ts` | Tests for the above |
| `src/components/editor/Workshop.tsx` | The staged shell: rail + active stage body |
| `src/components/editor/StageRail.tsx` | Three-button segmented control |
| `src/components/editor/StageRail.module.css` | Its styles |

All branching logic lives in `deskStages.ts`. `vitest.config.ts` collects only `src/**/*.test.ts` — never `.test.tsx` — so logic placed in a component file cannot be tested in this repo.

### Restored

Reverted from commit `62b2464`:

- `src/components/editor/ResearchTab.tsx`
- `src/components/editor/ResearchEmptyState.tsx`
- `src/components/editor/research/ResearchBoardBar.tsx`

`ResearchRail`, the interview components, `loreRules.ts`, `consistencyFlags.ts` and `articleSuggestions.ts` were deliberately kept on disk in that commit, so they need no restoration — only a mount.

### Modified

| File | Change |
|---|---|
| `workspaceStore.ts` | `deskStage`, `setDeskStage`, `WORKSPACE_MODES`, rehydration migration |
| `page.tsx` | One `<Workshop />` branch replaces the `template` and `desk` branches; `?view=` legacy mapping |
| `ModeBar.tsx` | Two entries collapse to one **Workshop** entry |
| `BeginOptions.tsx` | "Research First" returns; destinations become stages |
| `Bookshelf.tsx` | Story creation and open-project set mode **and** stage |
| `HomePage.tsx` | Quick links, quick capture destination, "Needs attention" tile |

## Reversals

Three changes made in `62b2464` were made *because* the research board became unreachable. That premise is gone, so they revert:

- **Quick capture** returns to the research board (currently writes to the desk board).
- **"Needs attention" tile** returns to Home, along with `attentionCounts` — it counts Lore Check output, which has a home again.
- **"Research First"** returns to `BeginOptions`, mapping to stage 1.

## Naming

The tab is **the Workshop**. "Writing Desk" could not be reused as the tab name because Writing is now a stage inside it.

Stage labels are **Research**, **Drafting**, **Writing**. The surfaces keep their own names inside each stage — the Drafting stage still presents the Draft Table.

## Error handling

- An unknown persisted `deskStage` falls back to `'write'`, matching how an unknown `workspaceMode` falls back to `'home'`.
- The Research stage already handles a null scope key by rendering `ResearchEmptyState` — no active project means no board, and that path is unchanged.

## Testing

**Unit** (`deskStages.test.ts`):
- `variantForStage()` returns the right `WritingDesk` variant for each of the three stages
- `resolveLegacyMode()` maps `'template'` and `'research'` to the right mode + stage pair
- `resolveLegacyMode()` leaves every current mode untouched
- Stage order is Research, Drafting, Writing

**Regression:** the existing 641 tests stay green.

**Browser:** each stage renders its own canvas; the rail switches between them; a persisted `'template'` mode lands on Drafting; `?view=research` lands on Research.

## Out of scope

- No change to any canvas, widget or board behaviour.
- No hand-off automation between stages. The Draft Table's existing "Export to the Writing Desk" button stays exactly as it is.
- No board data migration.
