import { describe, it, expect } from 'vitest';
import { RESEARCH_TEMPLATES, buildTemplate } from './researchTemplates';

describe('RESEARCH_TEMPLATES', () => {
    it('offers templates, each with an id, name and description', () => {
        expect(RESEARCH_TEMPLATES.length).toBeGreaterThan(0);
        for (const t of RESEARCH_TEMPLATES) {
            expect(t.id).toBeTruthy();
            expect(t.name).toBeTruthy();
            expect(t.description).toBeTruthy();
        }
    });

    it('has no duplicate ids', () => {
        const ids = RESEARCH_TEMPLATES.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('buildTemplate', () => {
    it('returns widgets for a known template', () => {
        const ws = buildTemplate('place-study', () => 'id');
        expect(ws.length).toBeGreaterThan(0);
    });

    it('gives every widget a distinct id from the supplied generator', () => {
        let n = 0;
        const ws = buildTemplate('place-study', () => `id-${n++}`);
        expect(new Set(ws.map(w => w.id)).size).toBe(ws.length);
    });

    it('lays columns out without overlapping them', () => {
        let n = 0;
        const cols = buildTemplate('place-study', () => `id-${n++}`)
            .filter(w => w.type === 'column');
        const xs = cols.map(c => c.x);
        expect(new Set(xs).size).toBe(xs.length);
    });

    it('parents every child to a column that the template actually creates', () => {
        let n = 0;
        const ws = buildTemplate('place-study', () => `id-${n++}`);
        const ids = new Set(ws.map(w => w.id));
        for (const w of ws) {
            if (w.parentId) expect(ids.has(w.parentId)).toBe(true);
        }
    });

    it('is empty for an unknown template rather than throwing', () => {
        expect(buildTemplate('nope', () => 'id')).toEqual([]);
    });
});
