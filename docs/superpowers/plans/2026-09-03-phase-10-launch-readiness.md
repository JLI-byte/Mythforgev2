# Phase 10 — Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the eight operational items that block *launch* rather than development — a size guard rail on the workspace blob, account deletion and data export, a throttle on `beta_requests`, the `workspaces` schema in version control, two Supabase hardening steps, one bundle fix, one CSS collision, and the removal of the Electron toolchain.

**Architecture:** Three groups, executed in that order because each makes the next cheaper. **First, subtraction** — deleting the Electron toolchain removes ~980 of 1,184 packages, so every later `npm ci` and `npm audit` in this plan runs against a small tree. **Second, the database** — four migrations that bring the live schema into `supabase/migrations/`, then harden it; every one is written here and applied by a human in the Supabase SQL editor, never by an agent. **Third, the product code** — the size guard and the export/delete pair, both of which sit on top of a pure `src/lib/` leaf module with real unit tests. The measurement and export logic is deliberately store-free and React-free so it is testable under a runner that only sees `src/**/*.test.ts`.

**Tech Stack:** TypeScript (strict), React 19, Next 16, Zustand, Vitest (jsdom), Supabase (Postgres 15 + GoTrue + PostgREST).

**Spec:** `../specs/2026-09-03-saas-conversion-design.md` Part 3g–3i.

**Note on the test runner:** `vitest.config.ts:7` includes only `src/**/*.test.ts` — **not** `.test.tsx`. Every test in this plan is a `.test.ts` file testing a pure module. Dashboard steps, SQL and `npm uninstall` are verified by command output, not by tests.

---

## Verified before writing this plan

Read this before starting. Several assumptions in the roadmap turned out to need correcting.

| Claim | Status |
|-------|--------|
| RLS is on and correct for `public.workspaces` | **Confirmed.** Policy `Users own their workspace`, `PERMISSIVE`, roles `{public}`, `cmd: ALL`, `qual` and `with_check` both `auth.uid() = user_id`. **No RLS work is planned. Do not add any.** |
| `beta_feedback` and `beta_requests` have RLS on | **Confirmed.** `beta_feedback`: INSERT, `{authenticated}`, `auth.uid() = user_id`. `beta_requests`: INSERT, `{anon,authenticated}`, `status = 'pending'` |
| Only `beta_feedback` is version-controlled | **Confirmed.** `supabase/migrations/` contains one file, `20260610_beta_feedback.sql`. Both `workspaces` **and** `beta_requests` exist only in the dashboard. Task 7 therefore has to baseline `beta_requests` before it can throttle it |
| S6 clears "two WARN lints" | **Half true, and the difference matters.** The two workspaces lints are `0026 pg_graphql_anon_table_exposed` and `0027 pg_graphql_authenticated_table_exposed`. Revoking `SELECT` from `anon` clears **0026 only**. 0027 cannot be cleared: `loadWorkspace()` reads the row as the signed-in user, so `authenticated` must keep `SELECT`. Task 5 clears one lint and documents the other as accepted by design |
| `3f` — did Phase 8 already rename `.beatCard`? | **No.** `docs/superpowers/plans/` contains no Phase 8 plan; the roadmap still lists Phase 8 as "to be written", and `git log` shows no styling commit touching these classes. **`3f` survives in full** and both halves are in this plan (Tasks 2 and 3) |
| `.beatCard` / `.beatCardHeader` really are duplicated | **Confirmed.** `WritingDesk.module.css:3163` and `:4563` both define `.beatCard`; `:3181` and `:4571` both define `.beatCardHeader`. Same file, so CSS Modules produces **one** class and the later block wins per-property. Task 3 documents the exact cascade |
| `ExportModal` drags `jszip` into the entry bundle | **Confirmed.** `src/app/page.tsx:15` imports it statically → `ExportModal.tsx:9` imports `@/lib/epub` → `epub.ts:8` imports `jszip`. Nothing else in `src/` imports `jszip`. `export.ts` uses `import type * as Docx` (type-only) so `docx` is already out of the entry chain |
| The Electron toolchain is unreferenced by the app | **Confirmed.** Nothing in `src/` imports Electron. `bin/node.exe` is 84,456,080 bytes and tracked (`git ls-files bin` → `bin/node.exe`). `fs-extra` is a devDependency used **only** by `scripts/build-electron.js:2`, so it joins the uninstall list |
| `workspaces_user_id_fkey` cascades | **Confirmed:** `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`. Deleting the auth user removes the workspace row automatically — Task 11 does **not** need a second delete |
| `beta_feedback_user_id_fkey` cascades | **No:** `ON DELETE SET NULL`. Feedback text survives account deletion with no owner attached. Task 11's confirmation copy says so |

---

## File Structure

**New:**

| Path | What |
|------|------|
| `supabase/migrations/20260903120000_workspaces.sql` | S5 — reproduces the live `workspaces` table and policy |
| `supabase/migrations/20260903120100_workspaces_revoke_anon.sql` | S6 — `revoke select … from anon` |
| `supabase/migrations/20260903120200_beta_requests_throttle.sql` | O3 — baselines `beta_requests`, adds the throttle trigger |
| `supabase/migrations/20260903120300_delete_own_account.sql` | O2 — `delete_own_account()` RPC |
| `src/lib/workspaceSize.ts` + `.test.ts` | O1 — LEAF MODULE. Byte measurement, named limits, largest contributor |
| `src/lib/workspaceExport.ts` + `.test.ts` | O2 — LEAF MODULE. Builds the export envelope |
| `src/components/providers/WorkspaceSizeBanner.tsx` + `.module.css` | O1 — the soft/hard limit banner |

**Modified:**

| Path | Change |
|------|--------|
| `package.json:5,6-16,17-56,93-100` | E1 — `main`, three scripts, the whole electron-builder `build` object, six devDependencies |
| `src/app/page.tsx:15,270` | 3f — `ExportModal` becomes `lazy()` behind the existing `Suspense` import |
| `src/components/editor/WritingDesk.module.css:4563,4571` | 3f — the later `.beatCard` / `.beatCardHeader` become `.draftBeatCard` / `.draftBeatCardHeader` |
| `src/components/editor/desk/widgets/BeatCardRenderer.tsx:43,44` | 3f — the two renamed class references |
| `src/lib/supabase/useSupabaseSync.ts` | O1 — measure before the write; refuse past the hard limit; return `size` |
| `src/components/providers/SupabaseSyncProvider.tsx` | O1 — render the banner |
| `src/store/workspaceStore.ts:2681` | O2 — export the persist version as a named constant |
| `src/components/ui/SettingsModal.tsx` | O1 + O2 — Storage readout, honest export, Danger zone |
| `src/app/welcome/shared/betaRequest.ts` + `.test.ts` | O3 — a `'throttled'` result |
| `src/app/welcome/themes/standard/RequestAccessModal.tsx:128` | O3 — throttled copy |
| `src/app/welcome/themes/fantasy/FantasyLanding.tsx:219` | O3 — throttled copy |

**Deleted:**

| Path | Size | Why |
|------|------|-----|
| `bin/node.exe` | 84,456,080 bytes | Bundled Node runtime for the Electron packager |
| `electron/main.js`, `electron/preload.js` | 5,452 bytes | The desktop shell |
| `scripts/build-electron.js` | 2,843 bytes | The packager script (sole consumer of `fs-extra`) |

---

## Task 1: Remove the Electron toolchain (`E1`)

**Files:**
- Modify: `package.json`
- Delete: `electron/`, `scripts/`, `bin/node.exe`

This is first because everything after it runs `npm ci`, `npm audit` or `npm run build` against the result.

**Watch out:** `package.json` has **two** things named `build`. `package.json:8` is `"build": "next build"` inside `scripts` and **stays**. `package.json:17-56` is a top-level `"build": { … }` object — that is electron-builder configuration and the whole object goes. Deleting the wrong one breaks the deployment.

- [ ] **Step 1: Record the baseline**

```bash
node -e "console.log('packages:', Object.keys(require('./package-lock.json').packages).length)"
npm audit --omit=dev
```

Expected: `packages: 1185` (1,184 plus the root entry). Record the audit's vulnerability count — the plan claims 39 and this is the before-reading.

- [ ] **Step 2: Confirm nothing in the app references Electron**

```bash
grep -rni "electron" src next.config.ts
grep -rn "fs-extra" --include=*.js --include=*.ts --include=*.tsx --include=*.json . --exclude-dir=node_modules --exclude=package-lock.json
```

Expected: the only `electron` hit is the comment at `src/components/layout/MusicPlayerPanel.tsx:97` (that file is deleted by Phase 1 item `D1`; if it is still present, leave the comment alone — it is a comment). The only `fs-extra` hits are `package.json` and `scripts/build-electron.js`. **If anything in `src/` actually imports Electron, stop** — this task's premise is wrong.

