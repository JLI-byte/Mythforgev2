import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildEpubZip } from './epub';
import type { Document as MFDocument, Scene } from '@/store/workspaceStore';

const doc: MFDocument = {
    id: 'd1', projectId: 'p1', title: 'My Book', content: '', createdAt: new Date(),
};

function scene(id: string, title: string, order: number, content: string): Scene {
    return { id, documentId: 'd1', projectId: 'p1', title, content, order, createdAt: new Date() };
}

describe('buildEpubZip', () => {
    it('produces a valid EPUB container structure', async () => {
        const zip = await buildEpubZip(doc, [
            scene('s1', 'Chapter One', 0, '<p>Hello world</p>'),
            scene('s2', 'Chapter Two', 1, '<p>More text</p>'),
        ], { title: 'My Book', author: 'Jane', identifier: 'fixed-id' });

        expect(zip.file('mimetype')).not.toBeNull();
        expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip');
        expect(zip.file('META-INF/container.xml')).not.toBeNull();
        expect(zip.file('OEBPS/content.opf')).not.toBeNull();
        expect(zip.file('OEBPS/nav.xhtml')).not.toBeNull();
        expect(zip.file('OEBPS/chapter-1.xhtml')).not.toBeNull();
        expect(zip.file('OEBPS/chapter-2.xhtml')).not.toBeNull();
    });

    it('orders chapters by scene order and includes content', async () => {
        const zip = await buildEpubZip(doc, [
            scene('s2', 'Second', 1, '<p>beta</p>'),
            scene('s1', 'First', 0, '<p>alpha</p>'),
        ], { title: 'My Book', identifier: 'fixed-id' });

        const ch1 = await zip.file('OEBPS/chapter-1.xhtml')!.async('string');
        expect(ch1).toContain('First');
        expect(ch1).toContain('alpha');
    });

    it('sanitizes scene HTML in the output', async () => {
        const zip = await buildEpubZip(doc, [
            scene('s1', 'Ch', 0, '<p>ok</p><script>alert(1)</script>'),
        ], { title: 'X', identifier: 'fixed-id' });

        const ch1 = await zip.file('OEBPS/chapter-1.xhtml')!.async('string');
        expect(ch1).not.toContain('<script>');
        expect(ch1).not.toContain('alert(1)');
    });

    it('still produces a spine for an empty manuscript', async () => {
        const zip = await buildEpubZip(doc, [], { title: 'Empty', identifier: 'fixed-id' });
        const opf = await zip.file('OEBPS/content.opf')!.async('string');
        expect(opf).toContain('<itemref');
    });
});

describe('the EPUB binary', () => {
    it('puts mimetype first and stores it uncompressed', async () => {
        const zip = await buildEpubZip(doc, [scene('s1', 'One', 0, '<p>a</p>')],
            { title: 'My Book', identifier: 'fixed-id' });
        const bytes = await zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
        const head = new TextDecoder('latin1').decode(bytes.subarray(0, 38));

        // EPUB 3 §4.1.2: the first entry must be `mimetype`, stored, unencrypted.
        // Reading it out of the local file header is what epubcheck does.
        // ZIP local file header signature is the four bytes PK.
        expect(head.slice(0, 4)).toBe('PK');
        expect(bytes[8]).toBe(0);   // compression method, low byte  — 0 = stored
        expect(bytes[9]).toBe(0);   // compression method, high byte
        expect(head.slice(30, 38)).toBe('mimetype');
    });

    it('has a spine where every itemref resolves to a file in the archive', async () => {
        const zip = await buildEpubZip(doc, [
            scene('s1', 'One', 0, '<p>a</p>'),
            scene('s2', 'Two', 1, '<p>b</p>'),
        ], { title: 'My Book', identifier: 'fixed-id' });
        const reread = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
        const opf = await reread.file('OEBPS/content.opf')!.async('string');

        const hrefById = new Map<string, string>();
        for (const m of opf.matchAll(/<item id="([^"]+)" href="([^"]+)"/g)) hrefById.set(m[1], m[2]);
        const idrefs = [...opf.matchAll(/<itemref idref="([^"]+)"\/>/g)].map(m => m[1]);

        expect(idrefs.length).toBe(2);
        for (const id of idrefs) {
            const href = hrefById.get(id);
            expect(href, `spine references unknown manifest id ${id}`).toBeTruthy();
            expect(reread.file(`OEBPS/${href}`), `missing OEBPS/${href}`).not.toBeNull();
        }
    });
});
