import { describe, it, expect } from 'vitest';
import {
    WORK_SUB_TYPES,
    getSubTypesFor,
    getWorkSubType,
    formatBrief,
} from './workSubTypes';
import { WORK_TYPES } from './workTypes';
import { getDraftType } from './writingMethods/draftTypes';

describe('WORK_SUB_TYPES', () => {
    it('gives every kind a unique id', () => {
        const ids = WORK_SUB_TYPES.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('only names draft types that actually exist', () => {
        for (const t of WORK_SUB_TYPES) {
            expect(getDraftType(t.draftTypeId), `${t.id} → ${t.draftTypeId}`).toBeDefined();
        }
    });

    it('asks all three brief questions, in the same order, for every kind', () => {
        for (const t of WORK_SUB_TYPES) {
            expect(t.fields.map(f => f.key), t.id).toEqual(['audience', 'length', 'goal']);
        }
    });

    it('words the questions and examples for the kind, not generically', () => {
        const labels = WORK_SUB_TYPES.flatMap(t => t.fields.map(f => f.label));
        // Every kind rewording all three would be 21 distinct labels; some
        // overlap ("How long?") is fine, but they must not all be identical.
        expect(new Set(labels).size).toBeGreaterThan(3);
        for (const t of WORK_SUB_TYPES) {
            for (const f of t.fields) {
                expect(f.label.trim(), t.id).not.toBe('');
                expect(f.placeholder.trim(), t.id).not.toBe('');
            }
        }
    });
});

describe('getSubTypesFor', () => {
    it('asks the extra question only for Script / Report', () => {
        expect(getSubTypesFor('script-report')).toHaveLength(WORK_SUB_TYPES.length);
        for (const t of WORK_TYPES.filter(t => t.id !== 'script-report')) {
            expect(getSubTypesFor(t.id), t.id).toEqual([]);
        }
    });

    it('returns nothing for unknown, null or missing ids', () => {
        expect(getSubTypesFor('nonsense')).toEqual([]);
        expect(getSubTypesFor(null)).toEqual([]);
        expect(getSubTypesFor(undefined)).toEqual([]);
    });
});

describe('formatBrief', () => {
    it('names the format and lists the answers the writer gave', () => {
        const out = formatBrief('video-script', {
            audience: 'beginners to home espresso',
            length: '8–10 minutes',
            goal: 'convince them to skip the pod machine',
        });
        expect(out).toContain('YouTube / Video Script');
        expect(out).toContain('Audience: beginners to home espresso');
        expect(out).toContain('Target length: 8–10 minutes');
        expect(out).toContain('Goal: convince them to skip the pod machine');
    });

    it('leaves out questions the writer skipped', () => {
        const out = formatBrief('business-report', { goal: 'approve the Q3 hiring plan' });
        expect(out).toContain('Goal: approve the Q3 hiring plan');
        expect(out).not.toContain('Audience:');
        expect(out).not.toContain('Target length:');
    });

    it('treats whitespace-only answers as skipped', () => {
        const out = formatBrief('speech', { audience: '   ', goal: 'one habit' });
        expect(out).not.toContain('Audience:');
        expect(out).toContain('Goal: one habit');
    });

    it('still states the format when the brief was skipped entirely', () => {
        const out = formatBrief('academic-report', {});
        expect(out).toContain('Academic / School Report');
        expect(formatBrief('academic-report', undefined)).toBe(out);
    });

    it('returns nothing at all when there is no sub-type', () => {
        expect(formatBrief(undefined, { goal: 'x' })).toBe('');
        expect(formatBrief(null, undefined)).toBe('');
        expect(formatBrief('nonsense', { goal: 'x' })).toBe('');
    });

    it('works for every kind', () => {
        for (const t of WORK_SUB_TYPES) {
            const out = formatBrief(t.id, { audience: 'a', length: 'b', goal: 'c' });
            expect(out, t.id).toContain(t.label);
            expect(out, t.id).toContain('Audience: a');
        }
    });
});

describe('getWorkSubType', () => {
    it('finds a kind by id and is undefined otherwise', () => {
        expect(getWorkSubType('business-report')?.label).toBe('Business Report');
        expect(getWorkSubType('nonsense')).toBeUndefined();
        expect(getWorkSubType(null)).toBeUndefined();
    });
});
