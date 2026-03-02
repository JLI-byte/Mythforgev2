"use client";

import React, { useState } from 'react';
import styles from './AtmospherePicker.module.css';
import { useWorkspaceStore, Atmosphere } from '@/store/workspaceStore';
import { ATMOSPHERE_PRESETS } from '@/lib/atmospherePresets';
import { AtmosphereEditor } from './AtmosphereEditor';

interface AtmospherePickerProps {
    sceneId: string;
    currentAtmosphereId: string | undefined;
    onClose: () => void;
}

/**
 * AtmospherePicker
 * 
 * An inline popover allowing users to select an emotional atmosphere for a scene.
 * Contains tabs for curated Presets and custom user-created ("Mine") atmospheres.
 */
export function AtmospherePicker({ sceneId, currentAtmosphereId, onClose }: AtmospherePickerProps) {
    const [activeTab, setActiveTab] = useState<'presets' | 'mine'>('presets');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorAtmosphere, setEditorAtmosphere] = useState<Atmosphere | undefined>(undefined);

    const theme = useWorkspaceStore(state => state.theme);
    const customAtmospheres = useWorkspaceStore(state => state.customAtmospheres);
    const updateScene = useWorkspaceStore(state => state.updateScene);
    const addCustomAtmosphere = useWorkspaceStore(state => state.addCustomAtmosphere);

    const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const handleSelect = (id: string | undefined) => {
        updateScene(sceneId, { atmosphereId: id });
        onClose();
    };

    const handleDuplicate = (preset: Atmosphere, e: React.MouseEvent) => {
        e.stopPropagation();
        const duplicated: Atmosphere = {
            ...preset,
            id: crypto.randomUUID(),
            name: `${preset.name} (Copy)`,
            isPreset: false,
            projectId: null, // Will be set in editor or by store
            createdAt: new Date()
        };
        addCustomAtmosphere(duplicated);
        setActiveTab('mine');
    };

    const handleCreateNew = () => {
        setEditorAtmosphere(undefined);
        setEditorOpen(true);
    };

    const handleEditCustom = (atm: Atmosphere, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditorAtmosphere(atm);
        setEditorOpen(true);
    };

    return (
        <>
            <div className={styles.pickerPopover} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h4 className={styles.title}>Scene Atmosphere</h4>
                    <button className={styles.closeButton} onClick={onClose} aria-label="Close">×</button>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'presets' ? styles.active : ''}`}
                        onClick={() => setActiveTab('presets')}
                    >
                        Presets
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'mine' ? styles.active : ''}`}
                        onClick={() => setActiveTab('mine')}
                    >
                        Mine
                    </button>
                </div>

                <div className={styles.content}>
                    {activeTab === 'presets' && (
                        <>
                            <button
                                className={styles.noneOption}
                                onClick={() => handleSelect(undefined)}
                            >
                                🚫 None (Clear)
                            </button>
                            <div className={styles.grid}>
                                {ATMOSPHERE_PRESETS.map(atm => (
                                    <div
                                        key={atm.id}
                                        className={`${styles.item} ${currentAtmosphereId === atm.id ? styles.active : ''}`}
                                        onClick={() => handleSelect(atm.id)}
                                    >
                                        <span className={styles.icon}>{atm.icon}</span>
                                        <span className={styles.name}>{atm.name}</span>
                                        <div
                                            className={styles.swatch}
                                            style={{ backgroundColor: isDark ? atm.darkBackground : atm.lightBackground }}
                                        />

                                        <div className={styles.duplicateOverlay}>
                                            <button
                                                className={styles.duplicateButton}
                                                onClick={(e) => handleDuplicate(atm, e)}
                                            >
                                                Duplicate to Mine
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {activeTab === 'mine' && (
                        <div className={styles.grid}>
                            {customAtmospheres.map(atm => (
                                <div
                                    key={atm.id}
                                    className={`${styles.item} ${currentAtmosphereId === atm.id ? styles.active : ''}`}
                                    onClick={() => handleSelect(atm.id)}
                                >
                                    <span className={styles.icon}>{atm.icon}</span>
                                    <span className={styles.name}>{atm.name}</span>
                                    <div
                                        className={styles.swatch}
                                        style={{ backgroundColor: isDark ? atm.darkBackground : atm.lightBackground }}
                                    />
                                    <div className={styles.duplicateOverlay}>
                                        <button
                                            className={styles.duplicateButton}
                                            onClick={(e) => handleEditCustom(atm, e)}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {customAtmospheres.length === 0 && (
                                <p style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem 0' }}>
                                    No custom atmospheres yet.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {activeTab === 'mine' && (
                    <div className={styles.footer}>
                        <button className={styles.createNewButton} onClick={handleCreateNew}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Create New
                        </button>
                    </div>
                )}
            </div>

            {editorOpen && (
                <AtmosphereEditor
                    atmosphere={editorAtmosphere}
                    onClose={() => setEditorOpen(false)}
                />
            )}
        </>
    );
}
