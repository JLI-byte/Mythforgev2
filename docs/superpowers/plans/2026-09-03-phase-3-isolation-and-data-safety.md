# Phase 3 — Isolation and Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop LoreCanvas destroying one writer's work with another's, stop it losing work silently when the browser is full, and make sign-in work on a host other than the developer's laptop.

**Architecture:** Every decision that can destroy data is pushed down into a pure leaf module in `src/lib/` with its own `.test.ts`, and the store, the sync hook, the proxy and the auth routes become thin wiring over those decisions. Ownership is the spine: a persisted workspace carries the Supabase user id it belongs to, nothing reaches the cloud unless the state in hand is stamped for the signed-in user, and both the workspace key and every `lorecanvas-backup-*` key are swept when the owner changes. Each task ends with a green `tsc` and a green `vitest`, so the build is never broken across more than one task.

**Tech Stack:** TypeScript (strict), React 19, Next 16 (proxy, not middleware — `src/proxy.ts`), Zustand 5 with `persist`, Supabase (`@supabase/ssr`), Vitest (jsdom), JSZip, docx.

**Spec:** `../specs/2026-09-03-saas-conversion-design.md` Part 3a–3f. Parts 3g–3i are Phase 10 and are **not** in this plan.

**Depends on:** Phases 1 and 2. This plan assumes one work type (`story`), no `chatHistories`, no `aiSettings*`, no research chat, and no `src/app/api/*` except `dev-login`.

---

## Read this before writing any code

Four things were checked against the codebase while writing this plan, and the roadmap is wrong or incomplete about three of them.

### 1. A new CRITICAL defect, not in the roadmap: restoring an automatic backup empties the workspace

`restoreDataBackup` (`src/store/workspaceStore.ts:2733`) writes a backup blob straight into the persist key:

```typescript
localStorage.setItem('lorecanvas-workspace', raw);
```

Zustand's `migrate` hook receives the **bare state**, not the `{ state, version }` envelope. The automatic backup at `src/store/workspaceStore.ts:2685` therefore stores a bare state object:

```typescript
const backupData = { ...persistedState };
localStorage.setItem(backupKey, JSON.stringify(backupData));
```

Verified by probe against zustand 5 + this exact persist config: writing a bare state object into the persist key and reloading produces `projects: []`, `scenes: []` — the whole workspace gone. **Clicking "Restore" on an automatic backup destroys the workspace it was supposed to protect.** Manual backups (`createManualBackup`) copy the whole envelope and restore correctly, so the bug only bites the backups the app took on the user's behalf.

Task 6 fixes it. It is sequenced immediately after the T1/T2 group because it is the same class of defect and the same surface.

### 2. `npx eslint src` is **not** clean today and cannot be a gate

Baseline on the current tree: **377 problems (248 errors, 129 warnings)**, including 6 pre-existing `no-explicit-any` errors inside `src/store/workspaceStore.ts` itself (lines 158, 341, 2595, 2603, 2608, 2682). The Phase 2 plan's "Definition of done: `npx eslint src` clean" is unachievable and must not be copied here. This plan gates on **no new eslint problems in the files it touches**, checked file-by-file.

### 3. The proxy's unauthenticated redirect goes to `/welcome`, not `/login`

The spec says "fail closed — redirect to `/login`". `src/proxy.ts:69` actually sends unauthenticated visitors to `/welcome`. Failing closed to `/login` would be inconsistent with every other unauthenticated path. Task 12 fails closed to `/welcome`, matching the code. It also **excludes public paths from the fail-closed redirect** — the spec does not mention this, and without it a Supabase outage makes `/welcome` redirect to `/welcome` forever, locking every visitor out of the page that would let them back in.

### 4. `x-forwarded-host` is attacker-controllable

Task 9 makes the auth callback derive its redirect base from the request, per the spec. That header is client-supplied unless a trusted proxy overwrites it (Vercel and every mainstream platform do). The task therefore prefers an explicit `NEXT_PUBLIC_SITE_URL` when one is configured and falls back to the forwarded headers, so a deployment can close the vector by configuration rather than by trusting a header. The existing open-redirect guard on `next` is preserved verbatim and gains a test.

### Line numbers

Every line number in this plan was read from the current tree, **before Phases 1 and 2 land**. Those phases delete thousands of lines, so **anchor edits on the quoted symbol names and code, not on the numbers.** The numbers are given so the right region is easy to find.

---

## What is already correct, and must not be "fixed"

| Fact | Evidence |
|------|----------|
| `resolveWorkspaceConflict` is sound | `src/lib/workspaceConflict.ts` — ties keep local, empty never wins, content stamps compared like with like. 430 tests green on the current tree |
| `useLoginForm` gates signup correctly | `src/app/login/useLoginForm.ts:45` — `shouldCreateUser: false`. It is `LoginModal` and OAuth that do not |
| The `next` open-redirect guard is correct | `src/app/auth/callback/route.ts:22` — rejects `//evil.com` and absolute URLs |
| `dev-login` is 404 in production today | `src/app/api/dev-login/route.ts:14` — the risk is one env var, not a live hole |
| Manual backups restore correctly | `createManualBackup` copies the `{ state, version }` envelope |

---

## File Structure

**Created:**

| Path | Why |
|------|-----|
| `src/lib/workspaceOwner.ts` | Ownership + localStorage sweep + backup blob shape. Leaf module |
| `src/lib/workspaceOwner.test.ts` | |
| `src/lib/syncGate.ts` | The "may this state reach the cloud?" decision. Leaf module |
| `src/lib/syncGate.test.ts` | |
| `src/lib/persistQuota.ts` | Local-save failure classification and wording. Leaf module |
| `src/lib/persistQuota.test.ts` | |
| `src/lib/authRedirect.ts` | Redirect base + `next` path guard. Leaf module |
| `src/lib/authRedirect.test.ts` | |
| `src/lib/authPolicy.ts` | The invite policy, expressed once. Leaf module |
| `src/lib/authPolicy.test.ts` | |
| `src/lib/proxyPaths.ts` | Which paths are public. Leaf module |
| `src/lib/proxyPaths.test.ts` | |
| `src/lib/supabase/signIn.ts` | One sign-in helper for every surface |
| `src/lib/supabase/workspaceSync.test.ts` | Guarded-write tests (mocked Supabase client) |
| `src/lib/export.test.ts` | `.docx` opens |
| `src/components/ui/PersistQuotaBanner.tsx` | The local-save failure banner |
| `src/components/ui/PersistQuotaBanner.module.css` | |
| `src/store/workspaceOwnership.test.ts` | `ownerUserId` / `claimWorkspace` / `resetWorkspace` |

**Modified:**

| Path | Change |
|------|--------|
| `src/store/workspaceStore.ts` | `ownerUserId` + `persistError` state; `claimWorkspace`, `resetWorkspace`, `setPersistError` actions; `partializeWorkspace` stamps the owner; persist storage rewritten so the debounce sits above `JSON.stringify`; `listDataBackups` filters by owner; `restoreDataBackup` normalises the blob shape and cancels the pending write; World Bible actions stamp `updatedAt` |
| `src/lib/supabase/useSupabaseSync.ts` | Discards a foreign workspace before the cloud read; claims after; `hydrationOkRef` moved below the ownership decision; saves go through `shouldSaveToCloud` and the guarded write |
| `src/lib/supabase/workspaceSync.ts` | `saveWorkspace` becomes a guarded conditional write returning a `SaveResult` |
| `src/lib/workspaceConflict.ts` | `newestContentTime` also reads `worldBibles[*].updatedAt` |
| `src/lib/workspaceConflict.test.ts` | Coverage for the above |
| `src/lib/epub.test.ts` | Binary-level "this actually opens" assertions |
| `src/lib/export.ts` | `buildDocxDocument` split out of `exportAsDocx` so the output can be opened in a test |
| `src/components/navigation/ModeBar.tsx` | `handleSignOut` resets the workspace before redirecting |
| `src/components/providers/SupabaseSyncProvider.tsx` | Resets on `SIGNED_OUT` |
| `src/components/ui/SettingsModal.tsx` | `listDataBackups` gets the current user id |
| `src/components/ui/LoginModal.tsx` | Uses the shared sign-in helper |
| `src/app/login/useLoginForm.ts` | Uses the shared sign-in helper; `NEXT_PUBLIC_ALLOW_DEV_LOGIN` deleted |
| `src/app/auth/callback/route.ts` | Redirect base derived from the request |
| `src/app/api/dev-login/route.ts` | `ALLOW_DEV_LOGIN` deleted |
| `src/proxy.ts` | Fails closed; public paths from the shared leaf module |
| `src/app/page.tsx` | Mounts `PersistQuotaBanner` |
| `.env.example` | Documents `NEXT_PUBLIC_SITE_URL` |

**Deleted:** nothing. Phase 3 adds guards; Phases 1 and 2 did the deleting.

---

## Task 1: The ownership leaf module

**Files:**
- Create: `src/lib/workspaceOwner.ts`
- Create: `src/lib/workspaceOwner.test.ts`

Pure functions only. Nothing is wired up in this task, so the build cannot break.

- [ ] **Step 1: Write the failing test**

Create `src/lib/workspaceOwner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
    BACKUP_KEY_PREFIX,
    WORKSPACE_STORAGE_KEY,
    claimBackup,
    isForeignWorkspace,
    ownedStorageKeys,
    readBackupOwner,
} from './workspaceOwner';

describe('isForeignWorkspace', () => {
    it('is true when the stamp names someone else', () => {
        expect(isForeignWorkspace('user-a', 'user-b')).toBe(true);
    });

    it('is false when the stamp names the signed-in user', () => {
        expect(isForeignWorkspace('user-a', 'user-a')).toBe(false);
    });

    it('adopts rather than discards an unstamped workspace', () => {
        expect(isForeignWorkspace(undefined, 'user-a')).toBe(false);
        expect(isForeignWorkspace(null, 'user-a')).toBe(false);
        expect(isForeignWorkspace('', 'user-a')).toBe(false);
    });

    it('never discards when nobody is signed in', () => {
        expect(isForeignWorkspace('user-a', '')).toBe(false);
    });
});

describe('ownedStorageKeys', () => {
    it('picks the workspace and every backup, and nothing else', () => {
        const keys = [
            WORKSPACE_STORAGE_KEY,
            `${BACKUP_KEY_PREFIX}v3-1700000000000`,
            `${BACKUP_KEY_PREFIX}v4-1700000009999`,
            'lorecanvas-beta-feedback',
            'lc-theme',
            'sb-abcdef-auth-token',
        ];
        expect(ownedStorageKeys(keys)).toEqual([
            WORKSPACE_STORAGE_KEY,
            `${BACKUP_KEY_PREFIX}v3-1700000000000`,
            `${BACKUP_KEY_PREFIX}v4-1700000009999`,
        ]);
    });

    it('returns nothing for an empty browser', () => {
        expect(ownedStorageKeys([])).toEqual([]);
    });
});

describe('readBackupOwner', () => {
    it('reads the owner out of an enveloped backup', () => {
        const raw = JSON.stringify({ state: { ownerUserId: 'user-a', projects: [] }, version: 4 });
        expect(readBackupOwner(raw)).toBe('user-a');
    });

    it('reads the owner out of a bare-state backup', () => {
        const raw = JSON.stringify({ ownerUserId: 'user-b', projects: [] });
        expect(readBackupOwner(raw)).toBe('user-b');
    });

    it('returns null for an unowned or unreadable backup', () => {
        expect(readBackupOwner(JSON.stringify({ state: { projects: [] } }))).toBeNull();
        expect(readBackupOwner('not json at all')).toBeNull();
        expect(readBackupOwner(null)).toBeNull();
    });
});

describe('claimBackup', () => {
    it('stamps an unowned enveloped backup', () => {
        const raw = JSON.stringify({ state: { projects: [1] }, version: 4 });
        const out = claimBackup(raw, 'user-a');
        expect(out).not.toBeNull();
        expect(JSON.parse(out!)).toEqual({ state: { projects: [1], ownerUserId: 'user-a' }, version: 4 });
    });

    it('stamps an unowned bare-state backup without inventing an envelope', () => {
        const raw = JSON.stringify({ projects: [1] });
        const out = claimBackup(raw, 'user-a');
        expect(JSON.parse(out!)).toEqual({ projects: [1], ownerUserId: 'user-a' });
    });

    it('leaves an already-owned backup alone', () => {
        const raw = JSON.stringify({ state: { ownerUserId: 'user-b' }, version: 4 });
        expect(claimBackup(raw, 'user-a')).toBeNull();
    });

    it('refuses unreadable input and an empty user id', () => {
        expect(claimBackup('{{{', 'user-a')).toBeNull();
        expect(claimBackup(JSON.stringify({ projects: [] }), '')).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/workspaceOwner.test.ts`

Expected: FAIL — `Failed to resolve import "./workspaceOwner"`.

- [ ] **Step 3: Write the module**

Create `src/lib/workspaceOwner.ts`:

