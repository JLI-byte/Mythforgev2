/**
 * World Bible Navigation Types
 *
 * Sprint 46A: Defines the navigation stack types for the World Bible
 * drill-down hierarchy: Home → Root Category → Subcategory → Entry.
 * No logic lives here — just type declarations and mapping constants.
 */

import { EntityType, WorldBibleRootConfig, WorldBibleLayout, WorldBibleConfig } from '@/store/workspaceStore';
import type { WorldKey } from './worldKey';

/** The three top-level groupings in the World Bible */
export type RootCategory = 'people' | 'places' | 'things' | 'world';

/** Discriminated union describing every possible World Bible view */
export type WBView =
    | { level: 'home' }
    | { level: 'root'; root: string }
    | { level: 'subcategory'; root: string; entityType: EntityType }
    | { level: 'entry'; entityId: string };

/** Maps root categories to the EntityTypes they contain */
export const ROOT_CATEGORY_TYPES: Record<RootCategory, EntityType[]> = {
    people: ['character', 'faction', 'species'],
    places: ['location'],
    things: ['artifact', 'lore'],
    world: ['magic', 'religion'],
};

/** Human readable labels for root categories */
export const ROOT_CATEGORY_LABELS: Record<RootCategory, string> = {
    people: 'People',
    places: 'Places',
    things: 'Things',
    world: 'World Systems',
};

/** Emoji icons for root categories */
export const ROOT_CATEGORY_ICONS: Record<RootCategory, string> = {
    people: '👤',
    places: '📍',
    things: '📦',
    world: '🌍',
};

/** Human readable labels per EntityType (subcategory level) */
export const SUBCATEGORY_LABELS: Record<EntityType, string> = {
    character: 'Characters',
    faction: 'Factions',
    location: 'Locations',
    artifact: 'Artifacts',
    lore: 'Lore',
    magic: 'Magic Systems',
    religion: 'Religions & Deities',
    species: 'Species & Races',
};

/** Emoji icons per EntityType (subcategory level) */
export const SUBCATEGORY_ICONS: Record<EntityType, string> = {
    character: '🧑',
    faction: '⚔️',
    location: '🗺️',
    artifact: '💎',
    lore: '📜',
    magic: '✨',
    religion: '🙏',
    species: '🧬',
};

/** The default World Bible layout — matches the hardcoded constants above */
export const DEFAULT_WORLD_BIBLE_LAYOUT: WorldBibleLayout = {
  roots: [
    {
      id: 'people',
      label: 'People',
      icon: '👤',
      entityTypes: ['character', 'faction', 'species'],
    },
    {
      id: 'places',
      label: 'Places',
      icon: '📍',
      entityTypes: ['location'],
    },
    {
      id: 'things',
      label: 'Things',
      icon: '📦',
      entityTypes: ['artifact', 'lore'],
    },
    {
      id: 'world',
      label: 'World Systems',
      icon: '🌍',
      entityTypes: ['magic', 'religion'],
    },
  ],
};

/**
 * Effective config for a shelf's World Bible — falls back to the default
 * layout when the shelf has no custom layout yet. Identity fields
 * (coverTitle etc.) pass through untouched.
 */
export function getWorldBibleConfig(
  worldBibles: Record<WorldKey, WorldBibleConfig> | undefined,
  key: string,
): WorldBibleConfig {
  const cfg = worldBibles?.[key];
  if (cfg?.layout?.roots?.length) return cfg;
  return { ...cfg, layout: DEFAULT_WORLD_BIBLE_LAYOUT };
}
