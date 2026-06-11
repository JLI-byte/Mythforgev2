# Fantasy Storybook Landing ("The Cartographer's Desk") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/welcome` landing page with a parchment storybook-atlas design — self-drawing ink map hero, scroll-drawn travel route through four feature landmarks, wax-seal beta letter — built as theme #1 of a multi-theme system.

**Architecture:** A thin `page.tsx` shell picks the active theme from a metadata registry (localStorage persisted) and renders it via `next/dynamic`. Each theme is a self-contained folder owning all its visuals. Form logic is a shared pure function (`submitBetaRequest`) so every theme reuses it. All motion is hand-authored SVG + CSS (`stroke-dashoffset` draw-ins, scroll-driven `animation-timeline`), zero new dependencies.

**Tech Stack:** Next.js 16 App Router, React 19, CSS Modules + one scoped global CSS file, `next/font/google` (IM Fell English, EB Garamond), Supabase JS, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-fantasy-storybook-landing-design.md`

**Hard rules from the user:**
- Portfolio-grade polish. Animations everywhere they clarify; restraint where they don't.
- NO emoji anywhere — every icon is hand-authored SVG.
- Conventional commits, no attribution footer (disabled in user settings).

**Palette tokens (used in all CSS below):**

```css
--parchment: #f3e8cf;   /* page */
--parchment-deep: #e9dcba; /* panels */
--sepia: #3b2c15;       /* text & line art */
--sepia-soft: #75603f;  /* muted text */
--vermilion: #c8401f;   /* CTAs, route, emphasis */
--vermilion-deep: #a32d12;
--verdigris: #3d7068;   /* secondary links, stamps */
--gold-leaf: #b08d2f;   /* tiny precious touches */
```

**Verification environment:** A preview server config exists (`.claude/launch.json`, name `dev`, port 4000). Use `preview_start`/`preview_eval`/`preview_screenshot` MCP tools. The page is at `/welcome`.

---

## File Structure

```
src/app/welcome/
├── page.tsx                          MODIFY — becomes thin theme shell
├── shared/
│   ├── betaRequest.ts                CREATE — pure submit logic + types
│   ├── betaRequest.test.ts           CREATE — vitest unit tests
│   ├── ThemeSwitcher.tsx             CREATE — compass control, fixed corner
│   └── switcher.module.css           CREATE
├── themes/
│   ├── registry.ts                   CREATE — theme metadata + getTheme()
│   ├── registry.test.ts              CREATE
│   └── fantasy/
│       ├── FantasyLanding.tsx        CREATE — the whole page assembly
│       ├── fonts.ts                  CREATE — IM Fell English + EB Garamond
│       ├── fantasy.module.css        CREATE — all layout/typography/chrome
│       ├── fantasy-scroll.css        CREATE — scroll-driven route + reveals (global, scoped)
│       └── art/
│           ├── MapHero.tsx           CREATE — full-bleed self-drawing map
│           ├── CompassRose.tsx       CREATE — reused in hero + switcher
│           ├── LandmarkIcons.tsx     CREATE — Desk/Archive/Hearth/Vault etchings
│           ├── WaxSeal.tsx           CREATE — seal graphic for submit button
│           ├── SeaSerpent.tsx        CREATE — margin easter egg
│           └── QuillMark.tsx         CREATE — nav wordmark icon
├── HeroMesh.tsx                      DELETE (Task 8)
├── welcome-effect.css                DELETE (Task 8)
└── welcome.module.css                DELETE (Task 8)
```

---

### Task 1: Checkpoint commit of current working tree

The working tree holds the previous (superseded) landing iteration uncommitted. Commit it so history is clean before demolition.

- [ ] **Step 1: Inspect and commit**

```bash
git status --short
git add src/app/welcome .claude/launch.json
git commit -m "feat: scroll-words landing iteration with particle mesh hero (superseded by fantasy theme)"
```

Expected: commit succeeds; `git status` clean afterward (untracked stray files, if any, are left alone).

---

### Task 2: Shared beta request logic (TDD)

**Files:**
- Create: `src/app/welcome/shared/betaRequest.ts`
- Test: `src/app/welcome/shared/betaRequest.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/welcome/shared/betaRequest.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitBetaRequest } from './betaRequest';

const insertMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: () => ({ insert: insertMock }),
    }),
}));

