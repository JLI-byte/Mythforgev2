"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './NavigationPanel.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';

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

    // Drag State for scenes
    const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
    const [dragOverSceneId, setDragOverSceneId] = useState<string | null>(null);

    const editInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };

        if (openMenuId) {
            document.addEventListener('mousedown', handleClickOutside);
        }
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

    if (!activeProjectId) return null;

    const projectChapters = documents
        .filter(d => d.projectId === activeProjectId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const activeChapterScenes = scenes
        .filter(s => s.documentId === activeDocumentId)
        .sort((a, b) => a.order - b.order);

    // --- Actions ---
    const handleAddChapter = () => {
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
            documentId: newDoc.id,
            projectId: activeProjectId,
            title: 'Scene 1',
            content: '',
            order: 0,
            createdAt: new Date()
        };

        addDocument(newDoc);
        addScene(newScene);
        setActiveDocument(newDoc.id); // Also auto-selects the first scene
    };

    const handleAddScene = () => {
        if (!activeDocumentId) return;
        const newSceneId = crypto.randomUUID();
        const newScene = {
            id: newSceneId,
            documentId: activeDocumentId,
            projectId: activeProjectId,
            title: `Scene ${activeChapterScenes.length + 1}`,
            content: '',
            order: activeChapterScenes.length,
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

    return (
        <div className={styles.navigationPanel}>
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
                                        {chapterScenes.map((scene) => (
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
                                                        <span className={styles.sceneTitle}>{scene.title}</span>
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
                                        ))}

                                        <button className={styles.addSceneBtn} onClick={handleAddScene}>
                                            + Add Scene
                                        </button>
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
