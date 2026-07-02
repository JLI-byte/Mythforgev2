import { describe, it, expect } from 'vitest';
import { BIBLE_PRESETS, createPresetLayout } from './worldBiblePresets';

const ALL_TYPES = ['character', 'location', 'faction', 'artifact', 'lore', 'magic', 'religion', 'species'].sort();

describe('worldBiblePresets', () => {
    it('ships exactly four presets', () => {
        expect(BIBLE_PRESETS.map(p => p.id)).toEqual(['standard', 'fantasy', 'scifi', 'ttrpg']);
    });

    it.each(BIBLE_PRESETS.map(p => [p.id, p] as const))(
        '%s covers all 8 entity types exactly once',
        (_id, preset) => {
            const types = preset.categories.flatMap(c => c.entityTypes);
            expect([...types].sort()).toEqual(ALL_TYPES);          // none missing
            expect(new Set(types).size).toBe(types.length);        // none duplicated
        },
    );

    it('createPresetLayout mints fresh root ids on every call', () => {
        const a = createPresetLayout(BIBLE_PRESETS[0]);
        const b = createPresetLayout(BIBLE_PRESETS[0]);
        expect(a.roots.length).toBe(BIBLE_PRESETS[0].categories.length);
        expect(a.roots.map(r => r.id)).not.toEqual(b.roots.map(r => r.id));
        expect(a.roots.every(r => r.x !== undefined && r.y !== undefined)).toBe(true);
    });
});
