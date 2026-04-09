/**
 * WorldBibleHome — Home view for the World Bible
 *
 * Sprint 46A redesign: 4-section layout (top to bottom):
 *   1. Search toolbar with entry count and sort button
 *   2. Horizontal favorites row with square image cards
 *   3. Three landscape category cards (People/Places/Things)
 *   4. "+ Add Entry" button
 */
"use client";

import React, { useState } from 'react';
import styles from './WorldBibleHome.module.css';
import { useWorkspaceStore, EntityType, WorldBibleRootConfig, WorldBibleLayout } from '@/store/workspaceStore';
import {
    WBView,
    getProjectLayout,
    DEFAULT_WORLD_BIBLE_LAYOUT,
    SUBCATEGORY_LABELS,
    SUBCATEGORY_ICONS,
} from '@/lib/worldBibleNav';

interface WorldBibleHomeProps {
    onNavigate: (view: WBView) => void;
}


/** Entity type icon mapping for favorite card fallback */
const ENTITY_TYPE_ICONS: Record<EntityType, string> = {
    character: '🧑',
    faction: '⚔️',
    location: '🗺️',
    artifact: '💎',
    lore: '📜',
    magic: '✨',
    religion: '🙏',
    species: '🧬',
};

export default function WorldBibleHome({ onNavigate }: WorldBibleHomeProps) {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const projects = useWorkspaceStore(state => state.projects);
    const updateProject = useWorkspaceStore(state => state.updateProject);
    const activeProject = projects.find(p => p.id === activeProjectId);

    const entities = useWorkspaceStore(state => state.entities);
    const openInlineCreator = useWorkspaceStore(state => state.openInlineCreator);

    const layout = getProjectLayout(activeProject);

    // Local search state
    const [searchTerm, setSearchTerm] = useState('');

    // Filter entities to current project
    const projectEntities = entities.filter(e => e.projectId === activeProjectId);

    // Apply search filter
    const filteredEntities = searchTerm.trim()
        ? projectEntities.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : projectEntities;

    // Favorites — entities pinned by the user
    const favorites = projectEntities.filter(e => e.isFavorite);

    /** Count entities of a specific type */
    const countForType = (type: EntityType): number => {
        return filteredEntities.filter(e => e.type === type).length;
    };

    return (
        <div className={styles.homeContainer}>

            {/* === Section 1: Top toolbar === */}
            <div className={styles.toolbar}>
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search entries..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <span className={styles.entryCount}>
                    {filteredEntities.length} {filteredEntities.length === 1 ? 'entry' : 'entries'}
                </span>
                {/* Sort button — UI only for now */}
                <button className={styles.sortBtn} title="Sort">⇅</button>
            </div>

            {/* === Section 2: Favorites row === */}
            <h4 className={styles.favoritesHeader}>⭐ Favorites</h4>
            <div className={styles.favoritesRow}>
                {favorites.length > 0 ? (
                    favorites.map(entity => (
                        <button
                            key={entity.id}
                            className={styles.favoriteCard}
                            onClick={() => onNavigate({ level: 'entry', entityId: entity.id })}
                            title={entity.name}
                        >
                            {/* Image area (top 60%) */}
                            <div
                                className={styles.favoriteImage}
                                style={entity.imageUrl
                                    ? {
                                        backgroundImage: `url(${entity.imageUrl})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }
                                    : { backgroundColor: '#333' }
                                }
                            >
                                {/* Show type icon if no image */}
                                {!entity.imageUrl && (
                                    <span className={styles.favoriteIcon}>
                                        {ENTITY_TYPE_ICONS[entity.type]}
                                    </span>
                                )}
                            </div>
                            {/* Name area (bottom 40%) */}
                            <div className={styles.favoriteName}>{entity.name}</div>
                        </button>
                    ))
                ) : (
                    /* Empty state placeholder card */
                    <div className={styles.favoritePlaceholder}>
                        <span className={styles.favoritePlaceholderIcon}>+</span>
                        <span className={styles.favoritePlaceholderText}>Star an entry</span>
                    </div>
                )}
            </div>

            {/* === Section 3: Category cards === */}
            <div className={styles.categoryStack}>
                {layout.roots.map(root => {
                    const count = root.entityTypes.reduce((sum, type) =>
                        sum + filteredEntities.filter(e => e.type === type).length, 0
                    );
                    return (
                        <button
                            key={root.id}
                            className={styles.categoryCard}
                            onClick={() => onNavigate({ level: 'root', root: root.id as any })}
                        >
                            <div className={styles.categoryIconWrap}>
                                <span className={styles.categoryIcon}>{root.icon}</span>
                            </div>
                            <div className={styles.categoryCenter}>
                                <span className={styles.categoryLabel}>{root.label}</span>
                                <span className={styles.categoryCount}>
                                    {count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'No entries yet'}
                                </span>
                                <div className={styles.subcategoryPills}>
                                    {root.entityTypes.map(type => (
                                        <span key={type} className={styles.subcategoryPill}>
                                            {SUBCATEGORY_ICONS[type]} {SUBCATEGORY_LABELS[type]} (
                                            {filteredEntities.filter(e => e.type === type).length})
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className={styles.categoryChevron}>›</div>
                        </button>
                    );
                })}
            </div>

            {/* === Section 4: Add Entry button === */}
            <button
                className={styles.addEntryBtn}
                onClick={() => openInlineCreator()}
            >
                + Add Entry
            </button>
        </div>
    );
}
