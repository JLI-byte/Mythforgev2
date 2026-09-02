"use client";

import React, { useState, useEffect, useId } from 'react';
import { MessageSquare, X } from 'lucide-react';
import styles from './EntityDetailPanel.module.css';
import { useWorkspaceStore, EntityType, ENTITY_TYPE_LABELS } from '@/store/workspaceStore';
import { articleDocToText } from '@/lib/worldAuthoring';
import { formatDateTime } from '@/lib/formatDate';

export function EntityDetailPanel() {
    const fieldId = useId();

    // Essential store hooks
    const selectedEntityId = useWorkspaceStore(state => state.selectedEntityId);
    const setSelectedEntity = useWorkspaceStore(state => state.setSelectedEntity);
    const entities = useWorkspaceStore(state => state.entities);
    const updateEntity = useWorkspaceStore(state => state.updateEntity);
    const deleteEntity = useWorkspaceStore(state => state.deleteEntity);
    const setChatAttachment = useWorkspaceStore(state => state.setChatAttachment);
    const setWorkspaceMode = useWorkspaceStore(state => state.setWorkspaceMode);

    // Derive the active entity directly from the current store projection
    const selectedEntity = entities.find(e => e.id === selectedEntityId) ?? null;

    // Local form state representing the ongoing, unsaved edits
    const [name, setName] = useState('');
    const [type, setType] = useState<EntityType>('character');
    const [description, setDescription] = useState('');
    const [saved, setSaved] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // Sync local form state when the selected entity changes natively.
    // We key off the selectedEntityId explicitly so that local form edits are not 
    // immediately wiped out by store state changes (e.g. from Typing or external sources)
    // while the panel is active on a single entity.
    useEffect(() => {
        if (selectedEntity) {
            setName(selectedEntity.name);
            setType(selectedEntity.type);
            setDescription(selectedEntity.description);
            setSaved(false); // Reset feedback on entity switch
            setConfirmingDelete(false); // Reset confirmation state
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEntityId]);

    // Keyboard accessibility: Allow `Escape` to close the panel
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedEntity(null);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [setSelectedEntity]);

    // Handle the visual persistence of the save feedback, reverting after 2s
    useEffect(() => {
        if (saved) {
            const timer = setTimeout(() => setSaved(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [saved]);

    // EARLY RETURNS MUST COME AFTER ALL HOOKS
    // If there is no active selection, short-circuit the render 
    if (!selectedEntityId) return null;

    // Abort out completely if the selected entity was unexpectedly missing from store
    // This could happen if it was deleted locally via another window or event
    if (!selectedEntity) {
        return (
            <div className={styles.panelBackdrop} onClick={() => setSelectedEntity(null)}>
                <aside className={styles.panelContainer} onClick={e => e.stopPropagation()}>
                    <div className={styles.panelHeader}>
                        <h3>Entity Not Found</h3>
                        <button className={styles.closeButton} onClick={() => setSelectedEntity(null)} aria-label="Close panel"><X size={18} /></button>
                    </div>
                </aside>
            </div>
        );
    }

    const handleSave = () => {
        updateEntity(selectedEntity.id, {
            name: name.trim(),
            type,
            description: description.trim()
        });
        setSaved(true);
        setConfirmingDelete(false);
    };

    const handleDelete = () => {
        deleteEntity(selectedEntity.id);
        setSelectedEntity(null);
    };

    // Attach this article to the research chat and jump there, so the user can
    // ask the assistant about it without describing it.
    const handleAskAbout = () => {
        const body = articleDocToText(selectedEntity.articleDoc);
        const content = [
            `${selectedEntity.name} (${ENTITY_TYPE_LABELS[selectedEntity.type]})`,
            selectedEntity.description?.trim(),
            body,
        ].filter(Boolean).join('\n\n');
        setChatAttachment({ kind: 'entity', entityId: selectedEntity.id, label: selectedEntity.name, content });
        setSelectedEntity(null);
        setWorkspaceMode('research');
    };

    return (
        <div className={styles.panelBackdrop} onClick={() => setSelectedEntity(null)}>
            <aside className={styles.panelContainer} onClick={e => e.stopPropagation()}>
                <header className={styles.panelHeader}>
                    <h3>Edit Entity</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={handleAskAbout}
                            title="Ask the research assistant about this article"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '5px 11px', fontSize: '0.74rem', fontWeight: 600,
                                color: 'var(--accent, #6c8cff)', background: 'transparent',
                                border: '1px solid var(--accent, #6c8cff)', borderRadius: 999, cursor: 'pointer',
                            }}
                        >
                            <MessageSquare size={14} /> Ask about this
                        </button>
                        <button className={styles.closeButton} onClick={() => setSelectedEntity(null)} aria-label="Close panel"><X size={18} /></button>
                    </div>
                </header>

                <div className={styles.panelBody}>
                    <div className={styles.formGroup}>
                        <label htmlFor={`${fieldId}-name`}>Name</label>
                        <input
                            id={`${fieldId}-name`}
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Entity Name"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor={`${fieldId}-category`}>Category</label>
                        <select
                            id={`${fieldId}-category`}
                            value={type}
                            onChange={e => setType(e.target.value as EntityType)}
                            className={styles.select}
                        >
                            {Object.entries(ENTITY_TYPE_LABELS).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor={`${fieldId}-description`}>Description</label>
                        <textarea
                            id={`${fieldId}-description`}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={8}
                            placeholder="Entity Description"
                            className={styles.textarea}
                        />
                    </div>

                    <div className={styles.metadataFields}>
                        <p><strong>Created:</strong> {formatDateTime(selectedEntity.createdAt)}</p>
                        {selectedEntity.updatedAt && (
                            <p><strong>Last Updated:</strong> {formatDateTime(selectedEntity.updatedAt)}</p>
                        )}
                        <p className={styles.idLabel}><strong>ID:</strong> {selectedEntity.id}</p>
                    </div>
                </div>

                <footer className={styles.panelFooter}>
                    {!confirmingDelete ? (
                        <>
                            <button
                                className={styles.deleteButton}
                                onClick={() => setConfirmingDelete(true)}
                                aria-label="Delete entity"
                            >
                                Delete
                            </button>
                            <button
                                className={styles.saveButton}
                                onClick={handleSave}
                                style={saved ? { backgroundColor: '#22c55e' } : {}}
                            >
                                {saved ? '✓ Saved' : 'Save Changes'}
                            </button>
                        </>
                    ) : (
                        <div className={styles.confirmDeleteContainer}>
                            <span className={styles.confirmDeleteText}>Are you sure?</span>
                            <div className={styles.confirmDeleteActions}>
                                <button className={styles.cancelDeleteButton} onClick={() => setConfirmingDelete(false)}>Cancel</button>
                                <button className={styles.confirmDeleteButton} onClick={handleDelete}>Confirm Delete</button>
                            </div>
                        </div>
                    )}
                </footer>
            </aside>
        </div>
    );
}
