"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspaceStore, DeskWidget, Document, Scene, Entity, selectProjectWorldKey } from '@/store/workspaceStore';
import { STANDALONE_KEY } from '@/lib/worldKey';
import styles from './MethodLibrary.module.css';

/** A beat card snapshot ready for export (content merged with live edits). */
export interface ExportBeat {
    label: string;
    group?: string;
    text: string;
}

/** Order beat cards for export: method order first, hand-drawn cards last by position. */
export function collectExportBeats(widgets: DeskWidget[], liveContent: Record<string, Record<string, any>>): ExportBeat[] {
    return widgets
        .filter(w => w.type === 'beatCard')
        .map(w => {
            const content = { ...w.content, ...(liveContent[w.id] ?? {}) };
            return {
                sortKey: typeof content.beatIndex === 'number' ? content.beatIndex : Number.MAX_SAFE_INTEGER,
                y: w.y,
                x: w.x,
                beat: {
                    label: (content.beatLabel as string) || 'Beat',
                    group: content.beatGroup as string | undefined,
                    text: ((content.text as string) ?? '').trim(),
                },
            };
        })
        .sort((a, b) => a.sortKey - b.sortKey || a.y - b.y || a.x - b.x)
        .map(entry => entry.beat);
}

/** Escape text and wrap its lines in <p> tags for TipTap/article HTML. */
function textToHtml(text: string): string {
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paragraphs = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    return paragraphs.map(p => `<p>${escape(p)}</p>`).join('');
}

interface DraftExportProps {
    projectId: string;
    methodName: string;
    beats: ExportBeat[];
    onClose: () => void;
}

/**
 * Export the Draft Table outline.
 *
 * → Writing Desk: beat groups become chapters, beats become scenes, and the
 *   writer lands on the desk ready to draft.
 * → World Bible: the outline becomes a lore article (headings + text blocks).
 */
export function DraftExport({ projectId, methodName, beats, onClose }: DraftExportProps) {
    const projects = useWorkspaceStore(s => s.projects);
    const addDocument = useWorkspaceStore(s => s.addDocument);
    const addScene = useWorkspaceStore(s => s.addScene);
    const addEntity = useWorkspaceStore(s => s.addEntity);
    const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
    const setActiveScene = useWorkspaceStore(s => s.setActiveScene);
    const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
    const setFocusedArticleEntity = useWorkspaceStore(s => s.setFocusedArticleEntity);

    const projectName = projects.find(p => p.id === projectId)?.name ?? 'Untitled';
    const [articleTitle, setArticleTitle] = useState(`${projectName} — Outline`);
    const [isNamingArticle, setIsNamingArticle] = useState(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const filledCount = beats.filter(b => b.text !== '').length;

    /** Beat groups become chapters; ungrouped runs share a chapter. */
    const exportToDesk = () => {
        let currentDoc: Document | null = null;
        let firstDoc: Document | null = null;
        let firstScene: Scene | null = null;
        let order = 0;

        beats.forEach(beat => {
            const chapterTitle = beat.group ?? methodName;
            if (!currentDoc || currentDoc.title !== chapterTitle) {
                currentDoc = {
                    id: crypto.randomUUID(),
                    projectId,
                    title: chapterTitle,
                    content: '',
                    createdAt: new Date(),
                };
                addDocument(currentDoc);
                firstDoc = firstDoc ?? currentDoc;
                order = 0;
            }
            const scene: Scene = {
                id: crypto.randomUUID(),
                documentId: currentDoc.id,
                projectId,
                title: beat.label,
                content: textToHtml(beat.text),
                order: order++,
                createdAt: new Date(),
            } as Scene;
            addScene(scene);
            firstScene = firstScene ?? scene;
        });

        if (firstDoc) setActiveDocument((firstDoc as Document).id);
        if (firstScene) setActiveScene((firstScene as Scene).id);
        setWorkspaceMode('desk');
        onClose();
    };

    /** The outline becomes a lore article: group headings, beat headings, text blocks. */
    const exportToArticle = () => {
        const title = articleTitle.trim() || `${projectName} — Outline`;
        const worldKey = selectProjectWorldKey(useWorkspaceStore.getState());

        const widgets: { id: string; type: string; x: number; y: number; width: number; height: number; content: Record<string, any> }[] = [];
        let y = 40;
        let lastGroup: string | undefined;

        beats.forEach(beat => {
            if (beat.group && beat.group !== lastGroup) {
                widgets.push({ id: crypto.randomUUID(), type: 'heading', x: 40, y, width: 600, height: 56, content: { level: 1, text: beat.group } });
                y += 76;
                lastGroup = beat.group;
            }
            widgets.push({ id: crypto.randomUUID(), type: 'heading', x: 40, y, width: 600, height: 48, content: { level: 2, text: beat.label } });
            y += 64;
            if (beat.text) {
                const height = Math.min(400, 80 + Math.ceil(beat.text.length / 70) * 24);
                widgets.push({ id: crypto.randomUUID(), type: 'text', x: 40, y, width: 600, height, content: { html: textToHtml(beat.text) } });
                y += height + 20;
            }
        });

        const entity: Entity = {
            id: crypto.randomUUID(),
            projectId,
            worldId: worldKey === STANDALONE_KEY ? undefined : worldKey,
            name: title,
            type: 'lore',
            description: `Outline exported from the Draft Table (${methodName}).`,
            createdAt: new Date(),
            articleDoc: JSON.stringify([{ id: crypto.randomUUID(), name: 'Main', widgets }]),
        };
        addEntity(entity);
        setFocusedArticleEntity(entity.id);
        setWorkspaceMode('worldBible');
        onClose();
    };

    const modal = (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={`${styles.modal} ${styles.finderModal}`} onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Close export">×</button>

                <div className={styles.header}>
                    <h2 className={styles.title}>Export your outline</h2>
                    <p className={styles.subtitle}>
                        {beats.length} beat{beats.length === 1 ? '' : 's'} ({filledCount} with text) — your cards stay on the Draft Table.
                    </p>
                </div>

                <div className={styles.scroll}>
                    {!isNamingArticle ? (
                        <div className={styles.finderOptions}>
                            <button className={styles.finderOption} onClick={exportToDesk}>
                                <span className={styles.starterName}>✍️ To the Writing Desk</span>
                                <span className={styles.starterTagline}>
                                    Beat groups become chapters, each beat becomes a scene with your outline text — ready to draft over.
                                </span>
                            </button>
                            <button className={styles.finderOption} onClick={() => setIsNamingArticle(true)}>
                                <span className={styles.starterName}>🌍 To the World Bible</span>
                                <span className={styles.starterTagline}>
                                    The outline becomes a lore article — headings and text blocks, filed in this shelf&apos;s bible.
                                </span>
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className={styles.sectionLabel}>Article title</div>
                            <input
                                className={styles.exportInput}
                                value={articleTitle}
                                onChange={e => setArticleTitle(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') exportToArticle(); }}
                                autoFocus
                            />
                            <div className={styles.finderFooter}>
                                <button className={styles.finderBack} onClick={() => setIsNamingArticle(false)}>← Back</button>
                                <button className={styles.welcomePrimary} onClick={exportToArticle} disabled={!articleTitle.trim()}>
                                    Create Article
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
