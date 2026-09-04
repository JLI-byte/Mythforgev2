# Phase 8 — Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn 57 stylesheets that each invented their own scale into one measured design system — a single token file, seven type steps, one spacing rhythm, no raw colour outside `globals.css` — and prove it with a script that counts, not with an eye that squints.

**Architecture:** Tokens are written first and nothing converts to them until they exist. Then the sweeps run in decreasing blast radius: spacing (1,542 uses), type (1,000 uses), colour (1,332 literals), then shape and motion. Each sweep is a **committed codemod script plus a re-run of the audit**, so every one of them is a single `git revert` away from undone and none of them depends on visual inspection to know whether it finished. The last four tasks — container queries, cascade layers, empty states, book language — are hand work on a surface the sweeps have already made uniform.

**Tech Stack:** CSS Modules (one per component), Tailwind base/components/utilities, Next 16, TypeScript (strict), Vitest (jsdom). Codemods are plain Node ESM (`node scripts/*.mjs`) — no new dependencies. The audit is Python 3 (`python scripts/design-audit.py`); Python 3.10.11 and Node are both already on this machine.

**Note on the test runner:** `vitest.config.ts` includes only `src/**/*.test.ts`. CSS is not unit-testable through a component render here, so this plan's regression guard is a `.test.ts` that reads the stylesheets **off disk with `node:fs`** and asserts token discipline. That is a real test in the real runner, and it is what stops Phase 9 from reintroducing a raw hex.

**Depends on:** Phases 1, 2 and 6.

---

## What the audit measured

Run from the repo root. On Windows set `PYTHONIOENCODING=utf-8` or the `…` and `×` characters print as `?`.

```
$ python scripts/design-audit.py

stylesheets: 61

=== font-size (rem): 53 distinct values, 1016 uses ===
   0.6875rem     121
   0.85rem        90
   0.72rem        86
   0.75rem        82
   0.7rem         78
   0.78rem        78
   0.8rem         66
   0.9rem         62
   0.82rem        58
   1rem           42
   0.95rem        39
   1.1rem         32
   0.88rem        18
   1.2rem         16
   0.74rem        15
   0.76rem        13
   1.4rem         12
   1.05rem         9
   … 35 more distinct values

=== font-size (px): 9 distinct values, 35 uses ===
   11px           10
   13px            7
   12px            5
   14px            4
   18px            3
   16px            2
   48px            2
   20px            1
   30px            1

=== spacing: padding/margin/gap literal values ===
   71 distinct values, 1614 uses
   px values: 30 distinct (1185 uses)
   rem values: 41 distinct (429 uses)
   most common: 8px×229, 4px×158, 6px×148, 12px×103, 2px×99, 10px×97, 0.5rem×76, 0.75rem×59, 16px×59, 5px×54, 1rem×49, 3px×47

=== border-radius: 21 distinct values, 606 uses ===
   6px           130
   4px           126
   8px           111
   12px           53
   10px           35
   2px            27
   3px            27
   999px          18
   16px           14
   7px            14
   20px           13
   5px            10
   14px            8
   9px             8
   … 7 more distinct values

=== box-shadow: distinct definitions ===
   122 distinct shadow definitions across 162 uses
    15×  var(--glass-shadow)
     5×  -3px 2px 10px rgba(0, 0, 0, 0.10)
     5×  none
     2×  2px 3px 0 rgba(59, 44, 21, 0.25)
     2×  4px 6px 0 rgba(59, 44, 21, 0.22)

=== transition durations ===
   49 distinct, most common: 0.15s×159, 0.2s×120, 150ms×46, 0.3s×21, 120ms×12, 0.18s×11, 160ms×8, 0.9s×7, 0.1s×7, 0.8s×6

=== token usage vs literals ===
   var(--…) references : 2637
   raw hex colours     : 760
   raw rgb/rgba()      : 711
   ratio tokens:literals = 1.79 : 1

=== how many stylesheets define their own font-size scale ===
   WritingDesk.module.css                               25 distinct sizes
   ArticleView.module.css                               17 distinct sizes
   HomePage.module.css                                  16 distinct sizes
   ArticleGridEditor.module.css                         16 distinct sizes
   fantasy.module.css                                   14 distinct sizes
   ArticleReadView.module.css                           14 distinct sizes
   Bookshelf.module.css                                 13 distinct sizes
   SettingsModal.module.css                             13 distinct sizes
```

### That run is against a tree where Phases 1 and 2 have **not** yet landed

The working tree still contains `MusicPlayerPanel.module.css`, `SpotifyPlayer.module.css`, `ScreenplayEditor.module.css` and `vn/VNTimeline.module.css`, which Phase 1 deletes, and the 21 `.researchChat*` / `.researchResizer` rules inside `WritingDesk.module.css`, which Phase 2 deletes. Re-measuring with those four files excluded gives the number Phase 8 actually starts from:

| Metric | Measured now (61 sheets) | Projected start (57 sheets) | Phase 8 target |
|--------|--------------------------|------------------------------|----------------|
| Stylesheets | 61 | 57 | 57 |
| Distinct `font-size` rem values | 53 (1,016 uses) | 53 (965 uses) | **0 literals** — 7 scale tokens + 2 display |
| Distinct `font-size` px values | 9 (35 uses) | 9 (35 uses) | **0** |
| Distinct spacing values | 71 (1,614 uses) | 67 (1,542 uses) | **0 px**, ≤ 3 rem |
| — of which px | 30 distinct / 1,185 uses | 30 distinct / 1,162 uses | **0 / 0** |
| Distinct `border-radius` values | 21 (606 uses) | 21 (589 uses) | **0 literals** — 8 tokens |
| Distinct `box-shadow` definitions | 122 (162 uses) | 121 (160 uses) | **≤ 12** |
| Distinct transition/animation durations | 49 | 48 | **≤ 8** |
| Raw hex colours | 760 | 742 | **≤ 90**, all in `globals.css` |
| Raw `rgb()/rgba()` | 711 | 696 | **≤ 45**, all in `globals.css` |
| token : literal ratio | 1.79 : 1 | 1.77 : 1 | **≥ 25 : 1** |
| Sheet with the widest private type scale | `WritingDesk` 25 sizes | `WritingDesk` 25 sizes | **0 sizes** |

**Step 0 of Task 1 re-runs the audit and records the real 57-sheet numbers.** Every "before" figure in the tasks below is the projected column; if the recorded number differs, use the recorded one — the targets are absolute, not relative, so they do not move.

### Facts the script does not cover, measured separately

| Fact | Command | Result |
|------|---------|--------|
| Cascade layers | `grep -rn "@layer" src --include=*.css` | **0** |
| Container queries | `grep -rn "container-type\|@container" src --include=*.css` | **0** |
| Logical properties | `grep -rn "padding-inline\|margin-inline\|inline-size" src --include=*.css` | **0** |
| Physical equivalents in use | `padding-left/right` 21, `margin-left/right` 42, `border-left/right` 64 | **127** |
| Viewport media queries for layout | `grep -rho "@media[^{]*" src --include=*.css` | **7** (`620px`×2, `880px`, `720px`, `520px`, `1000px`, `hover:none`) |
| Duplicate bare-class rule blocks | `for f in $(find src -name "*.css"); do grep -oE '^\.[A-Za-z0-9_-]+ *\{' "$f" \| sed 's/ *{//' \| sort \| uniq -d; done` | **21 across 11 sheets** |
| `var(--x)` references with no definition anywhere | see Task 3 | **29 distinct tokens** |
| Empty-state root selectors | `grep -rhoE '^\.[A-Za-z0-9_-]*[Ee]mpty[A-Za-z0-9_-]* *\{' src --include=*.css` | **23 roots across 22 sheets** |
| Bookshelf slots rendered per shelf | `Bookshelf.tsx:16-17,436-443` — `DIAMOND_COLS = 6`, `DEFAULT_ROWS = 3`, rows alternate 6/5/6 | **17 slots, always** |
| Independent book renderings | `Bookshelf .book`, `WorldShelf .spine`, `WorldShelf .cover`, `WorldBibleBook .book` | **4** |

---

## Three findings that change what the tasks have to do

### 1. `--accent-rgb` and `--foreground-rgb` exist only in the fantasy palettes

```
$ grep -rn "\-\-accent-rgb\s*:" src
src/app/globals.css:177:  --accent-rgb: 200, 64, 31;      # inside :root[data-theme-family="fantasy"]
src/app/globals.css:209:  --accent-rgb: 224, 100, 47;     # inside fantasy + [data-theme="dark"]
src/components/editor/WritingDesk.module.css:962:  --accent-rgb: 200, 64, 31;   # also fantasy-scoped
```

`var(--accent-rgb)` is referenced **92 times across 8 stylesheets**. In the default theme — light *and* dark — the token has no value, so every one of those 92 declarations is invalid at computed-value time and drops. Focus rings, selected-tab tints, hover fills and the `.beatCardAct` background simply do not paint unless the user is in the fantasy family. `--foreground-rgb` has the same shape: 5 uses, fantasy-only definition.

This is exactly the bug the three-state rule in `globals.css` was written to prevent, and it is the single strongest argument for Task 3. **Fix it in the token file, in all three default blocks, before anything else.**

### 2. `.beatCard` and `.beatCardHeader` are each declared twice in one stylesheet

```
$ grep -n "^\.beatCard\b\|^\.beatCardHeader\b" src/components/editor/WritingDesk.module.css
3163:.beatCard {
3181:.beatCardHeader {
4563:.beatCard {
4571:.beatCardHeader {
```

Both consumers import the same file — `StructureRenderer.tsx:6` and `BeatCardRenderer.tsx:4` both do `import styles from '../../WritingDesk.module.css'`. CSS Modules hashes on filename plus class name, so `styles.beatCard` resolves to **one** generated class for both.

The brief for this plan described the effect as "the later block wins for both". The precise mechanism is worth stating because it changes the fix: the cascade resolves **per property**, not per rule. Two rules of equal specificity produce the *union* of their declarations, with the later block winning only where they collide. Measured:

| Selector | First block | Last block | Colliding | Leaked into both |
|----------|-------------|-----------|-----------|------------------|
| `.beatCard` | 9 props (3163) | 5 props (4563) | `background` — `rgba(var(--overlay-rgb),0.02)` loses to `var(--surface-mid)` | StructureRenderer's beats gain `height:100%`, `overflow:hidden`; BeatCardRenderer's widget gains `border`, `border-radius:8px`, `padding:12px`, `gap:8px`, `position:relative`, `transition:all 0.2s` |
| `.beatCardHeader` | 3 props (3181) | 6 props (4571) | `align-items` — `center` loses to `flex-start` | StructureRenderer's header gains `justify-content:space-between`, `padding:10px 12px 6px`, `border-bottom` |

So the structure-panel beat rows are vertically mis-aligned and stretched, and the desk beat-card widget carries a border and padding nobody wrote for it. A real visual bug in both directions.

**Where it belongs.** Roadmap item `3f` in Phase 10 pairs this rename with `lazy()`-ing the `ExportModal`. Those are two unrelated changes that happen to share a bullet. The rename is a *design-system correctness* fix inside the one stylesheet that Phase 8 rewrites end to end; leaving it in Phase 10 means Phase 10 re-opens a file Phase 8 just swept, and means Phase 8's codemods spend five tasks entrenching a selector collision. **The rename moves to Phase 8, Task 2. The `lazy(ExportModal)` half of `3f` stays in Phase 10.** Update the roadmap's `3f` row to say so as part of Task 2's commit.

The same command finds **19 more** duplicated bare-class rule blocks in 10 other sheets. Task 2 fixes all 21.

### 3. The manuscript is set in the UI font, in hardcoded near-white

```css
/* src/components/editor/WritingDesk.module.css:380 */
.deskEditorContent {
  color: #e0e0e0;      /* invisible on the light theme's white page */
  font-size: 16px;
  line-height: 1.6;
  max-width: 76ch;
}
```

There is no `font-family`, so the manuscript inherits `body { font-family: var(--font-sans) }` — Inter, the same face as the toolbar. The only place the manuscript gets a serif today is the fantasy family, via `globals.css:279`. Item `09` is not a refinement; the default theme has a broken manuscript surface.

---

## File Structure

**Created:**

| Path | What |
|------|------|
| `scripts/design-audit.py` | The audit script, committed so every task can re-run it |
| `scripts/codemod-spacing.mjs` | px/rem spacing → `var(--space-N)` |
| `scripts/codemod-type.mjs` | font-size literals → `var(--text-*)` |
| `scripts/codemod-color.mjs` | exact-match colour literals → tokens; reports the rest |
| `scripts/codemod-shape.mjs` | radii → `var(--radius-*)`, transition durations → `var(--dur-*)` |
| `src/app/designSystem.test.ts` | The regression guard — reads stylesheets off disk, asserts discipline |
| `src/components/ui/EmptyState.tsx` + `.module.css` | The one empty state |
| `src/components/ui/bookSurface.module.css` | The shared book/spine/cover surface |

**Modified:**

| Path | Change |
|------|--------|
| `src/app/globals.css` | The token file — spacing, type, radii, elevation, motion, plus the missing `--accent-rgb` / `--foreground-rgb` / `--shadow-rgb` in all three default blocks; cascade layers; container-query hosts |
| `src/components/editor/WritingDesk.module.css` | The duplicate-selector rename, the manuscript typeface, and every sweep |
| All 56 other stylesheets under `src/` | The sweeps |
| `src/components/management/Bookshelf.tsx` | Slot count, and the shared book surface |
| `src/components/home/WorldShelf.tsx`, `src/components/management/WorldBibleBook.tsx` | The shared book surface |
| ~12 components with bespoke empty states | Swapped to `<EmptyState>` |
| `docs/superpowers/plans/2026-09-03-remediation-roadmap.md` | `3f` split between Phases 8 and 10 |

---

## Task 1: Commit the audit and record the true baseline

**Files:**
- Create: `scripts/design-audit.py`
- Create: `docs/superpowers/plans/phase-8-baseline.txt`

