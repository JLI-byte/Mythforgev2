import { describe, it, expect } from 'vitest';
import { getWorldBibleConfig, DEFAULT_WORLD_BIBLE_LAYOUT } from './worldBibleNav';

describe('getWorldBibleConfig', () => {
    const custom = { layout: { roots: [{ id: 'r1', label: 'Crew', icon: '🚀', entityTypes: ['character' as const] }] } };

    it('returns the stored config when it has a non-empty layout', () => {
        expect(getWorldBibleConfig({ w1: custom }, 'w1')).toBe(custom);
    });

    it('falls back to the default layout for unknown keys', () => {
        const cfg = getWorldBibleConfig({}, 'nope');
        expect(cfg.layout).toEqual(DEFAULT_WORLD_BIBLE_LAYOUT);
    });

    it('keeps identity fields while falling back on an empty layout', () => {
        const cfg = getWorldBibleConfig({ w1: { layout: { roots: [] }, coverTitle: 'Aether' } }, 'w1');
        expect(cfg.coverTitle).toBe('Aether');
        expect(cfg.layout).toEqual(DEFAULT_WORLD_BIBLE_LAYOUT);
    });

    it('handles an undefined map', () => {
        expect(getWorldBibleConfig(undefined, 'w1').layout).toEqual(DEFAULT_WORLD_BIBLE_LAYOUT);
    });
});
