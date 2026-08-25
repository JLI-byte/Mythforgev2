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
import styles from './VNTimeline.module.css';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const FRAME_PAD = 48;

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

    if (!activeProjectId) return null;

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
                            <div className={styles.boxTitle}>{box.title}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
