"use client";

import React, { useState } from 'react';
import { useWorkspaceStore, EntityType } from '@/store/workspaceStore';
import ArticleReadView from './ArticleReadView';
import styles from './WorldBibleCenter.module.css';

/**
 * WorldBibleCenter — Dedicated lore browser for the center column.
 * 
 * SPRINT 49 REDESIGN:
 * Navigation via three buckets (People, Places, Things) + custom category placeholder.
 */

type CategoryBucket = {
    id: string;
    label: string;
    icon: string;
    color: string;
    description: string;
    types: EntityType[]; // which entity types belong to this bucket
};

const BUCKETS: CategoryBucket[] = [
    {
        id: 'people',
        label: 'People',
        icon: '👤',
        color: '#4A6FA5',
        description: 'Characters, factions, and species',
        types: ['character', 'faction', 'species'],
    },
    {
        id: 'places',
        label: 'Places',
        icon: '🗺️',
        color: '#2E8B57',
        description: 'Locations, realms, cities, and regions',
        types: ['location'],
    },
    {
        id: 'things',
        label: 'Things',
        icon: '📦',
        color: '#C0392B',
        description: 'Artifacts, lore, and historical events',
        types: ['artifact', 'lore'],
    },
    {
        id: 'world',
        label: 'World Systems',
        icon: '🌍',
        color: '#6B4C9A',
        description: 'Magic systems, religions, and deities',
        types: ['magic', 'religion'],
    },
];

export default function WorldBibleCenter() {
    const entities = useWorkspaceStore(state => state.entities);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);

    const [selectedBucket, setSelectedBucket] = useState<CategoryBucket | null>(null);
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

    // Filter entities for active project
    const projectEntities = entities.filter(e => e.projectId === activeProjectId);

    // Level 3 — Article View (highest priority)
    if (selectedEntityId) {
        return (
            <ArticleReadView
                entityId={selectedEntityId}
                onBack={() => setSelectedEntityId(null)}
            />
        );
    }

    // Level 2 — Entity Grid (when a bucket is selected)
    if (selectedBucket !== null) {
        const bucketEntities = projectEntities.filter(e => selectedBucket.types.includes(e.type));

        return (
            <div className={styles.browserContainer}>
                <div className={styles.browserInner}>
                    {/* Back button */}
                    <button className={styles.backBtn} onClick={() => setSelectedBucket(null)}>
                        ← All Categories
                    </button>

                    {/* Section header */}
                    <div className={styles.levelHeader}>
                        <span className={styles.levelIcon}>{selectedBucket.icon}</span>
                        <h2 className={styles.levelTitle}>{selectedBucket.label}</h2>
                        <span className={styles.browserCount}>{bucketEntities.length} entries</span>
                    </div>

                    {/* Empty state for this bucket */}
                    {bucketEntities.length === 0 && (
                        <div className={styles.emptyState}>
                            <p className={styles.emptyText}>No {selectedBucket.label.toLowerCase()} yet</p>
                            <p className={styles.emptyHint}>Type [[ in the editor to create one</p>
                        </div>
                    )}

                    {/* Entity grid */}
                    <div className={styles.entityGrid}>
                        {bucketEntities.map(entity => (
                            <div 
                                key={entity.id} 
                                className={styles.entityCard} 
                                onClick={() => setSelectedEntityId(entity.id)}
                            >
                                {entity.imageUrl ? (
                                    <img src={entity.imageUrl} alt={entity.name} className={styles.cardThumb} />
                                ) : (
                                    <div className={styles.cardColorBlock} style={{ backgroundColor: selectedBucket.color }} />
                                )}
                                <div className={styles.cardContent}>
                                    <span className={styles.cardName}>{entity.name}</span>
                                    {(entity.articleDoc || (entity.articleBlocks && entity.articleBlocks.length > 0))
                                        ? <span className={styles.articleBadge}>📄 Article</span>
                                        : <span className={styles.noArticleBadge}>No article</span>
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Level 1 — Category Landing (default)
    return (
        <div className={styles.browserContainer}>
            <div className={styles.browserInner}>
                {/* Header */}
                <div className={styles.browserHeader}>
                    <h2 className={styles.browserTitle}>World Bible</h2>
                    <span className={styles.browserCount}>{projectEntities.length} entries</span>
                    <span className={styles.browserHint}>Click an entity to open its article</span>
                </div>

                {/* Category grid */}
                <div className={styles.categoryGrid}>
                    {/* Three default buckets */}
                    {BUCKETS.map(bucket => {
                        const count = projectEntities.filter(e => bucket.types.includes(e.type)).length;
                        const heroEntity = projectEntities.find(e => bucket.types.includes(e.type) && e.imageUrl);
                        return (
                            <div
                                key={bucket.id}
                                className={styles.categoryCard}
                                style={{
                                    backgroundImage: heroEntity ? `url(${heroEntity.imageUrl})` : 'none',
                                    backgroundColor: bucket.color,
                                } as React.CSSProperties}
                                onClick={() => setSelectedBucket(bucket)}
                            >
                                <div className={styles.categoryOverlay} />
                                <div className={styles.categoryContent}>
                                    <span className={styles.categoryIcon}>{bucket.icon}</span>
                                    <h3 className={styles.categoryLabel}>{bucket.label}</h3>
                                    <p className={styles.categoryDescription}>{bucket.description}</p>
                                    <span className={styles.categoryCount}>
                                        {count} {count === 1 ? 'entry' : 'entries'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {/* Static "Add Category" card — non-functional placeholder, Sprint 50 */}
                    <div className={styles.addCategoryCard}>
                        <span className={styles.addCategoryIcon}>＋</span>
                        <span className={styles.addCategoryLabel}>Add Category</span>
                        <span className={styles.addCategoryHint}>Coming soon</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
