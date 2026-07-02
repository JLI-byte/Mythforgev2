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
