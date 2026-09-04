/**
 * What a new story is made of — LEAF MODULE (no store, no React import).
 *
 * A book is never just a project row: it is a project, its first chapter, its
 * first scene, and a Draft Table pre-filtered to the kind of work it is. Two
 * screens create books — the Bookshelf wizard and Home's first-run panel — so
 * that shape lives here rather than in whichever one happened to be written
 * first.
 *
 * Returns plain records for the caller to hand to the store's actions. The
 * caller supplies the ids and the clock so the result is deterministic.
 */

import { getWorkType, type WritingMode } from './workTypes';
import { getWorkSubType, type ProjectBrief } from './workSubTypes';
import { getDraftType } from './writingMethods/draftTypes';
import type { DraftFormat } from './writingMethods/types';

export interface NewStoryIds {
    projectId: string;
    documentId: string;
    sceneId: string;
}

export interface NewStoryInput {
    name: string;
    workTypeId: string;
    /** Only Script/Report ever had sub-types; kept so the wizard can pass one. */
    subTypeId?: string | null;
    brief?: ProjectBrief;
    /** Shelf to file the book under. undefined means the standalone shelf. */
    worldId?: string;
    coverColor: string;
    ids: NewStoryIds;
    now: Date;
}

export interface PlannedProject {
    id: string;
    name: string;
    writingMode: WritingMode;
    coverColor: string;
    worldId?: string;
    createdAt: Date;
    workSubTypeId?: string;
    brief?: ProjectBrief;
}

export interface PlannedDocument {
    id: string;
    projectId: string;
    title: string;
    content: string;
    createdAt: Date;
}

export interface PlannedScene {
    id: string;
    documentId: string;
    projectId: string;
    title: string;
    content: string;
    order: number;
    createdAt: Date;
}

export interface NewStoryPlan {
    project: PlannedProject;
    document: PlannedDocument;
    scene: PlannedScene;
    /** null when no draft type honestly fits the work. */
    draftState: { draftTypeId: string; draftFormat: DraftFormat | undefined } | null;
}

/**
 * Build every record a new story needs, or null when the input cannot make
 * one — a blank name or an unknown work type. Returning null rather than
 * throwing keeps the callers' click handlers straight-line.
 */
export function planNewStory(input: NewStoryInput): NewStoryPlan | null {
    const name = input.name.trim();
    const workType = getWorkType(input.workTypeId);
    if (!name || !workType) return null;

    const subType = getWorkSubType(input.subTypeId);

    // Only keep answers that were actually filled in.
    const brief: ProjectBrief = Object.fromEntries(
        Object.entries(input.brief ?? {}).filter(([, v]) => v?.trim()),
    );
    const hasBrief = Object.keys(brief).length > 0;

    // The sub-type knows better than the work type when both have an opinion.
    const draftTypeId = subType?.draftTypeId ?? workType.draftTypeId;

    return {
        project: {
            id: input.ids.projectId,
            name,
            writingMode: workType.writingMode,
            coverColor: input.coverColor,
            worldId: input.worldId,
            createdAt: input.now,
            ...(subType ? { workSubTypeId: subType.id } : {}),
            ...(hasBrief ? { brief } : {}),
        },
        document: {
            id: input.ids.documentId,
            projectId: input.ids.projectId,
            title: 'Chapter 1',
            content: '',
            createdAt: input.now,
        },
        scene: {
            id: input.ids.sceneId,
            documentId: input.ids.documentId,
            projectId: input.ids.projectId,
            title: 'Scene 1',
            content: '',
            order: 0,
            createdAt: input.now,
        },
        draftState: draftTypeId
            ? { draftTypeId, draftFormat: getDraftType(draftTypeId)?.format }
            : null,
    };
}
