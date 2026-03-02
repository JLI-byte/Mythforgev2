"use client";

import React from 'react';
import styles from './WorldBible.module.css';
import { useWorkspaceStore, Entity, ENTITY_TYPE_LABELS } from '@/store/workspaceStore';
import ConsistencyChecker from '../checker/ConsistencyChecker';

/**
 * World Bible
 * 
 * The primary interface for viewing and managing all world entities 
 * (characters, locations, timelines, etc.). 
 * Lives inside the writing, visually integrated into the workspace.
 */
export default function WorldBible() {
    const _hasHydrated = useWorkspaceStore((state) => state._hasHydrated);
    const activeProjectId = useWorkspaceStore((state) => state.activeProjectId);
    const entities = useWorkspaceStore((state) => state.entities);
    const setHoveredEntity = useWorkspaceStore((state) => state.setHoveredEntity);
    const setSelectedEntity = useWorkspaceStore((state) => state.setSelectedEntity);

    const projectEntities = entities.filter(e => e.projectId === activeProjectId);

    return (
        <aside className={styles.bibleContainer}>
            <header className={styles.bibleHeader}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <h2>World Bible &middot; {projectEntities.length} entries</h2>
                    <ConsistencyChecker />
                </div>
                {/* Controls: Search, Filter, Close will go here in future phases */}
            </header>

            <div className={styles.bibleContent}>
                {/* 
                   HYDRATION SHIELD:
                   Because Zustand persistence loads asynchronously from native localStorage, 
                   initial render loops assume an empty context. We intercept parsing until the 
                   middleware officially flips _hasHydrated to true ensuring we don't flash 
                   the wrong "Empty!" CTA erroneously to the user before memory catches up.
                */}
                {!_hasHydrated ? (
                    <p className={styles.emptyState}>Loading your world...</p>
                ) : projectEntities.length === 0 ? (
                    <p className={styles.emptyState}>No entries yet. Tag something in your writing to start building your world.</p>
                ) : (
                    <div className={styles.entityList}>
                        {projectEntities.map((entity: Entity) => (
                            <div
                                key={entity.id}
                                className={styles.entityCard}
                                onMouseEnter={() => setHoveredEntity(entity.id)}
                                onMouseLeave={() => setHoveredEntity(null)}
                                onClick={() => setSelectedEntity(entity.id)}
                            >
                                {/* 
                                   HoverPreview has been extracted to the global workspace boundary (`page.tsx`).
                                   It no longer renders inherently inside this loop to preserve component independence
                                   and allow proper z-indexing overlay when the Writing Editor triggers hover states.
                                */}
                                <div className={styles.cardHeader}>
                                    <h4>{entity.name}</h4>
                                    <div className={styles.cardHeaderRight}>
                                        <span className={styles.entityType}>
                                            {ENTITY_TYPE_LABELS[entity.type]}
                                        </span>
                                        <span className={styles.cardChevron}>›</span>
                                    </div>
                                </div>
                                {entity.description && (
                                    <p className={styles.cardDescription}>
                                        {entity.description.length > 80
                                            ? `${entity.description.substring(0, 80)}...`
                                            : entity.description}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
}
