"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import styles from './ScenePinRenderer.module.css';

/**
 * The length the progress bar treats as a full scene. This is a display
 * default for the bar only — it is not a per-scene setting, and nothing
 * about the scene changes when it is passed.
 */
const SCENE_TARGET_WORDS = 2000;

interface Props {
    content: { sceneId?: string | null };
    onChange: (c: Record<string, unknown>) => void;
}

/**
 * A pinned scene, as it appears on the desk.
 *
 * Only the id is stored in the widget's content; the title, word count and
 * parent document are read live from the store, so a rename upstream shows
 * here without the card holding a stale copy.
 */
export function ScenePinRenderer({ content, onChange }: Props) {
    const sceneId = content.sceneId ?? null;
    const scenes = useWorkspaceStore(s => s.scenes);
    const documents = useWorkspaceStore(s => s.documents);
    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const setActiveScene = useWorkspaceStore(s => s.setActiveScene);
    const setActiveDocument = useWorkspaceStore(s => s.setActiveDocument);
    const setWorkspaceMode = useWorkspaceStore(s => s.setWorkspaceMode);
    const setDeskStage = useWorkspaceStore(s => s.setDeskStage);

    const [searchTerm, setSearchTerm] = React.useState('');

    const scene = React.useMemo(
        () => (sceneId ? scenes.find(s => s.id === sceneId) : undefined),
        [scenes, sceneId],
    );

    const matches = React.useMemo(() => {
        if (sceneId) return [];
        const term = searchTerm.trim().toLowerCase();
        return scenes
            .filter(s => s.projectId === activeProjectId)
            .filter(s => s.title.toLowerCase().includes(term))
            .slice(0, 15);
    }, [scenes, activeProjectId, searchTerm, sceneId]);

    const clear = () => onChange({ sceneId: null });

    if (!sceneId) {
        return (
            <div className={styles.card}>
                <input
                    className={styles.search}
                    aria-label="Search scenes"
                    placeholder="Search scenes"
                    value={searchTerm}
                    onMouseDown={e => e.stopPropagation()}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <div className={styles.results}>
                    {matches.map(s => (
                        <button
                            key={s.id}
                            className={styles.result}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => onChange({ sceneId: s.id })}
                        >
                            {s.title}
                        </button>
                    ))}
                    {matches.length === 0 && (
                        <p className={styles.empty}>No scenes match.</p>
                    )}
                </div>
            </div>
        );
    }

    if (!scene) {
        return (
            <div className={styles.card}>
                <div className={styles.body}>
                    <p className={styles.empty}>This scene was deleted.</p>
                </div>
                <div className={styles.foot}>
                    <button
                        className={styles.change}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={clear}
                    >
                        Change
                    </button>
                </div>
            </div>
        );
    }

    const parentDocument = documents.find(d => d.id === scene.documentId);
    const words = scene.wordCount ?? 0;
    const percent = Math.min(100, (words / SCENE_TARGET_WORDS) * 100);

    const openInWriting = () => {
        setActiveDocument(scene.documentId);
        setActiveScene(scene.id);
        setWorkspaceMode('desk');
        setDeskStage('write');
    };

    return (
        <div className={styles.card}>
            <div className={styles.body}>
                <p className={styles.doc}>{parentDocument ? parentDocument.title : 'Unknown document'}</p>
                <h3 className={styles.title}>{scene.title}</h3>
                <p className={styles.words}>{words} words</p>
                <span className={styles.track} aria-hidden="true">
                    <span className={styles.fill} style={{ width: `${percent}%` }} />
                </span>
            </div>
            <div className={styles.foot}>
                <button
                    className={styles.open}
                    aria-label="Open this scene in the Writing stage"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={openInWriting}
                >
                    Open in Writing
                </button>
                <button
                    className={styles.change}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={clear}
                >
                    Change
                </button>
            </div>
        </div>
    );
}