describe('submitBetaRequest', () => {
    beforeEach(() => insertMock.mockReset());

    it('returns done and normalizes fields on success', async () => {
        insertMock.mockResolvedValue({ error: null });
        const result = await submitBetaRequest({
            name: '  Jimi ',
            email: ' ME@Example.COM ',
            reason: '',
        });
        expect(result).toBe('done');
        expect(insertMock).toHaveBeenCalledWith({
            email: 'me@example.com',
            name: 'Jimi',
            reason: null,
        });
    });

    it('returns duplicate on unique violation 23505', async () => {
        insertMock.mockResolvedValue({ error: { code: '23505' } });
        const result = await submitBetaRequest({ name: '', email: 'a@b.c', reason: '' });
        expect(result).toBe('duplicate');
    });

    it('returns error on any other failure', async () => {
        insertMock.mockResolvedValue({ error: { code: 'PGRST301' } });
        const result = await submitBetaRequest({ name: '', email: 'a@b.c', reason: '' });
        expect(result).toBe('error');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/welcome/shared`
Expected: FAIL — cannot resolve `./betaRequest`

- [ ] **Step 3: Write minimal implementation**

`src/app/welcome/shared/betaRequest.ts`:

```ts
import { createClient } from '@/lib/supabase/client';

export interface BetaRequestFields {
    name: string;
    email: string;
    reason: string;
}

export type BetaRequestResult = 'done' | 'duplicate' | 'error';

/**
 * Inserts a beta access request into public.beta_requests.
 * 23505 (unique_violation) means this email already requested access.
 */
export async function submitBetaRequest(
    fields: BetaRequestFields,
): Promise<BetaRequestResult> {
    const supabase = createClient();
    const { error } = await supabase.from('beta_requests').insert({
        email: fields.email.trim().toLowerCase(),
        name: fields.name.trim() || null,
        reason: fields.reason.trim() || null,
    });
    if (!error) return 'done';
    return error.code === '23505' ? 'duplicate' : 'error';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/welcome/shared`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/app/welcome/shared/betaRequest.ts src/app/welcome/shared/betaRequest.test.ts
git commit -m "feat: extract shared beta request submit logic with tests"
```

---

### Task 3: Theme registry (TDD)

Registry holds **metadata only** (no component imports — keeps vitest free of `next/font`). Components are mapped in `page.tsx` (Task 8).

**Files:**
- Create: `src/app/welcome/themes/registry.ts`
- Test: `src/app/welcome/themes/registry.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/welcome/themes/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LANDING_THEMES, getTheme, DEFAULT_THEME_ID, THEME_STORAGE_KEY } from './registry';

describe('landing theme registry', () => {
    it('contains the fantasy theme as default', () => {
        expect(LANDING_THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
        expect(DEFAULT_THEME_ID).toBe('fantasy');
    });

    it('has unique theme ids', () => {
        const ids = LANDING_THEMES.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('falls back to the default theme for unknown or null ids', () => {
        expect(getTheme('does-not-exist').id).toBe(DEFAULT_THEME_ID);
        expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
        expect(getTheme('fantasy').id).toBe('fantasy');
    });

    it('exposes a storage key for persistence', () => {
        expect(THEME_STORAGE_KEY.length).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/welcome/themes`
Expected: FAIL — cannot resolve `./registry`

- [ ] **Step 3: Write minimal implementation**

`src/app/welcome/themes/registry.ts`:

```ts
export interface LandingThemeMeta {
    id: string;
    name: string;
    tagline: string;
}

export const THEME_STORAGE_KEY = 'lc-landing-theme';
export const DEFAULT_THEME_ID = 'fantasy';

export const LANDING_THEMES: LandingThemeMeta[] = [
    {
        id: 'fantasy',
        name: 'Fantasy Storybook',
        tagline: "The Cartographer's Desk",
    },
];

export function getTheme(id: string | null): LandingThemeMeta {
    return (
        LANDING_THEMES.find((t) => t.id === id) ??
        LANDING_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/welcome/themes`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/app/welcome/themes/registry.ts src/app/welcome/themes/registry.test.ts
git commit -m "feat: landing theme registry with default fallback"
```

---

### Task 4: SVG art components

All art is stroke-based "etching" style: `stroke="currentColor"`, `fill="none"`, round caps. Every drawable path carries `pathLength={1}` and the class hook `inkPath` plus a `--d` CSS var for stagger delay (animation defined in Task 5 CSS). These components have no logic — verification is visual (Task 9 screenshots).

**Files:**
- Create: `src/app/welcome/themes/fantasy/art/QuillMark.tsx`
- Create: `src/app/welcome/themes/fantasy/art/CompassRose.tsx`
- Create: `src/app/welcome/themes/fantasy/art/LandmarkIcons.tsx`
- Create: `src/app/welcome/themes/fantasy/art/WaxSeal.tsx`
- Create: `src/app/welcome/themes/fantasy/art/SeaSerpent.tsx`
- Create: `src/app/welcome/themes/fantasy/art/MapHero.tsx`

- [ ] **Step 1: QuillMark (nav wordmark icon)**

`src/app/welcome/themes/fantasy/art/QuillMark.tsx`:

```tsx
export default function QuillMark({ size = 28 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
                d="M5 27 C8 16 18 6 27 4 c-1 9 -8 19 -18 24 l-4 -1 Z"
                stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
            />
            <path d="M9 23 C14 18 19 13 23 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M4 29 h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}
```

- [ ] **Step 2: CompassRose (hero + theme switcher)**

`src/app/welcome/themes/fantasy/art/CompassRose.tsx`:

```tsx
interface CompassRoseProps {
    size?: number;
    animated?: boolean;
}

export default function CompassRose({ size = 150, animated = false }: CompassRoseProps) {
    const cls = animated ? 'inkPath' : undefined;
    return (
        <svg width={size} height={size} viewBox="0 0 150 150" fill="none" aria-hidden="true">
            <circle cx="75" cy="75" r="56" stroke="currentColor" strokeWidth="1.2"
                pathLength={1} className={cls} style={{ '--d': '0.2s' } as React.CSSProperties} />
            <circle cx="75" cy="75" r="44" stroke="currentColor" strokeWidth="0.6"
                pathLength={1} className={cls} style={{ '--d': '0.45s' } as React.CSSProperties} />
            <path d="M75 19 L82 68 L131 75 L82 82 L75 131 L68 82 L19 75 L68 68 Z"
                stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
                pathLength={1} className={cls} style={{ '--d': '0.7s' } as React.CSSProperties} />
            <path d="M75 38 L79 68 L75 75 L71 68 Z"
                stroke="var(--gold-leaf, #b08d2f)" strokeWidth="1.6" strokeLinejoin="round"
                pathLength={1} className={cls} style={{ '--d': '1.1s' } as React.CSSProperties} />
            <text x="75" y="14" textAnchor="middle" fontSize="11" fill="currentColor"
                fontFamily="var(--font-fell), serif">N</text>
        </svg>
    );
}
```

- [ ] **Step 3: LandmarkIcons (the four journey stops)**

`src/app/welcome/themes/fantasy/art/LandmarkIcons.tsx`:

```tsx
const S = {
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
} as const;

export function DeskIcon({ size = 48 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M7 30 h34 M11 30 v9 M37 30 v9 M14 30 v-5 h20 v5" {...S} />
            <path d="M30 10 c5 1 7 6 8 12 l-10 -4 Z" {...S} />
            <path d="M28 18 l-5 7" {...S} strokeWidth={1.2} />
        </svg>
    );
}

export function ArchiveIcon({ size = 48 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M6 13 q9 -6 18 0 v23 q-9 -6 -18 0 Z" {...S} />
            <path d="M42 13 q-9 -6 -18 0 v23 q9 -6 18 0 Z" {...S} />
            <path d="M11 19 q5 -2.5 9 0 M11 25 q5 -2.5 9 0 M28 19 q5 -2.5 9 0" {...S} strokeWidth={1} />
        </svg>
    );
}

export function HearthIcon({ size = 48 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M9 40 v-15 q15 -17 30 0 v15" {...S} />
            <path d="M5 40 h38" {...S} />
            <path d="M24 22 c-6 7 3 8 0 13 c7 -3 4 -8 0 -13 Z" {...S} strokeWidth={1.4} />
        </svg>
    );
}

export function VaultIcon({ size = 48 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            <path d="M8 23 h32 v15 h-32 Z" {...S} />
            <path d="M8 23 q16 -13 32 0" {...S} />
            <circle cx="24" cy="30" r="2.6" {...S} strokeWidth={1.4} />
            <path d="M24 32.6 v3" {...S} strokeWidth={1.4} />
        </svg>
    );
}
```

- [ ] **Step 4: WaxSeal (submit button graphic)**

`src/app/welcome/themes/fantasy/art/WaxSeal.tsx`:

```tsx
export default function WaxSeal({ size = 56 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
            <path
                d="M32 4 c7 0 9 4 14 5 c5 1 9 5 9 11 c0 4 3 7 3 12 c0 5 -4 8 -5 13 c-1 6 -6 9 -12 9 c-4 0 -6 4 -11 4 c-5 0 -7 -4 -11 -5 c-6 -1 -10 -5 -10 -11 c0 -4 -3 -7 -3 -12 c0 -5 4 -8 5 -13 c1 -6 6 -9 12 -9 c4 0 5 -4 9 -4 Z"
                fill="var(--vermilion, #c8401f)" stroke="var(--vermilion-deep, #a32d12)" strokeWidth="2"
            />
            <circle cx="32" cy="32" r="18" fill="none" stroke="#e9b39f" strokeWidth="1" opacity="0.7" />
            <text x="32" y="40" textAnchor="middle" fontSize="22" fill="#f6ddd2"
                fontFamily="var(--font-fell), serif">L</text>
        </svg>
    );
}
```

- [ ] **Step 5: SeaSerpent (margin easter egg)**

`src/app/welcome/themes/fantasy/art/SeaSerpent.tsx`:

```tsx
export default function SeaSerpent({ width = 120 }: { width?: number }) {
    return (
        <svg width={width} height={width * 0.5} viewBox="0 0 120 60" fill="none" aria-hidden="true">
            <path d="M8 38 q8 -18 18 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M38 38 q8 -22 20 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M70 38 q7 -16 16 -4 q5 6 14 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M100 36 q8 -3 12 4 q-7 4 -12 1 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="106" cy="38" r="1" fill="currentColor" />
            <path d="M10 46 q10 4 20 0 M44 46 q10 4 20 0 M80 46 q10 4 20 0"
                stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        </svg>
    );
}
```

- [ ] **Step 6: MapHero (the self-drawing hero map)**

Dashed routes that "draw in" use the mask trick: a solid `inkPath` inside a `<mask>` reveals a static dashed path beneath it.

`src/app/welcome/themes/fantasy/art/MapHero.tsx`:

```tsx
import React from 'react';
import CompassRose from './CompassRose';

const ink = {
    stroke: 'currentColor',
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

function d(delay: number) {
    return { '--d': `${delay}s` } as React.CSSProperties;
}

export default function MapHero() {
    return (
        <svg
            className="mapHeroSvg"
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
        >
            <mask id="lc-route-mask">
                <path
                    d="M150 620 C320 700 520 560 700 630 S1060 720 1240 600 S1400 520 1480 560"
                    pathLength={1} className="inkPath" style={d(1.4)}
                    stroke="#fff" strokeWidth="10" fill="none"
                />
            </mask>

            <path d="M-20 520 C120 470 260 560 380 500 S620 420 760 470 S1040 560 1180 500 S1380 440 1460 480"
                {...ink} strokeWidth="1.6" pathLength={1} className="inkPath" style={d(0)} />
            <path d="M-20 560 C140 520 250 590 400 545"
                {...ink} strokeWidth="0.8" pathLength={1} className="inkPath" style={d(0.5)} />

            <path d="M1040 690 q34 -30 86 -14 q44 14 20 42 q-34 32 -84 12 q-30 -14 -22 -40 Z"
                {...ink} strokeWidth="1.4" pathLength={1} className="inkPath" style={d(0.9)} />

            <g {...ink} strokeWidth="1.4">
                <path d="M210 330 l30 -46 l30 46 M258 330 l38 -60 l38 60 M328 330 l28 -42 l28 42"
                    pathLength={1} className="inkPath" style={d(0.6)} />
                <path d="M880 250 l26 -40 l26 40 M922 250 l34 -54 l34 54"
                    pathLength={1} className="inkPath" style={d(0.9)} />
            </g>

            <path d="M250 336 q20 60 -10 120 q-24 50 10 96"
                {...ink} strokeWidth="1" pathLength={1} className="inkPath" style={d(1.1)} />

            <path
                d="M150 620 C320 700 520 560 700 630 S1060 720 1240 600 S1400 520 1480 560"
                stroke="var(--vermilion, #c8401f)" strokeWidth="2" fill="none"
                strokeDasharray="8 8" strokeLinecap="round" mask="url(#lc-route-mask)"
            />
            <path d="M144 612 l12 14 M156 612 l-12 14" stroke="var(--vermilion, #c8401f)"
                strokeWidth="2" strokeLinecap="round" pathLength={1} className="inkPath" style={d(1.3)} />

            <g {...ink} strokeWidth="1" opacity="0.65">
                <path d="M540 720 q9 -8 18 0 q9 8 18 0 M600 760 q9 -8 18 0 q9 8 18 0 M460 770 q9 -8 18 0"
                    pathLength={1} className="inkPath" style={d(1.8)} />
            </g>

            <path d="M1238 592 l10 12 M1248 592 l-10 12" stroke="var(--gold-leaf, #b08d2f)"
                strokeWidth="2.4" strokeLinecap="round" pathLength={1} className="inkPath" style={d(2.2)} />

            <g transform="translate(1180, 90)" className="mapCompass">
                <CompassRose size={170} animated />
            </g>
        </svg>
    );
}
```

- [ ] **Step 7: Verify the files compile**

Run: `npx tsc --noEmit 2>&1 | grep -i "welcome/themes/fantasy/art" || echo "ART OK"`
Expected: `ART OK` (no type errors in the art folder; pre-existing errors elsewhere are out of scope)

- [ ] **Step 8: Commit**

```bash
git add src/app/welcome/themes/fantasy/art
git commit -m "feat: hand-authored SVG etching art for fantasy landing"
```

---

### Task 5: Fonts, CSS foundation, and FantasyLanding hero

**Files:**
- Create: `src/app/welcome/themes/fantasy/fonts.ts`
- Create: `src/app/welcome/themes/fantasy/fantasy.module.css`
- Create: `src/app/welcome/themes/fantasy/fantasy-scroll.css`
- Create: `src/app/welcome/themes/fantasy/FantasyLanding.tsx` (hero + nav + footer; journey and letter arrive in Tasks 6–7)

- [ ] **Step 1: Fonts**

`src/app/welcome/themes/fantasy/fonts.ts`:

```ts
import { IM_Fell_English, EB_Garamond } from 'next/font/google';

export const imFell = IM_Fell_English({
    weight: '400',
    style: ['normal', 'italic'],
    subsets: ['latin'],
    variable: '--font-fell',
});

export const ebGaramond = EB_Garamond({
    weight: ['400', '500', '600'],
    style: ['normal', 'italic'],
    subsets: ['latin'],
    variable: '--font-garamond',
});
```

- [ ] **Step 2: fantasy.module.css**

`src/app/welcome/themes/fantasy/fantasy.module.css`:

```css
/*
 * Fantasy Storybook theme — "The Cartographer's Desk".
 * Layout, typography, chrome. Scroll-driven + draw-in animation lives in
 * fantasy-scroll.css (global, scoped to html[data-lc-landing='fantasy']).
 */

.page {
    --parchment: #f3e8cf;
    --parchment-deep: #e9dcba;
    --sepia: #3b2c15;
    --sepia-soft: #75603f;
    --vermilion: #c8401f;
    --vermilion-deep: #a32d12;
    --verdigris: #3d7068;
    --gold-leaf: #b08d2f;
    --line-faint: rgba(59, 44, 21, 0.22);
    --inline-pad: clamp(1.5rem, 6vw, 5rem);

    min-height: 100vh;
    background-color: var(--parchment);
    background-image:
        radial-gradient(ellipse 120% 90% at 50% 20%, transparent 55%, rgba(59, 44, 21, 0.10)),
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.23 0 0 0 0 0.17 0 0 0 0 0.08 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E");
    color: var(--sepia);
    font-family: var(--font-garamond), Georgia, serif;
    font-size: 1.06rem;
    overflow-x: clip;
}

/* ---------- Nav ---------- */

.nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.1rem var(--inline-pad);
}

.navBrand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-fell), serif;
    font-size: 1.25rem;
    color: var(--sepia);
    letter-spacing: 0.02em;
}

.navSignIn {
    font-family: var(--font-garamond), serif;
    font-style: italic;
    color: var(--verdigris);
    text-decoration: none;
    font-size: 1rem;
    border-bottom: 1px solid transparent;
    transition: border-color 180ms ease;
}

.navSignIn:is(:hover, :focus-visible) {
    border-bottom-color: var(--verdigris);
}

/* ---------- Hero ---------- */

.hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 1.6rem;
    padding: 6rem var(--inline-pad) 4rem;
}

.heroMap {
    position: absolute;
    inset: 0;
    color: var(--sepia-soft);
    opacity: 0.85;
    pointer-events: none;
}

.heroMap :global(svg.mapHeroSvg) {
    width: 100%;
    height: 100%;
}

.hero > :not(.heroMap) {
    position: relative;
    z-index: 1;
}

.heroBadge {
    font-family: var(--font-garamond), serif;
    font-size: 0.8rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--verdigris);
    border: 1px solid var(--verdigris);
    padding: 0.35rem 0.9rem;
    border-radius: 2px;
}

.heroTitle {
    font-family: var(--font-fell), serif;
    font-weight: 400;
    font-size: clamp(2.6rem, 7.5vw, 6.4rem);
    line-height: 1.02;
    letter-spacing: -0.01em;
    margin: 0;
    max-width: 14ch;
    text-wrap: balance;
}

.heroTitle em {
    font-style: italic;
    color: var(--vermilion);
}

.heroSub {
    max-width: 36rem;
    margin: 0;
    font-size: clamp(1.05rem, 1.6vw, 1.3rem);
    line-height: 1.65;
    color: var(--sepia-soft);
}

.heroCtas {
    display: flex;
    gap: 1.25rem;
    align-items: center;
    flex-wrap: wrap;
}

.ctaPrimary {
    font-family: var(--font-garamond), serif;
    font-weight: 600;
    font-size: 1.05rem;
    text-decoration: none;
    color: #f6ddd2;
    background: var(--vermilion);
    border: 1px solid var(--vermilion-deep);
    border-radius: 3px;
    padding: 0.85rem 1.8rem;
    box-shadow: 2px 3px 0 rgba(59, 44, 21, 0.25);
    transition: transform 160ms ease, box-shadow 160ms ease;
}

.ctaPrimary:is(:hover, :focus-visible) {
    transform: translate(-1px, -2px);
    box-shadow: 4px 6px 0 rgba(59, 44, 21, 0.22);
}

.ctaPrimary:active {
    transform: translate(1px, 2px);
    box-shadow: 0 0 0 rgba(59, 44, 21, 0.2);
}

.ctaSecondary {
    font-family: var(--font-garamond), serif;
    font-style: italic;
    font-size: 1.05rem;
    color: var(--verdigris);
    text-decoration: none;
    border-bottom: 1px solid var(--verdigris);
    padding-bottom: 2px;
    transition: color 160ms ease;
}

.ctaSecondary:is(:hover, :focus-visible) {
    color: var(--sepia);
    border-bottom-color: var(--sepia);
}

.heroScrollHint {
    position: absolute;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-garamond), serif;
    font-style: italic;
    font-size: 0.92rem;
    color: var(--sepia-soft);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
}

/* ---------- Journey ---------- */

.journey {
    position: relative;
    max-width: 70rem;
    margin: 0 auto;
    padding: 8rem var(--inline-pad) 4rem;
}

.journeyKicker {
    text-align: center;
    font-size: 0.85rem;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--sepia-soft);
    margin: 0 0 0.8rem;
}

.journeyTitle {
    text-align: center;
    font-family: var(--font-fell), serif;
    font-weight: 400;
    font-size: clamp(1.9rem, 4vw, 3rem);
    margin: 0 0 5rem;
}

.routeWrap {
    position: absolute;
    top: 16rem;
    bottom: 4rem;
    left: 50%;
    width: 160px;
    transform: translateX(-50%);
    color: var(--vermilion);
    pointer-events: none;
}

.routeWrap svg {
    width: 100%;
    height: 100%;
}

.stops {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: clamp(5rem, 12vh, 9rem);
    list-style: none;
    margin: 0;
    padding: 0;
}

.stop {
    width: min(26rem, 42%);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.stop:nth-child(even) {
    align-self: flex-end;
    text-align: right;
}

.stop:nth-child(even) .stopIcon {
    margin-left: auto;
}

.stopIcon {
    color: var(--sepia);
    width: 48px;
    height: 48px;
}

.stopName {
    font-family: var(--font-fell), serif;
    font-weight: 400;
    font-size: 1.7rem;
    margin: 0;
}

.stopFeature {
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--verdigris);
    margin: 0;
}

.stopBody {
    margin: 0;
    line-height: 1.65;
    color: var(--sepia-soft);
}

.marginalia {
    position: relative;
    max-width: 70rem;
    margin: 0 auto;
    padding: 0 var(--inline-pad) 6rem;
    display: flex;
    justify-content: flex-end;
}

.marginaliaInner {
    color: var(--sepia-soft);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    transform: rotate(-2deg);
}

.marginaliaNote {
    font-family: var(--font-fell), serif;
    font-style: italic;
    font-size: 0.95rem;
}

/* ---------- The Letter ---------- */

.letter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.5rem;
    padding: 5rem var(--inline-pad) 7rem;
}

