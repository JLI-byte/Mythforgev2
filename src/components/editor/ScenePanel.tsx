"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './ScenePanel.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';

export function ScenePanel() {
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const scenes = useWorkspaceStore(state => state.scenes);
    const activeSceneId = useWorkspaceStore(state => state.activeSceneId);

    const addScene = useWorkspaceStore(state => state.addScene);
    const updateScene = useWorkspaceStore(state => state.updateScene);
    const deleteScene = useWorkspaceStore(state => state.deleteScene);
    const setActiveScene = useWorkspaceStore(state => state.setActiveScene);
    const reorderScenes = useWorkspaceStore(state => state.reorderScenes);

    const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
    const [editModeName, setEditModeName] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

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
        if (editingSceneId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingSceneId]);

    if (!activeDocumentId) return null;

    const documentScenes = scenes
        .filter(s => s.documentId === activeDocumentId)
        .sort((a, b) => a.order - b.order);

    const handleAddScene = () => {
        const activeProjectId = useWorkspaceStore.getState().activeProjectId;
        if (!activeProjectId) return;

        const newScene = {
            id: crypto.randomUUID(),
            documentId: activeDocumentId,
            projectId: activeProjectId,
            title: `Scene ${documentScenes.length + 1}`,
            content: '',
            order: documentScenes.length,
            createdAt: new Date()
        };
        addScene(newScene);
        setActiveScene(newScene.id);
    };

    const handleStartRename = (sceneId: string, currentTitle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        setEditingSceneId(sceneId);
        setEditModeName(currentTitle);
    };

    const handleCommitRename = (sceneId: string) => {
        if (editModeName.trim()) {
            updateScene(sceneId, { title: editModeName.trim() });
        }
        setEditingSceneId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, sceneId: string) => {
        if (e.key === 'Enter') handleCommitRename(sceneId);
        if (e.key === 'Escape') setEditingSceneId(null);
    };

    const handleDelete = (sceneId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMenuId(null);
        if (window.confirm('Delete this scene? This cannot be undone.')) {
            deleteScene(sceneId);
        }
    };

    // Drag and Drop Handlers
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id);
        e.dataTransfer.effectAllowed = 'move';
        // Safari needs this to be set to something
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        if (id !== draggedId) {
            setDragOverId(id);
        }
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        setDragOverId(null);

        if (!draggedId || draggedId === targetId) return;

        const updatedOrder = [...documentScenes];
        const draggedIndex = updatedOrder.findIndex(s => s.id === draggedId);
        const targetIndex = updatedOrder.findIndex(s => s.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const [draggedItem] = updatedOrder.splice(draggedIndex, 1);
        updatedOrder.splice(targetIndex, 0, draggedItem);

        const newOrderedIds = updatedOrder.map(s => s.id);
        reorderScenes(activeDocumentId, newOrderedIds);
        setDraggedId(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
        setDragOverId(null);
    };

    return (
        <div className={styles.scenePanel}>
            <div className={styles.panelHeader}>
                <h3 className={styles.title}>Scenes</h3>
                <button className={styles.addButton} onClick={handleAddScene} aria-label="Add Scene">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>

            {documentScenes.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No scenes yet</p>
                    <button className={styles.emptyStateButton} onClick={handleAddScene}>
                        Create first scene
                    </button>
                </div>
            ) : (
                <div className={styles.sceneList}>
                    {documentScenes.map(scene => (
                        <div
                            key={scene.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, scene.id)}
                            onDragOver={(e) => handleDragOver(e, scene.id)}
                            onDrop={(e) => handleDrop(e, scene.id)}
                            onDragEnd={handleDragEnd}
                            className={`
                                ${styles.sceneItem} 
                                ${activeSceneId === scene.id ? styles.active : ''}
                                ${draggedId === scene.id ? styles.dragging : ''}
                                ${dragOverId === scene.id ? styles.dragOver : ''}
                            `}
                            onClick={() => setActiveScene(scene.id)}
                        >
                            <div className={styles.sceneItemContent}>
                                <div className={styles.sceneInfo}>
                                    {editingSceneId === scene.id ? (
                                        <input
                                            ref={editInputRef}
                                            className={styles.renameInput}
                                            value={editModeName}
                                            onChange={(e) => setEditModeName(e.target.value)}
                                            onBlur={() => handleCommitRename(scene.id)}
                                            onKeyDown={(e) => handleKeyDown(e, scene.id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={styles.sceneTitle}>{scene.title}</span>
                                    )}
                                    <span className={styles.wordCount}>{scene.wordCount || 0} words</span>
                                </div>

                                {!editingSceneId && (
                                    <button
                                        className={styles.optionsButton}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuId(openMenuId === scene.id ? null : scene.id);
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

                            {openMenuId === scene.id && (
                                <div className={styles.optionsMenu} ref={menuRef}>
                                    <button
                                        className={styles.menuItem}
                                        onClick={(e) => handleStartRename(scene.id, scene.title, e)}
                                    >
                                        Rename
                                    </button>
                                    <button
                                        className={`${styles.menuItem} ${styles.destructive}`}
                                        disabled={documentScenes.length === 1}
                                        onClick={(e) => handleDelete(scene.id, e)}
                                        title={documentScenes.length === 1 ? "Cannot delete the only scene" : ""}
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
