import { DEFAULT_WORLD_BIBLE_LAYOUT } from '@/lib/worldBibleNav';
import { fileByType } from '@/lib/folderTree';

/**
 * v3 → v4 migration: true folder membership for articles.
 *
 * Pure and idempotent — runs on raw persisted blobs from BOTH hydration
 * paths (via migrateWorkspaceSchema), so it must tolerate anything and
 * never assume it runs once.
 *
 * 1. Worlds that hold entities but have no stored non-empty layout get the
 *    DEFAULT layout materialized (deep copy; its stable ids are per-bible).
 * 2. Entities without categoryId are filed into the first folder of their
 *    world's layout whose entityTypes contains their type. No match → left
 *    Unfiled (no key written). Existing categoryId is never touched.
 */
export function migrateArticleFolders(data: Record<string, any>): Record<string, any> {
    if (!data || typeof data !== 'object') return data;

    const entities: any[] = Array.isArray(data.entities) ? data.entities : [];
    const worldBibles: Record<string, any> =
        data.worldBibles && typeof data.worldBibles === 'object' ? { ...data.worldBibles } : {};

    // Which world keys actually hold entities?
    const keysWithEntities = new Set<string>();
    for (const e of entities) {
        if (e && typeof e === 'object') keysWithEntities.add(e.worldId ?? 'standalone');
    }

    // 1 — materialize the default layout where entities exist but no layout does
    for (const key of keysWithEntities) {
        const roots = worldBibles[key]?.layout?.roots;
        if (!Array.isArray(roots) || roots.length === 0) {
            worldBibles[key] = {
                ...worldBibles[key],
                layout: JSON.parse(JSON.stringify(DEFAULT_WORLD_BIBLE_LAYOUT)),
            };
        }
    }

    // 2 — file unfiled entities by type (already-filed entities returned by reference,
    //     which keeps re-runs deep-equal → idempotent)
    const nextEntities = entities.map(e => {
        if (!e || typeof e !== 'object') return e;
        if (Object.prototype.hasOwnProperty.call(e, 'categoryId')) return e;
        const key = e.worldId ?? 'standalone';
        const roots = worldBibles[key]?.layout?.roots;
        const target = Array.isArray(roots) ? fileByType(roots, e.type) : undefined;
        if (target === undefined) return e; // stays Unfiled, no key written
        return { ...e, categoryId: target };
    });

    return { ...data, entities: nextEntities, worldBibles };
}
