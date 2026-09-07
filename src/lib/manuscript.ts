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

import { escapeHtml } from '@/lib/sanitize';

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

/** What the writer chose on the compile step. Stored on the project. */
export interface FrontMatter {
    titlePage: boolean;
    contents: boolean;
    /** Blank means the page is omitted entirely. */
    copyright: string;
    dedication: string;
}

export const DEFAULT_FRONT_MATTER: FrontMatter = {
    titlePage: true,
    contents: true,
    copyright: '',
    dedication: '',
};

/** A front-matter page. Generated markup only — never the writer's own HTML. */
export interface ManuscriptPage {
    id: string;
    title: string;
    /** Body markup, without the heading: the exporters add that themselves. */
    html: string;
    /** The same body as plain-text lines, for Markdown and DOCX. */
    lines: string[];
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
    pages: ManuscriptPage[];
    chapters: ManuscriptChapter[];
}

export interface AssembleOptions {
    /** When given, only these chapter ids are compiled — still in book order. */
    includedChapterIds?: string[] | null;
    /** The compile step's choices. Defaults are filled in when omitted. */
    frontMatter?: Partial<FrontMatter> | null;
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

/** Fills in anything a project has never set. */
export function resolveFrontMatter(partial?: Partial<FrontMatter> | null): FrontMatter {
    return { ...DEFAULT_FRONT_MATTER, ...(partial ?? {}) };
}

/** Free text to trimmed, non-empty lines. Front-matter text is never rich. */
function textLines(text: string): string[] {
    return text.split(/\n+/).map(line => line.trim()).filter(Boolean);
}

/**
 * The pages that run before chapter one.
 *
 * Each is built from escaped text, so nothing a writer types into the compile
 * step's copyright or dedication field can reach an exporter as markup.
 */
export function buildFrontMatterPages(
    meta: ManuscriptMeta,
    chapters: ManuscriptChapter[],
    fm: FrontMatter,
): ManuscriptPage[] {
    const pages: ManuscriptPage[] = [];
    const title = meta.title || 'Untitled';
    const author = meta.author?.trim() || '';

    if (fm.titlePage) {
        pages.push({
            id: 'front-title',
            title,
            html: author ? `<p>${escapeHtml(author)}</p>` : '',
            lines: author ? [author] : [],
        });
    }

    const copyright = textLines(fm.copyright);
    if (copyright.length > 0) {
        pages.push({
            id: 'front-copyright',
            title: 'Copyright',
            html: copyright.map(l => `<p>${escapeHtml(l)}</p>`).join(''),
            lines: copyright,
        });
    }

    const dedication = textLines(fm.dedication);
    if (dedication.length > 0) {
        pages.push({
            id: 'front-dedication',
            title: 'Dedication',
            html: dedication.map(l => `<p>${escapeHtml(l)}</p>`).join(''),
            lines: dedication,
        });
    }

    if (fm.contents && chapters.length > 0) {
        const titles = chapters.map(c => c.title);
        pages.push({
            id: 'front-contents',
            title: 'Contents',
            html: `<ol>${titles.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ol>`,
            lines: titles,
        });
    }

    return pages;
}

/** Words across every chapter body — what the compile step reports. */
export function manuscriptWordCount(m: Manuscript): number {
    return m.chapters.reduce((total, c) => total + c.sections.reduce(
        (n, s) => n + s.html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length,
        0), 0);
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

    const resolvedTitle = meta.title || 'Untitled';
    return {
        title: resolvedTitle,
        author: meta.author?.trim() || '',
        pages: buildFrontMatterPages(
            { title: resolvedTitle, author: meta.author },
            chapters,
            resolveFrontMatter(options.frontMatter),
        ),
        chapters,
    };
}

/**
 * One chapter on its own — a manuscript of one, with no front matter.
 *
 * "This chapter" and "the whole book" are then the same code path with a
 * different chapter list, so they cannot format differently.
 */
export function assembleChapter(
    meta: ManuscriptMeta,
    document: ChapterLike,
    sections: SectionLike[],
): Manuscript {
    return assembleManuscript(
        { title: document.title || meta.title, author: meta.author },
        [document],
        sections,
        document.projectId,
        {
            frontMatter: { titlePage: false, contents: false, copyright: '', dedication: '' },
            includedChapterIds: [document.id],
        },
    );
}

/**
 * A word-processor block, independent of any library. Keeping the layout
 * decisions — what is a heading, what starts a new page — in a plain value
 * means they can be tested without loading the DOCX writer.
 */
export type DocxBlock =
    | { kind: 'heading1'; text: string; pageBreakBefore: boolean }
    | { kind: 'heading2'; text: string }
    | { kind: 'text'; text: string }
    | { kind: 'body'; html: string };

/** The manuscript as an ordered run of word-processor blocks. */
export function manuscriptDocxOutline(manuscript: Manuscript): DocxBlock[] {
    const blocks: DocxBlock[] = [];
    let started = false;

    manuscript.pages.forEach(page => {
        blocks.push({ kind: 'heading1', text: page.title, pageBreakBefore: started });
        started = true;
        page.lines.forEach(line => blocks.push({ kind: 'text', text: line }));
    });

    manuscript.chapters.forEach(chapter => {
        blocks.push({ kind: 'heading1', text: chapter.title, pageBreakBefore: started });
        started = true;
        chapter.sections.forEach(section => {
            blocks.push({ kind: 'heading2', text: section.title });
            blocks.push({ kind: 'body', html: section.html });
        });
    });

    return blocks;
}
