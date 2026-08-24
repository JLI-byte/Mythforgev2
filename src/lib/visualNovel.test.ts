import { describe, it, expect } from 'vitest';
import { validateVisualNovel, type VNScene } from './visualNovel';

const scene = (id: string, choices: VNScene['choices'] = []): VNScene => ({
    id, title: id, content: '', order: 0, choices,
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

    it('reports a choice depending on state nothing ever sets', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Recall', targetSceneId: 'a',
                  condition: { flagId: 'f-never', op: 'is' } },
            ] },
        ]);
        expect(issues.some(i => i.kind === 'unsatisfiable-flag')).toBe(true);
    });

    it('accepts a condition whose flag some effect writes', () => {
        const issues = validateVisualNovel([
            { id: 'a', title: 'A', content: '', order: 0, choices: [
                { id: 'c1', text: 'Tell her', targetSceneId: 'b',
                  effects: [{ flagId: 'f-truth', op: 'set' }] },
            ] },
            { id: 'b', title: 'B', content: '', order: 1, choices: [
                { id: 'c2', text: 'Recall', targetSceneId: 'b',
                  condition: { flagId: 'f-truth', op: 'is' } },
            ] },
        ]);
        expect(issues.some(i => i.kind === 'unsatisfiable-flag')).toBe(false);
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
