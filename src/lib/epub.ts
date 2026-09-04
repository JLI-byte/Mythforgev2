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
import type { Manuscript } from '@/lib/manuscript';

export interface EpubOptions {
    /** Overrides the manuscript's own title on the cover and in the metadata. */
    title?: string;
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

const NEWLINE_INDENT = String.fromCharCode(10) + '    ';

function pageXhtml(title: string, bodyHtml: string, epubType: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <section epub:type="${epubType}" xmlns:epub="http://www.idpf.org/2007/ops">
    <h1>${escapeHtml(title)}</h1>
    ${bodyHtml || '<p></p>'}
  </section>
</body>
</html>`;
}

/** A chapter's sections as one XHTML body: an h2 per section, then its prose. */
function chapterBody(sections: { title: string; html: string }[]): string {
    return sections
        .map(s => `<h2>${escapeHtml(s.title)}</h2>` + NEWLINE_INDENT + `${toXhtml(sanitizeHtml(s.html || ''))}`)
        .join(NEWLINE_INDENT);
}

/** Front-matter page ids map to the EPUB structural semantics vocabulary. */
const FRONT_EPUB_TYPES: Record<string, string> = {
    'front-title': 'titlepage',
    'front-copyright': 'copyright-page',
    'front-dedication': 'dedication',
    'front-contents': 'frontmatter',
};

const NL_CONST = String.fromCharCode(10);

const CONTAINER_XML = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
    '  <rootfiles>',
    '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>',
    '  </rootfiles>',
    '</container>',
].join(NL_CONST);

function navDocument(navItems: string): string {
    return [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<!DOCTYPE html>',
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">',
        '<head><meta charset="utf-8"/><title>Contents</title></head>',
        '<body>',
        '  <nav epub:type="toc" id="toc">',
        '    <h1>Contents</h1>',
        '    <ol>',
        navItems,
        '    </ol>',
        '  </nav>',
        '</body>',
        '</html>',
    ].join(NL_CONST);
}

interface OpfParts {
    identifier: string;
    title: string;
    author: string;
    modified: string;
    manifestItems: string;
    spineItems: string;
}

function opfPackage(p: OpfParts): string {
    return [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">',
        '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
        `    <dc:identifier id="bookid">urn:uuid:${p.identifier}</dc:identifier>`,
        `    <dc:title>${escapeHtml(p.title)}</dc:title>`,
        `    <dc:creator>${escapeHtml(p.author)}</dc:creator>`,
        '    <dc:language>en</dc:language>',
        `    <meta property="dcterms:modified">${p.modified}</meta>`,
        '  </metadata>',
        '  <manifest>',
        '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '    <item id="style" href="style.css" media-type="text/css"/>',
        p.manifestItems,
        '  </manifest>',
        '  <spine>',
        p.spineItems,
        '  </spine>',
        '</package>',
    ].join(NL_CONST);
}

/**
 * Builds the manuscript as a JSZip instance (so tests can read entries directly
 * without depending on Blob support in the test environment).
 *
 * One EPUB chapter per LoreCanvas chapter, its scenes as h2 sections inside —
 * a reader's chapter list should match the writer's, not their scene list.
 */
export async function buildManuscriptEpubZip(
    manuscript: Manuscript,
    opts: EpubOptions = {},
): Promise<JSZip> {
    const zip = new JSZip();
    const identifier = opts.identifier
        || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'lorecanvas-export');
    const title = opts.title || manuscript.title || 'Untitled';
    const author = opts.author || manuscript.author || 'Unknown Author';

    // 1. mimetype — MUST be the first entry and stored (uncompressed).
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // 2. Container pointing at the OPF package.
    zip.folder('META-INF')!.file('container.xml', CONTAINER_XML);

    const oebps = zip.folder('OEBPS')!;
    oebps.file('style.css',
        'body{font-family:Georgia,serif;line-height:1.6;margin:5%;}'
        + 'h1{font-size:1.4em;margin:1em 0;}h2{font-size:1.1em;margin:1.5em 0 0.5em;}');

    // 3. Front matter, then chapters. Both become ordinary spine entries.
    const entries: { id: string; href: string; title: string; xhtml: string; inNav: boolean }[] = [];

    manuscript.pages.forEach((page, i) => {
        const id = `front-${i + 1}`;
        entries.push({
            id,
            href: `${id}.xhtml`,
            title: page.title,
            xhtml: pageXhtml(page.title, page.html, FRONT_EPUB_TYPES[page.id] ?? 'frontmatter'),
            inNav: false,
        });
    });

    manuscript.chapters.forEach((chapter, i) => {
        const id = `chapter-${i + 1}`;
        entries.push({
            id,
            href: `${id}.xhtml`,
            title: chapter.title,
            xhtml: pageXhtml(chapter.title, chapterBody(chapter.sections), 'chapter'),
            inNav: true,
        });
    });

    // Guard against an empty manuscript producing a spine-less (invalid) EPUB.
    if (entries.length === 0) {
        entries.push({
            id: 'chapter-1',
            href: 'chapter-1.xhtml',
            title,
            xhtml: pageXhtml(title, '', 'chapter'),
            inNav: true,
        });
    }

    for (const entry of entries) {
        oebps.file(entry.href, entry.xhtml);
    }

    // 4. Navigation document (EPUB 3 toc) — chapters, as a reader expects.
    const navSource = entries.filter(e => e.inNav);
    const navItems = (navSource.length > 0 ? navSource : entries)
        .map(e => `      <li><a href="${e.href}">${escapeHtml(e.title)}</a></li>`)
        .join(NL_CONST);
    oebps.file('nav.xhtml', navDocument(navItems));

    // 5. OPF package: metadata + manifest + spine.
    const manifestItems = entries
        .map(e => `    <item id="${e.id}" href="${e.href}" media-type="application/xhtml+xml"/>`)
        .join(NL_CONST);
    const spineItems = entries
        .map(e => `    <itemref idref="${e.id}"/>`)
        .join(NL_CONST);
    const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    oebps.file('content.opf', opfPackage({
        identifier, title, author, modified, manifestItems, spineItems,
    }));

    return zip;
}

/** Builds an EPUB Blob from a compiled manuscript. */
export async function buildManuscriptEpubBlob(
    manuscript: Manuscript,
    opts: EpubOptions = {},
): Promise<Blob> {
    const zip = await buildManuscriptEpubZip(manuscript, opts);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

/** Builds the EPUB and triggers a browser download. */
export async function exportManuscriptAsEpub(
    manuscript: Manuscript,
    opts: EpubOptions = {},
): Promise<void> {
    const blob = await buildManuscriptEpubBlob(manuscript, opts);
    const slug = (opts.title || manuscript.title || 'book')
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