Nothing in this phase can be verified without the script in the repo. It goes in first, unchanged, so that every "before" and "after" in this plan is produced by the same code.

- [ ] **Step 1: Confirm Phases 1 and 2 have landed**

```bash
ls src/components/layout/MusicPlayerPanel.module.css \
   src/components/ui/SpotifyPlayer.module.css \
   src/components/editor/ScreenplayEditor.module.css \
   src/components/editor/vn/VNTimeline.module.css 2>&1
grep -c "researchChat\|researchResizer" src/components/editor/WritingDesk.module.css
```

Expected: four `No such file` errors, and `0`. **If any of those files still exists, stop** — Phase 8 must not sweep code that is about to be deleted. That is the whole reason this phase sits eighth.

- [ ] **Step 2: Write the audit script**

Create `scripts/design-audit.py`:

```python
"""Audit the design system's actual consistency across every stylesheet."""
import io
import os
import re
from collections import Counter

CSS = []
for root, _, fs in os.walk('src'):
    for f in fs:
        if f.endswith('.css'):
            CSS.append(os.path.join(root, f).replace(os.sep, '/'))

text = {p: io.open(p, encoding='utf-8').read() for p in CSS}
allcss = '\n'.join(text.values())


def tally(pattern, label, top=18, unit=''):
    vals = re.findall(pattern, allcss)
    c = Counter(vals)
    print('=== %s: %d distinct values, %d uses ===' % (label, len(c), sum(c.values())))
    for v, n in c.most_common(top):
        print('   %-12s %4d' % (v + unit, n))
    if len(c) > top:
        print('   … %d more distinct values' % (len(c) - top))
    print('')
    return c


print('stylesheets: %d' % len(CSS))
print('')

fs = tally(r'font-size:\s*([0-9.]+rem)', 'font-size (rem)')
fspx = tally(r'font-size:\s*([0-9.]+px)', 'font-size (px)', top=10)

print('=== spacing: padding/margin/gap literal values ===')
sp = Counter(re.findall(r'(?:padding|margin|gap)(?:-[a-z]+)?:\s*([0-9.]+(?:px|rem))', allcss))
print('   %d distinct values, %d uses' % (len(sp), sum(sp.values())))
px = [v for v in sp if v.endswith('px')]
rem = [v for v in sp if v.endswith('rem')]
print('   px values: %d distinct (%d uses)' % (len(px), sum(sp[v] for v in px)))
print('   rem values: %d distinct (%d uses)' % (len(rem), sum(sp[v] for v in rem)))
print('   most common:', ', '.join('%s×%d' % (v, n) for v, n in sp.most_common(12)))
print('')

r = tally(r'border-radius:\s*([0-9.]+(?:px|rem))', 'border-radius', top=14)

print('=== box-shadow: distinct definitions ===')
sh = Counter(re.findall(r'box-shadow:\s*([^;]+);', allcss))
print('   %d distinct shadow definitions across %d uses' % (len(sh), sum(sh.values())))
for v, n in sh.most_common(5):
    print('   %3d×  %s' % (n, v.strip()[:78]))
print('')

print('=== transition durations ===')
td = Counter(re.findall(r'(?:transition|animation)[^;]*?([0-9.]+m?s)', allcss))
print('   %d distinct, most common: %s' % (
    len(td), ', '.join('%s×%d' % (v, n) for v, n in td.most_common(10))))
print('')

print('=== token usage vs literals ===')
var_uses = len(re.findall(r'var\(--', allcss))
hex_lits = len(re.findall(r'#[0-9a-fA-F]{3,8}\b', allcss))
rgba_lits = len(re.findall(r'rgba?\(\s*\d', allcss))
print('   var(--…) references : %d' % var_uses)
print('   raw hex colours     : %d' % hex_lits)
print('   raw rgb/rgba()      : %d' % rgba_lits)
print('   ratio tokens:literals = %.2f : 1' % (var_uses / max(1, hex_lits + rgba_lits)))
print('')

print('=== how many stylesheets define their own font-size scale ===')
per = {p: len(set(re.findall(r'font-size:\s*([0-9.]+rem)', s))) for p, s in text.items()}
big = sorted(per.items(), key=lambda kv: -kv[1])[:8]
for p, n in big:
    print('   %-52s %d distinct sizes' % (p.split('/')[-1], n))
```

- [ ] **Step 3: Record the baseline**

```bash
PYTHONIOENCODING=utf-8 python scripts/design-audit.py | tee docs/superpowers/plans/phase-8-baseline.txt
```

Expected: `stylesheets: 57`. Compare each line against the "Projected start" column in the table above. Where a number differs, **use the recorded number** as this phase's before-figure; the targets do not move.

- [ ] **Step 4: Commit**

```bash
git add scripts/design-audit.py docs/superpowers/plans/phase-8-baseline.txt
git commit -m "chore: commit the stylesheet audit and record the Phase 8 baseline

Every conversion task in Phase 8 is verified by re-running this script and
comparing against phase-8-baseline.txt. CSS is not reachable from the vitest
config's src/**/*.test.ts include, so counting is the acceptance test."
```

---

## Task 2: Rename the 21 duplicated class rules (roadmap `3f`, moved here from Phase 10)

**Files:**
- Modify: `src/components/editor/WritingDesk.module.css`, `src/components/editor/desk/widgets/StructureRenderer.tsx`, `src/components/editor/desk/widgets/BeatCardRenderer.tsx`
- Modify: 10 other stylesheets listed below
- Modify: `docs/superpowers/plans/2026-09-03-remediation-roadmap.md`

This runs before every sweep so the codemods operate on selectors that mean one thing each.

- [ ] **Step 1: List the duplicates**

```bash
for f in $(find src -name "*.css"); do
  d=$(grep -oE '^\.[A-Za-z0-9_-]+ *\{' "$f" | sed 's/ *{//' | sort | uniq -d)
  if [ -n "$d" ]; then echo "-- $f"; echo "$d" | sed 's/^/     /'; fi
done
```

Expected (after Phases 1–2 removed `SpotifyPlayer.saveBtn`, the `SettingsModal.ai*` trio and `WritingDesk.chatPendingDiscard`), **17 remaining**:

```
src/app/login/standardLogin.module.css        .lampBar .lampConeRight
src/app/welcome/shared/switcher.module.css    .itemActive
src/app/welcome/themes/fantasy/fantasy.module.css   .fieldTextarea
src/app/welcome/themes/standard/requestModal.module.css  .textarea
src/app/welcome/themes/standard/standard.module.css .lampBar .lampConeRight
src/components/editor/WritingDesk.module.css  .beatCard .beatCardHeader
                                              .interviewEditorSave
                                              .interviewEditorTextarea
                                              .sceneControlInput .vnChipCondition
src/components/home/GoalScheduleModal.module.css    .input
src/components/management/WorldBibleBook.module.css .hardcoverBack .hardcoverFront
src/components/world/EntityDetailPanel.module.css   .textarea
```

- [ ] **Step 2: Split `.beatCard` and `.beatCardHeader`**

The block at line 4563 belongs to `BeatCardRenderer` (the docked desk widget). Rename **that** pair — not the one at 3163, which the structure panel and the drag-handle rules around it already share a prefix with.

In `src/components/editor/WritingDesk.module.css`, rename the 4563/4571 blocks and their descendants:

| Old | New |
|-----|-----|
| `.beatCard` (4563) | `.beatWidget` |
| `.beatCardHeader` (4571) | `.beatWidgetHeader` |
| `.beatCardTitles` | `.beatWidgetTitles` |
| `.beatCardGroup` | `.beatWidgetGroup` |
| `.beatCardLabel` | `.beatWidgetLabel` |
| `.beatCardMeta` | `.beatWidgetMeta` |
| `.beatCardStep` | `.beatWidgetStep` |
| `.beatCardInfoBtn` / `…Active` | `.beatWidgetInfoBtn` / `…Active` |
| `.beatCardGuidance` | `.beatWidgetGuidance` |
| `.beatCardTextarea` | `.beatWidgetTextarea` |

Then in `src/components/editor/desk/widgets/BeatCardRenderer.tsx` rewrite lines 43–79 to the new names. `styles.beatCardBody` and `styles.beatCardAct` are the *structure panel's* and stay pointed at the 3163 block.

Do **not** rename the widget `type` string `'beatCard'` — it is persisted workspace data read by `WidgetRenderer.tsx:73`, `WritingDesk.tsx:192,214,931` and `DraftExport.tsx:20`. Only class names change.

- [ ] **Step 3: Verify the split by property count**

```bash
python - <<'PY'
import re
s = open('src/components/editor/WritingDesk.module.css', encoding='utf-8').read()
for name in ('beatCard', 'beatCardHeader', 'beatWidget', 'beatWidgetHeader'):
    n = len(re.findall(r'(?m)^\.%s\s*\{' % name, s))
    print('%-18s %d block(s)' % (name, n))
PY
```

Expected: `1` for each of the four.

- [ ] **Step 4: Fix the other 15**

For each remaining pair, read both blocks and decide which of the two patterns applies:

- **Continuation** (`.lampBar` in `standardLogin` and `standard`: 2 props then 5, no collisions; `WorldBibleBook.hardcoverFront`: 2 then 1) — merge the two blocks into one and delete the later. No visual change.
- **Two different controls sharing a name** (`.itemActive` in `switcher`, colliding on `background`; `.textarea` in `requestModal` and `EntityDetailPanel`; `.input` in `GoalScheduleModal`; `.fieldTextarea` in `fantasy`; `.interviewEditorSave` colliding on `background` and `color`; `.sceneControlInput`, `.interviewEditorTextarea`, `.vnChipCondition`) — rename the later one after what it actually styles and update its `styles.x` call sites.

Use this to see which case you are in:

```bash
python - <<'PY'
import os, re
from collections import defaultdict
for root, _, fs in os.walk('src'):
    for f in fs:
        if not f.endswith('.css'): continue
        p = os.path.join(root, f).replace(os.sep, '/')
        s = open(p, encoding='utf-8').read()
        d = defaultdict(list)
        for name, body in re.findall(r'(?m)^(\.[A-Za-z0-9_-]+)\s*\{([^}]*)\}', s):
            d[name].append(body)
        for name, bodies in d.items():
            if len(bodies) < 2: continue
            props = [{m.group(1): m.group(2).strip()
                      for m in re.finditer(r'([a-z-]+)\s*:\s*([^;]+);', b)} for b in bodies]
            a, b = props[0], props[-1]
            clash = sorted(k for k in a if k in b and a[k] != b[k])
            print('%-46s %-24s %d/%d props  collide=%s'
                  % (p.split('/')[-1], name, len(a), len(b), ','.join(clash) or '-'))
PY
```

- [ ] **Step 5: Verify zero duplicates remain**

Re-run the Step 1 loop. Expected: **no output at all**.

- [ ] **Step 6: Update the roadmap**

In `docs/superpowers/plans/2026-09-03-remediation-roadmap.md`, change the Phase 10 `3f` row to:

```
| `3f` | `lazy()` the `ExportModal`. The duplicated `.beatCard` / `.beatCardHeader` rename moved to Phase 8 Task 2 — it is a stylesheet-correctness fix inside the file Phase 8 rewrites |
```

- [ ] **Step 7: Verify and commit**

```bash
npx tsc --noEmit --pretty false && npx eslint src
```

```bash
git add -A
git commit -m "fix: split 21 duplicated class rules across 11 stylesheets

.beatCard and .beatCardHeader were each declared twice in
WritingDesk.module.css, at 3163 and 4563. Both StructureRenderer and
BeatCardRenderer import that file, so CSS Modules gave them one generated
class and the cascade merged the two rule bodies per property: the structure
panel's beats picked up height:100%, overflow:hidden and the widget's
surface-mid background, and the widget picked up the panel's border, 8px
radius, 12px padding and 8px gap. align-items on the header collided too,
center losing to flex-start.

The widget pair is renamed to .beatWidget*. The persisted widget type string
'beatCard' is untouched. Roadmap 3f is split: the rename lands here, the
lazy(ExportModal) half stays in Phase 10."
```

---

## Task 3: Write the token file — roadmap item `05`

**Files:**
- Modify: `src/app/globals.css`

Everything after this task converts to these tokens, so they exist first and completely.

### The three-state rule, and when it applies

`globals.css` already carries a careful structure: a bare `:root` light palette, a `@media (prefers-color-scheme: dark)` block guarded as `:root:not([data-theme="light"])`, and a `:root[data-theme="dark"]` block, plus two fantasy-family blocks. A token defined in only one of the three default blocks is the unreadable-theme bug the comments in that file were written about.

**The rule applies to tokens whose value depends on the palette.** Spacing, type, radii, durations and easings do not change with the theme; they belong in the bare `:root` **once**. Triplicating them would be noise that invites drift. Colour and elevation tokens go in all three default blocks, and in the two fantasy blocks where the family needs its own value.

- [ ] **Step 1: Add the theme-invariant scales to the bare `:root`**

Append inside the existing bare `:root { … }` block in `src/app/globals.css`, after `--glass-shadow`:

