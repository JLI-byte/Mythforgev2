import { describe, it, expect } from 'vitest';
import { buildLabelMap } from './renpyExport';

const titled = (id: string, title: string) => ({ id, title });

describe('buildLabelMap', () => {
    it('turns a title into a lowercase underscored label', () => {
        const map = buildLabelMap([titled('1', 'The Meadow')]);
        expect(map.get('1')).toBe('the_meadow');
    });

    it('never emits a hyphen — they are a syntax error in a Ren\'Py label', () => {
        const map = buildLabelMap([titled('1', 'Act One — The Long Goodbye')]);
        expect(map.get('1')).not.toContain('-');
        expect(map.get('1')).toBe('act_one_the_long_goodbye');
    });

    it('collapses punctuation runs and trims the edges', () => {
        expect(buildLabelMap([titled('1', '  ...Well?!  ')]).get('1')).toBe('well');
    });

    it('prefixes titles that start with a digit', () => {
        expect(buildLabelMap([titled('1', '3am')]).get('1')).toBe('s_3am');
    });

    it('prefixes Ren\'Py keywords so they cannot collide with the language', () => {
        expect(buildLabelMap([titled('1', 'Start')]).get('1')).toBe('start_scene');
        expect(buildLabelMap([titled('2', 'Return')]).get('2')).toBe('return_scene');
    });

    it('dedupes identical titles with a numeric suffix', () => {
        const map = buildLabelMap([
            titled('1', 'The Meadow'),
            titled('2', 'The Meadow'),
            titled('3', 'The Meadow'),
        ]);
        expect([map.get('1'), map.get('2'), map.get('3')])
            .toEqual(['the_meadow', 'the_meadow_2', 'the_meadow_3']);
    });

    it('falls back to a usable label when a title has no usable characters', () => {
        expect(buildLabelMap([titled('1', '???')]).get('1')).toBe('scene');
    });
});
