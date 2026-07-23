/**
 * World-authoring helpers for the AI research chat: turn simple AI-provided
 * structures into the exact shapes the World Bible store and article renderer
 * expect. Pure module — no store/React imports beyond types.
 *
 * The article body (`articleDoc`) is NOT raw HTML despite the field name — the
 * live renderer parses it as a JSON array of grid "tabs", each holding
 * positioned widgets. buildArticleDoc() produces that exact shape (mirrors the
 * seed-data builders) so an AI-authored article actually displays.
 */
import type { Entity, EntityType, WorldBibleRootConfig } from '@/store/workspaceStore';
import { fileByType } from '@/lib/folderTree';

// ── Article body (grid-tab JSON) ─────────────────────────────

interface DocWidget {
    id: string;
    type: 'heading' | 'text';
    x: number;
    y: number;
    width: number;
    height: number;
    content: Record<string, unknown>;
}
interface DocTab {
    id: string;
    name: string;
    widgets: DocWidget[];
}

export interface ArticleSection {
    heading?: string;
    body: string;
}

/** Escape text for safe insertion into the text widget's HTML content. */
export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Plain prose (blank-line-separated paragraphs) → escaped <p> HTML. */
export function bodyToHtml(body: string): string {
    return body
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
}

const DOC_LEFT = 40;
const DOC_HEAD_W = 580, DOC_HEAD_H = 80;
const DOC_TEXT_W = 560;

/** Loose shapes for parsing/mutating an existing articleDoc (whose widgets may
 *  be any grid type, not just heading/text). */
interface AnyDocWidget { id: string; type: string; x: number; y: number; width: number; height: number; content: Record<string, unknown>; }
interface AnyDocTab { id: string; name: string; widgets: AnyDocWidget[]; }

/** Build heading + text widgets for the given sections, stacked from startY. */
function buildSectionWidgets(sections: ArticleSection[], startY: number): DocWidget[] {
    const widgets: DocWidget[] = [];
    let y = startY;
    for (const section of sections) {
        if (section.heading && section.heading.trim()) {
            widgets.push({
                id: crypto.randomUUID(), type: 'heading', x: DOC_LEFT, y,
                width: DOC_HEAD_W, height: DOC_HEAD_H,
                content: { text: section.heading.trim(), level: 2 },
            });
            y += DOC_HEAD_H + 12;
        }
        const paragraphs = (section.body ?? '').split(/\n{2,}/).filter(p => p.trim()).length || 1;
        const height = Math.max(120, paragraphs * 90);
        widgets.push({
            id: crypto.randomUUID(), type: 'text', x: DOC_LEFT, y,
            width: DOC_TEXT_W, height,
            content: { html: bodyToHtml(section.body ?? '') },
        });
        y += height + 28;
    }
    return widgets;
}

/**
 * Build the `articleDoc` string: a single "Main" grid tab whose widgets stack
 * vertically — a heading (when present) then a text block per section.
 */
export function buildArticleDoc(sections: ArticleSection[]): string {
    const tab: DocTab = { id: crypto.randomUUID(), name: 'Main', widgets: buildSectionWidgets(sections, 40) };
    return JSON.stringify([tab]);
}

/** Parse an existing articleDoc into tabs, tolerating malformed/empty input. */
function parseDocTabs(raw: string | undefined): AnyDocTab[] | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length && typeof parsed[0]?.name === 'string' && Array.isArray(parsed[0]?.widgets)) {
            return parsed as AnyDocTab[];
        }
    } catch {
        /* fall through */
    }
    return null;
}

/**
 * Append sections below the existing content of an article's first tab. Falls
 * back to a fresh doc when the input can't be parsed.
 */
export function appendSectionsToDoc(existingDoc: string | undefined, sections: ArticleSection[]): string {
    const tabs = parseDocTabs(existingDoc);
    if (!tabs) return buildArticleDoc(sections);
    const first = tabs[0];
    const bottom = (first.widgets ?? []).reduce((max, w) => Math.max(max, (w.y ?? 0) + (w.height ?? 0)), 0);
    first.widgets = [...(first.widgets ?? []), ...buildSectionWidgets(sections, bottom ? bottom + 28 : 40)];
    return JSON.stringify(tabs);
}

