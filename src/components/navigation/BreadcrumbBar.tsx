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

import React, { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './BreadcrumbBar.module.css';
import { ProjectSwitcher } from './ProjectSwitcher';
import { DocumentSwitcher } from './DocumentSwitcher';

export function BreadcrumbBar() {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const projects = useWorkspaceStore(state => state.projects);
    const documents = useWorkspaceStore(state => state.documents);

    const [showProjectSwitcher, setShowProjectSwitcher] = useState(false);
    const [showDocSwitcher, setShowDocSwitcher] = useState(false);

    const activeProject = projects.find(p => p.id === activeProjectId);
    const activeDocument = documents.find(d => d.id === activeDocumentId);

    // If no active project, the workspace acts as an empty state.
    // The bar itself can still render to provide a point of access, but safely omits breadcrumbs.
    if (!activeProject) {
        return null; // Or render an empty structural div if desired
    }

    return (
        <div className={styles.breadcrumbBar}>
            <button
                className={styles.crumbButton}
                onClick={() => setShowProjectSwitcher(true)}
                title="Switch Project"
            >
                {activeProject.name}
            </button>
            <span className={styles.separator}>›</span>
            <button
                className={styles.crumbButton}
                onClick={() => setShowDocSwitcher(true)}
                disabled={!activeDocument}
                title="Switch Document"
            >
                {activeDocument ? activeDocument.title || 'Untitled Document' : 'No Document Selected'}
            </button>

            {showProjectSwitcher && (
                <ProjectSwitcher onClose={() => setShowProjectSwitcher(false)} />
            )}

            {showDocSwitcher && (
                <DocumentSwitcher onClose={() => setShowDocSwitcher(false)} />
            )}
        </div>
    );
}
