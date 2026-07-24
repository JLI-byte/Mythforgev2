import { describe, it, expect } from 'vitest';
import {
    BUILTIN_INTERVIEWS,
    makeBlankInterview,
    interviewLaunchLine,
    renderInterviewGuide,
} from './index';

describe('built-in interviews', () => {
    it('ships World, Character, Species, City, and Country', () => {
        expect(BUILTIN_INTERVIEWS.map(i => i.title)).toEqual([
            'World', 'Character', 'Species', 'City', 'Country',
        ]);
    });

    it('gives every built-in ten questions with a prompt, all flagged built-in', () => {
        for (const iv of BUILTIN_INTERVIEWS) {
            expect(iv.builtIn).toBe(true);
            expect(iv.questions).toHaveLength(10);
            for (const q of iv.questions) {
                expect(q.prompt.trim().length).toBeGreaterThan(0);
                expect(q.label.trim().length).toBeGreaterThan(0);
            }
        }
        expect(new Set(BUILTIN_INTERVIEWS.map(i => i.id)).size).toBe(BUILTIN_INTERVIEWS.length);
    });
});

describe('renderInterviewGuide', () => {
    it('numbers the questions and includes the confirm-before-create protocol', () => {
        const character = BUILTIN_INTERVIEWS.find(i => i.id === 'build-a-character')!;
        const guide = renderInterviewGuide(character);
        expect(guide).toContain('GUIDED INTERVIEW: "Character"');
        expect(guide).toContain('1. Core want');
        expect(guide).toContain('10. The test');
        expect(guide).toContain('ONE question at a time');
        expect(guide).toContain('create_article');
        // A single-subject interview names its target type.
        expect(guide).toContain('character article');
    });

    it('describes the World interview as producing many grouped articles, not one', () => {
        const world = BUILTIN_INTERVIEWS.find(i => i.id === 'build-a-world')!;
        const guide = renderInterviewGuide(world);
        expect(guide).toContain('grouped into sensible folders');
        // The single-subject protocol line ("the main <type> article") must not appear.
        expect(guide).not.toContain('the main');
    });

    it('skips blank questions when rendering', () => {
        const iv = makeBlankInterview('draft');
        iv.questions = [
            { label: 'A', prompt: 'Real question?', seeds: '' },
            { label: 'B', prompt: '   ', seeds: '' },
        ];
        const guide = renderInterviewGuide(iv);
        expect(guide).toContain('1. A');
        expect(guide).not.toContain('2. B');
        expect(guide).toContain('THE 1 QUESTIONS');
    });
});

describe('interviewLaunchLine', () => {
    it('produces a natural opening line from the title', () => {
        const city = BUILTIN_INTERVIEWS.find(i => i.id === 'build-a-city')!;
        expect(interviewLaunchLine(city)).toBe(
            "Let's build a city — walk me through it, one question at a time.",
        );
    });
});