.letterHeading {
    font-family: var(--font-fell), serif;
    font-weight: 400;
    font-size: clamp(2rem, 5vw, 3.4rem);
    margin: 0;
    text-align: center;
}

.letterPanel {
    width: 100%;
    max-width: 30rem;
    background: #f9f2e0;
    border: 1px solid var(--line-faint);
    border-radius: 2px;
    padding: 2.4rem 2.2rem;
    transform: rotate(-0.6deg);
    box-shadow: 3px 5px 0 rgba(59, 44, 21, 0.12);
    position: relative;
}

.letterPanel::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    border-style: solid;
    border-width: 0 26px 26px 0;
    border-color: transparent var(--parchment) transparent transparent;
    filter: drop-shadow(-2px 2px 1px rgba(59, 44, 21, 0.12));
}

.letterSalutation {
    font-family: var(--font-fell), serif;
    font-size: 1.25rem;
    margin: 0 0 0.4rem;
}

.letterIntro {
    margin: 0 0 1.6rem;
    line-height: 1.65;
    color: var(--sepia-soft);
}

.field {
    margin-bottom: 1.2rem;
}

.fieldLabel {
    display: block;
    font-style: italic;
    font-size: 0.98rem;
    color: var(--sepia-soft);
    margin-bottom: 0.35rem;
}

