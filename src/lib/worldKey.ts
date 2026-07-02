/**
 * World-key helpers — LEAF MODULE, no store imports (the store imports this).
 * A WorldKey identifies a shelf's World Bible: a World id, or 'standalone'
 * for the uncategorized shelf.
 */
export type WorldKey = string;

export const STANDALONE_KEY: WorldKey = 'standalone';

/** The shelf key a project belongs to. */
export function worldKeyForProject(p?: { worldId?: string } | null): WorldKey {
    return p?.worldId ?? STANDALONE_KEY;
}

/** The shelf key an entity belongs to. */
export function worldKeyForEntity(e: { worldId?: string }): WorldKey {
    return e.worldId ?? STANDALONE_KEY;
}
