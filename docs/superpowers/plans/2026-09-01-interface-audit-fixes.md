# Interface Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every finding in the LoreCanvas interface audit — accessibility, motion, focus, typography, iconography, hit targets, layout, and first-run states.

**Architecture:** Most fixes are global rather than per-screen: one `inert` attribute per panel, one reduced-motion block, one focus ring, one scripted type floor. The per-component work (icons, empty states, confirmations) follows after, because the global passes change what the per-component work is looking at.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, lucide-react, Vitest.

**Source:** The audit artifact published 2026-09-01. Every figure below was measured on the running app at 2177 × 1274.

---

## How verification works in this plan

This is UI work with almost no unit-testable logic, so **the audit's own measurements are the acceptance tests.** Each task ends by re-running the exact browser probe that found the problem, against a target number. Run probes in the Browser pane (`preview_start` with `{name: "dev"}`) — never start a dev server through Bash.

Regression safety net for every task: `npx tsc --noEmit --pretty false` clean, and `npx vitest run` still at 406 passing.

## Scope note

Thirteen tasks, largely independent. **Tasks 1–4 are the core** — they close the critical finding and three of the five significant ones, and could ship alone if the rest is deferred. Tasks 5–12 are polish and consistency; Task 13 is the regression pass.

## File Structure

| File | Responsibility |
|---|---|
| `src/components/layout/*Panel.tsx` (6 files, modify) | Mark closed panels `inert`. |
| `src/app/globals.css` (modify) | Global reduced-motion guard; global focus ring; type floor variables. |
| 39 CSS modules (modify, scripted) | Raise sub-11px declarations to the floor. |
| ~20 component files (modify) | Replace emoji icons with Lucide equivalents. |
| `src/components/editor/WritingDesk.module.css` (modify) | Centre and widen the writing sheet. |
| `src/components/management/Bookshelf.tsx` (modify) | Route book deletion through the modal confirm. |
| `src/components/home/HomePage.tsx` (modify) | Heading semantics, input labels. |
| `WorldBibleCenter/Home/Root.tsx` (modify) | Empty-strip copy. |
| `src/components/editor/WritingDesk.tsx` (modify) | Remove the in-app splash branding. |

---

### Task 1: Take closed panels out of the tab order

**The critical finding.** Five closed panels sit at `x ≈ 2194` in a 2177px viewport, focusable and announced. 47 phantom tab stops.

**Files:**
- Modify: `src/components/layout/WorldBiblePanel.tsx:94`
- Modify: `src/components/layout/WritingGoalsPanel.tsx:93`
- Modify: `src/components/layout/SocialMediaPanel.tsx:186`
- Modify: `src/components/layout/MusicPlayerPanel.tsx:188`
- Modify: `src/components/layout/VersionHistoryPanel.tsx:175`
- Modify: `src/components/layout/BetaFeedbackPanel.tsx:190`

- [ ] **Step 1: Record the baseline**

In the Browser pane on Home, run:

```js
const offscreen = [...document.querySelectorAll('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])')]
  .filter(e => { const r = e.getBoundingClientRect(); return r.left > window.innerWidth - 5 || r.left < -5; });
({ offscreenFocusable: offscreen.length, viewportW: window.innerWidth });
```

Expected now: `offscreenFocusable: 47`.

- [ ] **Step 2: Add `inert` to each panel**

Every one of the six files has the same element. In each, find:

```tsx
className={`${styles.panel} ${isOpen ? styles.open : ''}`}
```

and add `inert` immediately after it:

```tsx
className={`${styles.panel} ${isOpen ? styles.open : ''}`}
// A closed panel is only off-screen, not unmounted — without this it keeps its
// tab stops and stays in the accessibility tree. inert removes both at once.
inert={!isOpen}
```

React 19 passes `inert` through as a real attribute, so no polyfill is needed.

Do **not** touch the `sideTab` button in these files. It is rendered in a separate portal outside the panel and must stay focusable — it is how the panel gets opened.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --pretty false`

Expected: no output. If TypeScript rejects `inert` on a `div`, the installed `@types/react` predates React 19's typing — add `inert={!isOpen ? '' : undefined}` instead, which is the string form the DOM accepts.

- [ ] **Step 4: Re-run the probe**

Reload Home and run the Step 1 snippet again.

Expected: `offscreenFocusable: 0`.

- [ ] **Step 5: Confirm panels still work when open**

Click the World Bible side tab. Confirm the panel opens, its controls are focusable, and Tab moves through them. Close it and confirm they leave the tab order again.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/
git commit -m "fix: take closed side panels out of the tab order

All five right-edge panels stay mounted and are pushed off-screen when
closed, which left 47 focusable controls a keyboard user tabbed through
blind and put five hidden panels in the accessibility tree. inert removes
both in one attribute."
```

