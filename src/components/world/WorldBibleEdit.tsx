"use client";

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getWorldBibleConfig } from '@/lib/worldBibleNav';
import { worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';
import { BIBLE_PRESETS, createPresetLayout } from '@/lib/worldBiblePresets';
import styles from './WorldBibleEdit.module.css';

const CONFIRM_TIMEOUT_MS = 4000;

/**
 * WorldBibleEdit — the book's "Edit" destination. Edits the active shelf's
 * bible: cover identity, layout presets, and the danger zone.
 */
export default function WorldBibleEdit() {
    const worldBibles = useWorkspaceStore(s => s.worldBibles);
    const activeWorldKey = useWorkspaceStore(s => s.activeWorldKey) ?? STANDALONE_KEY;
    const worlds = useWorkspaceStore(s => s.worlds);
    const entities = useWorkspaceStore(s => s.entities);
    const updateWorldBibleConfig = useWorkspaceStore(s => s.updateWorldBibleConfig);
    const setWorldBibleLayout = useWorkspaceStore(s => s.setWorldBibleLayout);
    const deleteWorldEntities = useWorkspaceStore(s => s.deleteWorldEntities);
    const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);

    // Two-click confirm state: which destructive control is armed.
    const [confirming, setConfirming] = useState<string | null>(null);

    // An armed destructive confirm auto-disarms, so a later stray click can't
    // fire an irreversible action the user forgot they'd armed.
    useEffect(() => {
        if (!confirming) return;
        const t = setTimeout(() => setConfirming(null), CONFIRM_TIMEOUT_MS);
        return () => clearTimeout(t);
    }, [confirming]);

    const cfg = getWorldBibleConfig(worldBibles, activeWorldKey);
    const world = worlds.find(w => w.id === activeWorldKey);
    const defaultTitle = world?.name ?? 'Standalones';
    const articleCount = entities.filter(e => worldKeyForEntity(e) === activeWorldKey).length;
    const hasCustomLayout = !!worldBibles[activeWorldKey]?.layout?.roots?.length;

    const applyPreset = (presetId: string) => {
        const preset = BIBLE_PRESETS.find(p => p.id === presetId);
        if (!preset) return;
        if (hasCustomLayout && confirming !== `preset-${presetId}`) {
            setConfirming(`preset-${presetId}`);
            return;
        }
        setWorldBibleLayout(activeWorldKey, createPresetLayout(preset));
        setConfirming(null);
    };

    return (
        <div className={styles.container}>
            <div className={styles.inner}>
                <button className={styles.backBtn} onClick={() => setWorkspaceMode('bookshelf')}>
                    ← Bookshelf
                </button>
                <h1 className={styles.title}>Edit — {cfg.coverTitle ?? defaultTitle}</h1>
                <p className={styles.subtitle}>Settings for this shelf&rsquo;s World Bible.</p>

                {/* ── Book identity ── */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Book identity</h2>
                    <div className={styles.identityGrid}>
                        <div className={styles.fields}>
                            <label className={styles.field}>
                                <span>Cover title</span>
                                <input
                                    value={cfg.coverTitle ?? ''}
                                    placeholder={defaultTitle}
                                    onChange={(e) => updateWorldBibleConfig(activeWorldKey, { coverTitle: e.target.value || undefined })}
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Subtitle</span>
                                <input
                                    value={cfg.coverSub ?? ''}
                                    placeholder="World Bible"
                                    onChange={(e) => updateWorldBibleConfig(activeWorldKey, { coverSub: e.target.value || undefined })}
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Cover tint</span>
                                <div className={styles.tintRow}>
                                    <input
                                        type="color"
                                        value={cfg.tint ?? '#34343c'}
                                        onChange={(e) => updateWorldBibleConfig(activeWorldKey, { tint: e.target.value })}
                                    />
                                    {cfg.tint && (
                                        <button
                                            className={styles.tintClear}
                                            onClick={() => updateWorldBibleConfig(activeWorldKey, { tint: undefined })}
                                        >
                                            Reset to grey
                                        </button>
                                    )}
                                </div>
                            </label>
                        </div>
                        {/* Live flat preview of the cover */}
                        <div
                            className={styles.coverPreview}
                            style={cfg.tint ? { backgroundColor: cfg.tint, backgroundImage: 'none' } : undefined}
                        >
                            <span className={styles.previewTitle}>{cfg.coverTitle || defaultTitle}</span>
                            <span className={styles.previewSub}>{cfg.coverSub || 'World Bible'}</span>
                        </div>
                    </div>
                </section>

                {/* ── Layout presets ── */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Layout presets</h2>
                    <p className={styles.sectionHint}>
                        Swaps the category structure only — articles are never deleted, just re-grouped.
                    </p>
                    <div className={styles.presetGrid}>
                        {BIBLE_PRESETS.map(preset => (
                            <div key={preset.id} className={styles.presetCard}>
                                <div className={styles.presetHead}>
                                    <b>{preset.name}</b>
                                    <span>{preset.description}</span>
                                </div>
                                <div className={styles.presetChips}>
                                    {preset.categories.map(c => (
                                        <span key={c.label} className={styles.presetChip}>{c.icon} {c.label}</span>
                                    ))}
                                </div>
                                <button className={styles.presetApply} onClick={() => applyPreset(preset.id)}>
                                    {confirming === `preset-${preset.id}` ? 'Replace current layout?' : 'Apply'}
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Danger zone ── */}
                <section className={`${styles.section} ${styles.danger}`}>
                    <h2 className={styles.sectionTitle}>Danger zone</h2>
                    <div className={styles.dangerRow}>
                        <div>
                            <b>Reset layout to Standard</b>
                            <span>Replaces custom categories with the default four.</span>
                        </div>
                        <button
                            className={styles.dangerBtn}
                            onClick={() => {
                                if (confirming !== 'reset') { setConfirming('reset'); return; }
                                setWorldBibleLayout(activeWorldKey, createPresetLayout(BIBLE_PRESETS[0]));
                                setConfirming(null);
                            }}
                        >
                            {confirming === 'reset' ? 'Really reset?' : 'Reset layout'}
                        </button>
                    </div>
                    <div className={styles.dangerRow}>
                        <div>
                            <b>Clear all articles</b>
                            <span>{articleCount} article{articleCount === 1 ? '' : 's'} in this bible. This can&rsquo;t be undone.</span>
                        </div>
                        <button
                            className={styles.dangerBtn}
                            disabled={articleCount === 0}
                            onClick={() => {
                                if (confirming !== 'clear') { setConfirming('clear'); return; }
                                deleteWorldEntities(activeWorldKey);
                                setConfirming(null);
                            }}
                        >
                            {confirming === 'clear' ? `Delete ${articleCount} article${articleCount === 1 ? '' : 's'}?` : 'Clear articles'}
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
