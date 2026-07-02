"use client";

import React, { useState } from 'react';
import { Entity, CharacterProfile as ProfileData, createDefaultProfile } from '@/store/workspaceStore';
import { playfair, cormorant, nunito } from './profileFonts';
import MainPage from './MainPage';
import PersonaPage from './PersonaPage';
import AppearancePage from './AppearancePage';
import RelationsPage from './RelationsPage';
import styles from './CharacterProfile.module.css';

type PageId = 'main' | 'persona' | 'appearance' | 'relations';
const PAGES: { id: PageId; label: string }[] = [
    { id: 'main', label: 'Main' },
    { id: 'persona', label: 'Persona' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'relations', label: 'Relations' },
];

interface CharacterProfileProps {
    entity: Entity;
}

/**
 * CharacterProfile — read-only "glamour" character sheet
 * (codepen.io/mahricodes/pen/EaNZwYG). Fixed 900×720 card with a left image
 * panel + four navigable pages, rendered from entity.profile.
 */
export default function CharacterProfile({ entity }: CharacterProfileProps) {
    const [page, setPage] = useState<PageId>('main');

    // Merge stored profile over the default scaffold; fall back to entity fields.
    const profile: ProfileData = { ...createDefaultProfile(), ...(entity.profile ?? {}) };
    const displayName = profile.fullName || entity.name;
    const pageNumber = String(PAGES.findIndex(p => p.id === page) + 1).padStart(2, '0');
    const fontVars = `${playfair.variable} ${cormorant.variable} ${nunito.variable}`;

    return (
        <div className={`${styles.bg} ${fontVars}`}>
            {/* Left image panel */}
            <div className={styles.imgSide}>
                <div className={styles.imgBox}>
                    {entity.imageUrl && <img src={entity.imageUrl} alt={displayName} />}
                </div>
                <div className={styles.sideStar}>✦</div>
                {profile.tagline && <div className={styles.sideQuote}>{profile.tagline}</div>}
                <div className={styles.sideCaption}>
                    <b>{displayName}</b>
                    {entity.subcategory && <span>{entity.subcategory}</span>}
                </div>
            </div>

            {/* Decorative (customizable) images */}
            {(profile.decorImages ?? []).slice(0, 2).map((src, i) =>
                src ? <img key={i} className={styles.decor} src={src} alt="" aria-hidden="true" /> : null,
            )}

            {/* Big vertical name + page number */}
            <div className={styles.bigTitle}><span>{displayName}</span></div>
            <div className={styles.number}>{pageNumber}</div>

            {/* Right content */}
            <div className={styles.content}>
                <div className={styles.topline}>
                    <span />
                    {profile.quote && <div className={styles.quote}>“{profile.quote}”</div>}
                </div>

                <div className={styles.page}>
                    {page === 'main' && <MainPage profile={profile} name={displayName} />}
                    {page === 'persona' && <PersonaPage profile={profile} />}
                    {page === 'appearance' && <AppearancePage profile={profile} />}
                    {page === 'relations' && <RelationsPage profile={profile} />}
                </div>
            </div>

            {/* Page nav */}
            <nav className={styles.nav}>
                {PAGES.map(p => (
                    <button
                        key={p.id}
                        type="button"
                        className={`${styles.navBtn} ${page === p.id ? styles.navBtnActive : ''}`}
                        onClick={() => setPage(p.id)}
                    >
                        {p.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
