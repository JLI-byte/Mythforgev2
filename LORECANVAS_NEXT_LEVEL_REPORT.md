# LoreCanvas — Next-Level Product and Engineering Report

**Prepared:** September 11, 2026  
**Purpose:** Implementation handoff for the next major LoreCanvas improvement cycle  
**Product boundary:** Desktop-first SaaS for fiction writers and worldbuilders. Phone editing is intentionally out of scope for the current launch.

## Executive summary

LoreCanvas already has the foundations of a differentiated product. Its strongest idea is not simply “World Anvil plus a manuscript editor”; it is a writing environment where research, structure, prose, and lore remain connected throughout the creative process. The Workshop progression, infinite Writing Desk, World Bible, dossiers, example project, goals, version history, backups, and export options form a compelling whole.

The application is not missing another large batch of loosely connected modules. The next level is reliability, coherence, trust, polish, and proof that the complete writing loop works under real-world load.

The recommended launch position is:

> A desktop writing studio with worldbuilding built directly into the writing process.

The recommended initial customer is a fantasy or science-fiction novelist who currently spreads their work across tools such as Scrivener, Google Docs, Notion, Pinterest, and World Anvil.

The most important work before charging customers is:

1. Prove that manuscripts cannot be silently lost or overwritten.
2. Make the primary authoring loop consistently understandable and responsive.
3. Add end-to-end coverage for the workflows that currently have only unit-level protection.
4. Resolve the verified editor warning, authentication error handling, keyboard-access issues, and maintenance hotspots.
5. Add the operational, legal, billing, and support systems required by a real SaaS.

## Verified baseline

The following checks were completed against the current repository:

- ESLint passes.
- TypeScript checking passes.
- The optimized Next.js production build passes when its configured Google fonts are reachable.
- 835 tests pass across 322 test suites.
- Authentication, onboarding, example-project creation, Home, Bookshelf, Workshop, Writing Desk, and World Bible were inspected in the running application.
- The authenticated application produced a repeatable TipTap duplicate-extension warning.
- The production build has a network dependency for Google font acquisition.

This is a strong baseline. The report below focuses on remaining risks and opportunities rather than re-listing completed work from `IMPROVEMENT_PLAN.md`.

---

## Priority definitions

- **P0 — Launch blocker:** Must be resolved or explicitly accepted before taking payment.
- **P1 — High priority:** Materially affects trust, usability, accessibility, or product quality.
- **P2 — Important improvement:** Should follow soon after the core launch blockers.
- **P3 — Later expansion:** Competitive or strategic work that should not delay the initial launch.

---

# 1. Verified bugs and engineering issues

## P0: Prove the save, synchronization, and recovery lifecycle end to end

The repository contains careful conflict handling, debounced persistence, backups, quota reporting, ownership isolation, and version history. Unit coverage is extensive. However, the most important user promise has not yet been validated through a browser-level test using a realistically large manuscript.

### Required work

- Add an end-to-end test that creates a project, writes text, waits for save confirmation, reloads, and verifies exact content recovery.
- Repeat the flow while authenticated so local and cloud persistence are both exercised.
- Test offline editing followed by reconnection.
- Test two browser tabs modifying the same workspace.
- Test an expired session during editing.
- Test local quota exhaustion and a rejected Supabase write.
- Test restoring a backup over newer local state.
- Test signing out and signing in as another user on the same machine.
- Exercise at least a 120,000-word manuscript, 100 scenes, 500 lore entries, large images, and meaningful version history.

### Acceptance criteria

- No acknowledged save may disappear after reload.
- A failed local or cloud save must remain visibly failed until recovered.
- Conflict resolution must never silently discard either version.
- The user must be able to export or recover their work during a cloud outage.
- The UI must clearly distinguish `Saved locally`, `Synced`, `Syncing`, `Offline`, `Conflict`, and `Save failed`.

## P1: Remove the duplicate TipTap underline extension

