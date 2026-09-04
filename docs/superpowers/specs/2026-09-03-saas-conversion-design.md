# LoreCanvas SaaS Conversion — Design

**Date:** 2026-09-03
**Status:** awaiting review
**Supersedes:** the "S1 research-chat rearchitecture" item in `2026-09-03-remediation-roadmap.md`

---

## Context

LoreCanvas is being narrowed to two nouns — **manuscript and lore** — and deployed as a hosted
multi-tenant SaaS product. Three audits of the codebase against that target found that the app is
structurally single-tenant on the server: every AI feature is wired to the operator's own machine and
personal accounts, and several client-side assumptions leak one user's work into another's account.

This document designs the conversion. It does not cover the design-system, accessibility or core-loop
work, which are unaffected and already scheduled in the roadmap.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Remove every AI feature entirely** | Removes ~3,500 lines and, with them, all three SaaS blockers: the Claude Code subprocess billing to the operator's personal Max plan, the server-side SSRF, and the process spawn. Also removes the entire billing/quota/metering subsystem that would otherwise be required |
| 2 | **Rebuild Interviews, Consistency & Gaps, and Article Suggestions as deterministic rules** | These are lore features, and lore is one of the two surviving nouns. None of them needs a language model. Rules are instant, free, testable, and cannot invent a finding that is not there |
| 3 | **Fix multi-tenancy isolation before launch** | Eight defects, five of which leak or destroy data across accounts |

### Superseded by decision 1

An earlier decision in this session chose **platform-pays AI with per-plan quota**. Decision 1 removes
AI entirely, so that decision is void. No API keys, no metering, no quota tables, no spend caps.

### Deferred

**Hosting target.** Vercel is recommended — one developer, zero infra work, native Next 16 — but is not
yet confirmed. Nothing in this design depends on it: removing AI removes the long-running streaming
route that made the choice load-bearing. The remaining routes are short request/response.

---

## Part 1 — Remove AI

### Deleted

**API routes (all five):**
- `src/app/api/research-chat/route.ts`
- `src/app/api/ai-settings/route.ts`
- `src/app/api/ai-settings/test/route.ts`
- `src/app/api/local-models/route.ts`
- `src/app/api/openrouter-credits/route.ts`

**Libraries:**
- `src/lib/researchToolDefs.ts`
- `src/lib/aiSettings.ts`, `src/lib/aiSettings.test.ts`
- `src/lib/aiSettingsStore.ts`
- `src/lib/localServer.ts`
- `src/lib/comfyClient.ts`
- `src/lib/comfyWorkflow.ts`, `src/lib/comfyWorkflow.test.ts`

**Components:**
- `src/components/editor/research/ResearchChatPanel.tsx` (950 lines)
- `src/components/editor/research/ChatModelPicker.tsx`
- `src/components/editor/research/CreditTracker.tsx`
- `src/components/editor/research/ContextRing.tsx`
- `src/components/editor/research/ChatTrays.tsx`
- `src/components/ui/AISettingsSection.tsx`

**Store:** `chatHistories` and its actions, removed from the interface, the initial state and
`partializeWorkspace`. `src/lib/researchChatTypes.ts` and its `sanitizeChatHistories` call inside
`partializeWorkspace` go with it — which also removes one synchronous cost from the persist path.

**Dependency:** `@anthropic-ai/claude-agent-sdk`.

### Kept

- `src/lib/researchBoard.ts` — `makeNoteCard` is called from `HomePage.tsx`, outside any AI path.
  Its `serializeBoard` function existed only to build AI context and is deleted with the chat.
- The research board itself. Cards are ordinary `DeskWidget`s — `sticky` = Note, `reference` = Link,
  `image` = Clipping — using the same widget system as the Writing Desk. No AI involved.
- `src/lib/interviews.ts`, `InterviewEditorModal.tsx`, `InterviewMenu.tsx` — the guides are data and
  the authoring tool is independent of how a guide is delivered. Part 2 rewires the launcher.
- `src/components/editor/research/ResearchBoardBar.tsx` — board tab switcher, no AI.

### Consequence to accept

Between this phase and Part 2, the Research tab is a manual board with no interview runner. This is a
deliberate, temporary reduction. Part 2 restores the interviews.

---

## Part 2 — Lore without AI

Three features, one new leaf module, one new component.

### 2a. Interviews as self-guided forms

The guides already exist as data — built-ins plus whatever the user authors in `InterviewEditorModal`.
Previously `/interview <title>` passed the guide to the model, which asked the questions. Now the app
asks them.

**New component:** `src/components/editor/research/InterviewRunner.tsx`

- One question at a time, with a free-text answer field
- Progress indicator ("4 of 11"), Back and Skip, and an explicit Finish
- Answers held in local component state while running; nothing persisted mid-run
- On Finish, builds an article: each question becomes an `<h3>`, each answer the paragraph beneath it,
  skipped questions omitted entirely
- The article is created through the existing entity/article creation path, so it lands in the World
  Bible exactly as a hand-written one does

