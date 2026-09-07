import { describe, it, expect } from 'vitest';
import { reconcileZoneSelection, type SceneLike } from './zoneSelection';

const scenes: SceneLike[] = [
    { id: 's1', documentId: 'a', order: 0 },
    { id: 's2', documentId: 'a', order: 1 },
    { id: 's3', documentId: 'b', order: 0 },
    { id: 's4', documentId: 'b', order: 1 },
];
const docIds = ['a', 'b'];

describe('reconcileZoneSelection', () => {
    it('follows the store to a chapter the binder is not showing', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' },
            { documentId: 'b', sceneId: 's4' },
            scenes, docIds,
        )).toEqual({ documentId: 'b', sceneId: 's4' });
    });

    it('lands on the new chapter first scene when the store names none', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' },
            { documentId: 'b', sceneId: null },
            scenes, docIds,
        )).toEqual({ documentId: 'b', sceneId: 's3' });
    });

    it('leaves the binder alone when it is already on that chapter', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 'all' },
            { documentId: 'a', sceneId: 's2' },
            scenes, docIds,
        )).toBeNull();
    });

    it('ignores a store scene that belongs to a different chapter', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' },
            { documentId: 'b', sceneId: 's1' },
            scenes, docIds,
        )).toEqual({ documentId: 'b', sceneId: 's3' });
    });

    it('ignores the binder own view states, which are not scene ids', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' },
            { documentId: 'b', sceneId: 'cover' },
            scenes, docIds,
        )).toEqual({ documentId: 'b', sceneId: 's3' });
    });

    it('shows a sceneless chapter whole rather than pointing at nothing', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' },
            { documentId: 'c', sceneId: null },
            scenes, ['a', 'b', 'c'],
        )).toEqual({ documentId: 'c', sceneId: 'all' });
    });

    it('does nothing when the store points at no chapter, or a deleted one', () => {
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' }, { documentId: null, sceneId: null }, scenes, docIds,
        )).toBeNull();
        expect(reconcileZoneSelection(
            { documentId: 'a', sceneId: 's1' }, { documentId: 'gone', sceneId: null }, scenes, docIds,
        )).toBeNull();
    });
});
