"use client";

import React, { useEffect, useRef } from 'react';
import styles from './InlineEntryCreator.module.css';
import { useWorkspaceStore, Entity, EntityType, ENTITY_TYPE_LABELS } from '@/store/workspaceStore';
import { sanitizeLabel } from '@/lib/sanitize';

/**
 * Inline Entry Creator
 * 
 * A lightweight modal overlay designed to quickly capture a new world entity
 * triggered from the WritingEditor without breaking flow. 
 * Reads from global Zustand store to determine visibility and predefined names.
 */
export default function InlineEntryCreator() {
    // Subscribe to store state and actions
    const activeProjectId = useWorkspaceStore((state) => state.activeProjectId);
    const isInlineCreatorOpen = useWorkspaceStore((state) => state.isInlineCreatorOpen);
    const pendingEntityName = useWorkspaceStore((state) => state.pendingEntityName);
    const closeInlineCreator = useWorkspaceStore((state) => state.closeInlineCreator);
    const addEntity = useWorkspaceStore((state) => state.addEntity);

    // Refs for focus management
    const formRef = useRef<HTMLFormElement>(null);
    const initialInputRef = useRef<HTMLInputElement>(null);

    // Focus the input automatically when the modal opens
    useEffect(() => {
        if (isInlineCreatorOpen && initialInputRef.current) {
            initialInputRef.current.focus();
        }
    }, [isInlineCreatorOpen]);

    // Render nothing if the modal shouldn't be visible
    if (!isInlineCreatorOpen) {
        return null;
    }

    /**
     * Helper to close the modal and explicitly return focus to the editor
     * without creating a tight dependency between the two components.
     * We use a custom DOM event that WritingEditor listens for.
     */
    const closeAndReturnFocus = () => {
        closeInlineCreator();
        // Dispatch custom event right after state updates
        window.dispatchEvent(new CustomEvent('mythforge:returnFocusToEditor'));
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!formRef.current) return;
        const formData = new FormData(formRef.current);

        const rawName = formData.get('name') as string;
        const type = formData.get('type') as EntityType;
        const rawDescription = (formData.get('description') as string) || '';

        const name = sanitizeLabel(rawName);
        const description = sanitizeLabel(rawDescription);

        if (!name || !activeProjectId) return; // rudimentary validation & null guard

        const newEntity: Entity = {
            id: crypto.randomUUID(),
            projectId: activeProjectId,
            name,
            type,
            description,
            createdAt: new Date(),
        };

        // Save to global state and dismiss
        addEntity(newEntity);
        closeAndReturnFocus();
    };

    /**
     * Backdrop click handler.
     * We ensure the user actually clicked the overlay background, 
     * not a child element inside the modal.
     */
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            closeAndReturnFocus();
        }
    };

    return (
        <div className={styles.creatorOverlay} onClick={handleBackdropClick}>
            <div className={styles.creatorModal}>
                <div className={styles.modalHeader}>
                    <h3>New World Entry</h3>
                    <p className={styles.hintText}>Define a new entity to track in your Codex.</p>
                </div>

                <form ref={formRef} onSubmit={handleSubmit} className={styles.entityForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="entry-name">Name</label>
                        <input
                            ref={initialInputRef}
                            type="text"
                            id="entry-name"
                            name="name"
                            defaultValue={pendingEntityName || ''}
                            placeholder="e.g. Eldoria, The Crimson King"
                            required
                            autoComplete="off"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="entry-type">Category</label>
                        <select id="entry-type" name="type" required defaultValue="character">
                            {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="entry-description">Brief Description</label>
                        <textarea
                            id="entry-description"
                            name="description"
                            rows={3}
                            placeholder="What is this? Keep it brief, you can add detail later."
                        ></textarea>
                    </div>

                    <div className={styles.formActions}>
                        <button type="button" className={styles.btnCancel} onClick={closeAndReturnFocus}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.btnSave}>
                            Create & Return
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