`InterviewMenu`'s `onLaunch` changes from "send the guide to the chat" to "open the runner". Its
`disabled` prop, which existed to block launches during streaming, is removed.

**Why this is better than the AI version:** every question is always asked, in order, with no model
deciding to skip or reword one. The output shape is predictable, so the article template is stable.

### 2b. Consistency & Gaps as rules

**New leaf module:** `src/lib/loreRules.ts` — pure, no store import, no React, 4-space indent, matching
the existing leaf-module convention in `src/lib/`.

Shape:

```typescript
export interface LoreFinding {
    ruleId: string;
    severity: 'gap' | 'inconsistency';
    entityId?: string;
    message: string;
}

export interface LoreRuleInput {
    entities: Entity[];
    scenes: Scene[];
    documents: Document[];
    worldKey: string;
}

export function runLoreRules(input: LoreRuleInput): LoreFinding[];
```

Rules, each a named pure function so it can be unit-tested in isolation:

| Rule | Severity | Detects |
|------|----------|---------|
| `empty-description` | gap | Entity whose description is empty or whitespace |
| `uncategorised` | gap | Entity with no `categoryId` |
| `never-referenced` | gap | Entity whose name appears in no scene body and no other entity's article |
| `lonely-category` | gap | Category containing exactly one entity |
| `broken-link` | inconsistency | A `[[…]]` link whose target entity does not exist |
| `duplicate-name` | inconsistency | Two entities in the same world with the same name, case-insensitive |

`broken-link` depends on the `[[` implementation landing first — see Ordering below.

Findings render on the existing Consistency & Gaps board, replacing the AI-populated cards. Each
finding links to the entity it names.

### 2c. Article Suggestions as rules

The same module, a separate exported function so the two boards stay independent:

```typescript
export interface ArticleSuggestion {
    name: string;
    occurrences: number;
    sampleSceneId: string;
}

export function suggestArticles(input: LoreRuleInput): ArticleSuggestion[];
```

**Detection:** strip scene HTML to plain text, extract candidate proper nouns (capitalised words and
capitalised multi-word sequences), discard any that match an existing entity name case-insensitively,
discard sentence-initial single words that are also common English words, and keep candidates
occurring at least **three** times across the project.

The threshold is a named constant, not a literal, so it can be tuned without hunting through the code.

Once `[[` linking exists, an explicit `[[Name]]` with no matching entity is a far stronger signal than
frequency, and `broken-link` covers it. Frequency detection stays as the discovery path for names the
writer has not linked yet.

---

## Part 3 — Multi-tenancy isolation

Eight defects. Five leak or destroy data across accounts; three are operational gaps.

### 3a. Sign-out does not clear the workspace — CRITICAL

**Current behaviour, verified:**

```js
const handleSignOut = async () => {
  await supabase.auth.signOut();
  window.location.href = '/login';
};
```

The zustand persist key is the static string `'lorecanvas-workspace'` — not scoped by user. There is no
`resetWorkspace`, no `clearWorkspace` and no `SIGNED_OUT` handler anywhere in `src/`.
`useSupabaseSync.ts:51` sets `hydrationOkRef.current = true` *before* testing whether a cloud row
exists.

**Failure:** user B signs in on a browser user A used. The store rehydrates A's manuscripts. B has no
cloud row, so conflict resolution never runs. Hydration is already marked OK, so the next autosave
writes **A's manuscripts into B's cloud row**. If B had existing work and A's timestamps are newer,
`resolveWorkspaceConflict` keeps A's data and overwrites B's row with it. B's work is destroyed,
silently and irreversibly. RLS cannot help — the client is legitimately authenticated as B.

**Design — three layers, because any one of them can be bypassed:**

1. **Stamp the owner.** `partializeWorkspace` gains `ownerUserId`. On rehydrate, if the stored
   `ownerUserId` is present and does not match the current session's user id, discard the persisted
   state and start from initial state instead of merging it.
2. **Clear on sign-out.** `handleSignOut` calls a new `resetWorkspace()` store action and removes the
   persisted key and every `lorecanvas-backup-*` key before redirecting.
3. **Clear on auth change.** The `onAuthStateChange` handler in `SupabaseSyncProvider` calls the same
   reset on `SIGNED_OUT`.

Layer 1 is the one that matters: it holds even when sign-out never ran, which is the common case — a
closed tab, a crash, an expired session, or a second person simply opening the browser.

**Guard against the destructive half:** `useSupabaseSync` must not set `hydrationOkRef.current = true`
until it has either applied cloud state or confirmed the local state belongs to this user.

### 3b. Backup keys are not user-scoped either

`lorecanvas-backup-v{version}-{timestamp}` carries no user id, so `listDataBackups()` offers user A's
backups in user B's Settings, restorable with one click. Covered by the same reset in 3a: the key sweep
must include the backup prefix, and `listDataBackups` must filter by owner.