.fieldInput,
.fieldTextarea {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--line-faint);
    border-radius: 0;
    color: var(--sepia);
    font-family: var(--font-garamond), serif;
    font-size: 1.08rem;
    padding: 0.35rem 0.1rem;
    transition: border-color 160ms ease;
}

.fieldTextarea {
    min-height: 4.5rem;
    resize: vertical;
    line-height: 1.5;
}

.fieldInput::placeholder,
.fieldTextarea::placeholder {
    color: rgba(59, 44, 21, 0.35);
    font-style: italic;
}

.fieldInput:focus-visible,
.fieldTextarea:focus-visible {
    outline: none;
    border-bottom-color: var(--vermilion);
}

.sealRow {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1.8rem;
}

.sealButton {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: var(--font-garamond), serif;
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--sepia);
}

.sealButton svg {
    transition: transform 180ms ease;
}

.sealButton:is(:hover, :focus-visible):not(:disabled) svg {
    transform: scale(1.06) rotate(-4deg);
}

.sealButton:active:not(:disabled) svg {
    transform: scale(0.94);
}

.sealButton:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.letterNote {
    margin-top: 1.2rem;
    font-style: italic;
    color: var(--verdigris);
}

.letterError {
    margin-top: 1.2rem;
    font-style: italic;
    color: var(--vermilion-deep);
}