```typescript
/**
 * Workspace ownership and local-storage sweeping — LEAF MODULE (no store, no React).
 *
 * One browser, many writers. Everything LoreCanvas keeps in localStorage — the
 * workspace itself and every automatic or manual backup — has to be attributable
 * to exactly one account, or the next person to sign in inherits the last
 * person's manuscripts and their first autosave writes those manuscripts into
 * their own cloud row. The decisions live here as pure functions so they can be
 * tested without a browser and without the store.
 */

/** The zustand persist key. */
export const WORKSPACE_STORAGE_KEY = 'lorecanvas-workspace';

/** Every automatic and manual backup key starts with this. */
export const BACKUP_KEY_PREFIX = 'lorecanvas-backup-';

/**
 * True when persisted state is stamped for someone other than the signed-in
 * user. Unstamped state belongs to nobody yet — that is the pre-upgrade case,
 * and it is adopted rather than discarded, so no existing writer loses work the
 * day this ships.
 */
export function isForeignWorkspace(
    storedOwnerUserId: string | null | undefined,
    currentUserId: string,
): boolean {
    if (!storedOwnerUserId) return false;
    if (!currentUserId) return false;
    return storedOwnerUserId !== currentUserId;
}

/**
 * Every key LoreCanvas owns that can hold one account's work, given a snapshot
 * of the localStorage key list. Anything else in there — the landing theme
 * choice, the Supabase session — is not a manuscript and is left alone.
 */
export function ownedStorageKeys(allKeys: readonly string[]): string[] {
    return allKeys.filter(
        k => k === WORKSPACE_STORAGE_KEY || k.startsWith(BACKUP_KEY_PREFIX),
    );
}

/**
 * The owner stamped inside a backup blob, or null when it carries none.
 *
 * Two blob shapes exist in the wild: automatic backups written by the persist
 * `migrate` hook store the bare state object, while manual backups copy the
 * whole `{ state, version }` envelope. Both are read here.
 */
export function readBackupOwner(raw: string | null): string | null {
    if (!raw) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed as Record<string, unknown>;
    const state = (Object.prototype.hasOwnProperty.call(envelope, 'state')
        ? envelope.state
        : envelope) as Record<string, unknown> | null;
    if (!state || typeof state !== 'object') return null;
    const owner = state.ownerUserId;
    return typeof owner === 'string' && owner.length > 0 ? owner : null;
}

/**
 * Stamps an unowned backup with a user id, so backups taken before ownership
 * existed stay visible to the person who actually made them. Returns null when
 * the blob is unparseable or already owned — in both cases there is nothing to
 * write back.
 */
export function claimBackup(raw: string, userId: string): string | null {
    if (!userId) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed as Record<string, unknown>;
    const hasEnvelope = Object.prototype.hasOwnProperty.call(envelope, 'state');
    const state = (hasEnvelope ? envelope.state : envelope) as Record<string, unknown> | null;
    if (!state || typeof state !== 'object') return null;
    const owner = state.ownerUserId;
    if (typeof owner === 'string' && owner.length > 0) return null;
    const nextState = { ...state, ownerUserId: userId };
    return JSON.stringify(hasEnvelope ? { ...envelope, state: nextState } : nextState);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/workspaceOwner.test.ts`

Expected: PASS — 13 tests.

- [ ] **Step 5: Check the build and the linter**

```bash
npx tsc --noEmit --pretty false
npx eslint src/lib/workspaceOwner.ts src/lib/workspaceOwner.test.ts
```

Expected: no output from either.

- [ ] **Step 6: Commit**

```bash
git add src/lib/workspaceOwner.ts src/lib/workspaceOwner.test.ts
git commit -m "feat: pure ownership rules for the workspace and its backups

Nothing is wired up yet. This is the decision layer the next three tasks
sit on: is this persisted workspace somebody else's, which localStorage
keys belong to LoreCanvas, and who does a given backup blob belong to."
```

---

## Task 2: Stamp the owner into the store

**Files:**
- Modify: `src/store/workspaceStore.ts` — lines 2, 666, 949/1860, 1180, 1219, 1355
- Create: `src/store/workspaceOwnership.test.ts`

After this task `partializeWorkspace` writes `ownerUserId` and the store can reset itself, but nothing calls either yet. The build stays green.

- [ ] **Step 1: Write the failing test**

Create `src/store/workspaceOwnership.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { partializeWorkspace, useWorkspaceStore } from './workspaceStore';
import { BACKUP_KEY_PREFIX, WORKSPACE_STORAGE_KEY, readBackupOwner } from '@/lib/workspaceOwner';

describe('workspace ownership', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspaceStore.setState({
            ownerUserId: null,
            worlds: [],
            projects: [{ id: 'p1', name: 'Draft' } as never],
            entities: [{ id: 'e1', name: 'Mira', type: 'character' } as never],
            scenes: [],
            documents: [],
        });
    });

    it('persists the owner alongside the work', () => {
        useWorkspaceStore.setState({ ownerUserId: 'user-a' });
        const persisted = partializeWorkspace(useWorkspaceStore.getState());
        expect(persisted.ownerUserId).toBe('user-a');
    });

    it('claimWorkspace stamps the signed-in user', () => {
        useWorkspaceStore.getState().claimWorkspace('user-a');
        expect(useWorkspaceStore.getState().ownerUserId).toBe('user-a');
    });

    it('claimWorkspace ignores an empty user id', () => {
        useWorkspaceStore.getState().claimWorkspace('');
        expect(useWorkspaceStore.getState().ownerUserId).toBeNull();
    });

    it('claimWorkspace adopts backups that predate ownership', () => {
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v3-1700000000000`,
            JSON.stringify({ projects: [{ id: 'old' }] }));
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000009999`,
            JSON.stringify({ state: { ownerUserId: 'user-b' }, version: 4 }));

        useWorkspaceStore.getState().claimWorkspace('user-a');

        expect(readBackupOwner(localStorage.getItem(`${BACKUP_KEY_PREFIX}v3-1700000000000`)))
            .toBe('user-a');
        expect(readBackupOwner(localStorage.getItem(`${BACKUP_KEY_PREFIX}v4-1700000009999`)))
            .toBe('user-b');
    });

    it('resetWorkspace empties every content collection', () => {
        useWorkspaceStore.setState({ ownerUserId: 'user-a' });
        useWorkspaceStore.getState().resetWorkspace();
        const state = useWorkspaceStore.getState();
        expect(state.projects).toEqual([]);
        expect(state.entities).toEqual([]);
        expect(state.scenes).toEqual([]);
        expect(state.documents).toEqual([]);
        expect(state.ownerUserId).toBeNull();
    });

    it('resetWorkspace sweeps the workspace key and every backup, and nothing else', () => {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, '{"state":{},"version":4}');
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000000000`, '{}');
        localStorage.setItem('lorecanvas-beta-feedback', '[]');

        useWorkspaceStore.getState().resetWorkspace();

        expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
        expect(localStorage.getItem(`${BACKUP_KEY_PREFIX}v4-1700000000000`)).toBeNull();
        expect(localStorage.getItem('lorecanvas-beta-feedback')).toBe('[]');
    });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/store/workspaceOwnership.test.ts`

Expected: FAIL — the first failure is a type/runtime error on `ownerUserId`, and `useWorkspaceStore.getState().claimWorkspace is not a function`.

- [ ] **Step 3: Import the leaf module**

In `src/store/workspaceStore.ts`, immediately after the existing zustand imports at the top (line 2):

```typescript
import { BACKUP_KEY_PREFIX, claimBackup, ownedStorageKeys } from '@/lib/workspaceOwner';
```

- [ ] **Step 4: Add the state field and the two action signatures**

In the `WorkspaceState` interface, directly below the `_hasHydrated: boolean;` declaration (line 666):

```typescript

    /**
     * The Supabase user id this persisted workspace belongs to, stamped on the
     * first successful hydrate after sign-in. Persisted, so it survives a closed
     * tab, a crash or an expired session — which is the common case, and the one
     * a sign-out handler cannot cover.
     *
     * `null` means the blob predates ownership stamping. It is adopted by the
     * next signed-in user rather than discarded, so nobody loses work on upgrade.
     */
    ownerUserId: string | null;

    /** Stamp this workspace for a user, and adopt their unowned local backups. */
    claimWorkspace: (userId: string) => void;

    /**
     * Put every persisted field back to its initial value and delete the
     * workspace and backup keys. Called on sign-out, on SIGNED_OUT, and when a
     * different user signs in on a browser that still holds someone else's work.
     */
    resetWorkspace: () => void;
```

- [ ] **Step 5: Add the localStorage key snapshot helper**

`localStorage` is not iterable and mutating it while indexing it skips entries. Directly above `const PERSIST_DEBOUNCE_MS = 1200;` (line 1180):

```typescript
/**
 * The localStorage key list as a plain array. Taken as a snapshot because
 * removing keys while indexing the live object skips entries.
 */
function snapshotStorageKeys(): string[] {
    const keys: string[] = [];
    if (typeof localStorage === 'undefined') return keys;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k !== null) keys.push(k);
    }
    return keys;
}

