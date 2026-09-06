"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { rootBoardIdFor, breadcrumbFor } from '@/lib/research/boardTree';
import { intentFor } from '@/lib/research/shortcuts';
import { fromTray } from '@/lib/research/unsorted';
import { applyLabel, removeLabel } from '@/lib/research/labels';
import WritingDesk from './WritingDesk';
import { ResearchEmptyState } from './ResearchEmptyState';
import { BoardBreadcrumbs } from './research/BoardBreadcrumbs';
import { UnsortedTray } from './research/UnsortedTray';
import { ResearchRail } from './research/ResearchRail';
import { BoardSearch } from './research/BoardSearch';
import { LabelBar } from './research/LabelBar';
import styles from './WritingDesk.module.css';

/**
 * Research Tab — the Workshop's first stage.
 *
 * A tree of boards. The writer opens a board card to go down and a breadcrumb
 * to come back up; every board carries its own unsorted tray, so capturing
 * something never requires deciding where it belongs first.
 */
export default function ResearchTab() {
    const activeProject = useWorkspaceStore(s =>
        s.projects.find(p => p.id === s.activeProjectId) ?? null
    );
    const registry = useWorkspaceStore(s => s.researchBoards);
    const updateResearchState = useWorkspaceStore(s => s.updateResearchState);
    const rootId = activeProject ? rootBoardIdFor(registry, activeProject.id) : null;

    const [openBoardId, setOpenBoardId] = useState<string | null>(null);
    // Changing project drops you back at that project's root.
    useEffect(() => { setOpenBoardId(null); }, [activeProject?.id]);

    const canvasHostRef = useRef<HTMLDivElement>(null);
    const boardId = openBoardId ?? rootId;
    const [searchOpen, setSearchOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [labelFilter, setLabelFilter] = useState<string[]>([]);

    // The card the canvas has selected, as label ids — null when nothing is
    // selected, which is what puts the label bar into filter mode.
    const selectedLabelIds = useWorkspaceStore(s => {
        if (!boardId || !selectedId) return null;
        const card = s.researchStates[boardId]?.widgets?.find(w => w.id === selectedId);
        return card ? (card.labelIds ?? []) : null;
    });

    const applyToSelection = (labelId: string) => {
        if (!boardId || !selectedId) return;
        const widgets = useWorkspaceStore.getState().researchStates[boardId]?.widgets ?? [];
        const has = widgets.find(w => w.id === selectedId)?.labelIds?.includes(labelId);
        updateResearchState(boardId, {
            widgets: has
                ? removeLabel(widgets, selectedId, labelId)
                : applyLabel(widgets, selectedId, labelId),
        });
    };

    // Board-level shortcuts. Card-level ones belong to the canvas, which owns
    // the selection; these two only need to know which board is open.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const typing = Boolean(target?.closest('input, textarea, [contenteditable="true"]'));
            const intent = intentFor({
                key: e.key,
                ctrlKey: e.ctrlKey, metaKey: e.metaKey,
                shiftKey: e.shiftKey, altKey: e.altKey,
                inTextField: typing,
                hasSelection: false,
            });
            if (intent?.kind === 'search') {
                e.preventDefault();
                setSearchOpen(true);
            }
            if (intent?.kind === 'parentBoard' && boardId) {
                e.preventDefault();
                const trail = breadcrumbFor(useWorkspaceStore.getState().researchBoards, boardId);
                const parent = trail.length > 1 ? trail[trail.length - 2] : null;
                if (parent) setOpenBoardId(parent.id);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [boardId]);

    /** Tray -> canvas. Screen point in, canvas point out. */
    const handleDragOut = (widgetId: string, at: { x: number; y: number }) => {
        if (!boardId) return;
        const state = useWorkspaceStore.getState().researchStates[boardId];
        if (!state) return;

        const host = canvasHostRef.current?.getBoundingClientRect();
        const zoom = state.zoom ?? 1;
        const offset = state.canvasOffset ?? { x: 0, y: 0 };
        const point = host
            ? { x: (at.x - host.left - offset.x) / zoom, y: (at.y - host.top - offset.y) / zoom }
            : { x: 80, y: 80 };   // dropped outside the canvas: park it top-left

        const next = fromTray(state, widgetId, point);
        updateResearchState(boardId, { widgets: next.widgets, unsorted: next.unsorted });
    };

    if (!boardId) return <ResearchEmptyState />;

    return (
        <div className={styles.researchLayout}>
            <ResearchRail scopeKey={boardId} />
            <div className={styles.researchMain}>
                <BoardBreadcrumbs boardId={boardId} onNavigate={setOpenBoardId} />
                {activeProject && (
                    <LabelBar
                        projectId={activeProject.id}
                        selectedLabelIds={selectedLabelIds}
                        activeFilter={labelFilter}
                        onFilterChange={setLabelFilter}
                        onApplyToSelection={applyToSelection}
                    />
                )}
                <div className={styles.researchCanvasHost} ref={canvasHostRef}>
                    <WritingDesk
                        variant="research"
                        scopeKey={boardId}
                        onOpenBoard={setOpenBoardId}
                        onSelectionChange={setSelectedId}
                        labelFilter={labelFilter}
                    />
                </div>
            </div>
            <UnsortedTray boardId={boardId} onDragOut={handleDragOut} />

            {searchOpen && activeProject && (
                <BoardSearch
                    projectId={activeProject.id}
                    onClose={() => setSearchOpen(false)}
                    onGo={setOpenBoardId}
                />
            )}
        </div>
    );
}