```css
  /* ════════════════════════════════════════════════════════════════════════
     SPACING — a 4px grid with a 6px half-step, because the audit found 219
     uses of 8px, 155 of 4px and 147 of 6px: the app already thinks in fours
     and sixes, it just spelled them 30 different ways (1,162 px-unit uses
     across 30 distinct values). rem, not px, so a browser text-size setting
     scales the layout with the text instead of leaving it behind.
     ════════════════════════════════════════════════════════════════════════ */
  --space-1: 0.125rem;   /* 2px  */
  --space-2: 0.25rem;    /* 4px  */
  --space-3: 0.375rem;   /* 6px  */
  --space-4: 0.5rem;     /* 8px  */
  --space-5: 0.75rem;    /* 12px */
  --space-6: 1rem;       /* 16px */
  --space-7: 1.5rem;     /* 24px */
  --space-8: 2rem;       /* 32px */
  --space-9: 2.5rem;     /* 40px */
  --space-10: 3rem;      /* 48px */
  --space-11: 4rem;      /* 64px */
  --space-12: 6rem;      /* 96px */

  /* ════════════════════════════════════════════════════════════════════════
     TYPE — seven steps. The audit found 53 distinct rem sizes plus 9 px ones
     across 1,000 declarations, and 795 of those uses sit below 1rem: this is
     a dense tool, so the scale is dense at the bottom (11/12/13/14px) and
     opens up only above the body size. --text-display and --text-hero are
     deliberately NOT scale steps — they are the marketing route's fluid
     title sizes. One seven-step scale cannot span an 11px badge and a 128px
     hero without a 2x gap between neighbours, so the display sizes sit
     outside the scale rather than distorting it.
     ════════════════════════════════════════════════════════════════════════ */
  --text-2xs: 0.6875rem; /* 11px — badges, meta, counts */
  --text-xs: 0.75rem;    /* 12px — secondary labels */
  --text-sm: 0.8125rem;  /* 13px — dense control text */
  --text-md: 0.875rem;   /* 14px — the app's default UI text */
  --text-lg: 1rem;       /* 16px — manuscript body, dialog prose */
  --text-xl: 1.25rem;    /* 20px — section headings */
  --text-2xl: 1.5rem;    /* 24px — panel and modal titles */

  --text-display: clamp(1.75rem, 1.2rem + 2.4vw, 2.5rem);
  --text-hero: clamp(2.5rem, 1.5rem + 5vw, 6rem);

  /* Line heights ride with the step rather than being restated per rule. */
  --leading-tight: 1.2;
  --leading-snug: 1.4;
  --leading-normal: 1.6;
  --leading-prose: 1.75;

  /* ════════════════════════════════════════════════════════════════════════
     RADII — 21 distinct values across 589 uses collapse to seven plus a pill.
     The three biggest clusters (6px×124, 4px×118, 8px×109) each keep their
     own step; the long tail snaps to the nearest, ties rounding up.
     ════════════════════════════════════════════════════════════════════════ */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-3xl: 24px;
  --radius-full: 999px;

  /* ════════════════════════════════════════════════════════════════════════
     MOTION — 32 distinct transition durations across 389 uses. Two clusters
     carry most of it (0.15s+150ms = 190 uses, 0.2s+200ms = 104), so the
     scale is built around them. Keyframe animations are NOT on this scale:
     a 9s candle flicker and a 150ms hover are not the same kind of thing.
     The reduced-motion block below already floors both at 1ms.
     ════════════════════════════════════════════════════════════════════════ */
  --dur-1: 100ms;
  --dur-2: 150ms;   /* the default */
  --dur-3: 200ms;
  --dur-4: 300ms;
  --dur-5: 500ms;

  /* 15 distinct easings were in use; `ease` alone appeared 232 times. */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.55, 0.06, 0.68, 0.19);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* ════════════════════════════════════════════════════════════════════════
     TYPEFACES. --font-serif is redeclared here for documentation only: the
     next/font class on <body> sets it to the loaded Merriweather and wins,
     because body is a descendant of :root. --font-manuscript is the new one
     (item 09) and --font-mono had five references and no definition.
     ════════════════════════════════════════════════════════════════════════ */
  --font-manuscript: var(--font-garamond), 'Merriweather', Georgia, serif;
  --font-mono: ui-monospace, 'JetBrains Mono', 'Courier New', monospace;
```

- [ ] **Step 2: Add the palette-dependent tokens to the bare `:root` (light)**

Still inside the bare `:root`, after `--glass-shadow`:

```css
  /* ════════════════════════════════════════════════════════════════════════
     Channel triplets. --accent-rgb was defined ONLY in the two fantasy
     blocks, so its 92 references across 8 stylesheets were invalid at
     computed-value time in both default themes — every rgba(var(--accent-rgb),a)
     focus ring, tab tint and hover fill silently dropped unless the user was
     in the fantasy family. --foreground-rgb had the same hole with 5 uses.
     ════════════════════════════════════════════════════════════════════════ */
  --accent-rgb: 0, 91, 181;        /* #005bb5 */
  --foreground-rgb: 34, 34, 34;    /* #222222 */
  /* Shadows are cast by light, so they stay ink in every default palette —
     unlike --overlay-rgb, which has to contrast with the ground and flips. */
  --shadow-rgb: 0, 0, 0;

  /* Aliases for names components already reference. Defining them as aliases
     rather than new colours keeps the palette at one source of truth. */
  --surface-2: var(--surface-mid);
  --surface-raised: var(--surface-mid);
  --surface-elevated: var(--surface-high);
  --surface-hover: rgba(var(--overlay-rgb), 0.06);
  --border-subtle: rgba(var(--overlay-rgb), 0.08);
  --accent-subtle: rgba(var(--accent-rgb), 0.12);
  --accent-hover: var(--accent-dim);
  --input-bg: var(--surface-mid);
  --error: var(--danger);
  --text-muted: var(--muted);
  --text-primary: var(--foreground);

  /* ════════════════════════════════════════════════════════════════════════
     ELEVATION — 121 distinct box-shadow recipes across 160 uses. Five steps
     plus the glass shadow that already exists. Theme-dependent: the same
     shadow that reads as depth on white is invisible on #0e0e0e, so each
     block sets its own alphas.
     ════════════════════════════════════════════════════════════════════════ */
  --shadow-1: 0 1px 2px rgba(var(--shadow-rgb), 0.06);
  --shadow-2: 0 2px 6px rgba(var(--shadow-rgb), 0.10);
  --shadow-3: 0 4px 12px rgba(var(--shadow-rgb), 0.14);
  --shadow-4: 0 12px 32px rgba(var(--shadow-rgb), 0.18);
  --shadow-5: 0 24px 64px rgba(var(--shadow-rgb), 0.24);
  --shadow-ring: 0 0 0 3px rgba(var(--accent-rgb), 0.28);
  --shadow-lg: var(--shadow-3);
  --shadow-2xl: var(--shadow-5);
```

- [ ] **Step 3: Add the same palette-dependent tokens to BOTH dark blocks**

The `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` block and the `:root[data-theme="dark"] { … }` block are byte-identical today. Append this **identical text to both**, after each block's `--glass-shadow`:

```css
    --accent-rgb: 208, 188, 255;      /* #d0bcff */
    --foreground-rgb: 229, 226, 225;  /* #e5e2e1 */
    --shadow-rgb: 0, 0, 0;

    --surface-2: var(--surface-mid);
    --surface-raised: var(--surface-mid);
    --surface-elevated: var(--surface-high);
    --surface-hover: rgba(var(--overlay-rgb), 0.08);
    --border-subtle: rgba(var(--overlay-rgb), 0.10);
    --accent-subtle: rgba(var(--accent-rgb), 0.16);
    --accent-hover: var(--accent-dim);
    --input-bg: var(--surface-mid);
    --error: var(--danger);
    --text-muted: var(--muted);
    --text-primary: var(--foreground);

    /* Deeper and blacker than light: on #0e0e0e a 6% shadow is nothing. */
    --shadow-1: 0 1px 2px rgba(var(--shadow-rgb), 0.30);
    --shadow-2: 0 2px 6px rgba(var(--shadow-rgb), 0.40);
    --shadow-3: 0 4px 12px rgba(var(--shadow-rgb), 0.50);
    --shadow-4: 0 12px 32px rgba(var(--shadow-rgb), 0.60);
    --shadow-5: 0 24px 64px rgba(var(--shadow-rgb), 0.70);
    --shadow-ring: 0 0 0 3px rgba(var(--accent-rgb), 0.35);
    --shadow-lg: var(--shadow-3);
    --shadow-2xl: var(--shadow-5);
```

- [ ] **Step 4: Complete the explicit-light block**

`:root[data-theme="light"]` currently declares only 9 tokens and inherits the rest from the bare `:root` — which is correct and stays correct, because the bare `:root` *is* the light palette. But it overrides `--accent` to `#005bb5` without restating `--accent-rgb`, so add the pair that must travel together:

```css
  --accent-rgb: 0, 91, 181;
  --foreground-rgb: 23, 23, 23;    /* matches this block's #171717 */
  --shadow-rgb: 0, 0, 0;
```

- [ ] **Step 5: Complete both fantasy blocks**

Both already set `--accent-rgb` and `--foreground-rgb`. Add to `:root[data-theme-family="fantasy"]` (light):

```css
  --shadow-rgb: 59, 44, 21;   /* the parchment family casts warm ink shadows */
```

and to `:root[data-theme-family="fantasy"][data-theme="dark"]`:

```css
  --shadow-rgb: 0, 0, 0;
```

The aliases and elevation steps inherit from the bare `:root` and resolve against each family's own `--shadow-rgb` and `--accent-rgb`, so they do not need restating.

- [ ] **Step 6: Verify every token is defined in every state**

```bash
python - <<'PY'
import re
g = open('src/app/globals.css', encoding='utf-8').read()
blocks = {
  'light (bare :root)': re.search(r'(?s)^:root \{(.*?)\n\}', g, re.M),
  'dark (media)': re.search(r'(?s):root:not\(\[data-theme="light"\]\) \{(.*?)\n  \}', g),
  'dark (explicit)': re.search(r'(?s):root\[data-theme="dark"\] \{(.*?)\n\}', g),
}
sets = {}
for k, m in blocks.items():
    assert m, 'block not found: ' + k
    sets[k] = set(re.findall(r'(--[a-zA-Z0-9-]+)\s*:', m.group(1)))
    print('%-20s %d tokens' % (k, len(sets[k])))
light = sets['light (bare :root)']
PALETTE = {t for t in light if re.search(
    r'--(accent|foreground|background|surface|border|muted|danger|secondary|tertiary|'
    r'overlay|glass|shadow|content-wash|on-accent|error|text-muted|text-primary|input-bg)',
    t)}
for k in ('dark (media)', 'dark (explicit)'):
    missing = sorted(PALETTE - sets[k])
    print('%-20s missing from light: %s' % (k, ', '.join(missing) or 'none'))
print('media == explicit:', sets['dark (media)'] == sets['dark (explicit)'])
PY
```

Expected: `missing from light: none` for both dark blocks, and `media == explicit: True`.

- [ ] **Step 7: Confirm the 92 dropped declarations now resolve**

Start the dev server, open the Writing Desk in the **default** theme family (light and then dark), add a Structure widget and confirm the act rows show their accent tint. Before this task they showed none — `.beatCardAct { background: rgba(var(--accent-rgb), 0.05) }` was invalid.

```bash
node -e "
const css=require('fs').readFileSync('src/app/globals.css','utf8');
for (const t of ['--accent-rgb','--foreground-rgb','--shadow-rgb'])
  console.log(t, (css.match(new RegExp(t+'\\\\s*:','g'))||[]).length, 'definitions');
"
```

Expected: `--accent-rgb 6`, `--foreground-rgb 6`, `--shadow-rgb 5` definitions (light, media-dark, explicit-dark, explicit-light, fantasy light, fantasy dark — `--shadow-rgb` skips one because fantasy dark and default dark share a value but each block still declares it; count what you actually wrote and record it).

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: write the design token file

Spacing, type, radii, elevation and motion scales, sized from the audit
rather than from taste: 12 spacing steps for 30 px values, 7 type steps for
62 font sizes, 8 radii for 21, 5 elevations for 121 shadow recipes, 5
durations for 32.

Also closes a live bug. --accent-rgb and --foreground-rgb were defined only
inside the two fantasy-family blocks, so all 92 rgba(var(--accent-rgb), a)
declarations across 8 stylesheets were invalid at computed-value time in the
default light and dark themes and dropped entirely. They are now defined in
all three default states plus explicit-light, per the three-state pattern the
file's own comments describe. Nineteen more tokens that components referenced
without any definition anywhere are defined as aliases."
```

---

## Task 4: Convert spacing to `rem` tokens — roadmap item `04`

**Files:**
- Create: `scripts/codemod-spacing.mjs`
- Modify: every `src/**/*.css` except `src/app/globals.css`

**Before:** 67 distinct spacing values / 1,542 uses — 30 px values across 1,162 uses, 37 rem values across 380.
**After:** the audit reports `px values: 0 distinct (0 uses)`.

- [ ] **Step 1: Write the codemod**

Create `scripts/codemod-spacing.mjs`:

```js
// Rewrite every literal padding / margin / gap length in src/**/*.css to a
// var(--space-N) step. Run from the repo root:  node scripts/codemod-spacing.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// px value -> token name. Compared at a 16px root, so 0.5rem is 8px.
const STEPS = [
  [2, '--space-1'], [4, '--space-2'], [6, '--space-3'], [8, '--space-4'],
  [12, '--space-5'], [16, '--space-6'], [24, '--space-7'], [32, '--space-8'],
  [40, '--space-9'], [48, '--space-10'], [64, '--space-11'], [96, '--space-12'],
];
const MAX_PX = 96;

// Nearest step. STEPS is ascending and the comparison is <=, so an exact tie
// takes the larger step: 3px -> 4px, 10px -> 12px, 20px -> 24px.
function snap(px) {
  let name = STEPS[0][1];
  let best = Infinity;
  for (const [v, n] of STEPS) {
    const d = Math.abs(v - px);
    if (d <= best) { best = d; name = n; }
  }
  return name;
}

const PROP = /(^|[;{}\s])((?:padding|margin)(?:-(?:top|right|bottom|left))?|(?:row-|column-)?gap)(\s*:\s*)([^;{}]+)(;|(?=\s*\}))/g;
const LEN = /^(-?\d*\.?\d+)(px|rem)$/;
const PASS = /^(-?\d*\.?\d+(?:em|ch|ex|%|vh|vw|vmin|vmax)|0|auto|inherit|initial|unset|revert|!important)$/;

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.css')) files.push(p.replace(/\\/g, '/'));
  }
})('src');

const skipped = [];
let changed = 0;

