"use client";

/**
 * VNTimelineSurface — the visual novel drafting surface.
 *
 * Story contains Seasons contain Episodes contain Decisions, drawn as boxes
 * within boxes and read top to bottom. Geometry comes entirely from
 * layoutTimeline; this component draws what it is given and routes clicks.
 *
 * It owns its own viewport, zoom and focus rather than living on the Draft
 * Table canvas, because focus-framing has to drive the transform and the
 * canvas has its own ideas about dragging, resizing and widget chrome.
 */

import React, { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
    layoutTimeline, tierForZoom, STORY_BOX_ID,
    type VNBox, type VNEpisode, type VNFocus, type VNSeason,
} from '@/lib/vnTimeline';
import type { VNDecision } from '@/lib/vnTimeline';
import { VNEpisodeBox } from './VNEpisodeBox';
import { VNDecisionEditor } from './VNDecisionEditor';
import styles from './VNTimeline.module.css';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const FRAME_PAD = 48;

interface SetupProps {
    onCreate: (seasonCount: number, episodesPerSeason: number) => void;
}

/**
 * The first thing a writer sees. Answering it lays a whole skeleton down, so
 * they land on a populated timeline rather than an empty canvas and a question
 * about where to start.
 */
function TimelineSetup({ onCreate }: SetupProps) {
    const [seasonCount, setSeasonCount] = useState(1);
    const [episodeCount, setEpisodeCount] = useState(6);

    return (
        <div className={styles.setup}>
            <h2>How is this story shaped?</h2>
            <p className={styles.setupHint}>
                Both are editable later — this is a head start, not a commitment.
            </p>

            <label className={styles.setupRow}>
                <span>Seasons</span>
                <input type="number" min={1} max={20} value={seasonCount}
                       onChange={e => setSeasonCount(Math.max(1, Number(e.target.value)))} />
            </label>

            <label className={styles.setupRow}>
                <span>Episodes each</span>
                <input type="number" min={1} max={40} value={episodeCount}
                       onChange={e => setEpisodeCount(Math.max(1, Number(e.target.value)))} />
            </label>

            <button type="button" className={styles.setupGo}
                    onClick={() => onCreate(seasonCount, episodeCount)}>
                Build the timeline
            </button>
        </div>
    );
}

