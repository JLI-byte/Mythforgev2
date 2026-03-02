/**
 * Breadcrumb Bar
 * 
 * Provides a highly integrated navigation context above the active writing surface.
 * Displays the current project and document, and serves as the trigger point for
 * the ProjectSwitcher and DocumentSwitcher modals.
 * 
 * INVARIANTS:
 * - Visually disappears if no active project exists (empty state workspace).
 * - Maintains minimal visual footprint to protect the writing flow.
 */
"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './BreadcrumbBar.module.css';


export function BreadcrumbBar() {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const projects = useWorkspaceStore(state => state.projects);
    const documents = useWorkspaceStore(state => state.documents);

    const activeProject = projects.find(p => p.id === activeProjectId);
    const activeDocument = documents.find(d => d.id === activeDocumentId);

    // If no active project, the workspace acts as an empty state.
    // The bar itself can still render to provide a point of access, but safely omits breadcrumbs.
    if (!activeProject) {
        return null; // Or render an empty structural div if desired
    }

    return (
        <div className={styles.breadcrumbBar}>
            <span className={styles.crumbLabel}>
                {activeProject.name}
            </span>
            <span className={styles.separator}>›</span>
            <span className={styles.crumbLabel}>
                {activeDocument ? activeDocument.title || 'Untitled Chapter' : 'No Chapter Selected'}
            </span>
        </div>
    );
}
