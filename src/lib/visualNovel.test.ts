import { describe, it, expect } from 'vitest';
import { collectFlags, validateVisualNovel, type VNScene } from './visualNovel';

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

describe('validateVisualNovel', () => {
    it('reports a choice pointing at a scene that no longer exists', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Go', targetSceneId: 'gone' },
            ] },
        ]);
        expect(issues).toContainEqual({
            kind: 'broken-jump', sceneId: 'a',
            message: '“Go” points at a scene that no longer exists.',
        });
    });

    it('does not call a scene unreachable when the previous one falls through', () => {
        // 'a' has no choices, so it flows into 'orphan' — which is therefore reached.
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [] },
            { id: 'orphan', title: 'Orphan', content: '', order: 1, choices: [] },
        ]);
        expect(issues.some(i => i.kind === 'unreachable' && i.sceneId === 'orphan')).toBe(false);
    });

    it('does not call the first scene unreachable', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [] },
        ]);
        expect(issues.some(i => i.kind === 'unreachable')).toBe(false);
    });

    it('reports a genuinely unreachable scene', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Go', targetSceneId: 'a' },
            ] },
            { id: 'island', title: 'Island', content: '', order: 1, choices: [
                { id: 'c2', text: 'Stay', targetSceneId: 'island' },
            ] },
        ]);
        expect(issues.some(i => i.kind === 'unreachable' && i.sceneId === 'island')).toBe(true);
    });

    it('reports a choice requiring a flag nothing ever sets', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Recall', targetSceneId: 'a', requiresFlag: 'never_set' },
            ] },
        ]);
        expect(issues.some(i => i.kind === 'unsatisfiable-flag')).toBe(true);
    });

    it('accepts a convergent graph — two choices, one destination', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Left', targetSceneId: 'end' },
                { id: 'c2', text: 'Right', targetSceneId: 'end' },
            ] },
            { id: 'end', title: 'End', content: '', order: 1, choices: [] },
        ]);
        expect(issues).toEqual([]);
    });
});
