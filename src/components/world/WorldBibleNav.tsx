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
    ROOT_CATEGORY_LABELS,
    SUBCATEGORY_LABELS,
    RootCategory,
} from '@/lib/worldBibleNav';
import { exportWorldBible } from '@/lib/export';

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
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const projects = useWorkspaceStore(state => state.projects);

    const handleExportBible = () => {
        const activeProject = projects.find(p => p.id === activeProjectId);
        if (!activeProject) return;
        
        const projectEntities = entities.filter(e => e.projectId === activeProject.id);
        exportWorldBible(projectEntities, activeProject.name);
    };

    /** Build the breadcrumb text based on the current view */
    const renderBreadcrumb = () => {
        switch (currentView.level) {
            case 'home':
                return <span>World Bible</span>;

            case 'root':
                return (
                    <>
                        <span className={styles.crumbMuted}>World Bible</span>
                        <span className={styles.crumbSep}>›</span>
                        <span>{ROOT_CATEGORY_LABELS[currentView.root]}</span>
                    </>
                );

            case 'subcategory':
                return (
                    <>
                        <span className={styles.crumbMuted}>
                            {ROOT_CATEGORY_LABELS[currentView.root]}
                        </span>
                        <span className={styles.crumbSep}>›</span>
                        <span>{SUBCATEGORY_LABELS[currentView.entityType]}</span>
                    </>
                );

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
