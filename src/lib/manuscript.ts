/**
 * Manuscript assembly — LEAF MODULE (no store or React import).
 *
 * A LoreCanvas book is a project holding Documents (chapters), each holding
 * ordered Scenes (sections). Every exporter needs the same three answers:
 * which chapters are in, what order they run in, and what pages sit in front
 * of chapter one. This module answers all three and hands back one plain
 * `Manuscript` value, so Markdown, DOCX and EPUB agree by construction rather
 * than by three separate derivations that drift.
 *
 * Structural shapes are declared here rather than imported from the store, so
 * the arithmetic stays testable and the module stays leaf-level.
 */

/** The structural shape of a store Document. */
export interface ChapterLike {
    id: string;
    projectId: string;
    title: string;
    createdAt: Date | string | number;
}

/** The structural shape of a store Scene. */
export interface SectionLike {
    id: string;
    documentId: string;
    title: string;
    content: string;
    order: number;
}

export interface ManuscriptSection {
    id: string;
    title: string;
    /** The writer's own HTML. Sanitised by whichever exporter emits markup. */
    html: string;
}

export interface ManuscriptChapter {
    id: string;
    title: string;
    sections: ManuscriptSection[];
}

export interface ManuscriptMeta {
    title: string;
    author?: string;
}

export interface Manuscript {
    title: string;
    author: string;
    chapters: ManuscriptChapter[];
}

export interface AssembleOptions {
    /** When given, only these chapter ids are compiled — still in book order. */
    includedChapterIds?: string[] | null;
}

/** ms since epoch for a createdAt that may have come back from JSON as a string. */
function createdMs(value: Date | string | number): number {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/**
 * Chapters in reading order.
 *
 * A story Document carries no `order` — the field on it is documented "Visual
 * novel projects only" — so creation time is the order, the same rule the
 * binder spine already uses. Ties break on id so two exports of one book never
 * disagree about which chapter came first.
 */
export function orderChapters(documents: ChapterLike[], projectId: string): ChapterLike[] {
    return documents
        .filter(d => d.projectId === projectId)
        .slice()
        .sort((a, b) =>
            createdMs(a.createdAt) - createdMs(b.createdAt)
            || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The sections of one chapter, in order. */
export function orderSections(sections: SectionLike[], documentId: string): SectionLike[] {
    return sections
        .filter(s => s.documentId === documentId)
        .slice()
        .sort((a, b) => a.order - b.order);
}

/** The whole book: every included chapter, each with its ordered sections. */
export function assembleManuscript(
    meta: ManuscriptMeta,
    documents: ChapterLike[],
    sections: SectionLike[],
    projectId: string,
    options: AssembleOptions = {},
): Manuscript {
    const included = options.includedChapterIds ? new Set(options.includedChapterIds) : null;

    const chapters: ManuscriptChapter[] = orderChapters(documents, projectId)
        .filter(d => !included || included.has(d.id))
        .map(d => ({
            id: d.id,
            title: d.title || 'Untitled Chapter',
            sections: orderSections(sections, d.id).map(s => ({
                id: s.id,
                title: s.title || 'Untitled',
                html: s.content || '',
            })),
        }));

    return {
        title: meta.title || 'Untitled',
        author: meta.author?.trim() || '',
        chapters,
    };
}