for (const file of files) {
  if (file === 'src/app/globals.css') continue; // the scale is defined here
  const before = readFileSync(file, 'utf8');
  const after = before.replace(PROP, (m, lead, prop, colon, value, tail) => {
    const parts = value.trim().split(/\s+/);
    if (parts.some(p => p.includes('('))) return m;   // calc(), var(), min()… left alone
    const out = parts.map(part => {
      if (PASS.test(part)) return part;
      const hit = LEN.exec(part);
      if (!hit) { skipped.push([file, part, value.trim()]); return part; }
      const n = parseFloat(hit[1]);
      const px = hit[2] === 'rem' ? n * 16 : n;
      if (px === 0) return '0';
      if (Math.abs(px) > MAX_PX) { skipped.push([file, part, value.trim()]); return part; }
      const token = snap(Math.abs(px));
      return px < 0 ? `calc(var(${token}) * -1)` : `var(${token})`;
    });
    return `${lead}${prop}${colon}${out.join(' ')}${tail}`;
  });
  if (after !== before) { writeFileSync(file, after); changed++; }
}

console.log(`rewrote ${changed} stylesheets`);
if (skipped.length) {
  console.log(`\n${skipped.length} value(s) left alone — convert each by hand:`);
  for (const [f, part, whole] of skipped) console.log(`  ${f}  ${part}  (in: ${whole})`);
}
```

- [ ] **Step 2: Run it**

```bash
node scripts/codemod-spacing.mjs
```

Expected: roughly 50 stylesheets rewritten, and a short skipped list. The known outlier from the baseline is `145px` (one use — the only spacing literal above 96px).

- [ ] **Step 3: Hand-convert the skipped values**

For each line in the skipped report, open the rule and choose:

- A layout offset above 96px (the `145px`) — replace with `9rem` and a one-line comment saying what it offsets. It is not rhythm, so it does not join the scale.
- Anything else — decide the nearest step and write `var(--space-N)` by hand.

- [ ] **Step 4: Re-measure**

```bash
PYTHONIOENCODING=utf-8 python scripts/design-audit.py | sed -n '/=== spacing/,/^$/p'
```

Expected:

```
=== spacing: padding/margin/gap literal values ===
   1 distinct values, 1 uses
   px values: 0 distinct (0 uses)
   rem values: 1 distinct (1 uses)
```

**Acceptance: `px values: 0 distinct (0 uses)` and `rem values: ≤ 3 distinct`.** If any px value survives, the codemod's `PROP` regex missed a property — find it with `grep -rnE "(padding|margin|gap)[a-z-]*: *[^;]*[0-9]px" src --include=*.css` and either extend the regex or fix the rule.

- [ ] **Step 5: Visual check**

Start the dev server and walk five surfaces at 1440px and at 375px: Home, the Bookshelf, the Writing Desk with a docked writing zone, the World Bible article grid, and Settings. You are looking for one thing only — **a control whose padding collapsed or doubled**. The scale snaps 10px to 12px and 20px to 24px, so buttons get very slightly roomier; a control that changed by more than a few pixels means a value was mis-snapped.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: convert all spacing to rem tokens

1,162 px-unit padding/margin/gap uses across 30 distinct values become
var(--space-N) on a 4px grid with a 6px half-step. px spacing does not
respond to a browser text-size setting, so every dense control in the app
stayed the same size while its text grew.

Mechanised by scripts/codemod-spacing.mjs, which snaps to the nearest step
with ties rounding up and refuses to touch anything containing a function
call. Verified by scripts/design-audit.py reporting 0 px spacing values."
```

---

## Task 5: Collapse the type scale to seven steps — roadmap item `07`

**Files:**
- Create: `scripts/codemod-type.mjs`
- Modify: every `src/**/*.css` except `src/app/globals.css`

**Before:** 53 distinct rem sizes (965 uses) + 9 distinct px sizes (35 uses) = **62 distinct font sizes across 1,000 declarations**. `WritingDesk.module.css` alone defines 25 of them; eight stylesheets define ten or more each.
**After:** the audit reports `0 distinct` for both rem and px, and `0 distinct sizes` for every stylesheet in the last section.

### The mapping, and the two display sizes

The seven steps are 11 / 12 / 13 / 14 / 16 / 20 / 24 px. Values snap to the nearest, ties rounding up. Everything from 26px up leaves the scale entirely:

| Measured band | Token | Uses absorbed |
|---------------|-------|---------------|
| ≤ 11.5px (`0.6875`, `0.7`, `0.70`) | `--text-2xs` | 191 |
| 11.5–12.5px (`0.72`–`0.78`) | `--text-xs` | 184 |
| 12.5–13.5px (`0.8`, `0.82`, `0.83`, `0.84`, `13px`) | `--text-sm` | 122 |
| 13.5–15px (`0.85`–`0.92`, `14px`) | `--text-md` | 126 |
| 15–18px (`0.94`–`1.1`, `16px`) | `--text-lg` | 200 |
| 18–22px (`1.15`–`1.3`, `18px`, `20px`) | `--text-xl` | 35 |
| 22–26px (`1.4`, `1.5`, `1.6`) | `--text-2xl` | 22 |
| 26–44px (`1.7`–`2.5`, `30px`) | `--text-display` | 22 |
| ≥ 44px (`2.8`–`8rem`, `48px`) | `--text-hero` | 12 |

`--text-display` and `--text-hero` are **not** scale steps. They are fluid `clamp()` sizes for the welcome and login routes, which are a separate surface from the product UI. Item `07` asks for a seven-step scale and gets one; folding a 128px hero into the same seven steps would force a 2× gap between two neighbours that 900 dense-UI declarations depend on.

- [ ] **Step 1: Write the codemod**

Create `scripts/codemod-type.mjs`:

```js
// Rewrite every literal font-size in src/**/*.css to a type token.
// Run from the repo root:  node scripts/codemod-type.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STEPS = [
  [11, '--text-2xs'], [12, '--text-xs'], [13, '--text-sm'], [14, '--text-md'],
  [16, '--text-lg'], [20, '--text-xl'], [24, '--text-2xl'],
];
const DISPLAY_FROM = 26;   // px
const HERO_FROM = 44;      // px

function tokenFor(px) {
  if (px >= HERO_FROM) return '--text-hero';
  if (px >= DISPLAY_FROM) return '--text-display';
  let name = STEPS[0][1];
  let best = Infinity;
  for (const [v, n] of STEPS) {
    const d = Math.abs(v - px);
    if (d <= best) { best = d; name = n; }   // ascending + <= means ties round up
  }
  return name;
}

const PROP = /(^|[;{}\s])(font-size)(\s*:\s*)([^;{}]+)(;|(?=\s*\}))/g;
const LEN = /^(\d*\.?\d+)(px|rem)$/;

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.css')) files.push(p.replace(/\\/g, '/'));
  }
})('src');

const skipped = [];
let changed = 0;

for (const file of files) {
  if (file === 'src/app/globals.css') continue;
  const before = readFileSync(file, 'utf8');
  const after = before.replace(PROP, (m, lead, prop, colon, value, tail) => {
    const raw = value.trim();
    const bang = raw.endsWith('!important') ? ' !important' : '';
    const core = bang ? raw.slice(0, -'!important'.length).trim() : raw;
    if (core.includes('(')) return m;              // clamp(), calc(), var() left alone
    const hit = LEN.exec(core);
    if (!hit) { skipped.push([file, core]); return m; }
    const n = parseFloat(hit[1]);
    const px = hit[2] === 'rem' ? n * 16 : n;
    return `${lead}${prop}${colon}var(${tokenFor(px)})${bang}${tail}`;
  });
  if (after !== before) { writeFileSync(file, after); changed++; }
}

console.log(`rewrote ${changed} stylesheets`);
if (skipped.length) {
  console.log(`\n${skipped.length} value(s) left alone — convert each by hand:`);
  for (const [f, v] of skipped) console.log(`  ${f}  font-size: ${v}`);
}
```

- [ ] **Step 2: Run it**

```bash
node scripts/codemod-type.mjs
```

Expected: around 50 stylesheets rewritten. Skipped entries will be keyword values (`inherit`, `smaller`) and any existing `clamp()`.

- [ ] **Step 3: Convert the one font-size inside `globals.css`**

The codemod skips `globals.css` so it cannot clobber the scale definitions. One rule there sets a size:

```css
:root[data-theme-family="fantasy"] .ProseMirror {
  font-size: 1.18rem;     /* -> var(--text-lg) */
  line-height: 1.75;      /* -> var(--leading-prose) */
}
```

Change both by hand.

- [ ] **Step 4: Re-measure**

```bash
PYTHONIOENCODING=utf-8 python scripts/design-audit.py | sed -n '/font-size (rem)/,/^$/p;/font-size (px)/,/^$/p;/own font-size scale/,$p'
```

Expected:

```
=== font-size (rem): 0 distinct values, 0 uses ===

=== font-size (px): 0 distinct values, 0 uses ===

=== how many stylesheets define their own font-size scale ===
   <file>   0 distinct sizes
   … (all zero)
```

**Acceptance: both counts are 0, and every stylesheet in the last section reports `0 distinct sizes`.**

- [ ] **Step 5: Count the tokens actually used**

```bash
grep -rho "var(--text-[a-z0-9]*)" src --include=*.css | sort | uniq -c | sort -rn
```

Expected: exactly nine names — the seven scale steps plus `--text-display` and `--text-hero`. Any tenth name is a typo the codemod could not have produced; fix it.

- [ ] **Step 6: Visual check**

The largest single change is `0.85rem → 0.875rem` (84 uses, +2%) and `0.9rem → 0.875rem` (61 uses, −3%) landing on the same step, so text that was two hairs apart becomes identical. Walk the same five surfaces as Task 4 plus the welcome and login routes. Two things to look for:

1. A label that now wraps where it did not (a 12px→13px snap in a fixed-width control).
2. The welcome hero and the login title — they were `8rem` and `3.4rem` and are now one fluid `--text-hero`. Check 375px, 768px and 1440px.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: collapse 62 font sizes to a seven-step scale

53 distinct rem sizes and 9 px sizes across 1,000 declarations. WritingDesk
alone defined 25; eight stylesheets defined ten or more each, so no two
panels agreed on what 'small' meant.

Seven steps at 11/12/13/14/16/20/24px, dense at the bottom because 795 of
the 965 rem uses sat below 1rem. The welcome and login routes get two fluid
clamp() display sizes outside the scale — a single seven-step scale cannot
span an 11px badge and a 128px hero without a 2x gap between two neighbours
that 900 UI declarations depend on.

Verified by scripts/design-audit.py reporting 0 distinct literal font sizes
and 0 private scales."
```

---

## Task 6: Ban raw colour in component stylesheets — roadmap item `08`

**Files:**
- Create: `scripts/codemod-color.mjs`
- Create: `src/app/designSystem.test.ts`
- Modify: 51 stylesheets

**Before:** 742 raw hex + 696 raw `rgb()/rgba()` = **1,438 colour literals**, of which **1,332 are outside `globals.css`**, spread over **380 distinct values**. Only 6 of 57 stylesheets have none. Token:literal ratio **1.77 : 1**.
**After:** 0 colour literals outside `globals.css`; ratio ≥ 25 : 1.

The worst offenders and what the top literals actually are:

```
total  hex   rgba   file
354    178   176    src/components/editor/WritingDesk.module.css
113     29    84    src/components/world/ArticleView.module.css
 63     24    39    src/components/management/Bookshelf.module.css
 62     43    19    src/components/world/ArticleGridEditor.module.css
 62     14    48    src/components/world/WorldBibleCenter.module.css
 61     32    29    src/components/home/HomePage.module.css
 48     16    32    src/app/login/standardLogin.module.css
 43     37     6    src/components/ui/NewWorldModal.module.css
 37     19    18    src/components/home/WorldShelf.module.css

top hex:   #888 ×85   #6c8cff ×64   #fff ×60   #8b8b95 ×29   #f2f0ef ×28
           #ff4d4d ×21  #e5e2e1 ×18  #958ea0 ×16  #d0bcff ×14  #e5484d ×13
top rgba:  rgba(0,0,0,0.5) ×24   rgba(255,255,255,0.14) ×19
           rgba(255,255,255,0.1) ×17   rgba(128,128,128,0.2) ×16
```

`#e5e2e1`, `#958ea0` and `#d0bcff` are the **dark theme's** `--foreground`, `--muted` and `--accent`, hardcoded into component stylesheets. That is why the app has light-theme contrast bugs: 48 declarations paint dark-theme colours regardless of theme. `.deskEditorContent { color: #e0e0e0 }` is the same defect on the manuscript itself.

- [ ] **Step 1: Write the codemod**

Create `scripts/codemod-color.mjs`:

