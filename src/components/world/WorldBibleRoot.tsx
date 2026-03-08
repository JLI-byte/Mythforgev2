/**
 * WorldBibleRoot — Root category view (People / Places / Things)
 *
 * Sprint 46A: Shows subcategory cards for a given root category.
 * For example, the "People" root shows Characters + Factions cards.
 */
"use client";

import React from 'react';
import styles from './WorldBibleRoot.module.css';
import { useWorkspaceStore, EntityType } from '@/store/workspaceStore';
import {
    WBView,
    RootCategory,
    ROOT_CATEGORY_TYPES,
    ROOT_CATEGORY_LABELS,
    SUBCATEGORY_LABELS,
    SUBCATEGORY_ICONS,
} from '@/lib/worldBibleNav';

interface WorldBibleRootProps {
    root: RootCategory;
    onNavigate: (view: WBView) => void;
}

export default function WorldBibleRoot({ root, onNavigate }: WorldBibleRootProps) {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const entities = useWorkspaceStore(state => state.entities);

    // Filter entities to current project
    const projectEntities = entities.filter(e => e.projectId === activeProjectId);

    // The EntityTypes belonging to this root category
    const subcategoryTypes = ROOT_CATEGORY_TYPES[root];

    return (
        <div className={styles.rootContainer}>
            {/* Section header */}
            <h3 className={styles.rootHeader}>{ROOT_CATEGORY_LABELS[root]}</h3>

            {/* Subcategory cards */}
            <div className={styles.subcategoryGrid}>
                {subcategoryTypes.map((entityType: EntityType) => {
                    const count = projectEntities.filter(e => e.type === entityType).length;
                    return (
                        <button
                            key={entityType}
                            className={styles.subcategoryCard}
                            onClick={() => onNavigate({ level: 'subcategory', root, entityType })}
                        >
                            <span className={styles.subcategoryIcon}>
                                {SUBCATEGORY_ICONS[entityType]}
                            </span>
                            <span className={styles.subcategoryLabel}>
                                {SUBCATEGORY_LABELS[entityType]}
                            </span>
                            <span className={styles.subcategoryCount}>
                                {count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'No entries yet'}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Custom subcategory button — future sprint */}
            <button
                className={styles.addCustomBtn}
                disabled
                title="Coming soon"
            >
                + Custom Category
            </button>
        </div>
    );
}
