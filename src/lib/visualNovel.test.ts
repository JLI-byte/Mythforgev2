import { describe, it, expect } from 'vitest';
import { collectFlags, type VNScene } from './visualNovel';

const scene = (id: string, choices: VNScene['choices'] = []): VNScene => ({
    id, title: id, content: '', order: 0, choices,
});

describe('collectFlags', () => {
    it('returns every flag a choice sets or requires, sorted and deduped', () => {
        const scenes = [
            scene('a', [
                { id: 'c1', text: 'yes', targetSceneId: 'b', setsFlag: 'agreed' },
                { id: 'c2', text: 'no', targetSceneId: 'c', setsFlag: 'refused' },
            ]),
            scene('b', [
                { id: 'c3', text: 'recall', targetSceneId: 'c', requiresFlag: 'agreed' },
            ]),
        ];
        expect(collectFlags(scenes)).toEqual(['agreed', 'refused']);
    });

    it('returns an empty array when no choice touches a flag', () => {
        expect(collectFlags([scene('a', [
            { id: 'c1', text: 'onward', targetSceneId: 'b' },
        ])])).toEqual([]);
    });

    it('tolerates scenes with no choices at all', () => {
        expect(collectFlags([{ id: 'a', title: 'A', content: '', order: 0 }])).toEqual([]);
    });
});
