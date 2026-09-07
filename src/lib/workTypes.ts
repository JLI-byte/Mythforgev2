/**
 * Work types — the first question when starting something new: WHAT are you
 * writing? LEAF MODULE (no store, no React).
 *
 * There is one, deliberately. Screenplay, Script/Report, Lyrics and Visual
 * Novel were withdrawn in Phase 1: each opened a clone of the story editor and
 * promised format-specific behaviour that was never built. The product is a
 * manuscript and the lore behind it.
 *
 * The type is kept as a list rather than collapsed away because the work-type
 * question is still asked at creation, and because a second first-class format
 * may earn its place later — but it will arrive finished, not as a clone.
 */

/** Mirrors Project['writingMode'] in the workspace store. */
export type WritingMode = 'novel' | 'real-world';

export interface WorkType {
    id: 'story';
    label: string;
    icon: string;
    desc: string;
    /** Editor the project opens in. */
    writingMode: WritingMode;
    /** Draft Table type id (from DRAFT_TYPES), when one genuinely fits. */
    draftTypeId?: string;
    /** Placeholder for the name field, so the example suits the work. */
    namePlaceholder: string;
}

export const WORK_TYPES: WorkType[] = [
    {
        id: 'story',
        label: 'Story',
        icon: '📖',
        desc: 'Novels, short fiction, anything prose',
        writingMode: 'novel',
        draftTypeId: 'novel',
        namePlaceholder: 'e.g. The Long Winter',
    },
];

export function getWorkType(id: string | null | undefined): WorkType | undefined {
    return WORK_TYPES.find(t => t.id === id);
}

/**
 * Recovers the work type from a project's writing mode — projects store the
 * mode, not the type they were created from. Undefined for 'real-world' and for
 * any withdrawn mode still sitting on a legacy project, both of which fall back
 * to the story zone.
 */
export function getWorkTypeByWritingMode(
    mode: string | null | undefined,
): WorkType | undefined {
    return WORK_TYPES.find(t => t.writingMode === mode);
}
