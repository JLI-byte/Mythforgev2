/**
 * Work sub-types — the second question for a Script / Report: what KIND of one?
 * LEAF MODULE (no store, no React).
 *
 * 'Script / Report' covers everything from a YouTube essay to a dissertation,
 * and those want very different research. Asking up front means the research
 * assistant opens already knowing the format, who it's for, and what it has to
 * do — see formatBrief, which is what reaches the model.
 *
 * Only 'script-report' has sub-types today. The other work types go straight to
 * the details step, exactly as before.
 */

/** The three things worth asking about any script or report. */
export type BriefKey = 'audience' | 'length' | 'goal';

export interface BriefField {
    key: BriefKey;
    /** Question shown above the input, worded for this kind of work. */
    label: string;
    placeholder: string;
}

/** What the writer answered. Every field is optional — the brief can be skipped. */
export type ProjectBrief = Partial<Record<BriefKey, string>>;

export interface WorkSubType {
    id: string;
    label: string;
    icon: string;
    desc: string;
    /** Draft Table type id, so the method library suits this kind of work. */
    draftTypeId: string;
    fields: BriefField[];
}

/** Neutral wording for the model — the UI labels are questions, which read oddly in a prompt. */
const PROMPT_LABELS: Record<BriefKey, string> = {
    audience: 'Audience',
    length: 'Target length',
    goal: 'Goal',
};

export const WORK_SUB_TYPES: WorkSubType[] = [
    {
        id: 'video-script',
        label: 'YouTube / Video Script',
        icon: '▶️',
        desc: 'Video essays, explainers, narrative video',
        draftTypeId: 'youtube-script',
        fields: [
            { key: 'audience', label: "Who's watching?", placeholder: 'e.g. beginners to home espresso' },
            { key: 'length', label: 'How long?', placeholder: 'e.g. 8–10 minutes' },
            { key: 'goal', label: 'What should it do?', placeholder: 'e.g. convince them to skip the pod machine' },
        ],
    },
    {
        id: 'academic-report',
        label: 'Academic / School Report',
        icon: '🎓',
        desc: 'Essays, coursework, dissertations',
        draftTypeId: 'article-essay',
        fields: [
            { key: 'audience', label: "Who's marking it?", placeholder: 'e.g. A-level history, AQA board' },
            { key: 'length', label: 'How long, and what style?', placeholder: 'e.g. 2,500 words, Harvard referencing' },
            { key: 'goal', label: "What's the question?", placeholder: 'e.g. why did the Weimar Republic fail?' },
        ],
    },
    {
        id: 'business-report',
        label: 'Business Report',
        icon: '💼',
        desc: 'Proposals, briefs, analyses',
        draftTypeId: 'article-essay',
        fields: [
            { key: 'audience', label: "Who's reading it?", placeholder: 'e.g. the board, non-technical' },
            { key: 'length', label: 'How long?', placeholder: 'e.g. 6 pages plus an exec summary' },
            { key: 'goal', label: 'What decision should it drive?', placeholder: 'e.g. approve the Q3 hiring plan' },
        ],
    },
    {
        id: 'article-blog',
        label: 'Article / Blog Post',
        icon: '📰',
        desc: 'Journalism, longform, opinion',
        draftTypeId: 'article-essay',
        fields: [
            { key: 'audience', label: "Who's reading it?", placeholder: 'e.g. indie devs shipping their first game' },
            { key: 'length', label: 'How long?', placeholder: 'e.g. 1,200 words' },
            { key: 'goal', label: "What's the takeaway?", placeholder: 'e.g. ship earlier than feels comfortable' },
        ],
    },
    {
        id: 'technical-doc',
        label: 'Technical Guide / Docs',
        icon: '📘',
        desc: 'Guides, manuals, how-tos',
        draftTypeId: 'article-essay',
        fields: [
            { key: 'audience', label: "Who's following it?", placeholder: 'e.g. developers new to the API' },
            { key: 'length', label: 'How long?', placeholder: 'e.g. a 10-step quickstart' },
            { key: 'goal', label: 'What should they manage?', placeholder: 'e.g. a first request working in 5 minutes' },
        ],
    },
    {
        id: 'speech',
        label: 'Speech / Presentation',
        icon: '🎙️',
        desc: 'Talks, keynotes, pitches',
        draftTypeId: 'article-essay',
        fields: [
            { key: 'audience', label: "Who's in the room?", placeholder: 'e.g. 200 teachers at a conference' },
            { key: 'length', label: 'How long?', placeholder: 'e.g. a 20-minute slot' },
            { key: 'goal', label: 'What should they leave with?', placeholder: "e.g. one habit they'll try on Monday" },
        ],
    },
];

/** Work type ids that ask a second question. Everything else skips the step. */
export function getSubTypesFor(workTypeId: string | null | undefined): WorkSubType[] {
    return workTypeId === 'script-report' ? WORK_SUB_TYPES : [];
}

export function getWorkSubType(id: string | null | undefined): WorkSubType | undefined {
    return WORK_SUB_TYPES.find(t => t.id === id);
}

/**
 * The brief as the research assistant sees it. Empty string when there's no
 * sub-type, so callers can drop it from the prompt entirely rather than send a
 * header with nothing under it.
 */
export function formatBrief(
    subTypeId: string | null | undefined,
    brief: ProjectBrief | null | undefined,
): string {
    const subType = getWorkSubType(subTypeId);
    if (!subType) return '';

    const answered = subType.fields
        .map(f => {
            const value = brief?.[f.key]?.trim();
            return value ? `${PROMPT_LABELS[f.key]}: ${value}` : '';
        })
        .filter(Boolean);

    return [
        `THIS PROJECT is a ${subType.label} — ${subType.desc.toLowerCase()}.`,
        ...answered,
        'Tailor research, suggestions and structure to this format.',
    ].join('\n');
}
