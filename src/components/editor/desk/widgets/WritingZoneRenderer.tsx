"use client";

/**
 * WritingZoneRenderer — hands the desk's centre widget to the writing zone
 * built for the project's medium.
 *
 * There is one zone. Four siblings were deleted in Phase 1: three were clones
 * of this one differing by four lines each, and the fourth served a withdrawn
 * work type. The dispatch is kept because it is the seam a genuinely different
 * second format would arrive through, and because legacy projects still carry
 * withdrawn writingMode values that must land somewhere.
 *
 * This file stays the only thing WidgetRenderer knows about, so the dispatch
 * can change without touching the desk.
 */

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getWorkTypeByWritingMode } from '@/lib/workTypes';
import { WritingZoneProps } from './zones/zoneTypes';
import { StoryWritingZone } from './zones/StoryWritingZone';

/** Work type id → the zone written for it. */
const ZONES: Record<string, React.ComponentType<WritingZoneProps>> = {
    'story': StoryWritingZone,
};

/**
 * The zone a project's writing mode calls for. 'real-world' projects, and
 * anything created before work types existed, get the story zone — the one
 * they have always been writing in.
 */
export function pickZone(
    writingMode: string | null | undefined,
): React.ComponentType<WritingZoneProps> {
    const typeId = getWorkTypeByWritingMode(writingMode)?.id;
    return (typeId && ZONES[typeId]) || StoryWritingZone;
}

export function WritingZoneRenderer(props: WritingZoneProps) {
    const writingMode = useWorkspaceStore(
        s => s.projects.find(p => p.id === s.activeProjectId)?.writingMode,
    );
    const Zone = pickZone(writingMode);

    return <Zone {...props} />;
}
