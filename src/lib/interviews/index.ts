/**
 * Interview registry: the built-in skills, plus the pure pieces that turn a
 * finished interview into a World Bible article.
 *
 * Custom interviews live in the workspace store, not here — combine them with
 * BUILTIN_INTERVIEWS at the call site.
 *
 * The runner is a component and vitest only collects `.test.ts`, so everything
 * about it that has a right and a wrong answer lives in this module instead.
 */

import type { Interview } from './types';
import type { ArticleSection } from '@/lib/worldAuthoring';

export type { Interview, InterviewQuestion } from './types';
export { BUILTIN_INTERVIEWS } from './builtins';

/** A blank custom interview with one starter question, for the editor. */
export function makeBlankInterview(id: string): Interview {
    return {
        id,
        title: 'Untitled Interview',
        icon: '📝',
        tagline: '',
        questions: [{ label: 'Question 1', prompt: '', seeds: '' }],
    };
}

/** One question as it was asked, and what the writer typed back. */
export interface InterviewAnswer {
    /** The question, verbatim — it becomes the section heading. */
    prompt: string;
    /** The answer. Empty or whitespace means the question was skipped. */
    answer: string;
}

/**
 * Turn a finished interview into article sections: the question is the
 * heading, the answer is the prose beneath it, and a skipped question is
 * omitted entirely rather than left as a heading with nothing under it.
 *
 * The result goes to buildArticleDoc, which escapes every value on the way in,
 * so no caller-side escaping is needed here.
 */
export function buildInterviewSections(answers: InterviewAnswer[]): ArticleSection[] {
    return answers
        .filter(a => a.answer.trim().length > 0)
        .map(a => ({ heading: a.prompt.trim(), body: a.answer.trim() }));
}

/** The article's one-line description: the first line of the first answer. */
export function interviewDescription(answers: InterviewAnswer[], maxLength = 240): string {
    const first = answers.find(a => a.answer.trim())?.answer.trim() ?? '';
    const line = first.split('\n')[0].trim();
    return line.length > maxLength ? `${line.slice(0, maxLength).trim()}…` : line;
}
