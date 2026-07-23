"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    DRAFT_TYPES, getDraftType, getMethod, methodsForType,
    WRITING_METHODS, WritingMethod, MethodFamily, FAMILY_LABELS,
} from '@/lib/writingMethods';
import styles from './MethodLibrary.module.css';

interface MethodLibraryProps {
    onClose: () => void;
    onApply: (methodId: string) => void;
    /** The project's chosen draft type (null = not picked yet). */
    draftTypeId: string | null;
    onDraftTypeChange: (typeId: string) => void;
    /** Optional hand-off to the finder quiz. */
    onOpenFinder?: () => void;
}

/** Group a method list by family, preserving registry order. */
function groupByFamily(methods: WritingMethod[]): { family: MethodFamily; label: string; methods: WritingMethod[] }[] {
    const groups: { family: MethodFamily; label: string; methods: WritingMethod[] }[] = [];
    methods.forEach(m => {
        let group = groups.find(g => g.family === m.family);
        if (!group) {
            group = { family: m.family, label: FAMILY_LABELS[m.family], methods: [] };
            groups.push(group);
        }
        group.methods.push(m);
    });
    return groups;
}

/**
 * Method Library — the Draft Table's method picker modal.
 *
 * Type-first: "What are you writing?" leads, then recommendations for that
 * draft type, with the full registry behind "Browse all".
 */
export function MethodLibrary({ onClose, onApply, draftTypeId, onDraftTypeChange, onOpenFinder }: MethodLibraryProps) {
    const [isBrowsingAll, setIsBrowsingAll] = useState(false);
    const [isShowingEverything, setIsShowingEverything] = useState(false);
    const [isChangingType, setIsChangingType] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const draftType = draftTypeId ? getDraftType(draftTypeId) : undefined;
    const needsTypePick = !draftType || isChangingType;

    const recommended = draftType
        ? draftType.recommended.map(getMethod).filter((m): m is WritingMethod => !!m)
        : [];
    const pool = draftType ? methodsForType(draftType) : [];
    const browseGroups = groupByFamily(isShowingEverything ? WRITING_METHODS : pool);

    const modal = (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Close method library">×</button>

                {needsTypePick ? (
                    <>
                        <div className={styles.header}>
                            <h2 className={styles.title}>What are you writing?</h2>
                            <p className={styles.subtitle}>
                                This shapes which methods fit best. You can change it anytime.
                            </p>
                        </div>
                        <div className={styles.scroll}>
                            <div className={styles.typeGrid}>
                                {DRAFT_TYPES.map(t => (
                                    <button
                                        key={t.id}
                                        className={styles.typeCard}
                                        onClick={() => { onDraftTypeChange(t.id); setIsChangingType(false); setIsBrowsingAll(false); }}
                                    >
                                        <span className={styles.typeIcon}>{t.icon}</span>
                                        <span className={styles.starterName}>{t.label}</span>
                                        <span className={styles.starterTagline}>{t.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.header}>
                            <h2 className={styles.title}>Choose a Writing Method</h2>
                            <p className={styles.subtitle}>
                                Guided cards appear on your canvas — fill them in any order, rearrange freely.
                                {onOpenFinder && (
                                    <>
                                        {' '}<button className={styles.finderLink} onClick={onOpenFinder}>Not sure? ✨ Help me choose</button>
                                    </>
                                )}
                            </p>
                            <div className={styles.typeHeader}>
                                <span className={styles.typeHeaderLabel}>
                                    {draftType.icon} {draftType.label}
                                </span>
                                <button className={styles.typeChangeBtn} onClick={() => setIsChangingType(true)}>
                                    change
                                </button>
                            </div>
                        </div>

                        <div className={styles.scroll}>
                            <div className={styles.sectionLabel}>Recommended for {draftType.label}</div>
                            <div className={styles.starterGrid}>
                                {recommended.map(m => (
                                    <button key={m.id} className={styles.starterCard} onClick={() => onApply(m.id)}>
                                        <span className={styles.starterName}>{m.name}</span>
                                        <span className={styles.starterTagline}>{m.tagline}</span>
                                        <span className={styles.starterMeta}>{m.bestFor} · {m.beats.length} cards</span>
                                    </button>
                                ))}
                            </div>

                            {!isBrowsingAll ? (
                                <button className={styles.browseToggle} onClick={() => setIsBrowsingAll(true)}>
                                    Browse all {pool.length} methods for {draftType.label.toLowerCase()} ▾
                                </button>
                            ) : (
                                <>
                                    <button className={styles.browseToggle} onClick={() => { setIsBrowsingAll(false); setIsShowingEverything(false); }}>
                                        Show less ▴
                                    </button>
                                    {browseGroups.map(group => (
                                        <div key={group.family} className={styles.familyGroup}>
                                            <div className={styles.familyLabel}>{group.label}</div>
                                            {group.methods.map(m => (
                                                <button key={m.id} className={styles.methodRow} onClick={() => onApply(m.id)}>
                                                    <span className={styles.methodRowName}>{m.name}</span>
                                                    <span className={styles.methodRowTagline}>{m.tagline}</span>
                                                    <span className={styles.methodRowBeats}>{m.beats.length} cards</span>
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                    {!isShowingEverything && (
                                        <button className={styles.browseToggle} style={{ marginTop: 12 }} onClick={() => setIsShowingEverything(true)}>
                                            Show every method, all formats
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}

interface ConfirmDialogProps {
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}

/** Small destructive-action confirm (native confirm() is unsupported in this runtime). */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel]);

    return createPortal(
        <div className={styles.backdrop} onClick={onCancel}>
            <div className={`${styles.modal} ${styles.confirmModal}`} onClick={e => e.stopPropagation()}>
                <h2 className={styles.title}>{title}</h2>
                <p className={styles.subtitle}>{body}</p>
                <div className={styles.confirmActions}>
                    <button className={styles.welcomeSecondary} onClick={onCancel}>Cancel</button>
                    <button className={styles.confirmDanger} onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

interface DraftTableWelcomeProps {
    onPickMethod: () => void;
    onFindMethod: () => void;
    onStartBlank: () => void;
}

/** Empty-state overlay shown on a fresh Draft Table canvas. */
export function DraftTableWelcome({ onPickMethod, onFindMethod, onStartBlank }: DraftTableWelcomeProps) {
    return (
        <div className={styles.welcome}>
            <div className={styles.welcomeInner}>
                <h2 className={styles.welcomeTitle}>The Draft Table</h2>
                <p className={styles.welcomeSub}>
                    Outline your story, script, or article here — with a guided writing
                    method, or on a blank canvas. Export to the Writing Desk when you’re ready.
                </p>
                <div className={styles.welcomeActions}>
                    <button className={styles.welcomePrimary} onClick={onPickMethod}>
                        📚 Pick a Method
                    </button>
                    <button className={styles.welcomePrimary} onClick={onFindMethod}>
                        ✨ Help Me Choose
                    </button>
                    <button className={styles.welcomeSecondary} onClick={onStartBlank}>
                        Start Blank
                    </button>
                </div>
            </div>
        </div>
    );
}