```

- [ ] **Step 6: Persist the owner**

In `partializeWorkspace` (line 1219), make `ownerUserId` the first key of the returned object so it is obvious in a dumped blob:

```typescript
    return {
        ownerUserId: state.ownerUserId,
        worlds: state.worlds,
```

- [ ] **Step 7: Add the initial value**

In the initial state, directly below `_hasHydrated: false,` (line 1355):

```typescript
            ownerUserId: null,
```

- [ ] **Step 8: Give the store creator its `store` argument**

The reset restores the store's own initial state rather than a hand-maintained duplicate of 47 defaults. Change the creator signature (line 1310 region, the `(set, get) => ({` that opens the store body and is immediately followed by `worlds: [],`):

```typescript
        (set, get, store) => ({
            worlds: [],
```

- [ ] **Step 9: Implement the two actions**

Directly below the existing `setHasHydrated` implementation (lines 1860–1861):

```typescript

            claimWorkspace: (userId) => {
                if (!userId) return;
                set(() => ({ ownerUserId: userId }));
                // Backups taken before ownership existed carry no stamp, so
                // listDataBackups would hide them from the person who made them.
                if (typeof localStorage === 'undefined') return;
                for (const key of snapshotStorageKeys()) {
                    if (!key.startsWith(BACKUP_KEY_PREFIX)) continue;
                    const raw = localStorage.getItem(key);
                    if (raw === null) continue;
                    const claimed = claimBackup(raw, userId);
                    if (claimed === null) continue;
                    try {
                        localStorage.setItem(key, claimed);
                    } catch {
                        // Browser full — leaving the backup unowned is safe.
                    }
                }
            },

            resetWorkspace: () => {
                // The store's own initial state is the single source of truth for
                // "empty", so this cannot drift out of step with partialize.
                set(partializeWorkspace(store.getInitialState()));
                if (typeof localStorage === 'undefined') return;
                for (const key of ownedStorageKeys(snapshotStorageKeys())) {
                    localStorage.removeItem(key);
                }
            },
```

- [ ] **Step 10: Run the test and watch it pass**

Run: `npx vitest run src/store/workspaceOwnership.test.ts`

Expected: PASS — 6 tests.

- [ ] **Step 11: Full check**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src/store/workspaceStore.ts
```

Expected: no compiler output; every test PASS; eslint reports the **same 8 pre-existing problems** on `workspaceStore.ts` (6 `no-explicit-any` errors, 2 unused-var warnings) and nothing new.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: a persisted workspace knows which account it belongs to

partializeWorkspace now stamps ownerUserId, and the store can put itself
back to its own initial state and sweep the lorecanvas-workspace and
lorecanvas-backup-* keys. Unstamped blobs are adopted, not discarded, so
existing writers keep their work.

Nothing calls either action yet — the sync hook does that next."
```

---

## Task 3: Refuse to sync a workspace that is not the signed-in user's

**Files:**
- Create: `src/lib/syncGate.ts`, `src/lib/syncGate.test.ts`
- Modify: `src/lib/supabase/useSupabaseSync.ts`

This is the task that closes the CRITICAL leak. The hook currently sets `hydrationOkRef.current = true` at line 51, *before* it knows whose data it is holding, and the save subscriber at line 111 never looks at ownership at all.

- [ ] **Step 1: Write the failing test**

Create `src/lib/syncGate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { evaluateSaveGate, shouldSaveToCloud } from './syncGate';

const base = {
    hydrationOk: true,
    stateOwnerUserId: 'user-a',
    currentUserId: 'user-a',
    contentCount: 12,
};

describe('evaluateSaveGate', () => {
    it('allows a hydrated, owned, non-empty workspace', () => {
        expect(evaluateSaveGate(base)).toBe('ok');
    });

    it('blocks a workspace stamped for another user', () => {
        expect(evaluateSaveGate({ ...base, stateOwnerUserId: 'user-b' }))
            .toBe('foreign-or-unclaimed-state');
    });

    it('blocks an unclaimed workspace', () => {
        expect(evaluateSaveGate({ ...base, stateOwnerUserId: null }))
            .toBe('foreign-or-unclaimed-state');
    });

    it('blocks when nobody is signed in', () => {
        expect(evaluateSaveGate({ ...base, currentUserId: '' })).toBe('not-signed-in');
    });

    it('blocks an empty workspace when the cloud read never succeeded', () => {
        expect(evaluateSaveGate({ ...base, hydrationOk: false, contentCount: 0 }))
            .toBe('unhydrated-and-empty');
    });

    it('still allows real content through when the cloud read failed', () => {
        expect(evaluateSaveGate({ ...base, hydrationOk: false, contentCount: 3 })).toBe('ok');
    });
});

describe('shouldSaveToCloud', () => {
    it('is true only for ok', () => {
        expect(shouldSaveToCloud(base)).toBe(true);
        expect(shouldSaveToCloud({ ...base, stateOwnerUserId: 'user-b' })).toBe(false);
    });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/syncGate.test.ts`

Expected: FAIL — `Failed to resolve import "./syncGate"`.

- [ ] **Step 3: Write the module**

Create `src/lib/syncGate.ts`:

```typescript
/**
 * The cloud-save gate — LEAF MODULE (no store, no React, no network).
 *
 * Two different failures both end with one account's work in another account's
 * row, and both are decided here rather than inline in the sync hook:
 *
 *  - Saving before the cloud read succeeded, when local looks empty. A transient
 *    network failure then becomes a wiped account.
 *  - Saving state that is stamped for a different user, or for nobody yet. That
 *    is the sign-out leak, and it must never reach the network.
 *
 * Unclaimed state is blocked as firmly as foreign state. The hook claims the
 * workspace the moment it has settled ownership, so "unclaimed" only ever means
 * "we have not finished working out whose this is".
 */

export interface SaveGateInput {
    /** True once the cloud row has been read AND ownership has been settled. */
    hydrationOk: boolean;
    /** The owner stamped on the state that is about to be saved. */
    stateOwnerUserId: string | null | undefined;
    /** The signed-in user. */
    currentUserId: string;
    /** Items across projects, documents, scenes and entities in that state. */
    contentCount: number;
}

export type SaveGateReason =
    | 'ok'
    | 'not-signed-in'
    | 'foreign-or-unclaimed-state'
    | 'unhydrated-and-empty';

/** Why this state may or may not be written to the cloud. */
export function evaluateSaveGate(input: SaveGateInput): SaveGateReason {
    if (!input.currentUserId) return 'not-signed-in';
    if (input.stateOwnerUserId !== input.currentUserId) return 'foreign-or-unclaimed-state';
    if (!input.hydrationOk && input.contentCount === 0) return 'unhydrated-and-empty';
    return 'ok';
}

export function shouldSaveToCloud(input: SaveGateInput): boolean {
    return evaluateSaveGate(input) === 'ok';
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/syncGate.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 5: Rewire the hydrate effect**

In `src/lib/supabase/useSupabaseSync.ts`, add to the imports at the top:

```typescript
import { isForeignWorkspace } from '@/lib/workspaceOwner';
import { shouldSaveToCloud } from '@/lib/syncGate';
```

Then replace the whole `async function hydrate()` body (lines 45–80) with:

```typescript
    async function hydrate() {
      if (!userId || userId.trim() === '') return;

      const claimWorkspace = useWorkspaceStore.getState().claimWorkspace;
      const resetWorkspace = useWorkspaceStore.getState().resetWorkspace;

      try {
        // LAYER 1 — the one that matters. Sign-out often never runs: a closed
        // tab, a crash, an expired session, or simply a second person opening
        // the same browser. Whatever is in localStorage is discarded here,
        // before a single byte of it can be read, merged or uploaded.
        const localOwner = useWorkspaceStore.getState().ownerUserId;
        if (isForeignWorkspace(localOwner, userId)) {
          logger.info('LoreCanvas Sync: persisted workspace belongs to another account — discarding');
          resetWorkspace();
        }

        const cloud = await loadWorkspace(userId);

        if (cloud && looksLikeWorkspace(cloud.data)) {
          const localState = useWorkspaceStore.getState() as Record<string, any>;
          const { takeCloud, reason } = resolveWorkspaceConflict(localState, cloud.data);

          if (takeCloud) {
            // Cloud blobs bypass zustand's persist migrate — apply schema
            // migrations here. Idempotent, so double-migration is harmless.
            useWorkspaceStore.setState(migrateWorkspaceSchema(cloud.data));
            logger.info(`LoreCanvas Sync: applied cloud workspace (${reason})`);
          } else {
            logger.info(
              `LoreCanvas Sync: keeping local workspace (${reason}) — ` +
              `local ${countContent(localState)} items @ ${new Date(newestContentTime(localState)).toISOString()}, ` +
              `cloud ${countContent(cloud.data)} items @ ${new Date(newestContentTime(cloud.data)).toISOString()}`,
            );
          }
        } else if (cloud) {
          logger.error('LoreCanvas Sync: cloud workspace failed validation — ignoring');
        }

        // Whatever is in the store now is this user's: either it came from
        // their cloud row, or it is local work that survived the ownership
        // check above. Claim it BEFORE marking hydration OK, so the save gate
        // can never see hydrated-but-unclaimed state.
        claimWorkspace(userId);
        hydrationOkRef.current = true;
      } catch (err) {
        // A hydration failure must not brick the session: without the finally
        // below, hasHydrated stays false and cloud saves stay disabled.
        // hydrationOkRef stays false, so the gate still blocks an empty save.
        logger.error('LoreCanvas Sync: cloud hydration failed — continuing with local data', err);
        claimWorkspace(userId);
      } finally {
        setHasHydrated(true);
        isInitialLoadRef.current = false;
      }
    }
```

Two things to understand before moving on:

- `claimWorkspace` fires a `set()`, which wakes the save subscriber. At that moment `isInitialLoadRef.current` is still `true` (it is cleared in the `finally`), so the subscriber returns immediately and no save is scheduled. That ordering is load-bearing — do not move `isInitialLoadRef.current = false` earlier.
- The catch branch also claims. A user whose network failed still owns the work they are about to do locally, and without the claim the gate would block every save for the rest of the session.

- [ ] **Step 6: Rewire the save subscriber**

Replace the emptiness guard inside `useWorkspaceStore.subscribe` (lines 114–120) with the gate:

```typescript
      // Never write state that is not provably this user's, and never let an
      // empty workspace reach the cloud when we could not read what is already
      // there — that is how a transient network failure wipes an account.
      const gate = {
        hydrationOk: hydrationOkRef.current,
        stateOwnerUserId: (state as unknown as { ownerUserId?: string | null }).ownerUserId,
        currentUserId: userId,
        contentCount: countContent(state as unknown as Record<string, unknown>),
      };
      if (!shouldSaveToCloud(gate)) {
        return;
      }
```

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src/lib/syncGate.ts src/lib/syncGate.test.ts src/lib/supabase/useSupabaseSync.ts
```

Expected: no compiler output; every test PASS. eslint on `useSupabaseSync.ts` reports only the pre-existing `no-explicit-any` on `Record<string, any>` that was already there — count the problems before and after if unsure:

```bash
git stash && npx eslint src/lib/supabase/useSupabaseSync.ts; git stash pop
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix: a second user on the same browser can no longer overwrite the first

The persist key is a static string, so signing in as user B on user A's
browser rehydrated A's manuscripts. B had no cloud row, so conflict
resolution never ran; hydration was already marked OK, so the next autosave
wrote A's manuscripts into B's row and destroyed B's work.

Three changes: the hydrate effect discards a workspace stamped for another
account before it reads anything, it claims the workspace for the signed-in
user before marking hydration OK, and every save now passes through a gate
that refuses foreign or unclaimed state."
```

---

## Task 4: Clear on sign-out, clear on SIGNED_OUT, and stop offering one user's backups to another

**Files:**
- Modify: `src/components/navigation/ModeBar.tsx:48-51`
- Modify: `src/components/providers/SupabaseSyncProvider.tsx:33-39`
- Modify: `src/store/workspaceStore.ts` — `listDataBackups` (line 2712)
- Modify: `src/components/ui/SettingsModal.tsx:48,54`

Layers 2 and 3. Layer 1 already holds without them; these close the window between sign-out and the next sign-in, when a curious person could open Settings and read the previous user's backups.

- [ ] **Step 1: Write the failing test**

Append to `src/store/workspaceOwnership.test.ts`:

```typescript
import { listDataBackups } from './workspaceStore';

describe('listDataBackups', () => {
    beforeEach(() => localStorage.clear());

    it('offers only the signed-in user their own backups', () => {
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000000000`,
            JSON.stringify({ state: { ownerUserId: 'user-a' }, version: 4 }));
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000009999`,
            JSON.stringify({ state: { ownerUserId: 'user-b' }, version: 4 }));

        const keys = listDataBackups('user-a').map(b => b.key);
        expect(keys).toEqual([`${BACKUP_KEY_PREFIX}v4-1700000000000`]);
    });

    it('hides unowned backups rather than offering them to whoever is here now', () => {
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v3-1700000000000`, JSON.stringify({ projects: [] }));
        expect(listDataBackups('user-a')).toEqual([]);
    });

    it('offers nothing at all when nobody is signed in', () => {
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000000000`,
            JSON.stringify({ state: { ownerUserId: 'user-a' }, version: 4 }));
        expect(listDataBackups('')).toEqual([]);
    });

    it('still sorts newest first', () => {
        const owned = (t: number) => JSON.stringify({ state: { ownerUserId: 'user-a' }, version: 4 });
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000000000`, owned(1));
        localStorage.setItem(`${BACKUP_KEY_PREFIX}v4-1700000009999`, owned(2));
        expect(listDataBackups('user-a').map(b => b.timestamp))
            .toEqual([1700000009999, 1700000000000]);
    });
});
```

Add `readBackupOwner` is already imported at the top of the file from Task 2; no new import is needed except `listDataBackups`, which goes on the existing `./workspaceStore` import line.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/store/workspaceOwnership.test.ts`

Expected: FAIL — `Expected 1 arguments, but got 0` at build time, and at runtime the unowned backup is returned instead of hidden.

- [ ] **Step 3: Filter `listDataBackups` by owner**

In `src/store/workspaceStore.ts`, add `readBackupOwner` to the `@/lib/workspaceOwner` import added in Task 2, then replace `listDataBackups` (line 2712) with:

```typescript
/**
 * The signed-in user's backup snapshots, newest first.
 *
 * Backups are stamped with their owner (see `claimWorkspace`). An unstamped
 * backup is hidden rather than offered: on a shared browser, "restore" on
 * somebody else's snapshot is a one-click way to take their manuscripts.
 */
export function listDataBackups(
    ownerUserId: string | null,
): { key: string; timestamp: number; version: number }[] {
    const backups: { key: string; timestamp: number; version: number }[] = [];
    if (typeof localStorage === 'undefined') return [];
    if (!ownerUserId) return [];
    for (const k of snapshotStorageKeys()) {
        if (!k.startsWith(BACKUP_KEY_PREFIX)) continue;
        if (readBackupOwner(localStorage.getItem(k)) !== ownerUserId) continue;
        // Key format: lorecanvas-backup-v{version}-{timestamp}
        const parts = k.replace(BACKUP_KEY_PREFIX, '').split('-');
        const versionStr = parts[0].replace('v', '');
        const version = parseInt(versionStr) || 0;
        const timestamp = parseInt(parts[1]) || 0;
        backups.push({ key: k, timestamp, version });
    }
    return backups.sort((a, b) => b.timestamp - a.timestamp);
}
```

- [ ] **Step 4: Pass the owner in from Settings**

In `src/components/ui/SettingsModal.tsx`, add the owner to the selectors near the others (around line 40):

```typescript
    const ownerUserId = useWorkspaceStore(s => s.ownerUserId);
```

then change line 48 and the call inside `handleCreateBackup` (line 54):

```typescript
    const [backups, setBackups] = useState(() => listDataBackups(ownerUserId));
```

```typescript
        setBackups(listDataBackups(ownerUserId));
```

- [ ] **Step 5: Reset on sign-out**

In `src/components/navigation/ModeBar.tsx`, replace `handleSignOut` (lines 48–51):

```typescript
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Layer 2. The store reset also sweeps lorecanvas-workspace and every
    // lorecanvas-backup-* key, so nothing of this account is left on the
    // machine for whoever sits down next.
    useWorkspaceStore.getState().resetWorkspace();
    window.location.href = '/login';
  };
```

`useWorkspaceStore` is already imported at `src/components/navigation/ModeBar.tsx:6`.

- [ ] **Step 6: Reset on SIGNED_OUT**

In `src/components/providers/SupabaseSyncProvider.tsx`, replace the `onAuthStateChange` handler (lines 33–39):

```typescript
    // Listen for auth state changes (e.g. login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
      // Layer 3. Covers the sign-outs that never go through the profile menu:
      // an expired refresh token, a revoked session, a sign-out in another tab.
      if (event === 'SIGNED_OUT') {
        useWorkspaceStore.getState().resetWorkspace();
      }
    });
```

and add the store import at the top of the file:

```typescript
import { useWorkspaceStore } from '@/store/workspaceStore';
```

- [ ] **Step 7: Run the tests and watch them pass**

```bash
npx vitest run src/store/workspaceOwnership.test.ts
npx tsc --noEmit --pretty false
npx vitest run
```

Expected: 10 tests PASS in the ownership suite; no compiler output; the whole suite green.

- [ ] **Step 8: Manual verification — this is the one that matters**

With the dev server running (`npm run dev`, port 4000):

1. Sign in as user A. Create a project and a scene with recognisable text.
2. Open Settings and note the backup list.
3. Sign out via the profile menu. In DevTools → Application → Local Storage, confirm `lorecanvas-workspace` and every `lorecanvas-backup-*` key are **gone**.
4. Sign in as user B. Home shows an **empty** workspace. Settings shows **no** backups.
5. Sign out. Sign back in as A. A's project is back, from the cloud.
6. Now the case sign-out cannot cover: sign in as A, create work, then **without signing out** clear only the Supabase auth cookie/session and sign in as B. B still gets an empty workspace, because layer 1 fires on the persisted `ownerUserId`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "fix: sign-out clears the workspace and the backups it left behind

Layer 2 (the profile menu's Sign Out) and layer 3 (the SIGNED_OUT auth
event) both call resetWorkspace, which sweeps lorecanvas-workspace and
every lorecanvas-backup-* key. listDataBackups now takes the signed-in
user and shows only backups stamped for them, so Settings can no longer
offer one writer a one-click restore of another writer's manuscripts."
```

---

## Task 5: Automatic backups restore as an empty workspace — ALREADY DONE

**Status: shipped before Phase 1, in commit 83da32d.** The fix is
`src/lib/backupEnvelope.ts` (`normaliseBackupPayload`), wired into
`restoreDataBackup`, with 11 tests in `backupEnvelope.test.ts`. It differs from
the design below in one way, deliberately: the version comes from the backup
key (`lorecanvas-backup-v{n}-{ts}`) rather than being passed in, so the
migration chain replays from the version the snapshot was actually taken at.
Skip this task.

## Original design (superseded)

**Files:**
- Modify: `src/lib/workspaceOwner.ts`, `src/lib/workspaceOwner.test.ts`
- Modify: `src/store/workspaceStore.ts` — `restoreDataBackup` (line 2733), the `migrate` backup (line 2685)

**Not in the roadmap. Found while verifying it.** See "Read this before writing any code", item 1. Zustand's `migrate` receives the bare state, so every automatic backup is stored without the `{ state, version }` envelope, and restoring one writes a shape zustand cannot read — the workspace comes back empty. Manual backups are fine.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/workspaceOwner.test.ts` (add `normalizeBackupPayload` to the existing import from `./workspaceOwner`):

```typescript
describe('normalizeBackupPayload', () => {
    it('wraps a bare-state backup in the envelope zustand expects', () => {
        const raw = JSON.stringify({ projects: [{ id: 'p1' }] });
        expect(JSON.parse(normalizeBackupPayload(raw, 3)!))
            .toEqual({ state: { projects: [{ id: 'p1' }] }, version: 3 });
    });

    it('leaves an already-enveloped backup alone', () => {
        const raw = JSON.stringify({ state: { projects: [] }, version: 4 });
        expect(JSON.parse(normalizeBackupPayload(raw, 3)!))
            .toEqual({ state: { projects: [] }, version: 4 });
    });

    it('fills in the version when the envelope has none', () => {
        const raw = JSON.stringify({ state: { projects: [] } });
        expect(JSON.parse(normalizeBackupPayload(raw, 2)!))
            .toEqual({ state: { projects: [] }, version: 2 });
    });

    it('refuses a blob it cannot read', () => {
        expect(normalizeBackupPayload('not json', 4)).toBeNull();
        expect(normalizeBackupPayload(JSON.stringify({ state: 'nope' }), 4)).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/workspaceOwner.test.ts`

Expected: FAIL — `normalizeBackupPayload is not a function` (and a TS error on the import).

- [ ] **Step 3: Add the normaliser**

Append to `src/lib/workspaceOwner.ts`:

```typescript

/**
 * Puts a backup blob into the `{ state, version }` envelope zustand's persist
 * layer reads.
 *
 * Automatic backups are written from inside the persist `migrate` hook, which
 * receives the bare state object rather than the envelope. Writing one of those
 * straight back into the persist key gives zustand a blob with no `state`
 * property, and the workspace rehydrates completely empty — the restore button
 * destroys the work it was there to protect. Manual backups already carry the
 * envelope and pass through unchanged.
 *
 * `fallbackVersion` is the schema version parsed out of the backup key.
 */
export function normalizeBackupPayload(raw: string, fallbackVersion: number): string | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(envelope, 'state')) {
        const state = envelope.state;
        if (!state || typeof state !== 'object') return null;
        return JSON.stringify({
            state,
            version: typeof envelope.version === 'number' ? envelope.version : fallbackVersion,
        });
    }
    return JSON.stringify({ state: envelope, version: fallbackVersion });
}
```

- [ ] **Step 4: Use it in the restore path**

In `src/store/workspaceStore.ts`, add `normalizeBackupPayload` and `WORKSPACE_STORAGE_KEY` to the `@/lib/workspaceOwner` import, then replace `restoreDataBackup` (line 2733):

```typescript
/**
 * Restores a specific backup by key, replacing the current workspace data.
 * Returns true on success, false on failure.
 * After calling this, the page must be reloaded for changes to take effect.
 */
export function restoreDataBackup(backupKey: string): boolean {
    try {
        const raw = localStorage.getItem(backupKey);
        if (!raw) return false;
        // Automatic backups are bare state; manual ones carry the envelope.
        // Both have to land in the persist key as an envelope.
        const version = parseInt(backupKey.replace(BACKUP_KEY_PREFIX, '').split('-')[0].replace('v', '')) || 0;
        const payload = normalizeBackupPayload(raw, version);
        if (payload === null) {
            logger.error('LoreCanvas: backup is unreadable, refusing to restore', backupKey);
            return false;
        }
        localStorage.setItem(WORKSPACE_STORAGE_KEY, payload);
        return true;
    } catch (e) {
        logger.error('LoreCanvas: restore failed', e);
        return false;
    }
}
```

- [ ] **Step 5: Stop writing bare-state backups in the first place**

In the persist `migrate` hook (line 2685), replace the backup write so new automatic backups carry the envelope:

```typescript
                    const backupKey = `${BACKUP_KEY_PREFIX}v${fromVersion}-${Date.now()}`;
                    // Store the envelope, not the bare state: restoreDataBackup
                    // writes this straight back into the persist key.
                    localStorage.setItem(backupKey, JSON.stringify({
                        state: { ...persistedState },
                        version: fromVersion,
                    }));
                    // Keep only the 5 most recent backups — prune older ones
                    const backupKeys = snapshotStorageKeys()
                        .filter(k => k.startsWith(BACKUP_KEY_PREFIX))
                        .sort();
```

- [ ] **Step 6: Run the tests and watch them pass**

```bash
npx vitest run src/lib/workspaceOwner.test.ts
npx tsc --noEmit --pretty false
npx vitest run
```

Expected: 17 tests PASS in `workspaceOwner`; no compiler output; the whole suite green.

- [ ] **Step 7: Manual verification**

1. In DevTools, hand-write a bare-state backup key:
   `localStorage.setItem('lorecanvas-backup-v4-' + Date.now(), JSON.stringify({ ownerUserId: <your user id>, projects: [{id:'x',name:'Recovered',writingMode:'novel',coverColor:'#888',createdAt:new Date().toISOString()}], scenes: [], documents: [], entities: [] }))`
2. Open Settings → Restore that backup → confirm the reload shows the "Recovered" project rather than an empty workspace.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix: restoring an automatic backup no longer empties the workspace

zustand's persist migrate hook receives the bare state, not the
{ state, version } envelope, so every automatic backup was stored without
one. restoreDataBackup wrote that shape straight back into the persist key,
zustand found no .state, and the workspace rehydrated completely empty —
the restore button destroyed the work it existed to protect. Manual backups
were unaffected because they copy the whole envelope.

New automatic backups store the envelope; old bare ones are normalised on
the way back in, so existing backups become restorable rather than fatal."
```

---

## Task 6: Move the persist debounce above the `JSON.stringify`

**Files:**
- Modify: `src/store/workspaceStore.ts` — lines 1174–1200, and the `storage:` option at line 2651

`debouncedLocalStorage.setItem` receives an **already-serialised string**: `createJSONStorage` stringifies before it hands the value over. The debounce therefore only coalesces the `localStorage.setItem` call — a full-workspace `JSON.stringify` still runs on the main thread on every `set()`, which is every keystroke. Replacing `createJSONStorage` with a `PersistStorage` that takes the object moves the serialise inside the debounce.

There is no unit test for this: the observable behaviour is unchanged and the win is a profile, not an assertion. It is verified by the existing 430-test suite still passing (which exercises the persist path) plus a measurement in step 5.

- [ ] **Step 1: Change the zustand import**

`src/store/workspaceStore.ts` line 2:

```typescript
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
```

- [ ] **Step 2: Replace the debounced adapter**

Replace the whole block from `const PERSIST_DEBOUNCE_MS = 1200;` through the closing `};` of `debouncedLocalStorage` (lines 1180–1200) with:

```typescript
const DATE_ARRAY_KEYS = [
    'worlds', 'projects', 'documents', 'scenes',
    'entities', 'articleTemplates', 'earnedBadges',
    'sceneSnapshots', 'entitySnapshots',
];

/**
 * Rebuild native Date objects on the way in. Only arrays that actually contain
 * dated records are touched — writingDays and earnedBadges would be corrupted
 * by a blanket reviver. Hoisted out of createJSONStorage so the debounced
 * adapter can own the parse itself.
 */
function reviveDates(key: string, value: unknown): unknown {
    if (DATE_ARRAY_KEYS.includes(key) && Array.isArray(value)) {
        return value.map((item: Record<string, unknown>) => {
            if (typeof item !== 'object' || item === null) return item;
            return {
                ...item,
                ...(item.createdAt ? { createdAt: new Date(item.createdAt as string) } : {}),
                ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt as string) } : {}),
                ...(item.earnedAt  ? { earnedAt:  new Date(item.earnedAt  as string) } : {}),
            };
        });
    }
    return value;
}

// zustand widens the persisted generic to migrate()'s return type, so the
// storage adapter is typed against the raw blob, not the partialized shape.
type PersistedWorkspace = Record<string, unknown>;

const PERSIST_DEBOUNCE_MS = 1200;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite: { name: string; value: StorageValue<PersistedWorkspace> } | null = null;

/**
 * Drop the queued local save without writing it. Used by restoreDataBackup,
 * which writes the persist key directly and then reloads: a queued write would
 * otherwise flush on pagehide and overwrite the restored blob with the state
 * the user just replaced.
 */
export function cancelPendingPersist(): void {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    pendingWrite = null;
}

function flushPersist() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    if (!pendingWrite) return;
    const { name, value } = pendingWrite;
    pendingWrite = null;
    try {
        localStorage.setItem(name, JSON.stringify(value));
    } catch {
        /* quota — Task 7 surfaces this */
    }
}

/**
 * Debounced localStorage adapter.
 *
 * zustand's persist middleware writes on every `set()`. With the full workspace
 * that is a multi-megabyte JSON.stringify on every keystroke. The debounce sits
 * ABOVE the serialise — the adapter holds the state object and stringifies once
 * per idle window — and flushes on tab hide / unload so the final edit is never
 * lost. Using createJSONStorage here would serialise before the adapter ever saw
 * the value, which is the bug this replaces.
 */
const debouncedJSONStorage: PersistStorage<PersistedWorkspace> = {
    getItem: (name) => {
        const raw = localStorage.getItem(name);
        if (raw === null) return null;
        try {
            return JSON.parse(raw, reviveDates) as StorageValue<PersistedWorkspace>;
        } catch {
            return null;
        }
    },
    setItem: (name, value) => {
        pendingWrite = { name, value };
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
    },
    removeItem: (name) => {
        cancelPendingPersist();
        localStorage.removeItem(name);
    },
};
```

- [ ] **Step 3: Point the persist config at it**

Replace the whole `storage: createJSONStorage(() => debouncedLocalStorage, { reviver: … }),` option (lines 2651–2676) with one line:

```typescript
            storage: debouncedJSONStorage,
```

- [ ] **Step 4: Cancel the pending write before a restore**

In `restoreDataBackup`, immediately before `localStorage.setItem(WORKSPACE_STORAGE_KEY, payload);`:

```typescript
        // The caller reloads straight after this. A queued local save would
        // flush on pagehide and overwrite what we just restored.
        cancelPendingPersist();
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src/store/workspaceStore.ts
```

Expected: no compiler output; all tests PASS; eslint reports only the pre-existing problems.

Then measure. With the dev server running, open the Performance panel, record while typing a paragraph into a scene in a workspace that has at least a few chapters, and confirm there is **one** `JSON.stringify` frame per idle window rather than one per keystroke.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "perf: debounce the persist serialise, not just the write

createJSONStorage stringifies before handing the value to the storage
adapter, so the debounce only ever coalesced the localStorage.setItem call
— a full-workspace JSON.stringify still ran on the main thread on every
keystroke. A PersistStorage adapter takes the object instead and
serialises once per idle window.

Also exports cancelPendingPersist so restoreDataBackup can drop the queued
write before it replaces the persist key and reloads."
```

---

## Task 7: Say so when the browser cannot save

**Files:**
- Create: `src/lib/persistQuota.ts`, `src/lib/persistQuota.test.ts`
- Create: `src/components/ui/PersistQuotaBanner.tsx`, `src/components/ui/PersistQuotaBanner.module.css`
- Modify: `src/store/workspaceStore.ts`
- Modify: `src/app/page.tsx`

`flushPersist` swallows the failure with `catch { /* quota */ }`. A writer whose browser is full keeps typing into a workspace that is no longer being saved locally, and finds out when the tab closes.

- [ ] **Step 1: Write the failing test**

Create `src/lib/persistQuota.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { describePersistFailure, formatBytes, isQuotaError } from './persistQuota';

describe('isQuotaError', () => {
    it('recognises the standard DOMException name', () => {
        expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    });

    it('recognises the Firefox name and the legacy codes', () => {
        expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
        expect(isQuotaError({ code: 22 })).toBe(true);
        expect(isQuotaError({ code: 1014 })).toBe(true);
    });

    it('is false for anything else', () => {
        expect(isQuotaError(new TypeError('nope'))).toBe(false);
        expect(isQuotaError(null)).toBe(false);
        expect(isQuotaError('QuotaExceededError')).toBe(false);
    });
});

describe('formatBytes', () => {
    it('reads in the unit a person would use', () => {
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(2048)).toBe('2.0 KB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    });
});

describe('describePersistFailure', () => {
    it('names the cause and the size when the browser is full', () => {
        const msg = describePersistFailure({ name: 'QuotaExceededError' }, 5 * 1024 * 1024);
        expect(msg).toContain('out of space');
        expect(msg).toContain('5.0 MB');
    });

    it('does not blame quota for an unrelated failure', () => {
        const msg = describePersistFailure(new TypeError('boom'), 1024);
        expect(msg).not.toContain('out of space');
        expect(msg).toContain('could not save');
    });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/lib/persistQuota.test.ts`

Expected: FAIL — `Failed to resolve import "./persistQuota"`.

- [ ] **Step 3: Write the module**

Create `src/lib/persistQuota.ts`:

```typescript
/**
 * Local-save failure classification and wording — LEAF MODULE (no store, no React).
 *
 * The persist path used to swallow every write failure with `catch { }`. A
 * writer whose browser is full then kept typing into a workspace that was no
 * longer being saved locally and found out when the tab closed. The wording
 * lives here, beside the detection, so it can be read and tested as one thing.
 */

/** Names browsers use for a storage-quota failure. */
export const QUOTA_ERROR_NAMES = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'];

/** Legacy numeric codes: 22 is the DOMException code, 1014 is Firefox's. */
export const QUOTA_ERROR_CODES = [22, 1014];

export function isQuotaError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { name?: unknown; code?: unknown };
    if (typeof e.name === 'string' && QUOTA_ERROR_NAMES.includes(e.name)) return true;
    return typeof e.code === 'number' && QUOTA_ERROR_CODES.includes(e.code);
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * What to tell the writer. Both branches say the same two things: what is not
 * saved, and what still is — because cloud sync is a separate path and is
 * usually still working.
 */
export function describePersistFailure(err: unknown, bytes: number): string {
    const size = formatBytes(bytes);
    if (isQuotaError(err)) {
        return `This browser is out of space, so your recent edits are not saved on this device (${size} needed). `
            + `Cloud sync is unaffected. Free space by deleting old backups in Settings, or by removing large pasted images.`;
    }
    return `LoreCanvas could not save to this browser (${size}). `
        + `Your work is still in memory and still syncing to the cloud — do not close this tab until sync shows "Saved".`;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/lib/persistQuota.test.ts`

Expected: PASS — 7 tests.

- [ ] **Step 5: Surface it from the store**

In `src/store/workspaceStore.ts`, add the import beside the other leaf-module import:

```typescript
import { describePersistFailure } from '@/lib/persistQuota';
```

Add to the `WorkspaceState` interface, below `ownerUserId`:

```typescript
    /**
     * Set when a local save fails, cleared when one succeeds. Deliberately NOT
     * in partializeWorkspace — persisting the "we could not persist" flag would
     * be its own joke, and it must not survive a reload that fixed the problem.
     */
    persistError: string | null;
    setPersistError: (message: string | null) => void;
```

Add to the initial state, below `ownerUserId: null,`:

```typescript
            persistError: null,
```

Add the action below `claimWorkspace`:

```typescript

            setPersistError: (message) => set(() => ({ persistError: message })),
```

And replace the body of `flushPersist` from Task 6:

```typescript
function flushPersist() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    if (!pendingWrite) return;
    const { name, value } = pendingWrite;
    pendingWrite = null;
    let serialized: string;
    try {
        serialized = JSON.stringify(value);
    } catch (err) {
        reportPersistOutcome(describePersistFailure(err, 0));
        return;
    }
    try {
        localStorage.setItem(name, serialized);
        reportPersistOutcome(null);
    } catch (err) {
        reportPersistOutcome(describePersistFailure(err, serialized.length));
    }
}

/**
 * Record the outcome of a local save, but only when it changed.
 *
 * Writing to the store schedules another persist, which on a full browser fails
 * again — so an unconditional set() here would spin forever. Comparing first
 * makes the second and every later failure a no-op.
 */
function reportPersistOutcome(message: string | null) {
    const state = useWorkspaceStore.getState();
    if (state.persistError === message) return;
    state.setPersistError(message);
}
```

`reportPersistOutcome` references `useWorkspaceStore` before its `const` declaration, which is fine: it only ever runs from a `setTimeout`, long after the module has finished evaluating.

- [ ] **Step 6: Build the banner**

Create `src/components/ui/PersistQuotaBanner.module.css`:

```css
.banner {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    z-index: 4000;
    max-width: min(640px, calc(100vw - 32px));
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 10px;
    border: 1px solid var(--color-danger-border, #b4453a);
    background: var(--color-danger-surface, #2a1512);
    color: var(--color-danger-text, #ffd9d3);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    font-size: 0.875rem;
    line-height: 1.5;
}

.icon {
    flex: 0 0 auto;
    margin-top: 2px;
}

.text {
    flex: 1 1 auto;
    margin: 0;
}

.dismiss {
    flex: 0 0 auto;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
}

.dismiss:hover {
    background: rgba(255, 255, 255, 0.12);
}

.dismiss:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
}
```

Create `src/components/ui/PersistQuotaBanner.tsx`:

```tsx
"use client";

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import styles from './PersistQuotaBanner.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';

/**
 * Tells the writer when this browser stopped saving their work.
 *
 * Dismissing only hides the current message. If saving is still failing the
 * next distinct failure raises it again, because the store only clears
 * persistError on a save that actually succeeded.
 */
export default function PersistQuotaBanner() {
    const persistError = useWorkspaceStore(s => s.persistError);
    const setPersistError = useWorkspaceStore(s => s.setPersistError);

    if (!persistError) return null;

    return (
        <div className={styles.banner} role="alert">
            <AlertTriangle size={18} className={styles.icon} aria-hidden="true" />
            <p className={styles.text}>{persistError}</p>
            <button
                type="button"
                className={styles.dismiss}
                onClick={() => setPersistError(null)}
                aria-label="Dismiss save warning"
            >
                <X size={16} aria-hidden="true" />
            </button>
        </div>
    );
}
```

- [ ] **Step 7: Mount it**

In `src/app/page.tsx`, add the import beside the other UI imports:

```typescript
import PersistQuotaBanner from '@/components/ui/PersistQuotaBanner';
```

and render it in the "Global modal overlays" group, directly after `<HoverPreview />`:

```tsx
        <PersistQuotaBanner />
```

- [ ] **Step 8: Verify**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src/lib/persistQuota.ts src/lib/persistQuota.test.ts src/components/ui/PersistQuotaBanner.tsx
```

Expected: no compiler output; all tests PASS; no eslint output.

Then, with the dev server running, force the failure in the console and confirm the banner appears within ~1.2s and disappears once saving works again:

```js
const real = Storage.prototype.setItem;
Storage.prototype.setItem = function (k, v) {
  if (k === 'lorecanvas-workspace') { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
  return real.call(this, k, v);
};
// type a character in a scene, wait ~2s — the banner should appear
Storage.prototype.setItem = real;
// type again, wait ~2s — the banner should clear
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: tell the writer when this browser stopped saving

flushPersist swallowed every write failure with catch { }, so a writer on a
full browser kept typing into a workspace that was no longer being saved
locally and found out when the tab closed. The failure is now classified,
worded once in a leaf module, and shown in a role=alert banner that clears
itself on the next successful save.

The store write is guarded against re-entry: reporting the failure
schedules another persist, which fails again, so the outcome is only
written when it changed."
```

---

## Task 8: Guard the cloud write, not just the hydrate

**Files:**
- Modify: `src/lib/supabase/workspaceSync.ts`
- Create: `src/lib/supabase/workspaceSync.test.ts`
- Modify: `src/lib/supabase/useSupabaseSync.ts`
- Modify: `src/lib/workspaceConflict.ts`, `src/lib/workspaceConflict.test.ts`
- Modify: `src/store/workspaceStore.ts` — the World Bible actions (lines 2024–2062)

Two halves, both verified:

- **`saveWorkspace` is a blind upsert.** A second tab or a second device that saved while this one was idle is overwritten without anyone noticing. Conflict resolution only ever runs on hydrate.
- **47 keys persist; 4 are conflict-checked.** `CONTENT_KEYS` is `['projects', 'documents', 'scenes', 'entities']`. `worldBibles` is a `Record`, not a dated array, and `updateWorldBibleConfig`, `setWorldBibleLayout` and `applyBibleLayout` stamp no timestamp at all — so an afternoon spent restructuring a World Bible is invisible to `newestContentTime`, and the other device's older copy wins.

- [ ] **Step 1: Write the failing conflict test**

Append to `src/lib/workspaceConflict.test.ts`:

```typescript
describe('newestContentTime with World Bibles', () => {
    it('counts a bible edit as content', () => {
        const state = {
            projects: [{ id: 'p1', updatedAt: '2026-01-01T00:00:00.000Z' }],
            worldBibles: { w1: { layout: { roots: [] }, updatedAt: '2026-06-01T00:00:00.000Z' } },
        };
        expect(newestContentTime(state)).toBe(new Date('2026-06-01T00:00:00.000Z').getTime());
    });

    it('ignores bibles that carry no stamp', () => {
        const state = {
            projects: [{ id: 'p1', updatedAt: '2026-01-01T00:00:00.000Z' }],
            worldBibles: { w1: { layout: { roots: [] } } },
        };
        expect(newestContentTime(state)).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
    });

    it('survives a malformed worldBibles value', () => {
        expect(newestContentTime({ worldBibles: 'nope' })).toBe(0);
        expect(newestContentTime({ worldBibles: { w1: null } })).toBe(0);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/workspaceConflict.test.ts`

Expected: FAIL — the first case returns the January timestamp, not the June one.

- [ ] **Step 3: Teach `newestContentTime` about bibles**

In `src/lib/workspaceConflict.ts`, replace `newestContentTime`:

```typescript
/** Newest createdAt/updatedAt across the content collections, in ms. 0 when empty. */
export function newestContentTime(state: WorkspaceLike): number {
    let newest = 0;
    for (const arr of collections(state)) {
        for (const item of arr) {
            const rec = item as { updatedAt?: unknown; createdAt?: unknown } | null;
            const stamp = rec?.updatedAt ?? rec?.createdAt;
            if (stamp === undefined || stamp === null) continue;
            const ms = new Date(stamp as string).getTime();
            if (Number.isFinite(ms) && ms > newest) newest = ms;
        }
    }
    // World Bibles are a keyed record rather than a dated array, so they were
    // invisible here: an afternoon restructuring a bible left the timestamp
    // untouched and the other device's older copy won.
    const bibles = state ? (state as Record<string, unknown>).worldBibles : undefined;
    if (bibles && typeof bibles === 'object' && !Array.isArray(bibles)) {
        for (const value of Object.values(bibles as Record<string, unknown>)) {
            if (!value || typeof value !== 'object') continue;
            const stamp = (value as { updatedAt?: unknown }).updatedAt;
            if (stamp === undefined || stamp === null) continue;
            const ms = new Date(stamp as string).getTime();
            if (Number.isFinite(ms) && ms > newest) newest = ms;
        }
    }
    return newest;
}
```

Also extend the module's doc comment, after the two existing bullets:

```typescript
 *  - Every persisted surface that can hold a writer's decisions has to be
 *    visible here. `countContent` deliberately still counts only the four
 *    content arrays: a configured-but-empty bible is not "work in progress"
 *    for the purposes of the emptiness rule.
```

- [ ] **Step 4: Stamp the bible actions**

In `src/store/workspaceStore.ts`, add `updatedAt` to the `WorldBibleConfig` interface (line 87):

```typescript
export interface WorldBibleConfig {
  layout: WorldBibleLayout;
  /** Cover title — defaults to the world name / "Standalones" when unset. */
  coverTitle?: string;
  /** Cover subtitle — defaults to "World Bible" when unset. */
  coverSub?: string;
  /** Cover accent color (hex). */
  tint?: string;
  /**
   * ISO stamp of the last edit. An ISO string rather than a Date because the
   * persist reviver only rebuilds Dates inside the dated content arrays, so a
   * Date here would come back as a string anyway.
   */
  updatedAt?: string;
}
```

Then stamp it in all three actions (lines 2024–2062):

```typescript
            updateWorldBibleConfig: (key, patch) =>
                set((state) => {
                    const existing = state.worldBibles[key];
                    // Destructure layout out first: spreading `existing` directly after an
                    // explicit `layout:` key trips TS2783 (duplicate property). Behaviourally
                    // identical to a plain spread, just strict-mode safe.
                    const { layout: existingLayout, ...existingIdentity } = existing ?? {};
                    return {
                        worldBibles: {
                            ...state.worldBibles,
                            [key]: {
                                layout: existingLayout ?? { roots: [] },
                                ...existingIdentity,
                                ...patch,
                                updatedAt: new Date().toISOString(),
                            },
                        },
                    };
                }),

            setWorldBibleLayout: (key, layout) =>
                set((state) => ({
                    worldBibles: {
                        ...state.worldBibles,
                        [key]: { ...state.worldBibles[key], layout, updatedAt: new Date().toISOString() },
                    },
                })),

            applyBibleLayout: (key, layout) =>
                set((state) => {
                    const stamp = new Date();
                    return {
                        worldBibles: {
                            ...state.worldBibles,
                            [key]: { ...state.worldBibles[key], layout, updatedAt: stamp.toISOString() },
                        },
                        // Re-file this world's articles into the new structure by type
                        // (covers previously-unfiled ones too; presets span all 8 types).
                        entities: state.entities.map(e => {
                            if (worldKeyForEntity(e) !== key) return e;
                            return { ...e, categoryId: fileByType(layout.roots, e.type), updatedAt: stamp };
                        }),
                    };
                }),
```

- [ ] **Step 5: Write the failing guarded-write test**

Create `src/lib/supabase/workspaceSync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveWorkspace } from './workspaceSync';

const updateResult = { data: [] as unknown[], error: null as unknown };
const probeResult = { data: null as unknown, error: null as unknown };
const upsertResult = { error: null as unknown };

const upsertMock = vi.fn(() => Promise.resolve(upsertResult));
const selectAfterUpdateMock = vi.fn(() => Promise.resolve(updateResult));
const maybeSingleMock = vi.fn(() => Promise.resolve(probeResult));

vi.mock('./client', () => ({
    createClient: () => ({
        from: () => ({
            upsert: upsertMock,
            update: () => ({
                eq: () => ({ lte: () => ({ select: selectAfterUpdateMock }) }),
            }),
            select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
        }),
    }),
}));

describe('saveWorkspace', () => {
    beforeEach(() => {
        upsertMock.mockClear();
        selectAfterUpdateMock.mockClear();
        maybeSingleMock.mockClear();
        updateResult.data = [];
        updateResult.error = null;
        probeResult.data = null;
        upsertResult.error = null;
    });

    it('upserts when there is no row to guard against', async () => {
        const result = await saveWorkspace('user-a', { projects: [] }, 0);
        expect(result.ok).toBe(true);
        expect(upsertMock).toHaveBeenCalledTimes(1);
        expect(selectAfterUpdateMock).not.toHaveBeenCalled();
    });

    it('takes the guarded update path once a row has been seen', async () => {
        updateResult.data = [{ updated_at: '2026-09-03T10:00:00.000Z' }];
        const result = await saveWorkspace('user-a', { projects: [] }, 1_700_000_000_000);
        expect(result.ok).toBe(true);
        expect(selectAfterUpdateMock).toHaveBeenCalledTimes(1);
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('refuses and reports a conflict when the row moved on', async () => {
        updateResult.data = [];
        probeResult.data = { updated_at: '2026-09-03T12:00:00.000Z' };
        const result = await saveWorkspace('user-a', { projects: [] }, 1_700_000_000_000);
        expect(result).toEqual({
            ok: false,
            conflict: true,
            remoteUpdatedAt: new Date('2026-09-03T12:00:00.000Z').getTime(),
        });
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('falls through to an insert when the row has been deleted', async () => {
        updateResult.data = [];
        probeResult.data = null;
        const result = await saveWorkspace('user-a', { projects: [] }, 1_700_000_000_000);
        expect(result.ok).toBe(true);
        expect(upsertMock).toHaveBeenCalledTimes(1);
    });

    it('reports a plain failure without claiming a conflict', async () => {
        updateResult.error = { message: 'network down' };
        const result = await saveWorkspace('user-a', { projects: [] }, 1_700_000_000_000);
        expect(result).toEqual({ ok: false, conflict: false });
    });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run src/lib/supabase/workspaceSync.test.ts`

Expected: FAIL — `Expected 2 arguments, but got 3` at build time, and at runtime `result.ok` is a boolean from the old signature rather than the new `SaveResult` discriminant.

- [ ] **Step 7: Make the write guarded**

In `src/lib/supabase/workspaceSync.ts`, replace `saveWorkspace`:

```typescript
/**
 * The outcome of a cloud write.
 *
 * `conflict` is deliberately distinct from a plain failure: a conflict means the
 * write was correctly refused and the caller must re-hydrate, while a failure
 * means it should be retried.
 */
export type SaveResult =
  | { ok: true; updatedAt: number }
  | { ok: false; conflict: true; remoteUpdatedAt: number }
  | { ok: false; conflict: false };

/**
 * Writes the workspace, refusing to clobber a row that has moved since the copy
 * the caller hydrated from.
 *
 * `expectedUpdatedAt` is the server stamp of the row this client last read or
 * wrote. When it is greater than zero the write goes through a conditional
 * UPDATE … WHERE updated_at <= expected, which Postgres evaluates atomically:
 * a second tab or a second device that saved in the meantime makes the update
 * match zero rows, and the write is refused rather than silently winning.
 *
 * When it is zero this client has never seen a row — first sign-in on a new
 * device — and the upsert is correct.
 */
export async function saveWorkspace(
  userId: string,
  data: Record<string, any>,
  expectedUpdatedAt: number,
): Promise<SaveResult> {
  const nextIso = new Date().toISOString();
  try {
    const supabase = createClient();

    if (expectedUpdatedAt > 0) {
      const { data: rows, error } = await supabase
        .from('workspaces')
        .update({ data, updated_at: nextIso })
        .eq('user_id', userId)
        .lte('updated_at', new Date(expectedUpdatedAt).toISOString())
        .select('updated_at');

      if (error) {
        logger.error('LoreCanvas Sync: Error saving workspace:', error.message);
        return { ok: false, conflict: false };
      }
      if (rows && rows.length > 0) {
        return { ok: true, updatedAt: new Date(nextIso).getTime() };
      }

      // Zero rows means either somebody else wrote, or the row is gone.
      const { data: probe } = await supabase
        .from('workspaces')
        .select('updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (probe?.updated_at) {
        logger.warn('LoreCanvas Sync: cloud row moved since hydrate — refusing to overwrite');
        return {
          ok: false,
          conflict: true,
          remoteUpdatedAt: new Date(probe.updated_at).getTime(),
        };
      }
    }

    const { error } = await supabase
      .from('workspaces')
      .upsert(
        {
          user_id: userId,
          data,
          updated_at: nextIso,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      logger.error('LoreCanvas Sync: Error saving workspace:', error.message);
      return { ok: false, conflict: false };
    }
    return { ok: true, updatedAt: new Date(nextIso).getTime() };
  } catch (err) {
    logger.error('LoreCanvas Sync: Unexpected error saving workspace:', err);
    return { ok: false, conflict: false };
  }
}
```

- [ ] **Step 8: Track the server stamp in the hook**

In `src/lib/supabase/useSupabaseSync.ts`, add a ref beside the others (near line 39):

```typescript
  // The server stamp of the row this client last read or wrote. Zero means we
  // have never seen a row, which is the only case where a blind upsert is safe.
  const remoteUpdatedAtRef = useRef(0);
```

In the hydrate effect, immediately after `const cloud = await loadWorkspace(userId);`:

```typescript
        remoteUpdatedAtRef.current = cloud?.updatedAt ?? 0;
```

Then replace the `flush` function inside the save effect (lines 89–109):

```typescript
    const flush = async () => {
      const state = latestStateRef.current;
      if (!state) return false;
      const result = await saveWorkspace(userId, state, remoteUpdatedAtRef.current);

      if (result.ok) {
        remoteUpdatedAtRef.current = result.updatedAt;
        failureCountRef.current = 0;
        backoffUntilRef.current = 0;
        setStatus('saved');
        return true;
      }

      if (result.conflict) {
        // Somebody else wrote this row. Re-read it and let the same rules that
        // run on hydrate decide, instead of retrying the write that just lost.
        const cloud = await loadWorkspace(userId);
        remoteUpdatedAtRef.current = cloud?.updatedAt ?? 0;
        if (cloud && looksLikeWorkspace(cloud.data)) {
          const localState = useWorkspaceStore.getState() as Record<string, any>;
          const { takeCloud, reason } = resolveWorkspaceConflict(localState, cloud.data);
          if (takeCloud) {
            useWorkspaceStore.setState(migrateWorkspaceSchema(cloud.data));
            logger.info(`LoreCanvas Sync: adopted the newer cloud workspace after a write conflict (${reason})`);
          } else {
            logger.info(`LoreCanvas Sync: keeping local after a write conflict (${reason}) — will retry`);
          }
        }
        setStatus('syncing');
        return false;
      }

      failureCountRef.current += 1;
      const wait = Math.min(
        BACKOFF_MAX_MS,
        BACKOFF_BASE_MS * 2 ** (failureCountRef.current - 1),
      );
      backoffUntilRef.current = Date.now() + wait;
      if (failureCountRef.current === 3) {
        logger.error('LoreCanvas Sync: repeated save failures — backing off retries');
      }
      setStatus('error');
      return false;
    };
```

The conflict branch does not enter the failure backoff: a conflict means the server is healthy and the right next move is another save, not a five-minute wait.

- [ ] **Step 9: Run the tests and watch them pass**

```bash
npx vitest run src/lib/supabase/workspaceSync.test.ts src/lib/workspaceConflict.test.ts
npx tsc --noEmit --pretty false
npx vitest run
```

Expected: 5 + (existing + 3) tests PASS; no compiler output; the whole suite green.

- [ ] **Step 10: Manual verification**

1. Sign in as the same user in two browser windows (one normal, one private, both signed in as A).
2. Write in window 1, wait for "Saved".
3. Write in window 2. Its first save is refused as a conflict, it re-reads, and the console logs `adopted the newer cloud workspace after a write conflict` or `keeping local after a write conflict`. Neither window silently loses its paragraph without a log line saying which copy won.
4. Restructure a World Bible in window 2 and nothing else. Reload window 1 and confirm the restructure survives — before this task the untimestamped bible edit lost to window 1's older copy.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "fix: the cloud write is guarded, and World Bible edits are visible to it

saveWorkspace was a blind upsert: a second tab or device that saved while
this one was idle got overwritten with no log line and no conflict check.
It now writes through a conditional UPDATE ... WHERE updated_at <= expected,
which Postgres evaluates atomically, and a refused write re-hydrates through
the same rules the initial load uses.

The second half: 47 keys persist and only four were conflict-checked.
worldBibles is a keyed record with no timestamps, so restructuring a bible
was invisible to newestContentTime and lost to an older copy. The three
bible actions now stamp updatedAt and the conflict resolver reads it."
```

---

## Task 9: Sign-in works on any host

**Files:**
- Create: `src/lib/authRedirect.ts`, `src/lib/authRedirect.test.ts`
- Modify: `src/app/auth/callback/route.ts`
- Modify: `.env.example`

`src/app/auth/callback/route.ts:30` reads `x-forwarded-host` and never uses it. Line 32 sends every production magic link to `https://lorecanvas.isomeric.studio`, and the development branch targets port 3000 while `npm run dev` serves port **4000** (`package.json`), so that path is broken today.

- [ ] **Step 1: Write the failing test**

Create `src/lib/authRedirect.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveRedirectBase, safeNextPath } from './authRedirect';

describe('resolveRedirectBase', () => {
    it('prefers an explicitly configured site url', () => {
        expect(resolveRedirectBase('http://localhost:4000', 'evil.example.com', 'https', 'https://app.example.com'))
            .toBe('https://app.example.com');
    });

    it('strips a trailing slash from the configured site url', () => {
        expect(resolveRedirectBase('http://localhost:4000', null, null, 'https://app.example.com/'))
            .toBe('https://app.example.com');
    });

    it('uses the forwarded host and proto behind a proxy', () => {
        expect(resolveRedirectBase('http://internal:3000', 'app.example.com', 'https', undefined))
            .toBe('https://app.example.com');
    });

    it('assumes https for a forwarded host with no proto', () => {
        expect(resolveRedirectBase('http://internal:3000', 'preview-x.vercel.app', null, undefined))
            .toBe('https://preview-x.vercel.app');
    });

    it('keeps http for a forwarded localhost', () => {
        expect(resolveRedirectBase('http://localhost:4000', 'localhost:4000', null, undefined))
            .toBe('http://localhost:4000');
    });

    it('falls back to the request origin, port and all', () => {
        expect(resolveRedirectBase('http://localhost:4000', null, null, undefined))
            .toBe('http://localhost:4000');
        expect(resolveRedirectBase('https://lorecanvas.isomeric.studio', null, null, ''))
            .toBe('https://lorecanvas.isomeric.studio');
    });
});

describe('safeNextPath', () => {
    it('keeps a same-site relative path', () => {
        expect(safeNextPath('/?view=home')).toBe('/?view=home');
        expect(safeNextPath('/bookshelf')).toBe('/bookshelf');
    });

    it('rejects an absolute url', () => {
        expect(safeNextPath('https://evil.com')).toBe('/?view=home');
    });

    it('rejects a protocol-relative url', () => {
        expect(safeNextPath('//evil.com')).toBe('/?view=home');
    });

    it('defaults when absent', () => {
        expect(safeNextPath(null)).toBe('/?view=home');
        expect(safeNextPath('')).toBe('/?view=home');
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/authRedirect.test.ts`

Expected: FAIL — `Failed to resolve import "./authRedirect"`.

- [ ] **Step 3: Write the module**

Create `src/lib/authRedirect.ts`:

```typescript
/**
 * Auth callback redirect rules — LEAF MODULE (no store, no React, no Request).
 *
 * The callback used to send every production magic link to one hardcoded
 * hostname, so a link clicked on any other deployment — a preview, a staging
 * box, a second domain — landed where the session cookie did not exist and the
 * user bounced straight back to /welcome. The development branch pointed at
 * port 3000 while the dev server runs on 4000, so it was broken locally too.
 */

/** Where sign-in lands when no usable `next` was supplied. */
export const DEFAULT_NEXT = '/?view=home';

/**
 * The origin a freshly-signed-in user should be sent back to.
 *
 * Order matters. `x-forwarded-host` is client-supplied unless a trusted proxy
 * overwrites it, so an explicitly configured NEXT_PUBLIC_SITE_URL always wins:
 * that is how a deployment closes the vector by configuration rather than by
 * trusting a header. Behind Vercel and every mainstream platform the forwarded
 * headers are set by the platform and the fallback is correct.
 */
export function resolveRedirectBase(
    requestOrigin: string,
    forwardedHost: string | null,
    forwardedProto: string | null,
    configuredSiteUrl: string | undefined,
): string {
    if (configuredSiteUrl) {
        return configuredSiteUrl.replace(/\/+$/, '');
    }
    if (forwardedHost) {
        const isLoopback = forwardedHost.startsWith('localhost')
            || forwardedHost.startsWith('127.0.0.1');
        const proto = forwardedProto ?? (isLoopback ? 'http' : 'https');
        return `${proto}://${forwardedHost}`;
    }
    return requestOrigin;
}

/**
 * SECURITY: only accept same-site relative paths. A value like
 * "https://evil.com" or "//evil.com" would otherwise be an open redirect that
 * lands an authenticated user on an attacker-controlled page.
 *
 * Moved here verbatim from the callback route so it has a test.
 */
export function safeNextPath(rawNext: string | null): string {
    const next = rawNext || DEFAULT_NEXT;
    return next.startsWith('/') && !next.startsWith('//') ? next : DEFAULT_NEXT;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/authRedirect.test.ts`

Expected: PASS — 10 tests.

- [ ] **Step 5: Rewrite the callback**

Replace the whole of `src/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveRedirectBase, safeNextPath } from '@/lib/authRedirect';

/**
 * Auth Callback Route
 *
 * Exchanges the magic-link code for a Supabase session, then returns the user
 * to the host they actually signed in from — derived from the request rather
 * than hardcoded, so previews, staging and a second domain all work.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Default landing after sign-in is the Home dashboard (?view= is read by the
  // workspace on mount), not whatever mode the previous session persisted.
  const next = safeNextPath(searchParams.get('next'));

  const redirectBase = resolveRedirectBase(
    origin,
    request.headers.get('x-forwarded-host'),
    request.headers.get('x-forwarded-proto'),
    process.env.NEXT_PUBLIC_SITE_URL,
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${redirectBase}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${redirectBase}/login?error=auth_callback_failed`);
}
```

- [ ] **Step 6: Document the variable**

Append to `.env.example`:

```
# Canonical public origin, e.g. https://lorecanvas.example.com — no trailing slash.
# Optional. When set it wins over the x-forwarded-host header in the auth
# callback, which is the right choice on any host that is not behind a proxy
# that overwrites that header.
NEXT_PUBLIC_SITE_URL=
```

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src/lib/authRedirect.ts src/lib/authRedirect.test.ts src/app/auth/callback/route.ts
```

Expected: no compiler output; all tests PASS; no eslint output.

Then, with `npm run dev` on port 4000, request a magic link from `http://localhost:4000/login` and confirm the emailed link lands back on **`localhost:4000`** and arrives signed in — not on port 3000, and not on `lorecanvas.isomeric.studio`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix: sign-in works on hosts other than the developer's

The callback read x-forwarded-host and then ignored it, sending every
production magic link to one hardcoded hostname where the session cookie
does not exist — so the user arrived unauthenticated and bounced to
/welcome. The development branch targeted port 3000 while the dev server
runs on 4000, so it was broken locally too.

The redirect base is now derived from the request, with an optional
NEXT_PUBLIC_SITE_URL taking precedence because x-forwarded-host is
client-supplied unless a trusted proxy overwrites it. The open-redirect
guard on next is unchanged and now has a test."
```

---

## Task 10: One sign-in helper, one invite policy

**Files:**
- Create: `src/lib/authPolicy.ts`, `src/lib/authPolicy.test.ts`, `src/lib/supabase/signIn.ts`
- Modify: `src/app/login/useLoginForm.ts`, `src/components/ui/LoginModal.tsx`

`useLoginForm.ts:45` sets `shouldCreateUser: false`. `LoginModal.tsx:33` omits it, and GoTrue defaults to `true` — so the modal, which is reachable from the ModeBar profile pill (`ModeBar.tsx:497,525`), creates accounts the login page refuses to.

**Say this plainly rather than pretending otherwise:** `signInWithOAuth` has no `shouldCreateUser` option, in this or any Supabase version. The Google button at `LoginModal.tsx:51` **cannot be gated from the client**. The only enforcement is the project-level "Allow new users to sign up" toggle in the Supabase dashboard. This task unifies the code and makes the OAuth gap explicit in a comment; the dashboard setting is verified in the final checklist and belongs to Phase 10 operationally.

- [ ] **Step 1: Write the failing test**

Create `src/lib/authPolicy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ALLOW_SIGNUP_FROM_LOGIN, isNotInvitedError } from './authPolicy';

describe('the invite policy', () => {
    it('never creates accounts from a login surface', () => {
        expect(ALLOW_SIGNUP_FROM_LOGIN).toBe(false);
    });
});

describe('isNotInvitedError', () => {
    it('recognises the ways GoTrue says "not invited"', () => {
        expect(isNotInvitedError('Signups not allowed for otp')).toBe(true);
        expect(isNotInvitedError('User not found')).toBe(true);
        expect(isNotInvitedError('Email signup is not allowed')).toBe(true);
    });

    it('does not swallow an unrelated failure', () => {
        expect(isNotInvitedError('Email rate limit exceeded')).toBe(false);
        expect(isNotInvitedError('')).toBe(false);
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/authPolicy.test.ts`

Expected: FAIL — `Failed to resolve import "./authPolicy"`.

- [ ] **Step 3: Write the policy module**

Create `src/lib/authPolicy.ts`:

```typescript
/**
 * The invite policy — LEAF MODULE (no store, no React, no network).
 *
 * Stated once, so the login page and the login modal cannot disagree about it.
 * They did: the page set shouldCreateUser: false and the modal omitted it,
 * which GoTrue reads as true, so the modal created accounts the page refused.
 */

/**
 * Invite-only beta: no login surface may create an account.
 *
 * This governs the magic-link paths only. `signInWithOAuth` has no equivalent
 * option in any Supabase version, so the Google button cannot be gated from the
 * client at all — the only enforcement for OAuth is the project-level
 * "Allow new users to sign up" setting in the Supabase dashboard.
 */
export const ALLOW_SIGNUP_FROM_LOGIN = false;

/** GoTrue surfaces an uninvited email as a signup-disallowed error. */
export function isNotInvitedError(message: string): boolean {
    if (!message) return false;
    return /signup|not allowed|not found/i.test(message);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/authPolicy.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 5: Write the shared helper**

Create `src/lib/supabase/signIn.ts`:

```typescript
import { createClient } from './client';
import { ALLOW_SIGNUP_FROM_LOGIN, isNotInvitedError } from '@/lib/authPolicy';

/**
 * The one sign-in path every surface uses.
 *
 * Before this existed, the login page and the login modal each built their own
 * signInWithOtp call and disagreed about whether an unknown email creates an
 * account. Adding a third surface would have made it three.
 */

export interface SignInResult {
    ok: boolean;
    /** The email is not on the invite list — a different message, not an error. */
    notInvited: boolean;
    /** Message to show the user. Null on a clean success with nothing to say. */
    message: string | null;
}

/** Where every provider returns the browser after a successful sign-in. */
function callbackUrl(): string {
    return `${window.location.origin}/auth/callback`;
}

export async function sendMagicLink(email: string): Promise<SignInResult> {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: ALLOW_SIGNUP_FROM_LOGIN,
            emailRedirectTo: callbackUrl(),
        },
    });

    if (!error) {
        return { ok: true, notInvited: false, message: 'A magic link is on its way — check your inbox.' };
    }
    if (isNotInvitedError(error.message)) {
        return { ok: false, notInvited: true, message: null };
    }
    return { ok: false, notInvited: false, message: error.message };
}

/**
 * OAuth cannot carry the invite policy — there is no shouldCreateUser for it.
 * Whether a new Google account may be created is decided entirely by the
 * Supabase project's own signup setting, and this helper must not be able to
 * contradict it.
 */
export async function signInWithGoogle(): Promise<SignInResult> {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl() },
    });

    if (error) {
        return { ok: false, notInvited: false, message: error.message };
    }
    // A successful OAuth start navigates the whole page away.
    return { ok: true, notInvited: false, message: null };
}
```

- [ ] **Step 6: Use it in the login page**

In `src/app/login/useLoginForm.ts`, replace the `createClient` import with the helper:

```typescript
import { sendMagicLink } from '@/lib/supabase/signIn';
```

delete the `const supabase = createClient();` line (line 26), and replace `handleLogin` (lines 34–62):

```typescript
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);
        setError(null);
        setNotInvited(false);

        const result = await sendMagicLink(email);

        if (result.ok) {
            setMessage(result.message);
        } else if (result.notInvited) {
            setNotInvited(true);
        } else {
            setError(result.message);
        }

        setIsLoading(false);
    };
```

Also update the doc comment at the top of the file so it points at where the policy now lives:

```typescript
/**
 * Sign-in logic shared by every login theme.
 *
 * The invite policy itself lives in src/lib/authPolicy.ts and is applied by
 * src/lib/supabase/signIn.ts, so this hook and LoginModal cannot disagree
 * about whether an unknown email creates an account. They used to.
 *
 * In development builds a one-click "Sign in as developer" button hits
 * /api/dev-login (password from .env.local, never shipped to production).
 */
```

- [ ] **Step 7: Use it in the modal**

In `src/components/ui/LoginModal.tsx`, replace the `createClient` import:

```typescript
import { sendMagicLink, signInWithGoogle } from '@/lib/supabase/signIn';
```

delete `const supabase = createClient();` (line 25), and replace both handlers (lines 27–63):

```tsx
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setError(null);

    const result = await sendMagicLink(email);

    if (result.ok) {
      setMessage(result.message);
    } else if (result.notInvited) {
      setMessage('That email is not on the beta list yet — request access from the landing page.');
    } else {
      setError(result.message);
    }

    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    const result = await signInWithGoogle();
    if (!result.ok) {
      setError(result.message);
      setIsLoading(false);
    }
    // A successful OAuth start redirects the whole page.
  };
```

- [ ] **Step 8: Verify**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src/lib/authPolicy.ts src/lib/authPolicy.test.ts src/lib/supabase/signIn.ts src/app/login/useLoginForm.ts src/components/ui/LoginModal.tsx
```

Expected: no compiler output; all tests PASS; no eslint output.

Then confirm by hand that entering an uninvited email in **both** the `/login` form and the ModeBar login modal produces a "not on the beta list" message and **no** account appears in the Supabase dashboard's user list.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "fix: the login modal no longer creates accounts the login page refuses

useLoginForm set shouldCreateUser: false; LoginModal omitted it and GoTrue
defaults to true, so the modal reachable from the profile pill signed up
anyone who typed an email. Both surfaces now go through one helper with the
invite policy stated once.

OAuth is documented rather than fixed: signInWithOAuth has no
shouldCreateUser, so the Google button can only be gated by the Supabase
project's own signup setting. The helper is written so it cannot contradict
that setting."
```

---

## Task 11: Delete the `ALLOW_DEV_LOGIN` escape hatch

**Files:**
- Modify: `src/app/api/dev-login/route.ts:9,14-16`
- Modify: `src/app/login/useLoginForm.ts:27-32`

The route is correctly 404 today. The risk is one environment variable away: setting `ALLOW_DEV_LOGIN=1` on an internet-reachable box hands anyone a session as `DEV_LOGIN_EMAIL` with no password. `NODE_ENV` cannot be `development` in a production build, so gating on it alone is sufficient and cannot be turned off by configuration.

- [ ] **Step 1: Remove the server-side hatch**

In `src/app/api/dev-login/route.ts`, replace the doc comment and the gate (lines 4–19):

```typescript
/**
 * Developer sign-in — DEVELOPMENT ONLY.
 *
 * Signs in with DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD from .env.local so the
 * developer doesn't need a magic-link email on every session. Gated on
 * NODE_ENV alone, which a production build cannot set to 'development' — there
 * is deliberately no environment variable that re-opens this route, because
 * testing a production build locally is not worth an internet-reachable
 * password-free session as the owner. The env vars are server-only (not
 * NEXT_PUBLIC), so they never reach client bundles.
 */
export async function POST() {
    if (process.env.NODE_ENV !== 'development') {
        return new NextResponse(null, { status: 404 });
    }
```

- [ ] **Step 2: Remove the client-side hatch**

In `src/app/login/useLoginForm.ts`, replace lines 27–32:

```typescript
    // The "Sign in as developer" button only exists in a development build,
    // matching /api/dev-login, which 404s everywhere else.
    const isDev = process.env.NODE_ENV === 'development';
```

- [ ] **Step 3: Verify nothing else references it**

Run: `grep -rn "ALLOW_DEV_LOGIN" src .env.example`

Expected: no output. (`.claude/settings.local.json` holds a stale `NEXT_PUBLIC_ALLOW_DEV_LOGIN=1 npm run build` permission entry. Leave it — it is local tooling config, not shipped code, and this plan does not touch configuration.)

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src/app/api/dev-login/route.ts src/app/login/useLoginForm.ts
```

Expected: no compiler output; all tests PASS; no eslint output.

Then confirm the dev button still works on `npm run dev`, and that `npm run build && npm start` shows no dev button and returns 404 from `POST /api/dev-login`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/dev-login
```

Expected: `404`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: remove the environment variable that re-opens dev-login

ALLOW_DEV_LOGIN=1 on a hosted box handed anyone on the internet a
password-free session as DEV_LOGIN_EMAIL. The route is now gated on
NODE_ENV alone, which a production build cannot set to development, so
there is no configuration that re-opens it. The client-side
NEXT_PUBLIC_ALLOW_DEV_LOGIN counterpart goes with it."
```

---

## Task 12: The proxy fails closed

**Files:**
- Create: `src/lib/proxyPaths.ts`, `src/lib/proxyPaths.test.ts`
- Modify: `src/proxy.ts:42-53,56-64`

`src/proxy.ts:50-53` catches a thrown `getUser()` and returns the request through unauthenticated. Phase 2 deleted five of the six API routes, so most of the blast radius is gone, but page routes still render the app shell on any Supabase hiccup.

**The correction to the spec:** it says redirect to `/login`; the proxy's actual unauthenticated destination at line 69 is `/welcome`, so this task fails closed to `/welcome` for consistency. It also lets **public paths through** on the exception — without that, an outage makes `/welcome` redirect to `/welcome` and every visitor is locked out of the only page that could let them back in.

- [ ] **Step 1: Write the failing test**

Create `src/lib/proxyPaths.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isPublicPath } from './proxyPaths';

describe('isPublicPath', () => {
    it('lets the sign-in surfaces through', () => {
        expect(isPublicPath('/login')).toBe(true);
        expect(isPublicPath('/login/anything')).toBe(true);
        expect(isPublicPath('/welcome')).toBe(true);
        expect(isPublicPath('/auth/callback')).toBe(true);
        expect(isPublicPath('/api/dev-login')).toBe(true);
    });

    it('lets framework internals and static assets through', () => {
        expect(isPublicPath('/_next/static/chunk.js')).toBe(true);
        expect(isPublicPath('/favicon.ico')).toBe(true);
        expect(isPublicPath('/hero.webp')).toBe(true);
        expect(isPublicPath('/styles/app.css')).toBe(true);
    });

    it('protects the app itself', () => {
        expect(isPublicPath('/')).toBe(false);
        expect(isPublicPath('/bookshelf')).toBe(false);
        expect(isPublicPath('/loginish')).toBe(false);
    });
});
```

Note the last case: `/loginish` starts with `/login`, so it is public under the current `startsWith` logic. The test asserts `false`, so the module must match a path **segment**, not a prefix. That is a real (if minor) tightening — say so in the commit.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/proxyPaths.test.ts`

Expected: FAIL — `Failed to resolve import "./proxyPaths"`.

- [ ] **Step 3: Write the module**

Create `src/lib/proxyPaths.ts`:

```typescript
/**
 * Which request paths bypass the auth gate — LEAF MODULE (no store, no React).
 *
 * Extracted from the proxy so it can be tested, and because the proxy now needs
 * the same answer twice: once to decide whether an unauthenticated visitor is
 * allowed through, and once to decide what to do when the auth check itself
 * throws. Failing closed on a public path would make an outage redirect
 * /welcome to /welcome forever.
 */

/** Route prefixes that never require a session. Matched by path segment. */
export const PUBLIC_PATH_PREFIXES = [
    '/login',
    '/welcome',
    '/auth/callback',
    '/api/dev-login',
    '/_next',
];

const STATIC_ASSET = /\.(ico|png|jpg|jpeg|svg|css|js|webp)$/;

export function isPublicPath(pathname: string): boolean {
    if (STATIC_ASSET.test(pathname)) return true;
    return PUBLIC_PATH_PREFIXES.some(
        prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/proxyPaths.test.ts`

Expected: PASS — 3 tests.

- [ ] **Step 5: Fail closed**

In `src/proxy.ts`, add the import at the top:

```typescript
import { isPublicPath } from '@/lib/proxyPaths';
```

Replace the auth-check block and the route-protection block (lines 42–71):

```typescript
  // Resolve the session. The auth check runs in the proxy sandbox, whose fetch
  // to Supabase can fail transiently (notably under Turbopack dev).
  // If it does, fail CLOSED: showing a signed-out visitor the sign-in page
  // during a Supabase outage is correct; showing them the app shell is not.
  const pathname = request.nextUrl.pathname;

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.warn('[proxy] auth check failed, failing closed:', error);
    // Public paths still resolve, or the outage redirects /welcome to /welcome
    // forever and locks everyone out of the page that lets them back in.
    if (isPublicPath(pathname)) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/welcome';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Route protection logic
  const isLoginPage = pathname.startsWith('/login');
  const isWelcomePage = pathname.startsWith('/welcome');

  if (!user && !isPublicPath(pathname)) {
    // Unauthenticated visitors land on the public beta landing page
    const url = request.nextUrl.clone();
    url.pathname = '/welcome';
    return NextResponse.redirect(url);
  }
```

The `isLoginPage` / `isWelcomePage` pair below it is unchanged and still drives the "redirect signed-in users away from the sign-in pages" branch at lines 74–78.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src/lib/proxyPaths.ts src/lib/proxyPaths.test.ts src/proxy.ts
```

Expected: no compiler output; all tests PASS; no new eslint output on `proxy.ts` (compare against `git stash` if unsure).

Then simulate the outage: with the dev server running, set `NEXT_PUBLIC_SUPABASE_URL` to an unroutable host in `.env.local`, restart, and confirm that `/` redirects to `/welcome` and that **`/welcome` and `/login` still render**. Restore the real URL afterwards.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: the proxy fails closed on an auth-check exception

It caught a thrown getUser() and passed the request through
unauthenticated, so any Supabase hiccup rendered the app shell to a
signed-out visitor. It now redirects to /welcome — matching what an
unauthenticated visitor already gets — while still letting public paths
resolve, because failing closed on /welcome itself would turn an outage
into a redirect loop.

The public-path test also tightened from a prefix match to a segment match,
so /loginish is no longer treated as part of /login."
```

---

## Task 13: Prove the exports actually open

**Files:**
- Modify: `src/lib/export.ts`
- Create: `src/lib/export.test.ts`
- Modify: `src/lib/epub.test.ts`

Roadmap item `21`. `.docx` and `.epub` are both ZIP containers with strict internal requirements, and `src/lib/export.ts` has **no test file at all** today. Two things were established by probe against this repo's own toolchain before writing this task:

- `URL.createObjectURL` and `Blob.prototype.arrayBuffer` are **undefined** in this jsdom version, so `exportAsDocx` and `exportAsEpub` cannot be called from a test as they stand. The build has to be separable from the download.
- `Packer.toBuffer` works under vitest and its output loads cleanly in JSZip. `Packer.toBlob` is what the browser needs. So the split is: a build function returning the `Document`, the browser path serialising it with `toBlob`, the test path with `toBuffer`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/export.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { buildDocxDocument } from './export';
import type { Document as MFDocument, Scene } from '@/store/workspaceStore';

const doc: MFDocument = {
    id: 'd1', projectId: 'p1', title: 'My Book', content: '', createdAt: new Date(),
};

function scene(id: string, title: string, order: number, content: string): Scene {
    return { id, documentId: 'd1', projectId: 'p1', title, content, order, createdAt: new Date() };
}

describe('buildDocxDocument', () => {
    it('produces an OOXML package Word can open', async () => {
        const built = await buildDocxDocument(doc, [
            scene('s1', 'Chapter One', 0, '<p>Hello <strong>world</strong></p>'),
        ]);
        const zip = await JSZip.loadAsync(await Packer.toBuffer(built));

        // Word refuses to open a .docx missing either of these.
        expect(zip.file('[Content_Types].xml')).not.toBeNull();
        expect(zip.file('_rels/.rels')).not.toBeNull();
        expect(zip.file('word/document.xml')).not.toBeNull();
    });

    it('carries the title, the scene headings and the prose', async () => {
        const built = await buildDocxDocument(doc, [
            scene('s2', 'Second', 1, '<p>beta</p>'),
            scene('s1', 'First', 0, '<p>alpha</p>'),
        ]);
        const zip = await JSZip.loadAsync(await Packer.toBuffer(built));
        const xml = await zip.file('word/document.xml')!.async('string');

        expect(xml).toContain('My Book');
        expect(xml).toContain('First');
        expect(xml).toContain('alpha');
        expect(xml).toContain('beta');
        // Scenes are emitted in `order`, not array order.
        expect(xml.indexOf('alpha')).toBeLessThan(xml.indexOf('beta'));
    });

    it('does not leak entity markup into the manuscript', async () => {
        const built = await buildDocxDocument(doc, [
            scene('s1', 'Ch', 0, '<p>Meet <span class="entity-tag" data-id="e1">Mira</span> here</p>'),
        ]);
        const zip = await JSZip.loadAsync(await Packer.toBuffer(built));
        const xml = await zip.file('word/document.xml')!.async('string');

        expect(xml).toContain('Mira');
        expect(xml).not.toContain('entity-tag');
    });
});
```

Append to `src/lib/epub.test.ts` (add `import JSZip from 'jszip';` at the top):

```typescript
describe('the EPUB binary', () => {
    it('puts mimetype first and stores it uncompressed', async () => {
        const zip = await buildEpubZip(doc, [scene('s1', 'One', 0, '<p>a</p>')],
            { title: 'My Book', identifier: 'fixed-id' });
        const bytes = await zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
        const head = new TextDecoder('latin1').decode(bytes.subarray(0, 38));

        // EPUB 3 §4.1.2: the first entry must be `mimetype`, stored, unencrypted.
        // Reading it out of the local file header is what epubcheck does.
        expect(head.slice(0, 4)).toBe('PK');
        expect(bytes[8]).toBe(0);   // compression method, low byte  — 0 = stored
        expect(bytes[9]).toBe(0);   // compression method, high byte
        expect(head.slice(30, 38)).toBe('mimetype');
    });

    it('has a spine where every itemref resolves to a file in the archive', async () => {
        const zip = await buildEpubZip(doc, [
            scene('s1', 'One', 0, '<p>a</p>'),
            scene('s2', 'Two', 1, '<p>b</p>'),
        ], { title: 'My Book', identifier: 'fixed-id' });
        const reread = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
        const opf = await reread.file('OEBPS/content.opf')!.async('string');

        const hrefById = new Map<string, string>();
        for (const m of opf.matchAll(/<item id="([^"]+)" href="([^"]+)"/g)) hrefById.set(m[1], m[2]);
        const idrefs = [...opf.matchAll(/<itemref idref="([^"]+)"\/>/g)].map(m => m[1]);

        expect(idrefs.length).toBe(2);
        for (const id of idrefs) {
            const href = hrefById.get(id);
            expect(href, `spine references unknown manifest id ${id}`).toBeTruthy();
            expect(reread.file(`OEBPS/${href}`), `missing OEBPS/${href}`).not.toBeNull();
        }
    });
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/lib/export.test.ts src/lib/epub.test.ts
```

Expected: `export.test.ts` FAILS with `"buildDocxDocument" is not exported by "src/lib/export.ts"`. `epub.test.ts` PASSES both new cases — the EPUB builder is already correct, and these assertions are the regression fence that keeps it correct through Phase 4's front-matter work.

- [ ] **Step 3: Split the build from the download**

In `src/lib/export.ts`, change the signature at line 104:

```typescript
/**
 * Builds the .docx as a `docx` Document, without touching the DOM.
 *
 * Split out of exportAsDocx so the output can be opened and inspected in a
 * test: `URL.createObjectURL` does not exist in jsdom, so anything that
 * downloads cannot be called from one.
 */
export async function buildDocxDocument(document: MFDocument, scenes: Scene[]): Promise<Docx.Document> {
```

and replace the tail of the function — from `const blob = await Packer.toBlob(docxApp);` through the closing brace at line 232 — with:

```typescript
    return docxApp;
}

/**
 * Exports a single Document as a rich .docx file formatted to standard
 * manuscript requirements, and triggers the browser download.
 */
export async function exportAsDocx(document: MFDocument, scenes: Scene[]): Promise<Blob> {
    const { Packer } = await import('docx');
    const title = document.title || 'Untitled Document';
    const blob = await Packer.toBlob(await buildDocxDocument(document, scenes));
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${slugify(title)}.docx`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return blob;
}
```

`ExportModal.tsx:53` awaits `exportAsDocx` and discards the returned Blob, so no call site changes.

- [ ] **Step 4: Run them and watch them pass**

```bash
npx vitest run src/lib/export.test.ts src/lib/epub.test.ts
```

Expected: PASS — 3 tests in `export`, 6 in `epub`.

- [ ] **Step 5: Open the real files**

Automated structure checks are not the same as a reader opening the book. With the dev server running and a project that has at least three scenes:

1. Export `.docx`. Open it in Word (or LibreOffice Writer) — confirm the title, one heading per scene, prose in order, and bold/italic preserved.
2. Export `.epub`. Open it in Calibre and in Apple Books or Thorium — confirm the table of contents lists every scene and each entry navigates.
3. Optionally run `epubcheck` on the exported file if it is installed. Record the result in the commit body.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npx eslint src/lib/export.ts src/lib/export.test.ts src/lib/epub.test.ts
```

Expected: no compiler output; all tests PASS; no eslint output.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: prove the .docx and .epub exports actually open

export.ts had no test file at all. buildDocxDocument is split out of
exportAsDocx so the package can be unzipped and inspected — jsdom has no
URL.createObjectURL, so anything that downloads cannot be called from a
test. The .docx assertions check the two parts Word refuses to open
without, plus scene ordering and the fact that entity spans do not leak
into the manuscript.

The EPUB assertions read mimetype out of the ZIP local file header the way
epubcheck does, and walk every spine itemref back to a file in the archive.
Both passed on the first run — this is a fence around behaviour that is
already correct, before Phase 4 adds front matter."
```

---

## Task 14: Full regression

**Files:** none.

- [ ] **Step 1: Green across the board**

```bash
npx tsc --noEmit --pretty false
npx vitest run
npm run build
```

Expected: no compiler output; every test PASS; the build succeeds.

- [ ] **Step 2: No new lint problems**

```bash
git stash
npx eslint src 2>&1 | tail -3 > /tmp/eslint-before.txt
git stash pop
npx eslint src 2>&1 | tail -3
cat /tmp/eslint-before.txt
```

Expected: the same or a lower problem count than the baseline of **377 problems (248 errors, 129 warnings)**. Any increase is a defect introduced by this phase — fix it rather than suppress it.

- [ ] **Step 3: The isolation checks in one pass**

With the dev server running and two real Supabase accounts:

1. Sign in as A, write, wait for "Saved". Sign out. `lorecanvas-workspace` and every `lorecanvas-backup-*` key are gone.
2. Sign in as B on the same browser. Empty workspace. No backups in Settings. Write something. Sign out.
3. Sign in as A. A's work is intact — **B's session did not overwrite A's cloud row**.
4. Sign in as B. B's work is intact.
5. Sign in as A. Restore an automatic backup from Settings — the workspace comes back with content, not empty.
6. Force a quota failure (Task 7 step 8) — the banner appears and clears.
7. Request a magic link from `localhost:4000` — the link returns to `localhost:4000`, signed in.
8. Enter an uninvited email in both the login page and the login modal — neither creates an account.
9. `curl -X POST` `/api/dev-login` against a production build — 404.
10. Point `NEXT_PUBLIC_SUPABASE_URL` at an unroutable host — `/` bounces to `/welcome`, and `/welcome` still renders.

- [ ] **Step 4: Commit the phase marker**

```bash
git commit --allow-empty -m "chore: Phase 3 complete — isolation and data safety

Ten roadmap items (T1-T6, 3a-3c, 21) plus one CRITICAL defect the roadmap
did not have: restoring an automatic backup emptied the workspace, because
zustand's migrate hook receives the bare state and the restore path wrote
that shape straight back into the persist key.

A second user on a shared browser can no longer inherit or destroy the
first user's manuscripts, the app says so when the browser stops saving,
the cloud write refuses to clobber a row it did not read, sign-in works on
any host, and the exports are proven to open."
```

---

## Definition of done

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green, with **at least 60 new tests** across `workspaceOwner`, `syncGate`, `persistQuota`, `authRedirect`, `authPolicy`, `proxyPaths`, `workspaceSync`, `workspaceConflict`, `workspaceOwnership`, `export` and `epub`
- [ ] `npm run build` succeeds
- [ ] `npx eslint src` reports **no more** than the 377-problem baseline
- [ ] Every new file in `src/lib/` is a leaf module: 4-space indent, no store import, no React import, a doc comment saying so
- [ ] Every new test file is `.test.ts` — `vitest.config.ts` does not include `.test.tsx`
- [ ] `grep -rn "ALLOW_DEV_LOGIN" src .env.example` returns nothing
- [ ] `grep -rn "lorecanvas.isomeric.studio" src` returns nothing
- [ ] Signing in as a second user on the same browser shows an empty workspace and cannot write the first user's data into the second user's row
- [ ] Signing out removes `lorecanvas-workspace` and every `lorecanvas-backup-*` key
- [ ] Settings shows only the signed-in user's backups
- [ ] Restoring an automatic backup produces the backed-up workspace, not an empty one
- [ ] A failed local save raises a banner; a successful one clears it
- [ ] One `JSON.stringify` of the workspace per idle window, not one per keystroke
- [ ] A concurrent cloud write is refused and re-hydrated rather than clobbering
- [ ] A World Bible restructure survives a sync round trip against a second device
- [ ] A magic link returns to the host it was requested from
- [ ] Neither login surface creates an account for an uninvited email
- [ ] `POST /api/dev-login` returns 404 in a production build with no environment variable that changes that
- [ ] The proxy redirects to `/welcome` when the auth check throws, and `/welcome` itself still renders
- [ ] An exported `.docx` opens in Word and an exported `.epub` opens in Calibre

---

## What this phase deliberately does not do

Stated here so the gaps are decisions rather than omissions.

| Not done | Where it lives |
|----------|----------------|
| Workspace size limit (`O1`) | Phase 10, spec Part 3g |
| Account deletion and data export (`O2`) | Phase 10, spec Part 3h |
| Rate-limiting `beta_requests` (`O3`) | Phase 10, spec Part 3i |
| Revoking `SELECT` on `public.workspaces` from `anon` (`S6`) and leaked-password protection (`S7`) | Phase 10 — both are dashboard settings, not code |
| Gating Google OAuth signup | Cannot be done from the client. Supabase project setting; verify it in Phase 10 |
| Moving images out of the workspace blob | Explicitly out of scope in the spec |
| `resolveWorkspaceConflict`'s emptiness rule counting World Bibles | `countContent` still counts only the four content arrays. A workspace with a configured bible and no articles is still "empty" for the purposes of that rule. Deliberate: a bible with nothing in it is not work to protect |
| Making the guarded write transactional across the probe | The conditional UPDATE is atomic; the follow-up probe that distinguishes "someone else wrote" from "the row was deleted" is not. A genuine millisecond race between two devices falls back to the upsert. Closing that needs a Postgres function, which is not worth it at launch scale |
