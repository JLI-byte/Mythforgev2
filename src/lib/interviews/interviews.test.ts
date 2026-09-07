import { describe, it, expect } from 'vitest';
import {
    BUILTIN_INTERVIEWS,
    makeBlankInterview,
    buildInterviewSections,
    interviewDescription,
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

    it('gives a blank custom interview one starter question', () => {
        const draft = makeBlankInterview('draft');
        expect(draft.id).toBe('draft');
        expect(draft.questions).toHaveLength(1);
        expect(draft.builtIn).toBeUndefined();
    });
});

describe('buildInterviewSections', () => {
    it('turns each answered question into a heading and its prose', () => {
        const sections = buildInterviewSections([
            { prompt: 'Who is this character?', answer: 'A thief called Kestrel.' },
            { prompt: 'What do they want?', answer: 'Out.' },
        ]);
        expect(sections).toEqual([
            { heading: 'Who is this character?', body: 'A thief called Kestrel.' },
            { heading: 'What do they want?', body: 'Out.' },
        ]);
    });

    it('omits a skipped question entirely rather than leaving an empty heading', () => {
        const sections = buildInterviewSections([
            { prompt: 'Who is this character?', answer: 'A thief.' },
            { prompt: 'What do they want?', answer: '   ' },
            { prompt: 'Their wound?', answer: '' },
        ]);
        expect(sections).toHaveLength(1);
        expect(sections[0].heading).toBe('Who is this character?');
    });

    it('returns nothing when every question was skipped', () => {
        expect(buildInterviewSections([{ prompt: 'Q', answer: '  ' }])).toEqual([]);
    });
});

describe('interviewDescription', () => {
    it('takes the first line of the first answered question', () => {
        expect(interviewDescription([
            { prompt: 'Q1', answer: '  ' },
            { prompt: 'Q2', answer: 'A thief called Kestrel.\nMore below.' },
        ])).toBe('A thief called Kestrel.');
    });

    it('clips a long first line and marks it', () => {
        const long = 'x'.repeat(300);
        const out = interviewDescription([{ prompt: 'Q', answer: long }], 240);
        expect(out).toHaveLength(241);
        expect(out.endsWith('…')).toBe(true);
    });

    it('is empty when nothing was answered', () => {
        expect(interviewDescription([{ prompt: 'Q', answer: '' }])).toBe('');
    });
});
