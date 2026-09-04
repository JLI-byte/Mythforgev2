# LoreCanvas Remediation Roadmap

> **For agentic workers:** This is the ordering document, not an executable plan. Each phase below has (or will have) its own plan file under `docs/superpowers/plans/`. Execute one phase at a time with superpowers:subagent-driven-development.

**Goal:** Close every finding from the 17-persona walkthrough dossier and the code review, in an order where each phase makes the next one cheaper.

**Source:** `https://claude.ai/code/artifact/76a7af3e-583e-4ffd-a80f-0c4f0cbf88d4` — 46 build items, 7 removals, 6 absent stages.

---

## Decisions taken (2026-09-03)

Decisions 1-4 resolved the contradictions between personas. Decisions 5-7 came from auditing the app against a hosted multi-tenant SaaS target. Everything below assumes all seven.

| # | Decision | Consequence |
|---|----------|-------------|
| 1 | **Story + lore only** | Withdraw Screenplay, Visual Novel, Lyrics and Script/Report work types. Kills items `2b`, `2f`, `04b`, `04e` and converts `04d` into a larger deletion. |
| 2 | **Cut Music & Soundscapes** | Social Media Hub and Beta Feedback panel are **kept** — `D2` and `D3` are not actioned. The "trim 46 methods to 6" half was **found already built** on verification: `MethodLibrary.tsx` has three-tier disclosure. `D4` shrinks to deleting the unused `STARTER_METHODS` export. |
| 3 | **Implement `[[`** | Item `2e` becomes a build, not a README correction. The other three false README claims still get corrected. |
| 4 | **Withdraw the academic path** | No citation subsystem. Removes the referencing prompt with the Script/Report type. |
| 5 | **Hosted multi-tenant SaaS** | Confirmed deployment target. Phases 2, 3 and 10 exist because of it. Hosting provider not yet chosen — Vercel recommended, nothing in the plan depends on it. |
| 6 | **Remove every AI feature** | ~3,500 lines. Deletes all three SaaS blockers rather than fixing them, and voids the earlier platform-pays billing decision entirely — no keys, no metering, no quota. See Phase 2. |
| 7 | **Rebuild three lore features as rules** | Interviews as self-guided forms, Consistency & Gaps and Article Suggestions as deterministic rules. See Phase 5. |

---

## Why this order

The ordering is not by severity. It is by **what makes the next phase cheaper**:

1. **Subtraction before anything else.** Most later phases touch stylesheets, modals, store actions or work-type branches. Doing design tokens, accessibility or performance work first means doing it to ~1,900 lines of code that is about to be deleted, and to four work types that are about to be withdrawn. Deleting first is the single largest cost reduction available.
2. **Data safety next**, because it is the only category where the failure is silent and unrecoverable, and because it is entirely independent of everything else.
3. **The core loop before its decoration.** A user who cannot export a manuscript is not helped by a better type scale.
4. **Accessibility before the design system**, because focus states, live regions and dialog semantics constrain the token work — not the other way round.
5. **Design system before polish**, so polish is expressed in tokens rather than in literals that then need converting.
6. **Removing AI second**, immediately after the work-type subtraction, because it is the largest single deletion available and it eliminates three launch blockers outright rather than requiring them to be designed around.
7. **Isolation with data safety**, in Phase 3 — the sign-out leak and the persist-quota bug are the same class of defect and share the same fix surface.
8. **Lore rules after the core loop**, because the `broken-link` rule needs `[[` linking to exist first.
9. **Launch readiness last**, because it blocks *launch* rather than *development*.

---

## Phase 1 — Subtraction

**Plan:** `2026-09-03-phase-1-subtraction.md` · **Status:** COMPLETE (9 commits, 9,637 lines deleted — 3.7x the estimate)

Removes ~2,600 lines and four work types. Everything else in this roadmap gets smaller as a result.

| Item | What | Source |
|------|------|--------|
| `04d` | Delete `ScreenplayWritingZone`, `LyricsWritingZone`, `ReportWritingZone`, `VisualNovelWritingZone` (1,938 lines; the first three differ from `StoryWritingZone` by four lines each) | Completionist |
| `2b` | Withdraw Screenplay — delete `ScreenplayEditor.tsx`, `src/lib/screenplay/` | Screenwriter |
| `2f` | Withdraw Visual Novel — delete `src/components/editor/vn/`, `renpyExport.ts`, `vnTimelineExport.ts`, `visualNovel.ts` (616 lines) | VN dev |
| `04b` | Withdraw Lyrics | Lyricist |
| `2g` | Withdraw Script/Report and the referencing prompt | Student |
| `D1` | Cut `MusicPlayerPanel`, `SpotifyPlayer` | Focus |
| `D4` | Delete the unused `STARTER_METHODS` export. The six-plus-drawer design the dossier asked for is **already shipping** — no UI work | Focus |
| `R2` | Delete 8 exported components nothing renders | Completionist |
| `R3` | Delete **4** uncalled store actions. `deleteSocialPost` and `moveWorldBibleType` belong to kept features and move to Phase 7 | Completionist |