- [ ] **Step 3: Uninstall the seven packages**

```bash
npm uninstall electron electron-builder electron-packager concurrently wait-on cross-env fs-extra
```

`fs-extra` is not in the roadmap's list. It is included because `scripts/build-electron.js:2` is its only consumer and that file is deleted in Step 5.

- [ ] **Step 4: Edit `package.json`**

Delete line 5 entirely:

```json
  "main": "electron/main.js",
```

Replace the `scripts` block (lines 6–16) with:

```json
  "scripts": {
    "dev": "next dev -p 4000",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

Delete the entire top-level `"build": { … }` object at lines 17–56 — the one whose first inner key is `"appId": "com.lorecanvas.app"`. The `"dependencies"` block must end up directly after `"scripts"`.

- [ ] **Step 5: Delete the files**

```bash
git rm -r electron scripts bin
```

`scripts/` contains only `build-electron.js` and `bin/` contains only `node.exe`, so both directories go.

- [ ] **Step 6: Verify the tree shrank and the audit is clean**

```bash
rm -rf node_modules
npm ci
node -e "console.log('packages:', Object.keys(require('./package-lock.json').packages).length)"
npm audit --omit=dev
```

Expected: the package count drops by roughly 980, to somewhere near 200. `npm audit --omit=dev` reports **0 vulnerabilities**. `npm ci` must complete without running a `postinstall` — the hook that called `electron-builder install-app-deps` is gone, which is the change that unblocks container builds.

**If `npm ci` still runs a postinstall**, Step 4 missed the script.

- [ ] **Step 7: Full regression**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src
npm run build
```

Expected: all four clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove the Electron toolchain

Uninstalls electron, electron-builder, electron-packager, concurrently,
wait-on, cross-env and fs-extra, and deletes electron/, scripts/ and the
84 MB bin/node.exe. The postinstall hook ran electron-builder
install-app-deps, which breaks any container build.

Removes roughly 980 of 1,184 packages and every reported npm audit
vulnerability. None of them ever reached the deployed web app."
```

**Note for the human:** `git rm` removes `bin/node.exe` from the working tree and from every future clone's checkout, but the blob stays in history — the packed repository is 31.58 MiB today and will not shrink. Rewriting history to reclaim it is a separate, disruptive operation and is out of scope here.

---

## Task 2: `lazy()` the Export modal (`3f`, first half)

**Files:**
- Modify: `src/app/page.tsx:15,270`

`page.tsx` already imports `lazy` and `Suspense` at line 3 and already code-splits seven components at lines 24–30. `ExportModal` is the outlier: a static import at line 15 that pulls `@/lib/epub` → `jszip` (~30 KB gzipped) into the entry bundle for every user, whether or not they ever export.

- [ ] **Step 1: Confirm the import chain**

```bash
grep -n "jszip" src/lib/epub.ts
grep -rn "from '@/lib/epub'" src
```

Expected: `src/lib/epub.ts:8` imports JSZip, and the only non-test importer is `src/components/ui/ExportModal.tsx:9`.

- [ ] **Step 2: Move the import**

Delete line 15 of `src/app/page.tsx`:

```typescript
import ExportModal from '@/components/ui/ExportModal';
```

and add it to the lazy block, after line 30:

```typescript
// ExportModal pulls in jszip through @/lib/epub. Split so the EPUB writer is
// downloaded when a writer actually opens Export, not on first paint.
const ExportModal = lazy(() => import('@/components/ui/ExportModal'));
```

- [ ] **Step 3: Give it a Suspense boundary**

At `src/app/page.tsx:270`, replace:

```tsx
        {isExportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
```

with:

```tsx
        {isExportOpen && (
          <Suspense fallback={null}>
            <ExportModal onClose={() => setExportOpen(false)} />
          </Suspense>
        )}
```

`fallback={null}` is correct here: the modal is an overlay opened by an explicit action, and a skeleton overlay flashing before the real one is worse than a beat of nothing.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit --pretty false
npm run build
```

Expected: clean. In the build output, the First Load JS for `/` drops. Record the before and after numbers.

- [ ] **Step 5: Manual check**

Start the dev server. Press the Export shortcut (or use the menu) and confirm the modal opens, Markdown / DOCX / EPUB all still produce a file, and closing it works.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "perf: code-split the Export modal

It was the last statically imported modal in page.tsx, and it reaches
jszip through @/lib/epub — roughly 30KB gzipped in the entry bundle for
every user, including the ones who never export."
```

---

## Task 3: Un-duplicate the beat-card classes (`3f`, second half)

**Files:**
- Modify: `src/components/editor/WritingDesk.module.css:4563,4571`
- Modify: `src/components/editor/desk/widgets/BeatCardRenderer.tsx:43,44`

**What is actually wrong.** Both definitions live in the *same* stylesheet, so CSS Modules emits one class and both blocks apply, later-wins, per property:

| Property | `:3163` (Structure list) | `:4563` (Draft-table card) | Wins today |
|----------|--------------------------|----------------------------|------------|
| `background` | `rgba(var(--overlay-rgb),0.02)` | `var(--surface-mid)` | `:4563` |
| `border` | `1px solid var(--border)` | — | `:3163` |
| `border-radius` | `8px` | — | `:3163` |
| `padding` | `12px` | — | `:3163` |
| `gap` | `8px` | — | `:3163` |
| `position` | `relative` | — | `:3163` |
| `transition` | `all 0.2s` | — | `:3163` |
| `height` | — | `100%` | `:4563` |
| `overflow` | — | `hidden` | `:4563` |

So `StructureRenderer`'s beat rows are silently getting `height: 100%`, `overflow: hidden` and the wrong background, and `BeatCardRenderer`'s widget is silently getting a border, radius, padding and gap it never asked for.

The rename is therefore **not** behaviour-neutral. It is a fix. The step below preserves the draft card's current look exactly (by folding in what it was inheriting) and lets the Structure list snap back to its own declaration — which is the bug being repaired, and needs a look.

- [ ] **Step 1: Confirm the two definitions are where this plan says**

```bash
grep -n "^\.beatCard {\|^\.beatCardHeader {" src/components/editor/WritingDesk.module.css
```

Expected exactly four lines: `3163`, `3181`, `4563`, `4571`.

- [ ] **Step 2: Rename the later block**

In `src/components/editor/WritingDesk.module.css`, replace the block at line 4563:

```css
.beatCard {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-mid);
  overflow: hidden;
}
```

with:

```css
/* Renamed from .beatCard: it collided with the Structure widget's own
   .beatCard earlier in this file, and both were applying to both widgets.
   The four properties below the divider are the ones this card was
   inheriting from that collision, folded in so its look is unchanged. */
.draftBeatCard {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-mid);
  overflow: hidden;

  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  gap: 8px;
  position: relative;
  transition: all 0.2s;
}
```

and the block at line 4571:

```css
.beatCardHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 6px;
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.08);
}
```

with the same body under a new name — this one needs no additions, because every property it was inheriting from `:3181` is either overridden or identical:

```css
.draftBeatCardHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 6px;
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.08);
}
```

Leave `.beatCardTitles`, `.beatCardGroup`, `.beatCardLabel`, `.beatCardMeta`, `.beatCardStep`, `.beatCardInfoBtn`, `.beatCardGuidance` and `.beatCardTextarea` alone — those names are unique and renaming them is churn.

- [ ] **Step 3: Update the two references**

In `src/components/editor/desk/widgets/BeatCardRenderer.tsx`, line 43:

```tsx
        <div className={styles.draftBeatCard}>
```

and line 44:

```tsx
            <div className={styles.draftBeatCardHeader}>
```

- [ ] **Step 4: Verify there is exactly one definition of each name now**

```bash
grep -cn "^\.beatCard {" src/components/editor/WritingDesk.module.css
grep -cn "^\.beatCardHeader {" src/components/editor/WritingDesk.module.css
grep -rn "styles.beatCard\b\|styles.beatCardHeader\b" src --include=*.tsx
```

Expected: `1`, `1`, and the only remaining `styles.beatCard` / `styles.beatCardHeader` references are in `StructureRenderer.tsx:117` and `:120`.

- [ ] **Step 5: Verify and look at both widgets**

```bash
npx tsc --noEmit --pretty false
npm run build
```

Then start the dev server and open a Writing Desk with **both** widgets on it:

1. **Draft-table beat card** (`BeatCardRenderer`) — must look **identical** to before. If it does not, a property was missed in Step 2.
2. **Structure widget** (`StructureRenderer`) — its beat rows **will change**: they lose `height: 100%` and `overflow: hidden`, and the background goes from `var(--surface-mid)` back to the faint `rgba(var(--overlay-rgb), 0.02)` the block always declared. Confirm the rows now size to their content and the act rows still show their coloured left border. This is the fix landing.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/WritingDesk.module.css src/components/editor/desk/widgets/BeatCardRenderer.tsx
git commit -m "fix: two widgets were sharing one .beatCard class

WritingDesk.module.css defined .beatCard and .beatCardHeader twice, so
CSS Modules emitted one class and the Structure list and the draft-table
card were each applying half of the other's rules. The draft card keeps
its exact appearance; the Structure rows get their own background and
content-height back."
```

