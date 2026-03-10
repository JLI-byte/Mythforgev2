/**
 * contextBuilders.ts
 *
 * Pure utility functions that assemble world and character context strings
 * for the AI Chat system prompts. These are called by the useAIChat hook
 * before sending a request to the /api/ai/chat route.
 *
 * Token budget matters because Anthropic models have finite context windows.
 * Keeping assembled context under ~3 000 tokens leaves room for the
 * conversation history and the model's response within a single request.
 */

import { Project, Entity, CharacterEntity } from '@/store/workspaceStore';

// --- Internal constants ---

/** Maximum entities to include in oracle context to stay within token budget */
const MAX_ENTITIES = 30;

/** Maximum characters per entity description to keep individual entries concise */
const MAX_DESC_LENGTH = 200;

// --- Helpers ---

/**
 * Truncate a string to `max` characters, appending "…" if truncated.
 * Returns an empty string for undefined/null input.
 */
function truncate(text: string | undefined, max: number): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
}

// --- Public API ---

/**
 * Assemble a world-context string for the World Oracle system prompt.
 *
 * Collects the project name plus summaries of characters, locations, and
 * lore/event entities. Each section is labelled; sections with no data are
 * omitted entirely so the prompt stays clean.
 *
 * Token budget: descriptions are truncated to 200 chars each and the total
 * entity count is capped at 30 to keep the assembled block under ~3 000 tokens.
 *
 * @param project  The active project — only `name` is read.
 * @param entities All entities belonging to the project.
 * @returns A formatted multi-line string ready to embed in a system prompt.
 */
export function buildWorldOracleContext(
    project: Project,
    entities: Entity[]
): string {
    const capped = entities.slice(0, MAX_ENTITIES);

    // Group entities by type
    const characters = capped.filter(e => e.type === 'character');
    const locations  = capped.filter(e => e.type === 'location');
    const lore       = capped.filter(e => e.type === 'lore');
    const factions   = capped.filter(e => e.type === 'faction');
    const artifacts  = capped.filter(e => e.type === 'artifact');

    const sections: string[] = [];

    sections.push(`PROJECT: ${project.name}`);

    if (characters.length > 0) {
        sections.push(
            'CHARACTERS:\n' +
            characters.map(c =>
                `- ${c.name}: ${truncate(c.description, MAX_DESC_LENGTH)}`
            ).join('\n')
        );
    }

    if (locations.length > 0) {
        sections.push(
            'LOCATIONS:\n' +
            locations.map(l =>
                `- ${l.name}: ${truncate(l.description, MAX_DESC_LENGTH)}`
            ).join('\n')
        );
    }

    if (factions.length > 0) {
        sections.push(
            'FACTIONS:\n' +
            factions.map(f =>
                `- ${f.name}: ${truncate(f.description, MAX_DESC_LENGTH)}`
            ).join('\n')
        );
    }

    if (artifacts.length > 0) {
        sections.push(
            'ARTIFACTS:\n' +
            artifacts.map(a =>
                `- ${a.name}: ${truncate(a.description, MAX_DESC_LENGTH)}`
            ).join('\n')
        );
    }

    if (lore.length > 0) {
        sections.push(
            'LORE & EVENTS:\n' +
            lore.map(l =>
                `- ${l.name}: ${truncate(l.description, MAX_DESC_LENGTH)}`
            ).join('\n')
        );
    }

    return sections.join('\n\n');
}

/**
 * Assemble a character-profile string for the Character Chat system prompt.
 *
 * Includes the character's name, description, any custom fields, and voice
 * samples. Missing or empty fields are silently omitted — the function never
 * crashes on incomplete data.
 *
 * @param project   The active project — only `name` is read.
 * @param character A CharacterEntity (already narrowed by the caller).
 * @returns A formatted multi-line string ready to embed in a system prompt.
 */
export function buildCharacterContext(
    project: Project,
    character: CharacterEntity
): string {
    const sections: string[] = [];

    sections.push(`CHARACTER: ${character.name}`);
    sections.push(`PROJECT: ${project.name}`);

    if (character.description) {
        sections.push(`DESCRIPTION:\n${character.description}`);
    }

    if (character.subcategory) {
        sections.push(`ROLE: ${character.subcategory}`);
    }

    // Include custom fields if present (e.g. "Motivation", "Weakness")
    if (character.customFields && character.customFields.length > 0) {
        sections.push(
            'DETAILS:\n' +
            character.customFields.map(f =>
                `- ${f.label}: ${f.value}`
            ).join('\n')
        );
    }

    // Voice samples give the model examples of how this character speaks
    if (character.voiceSamples && character.voiceSamples.length > 0) {
        sections.push(
            'VOICE SAMPLES:\n' +
            character.voiceSamples.join('\n')
        );
    }

    return sections.join('\n\n');
}
