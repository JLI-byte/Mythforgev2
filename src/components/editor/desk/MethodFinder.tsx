"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { DRAFT_TYPES, getMethod } from '@/lib/writingMethods';
import { WorkStyle, StructureAppetite, recommendMethods } from '@/lib/writingMethods/finder';
import styles from './MethodLibrary.module.css';

interface MethodFinderProps {
    onClose: () => void;
    /** Apply the chosen method and remember the draft type for the library. */
    onApply: (methodId: string, draftTypeId: string) => void;
    /** Fall back to browsing the full library. */
    onBrowseLibrary: () => void;
}

const WORK_OPTIONS: { value: WorkStyle; label: string; desc: string }[] = [
    { value: 'plan', label: 'Plan it all first', desc: 'I want the map before I start driving' },
    { value: 'both', label: 'A bit of both', desc: 'Some plan, some discovery — it depends' },
    { value: 'discover', label: 'Discover as I write', desc: 'Outlines kill it for me; I write to find out' },
];

const STRUCTURE_OPTIONS: { value: StructureAppetite; label: string; desc: string }[] = [
    { value: 'full', label: 'Every beat mapped', desc: 'Give me the full checklist' },
    { value: 'landmarks', label: 'Just the landmarks', desc: 'A few big signposts, space between them' },
    { value: 'minimal', label: 'Barely any', desc: 'Stay out of my way' },
];

/**
 * The 10-second method finder: what are you making → how do you work →
 * how much structure → two recommendations with a "why".
 */
export function MethodFinder({ onClose, onApply, onBrowseLibrary }: MethodFinderProps) {
    const [step, setStep] = useState(1);
    const [draftTypeId, setDraftTypeId] = useState<string | null>(null);
    const [workStyle, setWorkStyle] = useState<WorkStyle | null>(null);
    const [structure, setStructure] = useState<StructureAppetite | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const showResults = step === 4 && draftTypeId && workStyle && structure;
    const recommendations = showResults ? recommendMethods({ draftTypeId, workStyle, structure }) : [];

    const renderOptions = <T extends string>(
        options: { value: T; label: string; desc: string }[],
        onPick: (value: T) => void,
    ) => (
        <div className={styles.finderOptions}>
            {options.map(opt => (
                <button key={opt.value} className={styles.finderOption} onClick={() => { onPick(opt.value); setStep(s => s + 1); }}>
                    <span className={styles.starterName}>{opt.label}</span>
                    <span className={styles.starterTagline}>{opt.desc}</span>
                </button>
            ))}
        </div>
    );

    const modal = (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={`${styles.modal} ${styles.finderModal}`} onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Close method finder"><X size={16} /></button>

                <div className={styles.header}>
                    <h2 className={styles.title}>{showResults ? 'Your matches' : 'Find your method'}</h2>
                    <p className={styles.subtitle}>
                        {showResults
                            ? 'Two methods that fit how you work. Pick one — you can always switch later.'
                            : `Question ${step} of 3 — ten seconds, no wrong answers.`}
                    </p>
                </div>

                <div className={styles.scroll}>
                    {step === 1 && (
                        <>
                            <div className={styles.sectionLabel}>What are you writing?</div>
                            <div className={styles.typeGrid}>
                                {DRAFT_TYPES.map(t => (
                                    <button
                                        key={t.id}
                                        className={styles.typeCard}
                                        onClick={() => { setDraftTypeId(t.id); setStep(2); }}
                                    >
                                        <span className={styles.typeIcon}>{t.icon}</span>
                                        <span className={styles.starterName}>{t.label}</span>
                                        <span className={styles.starterTagline}>{t.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className={styles.sectionLabel}>How do you like to work?</div>
                            {renderOptions(WORK_OPTIONS, setWorkStyle)}
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <div className={styles.sectionLabel}>How much structure do you want?</div>
                            {renderOptions(STRUCTURE_OPTIONS, setStructure)}
                        </>
                    )}

                    {showResults && (
                        <div className={styles.finderResults}>
                            {recommendations.map(rec => {
                                const method = getMethod(rec.methodId);
                                if (!method) return null;
                                return (
                                    <div key={rec.methodId} className={styles.finderResultCard}>
                                        <span className={styles.starterName}>{method.name}</span>
                                        <span className={styles.starterTagline}>{method.tagline}</span>
                                        <span className={styles.finderWhy}>Why it fits: {rec.why}</span>
                                        <div className={styles.finderResultFooter}>
                                            <span className={styles.starterMeta}>{method.bestFor} · {method.beats.length} cards</span>
                                            <button className={styles.welcomePrimary} onClick={() => onApply(method.id, draftTypeId!)}>
                                                Use This Method
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className={styles.finderFooter}>
                        {step > 1 && (
                            <button className={styles.finderBack} onClick={() => setStep(s => Math.max(1, s - 1))}>
                                ← Back
                            </button>
                        )}
                        {showResults && (
                            <button className={styles.finderBack} onClick={onBrowseLibrary}>
                                Browse the full library instead
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
