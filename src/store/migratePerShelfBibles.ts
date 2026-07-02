/**
 * v2 → v3 migration: per-shelf World Bibles.
 *
 * Pure and idempotent — runs on raw persisted blobs from BOTH hydration
 * paths (zustand persist migrate + Supabase cloud hydrate), so it must
 * never assume it runs only once, and must not import store code.
 *
 * 1. Backfills entity.worldId from the entity's project → world link.
 * 2. Normalizes worldIds that point at deleted worlds back to standalone.
 * 3. Builds the worldBibles map (once) by adopting each world's first
 *    non-empty per-project layout. Old project.worldBibleLayout values are
 *    left in place, unread, as rollback safety.
 */
export function migratePerShelfBibles(data: Record<string, any>): Record<string, any> {
    if (!data || typeof data !== 'object') return data;

    const worlds: any[] = Array.isArray(data.worlds) ? data.worlds : [];
    const projects: any[] = Array.isArray(data.projects) ? data.projects : [];
    const entities: any[] = Array.isArray(data.entities) ? data.entities : [];

    const worldIds = new Set(worlds.map(w => w?.id));
    const projectWorld = new Map(projects.map(p => [p?.id, p?.worldId]));

    // 1 + 2 — backfill and normalize entity.worldId
    const nextEntities = entities.map(e => {
        let worldId: string | undefined = e.worldId ?? projectWorld.get(e.projectId);
        if (worldId !== undefined && !worldIds.has(worldId)) worldId = undefined;
        const hadKey = Object.prototype.hasOwnProperty.call(e, 'worldId');
        const willHaveKey = worldId !== undefined;
        if (hadKey === willHaveKey && e.worldId === worldId) return e;
        const next = { ...e, worldId };
        if (worldId === undefined) delete next.worldId;
        return next;
    });

    // 3 — build worldBibles once
    let worldBibles = data.worldBibles;
    if (!worldBibles || typeof worldBibles !== 'object') {
        const built: Record<string, any> = {};
        for (const p of projects) {
            const key = p?.worldId && worldIds.has(p.worldId) ? p.worldId : 'standalone';
            if (built[key]) continue;
            const roots = p?.worldBibleLayout?.roots;
            if (Array.isArray(roots) && roots.length > 0) {
                built[key] = { layout: JSON.parse(JSON.stringify({ roots })) };
            }
        }
        worldBibles = built;
    }

    return { ...data, entities: nextEntities, worldBibles };
}
