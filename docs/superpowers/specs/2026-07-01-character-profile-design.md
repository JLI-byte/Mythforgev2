# Character Profile ("Glamour") — Design

**Date:** 2026-07-01
**Status:** Approved (design)
**Reference:** codepen.io/mahricodes/pen/EaNZwYG ("GLAMOUR V1 [PROFILE CODE]")

## Goal

Give character-type World Bible entities a rich, multi-page editorial profile
("character sheet") modelled on the GLAMOUR pen: a left image panel with a big
vertical name and page number, and a right content area with four navigable
pages — Main, Persona, Appearance, Relations. Every field is author-editable and
stored on the entity.

## Scope & Placement

- Applies to **character** entities only (`entity.type === 'character'`). Other
  entity types keep the existing `ArticleReadView`.
- Opened from the World Bible: expanding strip → entity card → profile. In
  `WorldBibleCenter`, when the selected entity is a character, render
  `CharacterProfile` instead of `ArticleReadView`.
- Keeps the pen's editorial aesthetic as the profile's own identity (cream paper,
  wine/gold accents, serif display type) even though the surrounding app is dark.
- **Dropped:** the pen's music player.

## Data Model

Add an optional structured `profile` object to `Entity` (new type
`CharacterProfile`). All fields optional so a fresh character renders with
graceful placeholders. Persisted through the existing
`updateEntity(id, { profile })`.

```ts
interface ProfileImage {
    url?: string;      // base64 or URL (same handling as entity.imageUrl)
    caption?: string;
}

interface ProfileField {
    label: string;
    value: string;
}

interface ProfileMeter {
    label: string;
    level: number;     // 0–100
}

interface PersonaRow {
    image?: string;
    label?: string;    // e.g. "Social Behaviour"
    heading?: string;
    text?: string;
}

interface PaletteSwatch {
    name: string;
    hex: string;
}

interface LookItem {
    label: string;     // Faceclaim / Clothing / Accessories …
    value?: string;
    image?: string;
}

interface AppearanceSection {
    label: string;     // Features / Clothing Style …
    note?: string;
    moodboard?: ProfileImage[];
}

interface RelationEntry {
    image?: string;
    name?: string;
    relation?: string; // e.g. "Sister", "Rival"
    text?: string;
}

interface CharacterProfile {
    // Left panel
    tagline?: string;              // side quote
    decorImages?: string[];        // customizable decorative images (florals)
    // Top bar
    quote?: string;
    // Main
    fullName?: string;
    dossier?: ProfileField[];      // Age, Gender, Sexuality, Origin, Job, Role, Status + custom
    firstImpression?: string;
    bio?: string;
    // Persona
    corePersonality?: { image?: string; heading?: string; text?: string };
    personaRows?: PersonaRow[];
    meters?: ProfileMeter[];
    dos?: string;
    donts?: string;
    // Appearance
    palette?: PaletteSwatch[];
    lookbook?: LookItem[];
    visualImpression?: string;
    appearanceSections?: AppearanceSection[];
    // Relations
    relations?: RelationEntry[];
}
```

`Entity` gains: `profile?: CharacterProfile;`

### Defaults

New/empty characters get a default `profile` scaffold so the pages aren't blank:
- `dossier` seeded with the 7 standard labels (Age, Gender, Sexuality, Origin,
  Job, Role, Status) with empty values.
- `meters` seeded with a few examples (empty is fine too).
- Everything else empty → shows a muted "add later" placeholder in view mode.

The profile's `fullName` falls back to `entity.name`; the portrait falls back to
`entity.imageUrl`.

## Layout / Rendering

`CharacterProfile.tsx` renders the pen structure, driven by `profile`:

- **Left panel:** portrait (`imageUrl`), `tagline`, decorative `decorImages`
  layered decoratively, big vertical `fullName`, page number (01–04 tracking the
  active page).
- **Top bar:** `quote`.
- **Page nav:** four buttons (Main / Persona / Appearance / Relations); active
  page shown, others hidden; page number updates.
- **Main page:** dossier (fullName + fields grid), first-impression card, bio.
- **Persona page:** core-personality feature (image + heading + text),
  alternating `personaRows` (image/text, reversed on odd), `meters` as labelled
  level bars (`--level`), Do's / Don'ts notes.
- **Appearance page:** `palette` swatches (colour chip + name + hex), `lookbook`
  items (image + label + value), `visualImpression`, `appearanceSections` each
  with a moodboard image grid.
- **Relations page:** `relations` cards (portrait + name + relation + note).

Empty collections render a muted placeholder ("No relations yet", etc.) in view
mode.

## Editing

An **Edit toggle** in the profile switches the whole card into edit mode:
- Text fields → inline `input`/`textarea`.
- Meters → range sliders (0–100) with the level bar live-preview.
- Repeatable collections (dossier fields, persona rows, meters, palette,
  lookbook, appearance sections + moodboard items, relations, decor images) →
  add / remove controls.
- Image fields → URL input **or** file upload, reusing the app's existing
  base64/image handling (as `entity.imageUrl` does).
- Edits update local state and persist to `entity.profile` via `updateEntity`
  (debounced or on blur/toggle-off — implementation detail for the plan).

## Fonts

Add the pen's display fonts via `next/font/google` (project already uses
`next/font`): Playfair Display, Cormorant Garamond, Nunito. Scoped to the
profile via CSS variables so they don't leak into the rest of the app.

## Files

- `src/store/workspaceStore.ts` — add `CharacterProfile` (+ sub-types) and
  `Entity.profile`; a default-profile helper; ensure `updateEntity` persists it.
- `src/components/world/CharacterProfile.tsx` + `.module.css` — the 4-page view.
- `src/components/world/profile/` — smaller sub-components per page and the
  editor field controls (kept small/focused; exact split decided in the plan).
- `src/app/.../fonts` — profile font definitions.
- `src/components/world/WorldBibleCenter.tsx` — route character entities to
  `CharacterProfile`.

## Build Order (phases within this spec)

1. **Schema + read-only profile.** Add the types + default scaffold; build the
   full 4-page styled view (left panel, nav, all sections) rendering from
   `profile` with placeholders; wire into `WorldBibleCenter`. Fonts + styling
   ported from the pen (greyscale-independent; keeps the glamour palette).
2. **Editing.** Edit toggle + inline editors for every field, sliders for
   meters, add/remove for collections, image URL/upload, persistence via
   `updateEntity`.

Each phase is independently shippable: after phase 1 the profile displays; after
phase 2 it's fully editable.

## Out of Scope

- Music player.
- Non-character entity redesign (locations, factions, etc.).
- Relationship graph / auto-linking between characters (relations are
  free-form entries for now).
- Per-character theme/palette customization (keeps one glamour palette; can be
  revisited later).

## Verification

- Open a character from the World Bible → glamour profile renders; non-character
  entities still show the old article view.
- Page nav flips between the four pages; page number + big name update.
- Phase 2: toggling Edit lets you change every field; add/remove works on each
  collection; meter sliders update the bars; images accept URL and upload; edits
  survive a reload (persisted on the entity).
- `npm test`, `npm run lint`, `npm run build` all pass.
