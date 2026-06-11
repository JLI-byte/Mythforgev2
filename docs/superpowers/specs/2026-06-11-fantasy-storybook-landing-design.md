# Fantasy Storybook Landing — "The Cartographer's Desk"

**Date:** 2026-06-11
**Status:** Approved by Jimi (vibe interview + design review in session)
**Scope:** Redesign of the `/welcome` beta landing page as the first of multiple
switchable landing themes.

## Vision

A parchment storybook-atlas landing page. An ink map draws itself when you
arrive; a vermilion travel route draws down the page as you scroll, with the
product's features as landmarks along the way. The beta request form is a
letter to the Cartographer, sealed with wax. Full storybook tone — the page
commits to the fiction.

Decided in the vibe interview:

| Decision | Choice |
|----------|--------|
| Direction | Parchment editorial |
| Flavor | Storybook atlas (maps, compass roses, wax seals, warm whimsy) |
| Hero | Self-drawing ink map + scrollytelling route through features |
| Palette | Cartographer: vermilion, verdigris, sepia, gold leaf on parchment |
| Tone | Full storybook (copy commits to the fiction) |
| Implementation | Hand-crafted SVG + CSS scroll-driven animation, zero new dependencies |
| Theming | Multi-theme architecture; Fantasy Storybook is theme #1 and default |

## Palette

| Token | Hex | Role |
|-------|-----|------|
| `--parchment` | `#f3e8cf` | Page background |
| `--sepia` | `#3b2c15` | All text, line art |
| `--vermilion` | `#c8401f` | Primary CTA, route line, seals, emphasis |
| `--verdigris` | `#3d7068` | Secondary links, stamps, water details |
| `--gold-leaf` | `#b08d2f` | Tiny precious touches (compass needle, stars) |
| `--royal-purple` | `#5b3a8c` | Optional single Isomeric wax-seal cameo only |

Brand note: royal purple is the Isomeric company color but each project owns
its identity. Purple appears at most once, as a small wax-seal cameo, and may
be dropped entirely.

## Typography

- **Display / headings:** IM Fell English (Google Fonts) — digitized
  17th-century type, authentic atlas feel.
- **Body:** EB Garamond (Google Fonts).
- **Form inputs and small UI:** Inter (already loaded as `--font-sans`) for
  legibility.
- Loaded via `next/font/google` in the welcome route (not the root layout) so
  the app workspace doesn't pay for them.

## Page structure

1. **Nav** — parchment bar, ink wordmark, verdigris "Beta tester sign in"
   link to `/login`.
2. **Hero (~100vh)** — full-bleed SVG ink map (coastline, mountain ridges,
   compass rose, dashed sea routes) that draws itself on load.
   - H1: "Every legend begins with a blank map."
   - Sub: LoreCanvas as the cartographer's desk for fiction writers.
   - Primary CTA "Begin your journey" → `#letter` (vermilion).
   - Secondary "I carry an invitation" → `/login` (verdigris link).
3. **The Journey (scrollytelling)** — a vermilion dotted route draws downward
   as the user scrolls. Four landmark stops, alternating left/right, each
   with an etched SVG icon, storybook landmark name, real feature name, and
   description:
   - **The Desk** — The Writing Desk (infinite canvas around the manuscript)
   - **The Archive** — World Bible (linked lore, `[[` entity linking)
   - **The Hearth** — Goals & Streaks (word targets, heatmap, badges)
   - **The Vault** — Export (Markdown/Word/EPUB, backups, no lock-in)
4. **Margin easter egg** — small sea-serpent etching beside the route with
   "here be dragons" in tiny italic.
5. **The Letter (`#letter`)** — beta request form restyled as a letter to the
   Cartographer. Field labels: "Your name, traveler" / "Where ravens may find
   you" (email) / "What tale are you charting?". Submit button is a wax-seal
   styled "Seal & send". Success state: "Your letter is sealed. Watch the
   skies for a raven." Duplicate-email state keeps the same letter framing.
6. **Footer** — colophon style: "Charted with care · LoreCanvas © year ·
   Beta tester sign in".

## Theme system architecture

The user wants multiple full design settings ("themes") for the landing page,
switchable by the visitor. Fantasy Storybook is theme #1.

```
src/app/welcome/
├── page.tsx                  — thin shell: theme registry + active theme render
├── themes/
│   ├── registry.ts           — { id, name, component } list; fantasy = default
│   └── fantasy/
│       ├── FantasyLanding.tsx
│       ├── fantasy.module.css
│       ├── fantasy-scroll.css — scroll-driven route animation (global, scoped
│       │                        to html[data-lc-landing="fantasy"])
│       └── art/               — MapHero.tsx, RoutePath.tsx, landmark icons,
│                                seals (hand-authored SVG components)
└── shared/
    ├── BetaRequestForm.tsx    — headless: state + Supabase insert exposed via
    │                            render prop; each theme styles its own form
    └── ThemeSwitcher.tsx      — small fixed control (compass icon); reads the
                               registry; persists choice in localStorage
```

Rules:

- Theme components own 100% of their visuals; no shared landing CSS beyond
  the form logic component.
- `BetaRequestForm` contains the existing Supabase `beta_requests` insert,
  the 23505 duplicate handling, and submit state — moved, not rewritten.
- The switcher renders even with one theme (disabled/single state) so the
  slot is proven from day one.
- Adding a theme = new folder + one registry entry. No changes to shell or
  form logic.

## Motion

- **Hero map draw-in:** SVG paths animate `stroke-dashoffset` from full
  length to 0 on load; staggered ~2.5s total; CSS only.
- **Scroll route:** route path draws with CSS scroll-driven animation
  (`animation-timeline`), same technique already proven on the current
  landing page. Landmarks ink-fade and rise as they enter the viewport.
- **Fallbacks:** browsers without scroll-driven animation support show the
  route fully drawn (static). `prefers-reduced-motion: reduce` disables all
  animation; everything renders pre-drawn.
- No GSAP, no Tweakpane, no new dependencies.

## Unchanged

- Supabase `beta_requests` insert logic and error handling
- `/login` flow and middleware redirect behavior
- Mobile responsiveness expectations (no horizontal overflow at 375px)
- Accessibility: sr-only equivalents for decorative text, semantic headings,
  labeled form fields

## Out of scope

- Additional themes beyond Fantasy Storybook (architecture ready, not built)
- App workspace theming (this is landing-page only)
- Replacing the existing `/login` page design
