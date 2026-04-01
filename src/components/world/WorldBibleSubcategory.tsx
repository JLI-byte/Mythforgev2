/**
 * WorldBibleSubcategory — Grid view of entities for a specific EntityType
 *
 * Sprint 46B: Portrait card grid showing all entities of a given type
 * within the active project. Each card has an image/icon area, name,
 * description preview, and a favorite toggle.
 */
"use client";

import React from 'react';
import styles from './WorldBibleSubcategory.module.css';
import { useWorkspaceStore, EntityType } from '@/store/workspaceStore';
import {
    WBView,
    RootCategory,
    SUBCATEGORY_LABELS,
    SUBCATEGORY_ICONS,
} from '@/lib/worldBibleNav';

interface WorldBibleSubcategoryProps {
    root: RootCategory;
    entityType: EntityType;
    onNavigate: (view: WBView) => void;
}

/** Background colors for entity type card image areas (when no image) */
const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
    character: '#4A6FA5',
    faction: '#6B4C9A',
    location: '#2E8B57',
    artifact: '#C0392B',
    lore: '#D46A1A',
    magic: '#9B59B6',
    religion: '#F1C40F',
    species: '#27AE60',
};

export default function WorldBibleSubcategory({
    root,
    entityType,
    onNavigate,
}: WorldBibleSubcategoryProps) {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const entities = useWorkspaceStore(state => state.entities);
    const toggleEntityFavorite = useWorkspaceStore(state => state.toggleEntityFavorite);
    const openInlineCreator = useWorkspaceStore(state => state.openInlineCreator);

    // Filter to entities of this type in the active project
    const typeEntities = entities.filter(
        e => e.projectId === activeProjectId && e.type === entityType
    );

    const label = SUBCATEGORY_LABELS[entityType];
    const icon = SUBCATEGORY_ICONS[entityType];

    return (
        <div className={styles.container}>
            {/* Header row */}
            <div className={styles.header}>
                <h3 className={styles.headerLabel}>{label}</h3>
                <button
                    className={styles.addBtn}
                    onClick={() => openInlineCreator()}
                >
                    + New Entry
                </button>
            </div>

            {typeEntities.length > 0 ? (
                /* Entry card grid */
                <div className={styles.cardGrid}>
                    {typeEntities.map(entity => (
                        <div
                            key={entity.id}
                            className={styles.entryCard}
                            onClick={() => onNavigate({ level: 'entry', entityId: entity.id })}
                        >
                            {/* Top: image area */}
                            <div
                                className={styles.cardImage}
                                style={entity.imageUrl
                                    ? {
                                        backgroundImage: `url(${entity.imageUrl})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }
                                    : { backgroundColor: ENTITY_TYPE_COLORS[entityType] }
                                }
                            >
                                {/* Type icon fallback when no image */}
                                {!entity.imageUrl && (
                                    <span className={styles.cardImageIcon}>{icon}</span>
                                )}

                                {/* Favorite toggle — top-right, visible on hover or when active */}
                                <button
                                    className={`${styles.favBtn} ${entity.isFavorite ? styles.favActive : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleEntityFavorite(entity.id);
                                    }}
                                    title={entity.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                    ⭐
                                </button>
                            </div>

                            {/* Bottom: info area */}
                            <div className={styles.cardInfo}>
                                <span className={styles.cardName}>{entity.name}</span>
                                {entity.description && (
                                    <span className={styles.cardDesc}>{entity.description}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Empty state */
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>{icon}</span>
                    <p className={styles.emptyText}>No {label.toLowerCase()} yet</p>
                    <button
                        className={styles.emptyAddBtn}
                        onClick={() => openInlineCreator()}
                    >
                        + Add one
                    </button>
                </div>
            )}
        </div>
    );
}
