# Character Profile — Phase 1 (Schema + Read-Only View) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `CharacterProfile` schema to entities and a read-only 4-page "glamour" profile (Main / Persona / Appearance / Relations) that renders for character entities in the World Bible, styled from codepen.io/mahricodes/pen/EaNZwYG.

**Architecture:** A fixed 900×720 card (the pen's dimensions) centered in the World Bible center column. `CharacterProfile.tsx` owns the active-page state and composes a left image panel + four page components, each rendering from `entity.profile` with graceful placeholders. Editing is Phase 2 (separate plan).

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, `next/font/google`, Vitest.

**Reference CSS:** the pen's stylesheet is the source of truth for section styling. To view it while implementing:
```bash
curl -sL -A "Mozilla/5.0" -e "https://codepen.io/" "https://cdpn.io/mahricodes/fullpage/EaNZwYG" -o /tmp/glam.html
perl -0777 -ne 'while(/<style[^>]*>(.*?)<\/style>/gs){$c=$1 if length($1)>length($c)} END{print $c}' /tmp/glam.html
```

---

## File Structure

New:
- `src/components/world/profile/profileFonts.ts` — Playfair Display, Cormorant Garamond, Nunito via `next/font/google`.
- `src/components/world/profile/CharacterProfile.tsx` — shell: left panel, quote bar, page nav, active-page switch.
- `src/components/world/profile/CharacterProfile.module.css` — palette vars + all profile styling.
- `src/components/world/profile/MainPage.tsx` — dossier + first impression + bio.
- `src/components/world/profile/PersonaPage.tsx` — core personality, rows, meters, do's/don'ts.
- `src/components/world/profile/AppearancePage.tsx` — palette, lookbook, visual impression, moodboard sections.
- `src/components/world/profile/RelationsPage.tsx` — relation cards.
- `src/components/world/profile/profileTypes.test.ts` — unit test for the default-profile helper.

Modified:
- `src/store/workspaceStore.ts` — `CharacterProfile` (+ sub-types), `Entity.profile`, `createDefaultProfile()`.
- `src/components/world/WorldBibleCenter.tsx` — route character entities to `CharacterProfile`.

All page components receive one prop: `profile: CharacterProfile` (already merged with defaults + entity fallbacks by the shell).

---

## Task 1: Profile schema + default helper

**Files:**
- Modify: `src/store/workspaceStore.ts` (add types near the `Entity` interface, ~line 161; add `profile?` to `Entity`)
- Create: `src/components/world/profile/profileTypes.test.ts`

- [ ] **Step 1: Add the types and helper**

In `src/store/workspaceStore.ts`, immediately BEFORE `export interface Entity {`, insert:

```ts
// =============================================
// Character Profile ("Glamour" template)
// =============================================

export interface ProfileField { label: string; value: string; }
export interface ProfileMeter { label: string; level: number; } // 0–100
export interface PersonaRow { image?: string; label?: string; heading?: string; text?: string; }
export interface PaletteSwatch { name: string; hex: string; }
export interface LookItem { label: string; value?: string; image?: string; }
export interface MoodItem { image?: string; caption?: string; }
export interface AppearanceSection { label: string; note?: string; moodboard?: MoodItem[]; }
export interface RelationEntry { image?: string; name?: string; relation?: string; text?: string; }

export interface CharacterProfile {
    tagline?: string;
    decorImages?: string[];
    quote?: string;
    fullName?: string;
    dossier?: ProfileField[];
    firstImpression?: string;
    bio?: string;
    corePersonality?: { image?: string; heading?: string; text?: string };
    personaRows?: PersonaRow[];
    meters?: ProfileMeter[];
    dos?: string;
    donts?: string;
    palette?: PaletteSwatch[];
    lookbook?: LookItem[];
    visualImpression?: string;
    appearanceSections?: AppearanceSection[];
    relations?: RelationEntry[];
}

/** A profile scaffold so a new character's pages aren't blank. */
export function createDefaultProfile(): CharacterProfile {
    return {
        dossier: [
            { label: 'Age', value: '' },
            { label: 'Gender', value: '' },
            { label: 'Sexuality', value: '' },
            { label: 'Origin', value: '' },
            { label: 'Job', value: '' },
            { label: 'Role', value: '' },
            { label: 'Status', value: '' },
        ],
        personaRows: [],
        meters: [],
        palette: [],
        lookbook: [],
        appearanceSections: [],
        relations: [],
        decorImages: [],
    };
}
```

Then add to the `Entity` interface (after the `articleDoc?: string;` line):

```ts
    /** Sprint 60: structured character profile ("glamour" template). */
    profile?: CharacterProfile;
```

- [ ] **Step 2: Write the failing test**

Create `src/components/world/profile/profileTypes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createDefaultProfile } from '@/store/workspaceStore';

describe('createDefaultProfile', () => {
    it('seeds the seven standard dossier fields with empty values', () => {
        const p = createDefaultProfile();
        expect(p.dossier?.map(f => f.label)).toEqual([
            'Age', 'Gender', 'Sexuality', 'Origin', 'Job', 'Role', 'Status',
        ]);
        expect(p.dossier?.every(f => f.value === '')).toBe(true);
    });

    it('initializes empty collections', () => {
        const p = createDefaultProfile();
        expect(p.personaRows).toEqual([]);
        expect(p.meters).toEqual([]);
        expect(p.relations).toEqual([]);
    });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/components/world/profile/profileTypes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add src/store/workspaceStore.ts src/components/world/profile/profileTypes.test.ts
git commit -m "feat: CharacterProfile schema + default helper"
```

---

## Task 2: Profile fonts

**Files:**
- Create: `src/components/world/profile/profileFonts.ts`

- [ ] **Step 1: Create the font module**

```ts
import { Playfair_Display, Cormorant_Garamond, Nunito } from 'next/font/google';

export const playfair = Playfair_Display({
    subsets: ['latin'],
    weight: ['600', '700', '800', '900'],
    variable: '--profile-serif',
    display: 'swap',
});

export const cormorant = Cormorant_Garamond({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--profile-softserif',
    display: 'swap',
});

export const nunito = Nunito({
    subsets: ['latin'],
    weight: ['300', '400', '600', '700', '800'],
    variable: '--profile-sans',
    display: 'swap',
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `profileFonts.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/components/world/profile/profileFonts.ts
git commit -m "feat: profile display fonts (Playfair / Cormorant / Nunito)"
```

---

## Task 3: Profile shell (left panel + nav + palette CSS)

**Files:**
- Create: `src/components/world/profile/CharacterProfile.module.css`
- Create: `src/components/world/profile/CharacterProfile.tsx`

- [ ] **Step 1: Create the CSS module with palette + core layout**

Create `src/components/world/profile/CharacterProfile.module.css`. This ports the pen's `:root`, `.bg`, `.imgSide`, `.imgBox`, `.sideStar`, `.sideQuote`, `.sideCaption`, `.bigTitle`, `.bigTitleBg`, `.number`, `.content`, `.topline`, `.quote`, `.nav`, `.page`, `.pageScroll`, `.flowerOne/.flowerTwo`. The palette vars live on `.bg` (the profile root) so they don't leak into the app.

```css
.bg {
    /* palette (pen :root) — scoped to the profile */
    --bg: #eee7dc; --paper: #f7f0e7; --ink: #171411; --soft: #67584f;
    --muted: #9d8675; --cream: #f8eddf; --white: #fff; --black: #000;
    --primary: #84222b; --secondary: #617b70; --gold: #bb8d59; --sideBg: #111;
    --transparent: transparent;
    --line: color-mix(in srgb, var(--ink) 20%, transparent);
    --lineSoft: color-mix(in srgb, var(--white) 54%, transparent);
    --white25: color-mix(in srgb, var(--white) 25%, transparent);
    --black62: color-mix(in srgb, var(--black) 62%, transparent);
    --primarySoft: color-mix(in srgb, var(--primary) 32%, transparent);
    --secondarySoft: color-mix(in srgb, var(--secondary) 32%, transparent);
    --primaryLine: color-mix(in srgb, var(--primary) 42%, transparent);

    position: relative;
    width: 900px;
    height: 720px;
    margin: 32px auto;
    overflow: hidden;
    border-radius: 22px;
    color: var(--ink);
    font-family: var(--profile-sans, 'Nunito', sans-serif);
    background:
        radial-gradient(circle at 82% 80%, var(--secondarySoft), transparent 32%),
        radial-gradient(circle at 52% 78%, var(--primarySoft), transparent 26%),
        linear-gradient(135deg, var(--paper), var(--bg));
    border: 1px solid var(--lineSoft);
    box-shadow: 0 28px 90px var(--black62);
}

.imgSide {
    position: absolute; left: 0; top: 0; width: 380px; height: 100%;
    background: var(--sideBg); overflow: hidden; z-index: 1;
}
.imgBox { position: absolute; inset: 0; }
.imgBox img { width: 100%; height: 100%; object-fit: cover; }

.sideStar {
    position: absolute; left: 31px; top: 36px; z-index: 8;
    color: var(--gold); font-size: 30px;
}
.sideQuote {
    position: absolute; left: 32px; top: 110px; z-index: 8;
    writing-mode: vertical-rl; transform: rotate(180deg);
    font: 900 9px var(--profile-sans, sans-serif); letter-spacing: 4px;
    text-transform: uppercase; color: var(--gold);
}
.sideCaption { position: absolute; left: 34px; bottom: 35px; z-index: 8; color: var(--cream); }
.sideCaption b { display: block; font: 800 15px var(--profile-serif, serif); }
.sideCaption span { font-size: 11px; color: var(--muted); }

.decor { position: absolute; pointer-events: none; object-fit: cover; z-index: 7; border-radius: 8px; opacity: 0.92; }
.decor:nth-of-type(1) { width: 150px; height: 150px; left: 250px; top: -30px; transform: rotate(-8deg); }
.decor:nth-of-type(2) { width: 120px; height: 120px; left: 300px; bottom: -20px; transform: rotate(10deg); }

.bigTitle {
    position: absolute; left: 278px; top: 28px; width: 170px; height: 680px;
    z-index: 12; pointer-events: none;
    display: flex; align-items: flex-start; justify-content: center;
}
.bigTitle span {
    writing-mode: vertical-rl; transform: rotate(180deg);
    font: 900 64px/1 var(--profile-serif, serif); color: var(--ink);
    letter-spacing: 2px; white-space: nowrap;
}
.number {
    position: absolute; right: 94px; top: 0;
    font: 900 96px/1 var(--profile-serif, serif);
    color: color-mix(in srgb, var(--ink) 8%, transparent); z-index: 2;
}

.content { position: absolute; left: 410px; right: 92px; top: 32px; bottom: 24px; z-index: 15; }
.topline {
    display: grid; grid-template-columns: minmax(200px, 1fr) 90px;
    align-items: center; gap: 10px; padding-bottom: 18px;
    border-bottom: 1px solid var(--primaryLine);
}
.quote {
    font: 700 14px/1.05 var(--profile-softserif, serif);
    color: var(--primary); text-align: right; font-style: italic;
}

.nav {
    position: absolute; right: 18px; top: 74px; bottom: 54px; width: 58px;
    z-index: 40; display: grid; grid-template-rows: repeat(4, 1fr);
    border-left: 1px solid var(--line);
}
.navBtn {
    appearance: none; background: none; border: none; cursor: pointer;
    writing-mode: vertical-rl; transform: rotate(180deg);
    font: 800 11px var(--profile-sans, sans-serif); letter-spacing: 3px;
    text-transform: uppercase; color: var(--muted); transition: color 0.3s;
}
.navBtn:hover { color: var(--ink); }
.navBtnActive { color: var(--primary); }

.page { position: absolute; inset: 98px 0 0 0; }
.pageScroll {
    height: 565px; overflow: auto; padding-right: 22px;
    scrollbar-width: thin; scrollbar-color: var(--primary) var(--white25);
}
.pageScroll h1 { font: 800 30px var(--profile-serif, serif); margin: 0; color: var(--ink); }
.pageScroll h2 {
    font: 600 13px var(--profile-softserif, serif); margin: 2px 0 18px;
    color: var(--primary); letter-spacing: 1px; text-transform: lowercase;
}

.placeholder { color: var(--muted); font-style: italic; font-size: 13px; padding: 8px 0; }
```

- [ ] **Step 2: Create the shell component**

Create `src/components/world/profile/CharacterProfile.tsx`:

```tsx
"use client";

import React, { useState } from 'react';
import { Entity, CharacterProfile as ProfileData, createDefaultProfile } from '@/store/workspaceStore';
import { playfair, cormorant, nunito } from './profileFonts';
import MainPage from './MainPage';
import PersonaPage from './PersonaPage';
import AppearancePage from './AppearancePage';
import RelationsPage from './RelationsPage';
import styles from './CharacterProfile.module.css';

type PageId = 'main' | 'persona' | 'appearance' | 'relations';
const PAGES: { id: PageId; label: string }[] = [
    { id: 'main', label: 'Main' },
    { id: 'persona', label: 'Persona' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'relations', label: 'Relations' },
];

interface CharacterProfileProps {
    entity: Entity;
}

/**
 * CharacterProfile — read-only "glamour" character sheet
 * (codepen.io/mahricodes/pen/EaNZwYG). Fixed 900×720 card with a left image
 * panel + four navigable pages, rendered from entity.profile.
 */
export default function CharacterProfile({ entity }: CharacterProfileProps) {
    const [page, setPage] = useState<PageId>('main');

    // Merge stored profile over the default scaffold; fall back to entity fields.
    const profile: ProfileData = { ...createDefaultProfile(), ...(entity.profile ?? {}) };
    const displayName = profile.fullName || entity.name;
    const pageNumber = String(PAGES.findIndex(p => p.id === page) + 1).padStart(2, '0');
    const fontVars = `${playfair.variable} ${cormorant.variable} ${nunito.variable}`;

    return (
        <div className={`${styles.bg} ${fontVars}`}>
            {/* Left image panel */}
            <div className={styles.imgSide}>
                <div className={styles.imgBox}>
                    {entity.imageUrl && <img src={entity.imageUrl} alt={displayName} />}
                </div>
                <div className={styles.sideStar}>✦</div>
                {profile.tagline && <div className={styles.sideQuote}>{profile.tagline}</div>}
                <div className={styles.sideCaption}>
                    <b>{displayName}</b>
                    {entity.subcategory && <span>{entity.subcategory}</span>}
                </div>
            </div>

            {/* Decorative (customizable) images */}
            {(profile.decorImages ?? []).slice(0, 2).map((src, i) =>
                src ? <img key={i} className={styles.decor} src={src} alt="" aria-hidden="true" /> : null,
            )}

            {/* Big vertical name + page number */}
            <div className={styles.bigTitle}><span>{displayName}</span></div>
            <div className={styles.number}>{pageNumber}</div>

            {/* Right content */}
            <div className={styles.content}>
                <div className={styles.topline}>
                    <span />
                    {profile.quote && <div className={styles.quote}>“{profile.quote}”</div>}
                </div>

                <div className={styles.page}>
                    {page === 'main' && <MainPage profile={profile} name={displayName} />}
                    {page === 'persona' && <PersonaPage profile={profile} />}
                    {page === 'appearance' && <AppearancePage profile={profile} />}
                    {page === 'relations' && <RelationsPage profile={profile} />}
                </div>
            </div>

            {/* Page nav */}
            <nav className={styles.nav}>
                {PAGES.map(p => (
                    <button
                        key={p.id}
                        type="button"
                        className={`${styles.navBtn} ${page === p.id ? styles.navBtnActive : ''}`}
                        onClick={() => setPage(p.id)}
                    >
                        {p.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
```

- [ ] **Step 3: Create placeholder page components so it compiles**

Create four minimal files (replaced in Tasks 4–7):

`src/components/world/profile/MainPage.tsx`:
```tsx
import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
export default function MainPage({ profile, name }: { profile: CharacterProfile; name: string }) {
    return <div>{name}</div>;
}
```

`src/components/world/profile/PersonaPage.tsx`:
```tsx
import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
export default function PersonaPage({ profile }: { profile: CharacterProfile }) {
    return <div />;
}
```

`src/components/world/profile/AppearancePage.tsx`:
```tsx
import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
export default function AppearancePage({ profile }: { profile: CharacterProfile }) {
    return <div />;
}
```

`src/components/world/profile/RelationsPage.tsx`:
```tsx
import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
export default function RelationsPage({ profile }: { profile: CharacterProfile }) {
    return <div />;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in `profile/`.

- [ ] **Step 5: Commit**

```bash
git add src/components/world/profile/
git commit -m "feat: character profile shell (left panel, nav, page frame)"
```

---

## Task 4: Main page

**Files:**
- Modify: `src/components/world/profile/MainPage.tsx`
- Modify: `src/components/world/profile/CharacterProfile.module.css` (append Main styles)

- [ ] **Step 1: Implement MainPage**

Replace `src/components/world/profile/MainPage.tsx` with:

```tsx
import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
import styles from './CharacterProfile.module.css';

export default function MainPage({ profile, name }: { profile: CharacterProfile; name: string }) {
    const dossier = profile.dossier ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Main</h1>
            <h2>identity / origin / first impression</h2>

            <div className={styles.dossier}>
                <div className={styles.dossierName}>
                    <b>Full Name</b>
                    <span>{profile.fullName || name}</span>
                </div>
                <div className={styles.dossierMeta}>
                    {dossier.map((f, i) => (
                        <p key={i}><b>{f.label}</b><span>{f.value || '—'}</span></p>
                    ))}
                </div>
            </div>

            {profile.firstImpression ? (
                <div className={styles.introCard}>
                    <b>first impression</b>
                    <p>{profile.firstImpression}</p>
                </div>
            ) : (
                <p className={styles.placeholder}>No first impression yet.</p>
            )}

            {profile.bio ? (
                <div className={styles.text}><p>{profile.bio}</p></div>
            ) : (
                <p className={styles.placeholder}>No biography yet.</p>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Append Main CSS**

Port the pen's `.dossier`, `.dossierName`, `.dossierMeta`, `.introCard`, `.text` rules (view them with the reference command at the top of this plan). Append to `CharacterProfile.module.css`, using the palette vars already defined. The pen values:

```css
.dossier {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 18px;
}
.dossierName b, .dossierMeta b {
    display: block;
    font: 700 10px var(--profile-sans, sans-serif);
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--primary);
}
.dossierName span {
    font: 700 22px var(--profile-serif, serif);
    color: var(--ink);
}
.dossierMeta p {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 0 0 6px;
    border-bottom: 1px dotted var(--line);
    padding-bottom: 4px;
    font-size: 13px;
}
.dossierMeta span { color: var(--soft); }
.introCard {
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    border-left: 3px solid var(--primary);
    padding: 12px 14px;
    border-radius: 6px;
    margin-bottom: 16px;
}
.introCard b {
    display: block;
    font: 700 10px var(--profile-sans, sans-serif);
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--primary);
    margin-bottom: 4px;
}
.introCard p { margin: 0; font: 500 15px/1.5 var(--profile-softserif, serif); }
.text p { margin: 0 0 12px; font: 400 14px/1.6 var(--profile-sans, sans-serif); color: var(--soft); }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/world/profile/MainPage.tsx src/components/world/profile/CharacterProfile.module.css
git commit -m "feat: character profile Main page (dossier, first impression, bio)"
```

---

## Task 5: Persona page

**Files:**
- Modify: `src/components/world/profile/PersonaPage.tsx`
- Modify: `src/components/world/profile/CharacterProfile.module.css` (append Persona styles)

- [ ] **Step 1: Implement PersonaPage**

```tsx
import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
import styles from './CharacterProfile.module.css';

export default function PersonaPage({ profile }: { profile: CharacterProfile }) {
    const rows = profile.personaRows ?? [];
    const meters = profile.meters ?? [];
    const core = profile.corePersonality;
    return (
        <div className={styles.pageScroll}>
            <h1>Persona</h1>
            <h2>temper / desire / personality</h2>

            {core && (core.text || core.heading || core.image) && (
                <div className={styles.personaFeature}>
                    {core.image && <img src={core.image} alt="" />}
                    <div>
                        <b>Core Personality</b>
                        {core.heading && <h3>{core.heading}</h3>}
                        {core.text && <p>{core.text}</p>}
                    </div>
                </div>
            )}

            {rows.map((row, i) => (
                <div key={i} className={`${styles.personaRow} ${i % 2 === 1 ? styles.reverse : ''}`}>
                    <div className={styles.personaTextCard}>
                        {row.label && <b>{row.label}</b>}
                        {row.heading && <h3>{row.heading}</h3>}
                        {row.text && <p>{row.text}</p>}
                    </div>
                    {row.image && <img src={row.image} alt="" />}
                </div>
            ))}

            {meters.length > 0 && (
                <div className={styles.personaMeters}>
                    {meters.map((m, i) => (
                        <div key={i} className={styles.meterItem} style={{ ['--level' as string]: `${m.level}%` }}>
                            <b>{m.label}</b>
                            <div><span /></div>
                        </div>
                    ))}
                </div>
            )}

            {(profile.dos || profile.donts) && (
                <div className={styles.personaNotes}>
                    <div><b>Do’s</b><p>{profile.dos || '—'}</p></div>
                    <div><b>Don’ts</b><p>{profile.donts || '—'}</p></div>
                </div>
            )}

            {rows.length === 0 && meters.length === 0 && !core && (
                <p className={styles.placeholder}>No persona details yet.</p>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Append Persona CSS**

Port the pen's `.personaFeature`, `.personaRow`, `.reverse`, `.personaTextCard`, `.personaMeters`, `.meterItem`, `.personaNotes` rules. Key values (the meter bar uses `--level`):

```css
.personaFeature { display: grid; grid-template-columns: 130px 1fr; gap: 14px; margin-bottom: 18px; align-items: center; }
.personaFeature img { width: 100%; height: 160px; object-fit: cover; border-radius: 8px; }
.personaFeature b, .personaTextCard b {
    display: block; font: 700 10px var(--profile-sans, sans-serif);
    letter-spacing: 2px; text-transform: uppercase; color: var(--primary);
}
.personaFeature h3, .personaTextCard h3 { margin: 2px 0 6px; font: 600 18px var(--profile-softserif, serif); color: var(--ink); }
.personaFeature p, .personaTextCard p { margin: 0; font: 400 13px/1.55 var(--profile-sans, sans-serif); color: var(--soft); }

.personaRow { display: grid; grid-template-columns: 1fr 130px; gap: 14px; margin-bottom: 16px; align-items: center; }
.personaRow.reverse { grid-template-columns: 130px 1fr; }
.personaRow.reverse .personaTextCard { order: 2; }
.personaRow img { width: 100%; height: 140px; object-fit: cover; border-radius: 8px; }

.personaMeters { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin: 18px 0; }
.meterItem b { display: block; font-size: 12px; margin-bottom: 4px; color: var(--ink); }
.meterItem > div { height: 6px; background: var(--white25); border-radius: 4px; overflow: hidden; }
.meterItem > div > span { display: block; height: 100%; width: var(--level, 0%); background: linear-gradient(90deg, var(--primary), var(--gold)); }

.personaNotes { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
.personaNotes b { display: block; font: 700 10px var(--profile-sans, sans-serif); letter-spacing: 2px; text-transform: uppercase; color: var(--primary); margin-bottom: 4px; }
.personaNotes p { margin: 0; font-size: 13px; color: var(--soft); }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/world/profile/PersonaPage.tsx src/components/world/profile/CharacterProfile.module.css
git commit -m "feat: character profile Persona page (personality, meters, do's/don'ts)"
```

---

## Task 6: Appearance page

**Files:**
- Modify: `src/components/world/profile/AppearancePage.tsx`
- Modify: `src/components/world/profile/CharacterProfile.module.css` (append Appearance styles)

- [ ] **Step 1: Implement AppearancePage**

```tsx
import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
import styles from './CharacterProfile.module.css';

export default function AppearancePage({ profile }: { profile: CharacterProfile }) {
    const palette = profile.palette ?? [];
    const lookbook = profile.lookbook ?? [];
    const sections = profile.appearanceSections ?? [];
    const empty = palette.length === 0 && lookbook.length === 0 && sections.length === 0 && !profile.visualImpression;
    return (
        <div className={styles.pageScroll}>
            <h1>Appearance</h1>
            <h2>face / style / signature details</h2>

            {palette.length > 0 && (
                <div className={styles.palette}>
                    {palette.map((s, i) => (
                        <div key={i} className={styles.colorSwatch} style={{ ['--swatch' as string]: s.hex }}>
                            <i /><b>{s.name}</b><span>{s.hex}</span>
                        </div>
                    ))}
                </div>
            )}

            {lookbook.length > 0 && (
                <div className={styles.lookbook}>
                    {lookbook.map((l, i) => (
                        <div key={i} className={`${styles.lookItem} ${i === 0 ? styles.large : ''}`}>
                            {l.image && <img src={l.image} alt={l.label} />}
                            <b>{l.label}</b>
                            {l.value && <span>{l.value}</span>}
                        </div>
                    ))}
                </div>
            )}

            {profile.visualImpression && (
                <div className={styles.appearanceBlock}>
                    <b>Visual Impression</b>
                    <p>{profile.visualImpression}</p>
                </div>
            )}

            {sections.length > 0 && (
                <div className={styles.appearanceSections}>
                    {sections.map((sec, i) => (
                        <div key={i} className={styles.appearanceSection}>
                            <div className={styles.appearanceSectionHead}>
                                <b>{sec.label}</b>
                                {sec.note && <span>{sec.note}</span>}
                            </div>
                            <div className={styles.appearanceMoodboard}>
                                {(sec.moodboard ?? []).map((m, j) => (
                                    <div key={j} className={styles.moodItem}>
                                        {m.image && <img src={m.image} alt="" />}
                                        {m.caption && <p>{m.caption}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {empty && <p className={styles.placeholder}>No appearance details yet.</p>}
        </div>
    );
}
```

- [ ] **Step 2: Append Appearance CSS**

Port the pen's `.palette`, `.colorSwatch`, `.lookbook`, `.lookItem`, `.large`, `.appearanceBlock`, `.appearanceSections`, `.appearanceSection`, `.appearanceSectionHead`, `.appearanceMoodboard`, `.moodItem` rules. Key values (swatch uses `--swatch`):

```css
.palette { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.colorSwatch { text-align: center; }
.colorSwatch i { display: block; width: 46px; height: 46px; border-radius: 8px; background: var(--swatch); border: 1px solid var(--line); }
.colorSwatch b { display: block; font-size: 11px; margin-top: 4px; color: var(--ink); }
.colorSwatch span { font-size: 10px; color: var(--muted); }

.lookbook { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 10px; margin-bottom: 16px; }
.lookItem { border-radius: 8px; overflow: hidden; background: var(--cream); }
.lookItem img { width: 100%; height: 120px; object-fit: cover; display: block; }
.lookItem.large img { height: 190px; }
.lookItem b { display: block; padding: 6px 8px 0; font: 700 11px var(--profile-sans, sans-serif); color: var(--ink); }
.lookItem span { display: block; padding: 0 8px 8px; font-size: 11px; color: var(--muted); }

.appearanceBlock { margin-bottom: 16px; }
.appearanceBlock b { display: block; font: 700 10px var(--profile-sans, sans-serif); letter-spacing: 2px; text-transform: uppercase; color: var(--primary); margin-bottom: 4px; }
.appearanceBlock p { margin: 0; font: 400 14px/1.6 var(--profile-sans, sans-serif); color: var(--soft); }

.appearanceSection { margin-bottom: 18px; }
.appearanceSectionHead b { font: 600 16px var(--profile-softserif, serif); color: var(--ink); margin-right: 8px; }
.appearanceSectionHead span { font-size: 12px; color: var(--muted); }
.appearanceMoodboard { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
.moodItem img { width: 100%; height: 110px; object-fit: cover; border-radius: 6px; }
.moodItem p { margin: 4px 0 0; font-size: 11px; color: var(--soft); }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/world/profile/AppearancePage.tsx src/components/world/profile/CharacterProfile.module.css
git commit -m "feat: character profile Appearance page (palette, lookbook, moodboards)"
```

---

## Task 7: Relations page

**Files:**
- Modify: `src/components/world/profile/RelationsPage.tsx`
- Modify: `src/components/world/profile/CharacterProfile.module.css` (append Relations styles)

- [ ] **Step 1: Implement RelationsPage**

```tsx
import React from 'react';
import { CharacterProfile } from '@/store/workspaceStore';
import styles from './CharacterProfile.module.css';

export default function RelationsPage({ profile }: { profile: CharacterProfile }) {
    const relations = profile.relations ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Relations</h1>
            <h2>bonds / rivals / ties</h2>

            {relations.length === 0 ? (
                <p className={styles.placeholder}>No relations yet.</p>
            ) : (
                <div className={styles.relationStack}>
                    {relations.map((r, i) => (
                        <div key={i} className={styles.relationCard}>
                            <div className={styles.relationInfo}>
                                {r.image && <img src={r.image} alt={r.name || ''} />}
                                <div>
                                    {r.name && <b>{r.name}</b>}
                                    {r.relation && <span>{r.relation}</span>}
                                </div>
                            </div>
                            {r.text && <p className={styles.relationText}>{r.text}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Append Relations CSS**

Port the pen's `.relationStack`, `.relationCard`, `.relationInfo`, `.relationText` rules. Key values:

```css
.relationStack { display: grid; gap: 12px; }
.relationCard { background: var(--cream); border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.relationInfo { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.relationInfo img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; }
.relationInfo b { display: block; font: 700 15px var(--profile-serif, serif); color: var(--ink); }
.relationInfo span { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); }
.relationText { margin: 0; font: 400 13px/1.5 var(--profile-sans, sans-serif); color: var(--soft); }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/world/profile/RelationsPage.tsx src/components/world/profile/CharacterProfile.module.css
git commit -m "feat: character profile Relations page"
```

---

## Task 8: Route character entities to the profile

**Files:**
- Modify: `src/components/world/WorldBibleCenter.tsx`

- [ ] **Step 1: Import the profile**

At the top of `src/components/world/WorldBibleCenter.tsx`, add after the existing imports:

```tsx
import CharacterProfile from './profile/CharacterProfile';
```

- [ ] **Step 2: Route characters to it in the Level-3 block**

Find the article-view block:

```tsx
    // Level 3 — Article View (highest priority)
    if (selectedEntityId) {
        return (
            <ArticleReadView
                entityId={selectedEntityId}
                onBack={() => setSelectedEntityId(null)}
            />
        );
    }
```

Replace it with:

```tsx
    // Level 3 — Character profile for character entities, article view otherwise
    if (selectedEntityId) {
        const selected = projectEntities.find(e => e.id === selectedEntityId);
        if (selected?.type === 'character') {
            return (
                <div className={styles.browserContainer}>
                    <button className={styles.backBtn} onClick={() => setSelectedEntityId(null)}>
                        ← Back
                    </button>
                    <CharacterProfile entity={selected} />
                </div>
            );
        }
        return (
            <ArticleReadView
                entityId={selectedEntityId}
                onBack={() => setSelectedEntityId(null)}
            />
        );
    }
```

Note: `projectEntities` is already defined in this component (the per-project entity list). `styles.backBtn` already exists in `WorldBibleCenter.module.css`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/world/WorldBibleCenter.tsx
git commit -m "feat: show character profile for character entities in the World Bible"
```

---

## Task 9: Verify

**Files:** none (verification only)

- [ ] **Step 1: Tests**

Run: `npx vitest run`
Expected: PASS (including the new `profileTypes.test.ts`).

- [ ] **Step 2: Lint**

Run: `npx eslint src/components/world/profile/ src/components/world/WorldBibleCenter.tsx`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds; TypeScript clean.

- [ ] **Step 4: Preview check (dev server on port 4000)**

Sign in (dev login), open the World Bible, create/open a **character** entity, and confirm:
- The glamour card renders (left portrait panel, big vertical name, page number, quote bar).
- Nav flips Main / Persona / Appearance / Relations; page number updates 01–04.
- Empty sections show muted "…yet" placeholders (a fresh character has empty fields).
- A non-character entity still opens the old `ArticleReadView`.
- No console errors.

- [ ] **Step 5: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "chore: character profile phase 1 verification fixups"
```

(Skip if nothing changed.)

---

## Notes / Gotchas

- **Fixed card size:** the pen is hardcoded to 900×720; the profile is a fixed card centered in the World Bible column (`.pageScroll` handles per-page overflow). Responsive sizing is out of scope for Phase 1.
- **Editing is Phase 2:** everything here is read-only. Do not build editors yet.
- **Palette scope:** all `--bg/--primary/…` vars live on `.bg` so the glamour palette never leaks into the dark app chrome.
- **Fonts:** `next/font/google` requires network at build; if the build environment is offline, the fonts fall back to the CSS `serif`/`sans` fallbacks already in each rule.
- **`--level` / `--swatch` inline vars:** set via `style={{ ['--level' as string]: ... }}` to satisfy TypeScript for custom properties.
- **CSS source of truth:** the reference command at the top dumps the pen's exact stylesheet; use it to confirm any value while porting.
