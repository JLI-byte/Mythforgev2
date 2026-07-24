import { describe, it, expect } from 'vitest';
import { WORLD_INTERVIEW_QUESTIONS, buildInterviewGuide } from './worldInterview';

describe('worldInterview', () => {
    it('has exactly ten questions in the intended order', () => {
        expect(WORLD_INTERVIEW_QUESTIONS).toHaveLength(10);
        expect(WORLD_INTERVIEW_QUESTIONS[0].label).toBe('Premise');
        expect(WORLD_INTERVIEW_QUESTIONS[1].label).toBe('Central conflict');
        expect(WORLD_INTERVIEW_QUESTIONS[9].label).toBe("What's breaking now");
    });

    it('every question carries a prompt and seed types', () => {
        for (const q of WORLD_INTERVIEW_QUESTIONS) {
            expect(q.prompt.trim().length).toBeGreaterThan(0);
            expect(q.seeds.trim().length).toBeGreaterThan(0);
        }
    });

    it('renders a guide with all ten numbered steps and the batch-at-the-end protocol', () => {
        const guide = buildInterviewGuide();
        expect(guide).toContain('1. Premise');
        expect(guide).toContain('10. What\'s breaking now');
        expect(guide).toContain('ONE question at a time');
        expect(guide).toContain('PROPOSE THE WHOLE WORLD AT ONCE');
        expect(guide).toContain('create_category');
        expect(guide).toContain('create_article');
    });
});
