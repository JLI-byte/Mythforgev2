# Standard Landing Page — Design

**Date:** 2026-06-30
**Status:** Approved (design)
**Author:** LoreCanvas / Claude Code

## Goal

Add a second public landing theme: a **minimal, modern, dark** ("black theme")
hero-only page with an **animated dotted-wave background**, inspired by the
21st.dev `dotted-surface` component but implemented without three.js.

It becomes the **new default** landing. The existing Fantasy Storybook landing
stays available via the theme switcher, unchanged.

## Decisions (locked)

- **Scope:** Hero only. No feature sections, no always-visible form.
- **Default:** `standard` becomes the default theme; `fantasy` remains a
  switcher option.
- **Background:** Lightweight custom canvas dotted-wave. **No three.js**,
  **no next-themes.** Chosen for performance.
- **Request access CTA:** Opens a small modal reusing `submitBetaRequest`.
- **Copy:** Proposed copy is a starting point; refine live in preview.

## Visual Direction

- Full-bleed near-black background; the whole landing is dark regardless of the
  app's `data-theme` (it is self-contained, like the fantasy landing owns its
  own look).
- Animated dotted-wave `<canvas>` behind the content.
- Centered hero, clean sans typography using the app's existing font stack
  (no new font dependency).
- Restrained motion; honors `prefers-reduced-motion`.

## Structure (hero only)

- **Brand mark** top-left: `LoreCanvas`.
- **Hero (centered):**
  - Headline (starting point): "Write your world into existence."
  - Subhead (starting point): "The writing desk for novelists and worldbuilders
    — manuscript, lore, and momentum in one place."
  - CTAs:
    - Primary: **Request beta access** → opens `RequestAccessModal`.
    - Secondary: **Beta tester sign in** → `/login`.
- **Footer:** thin line — `© <year> LoreCanvas` + sign-in link.

## Components

### `DottedSurface.tsx` (client)

Self-contained animated background.

- Renders a fixed, full-viewport `<canvas>`, `z-index: -1`,
  `pointer-events: none`, behind all content.
- Draws a grid of dots. A travelling sine wave modulates each dot's vertical
  offset and opacity so the field "flows like water."
- 2D canvas context. Density is capped; canvas is sized with a DPR cap to keep
  fill cost low on large/ultrawide displays.
- Pauses the RAF loop when the tab is hidden (`visibilitychange`).
- Under `prefers-reduced-motion: reduce`, renders a single static frame (no
  animation loop).
- Fixed dark palette (faint neutral dots on near-black). Not dependent on
  `data-theme` or next-themes.
- Cleans up RAF, resize, and visibility listeners on unmount.

### `RequestAccessModal.tsx` (client)

Compact beta-request modal.

- Fields: email (required), name (optional), what-you're-writing (optional) —
  the same shape `submitBetaRequest({ name, email, reason })` already accepts.
- Reuses `src/app/welcome/shared/betaRequest.ts` (`submitBetaRequest`,
  `BetaRequestResult`).
- Surfaces the existing result states: `done` (success), `duplicate`
  (already on the list), `error` (retry).
- Closes on backdrop click / Escape / success dismissal. Focus-trapped, dark
  styling to match the landing.

### `StandardLanding.tsx` (client)

Composes the page: `DottedSurface` + hero + footer, and owns the modal open
state. Sets `document.documentElement.dataset.lcLanding = 'standard'` on mount
and clears it on unmount (mirrors the fantasy landing's pattern), so
page-scoped CSS can target it if needed.

### `standard.module.css`

Scoped styles for the standard landing: layout, dark palette, typography,
button styles, hero reveal (subtle), responsive behavior.

## Wiring / Integration

- `src/app/welcome/themes/registry.ts`
  - Add `{ id: 'standard', name: 'Minimalist', tagline: 'Dark & modern' }` to
    `LANDING_THEMES`.
  - Change `DEFAULT_THEME_ID` from `'fantasy'` to `'standard'`.
- `src/app/welcome/page.tsx`
  - Add `standard: dynamic(() => import('./themes/standard/StandardLanding'))`
    to `THEME_COMPONENTS`.
- No changes to `FantasyLanding` or the fantasy assets.
- No changes to middleware (unauthenticated visitors already land on
  `/welcome`).

## File Plan (new)

```
src/app/welcome/themes/standard/
  StandardLanding.tsx
  DottedSurface.tsx
  RequestAccessModal.tsx
  standard.module.css
```

## Out of Scope

- Feature/landmark sections.
- three.js and next-themes.
- New font families.
- Changes to the fantasy landing.
- Authenticated app theming.

## Risks / Notes

- **Default switch impact:** flipping `DEFAULT_THEME_ID` changes what every
  first-time / storage-less visitor sees. Fantasy is still reachable via the
  switcher and via a persisted prior choice. Acceptable and intended.
- **Canvas performance:** density cap + DPR cap + hidden-tab pause + reduced
  motion keep it cheap. Verify in preview on the widest viewport.
- **Registry test:** `registry.test.ts` exists; changing the default may need a
  test update. Handle in the plan.

## Verification

In the preview (`/welcome`):
- Standard loads by default (fresh visitor / cleared `localStorage`).
- Dots animate smoothly; static under reduced-motion; paused on hidden tab.
- CTAs: "Sign in" → `/login`; "Request beta access" opens the modal.
- Modal submits via `submitBetaRequest`; success / duplicate / error states show.
- Theme switcher still toggles to fantasy and back; choice persists.
- Quick perf sanity on the widest viewport.