---

### Task 2: Honour reduced motion globally

48 of 55 animated stylesheets ignore `prefers-reduced-motion`.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Record the baseline**

```bash
python -c "
import io,glob
css=glob.glob('src/**/*.css',recursive=True)
anim=[f for f in css if 'transition:' in io.open(f,encoding='utf-8').read() or 'animation:' in io.open(f,encoding='utf-8').read()]
rm=[f for f in css if 'prefers-reduced-motion' in io.open(f,encoding='utf-8').read()]
print('animated:',len(anim),'guarded:',len(rm),'unguarded:',len([f for f in anim if f not in rm]))
"
```

Expected now: `animated: 55 guarded: 7 unguarded: 48`.

- [ ] **Step 2: Add the global guard**

Append to `src/app/globals.css`:

```css
/* ──────────────────────────────────────────────────────────────
   Reduced motion.

   A system-level setting, not a preference to sample per component.
   Individual modules may still opt a specific transition back in when
   it carries meaning rather than decoration — this is the floor, not a
   ban. Transitions are cut to 1ms rather than 0 so transitionend still
   fires and any handler waiting on it does not hang.
   ────────────────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Verify it applies**

In the Browser pane, emulate reduced motion and confirm a known animation is neutralised:

```js
// The shelf spine has an 0.18s transform transition.
const spine = document.querySelector('[role=tab]');
getComputedStyle(spine).transitionDuration;
```

Use `resize_window` with `colorScheme` unchanged, then check with DevTools emulation unavailable — instead assert the rule exists and is last-wins:

```js
[...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } })
  .filter(r => r.conditionText && r.conditionText.includes('reduced-motion')).length;
```

Expected: at least 1, and the global rule present.

- [ ] **Step 4: Confirm nothing broke visually**

Load Home, the Writing Desk and the Bookshelf with normal motion settings. Animations should be unchanged — the guard only applies under the media query.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "fix: honour prefers-reduced-motion across the app

Seven of 55 animated stylesheets respected the setting; the other 48
animated regardless. One global floor covers them all, leaving room for
a module to opt a meaningful transition back in."
```

---

### Task 3: Give keyboard focus a visible state everywhere

Only 8 of 61 stylesheets use `:focus-visible`.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add the global ring**

Append to `src/app/globals.css`:

```css
/* ──────────────────────────────────────────────────────────────
   Focus.

   :focus-visible rather than :focus, so a mouse user never gets a ring
   they did not ask for and a keyboard user always does. Components with
   their own better ring override this by specificity.
   ────────────────────────────────────────────────────────────── */
:focus-visible {
  outline: 2px solid var(--accent, #8ab4ff);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Never remove the ring without replacing it. */
:focus:not(:focus-visible) {
  outline: none;
}
```

- [ ] **Step 2: Verify**

On Home, run:

```js
const b = document.querySelector('button');
b.focus();
getComputedStyle(b).outlineWidth;
```

Then Tab through the first ten controls visually and confirm each shows a ring.

Expected: a visible 2px ring on keyboard focus, none on mouse click.

- [ ] **Step 3: Check for controls the ring now clips**

Look for any control whose ring is cut off by an ancestor's `overflow: hidden` — the shelf spines and the covers scroller are the likely candidates. If found, give that ancestor `overflow: visible` or the control `outline-offset: -2px`.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "fix: give keyboard focus a visible state everywhere

Eight of 61 stylesheets used :focus-visible; the rest either showed a
ring to mouse users or nothing to keyboard users. One global ring, with
component rings still winning on specificity."
```

---

### Task 4: Raise the type floor

318 declarations sit under 12px across 39 files, the smallest at 8px. 23% of visible text on Home is 11px or under.

**Files:**
- Modify: 39 CSS modules, scripted

- [ ] **Step 1: Record the baseline**

```bash
python -c "
import io,re,glob
n=0
for f in glob.glob('src/**/*.css',recursive=True):
    for ln in io.open(f,encoding='utf-8'):
        m=re.search(r'font-size:\s*([\d.]+)rem',ln)
        if m and float(m.group(1))*16 < 11: n+=1
        m2=re.search(r'font-size:\s*([\d.]+)px',ln)
        if m2 and float(m2.group(1)) < 11: n+=1
