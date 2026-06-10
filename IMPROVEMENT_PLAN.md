# MythForge / LoreCanvas — Full Improvement Sprint

Branch: `sprint/full-improvement-pass`. Decisions: reconnect screenplay, remove fake account bits, do all refactors.

## Phase 0 — Safety net & cleanup
- [ ] Vitest + happy-dom test infra, `test` script
- [ ] Unit tests for store pure helpers (streak/badge/word-count) — protects refactors
- [ ] `npm audit fix` (shell-quote, flatted, xmldom, axios, tmp)
- [ ] Delete `globals.css.bak`, `eslint_output.txt`, `lint_errors.txt`
- [ ] `.env.example`, confirm `.env.local` gitignored

## Phase 1 — Reconnection (highest value, code already exists)
- [ ] Re-mount manuscript export (ExportModal) in WritingDesk
- [ ] Wire `recordWritingSession` into desk editor onUpdate → activates Goals system
- [ ] Mount VersionHistoryPanel + auto-snapshot on save
- [ ] "Load Example World" button → seedBetaData
- [ ] Reconnect ScreenplayEditor as a real writing mode

## Phase 2 — Data safety
- [ ] Sync: version/updated_at column + conflict prompt (no more blind LWW)
- [ ] Login hydrate: compare timestamps, don't blind-overwrite local
- [ ] Sync-status indicator + surfaced errors + retry
- [ ] Flush persist on pagehide / Electron before-quit
- [ ] React error boundaries around editor surfaces
- [ ] Cap auto-snapshots (~20/scene)
- [ ] Move version-keyed migrations into `migrate()`, run on cloud path too

## Phase 3 — Security
- [ ] OAuth callback: relative-path-only redirect
- [ ] Sanitize article HTML before store/render (stored XSS)
- [ ] Sanitizer: validate href/src schemes
- [ ] FDX import: HTML-escape text
- [ ] markdownToBasicHtml: escape
- [ ] Music panel: validate URL scheme, noopener
- [ ] Electron: will-navigate + setWindowOpenHandler, sandbox, explicit webSecurity
- [ ] asar: true with asarUnpack for node.exe
- [ ] Security headers in next.config
- [ ] Validate cloudData before setState

## Phase 4 — Performance
- [ ] Debounced localStorage persist adapter
- [ ] Dynamic import mammoth, docx, betaSeedData
- [ ] React.lazy per mode in page.tsx
- [ ] Narrow entity selectors (useShallow stubs)
- [ ] Entity-mark scan: cached regex, dirty-range only
- [ ] Drag: buffer in ref, commit on mouseup
- [ ] Canvas widgets: stop RAF on convergence
- [ ] useCallback on page.tsx panel props

## Phase 5 — Big refactors
- [ ] Split workspaceStore into document/ui/session slices
- [ ] Split WritingDesk into shell + widgets/* + hooks
- [ ] Split ArticleGridEditor into shell + widgets/* + geometry
- [ ] Split WritingEditor into SceneEditor/ContextBar/extensions
- [ ] Dedupe word-count + shared TipTap extensions
- [ ] Route console.* through logger
- [ ] Type widget content (discriminated unions)

## Phase 6 — Product polish
- [ ] EPUB export
- [ ] Backup/restore UI + JSON export
- [ ] Per-chapter word targets
- [ ] Remove "Pro Account" + dead billing links; wire beta feedback to Supabase
- [ ] Replace native prompt()/confirm()
- [ ] Spellcheck toggle
- [ ] Custom World Bible categories
- [ ] First-run tour / unify goal settings

## Phase 7 — Verify
- [ ] Full build green
- [ ] Smoke test: type → reload → survives
- [ ] Re-run audits
