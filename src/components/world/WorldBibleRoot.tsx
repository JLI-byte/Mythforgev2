/**
 * WorldBibleRoot — Folder view (Sprint 72: folderized drill-down)
 *
 * Shows child-folder cards plus the direct article grid for the given
 * folder id. Recurses uniformly — there is no more type-bucketed
 * Subcategory level. Absorbs WorldBibleSubcategory's entry card grid.
 */
"use client";

import React from 'react';
import styles from './WorldBibleRoot.module.css';
import { useWorkspaceStore, EntityType } from '@/store/workspaceStore';
import { WBView, getWorldBibleConfig } from '@/lib/worldBibleNav';
import { worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';
import { folderMemberSet } from '@/lib/folderTree';

interface WorldBibleRootProps {
    root: string;
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

/** Fallback icon per entity type for card image areas without an image */
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

export default function WorldBibleRoot({ root, onNavigate }: WorldBibleRootProps) {
    const entities = useWorkspaceStore(state => state.entities);
    const worldBibles = useWorkspaceStore(state => state.worldBibles);
    const activeWorldKey = useWorkspaceStore(state => state.activeWorldKey) ?? STANDALONE_KEY;
    const addWorldBibleRoot = useWorkspaceStore(state => state.addWorldBibleRoot);
    const setWorkspaceMode = useWorkspaceStore(state => state.setWorkspaceMode);
    const toggleEntityFavorite = useWorkspaceStore(state => state.toggleEntityFavorite);
    const openInlineCreator = useWorkspaceStore(state => state.openInlineCreator);
    const layout = getWorldBibleConfig(worldBibles, activeWorldKey).layout;
    const category = layout.roots.find(r => r.id === root);

    // Filter entities to the active world (shelf)
    const worldEntities = entities.filter(e => worldKeyForEntity(e) === activeWorldKey);

    // Child folders nested directly under this folder
    const childFolders = layout.roots.filter(r => r.parentId === root);

    // Direct articles filed in this folder (deeper ones live under child folders)
    const directArticles = worldEntities.filter(e => e.categoryId === root);

    const hasContents = childFolders.length > 0 || directArticles.length > 0;

    return (
        <div className={styles.rootContainer}>
            {/* Section header */}
            <div className={styles.header}>
                <h3 className={styles.rootHeader}>{category?.label ?? 'Unknown Category'}</h3>
                <button
                    className={styles.addBtn}
                    onClick={() => openInlineCreator()}
                >
                    + New Entry
                </button>
            </div>

            {/* Child-folder cards */}
            {childFolders.length > 0 && (
                <div className={styles.subcategoryGrid}>
                    {childFolders.map(child => {
                        const memberIds = folderMemberSet(layout.roots, child.id);
                        const count = worldEntities.filter(e => e.categoryId && memberIds.has(e.categoryId)).length;
                        return (
                            <button
                                key={child.id}
                                className={styles.subcategoryCard}
                                onClick={() => onNavigate({ level: 'root', root: child.id })}
                            >
                                <span className={styles.subcategoryIcon}>
                                    {child.icon}
                                </span>
                                <span className={styles.subcategoryLabel}>
                                    {child.label}
                                </span>
                                <span className={styles.subcategoryCount}>
                                    {count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'No entries yet'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Direct article grid — absorbed from WorldBibleSubcategory */}
            {directArticles.length > 0 ? (
                <div className={styles.cardGrid}>
                    {directArticles.map(entity => (
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
                                    : { backgroundColor: ENTITY_TYPE_COLORS[entity.type] }
                                }
                            >
                                {/* Type icon fallback when no image */}
                                {!entity.imageUrl && (
                                    <span className={styles.cardImageIcon}>{ENTITY_TYPE_ICONS[entity.type]}</span>
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
            ) : !hasContents ? (
                /* Empty state */
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>{category?.icon ?? '📁'}</span>
                    <p className={styles.emptyText}>Nothing filed here yet</p>
                    <button
                        className={styles.emptyAddBtn}
                        onClick={() => openInlineCreator()}
                    >
                        + Add one
                    </button>
                </div>
            ) : null}

            {/* Creates a nested custom category and opens the hierarchy canvas to arrange it */}
            <button
                className={styles.addCustomBtn}
                title="Create a custom category (opens the hierarchy canvas)"
                onClick={() => {
                    addWorldBibleRoot({
                        id: crypto.randomUUID(),
                        label: 'New Category',
                        icon: '📂',
                        entityTypes: [],
                        parentId: root,
                    });
                    setWorkspaceMode('hierarchy');
                }}
            >
                + Custom Category
            </button>
        </div>
    );
}
