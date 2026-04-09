/**
 * World Bible Navigation Types
 *
 * Sprint 46A: Defines the navigation stack types for the World Bible
 * drill-down hierarchy: Home → Root Category → Subcategory → Entry.
 * No logic lives here — just type declarations and mapping constants.
 */

import { EntityType, Project, WorldBibleRootConfig, WorldBibleLayout } from '@/store/workspaceStore';

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
 * Returns the effective World Bible layout for a project.
 * Falls back to the default layout if no custom layout is set.
 */
export function getProjectLayout(project?: Project | null): WorldBibleLayout {
  if (project?.worldBibleLayout?.roots?.length) {
    return project.worldBibleLayout;
  }
  return DEFAULT_WORLD_BIBLE_LAYOUT;
}