.letterSuccess {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem 0;
}

.letterSuccessTitle {
    font-family: var(--font-fell), serif;
    font-weight: 400;
    font-size: 1.6rem;
    margin: 0;
}

/* ---------- Footer ---------- */

.footer {
    padding: 2.5rem var(--inline-pad);
    text-align: center;
    font-style: italic;
    color: var(--sepia-soft);
    font-size: 0.95rem;
}

.footerLink {
    color: var(--verdigris);
}

/* ---------- Utilities & responsive ---------- */

.srOnly {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
}

@media (max-width: 720px) {
    .routeWrap {
        left: 1.4rem;
        width: 60px;
        transform: none;
    }

    .stop,
    .stop:nth-child(even) {
        width: auto;
        margin-left: 4rem;
        align-self: stretch;
        text-align: left;
    }

    .stop:nth-child(even) .stopIcon {
        margin-left: 0;
    }
}
```

- [ ] **Step 3: fantasy-scroll.css**

`src/app/welcome/themes/fantasy/fantasy-scroll.css`:

```css
/*
 * Motion for the fantasy landing theme. Global file (not a module) because
 * draw-in classes are referenced from SVG components and the scroll timeline
 * needs plain selectors. Scoped to html[data-lc-landing='fantasy'], set by
 * FantasyLanding on mount and removed on unmount.
 */

html[data-lc-landing='fantasy'] {
    scroll-behavior: smooth;
}

html[data-lc-landing='fantasy'] .inkPath {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: lc-ink-draw 1.7s cubic-bezier(0.45, 0, 0.3, 1) forwards;
    animation-delay: var(--d, 0s);
}

@keyframes lc-ink-draw {
    to {
        stroke-dashoffset: 0;
    }
}

html[data-lc-landing='fantasy'] .heroReveal {
    opacity: 0;
    filter: blur(3px);
    transform: translateY(10px);
    animation: lc-ink-fade 0.9s ease forwards;
    animation-delay: var(--d, 0s);
}

@keyframes lc-ink-fade {
    to {
        opacity: 1;
        filter: blur(0);
        transform: translateY(0);
    }
}

html[data-lc-landing='fantasy'] .scrollHintArrow {
    animation: lc-hint-bob 2.2s ease-in-out infinite;
}

@keyframes lc-hint-bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(5px); }
}

@supports (animation-timeline: view()) {
    html[data-lc-landing='fantasy'] .routeDraw {
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        animation: lc-ink-draw 1s linear both;
        animation-timeline: view();
        animation-range: entry 30% exit 70%;
    }

    html[data-lc-landing='fantasy'] .stopReveal {
        opacity: 0.1;
        filter: blur(2px);
        transform: translateY(26px);
        animation: lc-stop-in 1s ease both;
        animation-timeline: view();
        animation-range: entry 15% entry 55%;
    }

    @keyframes lc-stop-in {
        to {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0);
        }
    }
}

@media (prefers-reduced-motion: reduce) {
    html[data-lc-landing='fantasy'] .inkPath,
    html[data-lc-landing='fantasy'] .routeDraw {
        animation: none;
        stroke-dashoffset: 0;
    }

    html[data-lc-landing='fantasy'] .heroReveal,
    html[data-lc-landing='fantasy'] .stopReveal {
        animation: none;
        opacity: 1;
        filter: none;
        transform: none;
    }

    html[data-lc-landing='fantasy'] .scrollHintArrow {
        animation: none;
    }

    html[data-lc-landing='fantasy'] {
        scroll-behavior: auto;
    }
}
```

- [ ] **Step 4: FantasyLanding with nav, hero, footer**

`src/app/welcome/themes/fantasy/FantasyLanding.tsx`:

```tsx
"use client";

import React, { useEffect } from 'react';
import styles from './fantasy.module.css';
import './fantasy-scroll.css';
import { imFell, ebGaramond } from './fonts';
import MapHero from './art/MapHero';
import QuillMark from './art/QuillMark';

function reveal(delay: number) {
    return { '--d': `${delay}s` } as React.CSSProperties;
}