export function VNTimelineSurface() {
    const viewportRef = useRef<HTMLDivElement>(null);

    const activeProjectId = useWorkspaceStore(s => s.activeProjectId);
    const project = useWorkspaceStore(s => s.projects.find(p => p.id === activeProjectId));

    // Select stored documents, reshape after — never inside the selector.
    const episodeDocs = useWorkspaceStore(useShallow(s =>
        s.documents.filter(d => d.projectId === activeProjectId),
    ));

    const seasons: VNSeason[] = project?.seasons ?? [];
    const episodes: VNEpisode[] = episodeDocs.map(d => ({
        id: d.id,
        title: d.title,
        seasonId: d.seasonId,
        order: d.order ?? 0,
        decisions: d.decisions,
    }));

    const updateDocument = useWorkspaceStore(s => s.updateDocument);
    const episodeById = new Map(episodes.map(e => [e.id, e]));

    const flags = useWorkspaceStore(useShallow(s =>
        s.projects.find(p => p.id === activeProjectId)?.vnFlags ?? [],
    ));
    const episodeChoices = episodes.map(e => ({ id: e.id, title: e.title }));

    /** Decisions live on their episode, so every edit writes the whole array. */
    const updateDecision = (episodeId: string, decisionId: string, patch: Partial<VNDecision>) => {
        const current = episodeById.get(episodeId)?.decisions ?? [];
        updateDocument(episodeId, {
            decisions: current.map(d => (d.id === decisionId ? { ...d, ...patch } : d)),
        });
    };

    const removeDecision = (episodeId: string, decisionId: string) => {
        const current = episodeById.get(episodeId)?.decisions ?? [];
        updateDocument(episodeId, { decisions: current.filter(d => d.id !== decisionId) });
    };

    const addDecision = (episodeId: string) => {
        const current = episodeById.get(episodeId)?.decisions ?? [];
        updateDocument(episodeId, {
            decisions: [...current, {
                id: crypto.randomUUID(),
                kind: 'minor' as const,
                prompt: '',
                order: current.length,
                options: [],
            }],
        });
    };

    const [focus, setFocus] = useState<VNFocus | undefined>(undefined);
    const [zoom, setZoom] = useState(0.5);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const boxes = useMemo(
        () => layoutTimeline(seasons, episodes, focus),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(seasons), JSON.stringify(episodes), focus?.kind, focus?.id],
    );

    const tier = tierForZoom(zoom);

    /** Zoom and centre so one box fills the viewport. */
    const frame = (box: VNBox) => {
        const vp = viewportRef.current;
        if (!vp) return;
        const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(
            (vp.clientWidth - FRAME_PAD * 2) / box.width,
            (vp.clientHeight - FRAME_PAD * 2) / box.height,
        )));
        setZoom(z);
        setOffset({
            x: vp.clientWidth / 2 - (box.x + box.width / 2) * z,
            y: vp.clientHeight / 2 - (box.y + box.height / 2) * z,
        });
    };

    /**
     * Focus changes the layout, so the box to frame must be found in the
     * layout the new focus produces — not the one currently on screen.
     */
    const focusOn = (next: VNFocus | undefined) => {
        const nextBoxes = layoutTimeline(seasons, episodes, next);
        const target = next
            ? nextBoxes.find(b => b.id === next.id)
            : nextBoxes.find(b => b.id === STORY_BOX_ID);
        setFocus(next);
        if (target) frame(target);
    };

    const onBoxClick = (box: VNBox) => {
        if (box.kind === 'season') focusOn({ kind: 'season', id: box.id });
        else if (box.kind === 'episode') focusOn({ kind: 'episode', id: box.id });
    };

    const updateProject = useWorkspaceStore(s => s.updateProject);
    const addDocument = useWorkspaceStore(s => s.addDocument);

    const createSkeleton = (seasonCount: number, episodesPerSeason: number) => {
        if (!activeProjectId) return;

        const newSeasons: VNSeason[] = Array.from({ length: seasonCount }, (_, i) => ({
            id: crypto.randomUUID(),
            title: `Season ${i + 1}`,
            order: i,
        }));

        updateProject(activeProjectId, { seasons: newSeasons });

        for (const season of newSeasons) {
            for (let e = 0; e < episodesPerSeason; e += 1) {
                addDocument({
                    id: crypto.randomUUID(),
                    projectId: activeProjectId,
                    title: `Episode ${e + 1}`,
                    content: '',
                    createdAt: new Date(),
                    seasonId: season.id,
                    order: e,
                    decisions: [],
                });
            }
        }
    };

    if (!activeProjectId) return null;

    if (!seasons.length && !episodes.length) {
        return <TimelineSetup onCreate={createSkeleton} />;
    }

    return (
        <div className={styles.surface}>
            <div className={styles.toolbar}>
                <button type="button" onClick={() => focusOn(undefined)}>
                    Whole story
                </button>
                <span className={styles.tierLabel}>{tier}</span>
                <button type="button" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.1))}>−</button>
                <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.1))}>+</button>
            </div>

            <div ref={viewportRef} className={styles.viewport}>
                <div
                    className={styles.canvas}
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
                >
                    {boxes.map(box => (
                        <div
                            key={box.id}
                            className={`${styles.box} ${styles[box.kind]} ${box.collapsed ? styles.collapsed : ''}`}
                            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
                            onClick={e => { e.stopPropagation(); onBoxClick(box); }}
                        >
                            {box.kind === 'decision' ? (() => {
                                const episodeId = box.parentId!;
                                const decision = episodeById.get(episodeId)?.decisions
                                    ?.find(d => d.id === box.id);
                                if (!decision) return null;
                                return tier === 'decision' ? (
                                    <VNDecisionEditor
                                        decision={decision}
                                        flags={flags}
                                        episodes={episodeChoices}
                                        onChange={patch => updateDecision(episodeId, decision.id, patch)}
                                        onRemove={() => removeDecision(episodeId, decision.id)}
                                    />
                                ) : (
                                    <div className={styles.boxTitle}>
                                        {decision.prompt || 'Untitled decision'}
                                    </div>
                                );
                            })() : box.kind === 'episode' ? (
                                <>
                                    <VNEpisodeBox
                                        title={box.title}
                                        decisions={episodeById.get(box.id)?.decisions ?? []}
                                        tier={tier}
                                        collapsed={box.collapsed}
                                        onTitleChange={title => updateDocument(box.id, { title })}
                                    />
                                    {focus?.kind === 'episode' && focus.id === box.id && (
                                        <button
                                            type="button"
                                            className={styles.addDecision}
                                            onClick={e => { e.stopPropagation(); addDecision(box.id); }}
                                        >
                                            + decision
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className={styles.boxTitle}>{box.title}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
