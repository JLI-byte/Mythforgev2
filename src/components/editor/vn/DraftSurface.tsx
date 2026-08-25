"use client";

/**
 * DraftSurface — what the Draft Table shows.
 *
 * A visual novel drafts on a season timeline; every other work type drafts on
 * the spatial canvas. Choosing here keeps WritingDesk unaware that the
 * timeline exists.
 */

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import WritingDesk from '@/components/editor/WritingDesk';
import { VNTimelineSurface } from './VNTimelineSurface';

export function DraftSurface() {
    const isVisualNovel = useWorkspaceStore(s =>
        s.projects.find(p => p.id === s.activeProjectId)?.writingMode === 'visual-novel',
    );

    return isVisualNovel ? <VNTimelineSurface /> : <WritingDesk variant="draft" />;
}