Opening the example manuscript logs:

> `[tiptap warn]: Duplicate extension names found: ['underline']. This can lead to issues.`

`StarterKit` in the installed TipTap version supplies underline, while `Underline` is also registered explicitly in:

- `src/components/editor/desk/DeskTipTapEditor.tsx`
- `src/components/editor/desk/BookViewEditor.tsx`

### Required work

- Use one underline extension registration strategy in both editors.
- Prefer a shared editor-extension factory so both editor modes cannot drift.
- Add a component-level test that mounts each editor and fails on unexpected console warnings.

### Acceptance criteria

- Opening a chapter with one or several scene editors produces no TipTap duplicate-extension warning.
- Underline remains functional in existing documents and newly entered text.

## P1: Handle authentication service outages cleanly

When Supabase was unavailable, the developer sign-in path surfaced the raw message `fetch failed`. The request in `src/app/api/dev-login/route.ts` has no error boundary around `signInWithPassword`.

### Required work

- Catch unexpected Supabase/network failures in the development sign-in route.
- Return a structured `503` response with a safe, friendly message.
- Preserve a diagnostic cause in server logs without exposing credentials or internal details.
- Standardize authentication errors for magic-link login, OAuth callback, session refresh, and developer login.
- Add retry affordances where retry is meaningful.
- Add `src/app/error.tsx` and `src/app/global-error.tsx` with recovery actions and nontechnical copy.

### Acceptance criteria

- A backend outage never displays `fetch failed`, stack details, provider internals, or a blank page.
- The user sees what failed, whether their work is safe, and what they can do next.
- Operational logs retain enough information to diagnose the provider failure.

## P1: Make Bookshelf books keyboard-accessible

Book covers in `src/components/management/Bookshelf.tsx` are clickable and draggable `<div>` elements. They are not naturally focusable and do not expose button semantics or keyboard activation. Moving a book between shelves also depends on pointer drag-and-drop.

### Required work

- Render selectable book covers as buttons or links where possible.
- If a semantic element cannot be used, supply `role="button"`, `tabIndex={0}`, Enter/Space behavior, and visible focus styling.
- Add a keyboard-accessible `Move to shelf…` action.
- Give delete controls explicit accessible names that include the book title.
- Announce successful moves through the existing live-region system.

### Acceptance criteria

- A keyboard-only user can open, delete, and move a book.
- Screen readers announce the book title, selected state, work type, and available action.
- All visible focus states meet contrast requirements.

## P1: Fill remaining image accessibility gaps

Several user-supplied images render without an `alt` attribute, including:

- `src/components/editor/desk/widgets/ImagePinRenderer.tsx`
- `src/components/editor/desk/widgets/WorldBiblePinRenderer.tsx`

### Required work

- Use the image caption, entity name, or another meaningful label when the image communicates content.
- Use `alt=""` when an image is decorative or surrounding text already supplies the same information.
- Audit all native `<img>` instances for missing `alt`, unbounded dimensions, and excessive data-URL payloads.

## P1: Add UI and end-to-end coverage

The test count is excellent, but coverage is concentrated in store and pure-library behavior. Only a small number of component test files exist, and no end-to-end browser suite currently protects the full customer journey.

### Minimum browser suite

1. Public landing page and theme selection.
2. Beta-access request validation and error states.
3. Developer sign-in in development.
4. First-run project creation for each starting destination.
5. Load and remove the finished example without damaging existing work.
6. Open a manuscript, edit, save, reload, and verify.
7. Create, rename, reorder, move, and delete chapters/scenes.
8. Create, edit, link, search, and delete a World Bible entry.
9. Create and manipulate Research and Writing Desk cards.
10. Export Markdown, DOCX, EPUB, and JSON backup files.
11. Restore a backup.
12. Keyboard-only navigation through the primary experience.
13. Authentication outage, cloud-sync outage, and quota failure.

