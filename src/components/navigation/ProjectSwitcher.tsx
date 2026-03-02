/**
 * Project Switcher Modal
 * 
 * Provides a context-aware way to jump between high-level writing projects.
 * Extracted as its own component to isolate modal logic, search (future), and 
 * creation state away from the thin BreadcrumbBar.
 * 
 * INVARIANTS:
 * - A project must always have a name.
 * - The last remaining project cannot be deleted.
 */
"use client";

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { sanitizeLabel } from '@/lib/sanitize';
import styles from './ProjectSwitcher.module.css';

interface ProjectSwitcherProps {
    onClose: () => void;
}

export function ProjectSwitcher({ onClose }: ProjectSwitcherProps) {
    const projects = useWorkspaceStore(state => state.projects);
    const documents = useWorkspaceStore(state => state.documents);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const setActiveProject = useWorkspaceStore(state => state.setActiveProject);
    const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);
    const addProject = useWorkspaceStore(state => state.addProject);
    const addDocument = useWorkspaceStore(state => state.addDocument);
    const updateProject = useWorkspaceStore(state => state.updateProject);
    const deleteProject = useWorkspaceStore(state => state.deleteProject);

    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Row interaction states
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editProjectName, setEditProjectName] = useState('');
    const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Escape listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSelectProject = (projectId: string) => {
        setActiveProject(projectId);

        // Auto-select the first document in the newly activated project
        const firstDoc = documents.find(d => d.projectId === projectId);
        if (firstDoc) {
            setActiveDocument(firstDoc.id);
        } else {
            setActiveDocument(null);
        }

        onClose();
    };

    const handleCreateProject = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = sanitizeLabel(newProjectName);
        if (!trimmed) return;

        const newProjectId = crypto.randomUUID();
        const newDocId = crypto.randomUUID();

        addProject({
            id: newProjectId,
            name: trimmed,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        addDocument({
            id: newDocId,
            projectId: newProjectId,
            title: 'Untitled Document',
            content: '',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        setActiveProject(newProjectId);
        setActiveDocument(newDocId);
        onClose();
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <header className={styles.header}>
                    <h3>Switch Project</h3>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
                </header>

                <div className={styles.list}>
                    {projects.map(project => {
                        const docCount = documents.filter(d => d.projectId === project.id).length;
                        const isActive = project.id === activeProjectId;
                        const isEditing = project.id === editingProjectId;
                        const isConfirmingDelete = project.id === confirmDeleteProjectId;

                        return (
                            <div key={project.id} className={`${styles.projectRow} ${isActive ? styles.active : ''}`}>
                                {isEditing ? (
                                    <div className={styles.inlineEditState}>
                                        <input
                                            type="text"
                                            autoFocus
                                            value={editProjectName}
                                            onChange={e => setEditProjectName(e.target.value)}
                                            onBlur={() => {
                                                const trimmed = sanitizeLabel(editProjectName);
                                                if (trimmed) updateProject(project.id, { name: trimmed });
                                                setEditingProjectId(null);
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    const trimmed = sanitizeLabel(editProjectName);
                                                    if (trimmed) updateProject(project.id, { name: trimmed });
                                                    setEditingProjectId(null);
                                                }
                                                if (e.key === 'Escape') {
                                                    setEditingProjectId(null);
                                                }
                                            }}
                                            className={styles.inlineInput}
                                        />
                                    </div>
                                ) : isConfirmingDelete ? (
                                    <div className={styles.inlineConfirmState}>
                                        <span className={styles.confirmText}>Delete {project.name} and all its docs?</span>
                                        <div className={styles.formActions}>
                                            <button onClick={() => setConfirmDeleteProjectId(null)} className={styles.cancelBtn}>Cancel</button>
                                            <button onClick={() => {
                                                deleteProject(project.id);
                                                setConfirmDeleteProjectId(null);
                                            }} className={styles.dangerBtn}>Delete</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            className={styles.projectMainBtn}
                                            onClick={() => handleSelectProject(project.id)}
                                        >
                                            <span className={styles.projectName}>{project.name}</span>
                                            <span className={styles.docCount}>
                                                {docCount} {docCount === 1 ? 'doc' : 'docs'}
                                            </span>
                                        </button>

                                        <div className={styles.optionsContainer}>
                                            <button
                                                className={styles.optionsTrigger}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuId(openMenuId === project.id ? null : project.id);
                                                }}
                                            >
                                                ⋯
                                            </button>

                                            {openMenuId === project.id && (
                                                <div className={styles.optionsMenu}>
                                                    <button onClick={() => {
                                                        setEditingProjectId(project.id);
                                                        setEditProjectName(project.name);
                                                        setOpenMenuId(null);
                                                    }}>Rename</button>

                                                    <button
                                                        onClick={() => {
                                                            setConfirmDeleteProjectId(project.id);
                                                            setOpenMenuId(null);
                                                        }}
                                                        disabled={projects.length <= 1}
                                                        title={projects.length <= 1 ? "Cannot delete your only project" : ""}
                                                        className={styles.menuDanger}
                                                    >Delete</button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className={styles.footer}>
                    {!isCreating ? (
                        <button className={styles.createTrigger} onClick={() => setIsCreating(true)}>
                            + New Project
                        </button>
                    ) : (
                        <form onSubmit={handleCreateProject} className={styles.createForm}>
                            <input
                                type="text"
                                autoFocus
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                placeholder="Project name..."
                                className={styles.createInput}
                            />
                            <div className={styles.formActions}>
                                <button type="button" onClick={() => setIsCreating(false)} className={styles.cancelBtn}>Cancel</button>
                                <button type="submit" className={styles.confirmBtn} disabled={!newProjectName.trim()}>Create</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
