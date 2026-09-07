import { describe, it, expect } from 'vitest';
import { planNewStory } from './newStory';

const ids = { projectId: 'p1', documentId: 'd1', sceneId: 's1' };
const now = new Date('2026-09-03T10:00:00.000Z');

function base() {
    return { name: 'The Long Winter', workTypeId: 'story', coverColor: '#26262b', ids, now };
}

describe('planNewStory', () => {
    it('returns null for a blank name', () => {
        expect(planNewStory({ ...base(), name: '   ' })).toBeNull();
    });

    it('returns null for a work type that does not exist', () => {
        expect(planNewStory({ ...base(), workTypeId: 'screenplay' })).toBeNull();
    });

    it('trims the name onto the project', () => {
        const plan = planNewStory({ ...base(), name: '  The Long Winter  ' })!;
        expect(plan.project.name).toBe('The Long Winter');
    });

    it('builds a project carrying the work type writing mode', () => {
        const plan = planNewStory(base())!;
        expect(plan.project.id).toBe('p1');
        expect(plan.project.writingMode).toBe('novel');
        expect(plan.project.coverColor).toBe('#26262b');
        expect(plan.project.createdAt).toEqual(now);
    });

    it('gives the story a first chapter and a first scene, wired together', () => {
        const plan = planNewStory(base())!;
        expect(plan.document).toEqual({
            id: 'd1', projectId: 'p1', title: 'Chapter 1', content: '', createdAt: now,
        });
        expect(plan.scene).toEqual({
            id: 's1', documentId: 'd1', projectId: 'p1',
            title: 'Scene 1', content: '', order: 0, createdAt: now,
        });
    });

    it('pre-filters the Draft Table to the work type', () => {
        const plan = planNewStory(base())!;
        // 'story' is what draftTypes.ts actually holds for the novel type.
        expect(plan.draftState).toEqual({ draftTypeId: 'novel', draftFormat: 'story' });
    });

    it('files the story under a shelf when one is given', () => {
        const plan = planNewStory({ ...base(), worldId: 'w9' })!;
        expect(plan.project.worldId).toBe('w9');
    });

    it('omits an empty brief rather than storing a hollow object', () => {
        const plan = planNewStory({ ...base(), brief: { audience: '  ', goal: '' } })!;
        expect(plan.project).not.toHaveProperty('brief');
    });

    it('keeps only the brief answers that were actually filled in', () => {
        const plan = planNewStory({ ...base(), brief: { audience: 'YA', goal: '  ' } })!;
        expect(plan.project.brief).toEqual({ audience: 'YA' });
    });
});
