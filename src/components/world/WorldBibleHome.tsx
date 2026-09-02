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
    getWorldBibleConfig,
    DEFAULT_WORLD_BIBLE_LAYOUT,
} from '@/lib/worldBibleNav';
import { worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';
import { folderMemberSet } from '@/lib/folderTree';

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
    const worldBibles = useWorkspaceStore(state => state.worldBibles);
    const activeWorldKey = useWorkspaceStore(state => state.activeWorldKey) ?? STANDALONE_KEY;

    const entities = useWorkspaceStore(state => state.entities);
    const openInlineCreator = useWorkspaceStore(state => state.openInlineCreator);

    const layout = getWorldBibleConfig(worldBibles, activeWorldKey).layout;

    // Local search state
    const [searchTerm, setSearchTerm] = useState('');

    // Filter entities to the active world (shelf)
    const worldEntities = entities.filter(e => worldKeyForEntity(e) === activeWorldKey);

    // Apply search filter
    const filteredEntities = searchTerm.trim()
        ? worldEntities.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : worldEntities;

    // Favorites — entities pinned by the user
    const favorites = worldEntities.filter(e => e.isFavorite);

    // Unfiled = no categoryId, or a categoryId that doesn't resolve to a real folder
    const validIds = new Set(layout.roots.map(r => r.id));
    const unfiledCount = filteredEntities.filter(e => !e.categoryId || !validIds.has(e.categoryId)).length;

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
                {layout.roots.filter(root => !root.parentId).map(root => {
                    const memberIds = folderMemberSet(layout.roots, root.id);
                    const count = filteredEntities.filter(e => e.categoryId && memberIds.has(e.categoryId)).length;
                    return (
                        <button
                            key={root.id}
                            className={styles.categoryCard}
                            onClick={() => onNavigate({ level: 'root', root: root.id })}
                        >
                            <div className={styles.categoryIconWrap}>
                                <span className={styles.categoryIcon}>{root.icon}</span>
                            </div>
                            <div className={styles.categoryCenter}>
                                <span className={styles.categoryLabel}>{root.label}</span>
                                <span className={styles.categoryCount}>
                                    {count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'Empty — open to add'}
                                </span>
                                <div className={styles.subcategoryPills}>
                                    {layout.roots.filter(r => r.parentId === root.id).map(child => {
                                        const childMembers = folderMemberSet(layout.roots, child.id);
                                        const childCount = filteredEntities.filter(e => e.categoryId && childMembers.has(e.categoryId)).length;
                                        return (
                                            <span key={child.id} className={styles.subcategoryPill}>
                                                {child.icon} {child.label} ({childCount})
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className={styles.categoryChevron}>›</div>
                        </button>
                    );
                })}
                {unfiledCount > 0 && (
                    <div
                        className={`${styles.categoryCard} ${styles.categoryCardStatic}`}
                        title="File these from the Organize view"
                    >
                        <div className={styles.categoryIconWrap}>
                            <span className={styles.categoryIcon}>🗂️</span>
                        </div>
                        <div className={styles.categoryCenter}>
                            <span className={styles.categoryLabel}>Unfiled</span>
                            <span className={styles.categoryCount}>
                                {unfiledCount} {unfiledCount === 1 ? 'entry' : 'entries'}
                            </span>
                        </div>
                    </div>
                )}
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
