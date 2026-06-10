import { describe, it, expect } from 'vitest';
import { parseCSV, flattenJSON } from './importUtils';

describe('parseCSV', () => {
    it('parses simple comma-separated rows', () => {
        expect(parseCSV('a,b,c\n1,2,3')).toEqual([
            ['a', 'b', 'c'],
            ['1', '2', '3'],
        ]);
    });

    it('respects quoted fields containing commas', () => {
        expect(parseCSV('name,note\n"Smith, J.",hi')).toEqual([
            ['name', 'note'],
            ['Smith, J.', 'hi'],
        ]);
    });

    it('handles escaped double-quotes inside quoted fields', () => {
        expect(parseCSV('q\n"He said ""hi"""')).toEqual([
            ['q'],
            ['He said "hi"'],
        ]);
    });

    it('handles CRLF line endings', () => {
        expect(parseCSV('a,b\r\n1,2')).toEqual([
            ['a', 'b'],
            ['1', '2'],
        ]);
    });
});

describe('flattenJSON', () => {
    it('flattens nested objects with dot paths', () => {
        expect(flattenJSON({ a: 1, b: { c: 2, d: { e: 3 } } })).toEqual({
            a: '1',
            'b.c': '2',
            'b.d.e': '3',
        });
    });

    it('stringifies arrays rather than descending into them', () => {
        const out = flattenJSON({ tags: ['x', 'y'] });
        expect(out.tags).toBe(String(['x', 'y']));
    });
});
