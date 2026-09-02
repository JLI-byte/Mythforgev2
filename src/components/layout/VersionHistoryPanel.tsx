"use client";

import React, { useId, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ChevronRight, X } from 'lucide-react';
import styles from './VersionHistoryPanel.module.css';
import { useWorkspaceStore, selectProjectWorldKey } from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';

interface VersionHistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTabClick: () => void;
    tabWidth: number;
    onTabWidthChange: (width: number) => void;
    panelWidth: number;
    onPanelWidthChange: (width: number) => void;
}

const HistoryIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l4 2" />
    </svg>
);

export function VersionHistoryPanel({ 
    isOpen, 
    onClose, 
    onTabClick, 
    tabWidth, 
    onTabWidthChange, 
    panelWidth, 
    onPanelWidthChange 
}: VersionHistoryPanelProps) {
    const [mounted, setMounted] = useState(false);
    const fieldId = useId();
    const [activeTab, setActiveTab] = useState<'scenes' | 'world'>('scenes');
    
    // Store State
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const documents = useWorkspaceStore(state => state.documents);
    const scenes = useWorkspaceStore(state => state.scenes);
    const entities = useWorkspaceStore(state => state.entities);
    const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);
    const sceneSnapshots = useWorkspaceStore(state => state.sceneSnapshots);
    const entitySnapshots = useWorkspaceStore(state => state.entitySnapshots);
    
    // Actions
    const saveSceneSnapshot = useWorkspaceStore(state => state.saveSceneSnapshot);
    const saveEntitySnapshot = useWorkspaceStore(state => state.saveEntitySnapshot);
    const restoreSceneSnapshot = useWorkspaceStore(state => state.restoreSceneSnapshot);
    const restoreEntitySnapshot = useWorkspaceStore(state => state.restoreEntitySnapshot);
    const deleteSnapshot = useWorkspaceStore(state => state.deleteSnapshot);

    // Local selection state
    const [selectedSceneId, setSelectedSceneId] = useState<string>('');
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');

    useEffect(() => { setMounted(true); }, []);

    // Filter scenes for current project
    const projectScenes = useMemo(() => {
        return scenes.filter(s => s.projectId === activeProjectId);
    }, [scenes, activeProjectId]);

    // Filter entities with article content for current project's world
    const worldEntities = useMemo(() => {
        return entities.filter(e => worldKeyForEntity(e) === projectWorldKey && (e.articleDoc || (e.articleBlocks && e.articleBlocks.length > 0)));
    }, [entities, projectWorldKey]);

    // Set defaults when project or tab changes
    useEffect(() => {
        if (activeTab === 'scenes' && projectScenes.length > 0 && !selectedSceneId) {
            setSelectedSceneId(projectScenes[0].id);
        }
        if (activeTab === 'world' && worldEntities.length > 0 && !selectedEntityId) {
            setSelectedEntityId(worldEntities[0].id);
        }
    }, [activeTab, projectScenes, worldEntities]);

    const activeSnapshots = useMemo(() => {
        if (activeTab === 'scenes') {
            return sceneSnapshots
                .filter(s => s.sceneId === selectedSceneId)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else {
            return entitySnapshots
                .filter(s => s.entityId === selectedEntityId)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
    }, [activeTab, selectedSceneId, selectedEntityId, sceneSnapshots, entitySnapshots]);

    const handleManualSave = () => {
        const label = prompt('Enter a label for this snapshot:', `Manual — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        if (!label) return;

        if (activeTab === 'scenes' && selectedSceneId) {
            saveSceneSnapshot(selectedSceneId, label, false);
        } else if (activeTab === 'world' && selectedEntityId) {
            saveEntitySnapshot(selectedEntityId, label, false);
        }
    };

    const handleRestore = (id: string) => {
        const msg = activeTab === 'scenes' 
            ? "Restore this scene version? Your current text will be backed up automatically before replacement."
            : "Restore this entity article? Your current content will be backed up automatically.";
            
        if (confirm(msg)) {
            if (activeTab === 'scenes') restoreSceneSnapshot(id);
            else restoreEntitySnapshot(id);
        }
    };

    return (
        <>
            {mounted && createPortal(
                <button
                    className={`${styles.sideTab} ${isOpen ? styles.sideTabActive : ''}`}
                    style={{
                        width: tabWidth,
                        right: isOpen ? panelWidth : 0,
                        top: 568, // rail slots are 130px: WB 48, Goals 178, Social 308, Music 438, History 568
                        transition: 'right 280ms ease-in-out',
                    }}
                    onClick={onTabClick}
                    title="Version History"
                    aria-label="Toggle Version History"
                >
                    <div
                        className={styles.dragHandle}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const startX = e.clientX;
                            const startWidth = tabWidth;
                            const onMouseMove = (moveEvent: MouseEvent) => {
                                const delta = startX - moveEvent.clientX;
                                const newWidth = Math.min(120, Math.max(44, startWidth + delta));
                                onTabWidthChange(newWidth);
                            };
                            const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                            };
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                        }}
                        title="Drag to resize tab"
                    />
                    <HistoryIcon />
                    <span className={styles.sideTabLabel}>History</span>
                </button>,
                document.body
            )}

            {mounted && isOpen && createPortal(
                <button
                    className={styles.ghostTab}
                    style={{
                        width: tabWidth,
                        height: 130,
                        top: 568,
                        right: 0,
                    }}
                    onClick={onClose}
                    title="Close History"
                >
                    <span className={styles.ghostTabArrow} aria-hidden="true"><ChevronRight size={12} /></span>
                </button>,
                document.body
            )}

            <div
                className={`${styles.panel} ${isOpen ? styles.open : ''}`}
                style={{ width: panelWidth }}
                // A closed panel is only pushed off-screen, not unmounted — without this it
                // keeps its tab stops and stays in the accessibility tree.
                inert={!isOpen}
            >
                <div className={styles.panelInner}>
                    <div
                        className={styles.panelResizeHandle}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startWidth = panelWidth;
                            const onMouseMove = (moveEvent: MouseEvent) => {
                                const delta = startX - moveEvent.clientX;
                                const newWidth = Math.min(1600, Math.max(300, startWidth + delta));
                                onPanelWidthChange(newWidth);
                            };
                            const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                            };
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                        }}
                        title="Drag to resize panel"
                    />
                    
                    <div className={styles.header} style={{ paddingRight: tabWidth }}>
                        <h2 className={styles.title}>Version History</h2>
                        <button className={styles.closeButton} onClick={onClose} aria-label="Close" title="Close"><X size={18} /></button>
                    </div>

                    <div className={styles.tabSwitcher}>
                        <button 
                            className={`${styles.tabBtn} ${activeTab === 'scenes' ? styles.tabBtnActive : ''}`}
                            onClick={() => setActiveTab('scenes')}
                        >
                            Scenes
                        </button>
                        <button 
                            className={`${styles.tabBtn} ${activeTab === 'world' ? styles.tabBtnActive : ''}`}
                            onClick={() => setActiveTab('world')}
                        >
                            World Bible
                        </button>
                    </div>

                    <div className={styles.contentWrapper} style={{ paddingRight: tabWidth }}>
                        <div className={styles.selectorSection}>
                            <label className={styles.selectLabel} htmlFor={`${fieldId}-version-target`}>
                                {activeTab === 'scenes' ? 'Select Scene' : 'Select Entity'}
                            </label>
                            <select 
                                id={`${fieldId}-version-target`}
                                className={styles.selectInput}
                                value={activeTab === 'scenes' ? selectedSceneId : selectedEntityId}
                                onChange={(e) => activeTab === 'scenes' ? setSelectedSceneId(e.target.value) : setSelectedEntityId(e.target.value)}
                            >
                                {activeTab === 'scenes' ? (
                                    projectScenes.map(s => {
                                        const doc = documents.find(d => d.id === s.documentId);
                                        return <option key={s.id} value={s.id}>{doc?.title || 'Chapter'} — {s.title}</option>;
                                    })
                                ) : (
                                    worldEntities.map(e => (
                                        <option key={e.id} value={e.id}>{e.name} ({e.type})</option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div className={styles.saveActions}>
                            <button className={styles.snapshotBtn} onClick={handleManualSave}>
                                <Camera size={15} aria-hidden="true" /> Save Snapshot
                            </button>
                        </div>

                        <div className={styles.listSection}>
                            <div className={styles.listTitle}>
                                History for {
                                    activeTab === 'scenes' 
                                        ? projectScenes.find(s => s.id === selectedSceneId)?.title || 'Selected Scene'
                                        : worldEntities.find(e => e.id === selectedEntityId)?.name || 'Selected Entity'
                                }
                            </div>
                            
                            {activeSnapshots.length === 0 ? (
                                <div className={styles.emptyState}>No snapshots found for this item.</div>
                            ) : (
                                activeSnapshots.map(snap => (
                                    <div key={snap.id} className={styles.snapshotItem}>
                                        <div className={styles.snapshotHeader}>
                                            <span className={styles.snapshotLabel} title={snap.label}>{snap.label}</span>
                                            {snap.isAuto && <span className={styles.autoPill}>Auto</span>}
                                        </div>
                                        <div className={styles.itemMeta}>
                                            <span>{new Date(snap.createdAt).toLocaleDateString()} {new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {'wordCount' in snap && <span>• {snap.wordCount.toLocaleString()} words</span>}
                                        </div>
                                        <div className={styles.itemActions}>
                                            <button 
                                                className={`${styles.actionBtn} ${styles.restoreBtn}`}
                                                onClick={() => handleRestore(snap.id)}
                                            >
                                                Restore
                                            </button>
                                            <button 
                                                className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                                onClick={() => deleteSnapshot(snap.id, activeTab === 'scenes' ? 'scene' : 'entity')}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
