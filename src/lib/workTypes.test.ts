import { describe, it, expect } from 'vitest';
import { WORK_TYPES, getWorkType, getWorkTypeByWritingMode } from './workTypes';
import { getDraftType } from './writingMethods/draftTypes';

describe('WORK_TYPES', () => {
    it('offers exactly one choice — the product is manuscript and lore', () => {
        expect(WORK_TYPES.map(t => t.id)).toEqual(['story']);
    });

    it('gives every type a writing mode the store accepts', () => {
        const allowed = ['novel', 'real-world'];
        for (const t of WORK_TYPES) {
            expect(allowed).toContain(t.writingMode);
        }
    });

    it('only names draft types that actually exist', () => {
        for (const t of WORK_TYPES) {
            if (!t.draftTypeId) continue;
            expect(getDraftType(t.draftTypeId), `${t.id} → ${t.draftTypeId}`).toBeDefined();
        }
    });

    it('gives every type a label, icon and its own name placeholder', () => {
        const placeholders = new Set<string>();
        for (const t of WORK_TYPES) {
            expect(t.label.trim()).not.toBe('');
            expect(t.icon.trim()).not.toBe('');
            expect(t.desc.trim()).not.toBe('');
            expect(t.namePlaceholder.trim()).not.toBe('');
            placeholders.add(t.namePlaceholder);
        }
        expect(placeholders.size).toBe(WORK_TYPES.length);
    });
});

describe('getWorkType', () => {
    it('finds the story type by id', () => {
        expect(getWorkType('story')?.writingMode).toBe('novel');
    });

    it('returns undefined for withdrawn types', () => {
        expect(getWorkType('screenplay')).toBeUndefined();
        expect(getWorkType('script-report')).toBeUndefined();
        expect(getWorkType('lyrics')).toBeUndefined();
        expect(getWorkType('visual-novel')).toBeUndefined();
    });

    it('returns undefined for unknown, null or empty ids', () => {
        expect(getWorkType('nonsense')).toBeUndefined();
        expect(getWorkType(null)).toBeUndefined();
        expect(getWorkType(undefined)).toBeUndefined();
        expect(getWorkType('')).toBeUndefined();
    });
});

describe('getWorkTypeByWritingMode', () => {
    it('recovers the story type from its mode', () => {
        expect(getWorkTypeByWritingMode('novel')?.id).toBe('story');
    });

    it('returns undefined for withdrawn modes, so legacy projects fall back', () => {
        expect(getWorkTypeByWritingMode('screenplay')).toBeUndefined();
        expect(getWorkTypeByWritingMode('markdown')).toBeUndefined();
        expect(getWorkTypeByWritingMode('poetry')).toBeUndefined();
        expect(getWorkTypeByWritingMode('visual-novel')).toBeUndefined();
    });

    it('returns undefined for real-world and for missing modes', () => {
        expect(getWorkTypeByWritingMode('real-world')).toBeUndefined();
        expect(getWorkTypeByWritingMode(null)).toBeUndefined();
        expect(getWorkTypeByWritingMode(undefined)).toBeUndefined();
    });
});
