# Standard Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal dark "standard" landing theme (hero-only, animated dotted-wave background, no three.js) and make it the default, keeping fantasy available via the switcher.

**Architecture:** The landing is a theme shell (`page.tsx`) that dynamically loads a theme component chosen from `registry.ts` and persisted in localStorage. We add a new self-contained `standard` theme under `themes/standard/`, register it in the dynamic map, and flip the default theme id. The animated background is a custom 2D-canvas dot field. The "Request beta access" CTA opens a modal that reuses the existing `submitBetaRequest` funnel.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, CSS Modules, Vitest. No new runtime dependencies.

---

## File Structure

New files (all under `src/app/welcome/themes/standard/`):
- `DottedSurface.tsx` — fixed full-viewport animated canvas dot field. Self-contained, dark palette.
- `RequestAccessModal.tsx` — compact beta-request modal; reuses `shared/betaRequest.ts`.
- `requestModal.module.css` — modal styles (dark).
- `StandardLanding.tsx` — composes background + hero + footer; owns modal open state.
- `standard.module.css` — landing layout/typography (dark).

Modified files:
- `src/app/welcome/page.tsx` — register `standard` in the dynamic theme map.
- `src/app/welcome/themes/registry.ts` — add `standard` meta, set it as default.
- `src/app/welcome/themes/registry.test.ts` — update default-theme expectations.

Ordering keeps every commit runnable: components are built first, then registered in `page.tsx`, and the default is flipped **last** (so `page.tsx` always has a component for the default id).

---

## Task 1: DottedSurface background component

**Files:**
- Create: `src/app/welcome/themes/standard/DottedSurface.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useRef } from "react";

/**
 * DottedSurface — a lightweight animated dot field for the standard landing.
 *
 * A grid of dots on a 2D canvas; a travelling sine wave modulates each dot's
 * vertical offset and opacity so the field drifts like a slow swell. No
 * three.js. Fixed dark palette. Pauses when the tab is hidden and renders a
 * single static frame under prefers-reduced-motion. DPR is capped and dot
 * density is fixed by GAP, so fill cost stays low on large/ultrawide screens.
 */
export default function DottedSurface() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const GAP = 28;            // px between dots
        const DOT_RADIUS = 1.4;    // px
        const WAVE_SPEED = 0.0006; // radians per ms
        const WAVE_LENGTH = 0.004; // radians per px
        const AMPLITUDE = 10;      // px vertical drift
        const DOT_COLOR = "236, 233, 226"; // faint warm-neutral

        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        let cols = 0;
        let rows = 0;
        let width = 0;
        let height = 0;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = width + "px";
            canvas.style.height = height + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cols = Math.ceil(width / GAP) + 1;
            rows = Math.ceil(height / GAP) + 1;
        };

        const render = (time: number) => {
            ctx.clearRect(0, 0, width, height);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = c * GAP;
                    const baseY = r * GAP;
                    const phase = (x + baseY) * WAVE_LENGTH + time * WAVE_SPEED;
                    const wave = Math.sin(phase);
                    const y = baseY + wave * AMPLITUDE;
                    const alpha = 0.1 + (wave * 0.5 + 0.5) * 0.35;
                    ctx.fillStyle = `rgba(${DOT_COLOR}, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        };

        const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        let raf = 0;

        const loop = (t: number) => {
            render(t);
            raf = requestAnimationFrame(loop);
        };

        const start = () => {
            if (reduced) {
                render(0);
                return;
            }
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(loop);
        };

        const onResize = () => {
            resize();
            if (reduced) render(0);
        };
        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                cancelAnimationFrame(raf);
            } else {
                start();
            }
        };

        resize();
        start();
        window.addEventListener("resize", onResize);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                width: "100vw",
                height: "100vh",
                zIndex: -1,
                pointerEvents: "none",
                background: "#0a0a0b",
            }}
        />
    );
}
```

- [ ] **Step 2: Type-check the file**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `DottedSurface.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/welcome/themes/standard/DottedSurface.tsx
git commit -m "feat: dotted-surface animated background for standard landing"
```

---

## Task 2: RequestAccessModal component

**Files:**
- Create: `src/app/welcome/themes/standard/requestModal.module.css`
- Create: `src/app/welcome/themes/standard/RequestAccessModal.tsx`

- [ ] **Step 1: Create the modal styles**

`src/app/welcome/themes/standard/requestModal.module.css`:

```css
.backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
}

.modal {
    position: relative;
    width: 100%;
    max-width: 30rem;
    background: #141416;
    border: 1px solid rgba(236, 236, 236, 0.12);
    border-radius: 16px;
    padding: 2rem;
    color: #ececec;
    font-family: var(--font-sans, ui-sans-serif, system-ui, -apple-system,
        "Segoe UI", Roboto, sans-serif);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}