Tests that perform destructive operations must use isolated seeded accounts/workspaces.

## P2: Prevent module-scope persistence listener accumulation

`src/store/workspaceStore.ts` registers `pagehide` and `visibilitychange` listeners at module scope without cleanup. Hot reload can retain older listener closures during development.

### Required work

- Move browser lifecycle registration into an idempotent initializer or a provider effect with cleanup.
- Ensure the final pending write is flushed once, not several times.
- Add a test for repeated initialization.

## P2: Consolidate duplicate font initialization

IM Fell English and EB Garamond are initialized in both `src/app/layout.tsx` and `src/app/welcome/themes/fantasy/fonts.ts`. The build consequently resolves multiple generated font modules and fails entirely when Google Fonts cannot be reached.

### Required work

- Define each font once and reuse its exported variables.
- Consider committing licensed font files and using `next/font/local` for deterministic builds.
- Update the Browserslist database during the same dependency-maintenance pass.

### Acceptance criteria

- Each font has one source of truth.
- A clean production build is reproducible in CI.
- Font failure does not produce an unstyled or unusable public page.

## P2: Eliminate remaining type suppressions and broad widget payloads

The project still contains `@ts-ignore`, `any`, and broadly typed widget content in important UI paths. Some uses are justified for migrations, but active rendering and editing code should use discriminated unions.

### Required work

- Replace active widget `content: any` usage with a map from widget type to payload type.
- Remove `@ts-ignore` in Bookshelf and BookCoverEditor by correcting the underlying types.
- Keep permissive types confined to migration boundaries and validate them before conversion.
- Consider renaming the internal `biblePinit` discriminator to `biblePin` through a versioned migration; it is currently consistent, so this is cleanup rather than a functional bug.

---

# 2. Architecture and maintainability

## P1: Split the remaining mega-modules

Current hotspots include approximately:

- `src/store/workspaceStore.ts` — 3,141 lines
- `src/components/editor/WritingDesk.tsx` — 1,412 lines
- `src/components/management/Bookshelf.tsx` — 834 lines
- `src/components/world/ArticleGridEditor.tsx` — 723 lines
- `src/components/editor/WritingDesk.module.css` — roughly 7,000 lines

These files increase regression risk and make ownership boundaries unclear.

### Recommended store boundaries

- Workspace identity and ownership
- Worlds and projects
- Documents, chapters, and scenes
- World Bible entities and folders
- Research boards and dossiers
- Desk layout and widgets
- Goals, streaks, and badges
- Version history and backups
- Persistence and cloud synchronization
- Transient UI state

Do not create several independently persisted stores without first defining a single atomic persistence envelope. The goal is modular code, not fragmented saves.

### Recommended Writing Desk boundaries

- `WritingDeskShell`
- `useCanvasViewport`
- `useWidgetSelection`
- `useWidgetDragResize`
- `useCanvasShortcuts`
- `WidgetLayer`
- `ConnectionLayer`
- `ZoomControls`
- `WritingZone`
- Shared TipTap configuration

### CSS direction

- Split styles by subsystem alongside the extracted component.
- Preserve existing design tokens.
- Avoid substring selectors such as `[class*="panelContainer"]` for structural behavior.
- Add a small documented z-index scale for canvas, menus, modals, navigation, and tooltips.

## P2: Formalize the domain model

The application supports worlds, shelves, projects/books, documents/chapters, scenes, entities, article blocks, research widgets, writing widgets, snapshots, and histories. These relationships should be documented as a domain model rather than inferred from one large store.

### Deliverables

- A concise entity-relationship diagram.
- Ownership and deletion rules for every domain object.
- Stable invariants, such as whether every scene must belong to a document and every project may belong to at most one world.
- Cascading-delete behavior and restoration expectations.
- Schema-version and migration policy.
- Maximum supported payload assumptions.

## P2: Separate transient UI state from durable author data

