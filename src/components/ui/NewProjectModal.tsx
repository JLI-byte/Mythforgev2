"use client";
import React, { useState, useEffect, useCallback } from 'react';
import styles from './NewProjectModal.module.css';
import { useWorkspaceStore, COVER_COLORS } from '@/store/workspaceStore';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type WritingMode = 'novel' | 'screenplay' | 'markdown' | 'poetry';

const MODES: { id: WritingMode; label: string; icon: string; desc: string }[] = [
    { id: 'novel', label: 'Novel', icon: '📖', desc: 'Long-form fiction with chapters and scenes' },
    { id: 'screenplay', label: 'Screenplay', icon: '🎬', desc: 'Script format with elements and scenes' },
    { id: 'markdown', label: 'Notes / Lore', icon: '📝', desc: 'Research, worldbuilding, and reference' },
    { id: 'poetry', label: 'Poetry', icon: '✍', desc: 'Verse, stanzas, and lyric writing' },
];

export function NewProjectModal({ isOpen, onClose }: NewProjectModalProps) {
    const projects = useWorkspaceStore(state => state.projects);
    const addProject = useWorkspaceStore(state => state.addProject);
    const addDocument = useWorkspaceStore(state => state.addDocument);
    const addScene = useWorkspaceStore(state => state.addScene);
    const setActiveProject = useWorkspaceStore(state => state.setActiveProject);
    const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);
    const setActiveScene = useWorkspaceStore(state => state.setActiveScene);

    const [title, setTitle] = useState('');
    const [selectedMode, setSelectedMode] = useState<WritingMode>('novel');

    const coverColor = COVER_COLORS[projects.length % COVER_COLORS.length];
    const initials = title.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

    const handleClose = useCallback(() => {
        setTitle('');
        setSelectedMode('novel');
        onClose();
    }, [onClose]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
        if (isOpen) document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, handleClose]);

    if (!isOpen) return null;

    const handleCreate = () => {
        if (!title.trim()) return;
        const newProjectId = crypto.randomUUID();
        const newDocId = crypto.randomUUID();
        const newSceneId = crypto.randomUUID();

        addProject({
            id: newProjectId,
            name: title.trim(),
            writingMode: selectedMode,
            coverColor,
            createdAt: new Date()
        });
        addDocument({ id: newDocId, projectId: newProjectId, title: 'Chapter 1', content: '', createdAt: new Date() });
        addScene({ id: newSceneId, documentId: newDocId, projectId: newProjectId, title: 'Scene 1', content: '', order: 0, createdAt: new Date() });
        setActiveProject(newProjectId);
        setActiveDocument(newDocId);
        setActiveScene(newSceneId);
        handleClose();
    };

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>New Project</h2>
                    <button className={styles.closeBtn} onClick={handleClose}>✕</button>
                </div>

                {/* Cover preview */}
                <div className={styles.coverPreview} style={{ background: coverColor }}>
                    <span className={styles.coverInitials}>{initials}</span>
                </div>

                {/* Title input */}
                <input
                    className={styles.titleInput}
                    type="text"
                    placeholder="Project title..."
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleCreate(); }}
                    autoFocus
                />

                {/* Mode selector */}
                <div className={styles.modeGrid}>
                    {MODES.map(mode => (
                        <button
                            key={mode.id}
                            className={`${styles.modeCard} ${selectedMode === mode.id ? styles.modeCardActive : ''}`}
                            onClick={() => setSelectedMode(mode.id)}
                        >
                            <span className={styles.modeIcon}>{mode.icon}</span>
                            <span className={styles.modeLabel}>{mode.label}</span>
                            <span className={styles.modeDesc}>{mode.desc}</span>
                        </button>
                    ))}
                </div>

                <button
                    className={styles.createBtn}
                    onClick={handleCreate}
                    disabled={!title.trim()}
                >
                    Create Project
                </button>
            </div>
        </div>
    );
}
