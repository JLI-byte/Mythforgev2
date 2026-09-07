import { describe, it, expect } from 'vitest';
import { buildManuscriptMarkdown } from './export';
import { assembleManuscript, type ChapterLike, type SectionLike } from './manuscript';

const docs: ChapterLike[] = [
    { id: 'a', projectId: 'p1', title: 'Chapter One', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', projectId: 'p1', title: 'Chapter Two', createdAt: '2026-02-01T00:00:00Z' },
];
const scenes: SectionLike[] = [
    { id: 's1', documentId: 'a', title: 'Opening', order: 0, content: '<p>The <strong>first</strong> line.</p>' },
    { id: 's2', documentId: 'a', title: 'Closing', order: 1, content: '<p>The last line.</p>' },
    { id: 's3', documentId: 'b', title: 'Only', order: 0, content: '<p>Elsewhere.</p>' },
];

const bare = { titlePage: false, contents: false };

describe('buildManuscriptMarkdown', () => {
    it('writes every chapter into one document', () => {
        const md = buildManuscriptMarkdown(
            assembleManuscript({ title: 'My Book' }, docs, scenes, 'p1', { frontMatter: bare }));
        expect(md).toContain('# Chapter One');
        expect(md).toContain('# Chapter Two');
        expect(md).toContain('## Opening');
        expect(md).toContain('## Closing');
        expect(md).toContain('## Only');
    });

    it('keeps the chapters in book order', () => {
        const md = buildManuscriptMarkdown(
            assembleManuscript({ title: 'My Book' }, docs, scenes, 'p1', { frontMatter: bare }));
        expect(md.indexOf('# Chapter One')).toBeLessThan(md.indexOf('# Chapter Two'));
    });

    it('puts the front matter in front of chapter one', () => {
        const md = buildManuscriptMarkdown(assembleManuscript(
            { title: 'My Book', author: 'Jane Roe' }, docs, scenes, 'p1',
            { frontMatter: { dedication: 'For Ada' } }));
        expect(md.indexOf('# My Book')).toBe(0);
        expect(md).toContain('Jane Roe');
        expect(md.indexOf('# Dedication')).toBeLessThan(md.indexOf('# Chapter One'));
        expect(md.indexOf('# Contents')).toBeLessThan(md.indexOf('# Chapter One'));
    });

    it('converts the writer inline formatting rather than emitting tags', () => {
        const md = buildManuscriptMarkdown(
            assembleManuscript({ title: 'X' }, docs, scenes, 'p1', { frontMatter: bare }));
        expect(md).toContain('**first**');
        expect(md).not.toContain('<strong>');
        expect(md).not.toContain('<p>');
    });
});
