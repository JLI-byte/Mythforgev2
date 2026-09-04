import { describe, it, expect } from 'vitest';
import { normaliseWithdrawnModes } from './normaliseWithdrawnModes';

describe('normaliseWithdrawnModes', () => {
    it('rewrites withdrawn modes to novel', () => {
        const out = normaliseWithdrawnModes({
            projects: [
                { id: 'a', writingMode: 'screenplay' },
                { id: 'b', writingMode: 'poetry' },
                { id: 'c', writingMode: 'markdown' },
                { id: 'd', writingMode: 'visual-novel' },
            ],
        });
        expect(out.projects.map((p: { writingMode: string }) => p.writingMode))
            .toEqual(['novel', 'novel', 'novel', 'novel']);
    });

    it('leaves novel and real-world alone', () => {
        const out = normaliseWithdrawnModes({
            projects: [
                { id: 'a', writingMode: 'novel' },
                { id: 'b', writingMode: 'real-world' },
            ],
        });
        expect(out.projects.map((p: { writingMode: string }) => p.writingMode))
            .toEqual(['novel', 'real-world']);
    });

    it('does not mutate the input', () => {
        const input = { projects: [{ id: 'a', writingMode: 'screenplay' }] };
        normaliseWithdrawnModes(input);
        expect(input.projects[0].writingMode).toBe('screenplay');
    });

    it('is idempotent', () => {
        const once = normaliseWithdrawnModes({
            projects: [{ id: 'a', writingMode: 'poetry' }],
        });
        expect(normaliseWithdrawnModes(once)).toEqual(once);
    });

    it('preserves every other field on the project', () => {
        const out = normaliseWithdrawnModes({
            projects: [{ id: 'a', writingMode: 'screenplay', title: 'Salt', wordCount: 900 }],
        });
        expect(out.projects[0]).toEqual({
            id: 'a', writingMode: 'novel', title: 'Salt', wordCount: 900,
        });
    });

    it('returns the same object when nothing needed changing', () => {
        const input = { projects: [{ id: 'a', writingMode: 'novel' }] };
        expect(normaliseWithdrawnModes(input)).toBe(input);
    });

    it('tolerates a blob with no projects array', () => {
        expect(normaliseWithdrawnModes({})).toEqual({});
        expect(normaliseWithdrawnModes({ projects: undefined })).toEqual({ projects: undefined });
    });

    it('tolerates a null entry in the projects array', () => {
        const out = normaliseWithdrawnModes({
            projects: [null, { id: 'a', writingMode: 'poetry' }],
        });
        expect(out.projects[0]).toBeNull();
        expect(out.projects[1].writingMode).toBe('novel');
    });
});