**Dropped as moot by decision 1:** `10` (carry the work type forward), `15h` (a door per work type), `15f` (stop saying "world" on non-fiction paths), `04e` (comics front door).

---

## Phase 2 — Remove AI

**Plan:** `2026-09-03-phase-2-remove-ai.md` · **Status:** COMPLETE (8 commits, 5,477 lines deleted) · **Spec:** `../specs/2026-09-03-saas-conversion-design.md` Part 1 · **Depends on:** Phase 1

~3,500 lines. Removes all three SaaS blockers at once, plus the entire billing/quota subsystem that a platform-pays AI model would otherwise have required.

| Item | What |
|------|------|
| `A1` | Delete five API routes: `research-chat`, `ai-settings`, `ai-settings/test`, `local-models`, `openrouter-credits` |
| `A2` | Delete `researchToolDefs.ts`, `aiSettings.ts`, `aiSettingsStore.ts`, `localServer.ts`, `comfyClient.ts`, `comfyWorkflow.ts` and their tests |
| `A3` | Delete `ResearchChatPanel` (950 lines), `ChatModelPicker`, `CreditTracker`, `ContextRing`, `ChatTrays`, `AISettingsSection` |
| `A4` | Remove `chatHistories` from the store, initial state and `partializeWorkspace`; delete `researchChatTypes.ts` and the `sanitizeChatHistories` call in the persist path |
| `A5` | Remove `@anthropic-ai/claude-agent-sdk`; delete `serializeBoard` from `researchBoard.ts` (AI-context only) |

**Kept:** the research board and its widgets, `makeNoteCard`, `interviews.ts`, `InterviewEditorModal`, `InterviewMenu`, `ResearchBoardBar`.

**Supersedes** the former S1/S2/S3 blockers — all three are deleted rather than fixed.

---

## Phase 3 — Stop losing work, and stop leaking it between users

**Plan:** `2026-09-03-phase-3-isolation-and-data-safety.md` · **Status:** COMPLETE (13 commits; Task 5 was already shipped before Phase 1) · **Spec:** Part 3a–3f · **Depends on:** Phase 2

The data-safety findings, plus the five isolation defects. `T1` is the only defect in this roadmap that destroys a user's work irreversibly.

| Item | What | Severity |
|------|------|----------|
| `T1` | **Sign-out does not clear the workspace.** Persist key is the static `'lorecanvas-workspace'`; no `resetWorkspace`, no `SIGNED_OUT` handler exists anywhere. User B on user A's browser sees A's manuscripts, and the next autosave writes them into B's cloud row — destroying B's work if they had any. Three layers: stamp `ownerUserId` in the persisted blob and discard on mismatch, clear on sign-out, clear on auth change | **CRITICAL** |
| `T2` | Backup keys `lorecanvas-backup-*` are not user-scoped either — `listDataBackups()` offers A's backups to B, restorable in one click | HIGH |
| `T7` | **Restoring an automatic backup empties the workspace.** Zustand hands `migrate` the bare state, not the `{state, version}` envelope, so the backup written at `workspaceStore.ts:2685` is stored bare — and `restoreDataBackup` (`:2733`) writes it straight back into the persist key. The next load hydrates nothing. Automatic backups are exactly the ones taken before a migration, so the recovery path destroys what you reach for it to recover. `createManualBackup` copies the real envelope and is unaffected. Found while planning Phase 3; in no audit or walkthrough | **CRITICAL** |
| `T3` | **Sign-in is broken on any host but the developer's.** `auth/callback` hardcodes `https://lorecanvas.isomeric.studio`; `x-forwarded-host` is read and never used; the dev branch targets port 3000 while dev serves 4000 | HIGH |
| `T4` | Signup gating is inconsistent — `useLoginForm` sets `shouldCreateUser: false`, `LoginModal` omits it, OAuth has no gate | HIGH |
| `T5` | Delete the `ALLOW_DEV_LOGIN` escape hatch — one env var from an internet-reachable session as the owner | HIGH |
| `T6` | `src/proxy.ts` fails open on an auth-check exception. Fail closed | MEDIUM |
| `3a` | Surface a banner when `localStorage.setItem` throws. Currently `catch { /* quota */ }` | HIGH |
| `3b` | Put the concurrency guard on the sync **write**, not just the hydrate. 47 keys persist; 4 are conflict-checked; World Bible actions write no `updatedAt` | HIGH |
| `3c` | Move the persist debounce above the `JSON.stringify` — a full-workspace serialise currently runs every ~300 ms while typing | HIGH |
| `21` | Verify exported `.docx` and `.epub` actually open | P3 |

