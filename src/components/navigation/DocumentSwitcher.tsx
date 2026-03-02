/**
 * Document Switcher Modal
 * 
 * Provides a context-aware way to jump between documents in the active project.
 * Extracted as its own component to isolate modal logic and creation state.
 * 
 * INVARIANTS:
 * - A document must always have a title.
 * - The last remaining document in a project cannot be deleted.
 * - Deleting the active document auto-switches to another.
 */
"use client";

import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { sanitizeLabel } from '@/lib/sanitize';
import styles from './DocumentSwitcher.module.css';

interface DocumentSwitcherProps {
    onClose: () => void;
}

export function DocumentSwitcher({ onClose }: DocumentSwitcherProps) {
    const documents = useWorkspaceStore(state => state.documents);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const setActiveDocument = useWorkspaceStore(state => state.setActiveDocument);
    const addDocument = useWorkspaceStore(state => state.addDocument);
    const updateDocument = useWorkspaceStore(state => state.updateDocument);
    const deleteDocument = useWorkspaceStore(state => state.deleteDocument);

    const [newDocTitle, setNewDocTitle] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Row interaction states
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [editDocTitle, setEditDocTitle] = useState('');
    const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const projectDocs = documents.filter(d => d.projectId === activeProjectId);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSelectDoc = (docId: string) => {
        setActiveDocument(docId);
        onClose();
    };

    const handleDeleteDoc = (docId: string) => {
        if (docId === activeDocumentId) {
            const nextDoc = projectDocs.find(d => d.id !== docId);
            setActiveDocument(nextDoc ? nextDoc.id : null);
        }
        deleteDocument(docId);
        setConfirmDeleteDocId(null);
    };

    const handleCreateDoc = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = sanitizeLabel(newDocTitle);
        if (!trimmed || !activeProjectId) return;

        const newDocId = crypto.randomUUID();

        addDocument({
            id: newDocId,
            projectId: activeProjectId,
            title: trimmed,
            content: '',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        setActiveDocument(newDocId);
        onClose();
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <header className={styles.header}>
                    <h3>Switch Document</h3>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
                </header>

                <div className={styles.list}>
                    {projectDocs.length === 0 ? (
                        <div className={styles.emptyState}>No documents in this project</div>
                    ) : (
                        projectDocs.map(doc => {
                            const isActive = doc.id === activeDocumentId;
                            const isEditing = doc.id === editingDocId;
                            const isConfirmingDelete = doc.id === confirmDeleteDocId;

                            return (
                                <div key={doc.id} className={`${styles.docRow} ${isActive ? styles.active : ''}`}>
                                    {isEditing ? (
                                        <div className={styles.inlineEditState}>
                                            <input
                                                type="text"
                                                autoFocus
                                                value={editDocTitle}
                                                onChange={e => setEditDocTitle(e.target.value)}
                                                onBlur={() => {
                                                    const trimmed = sanitizeLabel(editDocTitle);
                                                    if (trimmed) updateDocument(doc.id, { title: trimmed });
                                                    setEditingDocId(null);
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        const trimmed = sanitizeLabel(editDocTitle);
                                                        if (trimmed) updateDocument(doc.id, { title: trimmed });
                                                        setEditingDocId(null);
                                                    }
                                                    if (e.key === 'Escape') setEditingDocId(null);
                                                }}
                                                className={styles.inlineInput}
                                            />
                                        </div>
                                    ) : isConfirmingDelete ? (
                                        <div className={styles.inlineConfirmState}>
                                            <span className={styles.confirmText}>Delete document?</span>
                                            <div className={styles.formActions}>
                                                <button onClick={() => setConfirmDeleteDocId(null)} className={styles.cancelBtn}>Cancel</button>
                                                <button onClick={() => handleDeleteDoc(doc.id)} className={styles.dangerBtn}>Delete</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                className={styles.docMainBtn}
                                                onClick={() => handleSelectDoc(doc.id)}
                                            >
                                                <span className={styles.docTitle}>{doc.title || 'Untitled'}</span>
                                            </button>

                                            <div className={styles.optionsContainer}>
                                                <button
                                                    className={styles.optionsTrigger}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === doc.id ? null : doc.id);
                                                    }}
                                                >
                                                    ⋯
                                                </button>

                                                {openMenuId === doc.id && (
                                                    <div className={styles.optionsMenu}>
                                                        <button onClick={() => {
                                                            setEditingDocId(doc.id);
                                                            setEditDocTitle(doc.title);
                                                            setOpenMenuId(null);
                                                        }}>Rename</button>

                                                        <button
                                                            onClick={() => {
                                                                setConfirmDeleteDocId(doc.id);
                                                                setOpenMenuId(null);
                                                            }}
                                                            disabled={projectDocs.length <= 1}
                                                            title={projectDocs.length <= 1 ? "Cannot delete your only document" : ""}
                                                            className={styles.menuDanger}
                                                        >Delete</button>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className={styles.footer}>
                    {!isCreating ? (
                        <button className={styles.createTrigger} onClick={() => setIsCreating(true)}>
                            + New Document
                        </button>
                    ) : (
                        <form onSubmit={handleCreateDoc} className={styles.createForm}>
                            <input
                                type="text"
                                autoFocus
                                value={newDocTitle}
                                onChange={e => setNewDocTitle(e.target.value)}
                                placeholder="Document title..."
                                className={styles.createInput}
                            />
                            <div className={styles.formActions}>
                                <button type="button" onClick={() => setIsCreating(false)} className={styles.cancelBtn}>Cancel</button>
                                <button type="submit" className={styles.confirmBtn} disabled={!newDocTitle.trim()}>Create</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