print('declarations under 11px:',n)
"
```

Expected now: a non-zero count (roughly 100).

- [ ] **Step 2: Apply the floor**

The floor is **11px (0.6875rem)** — Apple's minimum. This pass raises only what is below it; the 11px–12px band is left alone so the change stays bounded and reviewable.

```bash
python - <<'PYEOF'
import io, re, glob
FLOOR_REM = 0.6875
changed = []
for f in glob.glob('src/**/*.css', recursive=True):
    src = io.open(f, encoding='utf-8').read()
    orig = src
    def fix_rem(m):
        v = float(m.group(1))
        return 'font-size: %srem' % FLOOR_REM if v * 16 < 11 else m.group(0)
    def fix_px(m):
        v = float(m.group(1))
        return 'font-size: %srem' % FLOOR_REM if v < 11 else m.group(0)
    src = re.sub(r'font-size:\s*([\d.]+)rem', fix_rem, src)
    src = re.sub(r'font-size:\s*([\d.]+)px', fix_px, src)
    if src != orig:
        io.open(f, 'w', encoding='utf-8', newline='\n').write(src)
        changed.append(f)
print('files changed:', len(changed))
for c in changed: print(' ', c)
PYEOF
```

- [ ] **Step 3: Re-run the baseline probe**

Expected: `declarations under 11px: 0`.

- [ ] **Step 4: Visually check the densest surfaces**

The Writing Desk holds most of these declarations, so it is where a floor will show first. Load and inspect, in order: **Writing Desk**, **mode bar**, **Goals panel**, **Version History panel**, **World Bible book spine**.

Look for: text now clipping its container, labels wrapping to two lines where they used to fit, and toolbar rows growing taller.

Where a component genuinely breaks, fix the layout to fit the larger text — do **not** revert that declaration below the floor. If a label cannot fit at 11px, it is the wrong label for the space.

- [ ] **Step 5: Confirm on Home**

```js
const sizes = {};
for (const el of document.querySelectorAll('*')) {
  const t = el.textContent || '';
  if (el.children.length || !t.trim() || el.offsetParent === null) continue;
  const px = Math.round(parseFloat(getComputedStyle(el).fontSize));
  sizes[px] = (sizes[px] || 0) + 1;
}
const total = Object.values(sizes).reduce((a, b) => a + b, 0);
const tiny = Object.entries(sizes).filter(([px]) => +px < 11).reduce((n, [, c]) => n + c, 0);
({ sizes, belowFloor: tiny, total });
```

Expected: `belowFloor: 0`.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "fix: raise the type floor to 11px

318 font-size declarations sat under 12px and the smallest was 8px, which
is below any readable minimum. Everything under 11px is raised to it;
the 11-12px band is untouched so the change stays reviewable."
```

---

### Task 5: Replace emoji icons with the icon set the app already uses

37 buttons use an emoji as their icon while the rest of the app uses Lucide SVG, and the two appear together on the same screens. Emoji also render as a different typeface per platform and ignore the colour tokens.

**Files:** ~20 component files. Split into three commits by area so each is reviewable.

**The mapping.** Every emoji here has a Lucide equivalent already used elsewhere in this codebase:

| Emoji | Lucide | Emoji | Lucide |
|---|---|---|---|
| ✕ | `X` | 🗑️ 🗑 | `Trash2` |
| ✏️ | `Pencil` | ⚙️ | `Settings` |
| 📖 | `BookOpen` | 🏠 | `Home` |
| 💬 | `MessageSquare` | ⚓ | `Anchor` |
| ➕ | `Plus` | 🔄 | `RotateCcw` |
| 👍 | `ThumbsUp` | 👎 | `ThumbsDown` |
| 📷 | `Camera` | 🖊️ | `PenLine` |
| ✓ | `Check` | | |

Standard sizes: `14` for inline chips, `16` for toolbar buttons, `18` for panel close buttons.

- [ ] **Step 1: Modals and panels — the close buttons**

These 11 are all `✕` and all the same shape. In each file, add `X` to the `lucide-react` import and replace the glyph with `<X size={18} />`. Where the button has no `aria-label`, add `aria-label="Close"`.

