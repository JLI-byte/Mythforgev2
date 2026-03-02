"use client";

import React, { useState } from 'react';
import styles from './ExportModal.module.css';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { exportAsMarkdown, exportAsDocx, exportWorldBible } from '@/lib/export';

/**
 * ExportModal UI Component
 * 
 * Centralized interface overlay providing users access to their creative output
 * via standard interoperable formats like Markdown and DOCX.
 */
interface ExportModalProps {
    onClose: () => void;
}

export default function ExportModal({ onClose }: ExportModalProps) {
    const documents = useWorkspaceStore(state => state.documents);
    const scenes = useWorkspaceStore(state => state.scenes);
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const projects = useWorkspaceStore(state => state.projects);
    const allEntities = useWorkspaceStore(state => state.entities);

    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    const activeDocument = documents.find(d => d.id === activeDocumentId);
    const documentScenes = scenes.filter(s => s.documentId === activeDocumentId);
    const activeProject = projects.find(p => p.id === activeProjectId);
    const projectEntities = allEntities.filter(e => e.projectId === activeProjectId);

    const handleDocumentMarkdown = () => {
        if (!activeDocument || !activeProject) return;
        setExportError(null);
        try {
            exportAsMarkdown(activeDocument, documentScenes);
        } catch (err: unknown) {
            setExportError(err instanceof Error ? err.message : 'Unknown error during Markdown export');
        }
    };

    const handleDocumentDocx = async () => {
        if (!activeDocument || !activeProject) return;
        setExportError(null);
        setIsExporting(true);
        try {
            await exportAsDocx(activeDocument, documentScenes);
        } catch (err: unknown) {
            setExportError(err instanceof Error ? err.message : 'Unknown error during Docx export');
        } finally {
            setIsExporting(false);
        }
    };

    const handleWorldBibleExport = () => {
        if (!activeProject) return;
        setExportError(null);
        try {
            exportWorldBible(projectEntities, activeProject.name);
        } catch (err: unknown) {
            setExportError(err instanceof Error ? err.message : 'Unknown error exporting World Bible');
        }
    };

    const hasEntities = projectEntities.length > 0;
    const uniqueTypesCount = new Set(projectEntities.map(e => e.type)).size;

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Export</h2>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close Export Modal">×</button>
                </div>

                <div className={styles.content}>
                    <section className={styles.section}>
                        <h3>Export Document</h3>
                        <p className={styles.subtext}>
                            Exports the current document: <strong>{activeDocument?.title || 'Untitled'}</strong>
                        </p>

                        <div className={styles.actionRow}>
                            <button
                                className={styles.exportBtn}
                                onClick={handleDocumentMarkdown}
                                disabled={!activeDocument || isExporting}
                            >
                                <span className={styles.icon}>↓</span>
                                Download Markdown (.md)
                            </button>

                            <button
                                className={styles.exportBtn}
                                onClick={handleDocumentDocx}
                                disabled={!activeDocument || isExporting}
                            >
                                {isExporting ? (
                                    <span className={styles.spinner}></span>
                                ) : (
                                    <>
                                        <span className={styles.icon}>↓</span>
                                        Download Word (.docx)
                                    </>
                                )}
                            </button>
                        </div>
                    </section>

                    <section className={styles.sectionDivider}>
                        <h3>Export World Bible</h3>

                        <div className={styles.actionRow}>
                            <div className={styles.fullWidthButtonWrapper} title={!hasEntities ? "Add entities to your World Bible first" : ""}>
                                <button
                                    className={`${styles.exportBtn} ${styles.fullWidthBtn}`}
                                    onClick={handleWorldBibleExport}
                                    disabled={!hasEntities || isExporting}
                                >
                                    <span className={styles.icon}>↓</span>
                                    Download World Bible (.md)
                                </button>
                            </div>
                        </div>
                        <p className={styles.subtext}>
                            {hasEntities
                                ? `${projectEntities.length} entities across ${uniqueTypesCount} types`
                                : 'No entities found. Add entries to the World Bible.'
                            }
                        </p>
                    </section>

                    {exportError && (
                        <div className={styles.errorBox}>
                            {exportError}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
