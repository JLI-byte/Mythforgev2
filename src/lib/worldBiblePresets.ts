import { EntityType, WorldBibleLayout } from '@/store/workspaceStore';

/** A built-in category structure for a shelf's World Bible. */
export interface BiblePreset {
    id: 'standard' | 'fantasy' | 'scifi' | 'ttrpg';
    name: string;
    description: string;
    categories: { label: string; icon: string; entityTypes: EntityType[] }[];
}

/**
 * Every preset MUST cover all 8 entity types exactly once — applying a
 * preset only re-groups articles, it can never orphan them. Enforced by
 * worldBiblePresets.test.ts.
 */
export const BIBLE_PRESETS: BiblePreset[] = [
    {
        id: 'standard',
        name: 'Standard',
        description: 'The default grouping — people, places, things, systems.',
        categories: [
            { label: 'People', icon: '👤', entityTypes: ['character', 'faction', 'species'] },
            { label: 'Places', icon: '📍', entityTypes: ['location'] },
            { label: 'Things', icon: '📦', entityTypes: ['artifact', 'lore'] },
            { label: 'World Systems', icon: '🌍', entityTypes: ['magic', 'religion'] },
        ],
    },
    {
        id: 'fantasy',
        name: 'Fantasy',
        description: 'Realms, races, relics — classic high-fantasy shelves.',
        categories: [
            { label: 'Characters', icon: '🧙', entityTypes: ['character'] },
            { label: 'Realms', icon: '🏰', entityTypes: ['location'] },
            { label: 'Peoples & Races', icon: '🧬', entityTypes: ['species', 'faction'] },
            { label: 'Magic & Faith', icon: '✨', entityTypes: ['magic', 'religion'] },
            { label: 'Relics & Legends', icon: '📜', entityTypes: ['artifact', 'lore'] },
        ],
    },
    {
        id: 'scifi',
        name: 'Sci-fi',
        description: 'Stations, species, tech — built for spacefaring worlds.',
        categories: [
            { label: 'Characters', icon: '🧑‍🚀', entityTypes: ['character'] },
            { label: 'Worlds & Stations', icon: '🪐', entityTypes: ['location'] },
            { label: 'Factions', icon: '🛰️', entityTypes: ['faction'] },
            { label: 'Species', icon: '👽', entityTypes: ['species'] },
            { label: 'Tech & Artifacts', icon: '🔧', entityTypes: ['artifact', 'magic'] },
            { label: 'Archives & Beliefs', icon: '📡', entityTypes: ['lore', 'religion'] },
        ],
    },
    {
        id: 'ttrpg',
        name: 'TTRPG',
        description: 'Party, bestiary, loot — organized like a campaign binder.',
        categories: [
            { label: 'Party & NPCs', icon: '🎲', entityTypes: ['character'] },
            { label: 'Locations', icon: '🗺️', entityTypes: ['location'] },
            { label: 'Factions & Guilds', icon: '⚔️', entityTypes: ['faction'] },
            { label: 'Bestiary', icon: '🐉', entityTypes: ['species'] },
            { label: 'Items & Loot', icon: '💎', entityTypes: ['artifact'] },
            { label: 'Magic & Deities', icon: '🔮', entityTypes: ['magic', 'religion'] },
            { label: 'Lore & Quests', icon: '📜', entityTypes: ['lore'] },
        ],
    },
];

/** Fresh layout instance — new root ids on every apply, spaced for the canvas. */
export function createPresetLayout(preset: BiblePreset): WorldBibleLayout {
    return {
        roots: preset.categories.map((c, i) => ({
            id: crypto.randomUUID(),
            label: c.label,
            icon: c.icon,
            entityTypes: [...c.entityTypes],
            x: 100 + (i % 3) * 400,
            y: 100 + Math.floor(i / 3) * 400,
        })),
    };
}
