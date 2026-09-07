import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { buildManuscriptDocxDocument } from './export';
import { assembleManuscript, type ChapterLike, type SectionLike } from './manuscript';

const docs: ChapterLike[] = [
    { id: 'a', projectId: 'p1', title: 'Chapter One', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', projectId: 'p1', title: 'Chapter Two', createdAt: '2026-02-01T00:00:00Z' },
];
const bare = { titlePage: false, contents: false };

const book = (sections: SectionLike[], frontMatter: Record<string, unknown> = bare) =>
    assembleManuscript({ title: 'My Book', author: 'Jane Roe' }, docs, sections, 'p1', { frontMatter });

async function docXml(m: Parameters<typeof buildManuscriptDocxDocument>[0]) {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(await buildManuscriptDocxDocument(m)));
    return zip.file('word/document.xml')!.async('string');
}

describe('buildManuscriptDocxDocument', () => {
    it('produces an OOXML package Word can open', async () => {
        const built = await buildManuscriptDocxDocument(book([
            { id: 's1', documentId: 'a', title: 'Opening', order: 0, content: '<p>Hello <strong>world</strong></p>' },
        ]));
        const zip = await JSZip.loadAsync(await Packer.toBuffer(built));

        // Word refuses to open a .docx missing any of these.
        expect(zip.file('[Content_Types].xml')).not.toBeNull();
        expect(zip.file('_rels/.rels')).not.toBeNull();
        expect(zip.file('word/document.xml')).not.toBeNull();
    });

    it('carries every chapter, its sections and the prose, in book order', async () => {
        const xml = await docXml(book([
            { id: 's2', documentId: 'a', title: 'Closing', order: 1, content: '<p>beta</p>' },
            { id: 's1', documentId: 'a', title: 'Opening', order: 0, content: '<p>alpha</p>' },
            { id: 's3', documentId: 'b', title: 'Only', order: 0, content: '<p>gamma</p>' },
        ]));

        expect(xml).toContain('Chapter One');
        expect(xml).toContain('Chapter Two');
        expect(xml).toContain('Opening');
        expect(xml).toContain('alpha');
        expect(xml).toContain('gamma');
        // Sections emit in `order`, chapters in book order.
        expect(xml.indexOf('alpha')).toBeLessThan(xml.indexOf('beta'));
        expect(xml.indexOf('Chapter One')).toBeLessThan(xml.indexOf('Chapter Two'));
    });

    it('puts the front matter ahead of chapter one', async () => {
        const xml = await docXml(book(
            [{ id: 's1', documentId: 'a', title: 'Opening', order: 0, content: '<p>alpha</p>' }],
            { dedication: 'For Ada' },
        ));
        expect(xml.indexOf('My Book')).toBeLessThan(xml.indexOf('Chapter One'));
        expect(xml.indexOf('Dedication')).toBeLessThan(xml.indexOf('Chapter One'));
    });

    it('does not leak entity markup into the manuscript', async () => {
        const xml = await docXml(book([
            { id: 's1', documentId: 'a', title: 'Ch', order: 0, content: '<p>Meet <span class="entity-tag" data-id="e1">Mira</span> here</p>' },
        ]));
        expect(xml).toContain('Mira');
        expect(xml).not.toContain('entity-tag');
    });
});