```js
// Convert colour literals in src/**/*.css to tokens where the mapping is
// unambiguous, and report every one that is not.
// Run from the repo root:  node scripts/codemod-color.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Literals that are exactly a token's value in one of the palettes. Written
// out rather than derived, so a palette edit never silently remaps a colour.
const EXACT = new Map(Object.entries({
  '#222222': 'var(--foreground)', '#222': 'var(--foreground)',
  '#171717': 'var(--foreground)',
  '#e5e2e1': 'var(--foreground)',
  '#66666f': 'var(--muted)', '#888888': 'var(--muted)', '#888': 'var(--muted)',
  '#8b8b95': 'var(--muted)', '#958ea0': 'var(--muted)',
  '#a81b12': 'var(--danger)', '#ff6b6d': 'var(--danger)',
  '#ff4d4d': 'var(--danger)', '#e5484d': 'var(--danger)', '#ef4444': 'var(--danger)',
  '#005bb5': 'var(--accent)', '#d0bcff': 'var(--accent)',
  '#6c8cff': 'var(--accent)', '#8ab4ff': 'var(--accent)',
  '#003d7a': 'var(--accent-dim)', '#a078ff': 'var(--accent-dim)',
  '#0e7490': 'var(--secondary)', '#4cd7f6': 'var(--secondary)',
  '#a1541a': 'var(--tertiary)', '#ffb869': 'var(--tertiary)',
  '#fdfdfd': 'var(--background)', '#0e0e0e': 'var(--background)',
  '#f7f7f7': 'var(--surface)', '#131313': 'var(--surface)',
  '#efefef': 'var(--surface-mid)', '#1c1b1b': 'var(--surface-mid)',
  '#e7e7e7': 'var(--surface-high)', '#201f1f': 'var(--surface-high)',
  '#f2f0ef': 'var(--surface)',
  '#eaeaea': 'var(--border)', '#e2e8f0': 'var(--border)',
}));

// Neutral tints used as a surface or edge treatment. White-on-light and
// black-on-dark are both invisible; --overlay-rgb is ink in light and white
// in dark, which is what these were always trying to be.
const TINT_PROPS = /^(background|background-color|border|border-(?:top|right|bottom|left)|border-color|border-(?:top|right|bottom|left)-color|outline|outline-color)$/;
const NEUTRAL = /^rgba\(\s*(?:255,\s*255,\s*255|0,\s*0,\s*0|128,\s*128,\s*128)\s*,\s*([0-9.]+)\s*\)$/;

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.css')) files.push(p.replace(/\\/g, '/'));
  }
})('src');

const DECL = /(^|[;{}\s])([a-z-]+)(\s*:\s*)([^;{}]+)(;|(?=\s*\}))/g;
const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d[^)]*\)/g;

const report = [];
let changed = 0;

for (const file of files) {
  if (file === 'src/app/globals.css') continue;
  const before = readFileSync(file, 'utf8');
  const after = before.replace(DECL, (m, lead, prop, colon, value, tail) => {
    let out = value;
    // Rule 1: exact palette matches, anywhere.
    out = out.replace(LITERAL, lit => EXACT.get(lit.toLowerCase()) ?? lit);
    // Rule 2: neutral tints, only where they are a surface or an edge.
    if (TINT_PROPS.test(prop)) {
      out = out.replace(LITERAL, lit => {
        const hit = NEUTRAL.exec(lit);
        return hit ? `rgba(var(--overlay-rgb), ${hit[1]})` : lit;
      });
    }
    return `${lead}${prop}${colon}${out}${tail}`;
  });
  if (after !== before) { writeFileSync(file, after); changed++; }
}

// Everything still raw, with the line and the property, ordered worst first.
const counts = new Map();
for (const file of files) {
  if (file === 'src/app/globals.css') continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const lit of line.match(LITERAL) ?? []) {
      report.push(`${file}:${i + 1}  ${lit}   ${line.trim()}`);
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
  });
}
writeFileSync('design-color-report.txt', report.join('\n') + '\n');

console.log(`rewrote ${changed} stylesheets`);
console.log(`${report.length} literal(s) remain — see design-color-report.txt`);
for (const [f, n] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(n).padStart(4)}  ${f}`);
}
```

- [ ] **Step 2: Run it and read the report**

```bash
node scripts/codemod-color.mjs
echo "design-color-report.txt" >> .gitignore
```

Expected: roughly 700 of the 1,332 literals converted mechanically, leaving ~600 in the report, headed by `WritingDesk.module.css`.

- [ ] **Step 3: Work the report down, worst file first**

For each remaining literal decide one of four things, in this order:

1. **It is a semantic colour with a token** — use the token (`--accent`, `--muted`, `--danger`, `--secondary`, `--tertiary`, `--border`, `--surface*`, `--foreground`, `--on-accent`).
2. **It is a tint of a semantic colour** — `rgba(var(--accent-rgb), α)` or `rgba(var(--overlay-rgb), α)`.
3. **It is a shadow** — it moves to an elevation token in Task 8; for now write `rgba(var(--shadow-rgb), α)`.
4. **It is genuinely a one-off illustration colour** — the six `COVER_GREYS` in `Bookshelf.tsx`, the wood-desk gradients, the login lamp glow. These get a **named token in `globals.css`**, defined in all three states, not a literal in a module. There are fewer than 20 of them.

Track progress after each file:

```bash
node -e "
const fs=require('fs');
const f=process.argv[1];
const n=(fs.readFileSync(f,'utf8').match(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d[^)]*\)/g)||[]).length;
console.log(f, n, 'literals left');
" src/components/editor/WritingDesk.module.css
```

- [ ] **Step 4: Fix the 69 `var(--text…)` references**

`WritingDesk.module.css` references `var(--text)` 69 times. The token is defined nowhere. Two of the references (lines 2246 and 2266 pre-sweep) have no fallback at all, so those declarations are invalid and the property inherits.

Do not define `--text` — it collides visually with the `--text-*` type scale and means a different thing. Replace all 69 with `var(--foreground)`:

```bash
node -e "
const fs=require('fs');
const p='src/components/editor/WritingDesk.module.css';
let s=fs.readFileSync(p,'utf8');
const before=(s.match(/var\(--text[,)]/g)||[]).length;
s=s.replace(/var\(--text\s*,[^)]*\)/g,'var(--foreground)').replace(/var\(--text\)/g,'var(--foreground)');
fs.writeFileSync(p,s);
console.log('replaced',before,'refs; remaining',(s.match(/var\(--text[,)]/g)||[]).length);
"
```

Expected: `replaced 69 refs; remaining 0`.

- [ ] **Step 5: Write the guard test**

Create `src/app/designSystem.test.ts`. This is the only automated defence against Phase 9 reintroducing a literal:

```typescript
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The design system is enforced by counting, not by rendering: vitest.config.ts
 * includes only src/**\/*.test.ts, and a CSS Module's generated class names are
 * not reachable from jsdom anyway. So this suite reads the stylesheets off disk.
 */

const TOKEN_FILE = 'src/app/globals.css';

function stylesheets(dir = 'src'): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry).replace(/\\/g, '/');
        if (statSync(p).isDirectory()) out.push(...stylesheets(p));
        else if (entry.endsWith('.css')) out.push(p);
    }
    return out;
}

const ALL = stylesheets();
const MODULES = ALL.filter(p => p !== TOKEN_FILE);
const read = (p: string) => readFileSync(p, 'utf8');

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d[^)]*\)/g;
const FONT_SIZE = /font-size:\s*[0-9.]+(?:px|rem)/g;
const SPACING_PX = /(?:padding|margin|gap)(?:-[a-z]+)?:\s*[^;{}]*?[0-9.]+px/g;
const RADIUS = /border-radius:\s*[0-9.]+(?:px|rem)/g;

describe('design tokens', () => {
    it('finds the stylesheets it is meant to guard', () => {
        expect(ALL.length).toBeGreaterThan(40);
        expect(ALL).toContain(TOKEN_FILE);
    });

    it('defines every custom property that any stylesheet references', () => {
        const all = ALL.map(read).join('\n');
        const defined = new Set(all.match(/(--[a-zA-Z0-9-]+)\s*:/g)?.map(s => s.replace(/\s*:$/, '')) ?? []);
        // Set from JS at runtime or by next/font on <body>, so not in any stylesheet.
        const external = new Set([
            '--font-garamond', '--font-fell', '--font-sans', '--font-serif',
            '--profile-sans', '--profile-serif', '--profile-softserif', '--profile-script',
            '--mouse-x', '--mouse-y', '--level', '--swatch', '--d', '--w',
            '--spine-w', '--cover-w', '--cover-h',
        ]);
        const referenced = new Set(all.match(/var\(\s*(--[a-zA-Z0-9-]+)/g)?.map(s => s.replace(/^var\(\s*/, '')) ?? []);
        const missing = [...referenced].filter(t => !defined.has(t) && !external.has(t)).sort();
        expect(missing).toEqual([]);
    });

    it('keeps every colour literal inside the token file', () => {
        const offenders = MODULES
            .map(p => [p, read(p).match(COLOUR)?.length ?? 0] as const)
            .filter(([, n]) => n > 0);
        expect(offenders).toEqual([]);
    });

    it('has no literal font sizes outside the token file', () => {
        const offenders = MODULES
            .map(p => [p, read(p).match(FONT_SIZE) ?? []] as const)
            .filter(([, m]) => m.length > 0);
        expect(offenders).toEqual([]);
    });

    it('has no px spacing anywhere', () => {
        const offenders = MODULES
            .map(p => [p, read(p).match(SPACING_PX) ?? []] as const)
            .filter(([, m]) => m.length > 0);
        expect(offenders).toEqual([]);
    });

    it('has no literal border radii outside the token file', () => {
        const offenders = MODULES
            .map(p => [p, read(p).match(RADIUS) ?? []] as const)
            .filter(([, m]) => m.length > 0);
        expect(offenders).toEqual([]);
    });

    it('declares every palette token in all three default states', () => {
        const g = read(TOKEN_FILE);
        const light = /(?:^|\n):root \{([\s\S]*?)\n\}/.exec(g)?.[1] ?? '';
        const mediaDark = /:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)\n  \}/.exec(g)?.[1] ?? '';
        const explicitDark = /:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/.exec(g)?.[1] ?? '';
        expect(light).not.toBe('');
        expect(mediaDark).not.toBe('');
        expect(explicitDark).not.toBe('');

        const names = (s: string) => new Set(s.match(/(--[a-zA-Z0-9-]+)\s*:/g)?.map(x => x.replace(/\s*:$/, '')) ?? []);
        const PALETTE = /--(accent|foreground|background|surface|border|muted|danger|secondary|tertiary|overlay|glass|shadow|content-wash|on-accent|error|text-muted|text-primary|input-bg)/;
        const wanted = [...names(light)].filter(t => PALETTE.test(t)).sort();

        expect([...names(mediaDark)].filter(t => wanted.includes(t)).sort()).toEqual(wanted);
        expect([...names(explicitDark)].filter(t => wanted.includes(t)).sort()).toEqual(wanted);
    });

    it('exposes exactly nine font-size tokens: seven scale steps and two display sizes', () => {
        const g = read(TOKEN_FILE);
        const found = new Set(g.match(/--text-(?:2xs|xs|sm|md|lg|xl|2xl|display|hero)\s*:/g)?.map(s => s.replace(/\s*:$/, '')) ?? []);
        expect([...found].sort()).toEqual([
            '--text-2xl', '--text-2xs', '--text-display', '--text-hero',
            '--text-lg', '--text-md', '--text-sm', '--text-xl', '--text-xs',
        ]);
    });
});
```

Some of these assertions will fail until later tasks land (radii in Task 8, container queries never). That is deliberate — run the suite after each task and watch failures turn green. Tasks 7–12 each name which assertion they close.

- [ ] **Step 6: Verify**

```bash
npx vitest run src/app/designSystem.test.ts
```

Expected after this task: the colour, `--text`-reference and three-state assertions **pass**; the font-size, spacing and radius assertions pass because Tasks 4 and 5 already landed; the radius assertion **fails** and is closed by Task 8.

```bash
PYTHONIOENCODING=utf-8 python scripts/design-audit.py | sed -n '/token usage/,/^$/p'
```

Expected:

```
=== token usage vs literals ===
   var(--…) references : ~4200
   raw hex colours     : 73
   raw rgb/rgba()      : 33
   ratio tokens:literals = 39.62 : 1
```

**Acceptance: `raw hex` + `raw rgb/rgba` ≤ 135 and every one of them inside `src/app/globals.css`**, proved by:

```bash
grep -rlE "#[0-9a-fA-F]{3,8}\b|rgba?\( *[0-9]" src --include=*.css
```

Expected: exactly one line, `src/app/globals.css`.

- [ ] **Step 7: Contrast check, both themes**

The mechanical conversion changes real colours: 48 declarations that painted dark-theme values in light theme now paint the light palette. Open Home, the Writing Desk, the World Bible and Settings in **light** and **dark**, default family and fantasy family, and confirm no text is now the same colour as its ground. Pay particular attention to anything that used `#888` (85 uses) — `--muted` is `#66666f` in light and `#958ea0` in dark, so both directions moved.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: ban raw colour from component stylesheets

1,332 colour literals across 380 distinct values in 51 stylesheets, against
2,542 token references — a ratio of 1.77 to 1. Forty-eight of them were the
DARK theme's own values hardcoded into modules (#e5e2e1 foreground x18,
#958ea0 muted x16, #d0bcff accent x14), which is why light theme had
contrast failures no palette edit could reach.

scripts/codemod-color.mjs converts exact palette matches anywhere and
neutral rgba tints on surface and edge properties; the remainder was worked
by hand from its report. WritingDesk's 69 var(--text) references, a token
defined nowhere, become var(--foreground).

src/app/designSystem.test.ts locks it: every colour literal must live in
globals.css, and every referenced custom property must be defined."
```

---

## Task 7: Give the manuscript its own typeface — roadmap item `09`

**Files:**
- Modify: `src/components/editor/WritingDesk.module.css` (`.deskEditorContent`, ~line 380)
- Modify: `src/app/globals.css` (the fantasy `.ProseMirror` rules)

The manuscript currently has no `font-family` of its own, so it inherits `body { font-family: var(--font-sans) }` — the same Inter the toolbar uses. Only the fantasy family gives it a serif, via two `globals.css` rules. Task 3 already added `--font-manuscript`.

- [ ] **Step 1: Set the manuscript face and measure**

In `src/components/editor/WritingDesk.module.css`, replace the `.deskEditorContent` block:

```css
.deskEditorContent {
  /* The manuscript is not chrome. It gets the book face in every theme, not
     only in the fantasy family, and it is the one surface in the app that is
     read rather than operated. */
  font-family: var(--font-manuscript);
  color: var(--foreground);
  font-size: var(--text-lg);
  line-height: var(--leading-prose);
  outline: none;
  /* In ch, not px. The cap is a reading measure, so it has to track the font:
     the writing zone is a resizable docked widget and the desk has its own
     font-size control, and an 800px cap would let the measure blow past 90
     characters the moment either grew. 76ch is the width this already
     rendered at. */
  max-width: 76ch;
  margin: 0 auto;
  flex: 1;
  user-select: text !important;
}
```

The `color: #e0e0e0` that was there is a near-white on the light theme's white page — Task 6 will already have converted it, but confirm it reads `var(--foreground)`.

