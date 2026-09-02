"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './NewProjectModal.module.css'; // Reusing modal base styles
import { useWorkspaceStore, Project } from '@/store/workspaceStore';

interface ProjectSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
}

export function ProjectSettingsModal({ isOpen, onClose, projectId }: ProjectSettingsModalProps) {
    const project = useWorkspaceStore(s => s.projects.find(p => p.id === projectId));
    const worlds = useWorkspaceStore(s => s.worlds);
    const entities = useWorkspaceStore(s => s.entities);
    const updateProject = useWorkspaceStore(s => s.updateProject);

    const [name, setName] = useState('');
    const [authorName, setAuthorName] = useState('');
    const [description, setDescription] = useState('');
    const [worldId, setWorldId] = useState('');
    const [attributedEntityId, setAttributedEntityId] = useState('');
    const [coverImageUrl, setCoverImageUrl] = useState('');

    useEffect(() => {
        if (project && isOpen) {
            setName(project.name);
            setAuthorName(project.authorName || '');
            setDescription(project.description || '');
            setWorldId(project.worldId || '');
            setAttributedEntityId(project.attributedEntityId || '');
            setCoverImageUrl(project.coverImageUrl || '');
        }
    }, [project, isOpen]);

    if (!isOpen || !project) return null;

    const handleSave = () => {
        updateProject(projectId, {
            name,
            authorName,
            description,
            worldId: worldId || undefined,
            attributedEntityId: attributedEntityId || undefined,
            coverImageUrl
        });
        onClose();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setCoverImageUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // Filter characters from the selected world for attribution
    const worldCharacters = entities.filter(e => 
        // @ts-ignore
        e.worldId === worldId && 
        e.type === 'character'
    );

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Project Settings</h2>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.selectionGroup}>
                    <label className={styles.selectionLabel}>Project Title</label>
                    <input 
                        className={styles.titleInput}
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>

                <div className={styles.selectionGroup}>
                    <label className={styles.selectionLabel}>Author Name</label>
                    <input 
                        className={styles.titleInput}
                        placeholder="Pen name..."
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                    />
                </div>

                <div className={styles.selectionGroup}>
                    <label className={styles.selectionLabel}>Associated World Bible</label>
                    <select 
                        className={styles.worldSelect}
                        value={worldId}
                        onChange={e => {
                            setWorldId(e.target.value);
                            setAttributedEntityId(''); // Reset attribution when world changes
                        }}
                    >
                        <option value="">No Associated World</option>
                        {worlds.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>

                {worldId && (
                    <div className={styles.selectionGroup}>
                        <label className={styles.selectionLabel}>Fictional Character Attribution</label>
                        <select 
                            className={styles.worldSelect}
                            value={attributedEntityId}
                            onChange={e => setAttributedEntityId(e.target.value)}
                        >
                            <option value="">None</option>
                            {worldCharacters.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px' }}>
                            Linking to a character will show this book on their article page.
                        </p>
                    </div>
                )}

                <div className={styles.selectionGroup}>
                    <label className={styles.selectionLabel}>Project Description / Blurb</label>
                    <textarea 
                        className={styles.titleInput}
                        style={{ minHeight: '80px', resize: 'vertical' }}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                </div>

                <div className={styles.selectionGroup}>
                    <label className={styles.selectionLabel}>Cover Image</label>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div 
                          className={styles.coverPreview} 
                          style={{ 
                            background: project.coverColor, 
                            backgroundImage: coverImageUrl ? `url(${coverImageUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            margin: 0,
                            flexShrink: 0
                          }}
                        >
                            {!coverImageUrl && <span className={styles.coverInitials}>{name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input 
                              type="file" 
                              id="cover-upload" 
                              hidden 
                              accept="image/*" 
                              onChange={handleFileChange} 
                            />
                            <label 
                              htmlFor="cover-upload" 
                              className={styles.createBtn} 
                              style={{ 
                                textAlign: 'center', 
                                padding: '8px', 
                                fontSize: '0.85rem', 
                                display: 'inline-block',
                                cursor: 'pointer'
                              }}
                            >
                                📁 Upload Image
                            </label>
                            {coverImageUrl && (
                                <button 
                                  className={styles.closeBtn} 
                                  style={{ background: 'rgba(255,0,0,0.1)', color: '#ff4d4d', fontSize: '0.75rem' }}
                                  onClick={() => setCoverImageUrl('')}
                                >
                                    Remove Image
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <button className={styles.createBtn} onClick={handleSave}>
                    Save Changes
                </button>
            </div>
        </div>,
        document.body
    );
}
