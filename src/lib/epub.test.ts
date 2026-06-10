import { describe, it, expect } from 'vitest';
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