Audit every persisted field and classify it as:

- Durable author content
- Recoverable workspace layout
- User preference
- Session-only interaction state
- Derived/cache data

Only the first three categories should normally be persisted, and cloud synchronization may use different rules from local persistence.

---

# 3. Desktop product and UX improvements

## P0: Make the complete core loop obvious

The intended loop should be visible everywhere:

> Capture research → shape the draft → write scenes → link lore → review progress → export.

The product already contains these steps, but the interface occasionally feels like several powerful applications sharing one shell.

### Required work

- Give each major mode one sentence explaining its job.
- Make the active world, book, chapter, scene, and Workshop stage continuously clear.
- Add reliable breadcrumbs where context can become ambiguous.
- Ensure “Continue writing” always opens the expected book, scene, position, zoom, and focus.
- Preserve the writer’s last location without letting stale state override an explicit navigation action.

## P1: Turn the finished example into the primary guided onboarding

The finished example is currently the best demonstration of LoreCanvas.

### Recommended onboarding

1. Load the example in a clearly isolated, removable state.
2. Ask the user to open a scene.
3. Show a linked lore reference without leaving the manuscript.
4. Move to Research and pin one item.
5. Move to Drafting and rearrange one beat.
6. Return to Writing and enter a short line.
7. Show save, history, backup, and export.
8. Offer `Create my project with this structure`.

### Requirements

- The example must never overwrite or merge into real work unexpectedly.
- Exiting example mode must restore the previous workspace exactly.
- The user must be able to restart or permanently dismiss guidance.

## P1: Reduce visual ambiguity and density

The dark monochrome treatment is distinctive, but inactive controls, disabled controls, secondary text, and decorative surfaces are often close in luminance. On the Bookshelf, empty slots and decorative diamonds can compete with actual books. In the editor, several compact icon controls rely on hover tooltips for meaning.

### Required work

- Run a WCAG contrast audit across both theme families and light/dark modes.
- Distinguish disabled, inactive, selected, and unavailable states without relying on opacity alone.
- Add persistent labels for critical controls; reserve tooltip-only labeling for secondary actions.
- Reduce decorative contrast behind primary content.
- Standardize button sizes, icon sizes, focus rings, and hover/pressed states.

## P1: Improve empty states and progressive disclosure

The app exposes many advanced tools early. Empty states should provide one primary action and one sentence about why the area matters.

Examples:

- Research: `Capture your first source or question`.
- Drafting: `Choose a structure or begin with blank cards`.
- Writing: `Create a scene or open the current scene`.
- World Bible: `Create a person, place, thing, or custom category`.
- Dossier: explain when it becomes useful and link directly to creating the prerequisite board.

## P2: Add a global recent-items and quick-switch workflow

Global search exists. It should evolve into the fastest way to move through a large universe.

Recommended additions:

- Recent books, scenes, entities, and boards
- Search result grouping and filters
- Keyboard shortcuts displayed beside results
- `Go to current scene/world/project`
- Commands for creation and common mode switches
- Robust handling of duplicate names

## P2: Improve long-session ergonomics

- Restore exact cursor and scroll position per scene.
- Offer a distraction-free linear manuscript mode separate from the spatial desk.
- Show session word delta and elapsed writing time unobtrusively.
- Provide configurable autosave cadence only if users can understand the tradeoff.
- Add undo/redo coverage for canvas operations, not just editor text.
- Warn before navigation only when an unsaved operation genuinely exists.

## Desktop-only communication

Desktop-first is an acceptable product decision. For the present cycle:

- Keep the public landing, login, account, billing, and support pages responsive.
- On small screens after login, show a polished message that LoreCanvas currently requires a larger screen.
- Do not attempt to compress the infinite canvas into a phone layout yet.
- Later, consider read-only lore lookup, quick idea capture, and emergency manuscript access before full mobile editing.

---

# 4. Missing product capabilities