---

## Phase 4 — The core loop

**Plan:** `2026-09-03-phase-4-core-loop.md` · **Status:** COMPLETE (13 commits) · **Depends on:** Phase 1

With four work types and the AI gone, the loop is exactly: write a manuscript, build lore, link them, get a book out.

| Item | What |
|------|------|
| `02` | Export the whole manuscript, not one chapter |
| `11` | Front matter (title page, copyright, dedication, contents) and a compile step |
| `2e` | Implement `[[` entity linking. `InlineEntryCreator` exists and is mounted; only World Bible buttons call it. The `@` mention extension proves the pattern |
| `2e.2` | Correct the remaining false README claims. The "four AI providers" claim is now resolved by deletion rather than correction |
| `03` | Land on what the user just made. Exporting an outline builds a chapter then opens the old empty one |
| `15c` | Bind Export to the document actually open |

**Dropped, resolved by Phase 2:** `01` (make AI failures readable).

**Absent stages closed here:** manuscript assembly, front matter.

---

## Phase 5 — Lore without AI

**Plan:** `2026-09-03-phase-5-lore-without-ai.md` · **Status:** ready · **Spec:** Part 2 · **Depends on:** Phase 4 for `broken-link` only

Rebuilds the three AI-driven lore features as deterministic rules. Instant, free, testable, and incapable of inventing a finding that is not there.

| Item | What |
|------|------|
| `L1` | **Interviews as self-guided forms.** New `InterviewRunner` — one question at a time, Back/Skip/Finish, builds an article from the Q&A pairs. `InterviewMenu.onLaunch` opens the runner instead of the chat |
| `L2` | **Consistency & Gaps as rules.** New leaf module `src/lib/loreRules.ts` with six pure rules: `empty-description`, `uncategorised`, `never-referenced`, `lonely-category`, `broken-link`, `duplicate-name` |
| `L3` | **Article Suggestions as rules.** `suggestArticles()` in the same module — capitalised names recurring at least three times across scenes with no matching entity |

`broken-link` needs `[[` from Phase 4. The other five rules have no such dependency and could land earlier.

---

## Phase 6 — Accessibility

**Plan:** `2026-09-03-phase-6-accessibility.md` · **Status:** ready · **Depends on:** Phases 1 and 2 (fewer surfaces to fix)

| Item | What |
|------|------|
| `2c` | The work-type modal gates every creation and has no `role="dialog"`, no `aria-modal`, no accessible name, no focus entry, no Escape, and sits 29 tab stops deep |
| `2d` | Add live regions. Only two exist in the whole product (ErrorBoundary.tsx:47, WorldBibleBook.tsx:125) |
| `15d` | Take the chrome out of `<main>`; add a skip link |
| `18` | `role="dialog"` and `aria-modal` on the remaining dialogs |
| `19` | Name the remaining unnamed controls |

---

## Phase 7 — First run and coming back

**Plan:** `2026-09-03-phase-7-first-run.md` · **Status:** ready · **Depends on:** Phase 4

| Item | What |
|------|------|
| `06` + `06b` | **Merged.** Add a `hasOnboarded` flag. Make Home be "Where do you want to begin?" on an empty workspace. Then one dismissible hint at first contact with each invisible feature: `@` mentions, the resizable column, the board's add buttons. No tour, no docs site |
| `15g` | Give the app a memory of absence — what changed, where you left off |
| `15b` | Measure progress in the unit the work uses, not just words per day |

**Absent stage closed here:** structural progress.

---

## Phase 8 — Design system

**Plan:** `2026-09-03-phase-8-design-system.md` · **Status:** ready · **Depends on:** Phases 1, 2 and 6

Ordered internally: tokens exist before anything converts to them.

| Item | What |
|------|------|
| `05` | Write the token file |
| `04` | Convert spacing to `rem` |
| `07` | Collapse the type scale to seven steps |
| `08` | Ban raw colour in component stylesheets |
| `09` | Give the manuscript its own typeface |
| `15` | Consolidate radii, elevation and motion |
| `14` | Container queries for the docked panels |
| `20` | Cascade layers, then logical properties |
| `16` | Fewer than sixteen empty slots |
| `17` | One visual language for books |

---

## Phase 9 — Wire what is already built

**Plan:** `2026-09-03-phase-9-wire-what-exists.md` · **Status:** ready · **Depends on:** Phase 1

