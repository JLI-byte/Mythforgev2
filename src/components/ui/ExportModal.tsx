"use client";

import React, { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import styles from './ExportModal.module.css';
import {
    useWorkspaceStore,
    selectProjectWorldKey,
} from '@/store/workspaceStore';
import { worldKeyForEntity } from '@/lib/worldKey';
import {
    assembleManuscript,
    assembleChapter,
    manuscriptWordCount,
    orderChapters,
    resolveFrontMatter,
    type FrontMatter,
    type Manuscript,
} from '@/lib/manuscript';
import {
    exportManuscriptAsMarkdown,
    exportManuscriptAsDocx,
    exportWorldBible,
} from '@/lib/export';
import { exportManuscriptAsEpub } from '@/lib/epub';

/**
 * ExportModal — the compile step.
 *
 * Choose what goes in the book (front matter, which chapters), then take it out
 * in one file. "This chapter" is the same code path with a one-chapter list,
 * and it is bound to the document the desk actually has open.
 */
interface ExportModalProps {
    onClose: () => void;
}

type Scope = 'manuscript' | 'chapter';

export default function ExportModal({ onClose }: ExportModalProps) {
    const documents = useWorkspaceStore(state => state.documents);
    const scenes = useWorkspaceStore(state => state.scenes);
    const activeDocumentId = useWorkspaceStore(state => state.activeDocumentId);
    const activeProjectId = useWorkspaceStore(state => state.activeProjectId);
    const projects = useWorkspaceStore(state => state.projects);
    const allEntities = useWorkspaceStore(state => state.entities);
    const projectWorldKey = useWorkspaceStore(selectProjectWorldKey);
    // Subscribe to the STORED value, then resolve outside the subscription.
    // selectProjectFrontMatter merges over the defaults, so it builds a fresh
    // object on every call — subscribing to it directly makes zustand see a
    // changed snapshot each render and loop until React gives up.
    const storedFrontMatter = useWorkspaceStore(
        s => s.projects.find(p => p.id === s.activeProjectId)?.frontMatter,
    );
    const frontMatter = useMemo(
        () => resolveFrontMatter(storedFrontMatter),
        [storedFrontMatter],
    );
    const updateProject = useWorkspaceStore(state => state.updateProject);

    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [excludedIds, setExcludedIds] = useState<string[]>([]);
    const [scope, setScope] = useState<Scope>('manuscript');

    const activeProject = projects.find(p => p.id === activeProjectId);
    const activeDocument = documents.find(d => d.id === activeDocumentId);
    const worldEntities = allEntities.filter(e => worldKeyForEntity(e) === projectWorldKey);

    const chapters = activeProjectId ? orderChapters(documents, activeProjectId) : [];
    const includedChapterIds = chapters.map(c => c.id).filter(id => !excludedIds.includes(id));

    const meta = { title: activeProject?.name ?? 'Untitled', author: activeProject?.authorName };

    const wholeBook: Manuscript | null = activeProjectId
        ? assembleManuscript(meta, documents, scenes, activeProjectId, { frontMatter, includedChapterIds })
        : null;

    const oneChapter: Manuscript | null = activeDocument
        ? assembleChapter(meta, activeDocument, scenes)
        : null;

    const target = scope === 'chapter' ? oneChapter : wholeBook;
    const canExport = !!target && !isExporting;
    const chapterCount = target?.chapters.length ?? 0;
    const words = target ? manuscriptWordCount(target) : 0;

    const patchFrontMatter = (patch: Partial<FrontMatter>) => {
        if (!activeProjectId) return;
        updateProject(activeProjectId, { frontMatter: { ...frontMatter, ...patch } });
    };

    const toggleChapter = (id: string) => {
        setExcludedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const runExport = async (label: string, run: (m: Manuscript) => void | Promise<void>) => {
        if (!target) return;
        setExportError(null);
        setIsExporting(true);
        try {
            await run(target);
        } catch (err: unknown) {
            setExportError(err instanceof Error ? err.message : `Unknown error during ${label} export`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleWorldBibleExport = () => {
        if (!activeProject) return;
        setExportError(null);
        try {
            exportWorldBible(worldEntities, activeProject.name);
        } catch (err: unknown) {
            setExportError(err instanceof Error ? err.message : 'Unknown error exporting World Bible');
        }
    };

    const hasEntities = worldEntities.length > 0;
    const uniqueTypesCount = new Set(worldEntities.map(e => e.type)).size;

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Compile &amp; Export</h2>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close Export Modal"><X size={18} /></button>
                </div>

                <div className={styles.content}>
                    <section className={styles.section}>
                        <div className={styles.scopeTabs}>
                            <button
                                className={`${styles.scopeTab} ${scope === 'manuscript' ? styles.scopeTabActive : ''}`}
                                onClick={() => setScope('manuscript')}
                            >
                                Whole manuscript
                            </button>
                            <button
                                className={`${styles.scopeTab} ${scope === 'chapter' ? styles.scopeTabActive : ''}`}
                                onClick={() => setScope('chapter')}
                                disabled={!activeDocument}
                            >
                                This chapter
                            </button>
                        </div>

                        <p className={styles.subtext}>
                            {scope === 'chapter'
                                ? <>Just the chapter open on the desk: <strong>{activeDocument?.title || 'Untitled'}</strong></>
                                : <>{chapterCount} chapter{chapterCount === 1 ? '' : 's'} &middot; {words.toLocaleString()} words</>}
                        </p>
                    </section>

                    {scope === 'manuscript' && (
                        <>
                            <section className={styles.sectionDivider}>
                                <h3>Front matter</h3>
                                <div className={styles.compileGrid}>
                                    <label className={styles.compileToggle}>
                                        <input
                                            type="checkbox"
                                            checked={frontMatter.titlePage}
                                            onChange={e => patchFrontMatter({ titlePage: e.target.checked })}
                                        />
                                        Title page
                                    </label>
                                    <label className={styles.compileToggle}>
                                        <input
                                            type="checkbox"
                                            checked={frontMatter.contents}
                                            onChange={e => patchFrontMatter({ contents: e.target.checked })}
                                        />
                                        Contents
                                    </label>
                                </div>

                                <div className={styles.compileField}>
                                    <label htmlFor="compile-copyright">Copyright page</label>
                                    <textarea
                                        id="compile-copyright"
                                        rows={2}
                                        placeholder={`(c) ${new Date().getFullYear()} ${activeProject?.authorName || 'Your name'}. All rights reserved.`}
                                        value={frontMatter.copyright}
                                        onChange={e => patchFrontMatter({ copyright: e.target.value })}
                                    />
                                </div>

                                <div className={styles.compileField}>
                                    <label htmlFor="compile-dedication">Dedication</label>
                                    <textarea
                                        id="compile-dedication"
                                        rows={2}
                                        placeholder="For someone."
                                        value={frontMatter.dedication}
                                        onChange={e => patchFrontMatter({ dedication: e.target.value })}
                                    />
                                </div>
                                <p className={styles.subtext}>Leave a field blank and its page is left out.</p>
                            </section>

                            <section className={styles.sectionDivider}>
                                <h3>Chapters</h3>
                                {chapters.length === 0 ? (
                                    <p className={styles.subtext}>This project has no chapters yet.</p>
                                ) : (
                                    <div className={styles.chapterList}>
                                        {chapters.map((chapter, i) => (
                                            <label key={chapter.id} className={styles.chapterRow}>
                                                <input
                                                    type="checkbox"
                                                    checked={!excludedIds.includes(chapter.id)}
                                                    onChange={() => toggleChapter(chapter.id)}
                                                />
                                                <span className={styles.chapterIndex}>{i + 1}</span>
                                                <span className={styles.chapterTitle}>{chapter.title || 'Untitled Chapter'}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    <section className={styles.sectionDivider}>
                        <h3>Download</h3>
                        <div className={styles.actionRow}>
                            <button
                                className={styles.exportBtn}
                                onClick={() => runExport('Markdown', m => exportManuscriptAsMarkdown(m))}
                                disabled={!canExport}
                            >
                                <span className={styles.icon}><Download size={16} /></span>
                                Markdown (.md)
                            </button>

                            <button
                                className={styles.exportBtn}
                                onClick={() => runExport('Word', async m => { await exportManuscriptAsDocx(m); })}
                                disabled={!canExport}
                            >
                                {isExporting ? <span className={styles.spinner}></span> : (
                                    <>
                                        <span className={styles.icon}><Download size={16} /></span>
                                        Word (.docx)
                                    </>
                                )}
                            </button>

                            <button
                                className={styles.exportBtn}
                                onClick={() => runExport('EPUB', m => exportManuscriptAsEpub(m, {
                                    title: m.title,
                                    author: activeProject?.authorName || undefined,
                                }))}
                                disabled={!canExport}
                            >
                                {isExporting ? <span className={styles.spinner}></span> : (
                                    <>
                                        <span className={styles.icon}><Download size={16} /></span>
                                        EPUB (.epub)
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
                                    <span className={styles.icon}><Download size={16} /></span>
                                    Download World Bible (.md)
                                </button>
                            </div>
                        </div>
                        <p className={styles.subtext}>
                            {hasEntities
                                ? `${worldEntities.length} entities across ${uniqueTypesCount} types`
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
