"use client";

import React, { useState } from 'react';
import { useWorkspaceStore, EntityType, WorldBibleRootConfig } from '@/store/workspaceStore';
import { getProjectLayout } from '@/lib/worldBibleNav';
import ArticleReadView from './ArticleReadView';
import CharacterProfile from './profile/CharacterProfile';
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
    const addWorldBibleRoot = useWorkspaceStore(state => state.addWorldBibleRoot);
    const setWorkspaceMode = useWorkspaceStore(state => state.setWorkspaceMode);
    const activeProject = projects.find(p => p.id === activeProjectId);

    // Creates a custom category and jumps to the hierarchy canvas to name/arrange it.
    const handleAddCategory = () => {
        addWorldBibleRoot({
            id: crypto.randomUUID(),
            label: 'New Category',
            icon: '📂',
            entityTypes: [],
            x: 120,
            y: 120,
        });
        setWorkspaceMode('hierarchy');
    };

    const layout = getProjectLayout(activeProject);

    const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

    // Filter entities for active project
    const projectEntities = entities.filter(e => e.projectId === activeProjectId);

    // Level 3 — Character profile for character entities, article view otherwise
    if (selectedEntityId) {
        const selected = projectEntities.find(e => e.id === selectedEntityId);
        if (selected?.type === 'character') {
            return (
                <div className={styles.browserContainer}>
                    <button className={styles.backBtn} onClick={() => setSelectedEntityId(null)}>
                        ← Back
                    </button>
                    <CharacterProfile entity={selected} />
                </div>
            );
        }
        return (
            <ArticleReadView
                entityId={selectedEntityId}
                onBack={() => setSelectedEntityId(null)}
            />
        );
    }

    // Level 1 + 2 — Expanding category strips (codepen.io/ettrics/pen/ZYqKGb).
    // Each category is a vertical strip; clicking expands it to reveal that
    // category's entities inline, with a close button to collapse.
    const stripColor = (id: string) =>
        id === 'people' ? '#2f5075'
        : id === 'places' ? '#2f6b4a'
        : id === 'things' ? '#8c3d33'
        : id === 'world' ? '#5b4483'
        : '#3a3a44';

    const stripCount = layout.roots.length + 1; // + Add Category
    const stripWidth = 100 / stripCount;

    return (
        <div className={styles.browserContainer}>
            <div className={styles.strips}>
                {layout.roots.map((root, i) => {
                    const bucketEntities = projectEntities.filter(e => root.entityTypes.includes(e.type));
                    const isExpanded = selectedBucketId === root.id;
                    const color = stripColor(root.id);
                    return (
                        <article
                            key={root.id}
                            className={`${styles.strip} ${isExpanded ? styles.stripExpanded : ''}`}
                            style={
                                isExpanded
                                    ? { left: 0, width: '100%', background: color }
                                    : { left: `${i * stripWidth}%`, width: `${stripWidth}%`, background: color }
                            }
                            onClick={isExpanded ? undefined : () => setSelectedBucketId(root.id)}
                        >
                            <div className={styles.stripContent}>
                                <div className={styles.stripTitle}>
                                    <span className={styles.stripIcon}>{root.icon}</span>
                                    <span className={styles.stripName}>{root.label}</span>
                                    <span className={styles.stripMeta}>
                                        {bucketEntities.length} {bucketEntities.length === 1 ? 'entry' : 'entries'}
                                    </span>
                                </div>

                                {isExpanded && (
                                    <div className={styles.stripInner}>
                                        <button
                                            className={styles.stripClose}
                                            onClick={(e) => { e.stopPropagation(); setSelectedBucketId(null); }}
                                            aria-label="Close category"
                                        >
                                            ×
                                        </button>
                                        <div className={styles.stripInnerHead}>
                                            <span className={styles.stripIcon}>{root.icon}</span>
                                            <h2 className={styles.levelTitle}>{root.label}</h2>
                                            <span className={styles.browserCount}>{bucketEntities.length} entries</span>
                                        </div>

                                        {bucketEntities.length === 0 ? (
                                            <p className={styles.stripEmpty}>
                                                No {root.label.toLowerCase()} yet — type [[ in the editor to create one.
                                            </p>
                                        ) : (
                                            <div className={styles.entityGrid}>
                                                {bucketEntities.map(entity => (
                                                    <div
                                                        key={entity.id}
                                                        className={styles.entityCard}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedEntityId(entity.id); }}
                                                    >
                                                        {entity.imageUrl ? (
                                                            <img src={entity.imageUrl} alt={entity.name} className={styles.cardThumb} />
                                                        ) : (
                                                            <div className={styles.cardColorBlock} style={{ backgroundColor: color }} />
                                                        )}
                                                        <div className={styles.cardContent}>
                                                            <span className={styles.cardName}>{entity.name}</span>
                                                            {(entity.articleDoc || (entity.articleBlocks && entity.articleBlocks.length > 0))
                                                                ? <span className={styles.articleBadge}>📄 Article</span>
                                                                : <span className={styles.noArticleBadge}>No article</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </article>
                    );
                })}

                {/* Add Category strip → opens the hierarchy canvas */}
                <article
                    className={styles.strip}
                    style={{ left: `${layout.roots.length * stripWidth}%`, width: `${stripWidth}%`, background: '#2c2c33' }}
                    role="button"
                    tabIndex={0}
                    onClick={handleAddCategory}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAddCategory(); }}
                >
                    <div className={styles.stripContent}>
                        <div className={styles.stripTitle}>
                            <span className={styles.stripIcon}>＋</span>
                            <span className={styles.stripName}>Add Category</span>
                        </div>
                    </div>
                </article>
            </div>
        </div>
    );
}
