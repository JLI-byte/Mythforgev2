"use client";

import React, { useState } from 'react';
import { useWorkspaceStore, EntityType, WorldBibleRootConfig } from '@/store/workspaceStore';
import { getProjectLayout } from '@/lib/worldBibleNav';
import ArticleReadView from './ArticleReadView';
import styles from './WorldBibleCenter.module.css';

/**
 * WorldBibleCenter — Dedicated lore browser for the center column.
 * 
 * SPRINT 49 REDESIGN:
 * Navigation via three buckets (People, Places, Things) + custom category placeholder.
 */


export default function WorldBibleCenter() {
    const entities = useWorkspaceStore(state => state.entities);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const projects = useWorkspaceStore(state => state.projects);
    const activeProject = projects.find(p => p.id === activeProjectId);

    const layout = getProjectLayout(activeProject);

    const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
    const selectedBucket = layout.roots.find(r => r.id === selectedBucketId);
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
    if (selectedBucket) {
        const bucketEntities = projectEntities.filter(e => selectedBucket.entityTypes.includes(e.type));

        return (
            <div className={styles.browserContainer}>
                <div className={styles.browserInner}>
                    {/* Back button */}
                    <button className={styles.backBtn} onClick={() => setSelectedBucketId(null)}>
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
                                    <div 
                                        className={styles.cardColorBlock} 
                                        style={{ backgroundColor: (selectedBucket.id === 'people' ? '#4A6FA5' : selectedBucket.id === 'places' ? '#2E8B57' : selectedBucket.id === 'things' ? '#C0392B' : selectedBucket.id === 'world' ? '#6B4C9A' : '#333') }} 
                                    />
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
                    {layout.roots.map(root => {
                        const count = projectEntities.filter(e => root.entityTypes.includes(e.type)).length;
                        const heroEntity = projectEntities.find(e => root.entityTypes.includes(e.type) && e.imageUrl);
                        
                        // Derived metadata for rendering
                        const color = root.id === 'people' ? '#4A6FA5' : 
                                      root.id === 'places' ? '#2E8B57' : 
                                      root.id === 'things' ? '#C0392B' : 
                                      root.id === 'world' ? '#6B4C9A' : '#333';
                        
                        return (
                            <div
                                key={root.id}
                                className={styles.categoryCard}
                                style={{
                                    backgroundImage: heroEntity ? `url(${heroEntity.imageUrl})` : 'none',
                                    backgroundColor: color,
                                } as React.CSSProperties}
                                onClick={() => setSelectedBucketId(root.id)}
                            >
                                <div className={styles.categoryOverlay} />
                                <div className={styles.categoryContent}>
                                    <span className={styles.categoryIcon}>{root.icon}</span>
                                    <h3 className={styles.categoryLabel}>{root.label}</h3>
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
