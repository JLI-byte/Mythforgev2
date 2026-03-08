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
import { useWorkspaceStore, EntityType } from '@/store/workspaceStore';
import {
    WBView,
    RootCategory,
    ROOT_CATEGORY_TYPES,
    ROOT_CATEGORY_LABELS,
    ROOT_CATEGORY_ICONS,
    SUBCATEGORY_LABELS,
    SUBCATEGORY_ICONS,
} from '@/lib/worldBibleNav';

interface WorldBibleHomeProps {
    onNavigate: (view: WBView) => void;
}

/** Root categories in display order */
const ROOT_CATEGORIES: RootCategory[] = ['people', 'places', 'things'];

/** Background colors for entity type icons in favorite cards (when no image) */
const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
    character: '#4A6FA5',
    faction: '#6B4C9A',
    location: '#2E8B57',
    artifact: '#C0392B',
    lore: '#D46A1A',
};

/** Background colors for category card left icons */
const CATEGORY_COLORS: Record<RootCategory, string> = {
    people: '#1a2a3a',
    places: '#1a2e1a',
    things: '#2a1a2a',
};

/** Entity type icon mapping for favorite card fallback */
const ENTITY_TYPE_ICONS: Record<EntityType, string> = {
    character: '🧑',
    faction: '⚔️',
    location: '🗺️',
    artifact: '💎',
    lore: '📜',
};

export default function WorldBibleHome({ onNavigate }: WorldBibleHomeProps) {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const entities = useWorkspaceStore(state => state.entities);
    const openInlineCreator = useWorkspaceStore(state => state.openInlineCreator);

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

    /** Count entities belonging to a given root category */
    const countForRoot = (root: RootCategory): number => {
        const types = ROOT_CATEGORY_TYPES[root];
        return filteredEntities.filter(e => types.includes(e.type)).length;
    };

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
                                    : { backgroundColor: ENTITY_TYPE_COLORS[entity.type] }
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
                {ROOT_CATEGORIES.map(root => {
                    const count = countForRoot(root);
                    const subcategoryTypes = ROOT_CATEGORY_TYPES[root];

                    return (
                        <button
                            key={root}
                            className={styles.categoryCard}
                            onClick={() => onNavigate({ level: 'root', root })}
                        >
                            {/* Left: large icon with colored background */}
                            <div
                                className={styles.categoryIconWrap}
                                style={{ backgroundColor: CATEGORY_COLORS[root] }}
                            >
                                <span className={styles.categoryIcon}>
                                    {ROOT_CATEGORY_ICONS[root]}
                                </span>
                            </div>

                            {/* Center: label + count + subcategory pills */}
                            <div className={styles.categoryCenter}>
                                <span className={styles.categoryLabel}>
                                    {ROOT_CATEGORY_LABELS[root]}
                                </span>
                                <span className={styles.categoryCount}>
                                    {count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'No entries yet'}
                                </span>
                                {/* Subcategory pills */}
                                <div className={styles.subcategoryPills}>
                                    {subcategoryTypes.map(type => (
                                        <span key={type} className={styles.subcategoryPill}>
                                            {SUBCATEGORY_ICONS[type]} {SUBCATEGORY_LABELS[type]} ({countForType(type)})
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Right: chevron */}
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
