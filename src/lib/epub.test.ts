import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildManuscriptEpubZip } from './epub';
import { assembleManuscript, type ChapterLike, type SectionLike } from './manuscript';

const docs: ChapterLike[] = [
    { id: 'a', projectId: 'p1', title: 'Chapter One', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', projectId: 'p1', title: 'Chapter Two', createdAt: '2026-02-01T00:00:00Z' },
];
const scenes: SectionLike[] = [
    { id: 's1', documentId: 'a', title: 'Opening', order: 0, content: '<p>alpha</p>' },
    { id: 's2', documentId: 'a', title: 'Closing', order: 1, content: '<p>beta</p>' },
    { id: 's3', documentId: 'b', title: 'Only', order: 0, content: '<p>gamma</p>' },
];
const bare = { titlePage: false, contents: false };

const book = (frontMatter: Record<string, unknown> = bare) => assembleManuscript(
    { title: 'My Book', author: 'Jane Roe' }, docs, scenes, 'p1', { frontMatter },
);

describe('buildManuscriptEpubZip', () => {
    it('produces a valid EPUB container structure', async () => {
        const zip = await buildManuscriptEpubZip(book(), { identifier: 'fixed-id' });
        expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip');
        expect(zip.file('META-INF/container.xml')).not.toBeNull();
        expect(zip.file('OEBPS/content.opf')).not.toBeNull();
        expect(zip.file('OEBPS/nav.xhtml')).not.toBeNull();
    });

    it('gives each chapter one file, not each scene', async () => {
        const zip = await buildManuscriptEpubZip(book(), { identifier: 'fixed-id' });
        expect(zip.file('OEBPS/chapter-1.xhtml')).not.toBeNull();
        expect(zip.file('OEBPS/chapter-2.xhtml')).not.toBeNull();
        expect(zip.file('OEBPS/chapter-3.xhtml')).toBeNull();

        const ch1 = await zip.file('OEBPS/chapter-1.xhtml')!.async('string');
        expect(ch1).toContain('Chapter One');
        expect(ch1).toContain('Opening');
        expect(ch1).toContain('Closing');
        expect(ch1).toContain('alpha');
        expect(ch1).toContain('beta');
    });

    it('puts the front matter in the spine before chapter one', async () => {
        const zip = await buildManuscriptEpubZip(
            book({ titlePage: true, contents: true, copyright: '', dedication: 'For Ada' }),
            { identifier: 'fixed-id' },
        );
        const opf = await zip.file('OEBPS/content.opf')!.async('string');
        expect(opf.indexOf('idref="front-1"')).toBeLessThan(opf.indexOf('idref="chapter-1"'));
        expect(zip.file('OEBPS/front-1.xhtml')).not.toBeNull();
        const dedication = await zip.file('OEBPS/front-2.xhtml')!.async('string');
        expect(dedication).toContain('For Ada');
    });

    it('lists every chapter in the navigation document', async () => {
        const zip = await buildManuscriptEpubZip(book(), { identifier: 'fixed-id' });
        const nav = await zip.file('OEBPS/nav.xhtml')!.async('string');
        expect(nav).toContain('Chapter One');
        expect(nav).toContain('Chapter Two');
    });

    it('carries the title and author into the package metadata', async () => {
        const zip = await buildManuscriptEpubZip(book(), { identifier: 'fixed-id' });
        const opf = await zip.file('OEBPS/content.opf')!.async('string');
        expect(opf).toContain('<dc:title>My Book</dc:title>');
        expect(opf).toContain('<dc:creator>Jane Roe</dc:creator>');
    });

    it('sanitizes scene HTML in the output', async () => {
        const zip = await buildManuscriptEpubZip(
            assembleManuscript(
                { title: 'X' },
                [docs[0]],
                [{ id: 's1', documentId: 'a', title: 'Ch', order: 0, content: '<p>ok</p><script>alert(1)</script>' }],
                'p1',
                { frontMatter: bare },
            ),
            { identifier: 'fixed-id' },
        );
        const ch1 = await zip.file('OEBPS/chapter-1.xhtml')!.async('string');
        expect(ch1).not.toContain('<script>');
        expect(ch1).not.toContain('alert(1)');
    });

    it('still produces a spine for an empty manuscript', async () => {
        const zip = await buildManuscriptEpubZip(
            assembleManuscript({ title: 'Empty' }, [], [], 'p1', { frontMatter: bare }),
            { identifier: 'fixed-id' },
        );
        const opf = await zip.file('OEBPS/content.opf')!.async('string');
        expect(opf).toContain('<itemref');
    });
});

/**
 * Binary-layout checks, carried over from the single-document exporter and
 * repointed at the manuscript builder. Structure checks above prove the right
 * files exist; these prove a reader will accept the archive itself.
 */
describe('the EPUB binary', () => {
    it('puts mimetype first and stores it uncompressed', async () => {
        const zip = await buildManuscriptEpubZip(book(), { identifier: 'fixed-id' });
        const bytes = await zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
        const head = new TextDecoder('latin1').decode(bytes.subarray(0, 38));

        // EPUB 3 §4.1.2: the first entry must be `mimetype`, stored, unencrypted.
        // Reading it out of the local file header is what epubcheck does.
        // ZIP local file header signature is the four bytes PK\x03\x04.
        expect(head.slice(0, 4)).toBe('PK\x03\x04');
        expect(bytes[8]).toBe(0);   // compression method, low byte  — 0 = stored
        expect(bytes[9]).toBe(0);   // compression method, high byte
        expect(head.slice(30, 38)).toBe('mimetype');
    });

    it('has a spine where every itemref resolves to a file in the archive', async () => {
        const zip = await buildManuscriptEpubZip(
            book({ titlePage: true, contents: true, copyright: '', dedication: 'For Ada' }),
            { identifier: 'fixed-id' },
        );
        const reread = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
        const opf = await reread.file('OEBPS/content.opf')!.async('string');

        const hrefById = new Map<string, string>();
        for (const m of opf.matchAll(/<item id="([^"]+)" href="([^"]+)"/g)) hrefById.set(m[1], m[2]);
        const idrefs = [...opf.matchAll(/<itemref idref="([^"]+)"\/>/g)].map(m => m[1]);

        expect(idrefs.length).toBeGreaterThan(2);
        for (const id of idrefs) {
            const href = hrefById.get(id);
            expect(href, `spine references unknown manifest id ${id}`).toBeTruthy();
            expect(reread.file(`OEBPS/${href}`), `missing OEBPS/${href}`).not.toBeNull();
        }
    });
});
