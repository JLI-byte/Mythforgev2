/**
 * Work types — the first question when starting something new: WHAT are you
 * writing? LEAF MODULE (no store, no React).
 *
 * Each type pins the project's writing mode (which editor it opens) and, where
 * there's an honest match, the Draft Table type so its method library arrives
 * pre-filtered instead of showing every method for every kind of work.
 */

/** Mirrors Project['writingMode'] in the workspace store. */
export type WritingMode = 'novel' | 'screenplay' | 'markdown' | 'poetry' | 'real-world';

export interface WorkType {
    id: 'story' | 'screenplay' | 'script-report' | 'lyrics';
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
    {
        id: 'screenplay',
        label: 'Screenplay',
        icon: '🎬',
        desc: 'Film, TV, or stage, in script format',
        writingMode: 'screenplay',
        draftTypeId: 'screenplay',
        namePlaceholder: 'e.g. Salt and Tide',
    },
    {
        id: 'script-report',
        label: 'Script / Report',
        icon: '📄',
        desc: 'Video scripts, essays, articles, documents',
        writingMode: 'markdown',
        draftTypeId: 'article-essay',
        namePlaceholder: 'e.g. The Veldrath Harbour Report',
    },
    {
        id: 'lyrics',
        label: 'Lyrics',
        icon: '🎵',
        desc: 'Songs, verse, poetry',
        writingMode: 'poetry',
        // No draft type: none of the outlining methods are written for songs,
        // so the Draft Table stays unfiltered rather than suggesting a bad fit.
        namePlaceholder: 'e.g. Ballad of the Drowned Bell',
    },
];

export function getWorkType(id: string | null | undefined): WorkType | undefined {
    return WORK_TYPES.find(t => t.id === id);
}
