import { describe, it, expect } from 'vitest';
import { STANDALONE_KEY, worldKeyForProject, worldKeyForEntity } from './worldKey';

describe('worldKey helpers', () => {
    it('returns the project worldId when linked to a world', () => {
        expect(worldKeyForProject({ worldId: 'w1' })).toBe('w1');
    });

    it('returns standalone for unlinked, null, and undefined projects', () => {
        expect(worldKeyForProject({})).toBe(STANDALONE_KEY);
        expect(worldKeyForProject(null)).toBe(STANDALONE_KEY);
        expect(worldKeyForProject(undefined)).toBe(STANDALONE_KEY);
    });

    it('returns the entity worldId when set, standalone when not', () => {
        expect(worldKeyForEntity({ worldId: 'w2' })).toBe('w2');
        expect(worldKeyForEntity({})).toBe(STANDALONE_KEY);
    });
});
