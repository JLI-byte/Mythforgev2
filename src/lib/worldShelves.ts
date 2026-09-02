/**
 * World shelves — LEAF MODULE (no store, no React import).
 *
 * Turns the flat worlds/projects/entities collections into the shape a shelf
 * renders: one entry per world, each holding the stories written in it and how
 * many World Bible articles it owns. Projects with no world — or pointing at a
 * world that has since been deleted — collect on a Standalones shelf rather
 * than disappearing.
 */

import { STANDALONE_KEY, type WorldKey } from './worldKey';

export const STANDALONE_SHELF_NAME = 'Standalones';
/** Neutral grey: standalones are the absence of a world, not a world of their own. */
export const STANDALONE_SHELF_COLOR = '#3a3a44';

export interface ShelfStory {
    id: string;
    name: string;
    coverColor: string;
    coverImageUrl?: string;
    /** ms since epoch; updatedAt when present, else createdAt. */
    updatedAt: number;
}

export interface Shelf {
    key: WorldKey;
    name: string;
    coverColor: string;
    stories: ShelfStory[];
    articleCount: number;
    isStandalone: boolean;
}

interface WorldLike {
    id: string;
    name: string;
    coverColor?: string;
    createdAt: Date | string;
}

interface ProjectLike {
    id: string;
    name: string;
    coverColor?: string;
    coverImageUrl?: string;
    worldId?: string;
    createdAt: Date | string;
    updatedAt?: Date | string;
}

interface EntityLike {
    worldId?: string;
}

function toTime(v: Date | string | undefined): number {
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
}

export function buildShelves(
    worlds: WorldLike[],
    projects: ProjectLike[],
    entities: EntityLike[],
): Shelf[] {
    const knownWorldIds = new Set(worlds.map(w => w.id));

    /** A reference to a deleted world is not a world — it belongs with the loose books. */
    const resolveKey = (worldId?: string): WorldKey =>
        worldId && knownWorldIds.has(worldId) ? worldId : STANDALONE_KEY;

    const storiesByKey = new Map<WorldKey, ShelfStory[]>();
    for (const p of projects) {
        const key = resolveKey(p.worldId);
        const list = storiesByKey.get(key) ?? [];
        list.push({
            id: p.id,
            name: p.name,
            coverColor: p.coverColor || STANDALONE_SHELF_COLOR,
            coverImageUrl: p.coverImageUrl,
            updatedAt: toTime(p.updatedAt) || toTime(p.createdAt),
        });
        storiesByKey.set(key, list);
    }
    for (const list of storiesByKey.values()) {
        list.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    const articlesByKey = new Map<WorldKey, number>();
    for (const e of entities) {
        const key = resolveKey(e.worldId);
        articlesByKey.set(key, (articlesByKey.get(key) ?? 0) + 1);
    }

    const shelves: Shelf[] = [...worlds]
        .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))
        .map(w => ({
            key: w.id,
            name: w.name,
            coverColor: w.coverColor || STANDALONE_SHELF_COLOR,
            stories: storiesByKey.get(w.id) ?? [],
            articleCount: articlesByKey.get(w.id) ?? 0,
            isStandalone: false,
        }));

    // Standalones earns a spine only when something is actually loose.
    if ((storiesByKey.get(STANDALONE_KEY) ?? []).length > 0) {
        shelves.push({
            key: STANDALONE_KEY,
            name: STANDALONE_SHELF_NAME,
            coverColor: STANDALONE_SHELF_COLOR,
            stories: storiesByKey.get(STANDALONE_KEY) ?? [],
            articleCount: articlesByKey.get(STANDALONE_KEY) ?? 0,
            isStandalone: true,
        });
    }

    return shelves;
}

/**
 * Spine height as a fraction of the shelf, from story count.
 *
 * The floor is high on purpose: spines should read as books standing on a
 * shelf, filling most of it, not as a sparse bar chart. Story count still
 * varies the height, but within the top fifth of the range — the encoding is a
 * hint, not a scale, and a forty-story world must not blow out the shelf.
 */
export const SPINE_MIN_FRACTION = 0.82;
export const SPINE_FULL_AT = 4;

export function spineFraction(storyCount: number): number {
    const reach = Math.min(1, Math.max(0, storyCount) / SPINE_FULL_AT);
    return SPINE_MIN_FRACTION + (1 - SPINE_MIN_FRACTION) * reach;
}
