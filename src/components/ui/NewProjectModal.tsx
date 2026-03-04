import React, { useState, useEffect } from 'react';
import styles from './NewProjectModal.module.css';
import { useWorkspaceStore, COVER_COLORS } from '@/store/workspaceStore';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MODES = [
    { id: 'novel', icon: '📖', name: 'Novel', desc: 'Long-form fiction with chapters and scenes' },
    { id: 'screenplay', icon: '🎬', name: 'Screenplay', desc: 'Script format with elements and scenes' },
    { id: 'markdown', icon: '📝', name: 'Notes/Lore', desc: 'Research, worldbuilding, and reference' },
    { id: 'poetry', icon: '✍️', name: 'Poetry', desc: 'Verse, stanzas, and lyric writing' }
] as const;

export default function NewProjectModal({ isOpen, onClose }: NewProjectModalProps) {
    const [title, setTitle] = useState('');
    const [selectedMode, setSelectedMode] = useState<'novel' | 'screenplay' | 'markdown' | 'poetry'>('novel');

    const projects = useWorkspaceStore(state => state.projects);
    const addProject = useWorkspaceStore(state => state.addProject);
    const addDocument = useWorkspaceStore(state => state.addDocument);
    const addScene = useWorkspaceStore(state => state.addScene);
    const setActiveProject = useWorkspaceStore(state => state.setActiveProject);
    const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);
    const setActiveScene = useWorkspaceStore(state => state.setActiveScene);

    const coverColor = COVER_COLORS[projects.length % COVER_COLORS.length];

    const handleClose = () => {
        setTitle('');
        setSelectedMode('novel');
        onClose();
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleCreate = () => {
        if (!title.trim()) return;

        const newProjectId = crypto.randomUUID();
        const color = COVER_COLORS[projects.length % COVER_COLORS.length];

        addProject({
            id: newProjectId,
            name: title.trim(),
            writingMode: selectedMode,
            coverColor: color,
            createdAt: new Date()
        });

        const newDocId = crypto.randomUUID();
        addDocument({
            id: newDocId,
            projectId: newProjectId,
            title: 'Chapter 1',
            content: '',
            createdAt: new Date()
        });

        const newSceneId = crypto.randomUUID();
        addScene({
            id: newSceneId,
            documentId: newDocId,
            projectId: newProjectId,
            title: 'Scene 1',
            content: '',
            order: 0,
            createdAt: new Date()
        });

        setActiveProject(newProjectId);
        setActiveDocument(newDocId);
        setActiveScene(newSceneId);
        handleClose();
    };

    const initials = title.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.card} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>New Project</h2>
                    <button className={styles.closeBtn} onClick={handleClose} title="Close">&times;</button>
                </div>

                <div className={styles.content}>
                    <div className={styles.coverPreviewContainer}>
                        <div
                            className={styles.coverPreview}
                            style={{ background: coverColor }}
                        >
                            {initials || '?'}
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Project Title</label>
                        <input
                            type="text"
                            className={styles.input}
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="My Epic Masterpiece"
                            autoFocus
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Writing Mode</label>
                        <div className={styles.modeGrid}>
                            {MODES.map(mode => (
                                <div
                                    key={mode.id}
                                    className={`${styles.modeCard} ${selectedMode === mode.id ? styles.modeCardActive : ''}`}
                                    onClick={() => setSelectedMode(mode.id)}
                                >
                                    <div className={styles.modeHeader}>
                                        <span className={styles.modeIcon}>{mode.icon}</span>
                                        <span>{mode.name}</span>
                                    </div>
                                    <div className={styles.modeDesc}>{mode.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={handleClose}>Cancel</button>
                    <button
                        className={styles.createBtn}
                        onClick={handleCreate}
                        disabled={!title.trim()}
                    >
                        Create Project
                    </button>
                </div>
            </div>
        </div>
    );
}
