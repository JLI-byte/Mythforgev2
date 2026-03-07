/**
 * Project Switcher — Visual Gallery Modal
 *
 * Sprint 45: Replaced the plain list modal with a visual project gallery.
 * Projects are grouped by writingMode type, each type has its own section
 * with a distinct card style. All sections appear in one scrollable modal.
 *
 * INVARIANTS:
 * - A project must always have a name.
 * - The last remaining project cannot be deleted.
 */
"use client";

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore, COVER_COLORS, Project } from '@/store/workspaceStore';
import { sanitizeLabel } from '@/lib/sanitize';
import styles from './ProjectSwitcher.module.css';

interface ProjectSwitcherProps {
    onClose: () => void;
}

/** Type section configuration — icon, label, and display order */
const TYPE_SECTIONS: { mode: Project['writingMode']; icon: string; label: string }[] = [
    { mode: 'novel', icon: '📖', label: 'Novels' },
    { mode: 'screenplay', icon: '🎬', label: 'Screenplays' },
    { mode: 'poetry', icon: '✍️', label: 'Poetry' },
    { mode: 'markdown', icon: '📝', label: 'Markdown' },
];

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
    // Writing mode selector for new project creation (default: novel)
    const [newProjectMode, setNewProjectMode] = useState<Project['writingMode']>('novel');

    // Card interaction states (same logic as before, adapted for card context)
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
            writingMode: newProjectMode,
            coverColor: COVER_COLORS[projects.length % COVER_COLORS.length],
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
        setIsCreating(false);
        setNewProjectName('');
        setNewProjectMode('novel');
        onClose();
    };

    /**
     * Renders a single project card. The visual style depends on the writingMode
     * of the project's type section.
     */
    const renderProjectCard = (project: Project, mode: Project['writingMode']) => {
        const docCount = documents.filter(d => d.projectId === project.id).length;
        const isActive = project.id === activeProjectId;
        const isEditing = project.id === editingProjectId;
        const isConfirmingDelete = project.id === confirmDeleteProjectId;

        // Card CSS class per type
        const cardClass = `${styles.card} ${styles[`card_${mode}`]} ${isActive ? styles.cardActive : ''}`;

        return (
            <div key={project.id} className={cardClass} style={mode === 'novel' ? { background: project.coverColor } : undefined}>
                {/* Active badge — checkmark in top-left */}
                {isActive && <span className={styles.activeBadge}>✓</span>}

                {/* ⋯ menu button — top-right, visible on hover */}
                <div className={styles.cardMenu}>
                    <button
                        className={styles.cardMenuTrigger}
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

                {/* Inline editing state */}
                {isEditing ? (
                    <div className={styles.cardEditOverlay} onClick={e => e.stopPropagation()}>
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
                                if (e.key === 'Escape') setEditingProjectId(null);
                            }}
                            className={styles.cardEditInput}
                        />
                    </div>
                ) : isConfirmingDelete ? (
                    <div className={styles.cardEditOverlay} onClick={e => e.stopPropagation()}>
                        <span className={styles.cardDeleteText}>Delete?</span>
                        <div className={styles.cardDeleteActions}>
                            <button onClick={() => setConfirmDeleteProjectId(null)} className={styles.cancelBtn}>No</button>
                            <button onClick={() => {
                                deleteProject(project.id);
                                setConfirmDeleteProjectId(null);
                            }} className={styles.dangerBtn}>Yes</button>
                        </div>
                    </div>
                ) : (
                    /* Normal card body — click to select */
                    <button className={styles.cardBody} onClick={() => handleSelectProject(project.id)}>
                        {/* Novel cards: book spine rendered via CSS pseudo-element */}
                        <span className={styles.cardTitle}>{project.name}</span>
                        {/* Type-specific decorative element at bottom */}
                        {mode === 'screenplay' && <span className={styles.cardDecor}>FADE IN:</span>}
                        {mode === 'poetry' && <span className={styles.cardDecor}>— ✦ —</span>}
                        {(mode === 'novel' || mode === 'markdown') && (
                            <span className={styles.cardDocCount}>{docCount} {docCount === 1 ? 'doc' : 'docs'}</span>
                        )}
                        {/* Markdown watermark # rendered via CSS */}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <header className={styles.header}>
                    <h3>Your Projects</h3>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
                </header>

                {/* Scrollable body — type sections stacked vertically */}
                <div className={styles.body}>
                    {TYPE_SECTIONS.map(({ mode, icon, label }) => {
                        const sectionProjects = projects.filter(p => p.writingMode === mode);
                        if (sectionProjects.length === 0) return null;

                        return (
                            <div key={mode} className={styles.typeSection}>
                                {/* Section header */}
                                <h4 className={styles.sectionHeader}>{icon} {label}</h4>
                                {/* Horizontal card grid */}
                                <div className={styles.cardGrid}>
                                    {sectionProjects.map(project => renderProjectCard(project, mode))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer — New Project button / form */}
                <div className={styles.footer}>
                    {!isCreating ? (
                        <button className={styles.createTrigger} onClick={() => setIsCreating(true)}>
                            + New Project
                        </button>
                    ) : (
                        <form onSubmit={handleCreateProject} className={styles.createForm}>
                            {/* Writing type selector — four buttons in a row */}
                            <div className={styles.typeSelector}>
                                {TYPE_SECTIONS.map(({ mode, icon, label }) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        className={`${styles.typeSelectorBtn} ${newProjectMode === mode ? styles.typeSelectorActive : ''}`}
                                        onClick={() => setNewProjectMode(mode)}
                                    >
                                        {icon} {label}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                autoFocus
                                value={newProjectName}
                                onChange={e => setNewProjectName(e.target.value)}
                                placeholder="Project name..."
                                className={styles.createInput}
                            />
                            <div className={styles.formActions}>
                                <button type="button" onClick={() => { setIsCreating(false); setNewProjectName(''); setNewProjectMode('novel'); }} className={styles.cancelBtn}>Cancel</button>
                                <button type="submit" className={styles.confirmBtn} disabled={!newProjectName.trim()}>Create</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
