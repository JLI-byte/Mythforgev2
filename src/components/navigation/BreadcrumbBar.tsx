"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './BreadcrumbBar.module.css';

export function BreadcrumbBar() {
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const projects = useWorkspaceStore(state => state.projects);
    const documents = useWorkspaceStore(state => state.documents);

    const activeProject = projects.find(p => p.id === activeProjectId);
    const activeDocument = documents.find(d => d.id === activeDocumentId);

    if (!activeProject) {
        return null;
    }

    return (
        <div className={styles.breadcrumbBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={styles.crumbLabel}>
                    {activeProject.name}
                </span>
                <span className={styles.separator}>›</span>
                <span className={styles.crumbLabel}>
                    {activeDocument ? activeDocument.title || 'Untitled Chapter' : 'No Chapter Selected'}
                </span>
            </div>
        </div>
    );
}