export default function FantasyLanding() {
    useEffect(() => {
        document.documentElement.dataset.lcLanding = 'fantasy';
        return () => {
            delete document.documentElement.dataset.lcLanding;
        };
    }, []);

    return (
        <div className={`${styles.page} ${imFell.variable} ${ebGaramond.variable}`}>
            <nav className={styles.nav}>
                <div className={styles.navBrand}>
                    <QuillMark />
                    LoreCanvas
                </div>
                <a href="/login" className={styles.navSignIn}>Beta tester sign in</a>
            </nav>

            <header className={styles.hero}>
                <div className={styles.heroMap}><MapHero /></div>
                <span className={`${styles.heroBadge} heroReveal`} style={reveal(0.3)}>
                    Private beta
                </span>
                <h1 className={`${styles.heroTitle} heroReveal`} style={reveal(0.55)}>
                    Every legend begins with a <em>blank map.</em>
                </h1>
                <p className={`${styles.heroSub} heroReveal`} style={reveal(0.85)}>
                    LoreCanvas is the cartographer&apos;s desk for fiction writers —
                    chart your manuscript, your lore, and your momentum in one place.
                </p>
                <div className={`${styles.heroCtas} heroReveal`} style={reveal(1.1)}>
                    <a href="#letter" className={styles.ctaPrimary}>Begin your journey</a>
                    <a href="/login" className={styles.ctaSecondary}>I carry an invitation</a>
                </div>
                <div className={styles.heroScrollHint} aria-hidden="true">
                    scroll to chart your course
                    <svg className="scrollHintArrow" width="14" height="18" viewBox="0 0 14 18" fill="none">
                        <path d="M7 1 v14 M2 11 l5 5 5 -5" stroke="currentColor" strokeWidth="1.4"
                            strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </header>

            <footer className={styles.footer}>
                Charted with care · LoreCanvas © {new Date().getFullYear()} ·{' '}
                <a href="/login" className={styles.footerLink}>Beta tester sign in</a>
            </footer>
        </div>
    );
}
```

- [ ] **Step 5: Temporarily wire the page for preview** — replace `src/app/welcome/page.tsx` content with a minimal shell (final shell with switcher lands in Task 8):

```tsx
"use client";

import FantasyLanding from './themes/fantasy/FantasyLanding';

