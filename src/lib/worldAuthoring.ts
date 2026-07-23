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

/**
 * Build the `articleDoc` string: a single "Main" grid tab whose widgets stack
 * vertically — a heading (when present) then a text block per section.
 */
export function buildArticleDoc(sections: ArticleSection[]): string {
    const LEFT = 40;
    const HEAD_W = 580, HEAD_H = 80;
    const TEXT_W = 560;
    const widgets: DocWidget[] = [];
    let y = 40;

    for (const section of sections) {
        if (section.heading && section.heading.trim()) {
            widgets.push({
                id: crypto.randomUUID(),
                type: 'heading',
                x: LEFT,
                y,
                width: HEAD_W,
                height: HEAD_H,
                content: { text: section.heading.trim(), level: 2 },
            });
            y += HEAD_H + 12;
        }
        const html = bodyToHtml(section.body ?? '');
        const paragraphs = (section.body ?? '').split(/\n{2,}/).filter(p => p.trim()).length || 1;
        const height = Math.max(120, paragraphs * 90);
        widgets.push({
            id: crypto.randomUUID(),
            type: 'text',
            x: LEFT,
            y,
            width: TEXT_W,
            height,
            content: { html },
        });
        y += height + 28;
    }

    const tab: DocTab = { id: crypto.randomUUID(), name: 'Main', widgets };
    return JSON.stringify([tab]);
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

/**
 * A compact plain-text outline of the world's folders (nested) and the
 * articles filed in each — fed to the assistant so it can file sensibly,
 * avoid duplicates, and reorganize.
 */
export function serializeWorld(
    roots: ReadonlyArray<WorldBibleRootConfig>,
    entities: ReadonlyArray<Pick<Entity, 'name' | 'type' | 'categoryId'>>,
): string {
    const lines: string[] = [];
    const folderIds = new Set(roots.map(r => r.id));
    const childrenOf = (parentId: string | undefined) =>
        roots.filter(r => r.parentId === parentId);

    const articlesIn = (folderId: string) =>
        entities.filter(e => e.categoryId === folderId);

    const walk = (parentId: string | undefined, depth: number) => {
        for (const folder of childrenOf(parentId)) {
            lines.push(`${'  '.repeat(depth)}- ${folder.icon} ${folder.label}`);
            for (const a of articlesIn(folder.id)) {
                lines.push(`${'  '.repeat(depth + 1)}• ${a.name} (${a.type})`);
            }
            walk(folder.id, depth + 1);
        }
    };
    walk(undefined, 0);

    const unfiled = entities.filter(e => !e.categoryId || !folderIds.has(e.categoryId));
    if (unfiled.length) {
        lines.push('- (unfiled)');
        for (const a of unfiled) lines.push(`  • ${a.name} (${a.type})`);
    }

    return lines.length ? lines.join('\n') : '(this world has no folders or articles yet)';
}