- `src/components/ui/ImportModal.tsx:308`
- `src/components/ui/NewProjectModal.tsx:95`
- `src/components/ui/NewWorldModal.tsx:232`
- `src/components/ui/ProjectLibraryModal.tsx:52`
- `src/components/ui/ProjectSettingsModal.tsx:76`
- `src/components/world/ArticleCanvas.tsx:255`
- `src/components/world/ArticleView.tsx:489`
- `src/components/world/TemplatePanel.tsx:61`
- `src/components/layout/BetaFeedbackPanel.tsx:222`
- `src/components/editor/research/ChatTrays.tsx:118`
- `src/components/editor/research/InterviewEditorModal.tsx:92`

Example, from `ImportModal.tsx:308`:

```tsx
// before
<button className={styles.closeBtn} onClick={onClose}>✕</button>
// after
<button className={styles.closeBtn} onClick={onClose} aria-label="Close">
  <X size={18} />
</button>
```

Then run `npx tsc --noEmit --pretty false` and commit:

```bash
git add src/components/ui src/components/world src/components/layout src/components/editor/research
git commit -m "refactor: use the app's icon set for modal and panel close buttons"
```

- [ ] **Step 2: The Bookshelf and World Bible**

- `src/components/management/Bookshelf.tsx:473` — `✏️` → `<Pencil size={14} />`
- `src/components/management/Bookshelf.tsx:479` — `🗑️` → `<Trash2 size={14} />`
- `src/components/management/Bookshelf.tsx:421` — `✕` → `<X size={14} />`
- `src/components/world/TemplatePanel.tsx:140` — `🗑` → `<Trash2 size={14} />`
- `src/components/world/WorldBibleEntry.tsx:144` — `✏️` → `<Pencil size={14} />`
- `src/components/world/WorldBibleEntry.tsx:256` — `✓` → `<Check size={14} />`
- `src/components/world/WorldBibleNav.tsx:124` — `📖` → `<BookOpen size={16} />`
- `src/components/world/WorldBibleNav.tsx:132` — `🏠` → `<Home size={16} />`

These sit directly beside Lucide icons in the mode bar, so this is the pairing the audit called out most visibly. Commit:

```bash
git add src/components/management src/components/world
git commit -m "refactor: use the app's icon set on the Bookshelf and World Bible"
```

- [ ] **Step 3: The desk and research surfaces**

- `src/components/editor/WritingDesk.tsx` lines 709, 802 — `💬` → `<MessageSquare size={14} />`
- `src/components/editor/WritingDesk.tsx` lines 722, 811 — `⚓` → `<Anchor size={14} />`
- `src/components/editor/WritingDesk.tsx` lines 738, 827 — `✕` → `<X size={14} />`
- `src/components/editor/ResearchTab.tsx:298` — `💬` → `<MessageSquare size={14} />`
- `src/components/editor/desk/DeskTipTapEditor.tsx:176` — `🖊️` → `<PenLine size={14} />`
- `src/components/editor/desk/WidgetLibraryDropdown.tsx:33` — `➕` → `<Plus size={14} />`
- `src/components/editor/desk/widgets/ProgressRenderer.tsx:132` — `🔄` → `<RotateCcw size={14} />`
- `src/components/editor/desk/widgets/ArticleSuggestionsRenderer.tsx:165` — `✕` → `<X size={13} />`
- `src/components/editor/research/ResearchChatPanel.tsx:790` — `👍` → `<ThumbsUp size={14} />`
- `src/components/editor/research/ResearchChatPanel.tsx:798` — `👎` → `<ThumbsDown size={14} />`
- `src/components/editor/research/ResearchChatPanel.tsx:874` — `📷` → `<Camera size={14} />`
- `src/components/editor/research/ResearchChatPanel.tsx:836,845` — `✕` → `<X size={13} />`
- `src/components/editor/research/InterviewEditorModal.tsx:160` — `✕` → `<X size={13} />`
- `src/components/navigation/ModeBar.tsx:511` — `⚙️` → `<Settings size={16} />`
- `src/components/editor/WritingDesk.tsx:903` — `🖼️ Clipping` → `<Image size={14} /> Clipping` (keep the text label)

- [ ] **Step 4: Confirm none are left**

