import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { buildDocxDocument } from './export';
import type { Document as MFDocument, Scene } from '@/store/workspaceStore';

const doc: MFDocument = {
    id: 'd1', projectId: 'p1', title: 'My Book', content: '', createdAt: new Date(),
};

function scene(id: string, title: string, order: number, content: string): Scene {
    return { id, documentId: 'd1', projectId: 'p1', title, content, order, createdAt: new Date() };
}

describe('buildDocxDocument', () => {
    it('produces an OOXML package Word can open', async () => {
        const built = await buildDocxDocument(doc, [
            scene('s1', 'Chapter One', 0, '<p>Hello <strong>world</strong></p>'),
        ]);
        const zip = await JSZip.loadAsync(await Packer.toBuffer(built));

        // Word refuses to open a .docx missing either of these.
        expect(zip.file('[Content_Types].xml')).not.toBeNull();
        expect(zip.file('_rels/.rels')).not.toBeNull();
        expect(zip.file('word/document.xml')).not.toBeNull();
    });

    it('carries the title, the scene headings and the prose', async () => {
        const built = await buildDocxDocument(doc, [
            scene('s2', 'Second', 1, '<p>beta</p>'),
            scene('s1', 'First', 0, '<p>alpha</p>'),
        ]);
        const zip = await JSZip.loadAsync(await Packer.toBuffer(built));
        const xml = await zip.file('word/document.xml')!.async('string');

        expect(xml).toContain('My Book');
        expect(xml).toContain('First');
        expect(xml).toContain('alpha');
        expect(xml).toContain('beta');
        // Scenes are emitted in `order`, not array order.
        expect(xml.indexOf('alpha')).toBeLessThan(xml.indexOf('beta'));
    });

    it('does not leak entity markup into the manuscript', async () => {
        const built = await buildDocxDocument(doc, [
            scene('s1', 'Ch', 0, '<p>Meet <span class="entity-tag" data-id="e1">Mira</span> here</p>'),
        ]);
        const zip = await JSZip.loadAsync(await Packer.toBuffer(built));
        const xml = await zip.file('word/document.xml')!.async('string');

        expect(xml).toContain('Mira');
        expect(xml).not.toContain('entity-tag');
    });
});
