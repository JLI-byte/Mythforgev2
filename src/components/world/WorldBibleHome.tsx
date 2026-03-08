/**
 * WorldBibleHome — Home view for the World Bible
 *
 * Sprint 46A: Shows a favorites strip at the top and three
 * root category cards (People, Places, Things) with entity counts.
 */
"use client";

import React from 'react';
import styles from './WorldBibleHome.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
    WBView,
    RootCategory,
    ROOT_CATEGORY_TYPES,
    ROOT_CATEGORY_LABELS,
    ROOT_CATEGORY_ICONS,
} from '@/lib/worldBibleNav';

interface WorldBibleHomeProps {
    onNavigate: (view: WBView) => void;
}

/** The three root categories displayed as cards */
const ROOT_CATEGORIES: RootCategory[] = ['people', 'places', 'things'];

export default function WorldBibleHome({ onNavigate }: WorldBibleHomeProps) {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const entities = useWorkspaceStore(state => state.entities);
    const openInlineCreator = useWorkspaceStore(state => state.openInlineCreator);

    // Filter entities to current project
    const projectEntities = entities.filter(e => e.projectId === activeProjectId);

    // Favorites — entities pinned by the user
    const favorites = projectEntities.filter(e => e.isFavorite);

    /** Count entities belonging to a given root category */
    const countForRoot = (root: RootCategory): number => {
        const types = ROOT_CATEGORY_TYPES[root];
        return projectEntities.filter(e => types.includes(e.type)).length;
    };

    return (
        <div className={styles.homeContainer}>
            {/* Favorites strip */}
            <section className={styles.favoritesSection}>
                <h4 className={styles.favoritesHeader}>⭐ Favorites</h4>
                {favorites.length > 0 ? (
                    <div className={styles.favoritesStrip}>
                        {favorites.map(entity => (
                            <button
                                key={entity.id}
                                className={styles.favoriteChip}
                                onClick={() => onNavigate({ level: 'entry', entityId: entity.id })}
                                title={entity.name}
                            >
                                {entity.name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className={styles.favoritesEmpty}>Star entries to pin them here</p>
                )}
            </section>

            {/* Root category cards */}
            <div className={styles.categoryGrid}>
                {ROOT_CATEGORIES.map(root => {
                    const count = countForRoot(root);
                    return (
                        <button
                            key={root}
                            className={styles.categoryCard}
                            onClick={() => onNavigate({ level: 'root', root })}
                        >
                            <span className={styles.categoryIcon}>
                                {ROOT_CATEGORY_ICONS[root]}
                            </span>
                            <span className={styles.categoryLabel}>
                                {ROOT_CATEGORY_LABELS[root]}
                            </span>
                            <span className={styles.categoryCount}>
                                {count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'No entries yet'}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Add entry button */}
            <button
                className={styles.addEntryBtn}
                onClick={() => openInlineCreator()}
            >
                + Add Entry
            </button>
        </div>
    );
}