- [ ] **Step 2: Put the heading faces on the scale**

Immediately below, the three heading rules:

```css
.deskEditorContent h1 { font-size: var(--text-display); margin: 1.5em 0 0.5em; color: var(--foreground); }
.deskEditorContent h2 { font-size: var(--text-2xl); margin: 1.5em 0 0.5em; color: var(--foreground); }
.deskEditorContent h3 { font-size: var(--text-xl); margin: 1.2em 0 0.5em; color: var(--foreground); }
```

Leave the `em` margins alone — they scale with the manuscript's own size, which is the point.

- [ ] **Step 3: Simplify the fantasy override**

In `src/app/globals.css`, the fantasy family sets the manuscript face twice, at lines 279 and 284 (pre-Task-3 numbering). Now that `--font-manuscript` carries the Garamond by default, the family only needs its ink colour:

```css
/* The fantasy manuscript page is a parchment sheet in both modes, so the ink
   stays dark even in the candlelit dark palette. The face itself now comes
   from --font-manuscript, which is Garamond everywhere. */
:root[data-theme-family="fantasy"] .ProseMirror {
  color: #2c2113;
}
```

Delete the two `font-family` / `font-size` / `line-height` declarations that block carried; they are the default now. (`#2c2113` is a deliberate one-off — give it a token, `--manuscript-ink`, defined in all three default states plus both fantasy blocks, so it does not trip the Task 6 guard test.)

- [ ] **Step 4: Verify**

```bash
npx vitest run src/app/designSystem.test.ts
grep -n "font-family\|font-size\|color:" src/components/editor/WritingDesk.module.css | sed -n '/deskEditorContent/,+4p'
```

- [ ] **Step 5: Read a chapter**

Open the Writing Desk with a scene of at least 500 words. In **all four combinations** of light/dark × default/fantasy, confirm:

1. The manuscript is set in Garamond and the toolbar in Inter — the two are visibly different faces.
2. The text is readable against its page in every combination. This is the check that catches the old `#e0e0e0`.
3. The measure is still 60–80 characters at the default zone width.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: give the manuscript its own typeface

.deskEditorContent had no font-family, so the manuscript inherited
var(--font-sans) and the writer typed their novel in the same Inter as the
toolbar. It also set color: #e0e0e0 — a near-white on the light theme's
white page.

It now uses --font-manuscript (Garamond) in every theme, --text-lg,
--leading-prose and var(--foreground). The fantasy family keeps only its
parchment ink override, since the face is now the default everywhere."
```

---

## Task 8: Consolidate radii, elevation and motion — roadmap item `15`

**Files:**
- Create: `scripts/codemod-shape.mjs`
- Modify: every `src/**/*.css` except `src/app/globals.css`

**Before:** 21 distinct radii (589 uses) · 121 distinct box-shadow definitions (160 uses) · 32 distinct transition durations (389 uses) + 31 distinct animation durations (83 uses) · 15 distinct easings, of which bare `ease` appears 232 times.
**After:** 0 literal radii · ≤ 12 distinct shadow definitions · ≤ 8 distinct durations reported by the audit.

Radii and durations are mechanical. **Shadows are not** — 121 bespoke recipes cannot be snapped to five steps by a regex without destroying the ones that are doing real work (the book spines' inset lit-edge, the desk's directional pooling). They are converted by hand from a worklist.

- [ ] **Step 1: Write the codemod**

Create `scripts/codemod-shape.mjs`:

```js
// Rewrite literal border-radius values and transition durations/easings to
// tokens. Shadows are deliberately NOT touched — see the plan.
// Run from the repo root:  node scripts/codemod-shape.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RADII = [
  [2, '--radius-xs'], [4, '--radius-sm'], [6, '--radius-md'], [8, '--radius-lg'],
  [12, '--radius-xl'], [16, '--radius-2xl'], [24, '--radius-3xl'],
];
const PILL_FROM = 40;   // 99px, 999px and anything else huge is a pill

const DURS = [
  [100, '--dur-1'], [150, '--dur-2'], [200, '--dur-3'], [300, '--dur-4'], [500, '--dur-5'],
];
const DUR_MAX = 700;    // above this it is a deliberate slow reveal — report it

const EASINGS = new Map(Object.entries({
  'ease': 'var(--ease-standard)',
  'ease-in-out': 'var(--ease-standard)',
  'ease-out': 'var(--ease-out)',
  'ease-in': 'var(--ease-in)',
  'cubic-bezier(0.4, 0, 0.2, 1)': 'var(--ease-standard)',
  'cubic-bezier(0, 0, 0.2, 1)': 'var(--ease-standard)',
  'cubic-bezier(0.16, 1, 0.3, 1)': 'var(--ease-out)',
  'cubic-bezier(0.23, 1, 0.32, 1)': 'var(--ease-out)',
  'cubic-bezier(0.19, 1, 0.22, 1)': 'var(--ease-out)',
  'cubic-bezier(0.55, 0.06, 0.68, 0.19)': 'var(--ease-in)',
  'cubic-bezier(0.34, 1.56, 0.64, 1)': 'var(--ease-spring)',
  'cubic-bezier(0.175, 0.885, 0.32, 1.275)': 'var(--ease-spring)',
}));

// Ascending + <= means an exact tie takes the larger step.
function nearest(table, n) {
  let name = table[0][1], best = Infinity;
  for (const [v, t] of table) { const d = Math.abs(v - n); if (d <= best) { best = d; name = t; } }
  return name;
}

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.css')) files.push(p.replace(/\\/g, '/'));
  }
})('src');

const RADIUS_DECL = /(^|[;{}\s])(border-(?:[a-z]+-[a-z]+-)?radius)(\s*:\s*)([^;{}]+)(;|(?=\s*\}))/g;
const TRANS_DECL = /(^|[;{}\s])(transition|transition-duration|transition-timing-function)(\s*:\s*)([^;{}]+)(;|(?=\s*\}))/g;
const LEN = /^(\d*\.?\d+)(px|rem|%)$/;
const TIME = /^(\d*\.?\d+)(ms|s)$/;

const skipped = [];
let changed = 0;

for (const file of files) {
  if (file === 'src/app/globals.css') continue;
  const before = readFileSync(file, 'utf8');
  let s = before;

  s = s.replace(RADIUS_DECL, (m, lead, prop, colon, value, tail) => {
    const parts = value.trim().split(/\s+/);
    if (parts.some(p => p.includes('('))) return m;
    const out = parts.map(part => {
      if (part === '0' || part === '/') return part;
      const hit = LEN.exec(part);
      if (!hit) { skipped.push([file, prop, part]); return part; }
      const n = parseFloat(hit[1]);
      if (hit[2] === '%') return n >= 50 ? 'var(--radius-full)' : part;
      const px = hit[2] === 'rem' ? n * 16 : n;
      if (px === 0) return '0';
      return `var(${px >= PILL_FROM ? '--radius-full' : nearest(RADII, px)})`;
    });
    return `${lead}${prop}${colon}${out.join(' ')}${tail}`;
  });

  s = s.replace(TRANS_DECL, (m, lead, prop, colon, value, tail) => {
    let v = value;
    // Easings first: the multi-word cubic-bezier() must not be split on spaces.
    for (const [from, to] of EASINGS) {
      if (from.startsWith('cubic-bezier')) v = v.split(from).join(to);
    }
    v = v.replace(/\b(ease-in-out|ease-out|ease-in|ease)\b/g, w => EASINGS.get(w) ?? w);
    v = v.replace(/\b(\d*\.?\d+)(ms|s)\b/g, (lit, num, unit) => {
      const ms = unit === 's' ? parseFloat(num) * 1000 : parseFloat(num);
      if (ms === 0 || ms === 1) return lit;             // 0s and the reduced-motion 1ms
      if (ms > DUR_MAX) { skipped.push([file, prop, lit]); return lit; }
      return `var(${nearest(DURS, ms)})`;
    });
    return `${lead}${prop}${colon}${v}${tail}`;
  });

  if (s !== before) { writeFileSync(file, s); changed++; }
}

console.log(`rewrote ${changed} stylesheets`);
if (skipped.length) {
  console.log(`\n${skipped.length} value(s) left alone — review each by hand:`);
  for (const [f, p, v] of skipped) console.log(`  ${f}  ${p}: ${v}`);
}
```

- [ ] **Step 2: Run it**

```bash
node scripts/codemod-shape.mjs
```

Expected skipped list: the seven transition durations above 700ms (`0.8s`, `1.2s`×2, `1.4s`, `1.5s`, `1.6s`, `1.8s`). These are deliberate slow reveals — leave them, and add a one-line comment above each saying what it reveals. They keep the audit's duration count above zero, which is why the target is ≤ 8 and not 0.

- [ ] **Step 3: Convert the shadows by hand**

Build the worklist:

```bash
python - <<'PY'
import os, re
from collections import Counter
c = Counter()
where = {}
for root, _, fs in os.walk('src'):
    for f in fs:
        if not f.endswith('.css'): continue
        p = os.path.join(root, f).replace(os.sep, '/')
        for i, line in enumerate(open(p, encoding='utf-8'), 1):
            for m in re.finditer(r'box-shadow:\s*([^;]+);', line):
                v = ' '.join(m.group(1).split())
                c[v] += 1
                where.setdefault(v, []).append('%s:%d' % (p, i))
for v, n in c.most_common():
    print('%3d  %-72s  %s' % (n, v[:72], where[v][0]))
PY
```

Work down the list mapping each to one of six outcomes:

| Recipe shape | Becomes |
|--------------|---------|
| a small `0 1–2px` drop | `var(--shadow-1)` |
| `0 2–4px` with ≤ 8px blur | `var(--shadow-2)` |
| `0 4–8px` with 10–20px blur | `var(--shadow-3)` |
| `0 8–14px` with 24–40px blur | `var(--shadow-4)` |
| `0 20px+` with 50px+ blur | `var(--shadow-5)` |
| a focus or selection ring (`0 0 0 Npx …`) | `var(--shadow-ring)` |
| `none` | `none` |

Keep as bespoke, with a comment saying why:

- the two `inset … lit edge / shadowed edge` recipes on `WorldShelf .spine` and `.cover` — they draw a board seen edge-on, not an elevation;
- `-3px 2px 10px rgba(0, 0, 0, 0.10)` ×5 and the `2px 3px 0` / `4px 6px 0` fantasy pair — directional, not vertical;
- the two `0 0 8px var(--accent)` glows.

That is **six bespoke recipes**, which with the six elevation tokens plus `none` gives the ≤ 12 target.

- [ ] **Step 4: Re-measure**

```bash
PYTHONIOENCODING=utf-8 python scripts/design-audit.py | sed -n '/border-radius/,/^$/p;/box-shadow/,/^$/p;/transition durations/,/^$/p'
```

Expected:

```
=== border-radius: 0 distinct values, 0 uses ===

=== box-shadow: distinct definitions ===
   12 distinct shadow definitions across ~160 uses
    …×  var(--shadow-2)
    …

=== transition durations ===
   8 distinct, most common: 1ms×…, 0.8s×1, 1.2s×2, …
```

**Acceptance: border-radius `0 distinct`, box-shadow `≤ 12 distinct`, durations `≤ 8 distinct`.**

- [ ] **Step 5: Verify the guard test**

```bash
npx vitest run src/app/designSystem.test.ts
```

Expected: the border-radius assertion, which failed at the end of Task 6, now **passes**. All seven assertions green.

- [ ] **Step 6: Visual check**

Radii snap 10px→12px (34 uses), 14px→16px (8), 20px→24px (13), so rounded surfaces get slightly rounder. The shadow work is the risky half: open every modal (`New World`, `New Project`, `Export`, `Import`, `Share`, `Settings`, `Login`) and every docked panel and confirm each still separates from what is behind it, in **both** themes. A modal with a shadow that reads on white and vanishes on `#0e0e0e` means it took a literal rather than a token.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: consolidate radii, elevation and motion

21 border-radius values across 589 uses become 8 tokens. 121 box-shadow
recipes across 160 uses become 6 elevation steps, a focus ring, and 6
deliberately bespoke recipes that draw edges rather than height — the book
spines' inset lit edge, the fantasy family's directional offsets, the accent
glows. 32 transition durations become 5, with 7 slow reveals above 700ms
kept and commented. 15 easings become 4; bare 'ease' alone had 232 uses.

Elevation is theme-dependent and defined in all three states: a 6% shadow
that reads as depth on white is nothing at all on #0e0e0e."
```

---

## Task 9: Container queries for the docked panels — roadmap item `14`

**Files:**
- Modify: `src/components/layout/WorldBiblePanel.module.css`, `VersionHistoryPanel.module.css`, `WritingGoalsPanel.module.css`, `SocialMediaPanel.module.css`, `BetaFeedbackPanel.module.css`
- Modify: `src/components/editor/WritingDesk.module.css` (docked widgets)

**Before:** `grep -rn "container-type\|@container" src --include=*.css` returns **0**. Seven viewport media queries exist (`620px`×2, `880px`, `720px`, `520px`, `1000px`, plus `hover: none`), and none of them is about a panel.

The five docked panels are `position: fixed` with a hard width — 480px, 360px, 360px, 480px, and a `100%` — and each has a `.panelResizeHandle`. So their contents are laid out for a width the user can change, and a viewport media query cannot see that width at all. This is the case container queries exist for.

- [ ] **Step 1: Make each panel a query container**

In each of the five panel stylesheets, on the `.panel` rule:

```css
.panel {
    /* The user drags .panelResizeHandle, so this panel's width is independent
       of the viewport's. Its children size against the panel, not the window. */
    container-type: inline-size;
    container-name: panel;
    /* …existing declarations… */
}
```

- [ ] **Step 2: Add the breakpoints the panels actually need**

For each panel, find the rules that assume the default width and give them a narrow variant. The pattern, at the bottom of each file:

```css
/* Below 22rem the two-column header wraps and the meta row is dropped:
   at 360px minus padding there is not room for a title and a timestamp. */
