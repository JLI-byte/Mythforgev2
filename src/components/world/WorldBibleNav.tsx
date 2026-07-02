/**
 * WorldBibleNav — Back/Forward navigation bar with breadcrumb
 *
 * Sprint 46A: Sticky bar at the top of the World Bible panel.
 * Shows back/forward buttons, breadcrumb text, and home button.
 */
"use client";

import React from 'react';
import styles from './WorldBibleNav.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
    WBView,
    getWorldBibleConfig,
    SUBCATEGORY_LABELS,
} from '@/lib/worldBibleNav';
import { exportWorldBible } from '@/lib/export';
import { worldKeyForEntity, STANDALONE_KEY } from '@/lib/worldKey';

interface WorldBibleNavProps {
    currentView: WBView;
    canGoBack: boolean;
    canGoForward: boolean;
    onBack: () => void;
    onForward: () => void;
    onHome: () => void;
}

export default function WorldBibleNav({
    currentView,
    canGoBack,
    canGoForward,
    onBack,
    onForward,
    onHome,
}: WorldBibleNavProps) {
    const entities = useWorkspaceStore(state => state.entities);
    const worlds = useWorkspaceStore(state => state.worlds);
    const worldBibles = useWorkspaceStore(state => state.worldBibles);
    const activeWorldKey = useWorkspaceStore(state => state.activeWorldKey) ?? STANDALONE_KEY;

    const handleExportBible = () => {
        const worldEntities = entities.filter(e => worldKeyForEntity(e) === activeWorldKey);
        const world = worlds.find(w => w.id === activeWorldKey);
        const title = worldBibles[activeWorldKey]?.coverTitle ?? world?.name ?? 'Standalones';
        exportWorldBible(worldEntities, title);
    };

    const layout = getWorldBibleConfig(worldBibles, activeWorldKey).layout;

    /** Build the breadcrumb text based on the current view */
    const renderBreadcrumb = () => {
        switch (currentView.level) {
            case 'home':
                return <span>World Bible</span>;

            case 'root': {
                const rootLabel = layout.roots.find(r => r.id === currentView.root)?.label ?? 'Unknown';
                return (
                    <>
                        <span className={styles.crumbMuted}>World Bible</span>
                        <span className={styles.crumbSep}>›</span>
                        <span>{rootLabel}</span>
                    </>
                );
            }

            case 'subcategory': {
                const rootLabel = layout.roots.find(r => r.id === currentView.root)?.label ?? 'Unknown';
                return (
                    <>
                        <span className={styles.crumbMuted}>
                            {rootLabel}
                        </span>
                        <span className={styles.crumbSep}>›</span>
                        <span>{SUBCATEGORY_LABELS[currentView.entityType]}</span>
                    </>
                );
            }

            case 'entry': {
                // Derive entity name and type for breadcrumb display
                const entity = entities.find(e => e.id === currentView.entityId);
                const entityName = entity?.name ?? 'Unknown';
                const entityLabel = entity ? SUBCATEGORY_LABELS[entity.type] : '';
                return (
                    <>
                        <span className={styles.crumbMuted}>{entityLabel}</span>
                        <span className={styles.crumbSep}>›</span>
                        <span>{entityName}</span>
                    </>
                );
            }
        }
    };

    return (
        <nav className={styles.navBar}>
            {/* Back / Forward buttons */}
            <button
                className={styles.navBtn}
                onClick={onBack}
                disabled={!canGoBack}
                aria-label="Go back"
            >
                ←
            </button>
            <button
                className={styles.navBtn}
                onClick={onForward}
                disabled={!canGoForward}
                aria-label="Go forward"
            >
                →
            </button>

            {/* Breadcrumb text */}
            <div className={styles.breadcrumb}>
                {renderBreadcrumb()}
            </div>

            <div className={styles.actionGroup}>
                <button
                    className={styles.homeBtn}
                    onClick={handleExportBible}
                    aria-label="Export World Bible"
                    title="Export World Bible"
                >
                    📖
                </button>
                <button
                    className={styles.homeBtn}
                    onClick={onHome}
                    aria-label="Go to World Bible home"
                    title="Home"
                >
                    🏠
                </button>
            </div>
        </nav>
    );
}
