"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './NavigationPanel.module.css';
import { useWorkspaceStore, Atmosphere } from '@/store/workspaceStore';
import { ATMOSPHERE_PRESETS } from '@/lib/atmospherePresets';
import { AtmospherePicker } from '../ui/AtmospherePicker';
import { SpotifyPlayer } from '../ui/SpotifyPlayer';
import SettingsModal from '../ui/SettingsModal';

/**
 * NavigationPanel UI Component
 * 
 * Centralized unified navigation rendering a tree/accordion structure.
 * Chapters at root level; clicking expands them to reveal contained scenes.
 * Replaces older dual-panel (ChapterPanel/ScenePanel) layouts.
 */
export function NavigationPanel() {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const documents = useWorkspaceStore(state => state.documents);
    const scenes = useWorkspaceStore(state => state.scenes);
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const activeSceneId = useWorkspaceStore(state => state.activeSceneId);

    const addDocument = useWorkspaceStore(state => state.addDocument);
    const updateDocument = useWorkspaceStore(state => state.updateDocument);
    const deleteDocument = useWorkspaceStore(state => state.deleteDocument);
    const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);

    const addScene = useWorkspaceStore(state => state.addScene);
    const updateScene = useWorkspaceStore(state => state.updateScene);
    const deleteScene = useWorkspaceStore(state => state.deleteScene);
    const setActiveScene = useWorkspaceStore(state => state.setActiveScene);
    const reorderScenes = useWorkspaceStore(state => state.reorderScenes);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editType, setEditType] = useState<'chapter' | 'scene' | null>(null);
    const [editModeName, setEditModeName] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [openPickerId, setOpenPickerId] = useState<string | null>(null);
    const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    const theme = useWorkspaceStore(state => state.theme);
    const setTheme = useWorkspaceStore(state => state.setTheme);
    const customAtmospheres = useWorkspaceStore(state => state.customAtmospheres);
    const atmospheresEnabled = useWorkspaceStore(state => state.atmospheresEnabled);
    const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Drag State for scenes
    const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
    const [dragOverSceneId, setDragOverSceneId] = useState<string | null>(null);

    const editInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
                setOpenPickerId(null);
            }
        };

        if (openMenuId || openPickerId) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openMenuId, openPickerId]);

    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    // We cannot early return the entire component because we still need to render the
    // Sidebar structure and the Spotify Player even if no project is active yet.
    // if (!activeProjectId) return null;

    const projectChapters = activeProjectId ? documents
        .filter(d => d.projectId === activeProjectId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [];

    const activeChapterScenes = scenes
        .filter(s => s.documentId === activeDocumentId)
        .sort((a, b) => a.order - b.order);

    // --- Actions ---
    const handleAddChapter = () => {
        if (!activeProjectId) return;
        const newDocId = crypto.randomUUID();
        const newDoc = {
            id: newDocId,
            projectId: activeProjectId,
            title: `Chapter ${projectChapters.length + 1}`,
            content: '',
            createdAt: new Date()
        };

        const newSceneId = crypto.randomUUID();
        const newScene = {
            id: newSceneId,
            documentId: newDocId,
            projectId: activeProjectId,
            title: 'Scene 1',
            content: '',
            order: 0,
            createdAt: new Date()
        };

        addDocument(newDoc);
        addScene(newScene);
        setActiveDocument(newDocId);
        setActiveScene(newSceneId);
    };

    const handleAddScene = (chapterId: string) => {
        if (!activeProjectId) return;
        const chapterScenes = scenes.filter(s => s.documentId === chapterId);
        const newSceneId = crypto.randomUUID();
        const newScene = {
            id: newSceneId,
            documentId: chapterId,
            projectId: activeProjectId,
            title: `Scene ${chapterScenes.length + 1}`,
            content: '',
            order: chapterScenes.length,
            createdAt: new Date()
        };
        addScene(newScene);
        setActiveScene(newSceneId);
    };

    const handleStartRename = (id: string, currentTitle: string, type: 'chapter' | 'scene', e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        setEditingId(id);
        setEditType(type);
        setEditModeName(currentTitle);
    };

    const handleCommitRename = () => {
        if (editType === 'chapter' && editingId && editModeName.trim()) {
            updateDocument(editingId, { title: editModeName.trim() });
        } else if (editType === 'scene' && editingId && editModeName.trim()) {
            updateScene(editingId, { title: editModeName.trim() });
        }
        setEditingId(null);
        setEditType(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCommitRename();
        if (e.key === 'Escape') {
            setEditingId(null);
            setEditType(null);
        }
    };

    const getAtmosphere = (id?: string | null): Atmosphere | undefined => {
        if (!id) return undefined;
        return ATMOSPHERE_PRESETS.find(p => p.id === id) || customAtmospheres.find(a => a.id === id);
    };

    const handleDeleteChapter = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        if (window.confirm('Delete this chapter and all its scenes? This cannot be undone.')) {
            deleteDocument(id);
        }
    };

    const handleDeleteScene = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        if (window.confirm('Delete this scene? This cannot be undone.')) {
            deleteScene(id);
        }
    };

    // --- Drag and Drop ---
    const handleDragStart = (e: React.DragEvent, sceneId: string) => {
        setDraggedSceneId(sceneId);
        e.dataTransfer.effectAllowed = 'move';
        // Transparent element required for dragging imagery
        const ghostInstance = document.createElement('div');
        ghostInstance.style.opacity = '0.001';
        document.body.appendChild(ghostInstance);
        e.dataTransfer.setDragImage(ghostInstance, 0, 0);
        setTimeout(() => document.body.removeChild(ghostInstance), 0);
    };

    const handleDragOver = (e: React.DragEvent, sceneId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (sceneId !== draggedSceneId) {
            setDragOverSceneId(sceneId);
        }
    };

    const handleDragLeave = () => {
        setDragOverSceneId(null);
    };

    const handleDrop = (e: React.DragEvent, targetSceneId: string) => {
        e.preventDefault();
        if (!draggedSceneId || draggedSceneId === targetSceneId || !activeDocumentId) return;

        const scenesInCurrentDoc = [...activeChapterScenes];
        const sourceIndex = scenesInCurrentDoc.findIndex(s => s.id === draggedSceneId);
        const targetIndex = scenesInCurrentDoc.findIndex(s => s.id === targetSceneId);

        if (sourceIndex !== -1 && targetIndex !== -1) {
            scenesInCurrentDoc.splice(targetIndex, 0, scenesInCurrentDoc.splice(sourceIndex, 1)[0]);
            reorderScenes(activeDocumentId, scenesInCurrentDoc.map(s => s.id));
        }

        setDraggedSceneId(null);
        setDragOverSceneId(null);
    };

    const handleDragEnd = () => {
        setDraggedSceneId(null);
        setDragOverSceneId(null);
    };

    const handleThemeToggle = () => {
        if (theme === 'light') setTheme('dark');
        else if (theme === 'dark') setTheme('system');
        else setTheme('light');
    };

    const renderThemeIcon = () => {
        if (theme === 'light') return '☀️';
        if (theme === 'dark') return '🌙';
        return '🖥️';
    };

    return (
        <div className={styles.navigationPanel}>
            {activeProjectId ? (
                <>
                    <div className={styles.panelHeader}>
                        <h3 className={styles.title}>Outline</h3>
                        <button className={styles.addButton} onClick={handleAddChapter} aria-label="Add Chapter">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>

                    {projectChapters.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>No outline yet</p>
                            <button className={styles.emptyStateButton} onClick={handleAddChapter}>
                                Create chapter
                            </button>
                        </div>
                    ) : (
                        <div className={styles.chapterList}>
                            {projectChapters.map(chapter => {
                                const isExpanded = activeDocumentId === chapter.id;
                                const chapterScenes = isExpanded ? activeChapterScenes : scenes.filter(s => s.documentId === chapter.id);

                                return (
                                    <React.Fragment key={chapter.id}>
                                        <div
                                            className={`${styles.chapterItem} ${isExpanded ? styles.active : ''}`}
                                            onClick={() => {
                                                if (!isExpanded) {
                                                    setActiveDocument(chapter.id);
                                                }
                                            }}
                                        >
                                            <div className={styles.chapterItemContent}>
                                                <div className={styles.chapterInfo}>
                                                    <div className={styles.chapterHeaderRow}>
                                                        <span className={styles.chevron}>
                                                            {isExpanded ? '▾' : '▸'}
                                                        </span>
                                                        {editingId === chapter.id && editType === 'chapter' ? (
                                                            <input
                                                                ref={editInputRef}
                                                                className={styles.renameInput}
                                                                value={editModeName}
                                                                onChange={(e) => setEditModeName(e.target.value)}
                                                                onBlur={handleCommitRename}
                                                                onKeyDown={handleKeyDown}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        ) : (
                                                            <span className={styles.chapterTitle}>{chapter.title}</span>
                                                        )}
                                                    </div>
                                                    {!isExpanded && (
                                                        <span className={styles.sceneCount}>{chapterScenes.length} {chapterScenes.length === 1 ? 'scene' : 'scenes'}</span>
                                                    )}
                                                </div>

                                                {(!editingId || editType !== 'chapter' || editingId !== chapter.id) && (
                                                    <button
                                                        className={styles.optionsButton}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === chapter.id ? null : chapter.id);
                                                        }}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="1"></circle>
                                                            <circle cx="19" cy="12" r="1"></circle>
                                                            <circle cx="5" cy="12" r="1"></circle>
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>

                                            {openMenuId === chapter.id && (
                                                <div className={styles.optionsMenu} ref={menuRef}>
                                                    <button
                                                        className={styles.menuItem}
                                                        onClick={(e) => handleStartRename(chapter.id, chapter.title, 'chapter', e)}
                                                    >
                                                        Rename
                                                    </button>
                                                    <button
                                                        className={`${styles.menuItem} ${styles.destructive}`}
                                                        disabled={projectChapters.length === 1}
                                                        onClick={(e) => handleDeleteChapter(chapter.id, e)}
                                                        title={projectChapters.length === 1 ? "Cannot delete the only chapter" : ""}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Expanded Scenes Rendering */}
                                        {isExpanded && (
                                            <div className={styles.sceneList}>
                                                {chapterScenes.map((scene) => {
                                                    const atmosphere = atmospheresEnabled ? getAtmosphere(scene.atmosphereId) : undefined;
                                                    const customBorder = atmosphere ? { borderLeftColor: isDark ? atmosphere.darkBackground : atmosphere.lightBackground } : {};

                                                    return (
                                                        <div
                                                            key={scene.id}
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, scene.id)}
                                                            onDragOver={(e) => handleDragOver(e, scene.id)}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={(e) => handleDrop(e, scene.id)}
                                                            onDragEnd={handleDragEnd}
                                                            className={`
                                                            ${styles.sceneItem} 
                                                            ${activeSceneId === scene.id ? styles.active : ''}
                                                            ${draggedSceneId === scene.id ? styles.dragging : ''}
                                                            ${dragOverSceneId === scene.id ? styles.dragOver : ''}
                                                        `}
                                                            style={customBorder}
                                                            onClick={() => setActiveScene(scene.id)}
                                                        >
                                                            <div className={styles.sceneInfo}>
                                                                {editingId === scene.id && editType === 'scene' ? (
                                                                    <input
                                                                        ref={editInputRef}
                                                                        className={styles.renameInput}
                                                                        value={editModeName}
                                                                        onChange={(e) => setEditModeName(e.target.value)}
                                                                        onBlur={handleCommitRename}
                                                                        onKeyDown={handleKeyDown}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                ) : (
                                                                    <span className={styles.sceneTitle}>
                                                                        {atmosphere && <span style={{ marginRight: '0.4rem', fontSize: '0.9rem' }}>{atmosphere.icon}</span>}
                                                                        {scene.title}
                                                                    </span>
                                                                )}
                                                                <span className={styles.wordCount}>{scene.wordCount || 0} words</span>
                                                            </div>

                                                            {(!editingId || editType !== 'scene' || editingId !== scene.id) && (
                                                                <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                                                    <button
                                                                        className={`${styles.optionsButton} ${!scene.atmosphereId ? styles.atmosphereAffordance : ''}`}
                                                                        style={{ fontSize: '0.9rem', padding: '0.1rem 0.2rem' }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (openPickerId === scene.id) {
                                                                                setOpenPickerId(null);
                                                                                setPickerPosition(null);
                                                                            } else {
                                                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                                                const pickerWidth = 280;
                                                                                const pickerHeight = 420;
                                                                                const spaceRight = window.innerWidth - rect.right;
                                                                                const spaceBelow = window.innerHeight - rect.bottom;

                                                                                let left = rect.right + 8;
                                                                                let top = rect.top;

                                                                                // Flip left if not enough space on right
                                                                                if (spaceRight < pickerWidth + 8) {
                                                                                    left = rect.left - pickerWidth - 8;
                                                                                }

                                                                                // Flip up if not enough space below
                                                                                if (spaceBelow < pickerHeight) {
                                                                                    top = Math.max(8, rect.bottom - pickerHeight);
                                                                                }

                                                                                // Clamp to viewport
                                                                                left = Math.max(8, Math.min(left, window.innerWidth - pickerWidth - 8));
                                                                                top = Math.max(8, Math.min(top, window.innerHeight - pickerHeight - 8));

                                                                                setOpenPickerId(scene.id);
                                                                                setPickerPosition({ top, left });
                                                                                setOpenMenuId(null);
                                                                            }
                                                                        }}
                                                                        title="Set Atmosphere"
                                                                    >
                                                                        🎨
                                                                    </button>
                                                                    <button
                                                                        className={styles.optionsButton}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenPickerId(null);
                                                                            setOpenMenuId(openMenuId === scene.id ? null : scene.id);
                                                                        }}
                                                                    >
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <circle cx="12" cy="12" r="1.5"></circle>
                                                                            <circle cx="19" cy="12" r="1.5"></circle>
                                                                            <circle cx="5" cy="12" r="1.5"></circle>
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {openMenuId === scene.id && (
                                                                <div className={styles.optionsMenu} ref={menuRef} onClick={e => e.stopPropagation()}>
                                                                    <button
                                                                        className={styles.menuItem}
                                                                        onClick={(e) => handleStartRename(scene.id, scene.title, 'scene', e)}
                                                                    >
                                                                        Rename
                                                                    </button>
                                                                    <button
                                                                        className={`${styles.menuItem} ${styles.destructive}`}
                                                                        disabled={activeChapterScenes.length === 1}
                                                                        onClick={(e) => handleDeleteScene(scene.id, e)}
                                                                        title={activeChapterScenes.length === 1 ? "Cannot delete the only scene. Delete chapter instead." : ""}
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {openPickerId === scene.id && pickerPosition && typeof document !== 'undefined' && createPortal(
                                                                <div
                                                                    ref={menuRef}
                                                                    style={{ position: 'fixed', top: pickerPosition.top, left: pickerPosition.left, zIndex: 9999 }}
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <AtmospherePicker
                                                                        sceneId={scene.id}
                                                                        currentAtmosphereId={scene.atmosphereId}
                                                                        onClose={() => { setOpenPickerId(null); setPickerPosition(null); }}
                                                                    />
                                                                </div>,
                                                                document.body
                                                            )}
                                                        </div>
                                                    )
                                                })}

                                                <button className={styles.addSceneBtn} onClick={() => handleAddScene(chapter.id)}>
                                                    + Add Scene
                                                </button>
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : null}

            <div style={{ flexShrink: 0, marginTop: 'auto' }}>
                {/* Panel footer — settings and theme toggle, pinned to bottom of nav */}
                <div className={styles.panelFooter}>
                    <button
                        className={styles.iconButton}
                        onClick={() => setShowSettings(true)}
                        title="Settings"
                    >
                        ⚙️
                    </button>
                    <button
                        className={styles.iconButton}
                        onClick={handleThemeToggle}
                        title={`Theme: ${theme}`}
                    >
                        {renderThemeIcon()}
                    </button>
                </div>
                <SpotifyPlayer />
            </div>

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    );
}