Settings' "Download backup" reads `localStorage['lorecanvas-workspace']` directly and has the same
exposure. Once 3a lands, the store is either empty or the current user's, and this resolves with it.

### 3c. Sign-in is broken on any domain but the developer's

```js
const redirectBase = isLocalEnv
  ? 'http://localhost:3000'
  : 'https://lorecanvas.isomeric.studio';
```

`x-forwarded-host` is read on the preceding line and never used. Every magic-link click lands on that
one host regardless of deployment, where the session cookie does not exist, so the user arrives
unauthenticated and bounces to `/welcome`. The development branch also targets port 3000 while the dev
server runs on 4000, so that path is broken today.

**Design:** derive the redirect base from the request — `x-forwarded-host` plus `x-forwarded-proto`
when present, falling back to the request's own `origin`. No hardcoded hostname, no hardcoded port.
The existing open-redirect guard on the `next` parameter is correct and stays exactly as it is.

### 3d. Signup gating is inconsistent

`useLoginForm.ts:45` sets `shouldCreateUser: false`. `LoginModal.tsx:33` omits it — GoTrue defaults to
`true` — and `signInWithOAuth` at `:51` has no gate at all.

**Design:** one shared sign-in helper used by every surface, with the invite policy expressed once. The
`beta_requests` table stays as lead capture; the enforcement remains Supabase's own signup setting,
which the helper must not be able to contradict.

### 3e. `dev-login` is one environment variable from account takeover

Correctly 404'd today, gated on `NODE_ENV === 'development' || ALLOW_DEV_LOGIN === '1'`. The risk is
purely operational: setting that variable on a hosted box hands anyone on the internet a session as
`DEV_LOGIN_EMAIL`.

**Design:** delete the `ALLOW_DEV_LOGIN` escape hatch. The route stays gated on `NODE_ENV` alone, which
cannot be `development` in a production build. Testing a production build locally is not worth an
internet-reachable backdoor.

### 3f. The proxy fails open

`src/proxy.ts` catches a thrown `getUser()` and returns the request through unauthenticated. Phase 2
deletes five of the six API routes, so most of the blast radius goes with them, but page routes still
pass an unauthenticated request through on any Supabase hiccup.

**Design:** fail closed — redirect to `/login` on an auth-check exception. A transient Supabase outage
showing a sign-in page is the correct behaviour; showing the app shell is not.

### 3g. No workspace size limit

`workspaces.data` is an unbounded JSON blob and images are stored as data URLs inside it. One user with
a few hundred megabytes of pasted images is both a database problem and a cost problem, with nothing to
stop them.

**Design:** measure the serialised workspace before upload. Past a soft limit, warn the user in the UI
and name the largest contributor. Past a hard limit, refuse the cloud write, keep working locally, and
say so plainly. Both limits are named constants. This is a guard rail, not a quota system — moving
images to object storage is the real fix and is explicitly out of scope here.

### 3h. No account deletion or data export

Table stakes for a paid product and a legal requirement in several jurisdictions. The dossier queued a
"writer who wants out" persona that was never run.

**Design:** a Settings section with two actions — export everything as a single JSON file (the existing
backup path, made complete and honest about what it contains), and delete the account, which removes
the Supabase auth user and the `workspaces` row, with a typed confirmation.

### 3i. No rate limit on `beta_requests`

The policy accepts anonymous inserts with no throttle. **Design:** a per-IP rate limit on the insert
path, or a Postgres constraint bounding inserts per email per day.

---

## Ordering

The full ordering lives in `2026-09-03-remediation-roadmap.md`. The constraints this design imposes:

1. **Part 1 before Part 2.** The interview runner replaces a launcher that currently targets the chat.
2. **`[[` linking before the `broken-link` rule.** `[[` is scheduled in the core-loop phase. The other
   five rules have no such dependency and can land earlier if useful; only `broken-link` waits.
3. **Part 3a is independent and urgent.** It does not depend on any other work and is the only defect
   here that destroys data. It goes in the data-safety phase, first.
4. **Parts 3g–3i are operational** and belong immediately before launch, not before development.

---

## Out of scope

Named explicitly so they are decisions rather than omissions:

- **Moving images to object storage.** The right fix for workspace size; a separate project.
- **Revision / draft-to-draft comparison.** Still deferred, still needs its own design.
- **What "publishing" means.** The Social Media Hub was kept, so publication still means sharing a
  streak. That gap is unchanged by this design.
- **Per-row workspace sharding.** The one-blob-per-user model stays. It is fine at launch scale and the
  cost half of it is worth revisiting after the first hundred paying writers, not before the first.

---

## Success criteria

- No API route reads or writes state shared between users
- No `os.homedir()`, `spawn`, or server-side fetch to a user-supplied URL anywhere in `src/`
- Signing in as a second user on the same browser shows an empty workspace, and cannot write the first
  user's data into the second user's row
- Sign-in works on any deployment hostname, including previews
- The three lore features work with no network calls beyond Supabase
- `npm audit --omit=dev` clean after the Electron toolchain is removed