```bash
python - <<'PYEOF'
import io, re, glob
n = 0
pat = re.compile(r'[\U0001F300-\U0001FAFF☀-➿]')
for f in glob.glob('src/**/*.tsx', recursive=True):
    lines = io.open(f, encoding='utf-8').read().split('\n')
    for i, ln in enumerate(lines):
        s = ln.strip()
        ctx = '\n'.join(lines[max(0, i - 6):i + 1])
        if pat.search(s) and '<button' in ctx:
            print(f, i + 1, s[:60]); n += 1
print('remaining emoji-icon buttons:', n)
PYEOF
```

Expected: `0`. Emoji used as **content** (genre pickers, work-type cards, seed data) is fine and out of scope — only controls were in question.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor src/components/navigation
git commit -m "refactor: use the app's icon set on the desk and research surfaces

Emoji render as a different typeface on every platform, ignore the colour
tokens and shift size unpredictably, so a control drawn with one never
matches the Lucide icon beside it."
```

---

### Task 6: Make small controls catchable

18 controls on Home alone are below the 44×44pt minimum; the scheduled-goals cog is 23 × 23.

**Files:**
- Modify: `src/components/home/HomePage.module.css`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Record the baseline**

```js
const small = [...document.querySelectorAll('button,a[href],input,[tabindex]:not([tabindex="-1"])')]
  .filter(e => e.offsetParent !== null)
  .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); });
({ belowMinimum: small.length });
```

Expected now: `18`.

- [ ] **Step 2: Add a hit-area helper**

Append to `src/app/globals.css`:

```css
/* ──────────────────────────────────────────────────────────────
   Hit areas.

   Grows the touchable region without changing how big the control
   looks — the icon stays small, the target does not. Apply to any
   icon-only control that renders under 44px.
   ────────────────────────────────────────────────────────────── */
.hit-target { position: relative; }
.hit-target::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: max(100%, 44px);
  height: max(100%, 44px);
  transform: translate(-50%, -50%);
}
```

- [ ] **Step 3: Grow the goal cog**

In `src/components/home/HomePage.module.css`, the `.goalCog` rule has `padding: 4px`. Replace that line with:

```css
  /* The icon stays 15px; the target reaches 44. */
  padding: 4px;
  position: relative;
}
.goalCog::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
```

- [ ] **Step 4: Apply the helper to the remaining icon-only controls**

Add `hit-target` to the className of each icon-only control the probe reports under 44px — the panel close buttons, the history arrows, and the mode-bar icon buttons. Text links reported by the probe (`View all`, `Open Research`, `Open world bible`) are **not** in scope: they are text, not icon targets, and padding them out would break the layouts they sit in.

- [ ] **Step 5: Re-run the probe**

Expected: only text links remain under 44px — no icon-only control.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components
git commit -m "fix: grow small icon controls to a catchable size

The scheduled-goals cog was 23x23 and 17 other controls were under the
44pt minimum. The hit area grows via a pseudo-element so the icons look
exactly as they did."
```

---

### Task 7: Lift small text off the contrast floor

16 samples measured below WCAG AA, worst between 1.0:1 and 1.7:1, clustered at 10–13px.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Find the failing elements**

```js
function lum(c){const [r,g,b]=c.match(/\d+(\.\d+)?/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*r+0.7152*g+0.0722*b;}
function ratio(f,b){const a=lum(f),c=lum(b);return (Math.max(a,c)+0.05)/(Math.min(a,c)+0.05);}
function bgOf(el){let e=el;while(e&&e!==document.body){const c=getComputedStyle(e).backgroundColor;if(c&&c!=='rgba(0, 0, 0, 0)'&&!/,\s*0\)$/.test(c))return c;e=e.parentElement;}return getComputedStyle(document.body).backgroundColor;}
const bad=[];
for(const el of document.querySelectorAll('*')){
  const t=el.textContent?.trim(); if(!t||t.length>40||el.children.length||el.offsetParent===null) continue;
  const cs=getComputedStyle(el), size=parseFloat(cs.fontSize);
  const cr=ratio(cs.color,bgOf(el));
  const large=size>=24||(size>=18.66&&+cs.fontWeight>=700);
  if(cr < (large?3:4.5)) bad.push({t:t.slice(0,24), px:Math.round(size), r:+cr.toFixed(2), cls:(el.className||'').toString().split('__').pop().slice(0,26)});
}
bad.sort((a,b)=>a.r-b.r); ({count:bad.length, worst:bad.slice(0,12)});
```

