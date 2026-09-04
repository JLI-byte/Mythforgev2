import { describe, it, expect } from 'vitest';
import { orderChapters, orderSections, assembleManuscript, type ChapterLike, type SectionLike } from './manuscript';

export const chapter = (id: string, title: string, createdAt: string, projectId = 'p1'): ChapterLike =>
    ({ id, projectId, title, createdAt });

export const section = (id: string, documentId: string, title: string, order: number, content: string): SectionLike =>
    ({ id, documentId, title, content, order });

describe('orderChapters', () => {
    it('orders by creation time, which is the only order a story chapter has', () => {
        const docs = [
            chapter('c', 'Third', '2026-03-01T00:00:00Z'),
            chapter('a', 'First', '2026-01-01T00:00:00Z'),
            chapter('b', 'Second', '2026-02-01T00:00:00Z'),
        ];
        expect(orderChapters(docs, 'p1').map(d => d.title)).toEqual(['First', 'Second', 'Third']);
    });

    it('breaks ties on id so two exports of one book agree', () => {
        const docs = [
            chapter('z', 'Zed', '2026-01-01T00:00:00Z'),
            chapter('a', 'Ay', '2026-01-01T00:00:00Z'),
        ];
        expect(orderChapters(docs, 'p1').map(d => d.id)).toEqual(['a', 'z']);
    });

    it('leaves other projects out', () => {
        const docs = [
            chapter('a', 'Mine', '2026-01-01T00:00:00Z'),
            chapter('b', 'Theirs', '2026-01-02T00:00:00Z', 'p2'),
        ];
        expect(orderChapters(docs, 'p1').map(d => d.id)).toEqual(['a']);
    });
});

describe('orderSections', () => {
    it('orders by the order field and ignores other chapters', () => {
        const scenes = [
            section('s2', 'a', 'Two', 1, '<p>two</p>'),
            section('s9', 'b', 'Elsewhere', 0, '<p>nope</p>'),
            section('s1', 'a', 'One', 0, '<p>one</p>'),
        ];
        expect(orderSections(scenes, 'a').map(s => s.title)).toEqual(['One', 'Two']);
    });
});

describe('assembleManuscript', () => {
    const docs = [
        chapter('a', 'Chapter One', '2026-01-01T00:00:00Z'),
        chapter('b', 'Chapter Two', '2026-02-01T00:00:00Z'),
    ];
    const scenes = [
        section('s1', 'a', 'Opening', 0, '<p>alpha</p>'),
        section('s2', 'a', 'Closing', 1, '<p>beta</p>'),
        section('s3', 'b', 'Only', 0, '<p>gamma</p>'),
    ];

    it('carries every chapter, not just one', () => {
        const m = assembleManuscript({ title: 'My Book' }, docs, scenes, 'p1');
        expect(m.chapters.map(c => c.title)).toEqual(['Chapter One', 'Chapter Two']);
        expect(m.chapters[0].sections.map(s => s.html)).toEqual(['<p>alpha</p>', '<p>beta</p>']);
    });

    it('honours an explicit include list', () => {
        const m = assembleManuscript({ title: 'My Book' }, docs, scenes, 'p1', { includedChapterIds: ['b'] });
        expect(m.chapters.map(c => c.id)).toEqual(['b']);
    });

    it('names untitled chapters and sections rather than emitting blanks', () => {
        const m = assembleManuscript(
            { title: '' },
            [chapter('a', '', '2026-01-01T00:00:00Z')],
            [section('s1', 'a', '', 0, '')],
            'p1',
        );
        expect(m.title).toBe('Untitled');
        expect(m.chapters[0].title).toBe('Untitled Chapter');
        expect(m.chapters[0].sections[0].title).toBe('Untitled');
    });
});
