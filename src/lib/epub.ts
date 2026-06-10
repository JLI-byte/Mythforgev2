/**
 * epub.ts — EPUB 3 export.
 *
 * Builds a spec-valid EPUB (a ZIP with an uncompressed `mimetype` first entry,
 * a container manifest, an OPF package, an XHTML nav, and one XHTML file per
 * scene). Self-publishers can open the result directly in Calibre / Apple Books.
 */
import JSZip from 'jszip';
import type { Document as MFDocument, Scene } from '@/store/workspaceStore';
import { sanitizeHtml, escapeHtml } from '@/lib/sanitize';

export interface EpubOptions {
    title: string;
    author?: string;
    /** Stable identifier; a random UUID is generated when omitted. */
    identifier?: string;
}

/** Convert (already sanitized) HTML into XML-well-formed XHTML body content. */
function toXhtml(bodyHtml: string): string {
    if (typeof window === 'undefined' || typeof XMLSerializer === 'undefined') {
        return escapeHtml(bodyHtml);
    }
    const doc = new DOMParser().parseFromString(`<body>${bodyHtml}</body>`, 'text/html');
    const serialized = new XMLSerializer().serializeToString(doc.body);
    return serialized.replace(/^<body[^>]*>/, '').replace(/<\/body>\s*$/, '');
}

function chapterXhtml(title: string, bodyHtml: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <section epub:type="chapter" xmlns:epub="http://www.idpf.org/2007/ops">
    <h1>${escapeHtml(title)}</h1>
    ${toXhtml(bodyHtml) || '<p></p>'}
  </section>
</body>
</html>`;
}

/**
 * Builds the EPUB as a JSZip instance (so tests can read entries directly
 * without depending on Blob support in the test environment).
 */
export async function buildEpubZip(
    document: MFDocument,
    scenes: Scene[],
    opts: EpubOptions
): Promise<JSZip> {
    const zip = new JSZip();
    const identifier = opts.identifier
        || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'mythforge-export');
    const title = opts.title || document.title || 'Untitled';
    const author = opts.author || 'Unknown Author';

    // 1. mimetype — MUST be the first entry and stored (uncompressed).
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // 2. Container pointing at the OPF package.
    zip.folder('META-INF')!.file('container.xml', `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

    const oebps = zip.folder('OEBPS')!;
    oebps.file('style.css',
        'body{font-family:Georgia,serif;line-height:1.6;margin:5%;}h1{font-size:1.4em;margin:1em 0;}');

    const ordered = [...scenes].sort((a, b) => a.order - b.order);
    const chapters = ordered.map((scene, i) => ({
        id: `chapter-${i + 1}`,
        href: `chapter-${i + 1}.xhtml`,
        title: scene.title || `Chapter ${i + 1}`,
        html: sanitizeHtml(scene.content || ''),
    }));
    // Guard against an empty manuscript producing a spine-less (invalid) EPUB.
    if (chapters.length === 0) {
        chapters.push({ id: 'chapter-1', href: 'chapter-1.xhtml', title, html: '' });
    }

    for (const ch of chapters) {
        oebps.file(ch.href, chapterXhtml(ch.title, ch.html));
    }

    // 3. Navigation document (EPUB 3 toc).
    const navItems = chapters
        .map(ch => `      <li><a href="${ch.href}">${escapeHtml(ch.title)}</a></li>`)
        .join('\n');
    oebps.file('nav.xhtml', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><meta charset="utf-8"/><title>Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`);

    // 4. OPF package: metadata + manifest + spine.
    const manifestItems = chapters
        .map(ch => `    <item id="${ch.id}" href="${ch.href}" media-type="application/xhtml+xml"/>`)
        .join('\n');
    const spineItems = chapters
        .map(ch => `    <itemref idref="${ch.id}"/>`)
        .join('\n');
    const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    oebps.file('content.opf', `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${identifier}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:creator>${escapeHtml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`);

    return zip;
}

/**
 * Builds an EPUB Blob from a document's ordered scenes.
 */
export async function buildEpubBlob(
    document: MFDocument,
    scenes: Scene[],
    opts: EpubOptions
): Promise<Blob> {
    const zip = await buildEpubZip(document, scenes, opts);
    return zip.generateAsync({
        type: 'blob',
        mimeType: 'application/epub+zip',
    });
}

/** Builds the EPUB and triggers a browser download. */
export async function exportAsEpub(
    document: MFDocument,
    scenes: Scene[],
    opts: EpubOptions
): Promise<void> {
    const blob = await buildEpubBlob(document, scenes, opts);
    const slug = (opts.title || document.title || 'book')
        .toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || 'book';
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${slug}.epub`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
