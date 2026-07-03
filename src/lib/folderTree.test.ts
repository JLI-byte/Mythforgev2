import { describe, it, expect } from 'vitest';
import { getDescendantIds, wouldCreateCycle, fileByType } from './folderTree';

const roots = [
    { id: 'a', parentId: undefined, entityTypes: ['character'] },
    { id: 'a1', parentId: 'a', entityTypes: [] },
    { id: 'a1x', parentId: 'a1', entityTypes: [] },
    { id: 'b', parentId: undefined, entityTypes: ['location', 'faction'] },
];

describe('folderTree helpers', () => {
    it('getDescendantIds returns all nested ids, excluding the folder itself', () => {
        expect([...getDescendantIds(roots, 'a')].sort()).toEqual(['a1', 'a1x']);
        expect([...getDescendantIds(roots, 'b')]).toEqual([]);
    });

    it('wouldCreateCycle rejects self and descendants, allows valid moves', () => {
        expect(wouldCreateCycle(roots, 'a', 'a')).toBe(true);    // into itself
        expect(wouldCreateCycle(roots, 'a', 'a1x')).toBe(true);  // into own grandchild
        expect(wouldCreateCycle(roots, 'a1', 'b')).toBe(false);  // sideways is fine
        expect(wouldCreateCycle(roots, 'a', undefined)).toBe(false); // to top level
    });

    it('fileByType returns the first folder holding the type, else undefined', () => {
        expect(fileByType(roots, 'character')).toBe('a');
        expect(fileByType(roots, 'faction')).toBe('b');
        expect(fileByType(roots, 'magic')).toBeUndefined();
    });

    it('helpers tolerate malformed root entries', () => {
        const messy = [null, { id: 'x' }, ...roots] as never[];
        expect(fileByType(messy, 'character')).toBe('a');
        expect([...getDescendantIds(messy, 'a')].sort()).toEqual(['a1', 'a1x']);
    });
});