| Item | What |
|------|------|
| `04c` | Plug in the finished-but-unwired store actions that survive Phases 1–2: `toggleStandardFormat` (note `editorMaxWidth` is read by **no component**, so the toggle is invisible until that is routed too), `repairStreak`, `deleteScene`, `deleteDocument`, `reorderScenes`, plus `deleteSocialPost` and `moveWorldBibleType` held back from Phase 1. **Correction:** badges are **not** unearnable — `recordWritingSession` calls `checkBadges` inline at `workspaceStore.ts:1931`. The narrower gap is three paths that move `streakState` without awarding: `updateGoalConfig`, `repairStreak` and `onRehydrateStorage` |
| `04f` | Expose code blocks — the ProseMirror node already exists |
| `15e` | Give the research "Link" card a URL field. **Correction:** the add buttons already render on an empty board — `WritingDesk.tsx:913` is `{isResearch && (` with no `widgets.length` term — so that half is dropped |
| `13` | A visible resize affordance on the writing column |

**Dropped, resolved by Phase 2:** `12` (Enter sends in the chat).

**Absent stage closed here:** submission format.

---

## Phase 10 — Launch readiness

**Plan:** `2026-09-03-phase-10-launch-readiness.md` · **Status:** ready · **Spec:** Part 3g–3i · **Blocks launch, not development**

Phases 2 and 3 removed every blocker that used to live here. What remains is operational.

### Verified already correct

```
workspaces │ RLS enabled │ policy "Users own their workspace"
           │ cmd: ALL    │ qual: auth.uid() = user_id
           │             │ with_check: auth.uid() = user_id
```

Cross-account data access is genuinely closed at the database. `beta_feedback` and `beta_requests` also have RLS on.

| Item | What |
|------|------|
| `O1` | **Workspace size limit.** `workspaces.data` is an unbounded JSON blob with images stored as data URLs inside it. Soft limit warns and names the largest contributor; hard limit refuses the cloud write, keeps working locally, and says so |
| `O2` | **Account deletion and data export.** Table stakes for a paid product and a legal requirement in several jurisdictions. The "writer who wants out" persona was queued and never run |
| `O3` | Rate-limit `beta_requests` — the policy accepts anonymous inserts with no throttle |
| `S5` | Put the `workspaces` schema in `supabase/migrations/`. Only `beta_feedback` is version-controlled |
| `S6` | Revoke `SELECT` on `public.workspaces` from `anon` so it leaves the GraphQL schema. RLS already blocks the rows — discoverability only |
| `S7` | Enable leaked-password protection in Auth settings |
| `3f` | `lazy()` the `ExportModal` — it statically imports `epub.ts`, which statically imports `jszip`, dragging ~30 KB into the entry bundle for every user. **The `.beatCard` half moved to Phase 8**, which found 21 duplicated rule blocks across 11 stylesheets rather than the one |
| `E1` | **Remove the Electron toolchain.** `npm uninstall electron electron-builder electron-packager concurrently wait-on cross-env`, delete the `postinstall` hook (it breaks container builds), `scripts/build-electron.js`, and the 84 MB `bin/node.exe` tracked in git. Removes ~980 of 1,184 packages and all 39 reported vulnerabilities, none of which ever reached the deployed app |

---

## Deferred — need a decision before they can be planned

Two absent stages from the dossier have no item because they need a product call first, not an implementation.

- **Revision / draft-to-draft comparison.** Version History snapshots single scenes. There is no way to see what changed between drafts. This is a subsystem, not a fix.
- **Actual publishing.** Decision 2 kept the Social Media Hub, so "publication" still means sharing a streak. Nothing reaches a store, a beta reader or a submission. Keeping the Hub was a decision about the Hub, not a decision that this gap is acceptable.

---

## Tracking

46 items in the dossier, plus 22 added by the code review and the three SaaS audits.

- **Actioned across phases 1-10:** 40 dossier items + 22 audit items
- **Dropped as moot by decision 1:** 4 (`10`, `15h`, `15f`, `04e`)
- **Dropped as moot by decision 6:** 2 (`01` AI error handling, `12` Enter sends in chat)
- **Converted from build to deletion:** 5 (`2b`, `2f`, `04b`, `2g`, `04d`)
- **Found already built on verification:** 1 (`D4` — the method picker already has three-tier disclosure)
- **Deferred pending a decision:** 2 absent stages

**All ten phases have written plans**, one per subsystem, each producing working software on its
own. Together they are ~21,600 lines. Every plan was written against the source and several corrected
the roadmap where a dossier finding did not survive checking — those corrections are recorded inline
in the item they affect.