Record the class names — those are what needs raising.

- [ ] **Step 2: Raise the muted token where it is used small**

Append to `src/app/globals.css`:

```css
/* ──────────────────────────────────────────────────────────────
   Small text needs more contrast, not less.

   The muted token is tuned for body copy. Under 14px it stops clearing
   AA against the glass surfaces, and the smallest text in this app is
   also the faintest — so the two failures land on the same elements.
   ────────────────────────────────────────────────────────────── */
:root {
  --muted-small: rgba(255, 255, 255, 0.78);
}
```

Then, for each class the probe named, change its `color: var(--muted, …)` to `color: var(--muted-small)` in that component's stylesheet. The known offenders are the side-tab labels, the signed-in badge, the credit readout and the Research project/world switcher.

- [ ] **Step 3: Re-run the probe**

Expected: `count` reduced to 0, or only entries the method cannot measure — text over a gradient or image, where the walk-up background is approximate. Note any of those explicitly rather than treating them as passing.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components
git commit -m "fix: lift small interface text off the contrast floor

The side tabs, signed-in badge, credit readout and research scope switcher
measured between 1.0:1 and 1.7:1 where 4.5:1 is required, and each is the
only route to something."
```

---

### Task 8: Centre and widen the writing sheet

The sheet is 738px in a 2177px viewport — 34% — anchored left at x=161 with the empty space pooled on one side.

**Files:**
- Modify: `src/components/editor/WritingDesk.module.css:1710`

- [ ] **Step 1: Record the baseline**

On the Writing Desk with a scene open:

```js
const ed = document.querySelector('[contenteditable="true"]');
const sheet = ed.closest('[class*=binderAllScenesContainer]');
const s = sheet.getBoundingClientRect(), e = ed.getBoundingClientRect();
({ sheetX: Math.round(s.x), sheetW: Math.round(s.width), viewport: innerWidth,
   sheetShare: Math.round(s.width / innerWidth * 100) + '%',
   textColumnW: Math.round(e.width), approxCharsPerLine: Math.round(e.width / 8.5) });
```

Expected now: `sheetShare: 34%`, `approxCharsPerLine: 76`.

- [ ] **Step 2: Centre the sheet and cap the text column**

In `src/components/editor/WritingDesk.module.css`, the `.binderAllScenesContainer` rule begins at line 1710 with `flex: 1;`. Add to that rule:

```css
  /* Centre the page in the desk rather than stranding it left, and let it
     claim more of a wide screen. The text column inside is capped
     separately — a wider sheet must not mean longer lines. */
  margin-inline: auto;
  max-width: min(1100px, 62vw);
```

Then cap the text column so the measure does not grow with it. In the same file, on `.deskEditorContent`:

```css
  max-width: 68ch;
  margin-inline: auto;
```

- [ ] **Step 3: Re-run the probe**

Expected: `sheetShare` around 50%, `sheetX` roughly centred (viewport minus sheet width, halved), and `approxCharsPerLine` **still 65–75**. If characters per line went up, the text cap is not applying — fix that before moving on. A wider sheet with longer lines is a worse result than the original.

- [ ] **Step 4: Check the focus and fullscreen modes**

The desk has `writingZoneBinderFocus` with `!important` overrides for width and inset. Enter focus mode (and F11 fullscreen) and confirm the new `max-width` does not fight them.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/WritingDesk.module.css
git commit -m "fix: centre the writing sheet and give it more of the screen

The page occupied 34% of the viewport, anchored left, with two thirds of
the screen as desk texture pooled on one side. The sheet now centres and
widens while the text column stays capped, because the 76-character
measure was already right."
```

---

### Task 9: One way to delete things

Deleting a book uses an inline `Yes`; deleting a shelf uses a modal `Cancel / Delete`; editing a goal uses a two-step inline form. Three models for one class of action, and `Yes` does not name what it deletes.

**Files:**
- Modify: `src/components/management/Bookshelf.tsx`

- [ ] **Step 1: Read the existing modal confirm**

The shelf delete already renders a dialog reading "Delete this shelf? Stories will move to Uncategorized." with `wizardBtnSecondary` / `wizardBtnPrimary` buttons. This is the pattern to keep — it names the consequence and the action.

- [ ] **Step 2: Route book deletion through it**