## P0: SaaS billing and entitlement system

The current codebase does not appear to contain a complete subscription and entitlement implementation.

### Required capabilities

- Hosted checkout through a reputable payment provider
- Monthly and annual products
- Webhook-driven entitlement updates
- Grace periods for failed payments
- Upgrade, downgrade, cancellation, and renewal handling
- Customer billing portal
- Trial expiration behavior
- Server-side entitlement enforcement
- Clear read-only/export behavior after cancellation
- Administrative visibility into subscription state

Never rely solely on client-side plan checks.

### Recommended initial packaging

- 14–30 day unrestricted trial without a card
- Standard: approximately $12/month or $99/year
- Limited founding offer: approximately $69–79/year
- A later higher tier for collaboration, advanced publishing, or substantially greater storage

Private projects, standard exports, backups, and account deletion should be trust fundamentals rather than premium upsells.

## P0: Legal and trust surfaces

Before accepting payment, add:

- Terms of Service
- Privacy Policy
- Cookie disclosure if applicable
- Data retention and deletion policy
- Subprocessor list
- Copyright and ownership statement
- Explicit policy on whether manuscript content is ever used for AI training
- Contact/support route
- Refund and cancellation policy
- Age requirement
- Acceptable-use policy

These must match actual system behavior rather than serving as generic templates.

## P0: Production observability and support

### Required capabilities

- Client and server exception reporting
- Release/version tagging
- Failed-sync and repeated-conflict reporting
- Authentication failure metrics
- Save latency and payload-size telemetry without manuscript text
- Backup/restore success metrics
- Health checks for Supabase and critical routes
- Privacy-safe audit logs for destructive account/workspace operations
- A support identifier users can include in reports

Never collect manuscript contents, lore text, search queries, or document titles in telemetry by default.

## P1: Account and workspace management

- Visible email/account identity
- Session/device management if supported by the auth provider
- Passwordless sign-in recovery guidance
- Download all account data
- Delete account with clear consequences and confirmation
- Sign-out behavior that reliably removes local data for shared computers
- Clear distinction between deleting a project and deleting the account

## P1: Import and migration experience

Replacement products win when switching costs are low.

### Recommended import priorities

1. DOCX and Markdown manuscripts
2. Folder of Markdown/text files
3. LoreCanvas backup
4. Scrivener compile/export formats that can be supported safely
5. World Anvil article exports if the official export format is stable and permitted
6. Generic CSV/JSON mapping for characters, places, and other entities

Every importer should provide a preview, mapping summary, validation errors, and rollback.

## P1: Export completeness

Users should be able to leave with:

- Markdown manuscript
- DOCX manuscript
- EPUB
- Plain text
- Full structured workspace JSON
- World Bible articles in readable Markdown/HTML
- Images in an organized folder
- Research notes and attachments
- A machine-readable relationship/index manifest

Exports should not require an active paid plan once the content already belongs to the user.

## P1: Project templates and reusable structures

World Bible presets and writing methods already exist. Unify them into a coherent template system:

- Novel
- Series bible
- Screenplay
- Short story
- Interactive fiction
- TTRPG setting, later
- Blank custom workspace

Allow users to save their own project, article, and board templates after the built-in workflow is stable.

## P2: Narrative-focused worldbuilding features

Build features that directly improve a manuscript before chasing general-purpose worldbuilding breadth:

- Character relationship views
- Character arc tracking tied to scenes
- Event timeline tied to scenes and lore
- Continuity flags with source links
- Location/entity appearance index
- POV and chronology reports
- Unresolved setup/payoff tracker
- Series-level canon and project overrides
- Pronunciation and naming references

## P2: Collaboration, after single-writer reliability

Potential later capabilities:

- Invite editor/commenter/viewer
- Scene- and article-level comments
- Suggestion mode
- Presence and edit locking
- Shareable read-only review links
- Change attribution and restore

