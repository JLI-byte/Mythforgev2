"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './NavigationPanel.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';
import SettingsModal from '../ui/SettingsModal';
import { ProjectSwitcher } from '@/components/navigation/ProjectSwitcher';
import { NewProjectModal } from '../ui/NewProjectModal';
import { exportAsMarkdown, exportAsDocx, exportWorldBible } from '@/lib/export';
import { seedBetaData } from '@/lib/betaSeedData';

/**
 * NavigationPanel UI Component
 * 
 * Centralized unified navigation rendering a tree/accordion structure.
 * Chapters at root level; clicking expands them to reveal contained scenes.
 * Replaces older dual-panel (ChapterPanel/ScenePanel) layouts.
 */
export function NavigationPanel() {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const projects = useWorkspaceStore(state => state.projects);
    const documents = useWorkspaceStore(state => state.documents);
    const scenes = useWorkspaceStore(state => state.scenes);
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const activeSceneId = useWorkspaceStore(state => state.activeSceneId);
    const entities = useWorkspaceStore(state => state.entities);

    const setActiveProject = useWorkspaceStore(state => state.setActiveProject);

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
    const [showSettings, setShowSettings] = useState(false);
    const [showSwitcher, setShowSwitcher] = useState(false);
    const [showNewProject, setShowNewProject] = useState(false);

    const theme = useWorkspaceStore(state => state.theme);
    const setTheme = useWorkspaceStore(state => state.setTheme);
    const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Drag State for scenes
    const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
    const [dragOverSceneId, setDragOverSceneId] = useState<string | null>(null);

    // Expanded Chapters State
    // Default to expanding the active document's chapter on initial load
    const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set([activeDocumentId].filter(Boolean) as string[]));

    const toggleChapterExpanded = (chapterId: string) => {
        setExpandedChapters(prev => {
            const next = new Set(prev);
            if (next.has(chapterId)) {
                next.delete(chapterId);
            } else {
                next.add(chapterId);
            }
            return next;
        });
    };

    const editInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!openMenuId) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openMenuId]);

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

    const activeProject = projects.find(p => p.id === activeProjectId);

    // --- Actions ---
    const handleExportMarkdown = (chapterId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        const chapterDoc = documents.find(d => d.id === chapterId);
        if (!chapterDoc) return;
        const chapterScenes = scenes.filter(s => s.documentId === chapterId);
        exportAsMarkdown(chapterDoc, chapterScenes);
    };

    const handleExportDocx = (chapterId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        const chapterDoc = documents.find(d => d.id === chapterId);
        if (!chapterDoc) return;
        const chapterScenes = scenes.filter(s => s.documentId === chapterId);
        exportAsDocx(chapterDoc, chapterScenes);
    };

    const handleExportBible = () => {
        if (!activeProject) return;
        const projectEntities = entities.filter(e => e.projectId === activeProject.id);
        exportWorldBible(projectEntities, activeProject.name);
    };

    const handleSeed = () => {
        seedBetaData(useWorkspaceStore.getState());
    };

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

        // Auto-expand new chapter
        setExpandedChapters(prev => new Set([...prev, newDocId]));
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
            {/* Project header — book cover + title + navigation */}
            <div className={styles.projectHeader}>
                <span className={styles.projectTitle}>{activeProject?.name || 'No Project'}</span>
                
                <div className={styles.projectHeaderBody}>
                    {/* Book cover */}
                    <div
                        className={styles.projectCover}
                        style={{ background: activeProject?.coverColor || 'var(--surface)' }}
                    >
                        <span className={styles.projectCoverInitials}>
                            {activeProject?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                        </span>
                    </div>

                    <div className={styles.projectControls}>
                        <button className={styles.projectGridBtn} onClick={() => setShowSwitcher(true)} title="All projects">⊞</button>
                        <button className={styles.projectNewBtn} onClick={() => setShowNewProject(true)} title="New project">+</button>
                    </div>
                </div>
            </div>

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
                                const isActive = activeDocumentId === chapter.id;
                                const isExpanded = expandedChapters.has(chapter.id);
                                const chapterScenes = isActive ? activeChapterScenes : scenes.filter(s => s.documentId === chapter.id);

                                return (
                                    <React.Fragment key={chapter.id}>
                                        <div
                                            className={`${styles.chapterItem} ${isActive && !activeSceneId ? styles.active : ''}`}
                                            onClick={() => {
                                                if (!isActive) {
                                                    setActiveDocument(chapter.id);
                                                }
                                                setActiveScene(null);
                                            }}
                                            onDoubleClick={() => {
                                                if (!isActive) setActiveDocument(chapter.id);
                                                setActiveScene(null);
                                                toggleChapterExpanded(chapter.id);
                                            }}
                                        >
                                            <div className={styles.chapterItemContent}>
                                                <div className={styles.chapterInfo}>
                                                    <div className={styles.chapterHeaderRow}>
                                                        <span
                                                            className={styles.chevron}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleChapterExpanded(chapter.id);
                                                            }}
                                                        >
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
                                                        className={styles.menuItem}
                                                        onClick={(e) => handleExportMarkdown(chapter.id, e)}
                                                    >
                                                        Export as Markdown
                                                    </button>
                                                    <button
                                                        className={styles.menuItem}
                                                        onClick={(e) => handleExportDocx(chapter.id, e)}
                                                    >
                                                        Export as DOCX
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

                                        {isExpanded && (
                                            <div className={styles.sceneList}>
                                                {chapterScenes.map((scene) => {
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
                                                            onClick={() => {
                                                                if (!isActive) {
                                                                    setActiveDocument(scene.documentId);
                                                                }
                                                                setActiveScene(scene.id);
                                                            }}
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
                                                                        {scene.title}
                                                                    </span>
                                                                )}
                                                                <span className={styles.wordCount}>{scene.wordCount || 0} words</span>
                                                            </div>

                                                            {(!editingId || editType !== 'scene' || editingId !== scene.id) && (
                                                                <button
                                                                    className={styles.optionsButton}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenMenuId(openMenuId === scene.id ? null : scene.id);
                                                                    }}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <circle cx="12" cy="12" r="1.5"></circle>
                                                                        <circle cx="19" cy="12" r="1.5"></circle>
                                                                        <circle cx="5" cy="12" r="1.5"></circle>
                                                                    </svg>
                                                                </button>
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
                <div className={styles.panelFooter}>
                    <button
                        className={styles.homeButton}
                        onClick={() => setActiveProject(null)}
                        title="Back to worlds"
                    >
                        ⌂
                    </button>
                    <div className={styles.footerSpacer} />
                    
                    <button
                        className={styles.seedButton}
                        onClick={handleSeed}
                        title="Seed Beta Data"
                    >
                        ⚗
                    </button>


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
            </div>

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

            {showSwitcher && (
                <ProjectSwitcher onClose={() => setShowSwitcher(false)} />
            )}
            <NewProjectModal
                isOpen={showNewProject}
                onClose={() => setShowNewProject(false)}
            />
        </div>
    );
}
