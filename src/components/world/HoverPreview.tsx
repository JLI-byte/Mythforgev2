"use client";

import React from 'react';
import styles from './HoverPreview.module.css';
import { useWorkspaceStore, ENTITY_TYPE_LABELS } from '@/store/workspaceStore';

/**
 * Hover Preview
 * 
 * A semantic popout that renders entity details contextually adjacent to 
 * the element that triggered it (e.g., hovering an item in the World Bible).
 * Relies on the parent container positioning this component.
 */
export default function HoverPreview() {
    const hoveredEntityId = useWorkspaceStore((state) => state.hoveredEntityId);
    const entities = useWorkspaceStore((state) => state.entities);

    const hoveredEntity = entities.find(e => e.id === hoveredEntityId) ?? null;

    if (!hoveredEntity) {
        return null;
    }

    return (
        <div className={styles.previewCard}>
            <header className={styles.previewHeader}>
                <h4>{hoveredEntity.name}</h4>
                <span className={styles.entityTypeBadge}>
                    {ENTITY_TYPE_LABELS[hoveredEntity.type]}
                </span>
            </header>

            {/* The full description rendered visibly */}
            {hoveredEntity.description && (
                <p className={styles.previewDescription}>
                    {hoveredEntity.description}
                </p>
            )}
        </div>
    );
}