---

## Task 4: Put the `workspaces` schema in version control (`S5`)

**Files:**
- Create: `supabase/migrations/20260903120000_workspaces.sql`

The table holding every customer's manuscript exists only in the dashboard. This migration **reproduces what is live** — it is a baseline, not a change. Run against the live project it must be a no-op; run against a fresh project it must produce the same schema.

Everything below was read from the live database: column types, defaults, nullability, the `ON DELETE CASCADE` on the user foreign key, the `UNIQUE (user_id)` constraint, and the policy's exact roles (`{public}` — i.e. no `TO` clause), command (`ALL`), `USING` and `WITH CHECK`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260903120000_workspaces.sql`:

```sql
-- Workspaces: one JSON blob per user, holding the whole persisted Zustand
-- workspace (worlds, projects, documents, scenes, entities, desk state).
--
-- BASELINE MIGRATION. This table was created by hand in the Supabase
-- dashboard and has been live since before migrations existed for it. Every
-- statement here is idempotent and reproduces exactly what is already in
-- production, so applying it to the live project is a no-op and applying it
-- to a fresh project gives an identical schema.
--
-- Verified against project cchsmijjxzoaoivzbnsg on 2026-09-03.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.workspaces enable row level security;

-- A single ALL policy: a user reads, inserts, updates and deletes exactly one
-- row, their own. Roles are deliberately left unqualified (TO public) to match
-- what is live; RLS still denies anon because auth.uid() is null for it.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspaces'
      and policyname = 'Users own their workspace'
  ) then
    create policy "Users own their workspace"
      on public.workspaces
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
```

- [ ] **Step 2: Human — verify it is a no-op against the live project**

This step is run by a person, not an agent.

1. Open `https://supabase.com/dashboard/project/cchsmijjxzoaoivzbnsg/sql/new`
2. Paste the entire file contents.
3. Press **Run**.
4. Expected result: `Success. No rows returned`, and no error. Because every statement is `if not exists`, nothing changes.

Then confirm nothing moved, by pasting and running this in a new query:

```sql
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'workspaces';
```

Expected exactly one row:

```
Users own their workspace | {public} | ALL | (auth.uid() = user_id) | (auth.uid() = user_id)
```

**If more than one policy comes back, stop** — the `do $$` guard matched on name and something else has been added since this plan was written.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260903120000_workspaces.sql
git commit -m "chore: version-control the workspaces schema

The table holding every customer's manuscript existed only in the
dashboard. Idempotent baseline reproducing the live schema exactly,
including the ON DELETE CASCADE that account deletion depends on."
```

---

## Task 5: Take `public.workspaces` out of the anon GraphQL schema (`S6`)

**Files:**
- Create: `supabase/migrations/20260903120100_workspaces_revoke_anon.sql`

Discoverability only. RLS already denies every row to `anon` — `auth.uid()` is null for that role, so `auth.uid() = user_id` is never true. But the `SELECT` **grant** is what puts the table in the pg_graphql schema, so an unauthenticated caller with the publishable key can enumerate the table and its columns.

**Scope correction:** the advisor reports two WARN lints on this table, not one fixable pair:

- `0026 pg_graphql_anon_table_exposed` — cleared by this migration.
- `0027 pg_graphql_authenticated_table_exposed` — **cannot be cleared.** `loadWorkspace()` in `src/lib/supabase/workspaceSync.ts:26` does `.select('data, updated_at')` as the signed-in user. Revoking `SELECT` from `authenticated` breaks cloud hydration for everyone. This lint is accepted by design.

- [ ] **Step 1: Confirm the grant exists and what else `anon` holds**

Human step. In the SQL editor, run:

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'workspaces' and grantee = 'anon'
order by privilege_type;
```

Expected today: `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260903120100_workspaces_revoke_anon.sql`:

```sql
-- Discoverability, not access control. RLS already denies every workspaces row
-- to anon (auth.uid() is null for that role, so auth.uid() = user_id can never
-- be true). But the SELECT *grant* is what places the table in the pg_graphql
-- schema, where an unauthenticated caller holding the publishable key can
-- enumerate the table and its columns.
--
-- Clears Supabase advisor lint 0026 (pg_graphql_anon_table_exposed).
--
-- Lint 0027 (pg_graphql_authenticated_table_exposed) is NOT cleared and must
-- not be: loadWorkspace() in src/lib/supabase/workspaceSync.ts selects this
-- table as the signed-in user on every cloud hydration. Revoking SELECT from
-- authenticated would break sync for every account.

revoke select on public.workspaces from anon;
```

- [ ] **Step 3: Human — apply it**

1. Open `https://supabase.com/dashboard/project/cchsmijjxzoaoivzbnsg/sql/new`
2. Paste the `revoke` statement.
3. Press **Run**. Expected: `Success. No rows returned`.
4. Re-run the grant query from Step 1. Expected: `SELECT` is gone; the other six remain.

- [ ] **Step 4: Human — confirm the lint cleared**

1. Open `https://supabase.com/dashboard/project/cchsmijjxzoaoivzbnsg/advisors/security`
2. Press the refresh control.
3. Expected: `Public Can See Object in GraphQL Schema` for `public.workspaces` is **gone**. `Signed-In Users Can See Object in GraphQL Schema` is **still there** — that is correct and expected.

- [ ] **Step 5: Human — confirm the app still syncs**

Sign in, make an edit, wait a couple of seconds, reload. The edit must still be there. If it is not, check the browser console for a `LoreCanvas Sync: Error loading workspace` line — that would mean something reads this table unauthenticated, which contradicts Step 1's premise.

**Noted, not actioned:** `anon` also holds `INSERT`, `UPDATE` and `DELETE` on `public.workspaces`. All three are unusable — RLS blocks every row for that role, and the `WITH CHECK` blocks every insert. Revoking them is defensible tidying but is outside item `S6` and is not done here.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260903120100_workspaces_revoke_anon.sql
git commit -m "chore: revoke SELECT on workspaces from anon

RLS already denied the rows; the grant was what kept the table listed in
the public GraphQL schema. Clears advisor lint 0026. Lint 0027 stays and
is accepted - the app reads this table as the signed-in user."
```

---

## Task 6: Enable leaked-password protection (`S7`)

**Files:** none. This is a dashboard setting with no code or SQL representation.

Supabase Auth can check a new or changed password against the HaveIBeenPwned corpus and refuse known-breached ones. It is off today, which the advisor reports as `auth_leaked_password_protection`.

- [ ] **Step 1: Human — turn it on**

1. Open `https://supabase.com/dashboard/project/cchsmijjxzoaoivzbnsg/auth/providers`
2. Expand **Email**.
3. Find **Prevent use of leaked passwords** (under Password settings; on some dashboard versions it lives at `/auth/policies`).
4. Toggle it **on**.
5. Press **Save**.

- [ ] **Step 2: Human — confirm the lint cleared**

1. Open `https://supabase.com/dashboard/project/cchsmijjxzoaoivzbnsg/advisors/security`
2. Refresh.
3. Expected: `Leaked Password Protection Disabled` is gone.

- [ ] **Step 3: Human — confirm sign-in still works**

The app's primary path is magic-link / OAuth, neither of which involves a password, so this setting should be invisible to existing users. Sign in once by the normal route and confirm nothing changed.

- [ ] **Step 4: Record it**

Nothing to commit. Tick this task in the Definition of Done and note the date it was enabled in the pre-launch checklist at the bottom of this file — a dashboard toggle with no migration is exactly the kind of thing that silently reverts on a project restore.

---

## Task 7: Rate-limit `beta_requests` (`O3`)

**Files:**
- Create: `supabase/migrations/20260903120200_beta_requests_throttle.sql`
- Modify: `src/app/welcome/shared/betaRequest.ts`, `src/app/welcome/shared/betaRequest.test.ts`
- Modify: `src/app/welcome/themes/standard/RequestAccessModal.tsx:128`
- Modify: `src/app/welcome/themes/fantasy/FantasyLanding.tsx:219`

The policy accepts anonymous inserts from `{anon,authenticated}` with only `status = 'pending'` as a check. `email` is already `UNIQUE`, so replaying one address is blocked — the open vector is an unlimited stream of distinct fabricated addresses.

