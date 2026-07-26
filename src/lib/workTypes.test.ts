import { describe, it, expect } from 'vitest';
import { WORK_TYPES, getWorkType } from './workTypes';
import { getDraftType } from './writingMethods/draftTypes';

describe('WORK_TYPES', () => {
    it('offers exactly the four choices the new-work flow asks about', () => {
        expect(WORK_TYPES.map(t => t.id)).toEqual([
            'story', 'screenplay', 'script-report', 'lyrics',
        ]);
    });

    it('gives every type a writing mode the store accepts', () => {
        const allowed = ['novel', 'screenplay', 'markdown', 'poetry', 'real-world'];
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

    it('leaves lyrics without a draft type — no outlining method fits songs', () => {
        expect(getWorkType('lyrics')!.draftTypeId).toBeUndefined();
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
    it('finds a type by id', () => {
        expect(getWorkType('screenplay')?.writingMode).toBe('screenplay');
        expect(getWorkType('script-report')?.writingMode).toBe('markdown');
    });

    it('returns undefined for unknown, null or empty ids', () => {
        expect(getWorkType('nonsense')).toBeUndefined();
        expect(getWorkType(null)).toBeUndefined();
        expect(getWorkType(undefined)).toBeUndefined();
        expect(getWorkType('')).toBeUndefined();
    });
});