Do not begin real-time collaboration until the single-writer conflict and version model is demonstrably reliable.

## P3: Competitive breadth that should not delay launch

- Interactive geographic maps
- Fictional calendars
- Constructed languages
- Public world websites
- Reader subscriber groups and secrets
- Custom domains and white labeling
- RPG stat blocks and campaign management
- Marketplace/plugin ecosystem
- Community discovery and public challenges
- Native desktop/offline application
- Full mobile editing

These are areas where established competitors have years of depth. LoreCanvas should first win through a tighter writer-centered workflow.

---

# 5. Security and privacy checklist

Existing strengths include fail-closed route protection, security headers, HTML sanitization, safe-URL handling, ownership tests, conflict handling, and account deletion work.

Before launch, verify:

- Row-level security for every Supabase table using automated tests against two users.
- Anonymous users cannot read or mutate workspaces, feedback, beta requests, storage objects, or metadata beyond explicitly public data.
- Service-role credentials never reach client bundles.
- Rate limits exist for beta requests, login-related routes, feedback, and costly operations.
- Uploaded files are validated by size, MIME type, extension, and actual content where practical.
- Image payloads cannot exhaust local storage silently.
- OAuth redirects remain same-origin or explicitly allowlisted.
- Exported HTML/EPUB/DOCX content cannot execute stored scripts.
- Account deletion covers authentication, database rows, storage objects, and retained backups according to policy.
- Logs never contain manuscript content, tokens, credentials, or full workspace payloads.
- Dependency auditing runs in CI with an explicit update policy.
- Content Security Policy is evaluated once inline styles/scripts and required external origins are inventoried.

---

# 6. Performance and scale plan

## Performance budgets

Define and enforce budgets on a representative desktop:

- Public landing usable within 2.5 seconds on a normal broadband connection.
- Authenticated shell interactive within 3 seconds for a typical workspace.
- Typing response remains visually immediate; target under 50 ms work per input event.
- Scene switching feels immediate for typical scenes and remains under 500 ms for large scenes.
- Autosave must not block typing or scrolling.
- Canvas pan/zoom should sustain 60 fps under normal loads and remain usable under stress loads.
- Search results should appear within 150 ms for a typical large project.

## Required profiling

- Measure bundle size by route and lazy workspace mode.
- Record React render counts while typing and dragging.
- Profile TipTap transaction listeners with several editors mounted.
- Confirm large local persistence serialization occurs off the critical typing path.
- Measure cloud payload size and write frequency.
- Avoid syncing an entire multi-megabyte workspace for a small scene edit if incremental persistence can be introduced safely.
- Define image compression, thumbnail, and storage policies.

---

# 7. Recommended implementation phases

## Phase A — Trust and blocker removal

- Fix duplicate TipTap extensions.
- Add friendly auth/network failure responses.
- Add App Router error surfaces.
- Complete save/sync status vocabulary and recovery actions.
- Add full save/reload/cloud/offline/conflict browser tests.
- Validate large-project behavior.
- Fix Bookshelf keyboard access and missing image alternatives.

**Exit condition:** A writer can complete a long session, survive failures, reload, recover, and export without uncertainty.

## Phase B — Core-loop polish

- Turn the example into guided onboarding.
- Clarify active world/book/chapter/scene/stage context.
- Improve empty states and progressive disclosure.
- Audit contrast and control states.
- Improve recent items and command palette behavior.
- Restore cursor, scroll, zoom, and workspace location reliably.

**Exit condition:** A new user can understand and complete the principal workflow without outside explanation.

## Phase C — Maintainability and testability

- Split store domains while preserving one atomic persistence contract.
- Split Writing Desk, Bookshelf, Article Grid, and their styles.
- Introduce typed widget payloads.
- Consolidate shared editor extensions.
- Make browser lifecycle registration idempotent.
- Consolidate fonts and stabilize builds.

**Exit condition:** New work no longer requires editing several thousand-line modules, and major UI behavior is protected by component tests.