export default function WelcomePage() {
    return <FantasyLanding />;
}
```

Then delete the now-orphaned previous-iteration files:

```bash
git rm src/app/welcome/HeroMesh.tsx src/app/welcome/welcome-effect.css src/app/welcome/welcome.module.css
```

- [ ] **Step 6: Preview verification**

Start the preview (`preview_start` name `dev`), navigate to `/welcome`, then:
1. `preview_console_logs` level `error` → expect none.
2. `preview_screenshot` → parchment page, map strokes drawn in, IM Fell headline with vermilion italic "blank map.", staggered hero copy, bobbing scroll hint.
3. Reload and screenshot quickly to confirm the draw-in animation plays from blank.

- [ ] **Step 7: Commit**

```bash
git add src/app/welcome/themes/fantasy src/app/welcome/page.tsx
git commit -m "feat: fantasy theme foundation — fonts, parchment chrome, self-drawing map hero"
```

---

### Task 6: The Journey (scrollytelling route + landmarks)

**Files:**
- Modify: `src/app/welcome/themes/fantasy/FantasyLanding.tsx` (insert `<main>` between header and footer)

- [ ] **Step 1: Add imports and stop data to FantasyLanding**

Add to imports:

```tsx
import { DeskIcon, ArchiveIcon, HearthIcon, VaultIcon } from './art/LandmarkIcons';
import SeaSerpent from './art/SeaSerpent';
```

Add above the component:

```tsx
const STOPS = [
    {
        name: 'The Desk',
        feature: 'The Writing Desk',
        body: 'An infinite canvas around your manuscript. Pin research, sticky notes, character sheets, and story beats right beside the words.',
        Icon: DeskIcon,
    },
    {
        name: 'The Archive',
        feature: 'World Bible',
        body: 'Characters, places, factions, and lore in linked articles. Type [[ while writing to bind an entity to the page without breaking stride.',
        Icon: ArchiveIcon,
    },
    {
        name: 'The Hearth',
        feature: 'Goals & Streaks',
        body: 'Daily word targets, a writing heatmap, and streaks that survive your busiest weeks. Keep the fire lit.',
        Icon: HearthIcon,
    },
    {
        name: 'The Vault',
        feature: 'Export & Backups',
        body: 'Markdown, Word, and EPUB export, plus local backups and version history. Your words leave with you — no lock-in, ever.',
        Icon: VaultIcon,
    },
] as const;
```

- [ ] **Step 2: Insert the journey markup** between `</header>` and `<footer>`:

```tsx
            <main>
                <section className={styles.journey} aria-label="Features">
                    <p className={styles.journeyKicker}>The journey ahead</p>
                    <h2 className={styles.journeyTitle}>Four landmarks on the road to a finished tale</h2>

                    <div className={styles.routeWrap} aria-hidden="true">
                        <svg viewBox="0 0 160 1200" preserveAspectRatio="none" fill="none">
                            <path
                                className="routeDraw"
                                d="M80 0 C140 150 20 280 80 420 C140 560 20 700 80 840 C130 960 50 1080 80 1200"
                                stroke="currentColor" strokeWidth="2.5"
                                strokeDasharray="0.018 0.012" pathLength={1} strokeLinecap="round"
                            />
                        </svg>
                    </div>

                    <ol className={styles.stops}>
                        {STOPS.map(({ name, feature, body, Icon }) => (
                            <li key={name} className={`${styles.stop} stopReveal`}>
                                <span className={styles.stopIcon}><Icon /></span>
                                <p className={styles.stopFeature}>{feature}</p>
                                <h3 className={styles.stopName}>{name}</h3>
                                <p className={styles.stopBody}>{body}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                <aside className={styles.marginalia} aria-hidden="true">
                    <div className={styles.marginaliaInner}>
                        <SeaSerpent />
                        <span className={styles.marginaliaNote}>here be dragons</span>
                    </div>
                </aside>
            </main>
```

Note on the route: `strokeDasharray="0.018 0.012"` with `pathLength={1}` produces dashes in normalized units; the `routeDraw` class (Task 5 CSS) layers `stroke-dasharray: 1` on top for draw-in. Because the class declaration wins over the attribute, the scroll draw works but dashes vanish — **the fix is the mask trick, same as the hero:** if the drawn route appears solid instead of dashed during preview, wrap the dashed path in a `<mask>`d pair exactly like `MapHero`'s `lc-route-mask` (solid `routeDraw` path inside `<mask>`, static dashed path with `mask=` beneath). Implementer: apply the mask variant directly — it is the correct final form:

```tsx
                        <svg viewBox="0 0 160 1200" preserveAspectRatio="none" fill="none">
                            <mask id="lc-journey-mask">
                                <path
                                    className="routeDraw"
                                    d="M80 0 C140 150 20 280 80 420 C140 560 20 700 80 840 C130 960 50 1080 80 1200"
                                    stroke="#fff" strokeWidth="12" pathLength={1} strokeLinecap="round"
                                />
                            </mask>
                            <path
                                d="M80 0 C140 150 20 280 80 420 C140 560 20 700 80 840 C130 960 50 1080 80 1200"
                                stroke="currentColor" strokeWidth="2.5"
                                strokeDasharray="10 9" strokeLinecap="round"
                                mask="url(#lc-journey-mask)"
                            />
                        </svg>
```

- [ ] **Step 3: Preview verification**

1. Reload `/welcome`, `preview_console_logs` level `error` → none.
2. `preview_eval`: scroll to the journey section; `preview_screenshot` → vermilion dashed route drawn down to (not past) the viewport center; passed landmarks fully inked; upcoming ones faded.
3. Scroll to bottom of journey → serpent + "here be dragons" visible in right margin.
4. `preview_resize` mobile (375) → route hugs the left edge, stops indented beside it, no horizontal overflow: `preview_eval` `document.documentElement.scrollWidth <= innerWidth` → true. Reset to desktop.

- [ ] **Step 4: Commit**

```bash
git add src/app/welcome/themes/fantasy/FantasyLanding.tsx
git commit -m "feat: scrollytelling journey route with four landmark stops and margin serpent"
```

---

### Task 7: The Letter (beta request form)

**Files:**
- Modify: `src/app/welcome/themes/fantasy/FantasyLanding.tsx`

- [ ] **Step 1: Add imports and form state**

Imports:

```tsx
import { useState } from 'react';
import { submitBetaRequest, type BetaRequestResult } from '../../shared/betaRequest';
import WaxSeal from './art/WaxSeal';
```

Inside the component, above the return:

```tsx
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<BetaRequestResult | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setResult(null);
        const outcome = await submitBetaRequest({ name, email, reason });
        setResult(outcome);
        setIsSubmitting(false);
    };
```

- [ ] **Step 2: Insert the letter section** inside `<main>`, after the marginalia aside:

```tsx
                <section id="letter" className={styles.letter} aria-label="Request beta access">
                    <h2 className={styles.letterHeading}>A letter to the Cartographer</h2>
                    <div className={styles.letterPanel}>
                        {result === 'done' ? (
                            <div className={styles.letterSuccess}>
                                <WaxSeal size={64} />
                                <h3 className={styles.letterSuccessTitle}>Your letter is sealed.</h3>
                                <p className={styles.letterIntro}>
                                    Watch the skies for a raven — if you&apos;re chosen for the
                                    beta, your invitation will arrive by post (well, email).
                                </p>
                            </div>
                        ) : (
                            <>
                                <p className={styles.letterSalutation}>Dear Cartographer,</p>
                                <p className={styles.letterIntro}>
                                    The beta is invite-only while we chart these waters.
                                    Send word of your tale and we&apos;ll dispatch a raven.
                                </p>
                                <form onSubmit={handleSubmit}>
                                    <div className={styles.field}>
                                        <label htmlFor="lname" className={styles.fieldLabel}>
                                            Your name, traveler
                                        </label>
                                        <input
                                            id="lname"
                                            className={styles.fieldInput}
                                            type="text"
                                            maxLength={120}
                                            placeholder="optional, but politer"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label htmlFor="lemail" className={styles.fieldLabel}>
                                            Where ravens may find you
                                        </label>
                                        <input
                                            id="lemail"
                                            className={styles.fieldInput}
                                            type="email"
                                            required
                                            placeholder="name@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label htmlFor="lreason" className={styles.fieldLabel}>
                                            What tale are you charting?
                                        </label>
                                        <textarea
                                            id="lreason"
                                            className={styles.fieldTextarea}
                                            maxLength={2000}
                                            placeholder="A fantasy trilogy, a screenplay, a sprawling sci-fi universe…"
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.sealRow}>
                                        <button
                                            type="submit"
                                            className={styles.sealButton}
                                            disabled={isSubmitting || !email.trim()}
                                        >
                                            <WaxSeal />
                                            {isSubmitting ? 'Sealing…' : 'Seal & send'}
                                        </button>
                                    </div>
                                </form>
                                {result === 'duplicate' && (
                                    <p className={styles.letterNote}>
                                        This address is already in the Cartographer&apos;s ledger —
                                        you&apos;re on the list.
                                    </p>
                                )}
                                {result === 'error' && (
                                    <p className={styles.letterError}>
                                        The raven was lost to a storm — please try again in a minute.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </section>
```

- [ ] **Step 3: Preview verification**

1. Reload, scroll to `#letter` (click "Begin your journey" via `preview_click` to also confirm smooth anchor scroll).
2. `preview_screenshot` → tilted letter panel with folded corner, underline fields, wax-seal button.
3. `preview_fill` the email field, confirm the seal button enables (`preview_eval` on `disabled`).
4. `preview_console_logs` level `error` → none. Do NOT actually submit (writes to production table).

- [ ] **Step 4: Run the logic tests again**

Run: `npx vitest run src/app/welcome`
Expected: all pass (betaRequest 3, registry 4)

- [ ] **Step 5: Commit**

```bash
git add src/app/welcome/themes/fantasy/FantasyLanding.tsx
git commit -m "feat: letter to the cartographer beta form with wax seal submit"
```

---

### Task 8: Theme shell + ThemeSwitcher

**Files:**
- Create: `src/app/welcome/shared/ThemeSwitcher.tsx`
- Create: `src/app/welcome/shared/switcher.module.css`
- Modify: `src/app/welcome/page.tsx` (final shell)

- [ ] **Step 1: ThemeSwitcher component**

`src/app/welcome/shared/ThemeSwitcher.tsx`:

```tsx
"use client";

import React, { useState } from 'react';
import { LANDING_THEMES } from '../themes/registry';
import styles from './switcher.module.css';

interface ThemeSwitcherProps {
    activeId: string;
    onSelect: (id: string) => void;
}

export default function ThemeSwitcher({ activeId, onSelect }: ThemeSwitcherProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={styles.switcher}>
            {isOpen && (
                <ul className={styles.menu} role="listbox" aria-label="Landing theme">
                    {LANDING_THEMES.map((theme) => (
                        <li key={theme.id}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={theme.id === activeId}
                                className={theme.id === activeId ? styles.itemActive : styles.item}
                                onClick={() => {
                                    onSelect(theme.id);
                                    setIsOpen(false);
                                }}
                            >
                                <span className={styles.itemName}>{theme.name}</span>
                                <span className={styles.itemTagline}>{theme.tagline}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                className={styles.toggle}
                aria-label="Change landing theme"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((v) => !v)}
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12 5 L13.4 10.6 L19 12 L13.4 13.4 L12 19 L10.6 13.4 L5 12 L10.6 10.6 Z"
                        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Switcher styles**

`src/app/welcome/shared/switcher.module.css`:

```css
/* Theme-neutral floating control — must read on any theme's background */

.switcher {
    position: fixed;
    bottom: 1.25rem;
    right: 1.25rem;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
}

.toggle {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid rgba(60, 50, 30, 0.35);
    background: rgba(250, 246, 235, 0.92);
    color: #3b2c15;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: transform 200ms ease;
}

.toggle:is(:hover, :focus-visible) {
    transform: rotate(40deg);
}

.menu {
    list-style: none;
    margin: 0;
    padding: 0.4rem;
    background: rgba(250, 246, 235, 0.97);
    border: 1px solid rgba(60, 50, 30, 0.35);
    border-radius: 8px;
    min-width: 14rem;
}

.item,
.itemActive {
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-radius: 5px;
    padding: 0.55rem 0.7rem;
    cursor: pointer;
    color: #3b2c15;
}

.item:is(:hover, :focus-visible) {
    background: rgba(60, 50, 30, 0.08);
}

.itemActive {
    background: rgba(60, 50, 30, 0.12);
}

.itemName {
    font-weight: 600;
    font-size: 0.95rem;
}

.itemTagline {
    font-size: 0.8rem;
    opacity: 0.65;
}
```

- [ ] **Step 3: Final page shell**

Replace `src/app/welcome/page.tsx`:

```tsx
"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getTheme, DEFAULT_THEME_ID, THEME_STORAGE_KEY } from './themes/registry';
import ThemeSwitcher from './shared/ThemeSwitcher';

/**
 * LoreCanvas public beta landing — theme shell.
 *
 * Unauthenticated visitors land here (see middleware.ts). The actual page is
 * a self-contained theme component picked from the registry; the visitor's
 * choice persists in localStorage. Fantasy Storybook is the default.
 */

const THEME_COMPONENTS: Record<string, React.ComponentType> = {
    fantasy: dynamic(() => import('./themes/fantasy/FantasyLanding')),
};

export default function WelcomePage() {
    const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);

    useEffect(() => {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved) setThemeId(getTheme(saved).id);
    }, []);

    const handleSelect = (id: string) => {
        const resolved = getTheme(id).id;
        setThemeId(resolved);
        localStorage.setItem(THEME_STORAGE_KEY, resolved);
    };

    const ActiveTheme = THEME_COMPONENTS[themeId] ?? THEME_COMPONENTS[DEFAULT_THEME_ID];

    return (
        <>
            <ActiveTheme />
            <ThemeSwitcher activeId={themeId} onSelect={handleSelect} />
        </>
    );
}
```

- [ ] **Step 4: Preview verification**

1. Reload `/welcome` → page renders identically; compass button floats bottom-right.
2. `preview_click` the compass → menu opens listing "Fantasy Storybook — The Cartographer's Desk", marked active.
3. `preview_eval` `localStorage.getItem('lc-landing-theme')` after selecting → `'fantasy'`.
4. `preview_console_logs` level `error` → none.

- [ ] **Step 5: Run all welcome tests**

Run: `npx vitest run src/app/welcome`
Expected: 7 passed

- [ ] **Step 6: Commit**

```bash
git add src/app/welcome/page.tsx src/app/welcome/shared/ThemeSwitcher.tsx src/app/welcome/shared/switcher.module.css
git commit -m "feat: theme shell with compass switcher and localStorage persistence"
```

---

### Task 9: Polish pass and full verification

- [ ] **Step 1: Emoji audit**

Run: `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/app/welcome --include="*.tsx" --include="*.ts" --include="*.css"; echo "exit=$?"`
Expected: `exit=1` (no matches). If matches: replace each with an SVG from `art/`.

- [ ] **Step 2: Reduced-motion check**

In `preview_eval`, inject a test override and screenshot:

```js
(() => { const s = document.createElement('style'); s.textContent = '*{animation:none!important}'; document.head.appendChild(s); return 'injected'; })()
```

Then `preview_eval` to check hero paths are visible even without animation playing — with animations disabled, `.inkPath` falls back to its non-animated state. Confirm the dedicated `prefers-reduced-motion` block in `fantasy-scroll.css` sets `stroke-dashoffset: 0` (visible) — the rule exists from Task 5. Reload to clear the injected style.

- [ ] **Step 3: Mobile sweep**

`preview_resize` mobile (375×812). Screenshot hero, journey, letter. Check:
- No horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`)
- Hero title wraps without clipping; map still legible behind
- Route hugs left edge; stops readable
- Letter panel fits with padding
Reset to desktop after.

- [ ] **Step 4: Lint, tests, build**

```bash
npx eslint src/app/welcome
npx vitest run src/app/welcome
npm run build
```

Expected: lint clean for the welcome tree, 7 tests pass, build succeeds.

- [ ] **Step 5: Final screenshots for the record**

Desktop screenshots: hero (fresh load mid-draw + settled), journey mid-scroll, letter, footer. These confirm the portfolio bar: if any frame looks flat or unfinished, iterate art/spacing before closing out (tune SVG path coordinates and stagger delays in place — that is expected finishing work, not scope creep).

- [ ] **Step 6: Commit any polish diffs**

```bash
git add -A src/app/welcome
git commit -m "polish: fantasy landing motion timing, mobile layout, reduced-motion fallbacks"
```

---

## Self-Review Notes

- **Spec coverage:** palette ✔ (Task 5 tokens) · typography ✔ (Task 5 fonts) · 5-act structure ✔ (Tasks 5–7) · theme registry + switcher + localStorage ✔ (Tasks 3, 8) · shared form logic ✔ (Task 2) · self-drawing hero ✔ (Tasks 4–5) · scroll route ✔ (Task 6) · serpent easter egg ✔ (Task 6) · wax-seal letter ✔ (Task 7) · reduced motion + fallback ✔ (Tasks 5, 9) · old files deleted ✔ (Task 5 step 5) · purple cameo: omitted deliberately — user released the brand constraint; can be added to `WaxSeal` later if requested.
- **Deviation from spec:** `BetaRequestForm.tsx` render-prop component became `betaRequest.ts` pure function — simpler, more testable, same reuse guarantee. Registry holds metadata only (components mapped in `page.tsx`) so vitest never imports `next/font`.
- **Type consistency:** `BetaRequestResult` used in Tasks 2 and 7 match; `getTheme`/`THEME_STORAGE_KEY` signatures match between Tasks 3 and 8; `--d` CSS var convention shared by Tasks 4 and 5.