/** Extract readable plain text from an articleDoc, for showing the assistant. */
export function articleDocToText(raw: string | undefined): string {
    const tabs = parseDocTabs(raw);
    if (!tabs) return '';
    const lines: string[] = [];
    for (const tab of tabs) {
        for (const w of tab.widgets ?? []) {
            if (w.type === 'heading' && typeof w.content?.text === 'string') {
                lines.push(w.content.text.trim());
            } else if (w.type === 'text' && typeof w.content?.html === 'string') {
                const text = w.content.html
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<\/p>/gi, '\n\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();
                if (text) lines.push(text);
            }
        }
    }
    return lines.join('\n').trim();
}

// ── World structure helpers ──────────────────────────────────

/** Find a folder by case-insensitive label match. */
export function resolveFolderIdByName(
    roots: ReadonlyArray<Pick<WorldBibleRootConfig, 'id' | 'label'>>,
    name: string | undefined,
): string | undefined {
    if (!name) return undefined;
    const target = name.trim().toLowerCase();
    return roots.find(r => r.label.trim().toLowerCase() === target)?.id;
}

/**
 * The categoryId to file an article under: an explicitly named folder if it
 * exists, otherwise the default folder for the entity type.
 */
export function resolveCategoryId(
    roots: ReadonlyArray<WorldBibleRootConfig>,
    categoryName: string | undefined,
    type: EntityType,
): string | undefined {
    return resolveFolderIdByName(roots, categoryName) ?? fileByType(roots, type);
}

/** Build a new folder config (freeform membership folder). */
export function makeCategoryRoot(
    name: string,
    icon: string | undefined,
    parentId: string | undefined,
): WorldBibleRootConfig {
    return {
        id: crypto.randomUUID(),
        label: name.trim(),
        icon: icon?.trim() || '📁',
        entityTypes: [],
        parentId,
    };
}

/** Find an article (entity) by case-insensitive name within a candidate list. */
export function findEntityByName(entities: ReadonlyArray<Entity>, name: string): Entity | undefined {
    const target = name.trim().toLowerCase();
    return entities.find(e => e.name.trim().toLowerCase() === target);
}

type WorldArticle = Pick<Entity, 'name' | 'type' | 'categoryId' | 'description' | 'articleDoc'>;

/** First line / clause of a description, for the outline. */
function shortDesc(description: string | undefined): string {
    const d = (description ?? '').trim().split('\n')[0];
    return d.length > 100 ? d.slice(0, 100) + '…' : d;
}

/**
 * Plain-text view of the world for the assistant: a nested folder outline with
 * a one-line description per article, then the full text of each article so it
 * can read, expand, and check consistency.
 */
export function serializeWorld(
    roots: ReadonlyArray<WorldBibleRootConfig>,
    entities: ReadonlyArray<WorldArticle>,
): string {
    const lines: string[] = [];
    const folderIds = new Set(roots.map(r => r.id));
    const childrenOf = (parentId: string | undefined) =>
        roots.filter(r => r.parentId === parentId);
    const articlesIn = (folderId: string) => entities.filter(e => e.categoryId === folderId);
    const outlineArticle = (a: WorldArticle, indent: string) => {
        const desc = shortDesc(a.description);
        lines.push(`${indent}• ${a.name} (${a.type})${desc ? ` — ${desc}` : ''}`);
    };

    const walk = (parentId: string | undefined, depth: number) => {
        for (const folder of childrenOf(parentId)) {
            lines.push(`${'  '.repeat(depth)}- ${folder.icon} ${folder.label}`);
            for (const a of articlesIn(folder.id)) outlineArticle(a, '  '.repeat(depth + 1));
            walk(folder.id, depth + 1);
        }
    };
    walk(undefined, 0);

    const unfiled = entities.filter(e => !e.categoryId || !folderIds.has(e.categoryId));
    if (unfiled.length) {
        lines.push('- (unfiled)');
        for (const a of unfiled) outlineArticle(a, '  ');
    }

    const outline = lines.length ? lines.join('\n') : '(this world has no folders or articles yet)';

    // Full article text, so the assistant can read and revise existing content.
    const details: string[] = [];
    for (const a of entities) {
        const body = articleDocToText(a.articleDoc);
        const desc = (a.description ?? '').trim();
        if (!desc && !body) continue;
        details.push(`### ${a.name} (${a.type})`);
        if (desc) details.push(desc);
        if (body) details.push(body);
        details.push('');
    }

    return details.length ? `${outline}\n\nArticle contents:\n${details.join('\n').trim()}` : outline;
}
