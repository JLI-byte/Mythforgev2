# Character Profile — Phase 2 (Editing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every field of the character profile author-editable — an Edit/Save/Cancel toggle, inline text/image/slider inputs, and add/remove for every collection — persisting to `entity.profile`.

**Architecture:** The shell (`CharacterProfile.tsx`) owns a `draft` copy of the profile and an `editing` flag; it passes `editing`, the current `profile`/`draft`, and an `update(patch)` callback to each page. Pages render through small reusable editor primitives (`EditableText`, `EditableImage`, `MeterField`, `ListEditor`) that switch between static and input rendering on the `editing` flag — so each page has ONE code path for both view and edit. Save writes `updateEntity(entity.id, { profile: draft })`; Cancel discards the draft.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Vitest. No new dependencies (image upload reuses `FileReader` → base64, as the app already does for `entity.imageUrl`).

---

## File Structure

New:
- `src/components/world/profile/editors/EditableText.tsx` — static text ↔ input/textarea.
- `src/components/world/profile/editors/EditableImage.tsx` — image ↔ image + URL/upload.
- `src/components/world/profile/editors/MeterField.tsx` — meter bar ↔ label input + range slider.
- `src/components/world/profile/editors/ListEditor.tsx` — generic add/remove wrapper (render-prop).
- `src/components/world/profile/editors/editors.module.css` — editor-control styling.
- `src/components/world/profile/editors/imageUpload.ts` + `imageUpload.test.ts` — `fileToDataUrl` helper (TDD).

Modified:
- `src/components/world/profile/CharacterProfile.tsx` — draft state, edit toggle, `update`, pass props down.
- `src/components/world/profile/MainPage.tsx`, `PersonaPage.tsx`, `AppearancePage.tsx`, `RelationsPage.tsx` — accept `{ profile, editing, update }` and use the primitives.
- `src/components/world/profile/CharacterProfile.module.css` — a few edit-mode helpers (append).

**Shared page prop type** (define in `CharacterProfile.tsx` and import, OR duplicate the inline type — the plan uses an exported type):

```ts
// in CharacterProfile.tsx
export interface PageProps {
    profile: CharacterProfile;      // the draft when editing, else the merged profile
    editing: boolean;
    update: (patch: Partial<CharacterProfile>) => void;
}
```

---

## Task 1: `fileToDataUrl` helper (TDD)

**Files:**
- Create: `src/components/world/profile/editors/imageUpload.ts`
- Create: `src/components/world/profile/editors/imageUpload.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { fileToDataUrl } from './imageUpload';

describe('fileToDataUrl', () => {
    it('resolves a data URL for a file', async () => {
        const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
        const url = await fileToDataUrl(file);
        expect(url.startsWith('data:')).toBe(true);
    });
});
```

- [ ] **Step 2: Run it (fails — module missing)**