**Design.** A `BEFORE INSERT` trigger with two named limits, both per hour: three per client IP, and sixty globally as a backstop for a missing or spoofed `x-forwarded-for`. The IP is stored only as an `md5` digest with a fixed salt, so a repeat can be recognised without keeping the address.

**Said plainly:** an md5 of an IPv4 address is brute-forceable by anyone who can already read the database and the function body. This is a throttle key, not anonymisation. It is kept only for as long as the request row itself.

The trigger must be `SECURITY DEFINER`: `anon` has no `SELECT` on `beta_requests`, so the count query would otherwise fail with a permission error.

This migration also has to **baseline the table**, because `beta_requests` is not in version control either — you cannot version-control a change to a table that has no `CREATE`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260903120200_beta_requests_throttle.sql`:

```sql
-- beta_requests: lead capture from the two landing pages.
--
-- The first half is a BASELINE - this table was created by hand in the
-- dashboard, like workspaces was, and every statement is idempotent so it is a
-- no-op against the live project. Verified against cchsmijjxzoaoivzbnsg on
-- 2026-09-03.
--
-- The second half is the actual change: a throttle. The RLS policy accepts
-- anonymous inserts with only a status check, and email is UNIQUE, so the open
-- abuse path is an unbounded stream of distinct fabricated addresses.

-- ── Baseline ─────────────────────────────────────────────────────────────

create table if not exists public.beta_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name text check (char_length(name) <= 120),
  reason text check (char_length(reason) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'invited', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.beta_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'beta_requests'
      and policyname = 'Anyone can request beta access'
  ) then
    create policy "Anyone can request beta access"
      on public.beta_requests
      for insert
      to anon, authenticated
      with check (status = 'pending');
  end if;
end
$$;

-- ── Throttle ─────────────────────────────────────────────────────────────

-- md5 of the client IP plus a fixed salt. This is a throttle key, not
-- anonymisation: IPv4 is small enough to brute-force for anyone who can read
-- both this column and this function. It lives exactly as long as the row.
alter table public.beta_requests
  add column if not exists ip_hash text;

create index if not exists beta_requests_ip_hash_created_at_idx
  on public.beta_requests (ip_hash, created_at desc);

create or replace function public.beta_requests_throttle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    -- Both limits are per rolling hour, and both are named here rather than
    -- inlined at their use site.
    per_ip_limit  constant int := 3;
    global_limit  constant int := 60;
    ip_salt       constant text := 'lorecanvas-beta-throttle';
    window_start  constant timestamptz := now() - interval '1 hour';
    client_ip text;
    recent int;
begin
    -- Never trust a client-supplied value here: anon holds INSERT on this
    -- table, so the payload could carry someone else's hash.
    new.ip_hash := null;

    client_ip := nullif(btrim(split_part(
        coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
        ',', 1
    )), '');

    if client_ip is not null then
        new.ip_hash := md5(client_ip || ip_salt);

        select count(*) into recent
        from public.beta_requests
        where ip_hash = new.ip_hash
          and created_at >= window_start;

        if recent >= per_ip_limit then
            raise exception 'Too many beta requests from this address in the last hour.'
                using errcode = 'PT429';
        end if;
    end if;

    -- Backstop for a missing or forged header. A flood still gets through this
    -- one per hour, which is a rate the developer can read by hand.
    select count(*) into recent
    from public.beta_requests
    where created_at >= window_start;

    if recent >= global_limit then
        raise exception 'The beta list is receiving too many requests right now.'
            using errcode = 'PT429';
    end if;

    return new;
end;
$$;

drop trigger if exists beta_requests_throttle_trg on public.beta_requests;

create trigger beta_requests_throttle_trg
  before insert on public.beta_requests
  for each row execute function public.beta_requests_throttle();
```

`PT429` is PostgREST's convention: a `PTnnn` SQLSTATE sets the HTTP status, so a throttled insert comes back as a real `429` and `supabase-js` reports `error.code === 'PT429'`.

- [ ] **Step 2: Human — apply it**

1. Open `https://supabase.com/dashboard/project/cchsmijjxzoaoivzbnsg/sql/new`
2. Paste the whole file.
3. Press **Run**. Expected: `Success. No rows returned`.

- [ ] **Step 3: Human — prove the throttle fires**

In a new SQL editor query, insert four rows in one go. The SQL editor sends no `x-forwarded-for`, so the per-IP branch is skipped and this only exercises the trigger's plumbing:

```sql
insert into public.beta_requests (email) values ('throttle-test-1@example.com');
insert into public.beta_requests (email) values ('throttle-test-2@example.com');
select id, email, ip_hash, created_at from public.beta_requests order by created_at desc limit 5;
```

Expected: both succeed and `ip_hash` is `null` for both (no header in the SQL editor). Then clean up:

```sql
delete from public.beta_requests where email like 'throttle-test-%@example.com';
```

The per-IP limit is exercised for real in Step 7, from a browser.

- [ ] **Step 4: Write the failing test**

Add this case to `src/app/welcome/shared/betaRequest.test.ts`, after the `23505` test:

```typescript
    it('returns throttled when the insert trigger raises PT429', async () => {
        insertMock.mockResolvedValue({ error: { code: 'PT429' } });
        const result = await submitBetaRequest({ name: '', email: 'a@b.c', reason: '' });
        expect(result).toBe('throttled');
    });
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
npx vitest run src/app/welcome/shared/betaRequest.test.ts
```

Expected: FAIL — `expected 'error' to be 'throttled'`.

- [ ] **Step 6: Add the result state**

In `src/app/welcome/shared/betaRequest.ts`, widen the result type:

```typescript
export type BetaRequestResult = 'done' | 'duplicate' | 'throttled' | 'error';
```

update the doc comment above `submitBetaRequest`:

```typescript
/**
 * Inserts a beta access request into public.beta_requests.
 * 23505 (unique_violation) means this email already requested access.
 * PT429 is raised by the beta_requests_throttle trigger and reaches the client
 * as a real HTTP 429 — too many requests from this address, or overall.
 */
```

and replace the two return lines at the end of the function:

```typescript
    if (!error) return 'done';
    if (error.code === '23505') return 'duplicate';
    if (error.code === 'PT429') return 'throttled';
    return 'error';
```

Then run the suite again:

```bash
npx vitest run src/app/welcome/shared/betaRequest.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 7: Surface it on both landings**

In `src/app/welcome/themes/standard/RequestAccessModal.tsx`, insert between the `duplicate` branch (line 128) and the `error` branch (line 133):

```tsx
                        {result === "throttled" && (
                            <p className={styles.note}>
                                That&apos;s a few requests in a short space of time.
                                Give it an hour and try again.
                            </p>
                        )}
```

In `src/app/welcome/themes/fantasy/FantasyLanding.tsx`, insert between the `duplicate` branch (line 219) and the `error` branch (line 225), in the voice that surrounds it:

```tsx
                                {result === 'throttled' && (
                                    <p className={styles.letterNote}>
                                        The Cartographer&apos;s ravens are all out. Send
                                        another in an hour.
                                    </p>
                                )}
```

- [ ] **Step 8: Verify**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src
```

Expected: all clean. TypeScript will flag any exhaustive `switch` on `BetaRequestResult` that has not been widened — there are none today, but check the output rather than assuming.

- [ ] **Step 9: Human — prove the per-IP limit from a browser**

Open the welcome page and submit four beta requests with four different addresses in quick succession. Expected: the first three land, and the fourth shows the throttled copy rather than the error copy. Then clean up the three test rows in the SQL editor.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20260903120200_beta_requests_throttle.sql src/app/welcome
git commit -m "feat: throttle beta_requests

The insert policy accepted anonymous rows with only a status check, and
email being UNIQUE only blocked replaying one address - not a stream of
fabricated ones. Adds a BEFORE INSERT trigger with two named per-hour
limits, three per client IP and sixty overall, and baselines the table
itself since it was never in migrations either.

Only an md5 of the IP is stored, and only for the life of the row."
```

---

## Task 8: Measure the workspace — leaf module (`O1`, first half)

**Files:**
- Create: `src/lib/workspaceSize.ts`
- Create: `src/lib/workspaceSize.test.ts`

`workspaces.data` is one unbounded JSON blob per user, and pasted images live inside it as data URLs. Nothing stops one account pushing hundreds of megabytes into a Postgres row on every autosave.

The measurement is a pure function with no store, network or React dependency, matching the leaf-module convention already used by `src/lib/workspaceConflict.ts` — 4-space indent, a doc comment that says LEAF MODULE, and real unit tests.

- [ ] **Step 1: Write the failing test**

Create `src/lib/workspaceSize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
    HARD_LIMIT_BYTES,
    SOFT_LIMIT_BYTES,
    byteLength,
    formatBytes,
    measureWorkspace,
    verdictFor,
} from './workspaceSize';

