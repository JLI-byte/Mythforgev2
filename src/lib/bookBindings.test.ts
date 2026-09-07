import { describe, it, expect } from 'vitest';
import { BINDINGS, bindingFor, coverArt, spineArt } from './bookBindings';
import { COVER_COLORS } from '@/store/workspaceStore';

describe('bindingFor', () => {
    it('maps every palette colour to its own binding', () => {
        const picked = COVER_COLORS.map((c, i) => bindingFor(c, `id-${i}`));
        expect(new Set(picked).size).toBe(COVER_COLORS.length);
    });

    it('lines the palette up with the bindings in order', () => {
        expect(bindingFor(COVER_COLORS[0], 'x')).toBe('slate-blue-cloth');
        expect(bindingFor(COVER_COLORS[3], 'x')).toBe('oxblood-leather');
        expect(bindingFor(COVER_COLORS[7], 'x')).toBe('indigo-foil');
    });

    it('ignores case and surrounding space in the colour', () => {
        expect(bindingFor('  #C0392B  ', 'x')).toBe('oxblood-leather');
        expect(bindingFor('#c0392b', 'x')).toBe('oxblood-leather');
    });

    it('falls back to a stable binding for an off-palette colour', () => {
        const a = bindingFor('#123456', 'world-42');
        const b = bindingFor('#abcdef', 'world-42');
        expect(a).toBe(b);                       // keyed on the id, not the colour
        expect(BINDINGS).toContain(a);
    });

    it('falls back when there is no colour at all', () => {
        expect(BINDINGS).toContain(bindingFor(undefined, 'world-7'));
    });

    it('spreads ids across the bindings rather than favouring one', () => {
        const ids = Array.from({ length: 400 }, (_, i) => `id-${i}`);
        const counts = new Map<string, number>();
        for (const id of ids) {
            const b = bindingFor(undefined, id);
            counts.set(b, (counts.get(b) ?? 0) + 1);
        }
        expect(counts.size).toBe(BINDINGS.length);
        // No binding should swallow more than a third of them.
        for (const n of counts.values()) expect(n).toBeLessThan(ids.length / 3);
    });
});

describe('asset paths', () => {
    it('points at the installed files', () => {
        expect(spineArt('tan-calf')).toBe('/textures/books/spines/tan-calf.webp');
        expect(coverArt('teal-matte')).toBe('/textures/books/covers/teal-matte.webp');
    });
});
