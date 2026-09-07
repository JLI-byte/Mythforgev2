"use client";

import React, { useState, useEffect, useId } from 'react';
import { X } from 'lucide-react';
import styles from './EntityDetailPanel.module.css';
import { useWorkspaceStore, EntityType, ENTITY_TYPE_LABELS } from '@/store/workspaceStore';
import { formatDateTime } from '@/lib/formatDate';
import { useModalDialog } from '@/lib/useModalDialog';
import { announce } from '@/lib/liveAnnouncer';

/**
 * The panel itself, which assumes something is selected. Split out from the
 * exported component because `useModalDialog` runs on mount, and a hook cannot
 * sit below the `return null` that hides an unselected panel — otherwise the
 * trap would be holding the keyboard while nothing was on screen.
 */
function EntityDetailPanelBody({ entityId }: { entityId: string }) {
    const fieldId = useId();

    // Essential store hooks
    const setSelectedEntity = useWorkspaceStore(state => state.setSelectedEntity);
    const entities = useWorkspaceStore(state => state.entities);
    const updateEntity = useWorkspaceStore(state => state.updateEntity);
    const deleteEntity = useWorkspaceStore(state => state.deleteEntity);

    // Derive the active entity directly from the current store projection
    const selectedEntity = entities.find(e => e.id === entityId) ?? null;

    // Local form state representing the ongoing, unsaved edits
    const [name, setName] = useState('');
    const [type, setType] = useState<EntityType>('character');
    const [description, setDescription] = useState('');
    const [saved, setSaved] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const dialogRef = useModalDialog<HTMLElement>(() => setSelectedEntity(null));

    // Sync local form state when the selected entity changes natively.
    // We key off the entity id explicitly so that local form edits are not
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
    }, [entityId]);

    // Handle the visual persistence of the save feedback, reverting after 2s
    useEffect(() => {
        if (saved) {
            const timer = setTimeout(() => setSaved(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [saved]);

    // Abort out completely if the selected entity was unexpectedly missing from store
    // This could happen if it was deleted locally via another window or event
    if (!selectedEntity) {
        return (
            <div className={styles.panelBackdrop} onClick={() => setSelectedEntity(null)} role="presentation">
                <aside
                    ref={dialogRef}
                    className={styles.panelContainer}
                    onClick={e => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="entity-panel-title"
                    tabIndex={-1}
                >
                    <div className={styles.panelHeader}>
                        <h3 id="entity-panel-title">Entity Not Found</h3>
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
        announce(`Saved ${name.trim() || 'entry'}.`);
        setConfirmingDelete(false);
    };

    const handleDelete = () => {
        deleteEntity(selectedEntity.id);
        setSelectedEntity(null);
    };

    return (
        <div className={styles.panelBackdrop} onClick={() => setSelectedEntity(null)} role="presentation">
            <aside
                ref={dialogRef}
                className={styles.panelContainer}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="entity-panel-title"
                tabIndex={-1}
            >
                <header className={styles.panelHeader}>
                    <h3 id="entity-panel-title">Edit Entity</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className={styles.closeButton} onClick={() => setSelectedEntity(null)} aria-label="Close panel"><X size={18} /></button>
                    </div>
                </header>

                <div className={styles.panelBody}>
                    <div className={styles.formGroup}>
                        <label htmlFor={`${fieldId}-name`}>Name</label>
                        <input
                            id={`${fieldId}-name`}
                            data-autofocus
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

export function EntityDetailPanel() {
    const selectedEntityId = useWorkspaceStore(state => state.selectedEntityId);

    // If there is no active selection, short-circuit the render
    if (!selectedEntityId) return null;

    return <EntityDetailPanelBody entityId={selectedEntityId} />;
}