describe('byteLength', () => {
    it('measures the serialised UTF-8 length, not the character count', () => {
        // "—" is one JS character but three UTF-8 bytes, plus two quotes.
        expect(byteLength('—')).toBe(5);
    });

    it('measures a whole object including its punctuation', () => {
        expect(byteLength({ a: 'hi', b: 1 })).toBe('{"a":"hi","b":1}'.length);
    });

    it('returns 0 for a value JSON cannot represent', () => {
        expect(byteLength(undefined)).toBe(0);
    });
});

describe('verdictFor', () => {
    it('is ok below the soft limit', () => {
        expect(verdictFor(SOFT_LIMIT_BYTES - 1)).toBe('ok');
    });

    it('warns at the soft limit', () => {
        expect(verdictFor(SOFT_LIMIT_BYTES)).toBe('warn');
    });

    it('still warns just below the hard limit', () => {
        expect(verdictFor(HARD_LIMIT_BYTES - 1)).toBe('warn');
    });

    it('blocks at the hard limit', () => {
        expect(verdictFor(HARD_LIMIT_BYTES)).toBe('blocked');
    });
});

describe('measureWorkspace', () => {
    it('totals the whole blob', () => {
        expect(measureWorkspace({ a: 'hi', b: 1 }).totalBytes)
            .toBe('{"a":"hi","b":1}'.length);
    });

    it('ranks contributors largest first and names the largest', () => {
        const result = measureWorkspace({
            small: 'a',
            large: 'aaaaaaaaaaaaaaaaaaaa',
            middle: 'aaaaa',
        });
        expect(result.contributors.map(c => c.key)).toEqual(['large', 'middle', 'small']);
        expect(result.largest).toEqual({ key: 'large', bytes: 22 });
    });

    it('skips keys JSON would drop', () => {
        const result = measureWorkspace({ kept: 1, dropped: undefined });
        expect(result.contributors.map(c => c.key)).toEqual(['kept']);
    });

    it('reports nothing to blame for an empty workspace', () => {
        const result = measureWorkspace({});
        expect(result.totalBytes).toBe(2);
        expect(result.contributors).toEqual([]);
        expect(result.largest).toBeNull();
    });

    it('carries the verdict through from the measured total', () => {
        const result = measureWorkspace({ images: 'a'.repeat(SOFT_LIMIT_BYTES) });
        expect(result.verdict).toBe('warn');
        expect(result.largest?.key).toBe('images');
    });
});

