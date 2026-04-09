"use client";
import React from 'react';
import { createPortal } from 'react-dom';
import styles from './NewProjectModal.module.css'; // Reusing modal base styles
import { useWorkspaceStore } from '@/store/workspaceStore';

interface ProjectLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProjectLibraryModal({ isOpen, onClose }: ProjectLibraryModalProps) {
    const projects = useWorkspaceStore(s => s.projects);
    const worlds = useWorkspaceStore(s => s.worlds);
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const setActiveProject = useWorkspaceStore(s => s.setActiveProject);
    const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
    const docs = useWorkspaceStore(s => s.documents);

    if (!isOpen) return null;

    const handleSelect = (id: string) => {
        setActiveProject(id);
        const pDocs = docs.filter(d => d.projectId === id).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        if (pDocs.length > 0) setActiveDocument(pDocs[0].id);
        onClose();
    };

    if (typeof document === 'undefined') return null;

    // Grouping Logic
    const groups: Record<string, typeof projects> = {};
    projects.forEach(p => {
        const world = worlds.find(w => w.id === p.worldId);
        const groupName = world ? world.name : 'Standalone Stories';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(p);
    });

    // Sorting Logic: Worlds alphabetical, projects within by mode then name
    const sortedGroups = Object.keys(groups).sort((a, b) => {
        if (a === 'Standalone Stories') return 1;
        if (b === 'Standalone Stories') return -1;
        return a.localeCompare(b);
    });

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} style={{ maxWidth: '800px', maxHeight: '85vh', width: '90%' }} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Your Library</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div 
                  className={styles.projectListContainer} 
                  style={{ 
                    overflowY: 'auto',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                  }}
                >
                    {sortedGroups.map(groupName => (
                        <div key={groupName} className={styles.worldSection}>
                            <h3 style={{ 
                                color: 'var(--accent)', 
                                fontSize: '0.75rem', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.1em',
                                marginBottom: '12px',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                paddingBottom: '4px'
                            }}>
                                {groupName}
                            </h3>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                                gap: '16px' 
                            }}>
                                {groups[groupName]
                                    .sort((a, b) => {
                                        if (a.writingMode !== b.writingMode) return a.writingMode.localeCompare(b.writingMode);
                                        return a.name.localeCompare(b.name);
                                    })
                                    .map(p => (
                                        <div 
                                          key={p.id} 
                                          className={`${styles.modeCard} ${p.id === activeProjectId ? styles.modeCardActive : ''}`}
                                          style={{ 
                                            alignItems: 'center', 
                                            textAlign: 'center', 
                                            padding: '16px',
                                            minHeight: '180px',
                                            justifyContent: 'center',
                                            margin: 0
                                          }}
                                          onClick={() => handleSelect(p.id)}
                                        >
                                            <div 
                                              className={styles.coverPreview} 
                                              style={{ 
                                                background: p.coverColor, 
                                                width: '100%', 
                                                height: '100px', 
                                                marginBottom: '12px',
                                                backgroundImage: p.coverImageUrl ? `url(${p.coverImageUrl})` : 'none',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                margin: '0 auto 12px auto'
                                              }}
                                            >
                                                {!p.coverImageUrl && <span className={styles.coverInitials}>{p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>}
                                            </div>
                                            <span className={styles.modeLabel} style={{ fontSize: '0.85rem', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                                            <span className={styles.modeDesc} style={{ fontSize: '0.6rem', opacity: 0.6 }}>{p.writingMode.toUpperCase()}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
