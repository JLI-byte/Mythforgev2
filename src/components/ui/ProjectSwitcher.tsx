import React, { useEffect } from 'react';
import styles from './ProjectSwitcher.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface ProjectSwitcherProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateNew: () => void;
}

const MODE_LABELS: Record<string, string> = {
    'novel': '📖 Novel',
    'screenplay': '🎬 Screenplay',
    'markdown': '📝 Markdown',
    'poetry': '✍ Poetry'
};

export default function ProjectSwitcher({ isOpen, onClose, onCreateNew }: ProjectSwitcherProps) {
    const projects = useWorkspaceStore(state => state.projects);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const setActiveProject = useWorkspaceStore(state => state.setActiveProject);
    const scenes = useWorkspaceStore(state => state.scenes);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getWordCount = (projectId: string) => {
        return scenes
            .filter(s => s.projectId === projectId)
            .reduce((acc, s) => acc + (s.wordCount || 0), 0);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.card} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Your Projects</h2>
                    <button className={styles.closeBtn} onClick={onClose} title="Close">&times;</button>
                </div>

                <div className={styles.grid}>
                    {projects.map(project => (
                        <div
                            key={project.id}
                            className={`${styles.projectCard} ${project.id === activeProjectId ? styles.projectCardActive : ''}`}
                            onClick={() => {
                                setActiveProject(project.id);
                                onClose();
                            }}
                        >
                            <div
                                className={styles.cover}
                                style={{ background: project.coverColor || 'var(--surface)' }}
                            >
                                {project.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                            </div>
                            <div className={styles.projectTitle} title={project.name}>{project.name}</div>
                            <div className={styles.badge}>{MODE_LABELS[project.writingMode] || '📖 Novel'}</div>
                            <div className={styles.wordCount}>{getWordCount(project.id).toLocaleString()} words</div>
                        </div>
                    ))}

                    <div className={styles.newCard} onClick={onCreateNew}>
                        <div className={styles.newIcon}>+</div>
                        <div>New Project</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
