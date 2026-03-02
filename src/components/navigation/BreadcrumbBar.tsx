"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './BreadcrumbBar.module.css';
import { ATMOSPHERE_PRESETS } from '@/lib/atmospherePresets';
import { AtmospherePicker } from '../ui/AtmospherePicker';

export function BreadcrumbBar() {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const activeSceneId = useWorkspaceStore(state => state.activeSceneId);
    const projects = useWorkspaceStore(state => state.projects);
    const documents = useWorkspaceStore(state => state.documents);
    const scenes = useWorkspaceStore(state => state.scenes);
    const customAtmospheres = useWorkspaceStore(state => state.customAtmospheres);
    const atmospheresEnabled = useWorkspaceStore(state => state.atmospheresEnabled);

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    const activeProject = projects.find(p => p.id === activeProjectId);
    const activeDocument = documents.find(d => d.id === activeDocumentId);
    const activeScene = scenes.find(s => s.id === activeSceneId);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsPickerOpen(false);
            }
        };
        if (isPickerOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPickerOpen]);

    if (!activeProject) {
        return null;
    }

    const currentAtmosphere = atmospheresEnabled && activeScene?.atmosphereId
        ? ATMOSPHERE_PRESETS.find(a => a.id === activeScene.atmosphereId) || customAtmospheres.find(a => a.id === activeScene.atmosphereId)
        : null;

    return (
        <div className={styles.breadcrumbBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={styles.crumbLabel}>
                    {activeProject.name}
                </span>
                <span className={styles.separator}>›</span>
                <span className={styles.crumbLabel}>
                    {activeDocument ? activeDocument.title || 'Untitled Chapter' : 'No Chapter Selected'}
                </span>
            </div>

            {atmospheresEnabled && activeScene && (
                <div className={styles.atmosphereSection} ref={pickerRef}>
                    <button
                        className={`${styles.atmospherePill} ${!currentAtmosphere ? styles.muted : ''}`}
                        onClick={() => setIsPickerOpen(!isPickerOpen)}
                    >
                        {currentAtmosphere ? (
                            <>
                                <span>{currentAtmosphere.icon}</span>
                                <span>{currentAtmosphere.name}</span>
                            </>
                        ) : (
                            <>
                                <span>✦</span>
                                <span>Set atmosphere</span>
                            </>
                        )}
                    </button>

                    {isPickerOpen && (
                        <div className={styles.pickerPopup}>
                            <AtmospherePicker
                                sceneId={activeScene.id}
                                currentAtmosphereId={activeScene.atmosphereId}
                                onClose={() => setIsPickerOpen(false)}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