describe('formatBytes', () => {
    it('leaves small numbers in bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(512)).toBe('512 B');
    });

    it('steps up a unit at a time with one decimal', () => {
        expect(formatBytes(1024)).toBe('1.0 KB');
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(4 * 1024 * 1024)).toBe('4.0 MB');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/workspaceSize.test.ts
```

Expected: FAIL — `Failed to resolve import "./workspaceSize"`.

- [ ] **Step 3: Write the module**

Create `src/lib/workspaceSize.ts`:

```typescript
/**
 * Workspace size measurement — LEAF MODULE (no store, no React, no network).
 *
 * `workspaces.data` is one unbounded JSON blob per user, and images pasted into
 * the editor are stored inside it as data URLs. Nothing stopped a single
 * account from pushing hundreds of megabytes into a Postgres row on every
 * autosave — a database problem and a cost problem with no ceiling.
 *
 * Two named limits, both measured on the serialised UTF-8 byte length, because
 * that is what actually crosses the wire and what Postgres actually stores:
 *
 *   - SOFT: warn the writer, and name the part of the workspace responsible.
 *   - HARD: refuse the cloud write. Local saving continues untouched.
 *
 * This is a guard rail, not a quota system. Moving images to object storage is
 * the real fix and is deliberately out of scope.
 *
 * Note on the numbers: `totalBytes` measures the whole blob, while
 * `contributors` measures each value on its own, so the contributors sum to
 * slightly less than the total — the difference is the key names and the
 * punctuation between them. Ranking is what matters here, not reconciliation.
 *
 * `byteLength` will throw on a structure JSON cannot serialise (a cycle). That
 * cannot happen for a partialized workspace, and letting it throw is better
 * than silently under-reporting; callers on the save path catch it.
 */

/** Warn past this many bytes. 4 MB of JSON is already a very large manuscript. */
export const SOFT_LIMIT_BYTES = 4 * 1024 * 1024;

/** Refuse the cloud write past this many bytes. */
export const HARD_LIMIT_BYTES = 8 * 1024 * 1024;

export type SizeVerdict = 'ok' | 'warn' | 'blocked';

export interface KeySize {
    key: string;
    bytes: number;
}

export interface WorkspaceSize {
    /** Serialised size of the entire blob, in bytes. */
    totalBytes: number;
    verdict: SizeVerdict;
    /** Top-level persisted keys, largest first. Empty for an empty blob. */
    contributors: KeySize[];
    /** The single largest key, or null when there is nothing to measure. */
    largest: KeySize | null;
}

const encoder = new TextEncoder();

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Serialised UTF-8 byte length of a value. 0 when JSON drops it entirely. */
export function byteLength(value: unknown): number {
    const json = JSON.stringify(value);
    if (json === undefined) return 0;
    return encoder.encode(json).length;
}

export function verdictFor(totalBytes: number): SizeVerdict {
    if (totalBytes >= HARD_LIMIT_BYTES) return 'blocked';
    if (totalBytes >= SOFT_LIMIT_BYTES) return 'warn';
    return 'ok';
}

/** Measure a persisted workspace blob and rank what is taking up the room. */
export function measureWorkspace(blob: Record<string, unknown>): WorkspaceSize {
    const totalBytes = byteLength(blob);

    const contributors: KeySize[] = [];
    for (const [key, value] of Object.entries(blob)) {
        if (value === undefined) continue;
        contributors.push({ key, bytes: byteLength(value) });
    }
    contributors.sort((a, b) => b.bytes - a.bytes);

    return {
        totalBytes,
        verdict: verdictFor(totalBytes),
        contributors,
        largest: contributors[0] ?? null,
    };
}

/** Human-readable size for UI copy. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(1)} ${UNITS[unit]}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/workspaceSize.test.ts
```

Expected: PASS — 14 tests.

- [ ] **Step 5: Full check**

```bash
npx tsc --noEmit --pretty false && npx vitest run && npx eslint src
```

Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/workspaceSize.ts src/lib/workspaceSize.test.ts
git commit -m "feat: measure the serialised workspace, with named limits

Leaf module: pure, no store, no React. Reports the total, ranks the
top-level persisted keys so the largest contributor can be named, and
turns a byte count into ok / warn / blocked against two constants."
```

---

## Task 9: Enforce the limits on the sync path (`O1`, second half)

**Files:**
- Modify: `src/lib/supabase/useSupabaseSync.ts`
- Modify: `src/components/providers/SupabaseSyncProvider.tsx`
- Create: `src/components/providers/WorkspaceSizeBanner.tsx`
- Create: `src/components/providers/WorkspaceSizeBanner.module.css`
- Modify: `src/components/ui/SettingsModal.tsx`

The measurement goes inside `flush()` rather than inside the store subscription. The subscription fires on every keystroke; `flush()` runs at most once per `SAVE_DEBOUNCE_MS` (800 ms), which is the right rate both for serialising an 8 MB blob and for driving React state.

- [ ] **Step 1: Measure and refuse in the sync hook**

In `src/lib/supabase/useSupabaseSync.ts`, add to the imports at the top of the file:

```typescript
import {
    HARD_LIMIT_BYTES, formatBytes, measureWorkspace, type WorkspaceSize,
} from '@/lib/workspaceSize';
```

Add a piece of state beside `const [status, setStatus] = useState<SyncStatus>('idle');`:

```typescript
    const [size, setSize] = useState<WorkspaceSize | null>(null);
```

Replace the first three lines of `flush` — currently:

```typescript
    const flush = async () => {
      const state = latestStateRef.current;
      if (!state) return false;
      const ok = await saveWorkspace(userId, state);
```

with:

```typescript
    const flush = async () => {
      const state = latestStateRef.current;
      if (!state) return false;

      // Measure before the write. An unbounded blob is a database and a cost
      // problem, and the writer should hear about it before it becomes one.
      let measured: WorkspaceSize | null = null;
      try {
        measured = measureWorkspace(state);
        setSize(measured);
      } catch (err) {
        logger.error('LoreCanvas Sync: could not measure the workspace', err);
      }

      if (measured?.verdict === 'blocked') {
        logger.error(
          `LoreCanvas Sync: workspace is ${formatBytes(measured.totalBytes)}, over the ` +
          `${formatBytes(HARD_LIMIT_BYTES)} cloud limit — keeping local only. ` +
          `Largest part: ${measured.largest?.key} (${formatBytes(measured.largest?.bytes ?? 0)}).`,
        );
        setStatus('error');
        return false;
      }

      const ok = await saveWorkspace(userId, state);
```

Change the hook's return at the bottom of the file:

```typescript
  return { status, isSyncing: status === 'syncing', size };
```

**Do not** touch the backoff counters in the blocked branch. A blocked write is not a failed request — retrying it costs nothing and it must resume the moment the workspace comes back under the limit.

- [ ] **Step 2: Build the banner**

Create `src/components/providers/WorkspaceSizeBanner.tsx`:

```tsx
"use client";

import React, { useEffect, useState } from 'react';
import { formatBytes, HARD_LIMIT_BYTES, type WorkspaceSize } from '@/lib/workspaceSize';
import styles from './WorkspaceSizeBanner.module.css';

/**
 * Names the persisted store keys in words a writer would use, so the banner can
 * say what is taking up the room rather than printing an internal key.
 */
const KEY_LABELS: Record<string, string> = {
    scenes: 'your scenes',
    documents: 'your documents',
    entities: 'your World Bible articles',
    projects: 'your projects',
    worlds: 'your worlds',
    deskStates: 'your Writing Desk boards',
    draftStates: 'your draft tables',
    researchStates: 'your research boards',
    sceneSnapshots: 'scene version history',
    entitySnapshots: 'article version history',
    stashedExample: 'the stashed example world',
    socialHistory: 'your social posts',
};

function label(key: string | undefined): string {
    if (!key) return 'your workspace';
    return KEY_LABELS[key] ?? key;
}

export function WorkspaceSizeBanner({ size }: { size: WorkspaceSize | null }) {
    const [dismissedAt, setDismissedAt] = useState<string | null>(null);
    const verdict = size?.verdict ?? 'ok';

    // A dismissal covers one verdict. Crossing from warn to blocked is new
    // information and has to be allowed to interrupt again.
    useEffect(() => {
        if (dismissedAt && dismissedAt !== verdict) setDismissedAt(null);
    }, [verdict, dismissedAt]);

    if (!size || verdict === 'ok' || dismissedAt === verdict) return null;

    const total = formatBytes(size.totalBytes);
    const hard = formatBytes(HARD_LIMIT_BYTES);
    const largest = size.largest
        ? `${label(size.largest.key)} (${formatBytes(size.largest.bytes)})`
        : 'nothing in particular';

    return (
        <div
            className={verdict === 'blocked' ? styles.blocked : styles.warn}
            role={verdict === 'blocked' ? 'alert' : 'status'}
        >
            <p className={styles.text}>
                {verdict === 'blocked' ? (
                    <>
                        Your workspace is {total}, past the {hard} cloud limit, so
                        LoreCanvas has stopped copying it to the cloud. Nothing is lost —
                        it is still saving everything in this browser. The biggest part is{' '}
                        {largest}. Removing some pasted images is usually the quickest way
                        back under.
                    </>
                ) : (
                    <>
                        Your workspace is {total}. Cloud sync stops at {hard}. The biggest
                        part is {largest}.
                    </>
                )}
            </p>
            <button
                type="button"
                className={styles.dismiss}
                onClick={() => setDismissedAt(verdict)}
                aria-label="Dismiss workspace size notice"
            >
                Dismiss
            </button>
        </div>
    );
}
```

Create `src/components/providers/WorkspaceSizeBanner.module.css`:

```css
.warn,
.blocked {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  font-size: 0.85rem;
  line-height: 1.4;
  border-bottom: 1px solid var(--border);
}

.warn {
  background: var(--surface-mid);
  color: var(--foreground);
}

.blocked {
  background: var(--surface-mid);
  color: var(--foreground);
  border-bottom-color: var(--accent);
  box-shadow: inset 0 3px 0 var(--accent);
}

.text {
  margin: 0;
  flex: 1;
}

.dismiss {
  flex: none;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: inherit;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 4px 10px;
}

.dismiss:hover,
.dismiss:focus-visible {
  border-color: var(--accent);
}
```

- [ ] **Step 3: Render it**

In `src/components/providers/SupabaseSyncProvider.tsx`, add the import:

```typescript
import { WorkspaceSizeBanner } from './WorkspaceSizeBanner';
```

change the hook call:

```typescript
  const { size } = useSupabaseSync(userId || '');
```

and the return:

```tsx
  return (
    <>
      <WorkspaceSizeBanner size={size} />
      {children}
    </>
  );
```

- [ ] **Step 4: Add the Settings readout**

In `src/components/ui/SettingsModal.tsx`, add to the imports:

```typescript
import { formatBytes, measureWorkspace, HARD_LIMIT_BYTES, SOFT_LIMIT_BYTES } from '@/lib/workspaceSize';
```

and widen the store import at line 7 to include `partializeWorkspace`:

```typescript
import {
    useWorkspaceStore,
    partializeWorkspace,
    listDataBackups,
    restoreDataBackup,
    createManualBackup,
} from '@/store/workspaceStore';
```

Add beside the other `useState` calls in the component body (measured once when the modal opens — the modal is unmounted when closed, so this is not stale):

```typescript
    const [size] = useState(() =>
        measureWorkspace(partializeWorkspace(useWorkspaceStore.getState()) as Record<string, unknown>)
    );
```

Add this section immediately **before** the existing `Backup &amp; Restore` section:

```tsx
                    <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <div className={styles.providerHeader}>
                            <h3>Storage</h3>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.88rem' }}>
                            Your workspace is <strong>{formatBytes(size.totalBytes)}</strong>.
                            LoreCanvas warns at {formatBytes(SOFT_LIMIT_BYTES)} and stops
                            copying to the cloud at {formatBytes(HARD_LIMIT_BYTES)}. It keeps
                            saving in this browser either way.
                        </p>
                        {size.contributors.length > 0 && (
                            <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
                                {size.contributors.slice(0, 3).map(c => (
                                    <li key={c.key}>{c.key} — {formatBytes(c.bytes)}</li>
                                ))}
                            </ul>
                        )}
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                            Pasted images are stored inside the workspace, so they are usually
                            what pushes it up.
                        </p>
                    </section>
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src
npm run build
```

Expected: all clean.

- [ ] **Step 6: Human — prove both limits with the real UI**

The limits are 4 MB and 8 MB, which is impractical to reach by typing. Lower them temporarily to see both states:

1. In `src/lib/workspaceSize.ts`, temporarily set `SOFT_LIMIT_BYTES = 8 * 1024` and `HARD_LIMIT_BYTES = 16 * 1024`.
2. Start the dev server, sign in, type until a save fires.
3. Expected: the warn banner appears at the top, names a size and a contributor, and dismisses.
4. Keep typing past the second threshold. Expected: the blocked banner replaces it (a dismissal of the warn banner must not suppress it), the sync status goes to `error`, and the browser console carries the `over the … cloud limit — keeping local only` line.
5. Reload. Expected: everything you typed is still there — local persistence never stopped.
6. Open Settings and confirm the Storage section reports the same number.
7. **Restore both constants to `4 * 1024 * 1024` and `8 * 1024 * 1024`** and re-run `npx vitest run src/lib/workspaceSize.test.ts` — the tests are written against the constants, so they pass either way and will not catch a forgotten revert. Check the file by eye.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/useSupabaseSync.ts src/components/providers src/components/ui/SettingsModal.tsx
git commit -m "feat: soft and hard size limits on the cloud workspace

Measured once per debounced save, not per keystroke. Past the soft limit
a banner names the largest contributor; past the hard limit the cloud
write is refused, local saving continues, and the banner says so. Settings
gains a Storage readout with the top three contributors."
```

---

## Task 10: Export everything as one JSON file (`O2`, first half)

**Files:**
- Create: `src/lib/workspaceExport.ts`, `src/lib/workspaceExport.test.ts`
- Modify: `src/store/workspaceStore.ts:2681`
- Modify: `src/components/ui/SettingsModal.tsx`

There is already a "Download backup (.json)" button at `SettingsModal.tsx:258`. It has two problems: it reads `localStorage['lorecanvas-workspace']` directly, so it can be up to one persist-debounce stale and it silently produces nothing when the key is absent; and the file it writes is a bare Zustand persist envelope with no statement of what it does or does not contain.

- [ ] **Step 1: Name the schema version**

`src/store/workspaceStore.ts:2681` currently has the persist version as a bare literal:

```typescript
            version: 4,
```

Add this export just above `partializeWorkspace` at line 1219:

```typescript
/** Persist schema version. Exported so the data export can stamp the file. */
export const WORKSPACE_SCHEMA_VERSION = 4;
```

and use it at line 2681:

```typescript
            version: WORKSPACE_SCHEMA_VERSION,
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/workspaceExport.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EXPORT_FORMAT, EXPORT_FORMAT_VERSION, NOT_INCLUDED, buildWorkspaceExport } from './workspaceExport';

const workspace = { projects: [{ id: 'p1' }], scenes: [], entities: [] };

describe('buildWorkspaceExport', () => {
    it('stamps the format so a future importer can recognise the file', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: '2026-09-03T10:00:00.000Z' });
        expect(out.format).toBe(EXPORT_FORMAT);
        expect(out.formatVersion).toBe(EXPORT_FORMAT_VERSION);
        expect(out.schemaVersion).toBe(4);
        expect(out.exportedAt).toBe('2026-09-03T10:00:00.000Z');
    });

    it('carries the workspace through untouched', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: 'x' });
        expect(out.workspace).toEqual(workspace);
    });

    it('lists what is in the file, so the reader does not have to guess', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: 'x' });
        expect(out.contents).toEqual(['projects', 'scenes', 'entities']);
    });

    it('states what is not in the file', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: 'x' });
        expect(out.notIncluded).toEqual(NOT_INCLUDED);
    });

    it('records the account when it is known', () => {
        const out = buildWorkspaceExport(workspace, {
            schemaVersion: 4,
            exportedAt: 'x',
            userId: 'u1',
            email: 'writer@example.com',
        });
        expect(out.account).toEqual({ userId: 'u1', email: 'writer@example.com' });
    });

    it('omits the account entirely when signed out', () => {
        const out = buildWorkspaceExport(workspace, { schemaVersion: 4, exportedAt: 'x' });
        expect(out.account).toBeNull();
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run src/lib/workspaceExport.test.ts
```

Expected: FAIL — `Failed to resolve import "./workspaceExport"`.

- [ ] **Step 4: Write the module**

Create `src/lib/workspaceExport.ts`:

```typescript
/**
 * Workspace data export — LEAF MODULE (no store, no React, no network).
 *
 * Builds the single JSON file a writer takes with them. Two rules shape it:
 *
 *  - It must be complete. Everything the app persists goes in, verbatim, so the
 *    file is a real copy rather than a summary.
 *  - It must be honest. The envelope says what format it is, when it was made,
 *    which account it came from, what is inside it, and — the part that is
 *    usually missing — what is NOT inside it.
 *
 * The caller passes the already-partialized workspace, which keeps this module
 * free of any store import.
 */

export const EXPORT_FORMAT = 'lorecanvas-workspace-export';

/** Bump only when the envelope shape changes, never for a store schema change. */
export const EXPORT_FORMAT_VERSION = 1;

/** Written into every export so the file itself states its own limits. */
export const NOT_INCLUDED = [
    'Local backup snapshots (the lorecanvas-backup-* entries in this browser). Those are copies of older versions of the same data.',
    'Beta feedback you have submitted. That is stored separately and is not part of your workspace.',
    'Your account itself — this file cannot sign you in. It is your writing, not your credentials.',
    'Files you have already exported from LoreCanvas as .docx, .epub or .md.',
] as const;

export interface WorkspaceExportMeta {
    schemaVersion: number;
    /** ISO timestamp. Passed in rather than read from the clock, so this stays pure. */
    exportedAt: string;
    userId?: string;
    email?: string;
}

export interface WorkspaceExport {
    format: string;
    formatVersion: number;
    exportedAt: string;
    schemaVersion: number;
    account: { userId?: string; email?: string } | null;
    contents: string[];
    notIncluded: readonly string[];
    workspace: Record<string, unknown>;
}

export function buildWorkspaceExport(
    workspace: Record<string, unknown>,
    meta: WorkspaceExportMeta,
): WorkspaceExport {
    const account = meta.userId || meta.email
        ? {
            ...(meta.userId ? { userId: meta.userId } : {}),
            ...(meta.email ? { email: meta.email } : {}),
        }
        : null;

    return {
        format: EXPORT_FORMAT,
        formatVersion: EXPORT_FORMAT_VERSION,
        exportedAt: meta.exportedAt,
        schemaVersion: meta.schemaVersion,
        account,
        contents: Object.keys(workspace),
        notIncluded: NOT_INCLUDED,
        workspace,
    };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/lib/workspaceExport.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 6: Wire it into Settings**

In `src/components/ui/SettingsModal.tsx`, add to the imports:

```typescript
import { buildWorkspaceExport } from '@/lib/workspaceExport';
import { createClient } from '@/lib/supabase/client';
```

and add `WORKSPACE_SCHEMA_VERSION` to the store import added in Task 9 Step 4.

Add the signed-in account beside the other state (the delete flow in Task 11 uses the same value):

```typescript
    const [account, setAccount] = useState<{ id: string; email?: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        createClient().auth.getUser().then(({ data }) => {
            if (cancelled || !data.user) return;
            setAccount({ id: data.user.id, email: data.user.email ?? undefined });
        });
        return () => { cancelled = true; };
    }, []);
```

Add `useEffect` to the React import on line 3:

```typescript
import React, { useEffect, useId, useState } from 'react';
```

Replace `handleDownloadBackup` in full — it now reads the live store instead of localStorage, so it can never be stale and can never silently do nothing:

```typescript
    const handleDownloadBackup = () => {
        const workspace = partializeWorkspace(useWorkspaceStore.getState()) as Record<string, unknown>;
        const payload = buildWorkspaceExport(workspace, {
            schemaVersion: WORKSPACE_SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            userId: account?.id,
            email: account?.email,
        });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lorecanvas-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setBackupMsg('Downloaded everything in your workspace.');
        setTimeout(() => setBackupMsg(''), 3000);
    };
```

Rename the button at `SettingsModal.tsx:258` so it says what it does:

```tsx
                            <button type="button" onClick={handleDownloadBackup} className={styles.presetBtn}>
                                Download everything (.json)
                            </button>
```

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit --pretty false && npx vitest run && npx eslint src
```

Expected: all clean.

- [ ] **Step 8: Human — open the file**

Sign in, write something, open Settings, press **Download everything (.json)**. Open the downloaded file and confirm:

1. `format` is `lorecanvas-workspace-export`, `exportedAt` is now, `schemaVersion` is `4`.
2. `account.email` is your address.
3. `contents` lists every persisted key, and `workspace` contains the thing you just wrote.
4. `notIncluded` is present and readable.

- [ ] **Step 9: Commit**

```bash
git add src/lib/workspaceExport.ts src/lib/workspaceExport.test.ts src/store/workspaceStore.ts src/components/ui/SettingsModal.tsx
git commit -m "feat: export the whole workspace as one honest JSON file

The old Download backup button read localStorage directly, so it could be
a persist-debounce stale and produced nothing at all when the key was
missing. It now serialises the live store through partializeWorkspace and
wraps it in an envelope that states the format, the account, what is in
the file and what is not."
```

---

## Task 11: Delete the account (`O2`, second half)

**Files:**
- Create: `supabase/migrations/20260903120300_delete_own_account.sql`
- Modify: `src/components/ui/SettingsModal.tsx`

**This action is irreversible and there is no recovery path.** Design it accordingly.

**Why an RPC and not an API route.** Removing a GoTrue user needs privileges the browser will never have. The two options are a server route holding `SUPABASE_SERVICE_ROLE_KEY`, or a `SECURITY DEFINER` Postgres function that can only ever delete *its own caller*. The function wins: Phase 2 and Phase 3 left `src/app/api/` with a single route, and a service-role key in the deployment is a far larger thing to get wrong than a function whose entire body is `delete from auth.users where id = auth.uid()`.

**What actually gets deleted.** Verified against the live database: `workspaces_user_id_fkey` is `ON DELETE CASCADE`, so the workspace row goes with the user and needs no second statement. `beta_feedback_user_id_fkey` is `ON DELETE SET NULL`, so submitted feedback survives with no owner attached. Both facts are stated to the user in the confirmation.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260903120300_delete_own_account.sql`:

```sql
-- Account deletion. Table stakes for a paid product and a legal requirement in
-- several jurisdictions.
--
-- SECURITY DEFINER because removing a row from auth.users needs privileges the
-- browser will never hold. The function is safe to expose because it takes no
-- arguments and can only ever act on auth.uid() — its own caller. There is no
-- parameter to point it at somebody else.
--
-- Deliberately NOT deleting from public.workspaces here: workspaces_user_id_fkey
-- is ON DELETE CASCADE, so the row goes with the user. A second delete would be
-- a lie about where the guarantee lives.
--
-- public.beta_feedback.user_id is ON DELETE SET NULL, so feedback text survives
-- with the account detached. The UI says so before the user confirms.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'Not signed in.' using errcode = 'PT401';
    end if;

    delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
```

- [ ] **Step 2: Human — apply it**

1. Open `https://supabase.com/dashboard/project/cchsmijjxzoaoivzbnsg/sql/new`
2. Paste the whole file.
3. Press **Run**. Expected: `Success. No rows returned`.

Confirm the grants landed, in a new query:

```sql
select p.proname, p.prosecdef, r.rolname, has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (select unnest(array['anon','authenticated']) as rolname) r
where n.nspname = 'public' and p.proname = 'delete_own_account';
```

Expected: `prosecdef` is `true`, `anon` → `false`, `authenticated` → `true`. **If `anon` can execute it, stop** — the revoke did not apply.

- [ ] **Step 3: Build the danger zone**

In `src/components/ui/SettingsModal.tsx`, add the state and handler beside the others:

```typescript
    const [deleteInput, setDeleteInput] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const canDelete = !!account?.email && deleteInput.trim() === account.email;

    const handleDeleteAccount = async () => {
        if (!canDelete || isDeleting) return;
        setIsDeleting(true);
        setDeleteError('');

        const supabase = createClient();
        const { error } = await supabase.rpc('delete_own_account');
        if (error) {
            setDeleteError('Your account was not deleted. Nothing has changed — please try again.');
            setIsDeleting(false);
            return;
        }

        // The account is gone. Clear this device before the redirect, or the
        // next person to open this browser rehydrates a deleted user's work.
        try {
            localStorage.removeItem('lorecanvas-workspace');
            Object.keys(localStorage)
                .filter(k => k.startsWith('lorecanvas-backup-'))
                .forEach(k => localStorage.removeItem(k));
        } catch {
            // localStorage unavailable — the sign-out below still ends the session.
        }
        await supabase.auth.signOut();
        window.location.href = '/welcome';
    };
```

**Note for the implementer:** if Phase 3 landed a `resetWorkspace()` store action, call it immediately before `supabase.auth.signOut()` as well. The key sweep above is correct with or without it, so this task does not depend on that name existing.

- [ ] **Step 4: Add the section**

Add this as the **last** section in the modal's `content` div, after `Backup &amp; Restore`:

```tsx
                    {account && (
                        <section className={styles.section} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--accent)' }}>
                            <div className={styles.providerHeader}>
                                <h3>Delete your account</h3>
                            </div>
                            <p style={{ margin: '0 0 0.6rem', fontSize: '0.88rem' }}>
                                This removes, permanently and immediately:
                            </p>
                            <ul style={{ margin: '0 0 0.8rem', paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
                                <li>your sign-in — <strong>{account.email}</strong> will no longer work</li>
                                <li>your cloud workspace — every world, project, document, scene and article stored on our servers</li>
                                <li>the copy in this browser</li>
                            </ul>
                            <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem' }}>
                                It does <strong>not</strong> remove copies in other browsers you
                                have signed in on (those clear when you next open them), files you
                                have already exported, or beta feedback you sent — that stays, with
                                your account detached from it.
                            </p>
                            <p style={{ margin: '0 0 0.8rem', fontSize: '0.85rem' }}>
                                There is no undo and no grace period.{' '}
                                <strong>Download everything first.</strong>
                            </p>
                            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem' }} htmlFor={`${fieldId}-delete`}>
                                Type <strong>{account.email}</strong> to confirm.
                            </label>
                            <input
                                id={`${fieldId}-delete`}
                                type="text"
                                value={deleteInput}
                                autoComplete="off"
                                onChange={(e) => setDeleteInput(e.target.value)}
                                style={{ width: '100%', padding: '0.4rem 0.5rem', marginBottom: '0.6rem' }}
                            />
                            <button
                                type="button"
                                className={styles.clearBtn}
                                disabled={!canDelete || isDeleting}
                                onClick={handleDeleteAccount}
                            >
                                {isDeleting ? 'Deleting…' : 'Delete my account permanently'}
                            </button>
                            {deleteError && (
                                <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: 'var(--accent)' }}>{deleteError}</p>
                            )}
                        </section>
                    )}
```

The section renders only when signed in, the button is disabled until the typed address matches exactly, and it disables again while the request is in flight so a double-click cannot fire twice.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit --pretty false && npx vitest run && npx eslint src && npm run build
```

Expected: all clean.

- [ ] **Step 6: Human — delete a throwaway account, end to end**

**Do not test this with your own account.** Create a second account first.

1. Sign in as the throwaway account and write one scene.
2. Open Settings. Confirm the danger zone appears and the button is **disabled**.
3. Type a near-miss of the email (wrong domain). Confirm the button stays disabled.
4. Press **Download everything (.json)** and keep the file.
5. Type the exact email. Confirm the button enables. Press it.
6. Expected: you land on `/welcome`, signed out.
7. Try to sign in as that address again. Expected: it does not work.
8. In the SQL editor, confirm both rows are gone:

```sql
select count(*) from auth.users where email = 'THROWAWAY@example.com';
select count(*) from public.workspaces w
  join auth.users u on u.id = w.user_id
  where u.email = 'THROWAWAY@example.com';
```

Expected: `0` and `0`. The second query proving `0` is the cascade doing its job.

9. Reopen the app in the same browser. Expected: an empty workspace, not the deleted account's scene.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260903120300_delete_own_account.sql src/components/ui/SettingsModal.tsx
git commit -m "feat: account deletion behind a typed confirmation

A SECURITY DEFINER function that takes no arguments and can only delete
auth.uid(), so there is no service-role key in the deployment and no
parameter to point at another account. workspaces cascades with the user;
beta_feedback is ON DELETE SET NULL and survives detached, which the
confirmation says out loud before you can type your address."
```

---

## Definition of done

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green, including 14 new `workspaceSize` tests, 6 new `workspaceExport` tests and 1 new `betaRequest` test
- [ ] `npx eslint src` clean
- [ ] `npm run build` succeeds
- [ ] `npm ci` runs no `postinstall`
- [ ] `npm audit --omit=dev` reports 0 vulnerabilities
- [ ] `node -e "console.log(Object.keys(require('./package-lock.json').packages).length)"` is around 200, down from 1185
- [ ] `git ls-files | grep -E "^(electron|scripts|bin)/"` returns nothing
- [ ] `grep -c '"main"' package.json` returns 0, and `package.json` has no top-level `build` object
- [ ] `grep -c "^\.beatCard {" src/components/editor/WritingDesk.module.css` returns 1, and the same for `^\.beatCardHeader {`
- [ ] `page.tsx` has no static `ExportModal` import; `npm run build` shows a smaller First Load JS for `/`
- [ ] `supabase/migrations/` contains five files, and each has been run once in the SQL editor
- [ ] `select policyname, roles, cmd from pg_policies where tablename='workspaces'` returns exactly the one pre-existing policy — **no RLS was added or changed by this phase**
- [ ] `anon` no longer holds `SELECT` on `public.workspaces`; advisor lint 0026 is gone and 0027 remains, accepted
- [ ] Leaked-password protection is on; that advisor lint is gone
- [ ] A fourth beta request from one browser inside an hour shows the throttled copy, not the error copy
- [ ] The warn and blocked banners both appear when the limits are lowered, and the constants are back at 4 MB / 8 MB afterwards
- [ ] "Download everything (.json)" produces a file with `format`, `account`, `contents`, `notIncluded` and the live workspace
- [ ] A throwaway account can be deleted, cannot sign in afterwards, leaves no `workspaces` row, and leaves the browser empty

---

## Pre-launch checklist — run once, by a human, on the day

Everything above is code and migrations. These are the things that live only in a dashboard, revert silently on a project restore, and are nobody's file.

- [ ] **Supabase → Authentication → Providers → Email:** *Prevent use of leaked passwords* is **on**. Date enabled: ______
- [ ] **Supabase → Authentication → Providers:** signup is **disabled** for the invite-only beta, so the shared sign-in helper cannot be contradicted by the server setting
- [ ] **Supabase → Advisors → Security:** the only remaining WARN is `pg_graphql_authenticated_table_exposed` on `public.workspaces`, which is accepted by design and documented in `20260903120100_workspaces_revoke_anon.sql`
- [ ] **Supabase → Database → Backups:** point-in-time recovery or daily backups are on. Account deletion is irreversible by design; an operator mistake should not be
- [ ] `anon` holds no `SELECT` on `public.workspaces` — re-check after any dashboard schema edit, because the editor re-grants on some operations
- [ ] The deployment's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, and **`ALLOW_DEV_LOGIN` and `DEV_LOGIN_PASSWORD` are not set anywhere** in the hosting provider's environment
- [ ] A magic link sent from the production hostname lands back on that same hostname signed in
- [ ] `beta_requests` has fewer than 60 rows in the last hour and the throttle trigger `beta_requests_throttle_trg` is attached: `select tgname from pg_trigger where tgrelid = 'public.beta_requests'::regclass and not tgisinternal;`
- [ ] All five migration files in `supabase/migrations/` have been run against production, and running them again is a no-op
- [ ] Delete the throwaway account used in Task 11 Step 6, if it was recreated