## Phase D — SaaS launch infrastructure

- Billing, entitlements, trials, and customer portal.
- Legal and privacy surfaces.
- Production error reporting and privacy-safe telemetry.
- Support workflow and operational dashboards.
- Account data export and lifecycle verification.
- Import/migration polish.

**Exit condition:** The business can safely accept, support, bill, and offboard paying customers.

## Phase E — Differentiating product depth

- Narrative timeline connected to scenes and lore.
- Relationship and character-arc views.
- Continuity/setup-payoff reports.
- Series-level canon.
- User-created templates.
- Carefully scoped collaboration.

**Exit condition:** LoreCanvas has capabilities users cannot reproduce easily by placing several generic tools side by side.

---

# 8. Launch readiness checklist

## Product

- [ ] Target user and desktop-only boundary are explicit.
- [ ] Onboarding reaches a successful writing action quickly.
- [ ] Example data is isolated and reversible.
- [ ] All primary empty states have a useful next action.
- [ ] Import and export expectations are documented.
- [ ] Cancellation never traps user-authored content.

## Reliability

- [ ] Save/reload E2E passes locally and in CI.
- [ ] Offline/reconnect E2E passes.
- [ ] Two-tab conflict E2E passes.
- [ ] Large-manuscript stress test passes.
- [ ] Backup and restore E2E passes.
- [ ] Production alerts exist for failed auth and sync spikes.

## Quality

- [ ] No unexpected browser console errors or warnings.
- [ ] ESLint, TypeScript, unit, component, and browser tests pass.
- [ ] Production build is deterministic.
- [ ] Keyboard-only core workflow passes.
- [ ] Contrast audit passes for supported themes.
- [ ] Supported browser matrix is documented.

## Security and privacy

- [ ] RLS tests pass against multiple users.
- [ ] Secrets are absent from client bundles and logs.
- [ ] Upload and import validation is complete.
- [ ] Data deletion matches published policy.
- [ ] Privacy-safe telemetry is reviewed.
- [ ] Dependency and security scanning runs in CI.

## SaaS operations

- [ ] Billing webhooks are idempotent and tested.
- [ ] Entitlements are enforced server-side.
- [ ] Trial, failed-payment, cancellation, and renewal flows are tested.
- [ ] Terms, privacy, refunds, and support pages are published.
- [ ] Customer data export and deletion are self-service or operationally documented.
- [ ] Rollback and incident procedures exist.

---

# 9. Instructions for the implementation agent

1. Treat this report as a prioritized brief, not authorization to rewrite the application wholesale.
2. Preserve existing behavior and user data formats unless a versioned migration is included.
3. Work in small reviewable commits grouped by issue.
4. Add a failing regression test before or alongside each verified bug fix.
5. Do not combine store decomposition with unrelated feature development.
6. Run ESLint, TypeScript, the full Vitest suite, production build, and relevant browser flows before completing each phase.
7. Document any intentionally deferred recommendation and why it was deferred.
8. Do not add mobile canvas support in this cycle; provide only the declared desktop boundary experience.
9. Never weaken authentication, RLS, sanitization, ownership isolation, backup behavior, or conflict handling to simplify implementation.
10. When a recommendation conflicts with a deliberate product decision, surface the decision explicitly rather than silently changing the product.

## Suggested first implementation batch

The safest, highest-value first batch is:

1. Fix duplicate TipTap underline registration and add warning-free editor tests.
2. Add structured dev-login/network error handling and App Router error pages.
3. Make Bookshelf books keyboard-operable and add a `Move to shelf…` action.
4. Add missing image alternatives.
5. Create the first Playwright flow: sign in → load example → open scene → edit → save → reload → verify → export.
6. Add an explicit small-screen desktop-required message without changing desktop layout.

This batch is bounded, testable, and improves quality without destabilizing the domain or persistence architecture.
