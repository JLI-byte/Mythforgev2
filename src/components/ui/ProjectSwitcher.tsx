"use client";
import React from 'react';
import styles from './ProjectSwitcher.module.css';
import { useWorkspaceStore, COVER_COLORS } from '@/store/workspaceStore';

interface ProjectSwitcherProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateNew: () => void;
}

export function ProjectSwitcher({ isOpen, onClose, onCreateNew }: ProjectSwitcherProps) {
    const projects = useWorkspaceStore(state => state.projects);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const setActiveProject = useWorkspaceStore(state => state.setActiveProject);
    const scenes = useWorkspaceStore(state => state.scenes);
    const documents = useWorkspaceStore(state => state.documents);

    if (!isOpen) return null;

    const getWordCount = (projectId: string) =>
        scenes.filter(s => s.projectId === projectId).reduce((acc, s) => acc + (s.wordCount || 0), 0);

    const getModeLabel = (mode?: string) => ({
        novel: '📖 Novel', screenplay: '🎬 Screenplay',
        markdown: '📝 Notes', poetry: '✍ Poetry'
    }[mode || 'novel'] || '📖 Novel');

    const handleSelect = (projectId: string) => {
        const projectDocs = documents.filter(d => d.projectId === projectId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        if (projectDocs.length > 0) {
            useWorkspaceStore.getState().setActiveDocument(projectDocs[0].id);
        }
        setActiveProject(projectId);
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Your Projects</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>
                <div className={styles.grid}>
                    {projects.map(project => (
                        <div
                            key={project.id}
                            className={`${styles.card} ${project.id === activeProjectId ? styles.activeCard : ''}`}
                            onClick={() => handleSelect(project.id)}
                        >
                            <div className={styles.cover} style={{ background: project.coverColor || COVER_COLORS[0] }}>
                                <span className={styles.initials}>
                                    {project.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                </span>
                            </div>
                            <div className={styles.cardMeta}>
                                <span className={styles.cardTitle}>{project.name}</span>
                                <span className={styles.cardMode}>{getModeLabel(project.writingMode)}</span>
                                <span className={styles.cardWords}>{getWordCount(project.id).toLocaleString()} words</span>
                            </div>
                        </div>
                    ))}
                    <div className={styles.newCard} onClick={onCreateNew}>
                        <span className={styles.newIcon}>+</span>
                        <span className={styles.newLabel}>New Project</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