@container panel (max-width: 22rem) {
    .header { flex-direction: column; align-items: flex-start; gap: var(--space-2); }
    .meta { display: none; }
    .sideTab { font-size: var(--text-2xs); }
}

/* Above 34rem the list can go two-up. */
@container panel (min-width: 34rem) {
    .list { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
}
```

Use each file's real class names — `.snapshotItem` in `VersionHistoryPanel`, `.serviceBar`/`.serviceTab` in `SocialMediaPanel`, `.typeBtn` in `BetaFeedbackPanel`, and so on.

- [ ] **Step 3: Do the same for the desk's docked widgets**

`.dockedWidgetHandle` in `WritingDesk.module.css` sits on widgets the user resizes freely on the canvas — the writing zone, the structure panel, the beat widget. Give the widget shell `container-type: inline-size; container-name: widget;` and move any width-dependent rule inside `@container widget (…)`.

- [ ] **Step 4: Verify**

```bash
grep -rc "container-type" src --include=*.css | grep -v ":0"
grep -rc "@container" src --include=*.css | grep -v ":0"
```

Expected: at least six files with `container-type` and at least six with `@container`.

- [ ] **Step 5: Resize every panel**

Open each of the five panels in turn and drag its resize handle from its minimum to its maximum. Watch for:

1. A header that wraps cleanly rather than overflowing.
2. No horizontal scrollbar at any width.
3. The narrow layout appearing at the same width every time, regardless of window size — **this is the proof the query is on the container and not the viewport.** Resize the browser window with a panel at a fixed width and confirm the panel's layout does not change.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: container queries for the docked panels

The five docked panels and the desk's docked widgets are user-resizable, so
their layout depends on their own width and not the window's. There were
zero container queries in the codebase and seven viewport media queries,
none of which could see a panel's width.

Each panel is now container-type: inline-size, and its width-dependent rules
moved into @container. Dragging a panel narrow now reflows it; resizing the
window at a fixed panel width no longer does."
```

---

## Task 10: Cascade layers, then logical properties — roadmap item `20`

**Files:**
- Modify: `src/app/globals.css`
- Modify: every `src/**/*.css`

**Before:** `@layer` appears **0** times. Logical properties appear **0** times against **127** physical uses (`padding-left/right` 21, `margin-left/right` 42, `border-left/right` 64).

Layers first, because they change which rule wins; logical properties are a mechanical rename that must land on a settled cascade.

### Part A — cascade layers

Today the app has three specificity systems fighting: Tailwind's `@tailwind base/components/utilities`, the `globals.css` element and `:root` rules, and 56 CSS Modules. The `:focus-visible` and `prefers-reduced-motion` rules in `globals.css` had to be written with `!important` and bare-element selectors to win. Layers make the order explicit.

- [ ] **Step 1: Declare the order at the top of `globals.css`**

Immediately after the `@tailwind` directives:

```css
/* Explicit cascade order. Later layers win regardless of specificity, so a
   module's single class beats a Tailwind utility, and the accessibility floor
   below beats everything without needing !important. Unlayered rules — which
   is every CSS Module, since Next injects them outside any layer — still win
   over all of these, which is why `modules` is documented but empty: it names
   the slot so the intent is readable. */
@layer tailwind, tokens, base, modules, a11y;
```

- [ ] **Step 2: Move the `globals.css` bodies into layers**

- The five `:root` palette blocks and the two fantasy family blocks → `@layer tokens { … }`
- `*`, `body`, `a`, `input/textarea/button/select`, `option`, the scrollbar rules, `.entity-tag`, the ProseMirror decoration classes, the fantasy `body::before` desk → `@layer base { … }`
- `@media (prefers-reduced-motion: reduce)`, `:focus-visible`, `:focus:not(:focus-visible)`, `.hit-target` → `@layer a11y { … }`

Wrap `@tailwind base;` etc. by replacing them with:

```css
@layer tailwind {
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
}
```

- [ ] **Step 3: Drop the `!important` the layer replaces**

The reduced-motion block currently forces four properties with `!important`. Inside `@layer a11y` — the last layer — it no longer needs them **against layered rules**, but CSS Modules are injected unlayered and unlayered still beats every layer. So keep the `!important` there and say why:

```css
@layer a11y {
  /* !important stays. Next injects CSS Modules outside any layer, and
     unlayered rules beat every layer, so the a11y layer alone is not enough
     to override a module's own transition. */
  @media (prefers-reduced-motion: reduce) { … }
}
```

- [ ] **Step 4: Verify the cascade did not move**

```bash
npx tsc --noEmit --pretty false && npm run build
```

Then open Home, the Writing Desk and Settings in both themes and confirm nothing changed visually. **A layer mistake shows up as a whole category of rule losing at once** — all borders vanishing, all backgrounds going flat — so it is obvious, not subtle.

- [ ] **Step 5: Commit Part A separately**

```bash
git add src/app/globals.css
git commit -m "refactor: put globals.css on explicit cascade layers

@layer tailwind, tokens, base, modules, a11y. There were zero layers and
three competing specificity systems: Tailwind's utilities, globals.css's
element selectors, and 56 CSS Modules. The accessibility floor is now last
by declaration rather than by luck.

The reduced-motion !important stays and is now commented: Next injects CSS
Modules unlayered, and unlayered beats every layer."
```

### Part B — logical properties

- [ ] **Step 6: Rename the physical properties**

```bash
node -e "
const {readdirSync,statSync,readFileSync,writeFileSync}=require('fs');
const {join}=require('path');
const files=[];(function w(d){for(const e of readdirSync(d)){const p=join(d,e);
  statSync(p).isDirectory()?w(p):e.endsWith('.css')&&files.push(p.replace(/\\\\/g,'/'));}})('src');
const MAP=[
  [/\bpadding-left\b/g,'padding-inline-start'],[/\bpadding-right\b/g,'padding-inline-end'],
  [/\bpadding-top\b/g,'padding-block-start'],[/\bpadding-bottom\b/g,'padding-block-end'],
  [/\bmargin-left\b/g,'margin-inline-start'],[/\bmargin-right\b/g,'margin-inline-end'],
  [/\bmargin-top\b/g,'margin-block-start'],[/\bmargin-bottom\b/g,'margin-block-end'],
  [/\bborder-left\b/g,'border-inline-start'],[/\bborder-right\b/g,'border-inline-end'],
  [/\bborder-top-left-radius\b/g,'border-start-start-radius'],
  [/\bborder-top-right-radius\b/g,'border-start-end-radius'],
  [/\bborder-bottom-left-radius\b/g,'border-end-start-radius'],
  [/\bborder-bottom-right-radius\b/g,'border-end-end-radius'],
];
let n=0;
for(const f of files){let s=readFileSync(f,'utf8');const b=s;
  for(const [re,to] of MAP) s=s.replace(re,to);
  if(s!==b){writeFileSync(f,s);n++;}}
console.log('rewrote',n,'stylesheets');
"
```

**Do not** rename `top`, `right`, `bottom`, `left`, `width` or `height`. Those are positioning and sizing, they interact with `position: fixed` panels and transforms, and swapping 431 `width` declarations for `inline-size` buys nothing this product needs. `border-top` and `border-bottom` map to block-start/end which is safe; the rename above covers them.

- [ ] **Step 7: Verify**

```bash
grep -rc "padding-left\|padding-right\|margin-left\|margin-right\|border-left:\|border-right:" src --include=*.css | grep -v ":0"
grep -rho "padding-inline\|margin-inline\|border-inline\|border-block\|padding-block\|margin-block" src --include=*.css | wc -l
```

Expected: **no output** from the first (0 physical uses remain), and **≥ 127** from the second.

- [ ] **Step 8: Look for the one thing that breaks**

`border-inline-start` and `border-left` behave identically in `direction: ltr`, which the app is. The one place a rename can bite is a shorthand/longhand collision — a rule that sets `border` and then `border-left`, where the longhand now sorts differently. Check the six rules that do both:

```bash
grep -rn -B3 "border-inline-start:" src --include=*.css | grep -E "border:" | head
```

Open each and confirm the edge still draws.

- [ ] **Step 9: Commit Part B**

```bash
git add -A
git commit -m "refactor: logical properties for padding, margin and border edges

127 physical uses and zero logical ones. padding/margin/border left and right
become inline-start and inline-end; top and bottom become block-start and
block-end; the four corner radii take their logical names.

top/right/bottom/left positioning and width/height are deliberately left
alone: they interact with the fixed-position panels and with transforms, and
renaming 431 width declarations buys nothing."
```

---

## Task 11: Fewer than sixteen empty slots — roadmap item `16`

**Files:**
- Modify: `src/components/management/Bookshelf.tsx` (lines 15–17, 414–443), `Bookshelf.module.css`
- Create: `src/components/ui/EmptyState.tsx`, `src/components/ui/EmptyState.module.css`
- Modify: ~10 components with bespoke empty states

Two things carry this name, and both are real.

### Part A — the literal sixteen empty slots

```typescript
// src/components/management/Bookshelf.tsx:15-17
/** Diamond-lattice shelf layout: fixed columns, 3 rows of slots by default. */
const DIAMOND_COLS = 6;
const DEFAULT_ROWS = 3;
```

```typescript
// :436-443 — rows alternate 6 / 5 / 6
const minRows = DEFAULT_ROWS + (extraRows[worldId] || 0);
for (let r = 0; r < minRows || idx < projects.length; r++) {
  const cols = DIAMOND_COLS - (r % 2);           // 6, 5, 6, 5, …
  ...
}
```

6 + 5 + 6 = **17 slots on every shelf, always**. A new user with one story sees their book and **sixteen empty diamonds**. That is the item, verbatim.

- [ ] **Step 1: Make the shelf grow from what is there**

Replace the fixed-row loop with one that sizes to content plus one row of headroom, floored at one row:

```typescript
/** Diamond-lattice shelf: rows alternate 6 / 5 and grow with the shelf. */
const DIAMOND_COLS = 6;
/** One row minimum so an empty shelf still offers somewhere to put a book. */
const MIN_ROWS = 1;
/** One spare row above what is filled, so there is always room to add. */
const HEADROOM_ROWS = 1;
```

```typescript
// Rows needed to hold the books, then one spare, then the user's own extras.
let needed = 0, placed = 0;
while (placed < projects.length) { placed += DIAMOND_COLS - (needed % 2); needed++; }
const minRows = Math.max(MIN_ROWS, needed + HEADROOM_ROWS) + (extraRows[worldId] || 0);
```

An empty shelf now shows 6 slots, a one-book shelf shows 11 (6 + 5), and the existing "add a row" control still works. The dossier asked for fewer than sixteen; a fresh shelf now shows five empty slots.

- [ ] **Step 2: Verify the arithmetic**

```bash
node -e "
const COLS=6, MIN=1, HEAD=1;
for (const books of [0,1,5,6,11,12,20]) {
  let needed=0, placed=0;
  while (placed<books){ placed += COLS-(needed%2); needed++; }
  const rows=Math.max(MIN, needed+HEAD);
  let slots=0; for(let r=0;r<rows;r++) slots += COLS-(r%2);
  console.log(books+' books -> '+rows+' rows, '+slots+' slots, '+(slots-books)+' empty');
}
"
```

Expected: `0 books -> 1 rows, 6 slots, 6 empty`, `1 books -> 2 rows, 11 slots, 10 empty`, and every line's empty count **below 16**.

### Part B — 23 different ways to say "nothing here"

```
$ grep -rhoE '^\.[A-Za-z0-9_-]*[Ee]mpty[A-Za-z0-9_-]* *\{' src --include=*.css | sed 's/ *{//' | sort -u
```

42 selectors, of which **23 are roots** rather than child parts, across **22 stylesheets**: `.emptyState` (8 files), `.empty`, `.slotEmpty`, `.binderEditorEmpty`, `.emptyWelcomeContainer`, `.historyEmpty`, `.emptyHistory`, `.emptyLib`, `.mentionsEmpty`, `.searchEmpty`, `.suggestEmpty`, `.tileEmpty`, `.timelineEmpty`, `.relationshipEmpty`, `.pronEmpty`, `.choicesEmpty`, `.descriptionEmpty`, `.calDayEmpty`, `.biblePinEmpty`, `.writingZoneEmpty`, `.modelMenuEmpty`, `.vnBlockEmpty`, `.canvasEmptyTitle`'s parent. Two shared components already exist — `EmptyDeskWelcome.tsx` and `ResearchEmptyState.tsx` — and neither is reused.

- [ ] **Step 3: Write the one empty state**

Create `src/components/ui/EmptyState.tsx`:

```tsx
"use client";

import React from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
    /** What is absent, as a noun phrase: "No snapshots yet". */
    title: string;
    /** One sentence saying how to make the first one. Optional. */
    hint?: string;
    /** A lucide icon element, already sized by the caller. Optional. */
    icon?: React.ReactNode;
    /** The one thing to do about it. Optional. */
    action?: { label: string; onClick: () => void };
    /** 'inline' fits inside a panel or widget; 'page' centres in a view. */
    size?: 'inline' | 'page';
}

/**
 * The single empty state. Twenty-three different ones existed across 22
 * stylesheets, each with its own padding, muted grey and hint size, so the
 * app said "nothing here" in twenty-three visual dialects.
 */
export function EmptyState({ title, hint, icon, action, size = 'inline' }: EmptyStateProps) {
    return (
        <div className={`${styles.root} ${size === 'page' ? styles.page : styles.inline}`}>
            {icon && <div className={styles.icon} aria-hidden="true">{icon}</div>}
            <p className={styles.title}>{title}</p>
            {hint && <p className={styles.hint}>{hint}</p>}
            {action && (
                <button type="button" className={styles.action} onClick={action.onClick}>
                    {action.label}
                </button>
            )}
        </div>
    );
}

export default EmptyState;
```

Create `src/components/ui/EmptyState.module.css` using only tokens:

```css
.root {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--muted);
}

.inline { gap: var(--space-3); padding: var(--space-7) var(--space-5); }
.page   { gap: var(--space-4); padding: var(--space-11) var(--space-6); min-height: 40vh; }

.icon { opacity: 0.5; line-height: 0; }

.title {
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--foreground);
}

.page .title { font-size: var(--text-xl); }

.hint {
    font-size: var(--text-sm);
    max-width: 42ch;
    line-height: var(--leading-snug);
}

.action {
    margin-block-start: var(--space-2);
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--on-accent);
    background: var(--accent);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--dur-2) var(--ease-standard);
}

.action:hover { background: var(--accent-hover); }
```

- [ ] **Step 4: Replace the bespoke ones**

Convert these, in order, deleting each file's own empty-state rules as you go:

| Component | Class removed |
|-----------|---------------|
| `world/WorldBibleRoot.tsx` | `.emptyState`, `.emptyAddBtn`, `.emptyText`, `.emptyIcon`, `.emptyHint` |
| `world/WorldBibleCenter.tsx` | `.emptyState`, `.emptyHint` |
| `world/WorldBibleFolderTree.tsx` | `.emptyState` |
| `world/ArticleReadView.tsx` | `.mentionsEmpty*` (4) |
| `world/ArticleView.tsx` | `.emptyState` |
| `world/TemplatePanel.tsx` | `.emptyLib` |
| `world/Designer.tsx` | `.emptyState` |
| `layout/VersionHistoryPanel.tsx` | `.historyEmpty` |
| `layout/BetaFeedbackPanel.tsx` | `.emptyHistory` |
| `goals/GoalsContent.tsx` | `.emptyState`, `.emptyText` |
| `navigation/CommandPalette.tsx` | `.searchEmpty` |
| `home/WorldShelf.tsx` | `.emptyState`, `.emptyHint` |

Keep bespoke, because they are not "nothing here" messages: `.slotEmpty` (a droppable shelf slot), `.calDayEmpty` (a heatmap cell), `.descriptionEmpty` and `.choicesEmpty` (inline field placeholders), `.emptyWelcomeContainer` (`EmptyDeskWelcome`, a first-run surface Phase 7 owns), `.binderEditorEmpty`, `.timelineEmpty`, `.biblePinEmpty`.

- [ ] **Step 5: Re-count**

```bash
grep -rhoE '^\.[A-Za-z0-9_-]*[Ee]mpty[A-Za-z0-9_-]* *\{' src --include=*.css \
  | sed 's/ *{//' | sort -u \
  | grep -vE '(Text|Hint|Icon|Title|Sub|Body|Header|Actions|Action|Btn|Or|Image|Add|Content)$' \
  | tee /tmp/empty-roots.txt | wc -l
```

**Before: 23. Acceptance: ≤ 8.**

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit --pretty false && npx vitest run && npx eslint src
```

Then open each converted surface with nothing in it and confirm the message is legible in both themes.

```bash
git add -A
git commit -m "feat: one empty state, and a shelf that grows from what is on it

Two problems shared one name. The Bookshelf rendered DEFAULT_ROWS = 3 rows
of 6/5/6 = 17 slots on every shelf regardless of content, so a new user with
one story met sixteen empty diamonds. It now sizes to content plus one spare
row, floored at one: an empty shelf shows 6 slots, a one-book shelf 11.

Separately, 23 distinct empty-state root selectors across 22 stylesheets said
'nothing here' in 23 visual dialects, with two shared components already
built and neither reused. One <EmptyState> now covers 12 of them; the eight
that remain are droppable slots, heatmap cells and inline field placeholders,
which are not messages."
```

---

## Task 12: One visual language for books — roadmap item `17`

**Files:**
- Create: `src/components/ui/bookSurface.module.css`
- Modify: `src/components/management/Bookshelf.module.css` + `.tsx`, `src/components/home/WorldShelf.module.css` + `.tsx`, `src/components/management/WorldBibleBook.module.css` + `.tsx`

**Before:** four independent book renderings, each with its own geometry, radius recipe and shadow:

| Where | Geometry | Radius | Shadow | Colour |
|-------|----------|--------|--------|--------|
| `Bookshelf .book` | `width: 44%`, `aspect-ratio: 2/3`, absolutely positioned, `translateY(-60%)` | `3px 3px 0 0` | `5px -5px 10px rgba(0,0,0,0.35)` | `filter: grayscale(1)` over six hardcoded `COVER_GREYS` |
| `WorldShelf .spine` | `var(--spine-w)` × `calc(100% - 12px)` | `2px 2px 1px 1px` | `inset 2px 0 rgba(255,255,255,0.18), inset -2px 0 rgba(0,0,0,0.28)` | cover image or accent |
| `WorldShelf .cover` | `var(--cover-w)` × `var(--cover-h)` | `2px 4px 4px 2px` | `inset 4px 0 …, inset -1px 0 …, 0 2px 6px …` | cover image |
| `WorldBibleBook .book` | hard `160px × 220px`, `perspective: 1000px`, spine `rotateY(60deg)` 16px | — | — | `.coverDesign` |

Four answers to "what does a book look like in this app". They differ in the two things a reader notices first — the proportion and the way light hits the spine.

- [ ] **Step 1: Decide the language, in one place**

Create `src/components/ui/bookSurface.module.css`:

```css
/*
 * One book. Every book-shaped thing in the app composes these classes and
 * overrides only its size, so the proportion, the spine light and the paper
 * edge are decided once.
 *
 * The proportion is 2:3 — a trade paperback. Bookshelf already used it; the
 * World Bible's 160x220 was 1:1.375 and WorldShelf's covers were whatever
 * --cover-w and --cover-h happened to be.
 */

/* The cover face. Callers set --book-w; the height follows the proportion. */
.cover {
    inline-size: var(--book-w, 6rem);
    aspect-ratio: 2 / 3;
    background-size: cover;
    background-position: center;
    /* Spine edge square, fore-edge rounded — that is which way a book opens. */
    border-start-start-radius: var(--radius-xs);
    border-end-start-radius: var(--radius-xs);
    border-start-end-radius: var(--radius-md);
    border-end-end-radius: var(--radius-md);
    /* The board is lit from the spine side and shadowed at the fore-edge, and
       the whole thing sits above the shelf. Three layers, one recipe. */
    box-shadow:
        inset 3px 0 0 rgba(var(--overlay-rgb), 0.16),
        inset -1px 0 0 rgba(var(--shadow-rgb), 0.24),
        var(--shadow-2);
    transition: transform var(--dur-3) var(--ease-out),
                box-shadow var(--dur-3) var(--ease-out);
}

/* The same book seen edge-on. Height matches the cover it sits beside. */
.spine {
    inline-size: var(--spine-w, 1.5rem);
    block-size: 100%;
    background-size: 100% 100%;
    background-position: center;
    border-start-start-radius: var(--radius-xs);
    border-start-end-radius: var(--radius-xs);
    box-shadow:
        inset 2px 0 0 rgba(var(--overlay-rgb), 0.18),
        inset -2px 0 0 rgba(var(--shadow-rgb), 0.28);
    transition: transform var(--dur-2) var(--ease-out),
                filter var(--dur-2) var(--ease-out);
}

/* Lifting a book off the shelf. One gesture, everywhere. */
.cover:hover,
.spine:hover {
    transform: translateY(-4%);
    box-shadow:
        inset 3px 0 0 rgba(var(--overlay-rgb), 0.16),
        inset -1px 0 0 rgba(var(--shadow-rgb), 0.24),
        var(--shadow-4);
}

.cover:focus-visible,
.spine:focus-visible { box-shadow: var(--shadow-ring), var(--shadow-3); }

/* An empty place on a shelf — the same footprint, drawn as absence. */
.slot {
    inline-size: var(--book-w, 6rem);
    aspect-ratio: 2 / 3;
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-md);
    background: transparent;
    transition: border-color var(--dur-2) var(--ease-standard),
                background var(--dur-2) var(--ease-standard);
}