Replace the inline `bookConfirmYes` flow so that clicking a book's delete button opens the same dialog shape, with copy that names the book:

```tsx
{deletingProjectId && (
  <div className={styles.wizardOverlay} role="dialog" aria-modal="true">
    <div className={styles.wizardModal}>
      <h2 className={styles.wizardTitle}>
        Delete “{projects.find(p => p.id === deletingProjectId)?.name}”?
      </h2>
      <p className={styles.briefHint}>
        Its chapters and scenes go with it. This cannot be undone.
      </p>
      <div className={styles.wizardActions}>
        <button className={styles.wizardBtnSecondary} onClick={() => setDeletingProjectId(null)}>
          Cancel
        </button>
        <button
          className={styles.wizardBtnPrimary}
          onClick={() => { deleteProject(deletingProjectId); setDeletingProjectId(null); }}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
)}
```

Remove the inline `bookConfirmYes` markup and its now-unused styles.

- [ ] **Step 3: Verify**

Delete a book. Confirm the dialog names it, Cancel leaves it alone, Delete removes it. Confirm Escape closes the dialog without deleting.

- [ ] **Step 4: Commit**

```bash
git add src/components/management
git commit -m "fix: one confirmation pattern for deleting things

A book asked with an inline Yes, a shelf with a modal, and neither named
what was about to go. Both use the modal now, and it says the title."
```

---

### Task 10: Fix the heading outline and label the inputs

Home's `<h1>` is the user's own name. The outline runs H2 → H4. Six inputs have no accessible name.

**Files:**
- Modify: `src/components/home/HomePage.tsx:227-228`
- Modify: `src/components/home/HomePage.module.css`
- Modify: `src/components/navigation/ModeBar.tsx` (search input)

- [ ] **Step 1: Make the greeting a greeting**

`HomePage.tsx` lines 227–228 currently read:

```tsx
<p className={styles.greeting}>{greeting},</p>
<h1 className={styles.name}>{name}</h1>
```

Replace with a real page heading, keeping the greeting visible and the name's styling:

```tsx
{/* The page is Home; the greeting is a greeting. Naming the h1 after the
    reader tells a screen reader the page is called by their own name. */}
<h1 className={styles.pageTitle}>Home</h1>
<p className={styles.greeting}>{greeting},</p>
<p className={styles.name}>{name}</p>
```

Add to `HomePage.module.css`, visually hiding the heading without hiding it from assistive tech:

```css
.pageTitle {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Step 2: Label the inputs**

Add `aria-label` to each:

- `ModeBar.tsx` search input → `aria-label="Search everything"`
- `HomePage.tsx` capture input → already has a placeholder; add `aria-label="Capture an idea"`
- The three panel inputs and one textarea reported by the probe → label each after its purpose

- [ ] **Step 3: Verify the outline**

```js
[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => h.tagName + ': ' + h.textContent.trim().slice(0, 30));
```

Expected: starts `H1: Home`, no level skipped, and — after Task 1 — no headings from closed panels.

```js
[...document.querySelectorAll('input,textarea,select')].filter(e =>
  e.offsetParent !== null && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).length;
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add src/components/home src/components/navigation
git commit -m "fix: give Home a page heading and name its inputs