.close {
    position: absolute;
    top: 0.75rem;
    right: 0.9rem;
    background: none;
    border: none;
    color: rgba(236, 236, 236, 0.6);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
}
.close:hover {
    color: #fff;
}

.title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    font-weight: 600;
}

.intro {
    margin: 0 0 1.25rem;
    font-size: 0.95rem;
    line-height: 1.5;
    color: rgba(236, 236, 236, 0.7);
}

.form {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.label {
    font-size: 0.8rem;
    color: rgba(236, 236, 236, 0.7);
    margin-top: 0.6rem;
}

.input,
.textarea {
    width: 100%;
    background: #0d0d0f;
    border: 1px solid rgba(236, 236, 236, 0.15);
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    color: #ececec;
    font-family: inherit;
    font-size: 0.95rem;
}
.input:focus,
.textarea:focus {
    outline: none;
    border-color: rgba(236, 236, 236, 0.45);
}
.textarea {
    min-height: 5rem;
    resize: vertical;
}

.primary {
    margin-top: 1.1rem;
    appearance: none;
    border: none;
    cursor: pointer;
    background: #f5f5f5;
    color: #0a0a0b;
    padding: 0.75rem 1.25rem;
    border-radius: 999px;
    font-size: 0.95rem;
    font-weight: 600;
    font-family: inherit;
}
.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.primary:hover:not(:disabled) {
    background: #fff;
}

.success {
    text-align: center;
}

.note {
    margin: 0.9rem 0 0;
    font-size: 0.85rem;
    color: rgba(236, 236, 236, 0.7);
}
.error {
    margin: 0.9rem 0 0;
    font-size: 0.85rem;
    color: #ff9b8a;
}
```

- [ ] **Step 2: Create the modal component**

`src/app/welcome/themes/standard/RequestAccessModal.tsx`:

```tsx
"use client";

import React, { useEffect, useState } from "react";
import {
    submitBetaRequest,
    type BetaRequestResult,
} from "../../shared/betaRequest";
import styles from "./requestModal.module.css";

interface RequestAccessModalProps {
    onClose: () => void;
}

/**
 * RequestAccessModal — compact beta-request dialog for the standard landing.
 * Reuses the shared submitBetaRequest funnel and surfaces its result states.
 */
export default function RequestAccessModal({ onClose }: RequestAccessModalProps) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<BetaRequestResult | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setResult(null);
        const outcome = await submitBetaRequest({ name, email, reason });
        setResult(outcome);
        setIsSubmitting(false);
    };

    return (
        <div className={styles.backdrop} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="request-title"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className={styles.close}
                    aria-label="Close"
                    onClick={onClose}
                >
                    ×
                </button>

                {result === "done" ? (
                    <div className={styles.success}>
                        <h2 id="request-title" className={styles.title}>
                            You&apos;re on the list.
                        </h2>
                        <p className={styles.intro}>
                            If you&apos;re selected for the beta, we&apos;ll email your
                            invite.
                        </p>
                        <button
                            type="button"
                            className={styles.primary}
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 id="request-title" className={styles.title}>
                            Request beta access
                        </h2>
                        <p className={styles.intro}>
                            LoreCanvas is invite-only during the beta. Leave your email
                            and we&apos;ll reach out.
                        </p>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <label className={styles.label} htmlFor="req-email">
                                Email
                            </label>
                            <input
                                id="req-email"
                                className={styles.input}
                                type="email"
                                required
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <label className={styles.label} htmlFor="req-name">
                                Name (optional)
                            </label>
                            <input
                                id="req-name"
                                className={styles.input}
                                type="text"
                                maxLength={120}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                            <label className={styles.label} htmlFor="req-reason">
                                What are you writing? (optional)
                            </label>
                            <textarea
                                id="req-reason"
                                className={styles.textarea}
                                maxLength={2000}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                            <button
                                type="submit"
                                className={styles.primary}
                                disabled={isSubmitting || !email.trim()}
                            >
                                {isSubmitting ? "Sending…" : "Request access"}
                            </button>
                        </form>
                        {result === "duplicate" && (
                            <p className={styles.note}>
                                This email is already on the list.
                            </p>
                        )}
                        {result === "error" && (
                            <p className={styles.error}>
                                Something went wrong — try again in a minute.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `RequestAccessModal.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/app/welcome/themes/standard/RequestAccessModal.tsx src/app/welcome/themes/standard/requestModal.module.css
git commit -m "feat: request-access modal for standard landing"
```

---

## Task 3: StandardLanding page + styles

**Files:**
- Create: `src/app/welcome/themes/standard/standard.module.css`
- Create: `src/app/welcome/themes/standard/StandardLanding.tsx`

- [ ] **Step 1: Create the landing styles**

`src/app/welcome/themes/standard/standard.module.css`:

```css
.page {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    color: #ececec;
    font-family: var(--font-sans, ui-sans-serif, system-ui, -apple-system,
        "Segoe UI", Roboto, sans-serif);
    background: #0a0a0b;
    overflow: hidden;
}

.nav {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem clamp(1.25rem, 4vw, 3rem);
}

.brand {
    font-weight: 600;
    letter-spacing: 0.02em;
    font-size: 1.1rem;
}

.navSignIn {
    color: rgba(236, 236, 236, 0.7);
    text-decoration: none;
    font-size: 0.9rem;
    transition: color 150ms ease;
}
.navSignIn:hover {
    color: #fff;
}

.hero {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem clamp(1.25rem, 5vw, 4rem) 4rem;
    gap: 1.5rem;
}

.title {
    margin: 0;
    font-size: clamp(2.5rem, 1.5rem + 5vw, 5.5rem);
    line-height: 1.05;
    letter-spacing: -0.02em;
    font-weight: 600;
    max-width: 16ch;
}

.sub {
    margin: 0;
    max-width: 52ch;
    font-size: clamp(1rem, 0.95rem + 0.4vw, 1.25rem);
    line-height: 1.6;
    color: rgba(236, 236, 236, 0.72);
}

.ctas {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
    margin-top: 0.5rem;
}

.ctaPrimary {
    appearance: none;
    border: none;
    cursor: pointer;
    background: #f5f5f5;
    color: #0a0a0b;
    padding: 0.85rem 1.6rem;
    border-radius: 999px;
    font-size: 1rem;
    font-weight: 600;
    font-family: inherit;
    transition: transform 150ms ease, background 150ms ease;
}
.ctaPrimary:hover {
    background: #fff;
    transform: translateY(-1px);
}

.ctaSecondary {
    display: inline-flex;
    align-items: center;
    padding: 0.85rem 1.6rem;
    border-radius: 999px;
    border: 1px solid rgba(236, 236, 236, 0.25);
    color: #ececec;
    text-decoration: none;
    font-size: 1rem;
    transition: border-color 150ms ease, background 150ms ease;
}
.ctaSecondary:hover {
    border-color: rgba(236, 236, 236, 0.5);
    background: rgba(255, 255, 255, 0.04);
}

.footer {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: 1.5rem;
    font-size: 0.82rem;
    color: rgba(236, 236, 236, 0.5);
}
.footerLink {
    color: rgba(236, 236, 236, 0.7);
    text-decoration: none;
}
.footerLink:hover {
    color: #fff;
}
```

- [ ] **Step 2: Create the landing component**

`src/app/welcome/themes/standard/StandardLanding.tsx`:

```tsx
"use client";

import React, { useEffect, useState } from "react";
import DottedSurface from "./DottedSurface";
import RequestAccessModal from "./RequestAccessModal";
import styles from "./standard.module.css";

/**
 * StandardLanding — minimal dark hero-only landing.
 * Animated dotted-surface background + centered hero. The primary CTA opens a
 * beta-request modal; the secondary CTA links to /login.
 */
export default function StandardLanding() {
    const [showRequest, setShowRequest] = useState(false);

    useEffect(() => {
        document.documentElement.dataset.lcLanding = "standard";
        return () => {
            delete document.documentElement.dataset.lcLanding;
        };
    }, []);

    return (
        <div className={styles.page}>
            <DottedSurface />

            <nav className={styles.nav}>
                <div className={styles.brand}>LoreCanvas</div>
                <a href="/login" className={styles.navSignIn}>
                    Beta tester sign in
                </a>
            </nav>

            <main className={styles.hero}>
                <h1 className={styles.title}>Write your world into existence.</h1>
                <p className={styles.sub}>
                    The writing desk for novelists and worldbuilders — manuscript,
                    lore, and momentum in one place.
                </p>
                <div className={styles.ctas}>
                    <button
                        type="button"
                        className={styles.ctaPrimary}
                        onClick={() => setShowRequest(true)}
                    >
                        Request beta access
                    </button>
                    <a href="/login" className={styles.ctaSecondary}>
                        Beta tester sign in
                    </a>
                </div>
            </main>

            <footer className={styles.footer}>
                © {new Date().getFullYear()} LoreCanvas ·{" "}
                <a href="/login" className={styles.footerLink}>
                    Sign in
                </a>
            </footer>

            {showRequest && (
                <RequestAccessModal onClose={() => setShowRequest(false)} />
            )}
        </div>
    );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `StandardLanding.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/app/welcome/themes/standard/StandardLanding.tsx src/app/welcome/themes/standard/standard.module.css
git commit -m "feat: standard dark hero landing page"
```

---

## Task 4: Register the standard theme component in the shell

**Files:**
- Modify: `src/app/welcome/page.tsx:16-18`

- [ ] **Step 1: Add the dynamic import to the theme map**

Replace the `THEME_COMPONENTS` map:

```tsx
const THEME_COMPONENTS: Record<string, React.ComponentType> = {
    fantasy: dynamic(() => import('./themes/fantasy/FantasyLanding')),
};
```

with:

```tsx
const THEME_COMPONENTS: Record<string, React.ComponentType> = {
    standard: dynamic(() => import('./themes/standard/StandardLanding')),
    fantasy: dynamic(() => import('./themes/fantasy/FantasyLanding')),
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/welcome/page.tsx
git commit -m "feat: register standard landing theme in shell"
```

---

## Task 5: Make standard the default theme (TDD)

**Files:**
- Modify: `src/app/welcome/themes/registry.test.ts`
- Modify: `src/app/welcome/themes/registry.ts`

- [ ] **Step 1: Update the failing test first**

Replace the first test in `registry.test.ts`:

```ts
    it('contains the fantasy theme as default', () => {
        expect(LANDING_THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
        expect(DEFAULT_THEME_ID).toBe('fantasy');
    });
```

with:

```ts
    it('has standard as the default and includes fantasy', () => {
        expect(LANDING_THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
        expect(DEFAULT_THEME_ID).toBe('standard');
        expect(LANDING_THEMES.some((t) => t.id === 'fantasy')).toBe(true);
        expect(LANDING_THEMES.some((t) => t.id === 'standard')).toBe(true);
    });
```

Also update the fallback test's known-id assertion (the `getTheme('fantasy')` line stays valid; add a standard check). Replace:

```ts
    it('falls back to the default theme for unknown or null ids', () => {
        expect(getTheme('does-not-exist').id).toBe(DEFAULT_THEME_ID);
        expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
        expect(getTheme('fantasy').id).toBe('fantasy');
    });
```

with:

```ts
    it('falls back to the default theme for unknown or null ids', () => {
        expect(getTheme('does-not-exist').id).toBe(DEFAULT_THEME_ID);
        expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
        expect(getTheme('fantasy').id).toBe('fantasy');
        expect(getTheme('standard').id).toBe('standard');
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/welcome/themes/registry.test.ts`
Expected: FAIL — `DEFAULT_THEME_ID` is still `'fantasy'` and `standard` is not in `LANDING_THEMES`.

- [ ] **Step 3: Update the registry**

In `registry.ts`, change the default id:

```ts
export const DEFAULT_THEME_ID = 'standard';
```

and replace the `LANDING_THEMES` array:

```ts
export const LANDING_THEMES: LandingThemeMeta[] = [
    {
        id: 'standard',
        name: 'Minimalist',
        tagline: 'Dark & modern',
    },
    {
        id: 'fantasy',
        name: 'Fantasy Storybook',
        tagline: "The Cartographer's Desk",
    },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/app/welcome/themes/registry.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/welcome/themes/registry.ts src/app/welcome/themes/registry.test.ts
git commit -m "feat: make standard the default landing theme"
```

---

## Task 6: Full verification (preview + build)

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS (registry tests updated; existing tests unaffected).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors in the new files.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/welcome` compiles.

- [ ] **Step 4: Preview checks (dev server on port 4000)**

Load `/welcome` in the preview and confirm:
- Fresh visitor (clear `localStorage` key `lc-landing-theme`) lands on the **standard** dark theme.
- Dotted background animates (drifting dots); no console errors.
- "Beta tester sign in" → `/login`.
- "Request beta access" opens the modal; submitting a new email shows success; a
  repeat email shows the "already on the list" note.
- Theme switcher lists **Minimalist** and **Fantasy Storybook**; switching to
  fantasy renders the old landing; the choice persists on reload.
- Reduced-motion (emulate) → dots render static, no animation loop.
- Widest viewport → animation stays smooth.

- [ ] **Step 5: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "chore: verification fixups for standard landing"
```

(Skip if nothing changed.)

---

## Notes / Gotchas

- **Do not flip `DEFAULT_THEME_ID` before Task 4.** `page.tsx` resolves
  `THEME_COMPONENTS[themeId] ?? THEME_COMPONENTS[DEFAULT_THEME_ID]`; if the
  default id has no registered component the page renders `undefined` and
  crashes. Component registration (Task 4) precedes the default flip (Task 5).
- The standard landing is intentionally dark regardless of the app's
  `data-theme` — its palette is hard-coded, matching the fantasy landing's
  self-contained approach.
- No React Testing Library in this repo; component behavior (modal, canvas) is
  verified via the preview in Task 6, consistent with existing practice.
- `submitBetaRequest` lowercases/trims the email and maps unique-violation
  (`23505`) to `'duplicate'` — no extra validation needed in the modal.