.slot:hover {
    border-color: var(--accent);
    background: rgba(var(--accent-rgb), 0.06);
}
```

- [ ] **Step 2: Compose it in the three components**

In each `.tsx`, `import book from '@/components/ui/bookSurface.module.css'` and combine:

```tsx
<div className={`${book.cover} ${styles.shelfBook}`} style={{ ['--book-w' as string]: '3.5rem' }} />
```

The component's own module keeps only what is genuinely local — the Bookshelf's drag affordance and delete button position, WorldShelf's scroll-snap and pager, WorldBibleBook's 3D `perspective` and page stack. Delete from each module every rule the shared file now covers: `Bookshelf .book`'s radius/shadow/aspect, `WorldShelf .spine`/`.cover`'s radius/shadow, `WorldBibleBook .book`'s hard 160×220.

- [ ] **Step 3: Decide the greyscale question explicitly**

`Bookshelf .book` sets `filter: grayscale(1)` over six hardcoded greys while `WorldShelf` shows covers in full colour. The two shelves sit two clicks apart and show the same books. **Pick one and write it down in the shared file's header comment.** The recommendation is to drop the greyscale: the covers are the user's, the Bookshelf is the room where they are displayed, and desaturating them is the shelf overruling the author. If it is kept, it becomes `.cover--muted` in the shared file so both shelves can opt in.

Either way, `COVER_GREYS` in `Bookshelf.tsx:20` moves into `globals.css` as tokens — Task 6's guard test will fail on the six hex literals otherwise, and they are in a `.tsx` where the guard cannot see them. Define `--cover-1` … `--cover-6` in all three states and read them with `getComputedStyle`-free CSS: give the element a `data-cover="3"` attribute and let CSS pick.

- [ ] **Step 4: Verify**

```bash
grep -c "border-radius\|box-shadow" src/components/management/Bookshelf.module.css \
  src/components/home/WorldShelf.module.css \
  src/components/management/WorldBibleBook.module.css
npx vitest run src/app/designSystem.test.ts
```

Each of the three should have dropped its book-surface rules. The guard test must stay green.

- [ ] **Step 5: Put the three side by side**

Open the Bookshelf, then Home's WorldShelf, then a World Bible book, in both themes and both families. The check is one question answered three times the same way: **is the spine lit from the same side, is the corner rounded the same amount, and does hover lift by the same distance?**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: one visual language for books

Four independent book renderings: Bookshelf's 2:3 absolutely-positioned
cover with a 3px-3px-0-0 radius and a top-left shadow; WorldShelf's spine at
2px-2px-1px-1px with an inset lit edge; WorldShelf's cover at 2px-4px-4px-2px
with a different inset recipe; WorldBibleBook's hard 160x220 3D hardcover at
1:1.375. Four answers to what a book looks like, differing in the two things
a reader notices first — the proportion and which side the light comes from.

bookSurface.module.css decides it once: 2:3, square spine edge, rounded
fore-edge, one three-layer shadow, one hover lift. The three components keep
only what is genuinely theirs. The Bookshelf's six hardcoded COVER_GREYS
become tokens in all three theme states."
```

---

## Definition of done

Run all four, from the repo root:

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src
npm run build
PYTHONIOENCODING=utf-8 python scripts/design-audit.py
```

### The audit must report

- [ ] `stylesheets: 57`
- [ ] `font-size (rem): 0 distinct values, 0 uses`
- [ ] `font-size (px): 0 distinct values, 0 uses`
- [ ] `spacing: px values: 0 distinct (0 uses)` and `rem values: ≤ 3 distinct`
- [ ] `border-radius: 0 distinct values, 0 uses`
- [ ] `box-shadow: ≤ 12 distinct shadow definitions`
- [ ] `transition durations: ≤ 8 distinct`
- [ ] `raw hex colours ≤ 90` and `raw rgb/rgba() ≤ 45`, with `ratio tokens:literals ≥ 25 : 1`
- [ ] every entry under `how many stylesheets define their own font-size scale` reads `0 distinct sizes`

### These commands must return what is stated

- [ ] `grep -rlE "#[0-9a-fA-F]{3,8}\b|rgba?\( *[0-9]" src --include=*.css` → **only `src/app/globals.css`**
- [ ] `grep -rc "padding-left\|padding-right\|margin-left\|margin-right\|border-left:\|border-right:" src --include=*.css | grep -v ":0"` → **no output**
- [ ] `grep -rn "@layer" src/app/globals.css` → **at least 5 layer bodies plus the `@layer` order declaration**
- [ ] `grep -rc "container-type" src --include=*.css | grep -v ":0"` → **≥ 6 files**
- [ ] the duplicate-selector loop from Task 2 → **no output**
- [ ] `grep -rho "var(--text-[a-z0-9]*)" src --include=*.css | sort -u | wc -l` → **9**
- [ ] the empty-state root count from Task 11 → **≤ 8** (from 23)
- [ ] the shelf arithmetic from Task 11 → **every book count leaves fewer than 16 empty slots**
- [ ] `npx vitest run src/app/designSystem.test.ts` → **7 assertions, all passing**

### Seen with eyes, in light and dark, default family and fantasy

- [ ] The Structure widget's act rows show their accent tint — the 92 `var(--accent-rgb)` declarations resolve
- [ ] The desk beat-card widget has no stray border or 12px padding, and the structure panel's beat headers are vertically centred again
- [ ] The manuscript is a serif, the toolbar is not, and the manuscript text is readable on its page
- [ ] Every modal and every docked panel separates from what is behind it
- [ ] Dragging a panel narrow reflows it; resizing the window at a fixed panel width does not
- [ ] A shelf with one book shows ten empty slots, not sixteen
- [ ] Bookshelf, WorldShelf and WorldBibleBook light their spines from the same side

### And

- [ ] Roadmap item `3f` updated to say the rename landed in Phase 8
- [ ] `docs/superpowers/plans/phase-8-baseline.txt` committed, so the before-numbers survive