Run: `npx vitest run src/components/world/profile/editors/imageUpload.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement**

`src/components/world/profile/editors/imageUpload.ts`:
```ts
/** Reads a File into a base64 data URL (same approach the app uses for covers). */
export function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('read failed'));
        reader.readAsDataURL(file);
    });
}
```

- [ ] **Step 4: Run it (passes)**

Run: `npx vitest run src/components/world/profile/editors/imageUpload.test.ts`
Expected: PASS. (Vitest's jsdom env provides `FileReader`.)

- [ ] **Step 5: Commit**

```bash
git add src/components/world/profile/editors/imageUpload.ts src/components/world/profile/editors/imageUpload.test.ts
git commit -m "feat: fileToDataUrl helper for profile image uploads"
```

---

## Task 2: Editor primitives

**Files:**
- Create: `src/components/world/profile/editors/editors.module.css`
- Create: `src/components/world/profile/editors/EditableText.tsx`
- Create: `src/components/world/profile/editors/EditableImage.tsx`
- Create: `src/components/world/profile/editors/MeterField.tsx`
- Create: `src/components/world/profile/editors/ListEditor.tsx`

- [ ] **Step 1: Create `editors.module.css`**

```css
.input, .textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid var(--primaryLine, rgba(132, 34, 43, 0.42));
    border-radius: 6px;
    padding: 4px 8px;
    color: var(--ink, #171411);
    font: inherit;
}
.textarea { min-height: 64px; resize: vertical; }
.input:focus, .textarea:focus { outline: none; border-color: var(--primary, #84222b); }

.imageWrap { position: relative; }
.imageControls {
    position: absolute; inset: auto 0 0 0;
    display: flex; gap: 4px; padding: 4px;
    background: rgba(0, 0, 0, 0.45);
}
.imageControls input[type="text"] {
    flex: 1; min-width: 0; font-size: 11px; padding: 2px 4px;
    border: none; border-radius: 4px;
}
.uploadBtn {
    font-size: 11px; padding: 2px 6px; border: none; border-radius: 4px;
    background: var(--gold, #bb8d59); color: #fff; cursor: pointer;
}
.emptyImage {
    display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--ink, #171411) 8%, transparent);
    color: var(--muted, #9d8675); font-size: 11px;
}

.rangeRow { display: flex; align-items: center; gap: 8px; }
.rangeRow input[type="range"] { flex: 1; accent-color: var(--primary, #84222b); }
.meterLabelInput { width: 100%; font: inherit; border: none; background: transparent; color: var(--ink, #171411); }

.itemWrap { position: relative; }
.removeBtn {
    position: absolute; top: -6px; right: -6px; z-index: 5;
    width: 20px; height: 20px; border-radius: 50%;
    border: none; background: var(--primary, #84222b); color: #fff;
    font-size: 12px; line-height: 1; cursor: pointer;
}
.addBtn {
    margin-top: 8px; padding: 4px 12px; border-radius: 14px;
    border: 1px dashed var(--primaryLine, rgba(132, 34, 43, 0.42));
    background: transparent; color: var(--primary, #84222b);
    font-size: 12px; cursor: pointer;
}
.addBtn:hover { background: color-mix(in srgb, var(--primary, #84222b) 8%, transparent); }
```

- [ ] **Step 2: Create `EditableText.tsx`**

```tsx
import React from 'react';
import styles from './editors.module.css';

interface EditableTextProps {
    editing: boolean;
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
    placeholder?: string;
    /** element/class used for the static (view) rendering */
    as?: 'span' | 'p' | 'b' | 'h3';
    className?: string;
}

export default function EditableText({
    editing, value, onChange, multiline, placeholder, as = 'span', className,
}: EditableTextProps) {
    if (editing) {
        return multiline ? (
            <textarea
                className={styles.textarea}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        ) : (
            <input
                className={styles.input}
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        );
    }
    const Tag = as;
    if (!value) return placeholder ? <Tag className={className}>{placeholder}</Tag> : null;
    return <Tag className={className}>{value}</Tag>;
}
```

- [ ] **Step 3: Create `EditableImage.tsx`**

```tsx
import React from 'react';
import { fileToDataUrl } from './imageUpload';
import styles from './editors.module.css';

interface EditableImageProps {
    editing: boolean;
    value?: string;
    onChange: (v: string) => void;
    className?: string;   // applied to the <img> / empty box
    alt?: string;
}

export default function EditableImage({ editing, value, onChange, className, alt = '' }: EditableImageProps) {
    const img = value
        ? <img src={value} alt={alt} className={className} />
        : <div className={`${className ?? ''} ${styles.emptyImage}`}>no image</div>;

    if (!editing) return value ? img : null;

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) onChange(await fileToDataUrl(f));
    };

    return (
        <div className={styles.imageWrap}>
            {img}
            <div className={styles.imageControls}>
                <input
                    type="text"
                    value={value ?? ''}
                    placeholder="image URL"
                    onChange={(e) => onChange(e.target.value)}
                />
                <label className={styles.uploadBtn}>
                    ⬆
                    <input type="file" accept="image/*" hidden onChange={onFile} />
                </label>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Create `MeterField.tsx`**

```tsx
import React from 'react';
import { ProfileMeter } from '@/store/workspaceStore';
import styles from './editors.module.css';

interface MeterFieldProps {
    editing: boolean;
    meter: ProfileMeter;
    onChange: (m: ProfileMeter) => void;
    /** class for the static bar container (from the profile CSS module) */
    barClassName: string;
}

export default function MeterField({ editing, meter, onChange, barClassName }: MeterFieldProps) {
    if (!editing) {
        return (
            <div className={barClassName} style={{ ['--level' as string]: `${meter.level}%` }}>
                <b>{meter.label}</b>
                <div><span /></div>
            </div>
        );
    }
    return (
        <div className={barClassName} style={{ ['--level' as string]: `${meter.level}%` }}>
            <input
                className={styles.meterLabelInput}
                value={meter.label}
                placeholder="label"
                onChange={(e) => onChange({ ...meter, label: e.target.value })}
            />
            <div className={styles.rangeRow}>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={meter.level}
                    onChange={(e) => onChange({ ...meter, level: Number(e.target.value) })}
                />
                <span>{meter.level}</span>
            </div>
        </div>
    );
}
```

- [ ] **Step 5: Create `ListEditor.tsx`**

```tsx
import React from 'react';
import styles from './editors.module.css';

interface ListEditorProps<T> {
    editing: boolean;
    items: T[];
    onChange: (items: T[]) => void;
    newItem: () => T;
    addLabel: string;
    renderItem: (item: T, index: number, onItem: (patch: Partial<T>) => void) => React.ReactNode;
    className?: string;
}

/** Renders a list; in edit mode adds a remove button per item and an add button. */
export default function ListEditor<T>({
    editing, items, onChange, newItem, addLabel, renderItem, className,
}: ListEditorProps<T>) {
    const setItem = (i: number, patch: Partial<T>) => {
        const next = items.slice();
        next[i] = { ...next[i], ...patch };
        onChange(next);
    };
    const remove = (i: number) => onChange(items.filter((_, j) => j !== i));

    return (
        <div className={className}>
            {items.map((item, i) =>
                editing ? (
                    <div key={i} className={styles.itemWrap}>
                        <button type="button" className={styles.removeBtn} onClick={() => remove(i)} aria-label="Remove">×</button>
                        {renderItem(item, i, (patch) => setItem(i, patch))}
                    </div>
                ) : (
                    <React.Fragment key={i}>{renderItem(item, i, () => {})}</React.Fragment>
                ),
            )}
            {editing && (
                <button type="button" className={styles.addBtn} onClick={() => onChange([...items, newItem()])}>
                    {addLabel}
                </button>
            )}
        </div>
    );
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in `editors/`.

- [ ] **Step 7: Commit**

```bash
git add src/components/world/profile/editors/
git commit -m "feat: profile editor primitives (text, image, meter, list)"
```

---

## Task 3: Shell — edit toggle, draft, persistence

**Files:**
- Modify: `src/components/world/profile/CharacterProfile.tsx`
- Modify: `src/components/world/profile/CharacterProfile.module.css` (append toolbar styles)

- [ ] **Step 1: Rewrite `CharacterProfile.tsx`**

Replace the whole file with:

```tsx
"use client";

import React, { useState } from 'react';
import { Entity, CharacterProfile as ProfileData, createDefaultProfile, useWorkspaceStore } from '@/store/workspaceStore';
import { playfair, cormorant, nunito, greatVibes } from './profileFonts';
import MainPage from './MainPage';
import PersonaPage from './PersonaPage';
import AppearancePage from './AppearancePage';
import RelationsPage from './RelationsPage';
import EditableImage from './editors/EditableImage';
import EditableText from './editors/EditableText';
import styles from './CharacterProfile.module.css';

type PageId = 'main' | 'persona' | 'appearance' | 'relations';
const PAGES: { id: PageId; label: string }[] = [
    { id: 'main', label: 'Main' },
    { id: 'persona', label: 'Persona' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'relations', label: 'Relations' },
];

export interface PageProps {
    profile: ProfileData;
    editing: boolean;
    update: (patch: Partial<ProfileData>) => void;
}

interface CharacterProfileProps {
    entity: Entity;
}

export default function CharacterProfile({ entity }: CharacterProfileProps) {
    const updateEntity = useWorkspaceStore((s) => s.updateEntity);
    const [page, setPage] = useState<PageId>('main');
    const [editing, setEditing] = useState(false);

    const merged: ProfileData = { ...createDefaultProfile(), ...(entity.profile ?? {}) };
    const [draft, setDraft] = useState<ProfileData>(merged);

    // The active data: draft while editing, otherwise the live merged profile.
    const profile = editing ? draft : merged;
    const update = (patch: Partial<ProfileData>) => setDraft((d) => ({ ...d, ...patch }));

    const startEdit = () => { setDraft(merged); setEditing(true); };
    const save = () => { updateEntity(entity.id, { profile: draft }); setEditing(false); };
    const cancel = () => { setDraft(merged); setEditing(false); };

    const displayName = profile.fullName || entity.name;
    const pageNumber = String(PAGES.findIndex((p) => p.id === page) + 1).padStart(2, '0');
    const fontVars = `${playfair.variable} ${cormorant.variable} ${nunito.variable} ${greatVibes.variable}`;

    return (
        <div className={`${styles.bg} ${fontVars}`}>
            {/* Left image panel */}
            <div className={styles.imgSide}>
                <div className={styles.imgBox}>
                    <EditableImage
                        editing={editing}
                        value={entity.imageUrl}
                        onChange={(v) => updateEntity(entity.id, { imageUrl: v })}
                        alt={displayName}
                    />
                </div>
                <div className={styles.sideStar}>✦</div>
                {(editing || profile.tagline) && (
                    <div className={styles.sideQuote}>
                        <EditableText editing={editing} value={profile.tagline ?? ''} placeholder="tagline"
                            onChange={(v) => update({ tagline: v })} />
                    </div>
                )}
                <div className={styles.sideCaption}>
                    <b>{displayName}</b>
                    {entity.subcategory && <span>{entity.subcategory}</span>}
                </div>
            </div>

            {(profile.decorImages ?? []).slice(0, 2).map((src, i) =>
                src ? <img key={i} className={styles.decor} src={src} alt="" aria-hidden="true" /> : null,
            )}

            <div className={styles.bigTitle}><span>{displayName}</span></div>
            <div className={styles.number}>{pageNumber}</div>

            {/* Edit toolbar */}
            <div className={styles.toolbar}>
                {editing ? (
                    <>
                        <button type="button" className={styles.toolBtnPrimary} onClick={save}>Save</button>
                        <button type="button" className={styles.toolBtn} onClick={cancel}>Cancel</button>
                    </>
                ) : (
                    <button type="button" className={styles.toolBtn} onClick={startEdit}>Edit</button>
                )}
            </div>

            <div className={styles.content}>
                <div className={styles.topline}>
                    <span />
                    {(editing || profile.quote) && (
                        <div className={styles.quote}>
                            <EditableText editing={editing} value={profile.quote ?? ''} placeholder="quote"
                                onChange={(v) => update({ quote: v })} />
                        </div>
                    )}
                </div>

                <div className={styles.page}>
                    {page === 'main' && <MainPage profile={profile} editing={editing} update={update} />}
                    {page === 'persona' && <PersonaPage profile={profile} editing={editing} update={update} />}
                    {page === 'appearance' && <AppearancePage profile={profile} editing={editing} update={update} />}
                    {page === 'relations' && <RelationsPage profile={profile} editing={editing} update={update} />}
                </div>
            </div>

            <nav className={styles.nav}>
                {PAGES.map((p) => (
                    <button key={p.id} type="button"
                        className={`${styles.navBtn} ${page === p.id ? styles.navBtnActive : ''}`}
                        onClick={() => setPage(p.id)}>
                        {p.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
```

Note: `MainPage` no longer takes a `name` prop (it reads `profile.fullName`). Tasks 4–7 update the page signatures to `PageProps`.

- [ ] **Step 2: Append toolbar CSS to `CharacterProfile.module.css`**

```css
.toolbar {
    position: absolute; top: 18px; right: 84px; z-index: 45;
    display: flex; gap: 6px;
}
.toolBtn, .toolBtnPrimary {
    font: 700 11px var(--profile-sans, sans-serif); letter-spacing: 1px;
    text-transform: uppercase; padding: 5px 12px; border-radius: 14px;
    cursor: pointer; border: 1px solid var(--primaryLine);
    background: transparent; color: var(--primary);
}
.toolBtnPrimary { background: var(--primary); color: var(--cream); border-color: var(--primary); }
.toolBtn:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); }
```

- [ ] **Step 3: Type-check** (will error until pages accept PageProps — that's expected mid-refactor; still run it to see only page-prop errors)

Run: `npx tsc --noEmit`
Expected: errors ONLY about MainPage/PersonaPage/AppearancePage/RelationsPage prop types (fixed in Tasks 4–7). If any OTHER error appears, fix it before committing.

- [ ] **Step 4: Commit**

```bash
git add src/components/world/profile/CharacterProfile.tsx src/components/world/profile/CharacterProfile.module.css
git commit -m "feat: profile edit toggle, draft state, and persistence"
```

---

## Task 4: Editable Main page

**Files:**
- Modify: `src/components/world/profile/MainPage.tsx`

- [ ] **Step 1: Rewrite `MainPage.tsx`**

```tsx
import React from 'react';
import { PageProps } from './CharacterProfile';
import EditableText from './editors/EditableText';
import ListEditor from './editors/ListEditor';
import styles from './CharacterProfile.module.css';

export default function MainPage({ profile, editing, update }: PageProps) {
    const dossier = profile.dossier ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Main</h1>
            <h2>identity / origin / first impression</h2>

            <div className={styles.dossier}>
                <div className={styles.dossierName}>
                    <b>Full Name</b>
                    <EditableText as="span" editing={editing} value={profile.fullName ?? ''} placeholder="Full name"
                        onChange={(v) => update({ fullName: v })} />
                </div>
                <ListEditor
                    className={styles.dossierMeta}
                    editing={editing}
                    items={dossier}
                    onChange={(items) => update({ dossier: items })}
                    newItem={() => ({ label: 'Field', value: '' })}
                    addLabel="+ Add field"
                    renderItem={(f, i, onItem) => (
                        <p>
                            {editing
                                ? <EditableText editing value={f.label} onChange={(v) => onItem({ label: v })} />
                                : <b>{f.label}</b>}
                            {editing
                                ? <EditableText editing value={f.value} onChange={(v) => onItem({ value: v })} />
                                : <span>{f.value || '—'}</span>}
                        </p>
                    )}
                />
            </div>

            <div className={styles.introCard}>
                <b>first impression</b>
                <EditableText as="p" multiline editing={editing} value={profile.firstImpression ?? ''}
                    placeholder="No first impression yet." onChange={(v) => update({ firstImpression: v })} />
            </div>

            <div className={styles.text}>
                <EditableText as="p" multiline editing={editing} value={profile.bio ?? ''}
                    placeholder="No biography yet." onChange={(v) => update({ bio: v })} />
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors about MainPage.

- [ ] **Step 3: Commit**

```bash
git add src/components/world/profile/MainPage.tsx
git commit -m "feat: editable Main page (name, dossier fields, first impression, bio)"
```

---

## Task 5: Editable Persona page

**Files:**
- Modify: `src/components/world/profile/PersonaPage.tsx`

- [ ] **Step 1: Rewrite `PersonaPage.tsx`**

```tsx
import React from 'react';
import { PageProps } from './CharacterProfile';
import EditableText from './editors/EditableText';
import EditableImage from './editors/EditableImage';
import ListEditor from './editors/ListEditor';
import MeterField from './editors/MeterField';
import styles from './CharacterProfile.module.css';

export default function PersonaPage({ profile, editing, update }: PageProps) {
    const core = profile.corePersonality ?? {};
    const rows = profile.personaRows ?? [];
    const meters = profile.meters ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Persona</h1>
            <h2>temper / desire / personality</h2>

            <div className={styles.personaFeature}>
                <EditableImage editing={editing} value={core.image}
                    onChange={(v) => update({ corePersonality: { ...core, image: v } })} />
                <div>
                    <b>Core Personality</b>
                    <EditableText as="h3" editing={editing} value={core.heading ?? ''} placeholder="Heading"
                        onChange={(v) => update({ corePersonality: { ...core, heading: v } })} />
                    <EditableText as="p" multiline editing={editing} value={core.text ?? ''} placeholder="Describe the core personality."
                        onChange={(v) => update({ corePersonality: { ...core, text: v } })} />
                </div>
            </div>

            <ListEditor
                editing={editing}
                items={rows}
                onChange={(items) => update({ personaRows: items })}
                newItem={() => ({ label: 'Trait', heading: '', text: '' })}
                addLabel="+ Add trait"
                renderItem={(row, i, onItem) => (
                    <div className={`${styles.personaRow} ${i % 2 === 1 ? styles.reverse : ''}`}>
                        <div className={styles.personaTextCard}>
                            {editing
                                ? <EditableText editing value={row.label ?? ''} placeholder="Label" onChange={(v) => onItem({ label: v })} />
                                : row.label && <b>{row.label}</b>}
                            <EditableText as="h3" editing={editing} value={row.heading ?? ''} placeholder="Heading" onChange={(v) => onItem({ heading: v })} />
                            <EditableText as="p" multiline editing={editing} value={row.text ?? ''} placeholder="Text" onChange={(v) => onItem({ text: v })} />
                        </div>
                        <EditableImage editing={editing} value={row.image} onChange={(v) => onItem({ image: v })} />
                    </div>
                )}
            />

            <ListEditor
                className={styles.personaMeters}
                editing={editing}
                items={meters}
                onChange={(items) => update({ meters: items })}
                newItem={() => ({ label: 'Trait', level: 50 })}
                addLabel="+ Add meter"
                renderItem={(m, i, onItem) => (
                    <MeterField editing={editing} meter={m} barClassName={styles.meterItem}
                        onChange={(nm) => onItem(nm)} />
                )}
            />

            <div className={styles.personaNotes}>
                <div>
                    <b>Do&rsquo;s</b>
                    <EditableText as="p" multiline editing={editing} value={profile.dos ?? ''} placeholder="—"
                        onChange={(v) => update({ dos: v })} />
                </div>
                <div>
                    <b>Don&rsquo;ts</b>
                    <EditableText as="p" multiline editing={editing} value={profile.donts ?? ''} placeholder="—"
                        onChange={(v) => update({ donts: v })} />
                </div>
            </div>
        </div>
    );
}
```

Note: `MeterField`'s `onChange` gives a full `ProfileMeter`; `ListEditor`'s `onItem` takes a `Partial<T>`, and a full meter is a valid partial, so `onItem(nm)` is correct.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors about PersonaPage.

- [ ] **Step 3: Commit**

```bash
git add src/components/world/profile/PersonaPage.tsx
git commit -m "feat: editable Persona page (core, traits, meters, do's/don'ts)"
```

---

## Task 6: Editable Appearance page

**Files:**
- Modify: `src/components/world/profile/AppearancePage.tsx`

- [ ] **Step 1: Rewrite `AppearancePage.tsx`**

```tsx
import React from 'react';
import { PageProps } from './CharacterProfile';
import EditableText from './editors/EditableText';
import EditableImage from './editors/EditableImage';
import ListEditor from './editors/ListEditor';
import styles from './CharacterProfile.module.css';

export default function AppearancePage({ profile, editing, update }: PageProps) {
    const palette = profile.palette ?? [];
    const lookbook = profile.lookbook ?? [];
    const sections = profile.appearanceSections ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Appearance</h1>
            <h2>face / style / signature details</h2>

            <ListEditor
                className={styles.palette}
                editing={editing}
                items={palette}
                onChange={(items) => update({ palette: items })}
                newItem={() => ({ name: 'Colour', hex: '#84222b' })}
                addLabel="+ Add colour"
                renderItem={(s, i, onItem) => (
                    <div className={styles.colorSwatch} style={{ ['--swatch' as string]: s.hex }}>
                        {editing
                            ? <input type="color" value={s.hex} onChange={(e) => onItem({ hex: e.target.value })} />
                            : <i />}
                        {editing
                            ? <EditableText editing value={s.name} onChange={(v) => onItem({ name: v })} />
                            : <b>{s.name}</b>}
                        <span>{s.hex}</span>
                    </div>
                )}
            />

            <ListEditor
                className={styles.lookbook}
                editing={editing}
                items={lookbook}
                onChange={(items) => update({ lookbook: items })}
                newItem={() => ({ label: 'Item', value: '' })}
                addLabel="+ Add look"
                renderItem={(l, i, onItem) => (
                    <div className={`${styles.lookItem} ${i === 0 ? styles.large : ''}`}>
                        <EditableImage editing={editing} value={l.image} onChange={(v) => onItem({ image: v })} alt={l.label} />
                        {editing
                            ? <EditableText editing value={l.label} onChange={(v) => onItem({ label: v })} />
                            : <b>{l.label}</b>}
                        {editing
                            ? <EditableText editing value={l.value ?? ''} placeholder="detail" onChange={(v) => onItem({ value: v })} />
                            : l.value && <span>{l.value}</span>}
                    </div>
                )}
            />

            <div className={styles.appearanceBlock}>
                <b>Visual Impression</b>
                <EditableText as="p" multiline editing={editing} value={profile.visualImpression ?? ''}
                    placeholder="No visual impression yet." onChange={(v) => update({ visualImpression: v })} />
            </div>

            <ListEditor
                className={styles.appearanceSections}
                editing={editing}
                items={sections}
                onChange={(items) => update({ appearanceSections: items })}
                newItem={() => ({ label: 'Section', note: '', moodboard: [] })}
                addLabel="+ Add section"
                renderItem={(sec, i, onItem) => (
                    <div className={styles.appearanceSection}>
                        <div className={styles.appearanceSectionHead}>
                            {editing
                                ? <EditableText editing value={sec.label} onChange={(v) => onItem({ label: v })} />
                                : <b>{sec.label}</b>}
                            {editing
                                ? <EditableText editing value={sec.note ?? ''} placeholder="note" onChange={(v) => onItem({ note: v })} />
                                : sec.note && <span>{sec.note}</span>}
                        </div>
                        <ListEditor
                            className={styles.appearanceMoodboard}
                            editing={editing}
                            items={sec.moodboard ?? []}
                            onChange={(mb) => onItem({ moodboard: mb })}
                            newItem={() => ({ image: '', caption: '' })}
                            addLabel="+ Add image"
                            renderItem={(m, j, onMood) => (
                                <div className={styles.moodItem}>
                                    <EditableImage editing={editing} value={m.image} onChange={(v) => onMood({ image: v })} />
                                    <EditableText as="p" editing={editing} value={m.caption ?? ''} placeholder="caption"
                                        onChange={(v) => onMood({ caption: v })} />
                                </div>
                            )}
                        />
                    </div>
                )}
            />
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors about AppearancePage.

- [ ] **Step 3: Commit**

```bash
git add src/components/world/profile/AppearancePage.tsx
git commit -m "feat: editable Appearance page (palette, lookbook, moodboards)"
```

---

## Task 7: Editable Relations page + decor images

**Files:**
- Modify: `src/components/world/profile/RelationsPage.tsx`

- [ ] **Step 1: Rewrite `RelationsPage.tsx`** (relations list + a decor-images editor, since decor belongs to the whole profile and Relations is a good home for that control)

```tsx
import React from 'react';
import { PageProps } from './CharacterProfile';
import EditableText from './editors/EditableText';
import EditableImage from './editors/EditableImage';
import ListEditor from './editors/ListEditor';
import styles from './CharacterProfile.module.css';

export default function RelationsPage({ profile, editing, update }: PageProps) {
    const relations = profile.relations ?? [];
    const decor = profile.decorImages ?? [];
    return (
        <div className={styles.pageScroll}>
            <h1>Relations</h1>
            <h2>bonds / rivals / ties</h2>

            {relations.length === 0 && !editing ? (
                <p className={styles.placeholder}>No relations yet.</p>
            ) : (
                <ListEditor
                    className={styles.relationStack}
                    editing={editing}
                    items={relations}
                    onChange={(items) => update({ relations: items })}
                    newItem={() => ({ name: '', relation: '', text: '' })}
                    addLabel="+ Add relation"
                    renderItem={(r, i, onItem) => (
                        <div className={styles.relationCard}>
                            <div className={styles.relationInfo}>
                                <EditableImage editing={editing} value={r.image} onChange={(v) => onItem({ image: v })} alt={r.name ?? ''} />
                                <div>
                                    {editing
                                        ? <EditableText editing value={r.name ?? ''} placeholder="Name" onChange={(v) => onItem({ name: v })} />
                                        : r.name && <b>{r.name}</b>}
                                    {editing
                                        ? <EditableText editing value={r.relation ?? ''} placeholder="Relationship" onChange={(v) => onItem({ relation: v })} />
                                        : r.relation && <span>{r.relation}</span>}
                                </div>
                            </div>
                            <EditableText as="p" multiline editing={editing} value={r.text ?? ''} placeholder="Notes"
                                onChange={(v) => onItem({ text: v })} className={styles.relationText} />
                        </div>
                    )}
                />
            )}

            {editing && (
                <div className={styles.decorEditor}>
                    <h2>decorative images</h2>
                    <ListEditor
                        editing={editing}
                        items={decor}
                        onChange={(items) => update({ decorImages: items })}
                        newItem={() => ''}
                        addLabel="+ Add decor image"
                        renderItem={(src, i, _onItem) => (
                            <EditableImage
                                editing
                                value={src}
                                onChange={(v) => {
                                    const next = decor.slice();
                                    next[i] = v;
                                    update({ decorImages: next });
                                }}
                            />
                        )}
                    />
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Append decor-editor CSS to `CharacterProfile.module.css`**

```css
.decorEditor { margin-top: 22px; border-top: 1px dashed var(--line); padding-top: 12px; }
.decorEditor img, .decorEditor .emptyImage { width: 100%; height: 90px; object-fit: cover; border-radius: 6px; }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (all page prop types satisfied now).

- [ ] **Step 4: Commit**

```bash
git add src/components/world/profile/RelationsPage.tsx src/components/world/profile/CharacterProfile.module.css
git commit -m "feat: editable Relations page + decorative images editor"
```

---

## Task 8: Verify

**Files:** none (verification only)

- [ ] **Step 1: Tests** — `npx vitest run` → PASS (incl. `imageUpload.test.ts`).
- [ ] **Step 2: Lint** — `npx eslint src/components/world/profile/` → 0 errors (img warnings OK).
- [ ] **Step 3: Build** — `npm run build` → succeeds.
- [ ] **Step 4: Preview** — dev login, open a character in the World Bible, click **Edit**, and confirm:
  - Text fields become inputs; typing updates live.
  - Dossier/traits/meters/palette/lookbook/sections/moodboards/relations each have add (＋) and remove (×); meters have sliders; palette has a colour picker.
  - Images accept a URL and a file upload (upload turns into a base64 preview).
  - **Save** persists (reload the page → edits remain on the entity). **Cancel** discards.
- [ ] **Step 5: Final commit** (if fixups needed):
```bash
git add -A && git commit -m "chore: character profile phase 2 verification fixups"
```

---

## Notes / Gotchas

- **`useWorkspaceStore` import:** the shell now imports it to call `updateEntity` and to persist `imageUrl` immediately (image changes are entity-level, not profile-level). Confirm `updateEntity` is exported (it is — used across the app).
- **Portrait vs profile fields:** the portrait is `entity.imageUrl` (persisted immediately on change via `updateEntity`), while all other fields live in `draft.profile` and persist on **Save**. This is intentional; note it in the PR.
- **`['--level' as string]` / `['--swatch' as string]`:** keep the string cast for CSS custom props (TS).
- **ListEditor partial vs full item:** `renderItem`'s `onItem` accepts `Partial<T>`; passing a full object (e.g., a full `ProfileMeter`) is a valid partial.
- **Placeholders in view mode:** `EditableText` returns `null` in view mode when empty and no placeholder given, so empty fields simply don't render (matching Phase 1).
- **CSS reuse:** editable pages reuse the Phase-1 profile CSS classes; only the toolbar and decor-editor styles are new.