The h1 was the reader's own name, so a screen reader announced the page
as the person. The outline also skipped a level and six inputs had no
accessible name."
```

---

### Task 11: Make empty states invite the first action

**Correction to the audit.** The report said the World Bible columns "offer no way to
add an entry". That is wrong and worth stating: each column is a `<button>` that zooms
into that folder, where entries are added. The real defect is narrower — a strip
reading *"No entries yet"* gives no hint that it is clickable or what clicking does,
so it reads as a dead label rather than a door.

**Files:**
- Modify: `src/components/world/WorldBibleCenter.tsx:495`
- Modify: `src/components/world/WorldBibleHome.tsx:146`
- Modify: `src/components/world/WorldBibleRoot.tsx:100`
- Modify: `src/components/editor/WritingDesk.tsx` (research canvas empty hint)

- [ ] **Step 1: Turn the dead label into an invitation**

All three files carry the identical expression:

```tsx
{count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'No entries yet'}
```

Replace the empty branch in each so the strip says what clicking it does:

```tsx
{count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'Empty — open to add'}
```

Three files, one expression each. Keep the populated branch exactly as it is.

- [ ] **Step 2: Give the empty research canvas one orienting sentence**

The research board is the desk canvas in research mode. When it holds no widgets it is a
full-screen texture whose only affordances are the small Note / Clipping / Link buttons
in the top corner.

In `src/components/editor/WritingDesk.tsx`, where the canvas renders its widget list, add
a centred hint shown only when the list is empty:

```tsx
{widgets.length === 0 && (
  <div className={styles.canvasEmptyHint}>
    <p className={styles.canvasEmptyTitle}>Nothing on this board yet</p>
    <p className={styles.canvasEmptyBody}>
      Notes, clippings and links about this project, arranged however you think.
      The assistant can read everything you put here.
    </p>
  </div>
)}
```

Find the actual widget array name in that component before writing this — it is the same
list the Note / Clipping / Link buttons append to via `addAtCenter`. Do not invent a new
one.

Add to `src/components/editor/WritingDesk.module.css`:

```css
.canvasEmptyHint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 34ch;
  text-align: center;
  pointer-events: none;
}
.canvasEmptyTitle {
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--foreground);
}
.canvasEmptyBody {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--muted);
}
```

`pointer-events: none` matters — the hint must never block a click meant for the canvas
underneath it.

- [ ] **Step 3: Verify**

With the account in first-run condition, open the World Bible: each empty strip should
read *"Empty — open to add"* and clicking it should still zoom into that folder. Open
Research on a project with no widgets: the hint should be centred, and clicking through it
onto the canvas should still work.

- [ ] **Step 4: Commit**

```bash
git add src/components/world src/components/editor
git commit -m "fix: let empty states say what to do next

A World Bible strip reading 'No entries yet' is a door that looks like a
label — it zooms into the folder, but nothing said so. The research canvas
was a full-screen texture with no orientation at all."
```

### Task 12: Stop showing a splash screen inside the app

With no scene active the Writing Desk renders the app's logo, name and tagline above the actions — marketing shown to someone already inside the product, reached by clicking a tab in the app's own navigation.

**Files:**
- Modify: `src/components/editor/WritingDesk.tsx`

- [ ] **Step 1: Remove the branding block**

Find the launcher card containing the LoreCanvas wordmark and the tagline `BUILD WORLDS · WRITE STORIES`. Delete the logo, name and tagline. Keep the actions, and give the card a heading that says what it is for:

```tsx
<h2 className={styles.launcherTitle}>Start writing</h2>
<p className={styles.launcherHint}>Pick up where you left off, or begin something new.</p>
```

- [ ] **Step 2: Verify**

Open the Writing Desk with no active scene. Confirm the actions remain, the branding is gone, and Resume still opens the most recent scene.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor
git commit -m "fix: drop the in-app splash from the Writing Desk

The empty desk showed the app's logo, name and tagline to someone who had
just clicked a tab inside the app. They know where they are."
```

---

### Task 13: Full regression pass

- [ ] **Step 1: Static checks**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src/
```

Expected: tsc silent; 406 tests passing; eslint no worse than the pre-existing baseline (the `any` and `@ts-ignore` errors in `workspaceStore.ts` and `Bookshelf.tsx`, plus the spotlight `set-state-in-effect`).

- [ ] **Step 2: Re-run every audit probe together**

On Home, confirm the full set against target:

| Probe | Was | Target |
|---|---|---|
| Off-screen focusable controls | 47 | 0 |
| Stylesheets animating without a motion guard | 48 | 0 |
| Text below 11px | 23% | 0 |
| Icon controls under 44pt | 18 | 0 |
| Emoji-icon buttons | 37 | 0 |
| Inputs with no accessible name | 6 | 0 |
| Writing sheet share of viewport | 34% | ~50% |
| Characters per line | 76 | 65–75 |

- [ ] **Step 3: Walk every surface**

Home, Bookshelf, Writing Desk, World Bible, Research, Draft Table. Look for anything the type floor or the focus ring broke, and check the console for errors — remembering the Browser pane keeps console output across reloads, so confirm any error is live before chasing it.

- [ ] **Step 4: Check both themes and 375px**

The app has light and dark theme families. Check Home and the Writing Desk in each, and at 375px width.

- [ ] **Step 5: Commit any fixes found**

```bash
git add -A
git commit -m "fix: <what the regression pass actually found>"
```

Skip if nothing needed fixing. Do not create an empty commit.
