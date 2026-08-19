"use client";

/**
 * WritingZoneRenderer — hands the desk's centre widget to the writing zone
 * built for the project's medium.
 *
 * The zone used to be one story-shaped component. It's now four siblings under
 * ./zones, one per work type, so a screenplay's binder can stop pretending to
 * be a book without breaking novels. They start as identical clones; each is
 * customised on its own.
 *
 * This file stays the only thing WidgetRenderer knows about, so the dispatch
 * can change without touching the desk.
 */

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getWorkTypeByWritingMode } from '@/lib/workTypes';
import { WritingZoneProps } from './zones/zoneTypes';
import { StoryWritingZone } from './zones/StoryWritingZone';
import { ScreenplayWritingZone } from './zones/ScreenplayWritingZone';
import { ReportWritingZone } from './zones/ReportWritingZone';
import { LyricsWritingZone } from './zones/LyricsWritingZone';

/** Work type id → the zone written for it. */
const ZONES: Record<string, React.ComponentType<WritingZoneProps>> = {
    'story': StoryWritingZone,
    'screenplay': ScreenplayWritingZone,
    'script-report': ReportWritingZone,
    'lyrics': LyricsWritingZone,
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
