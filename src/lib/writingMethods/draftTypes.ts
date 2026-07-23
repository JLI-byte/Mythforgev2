import { DraftFormat } from './types';

/**
 * Draft types — WHAT the writer is making. The first question everywhere
 * (library and finder). Each type maps to a coarse format engine and carries
 * an ordered list of recommended methods.
 */
export interface DraftType {
    id: string;
    label: string;
    icon: string;
    desc: string;
    /** The coarse engine used for browse-all filtering and the finder matrix. */
    format: DraftFormat;
    /** Ordered method ids shown as "Recommended for [type]". */
    recommended: string[];
    /**
     * Specialized types push their top recommendation into the finder results
     * with this reason. Generic types (novel, screenplay…) rely on the matrix.
     */
    finderWhy?: string;
}

export const DRAFT_TYPES: DraftType[] = [
    {
        id: 'novel',
        label: 'Novel / Long Story',
        icon: '📖',
        desc: 'Long-form fiction, standalone or series',
        format: 'story',
        recommended: ['save-the-cat', 'snowflake', 'seven-point', 'three-act'],
    },
    {
        id: 'short-story',
        label: 'Short Story',
        icon: '✒️',
        desc: 'Tight fiction — every thread counts',
        format: 'story',
        recommended: ['mice-quotient', 'story-circle', 'kishotenketsu', 'story-spine'],
        finderWhy: 'Built for short fiction — thread control in a tight space.',
    },
    {
        id: 'character-backstory',
        label: 'Character Backstory',
        icon: '👤',
        desc: 'The history that made a character who they are',
        format: 'story',
        recommended: ['character-first', 'take-off-your-pants', 'virgins-promise', 'story-circle'],
        finderWhy: 'Purpose-built for character work — wound, want, and the scenes they demand.',
    },
    {
        id: 'screenplay',
        label: 'Screenplay',
        icon: '🎬',
        desc: 'Film, TV, or stage',
        format: 'script',
        recommended: ['save-the-cat', 'eight-sequence', 'screen-doc-chain', 'corkboard-acts'],
    },
    {
        id: 'youtube-script',
        label: 'YouTube / Video Script',
        icon: '▶️',
        desc: 'Video essays, explainers, narrative videos',
        format: 'script',
        recommended: ['fichtean-curve', 'story-spine', 'narrative-nonfiction', 'skeletal-outline'],
        finderWhy: 'Open on a hook and keep escalating — how watch-time survives.',
    },
    {
        id: 'comic',
        label: 'Comic / Graphic Novel',
        icon: '💥',
        desc: 'Sequential art, page by page',
        format: 'script',
        recommended: ['comics-script', 'storyboard', 'save-the-cat', 'story-circle'],
        finderWhy: 'The page-and-panel discipline comics are written in.',
    },
    {
        id: 'world-bible-article',
        label: 'World Bible Article',
        icon: '🌍',
        desc: 'Lore — places, systems, cultures, histories',
        format: 'article',
        recommended: ['worldbuilding-first', 'mind-map', 'relationship-map', 'timeline-chronology', 'skeletal-outline'],
        finderWhy: "Lore with a built-in guard against worldbuilder's disease.",
    },
    {
        id: 'article-essay',
        label: 'Article / Essay',
        icon: '📰',
        desc: 'Nonfiction, memoir, longform',
        format: 'article',
        recommended: ['narrative-nonfiction', 'story-spine', 'reverse-outline', 'skeletal-outline'],
    },
    {
        id: 'game-ttrpg',
        label: 'Game / TTRPG',
        icon: '🎲',
        desc: 'Interactive fiction, campaigns, scenarios',
        format: 'game',
        recommended: ['five-room-dungeon', 'interactive-fiction', 'progress-clocks', 'three-clue-rule'],
    },
];

export function getDraftType(id: string): DraftType | undefined {
    return DRAFT_TYPES.find(t => t.id === id);
}
