/**
 * Interview registry: the built-in skills plus helpers to render an interview
 * into the guide text the research route injects into the system prompt.
 *
 * Custom interviews live in the workspace store, not here — combine them with
 * BUILTIN_INTERVIEWS at the call site (the store exposes the merged list).
 */

import type { Interview, InterviewQuestion } from './types';
import { BUILTIN_INTERVIEWS } from './builtins';

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

/** The opening line the launcher sends to kick the interview off. */
export function interviewLaunchLine(interview: Interview): string {
    return `Let's build a ${interview.title.toLowerCase()} — walk me through it, one question at a time.`;
}

/**
 * Render an interview into the system-prompt guide: how to run it, the numbered
 * questions with their seed types, and the propose-at-the-end protocol. Works
 * for a single-subject interview (one primary article) and the World interview
 * (many articles) alike.
 */
export function renderInterviewGuide(interview: Interview): string {
    const questions: InterviewQuestion[] = interview.questions.filter(q => q.prompt.trim());
    const steps = questions
        .map((q, i) => `${i + 1}. ${q.label || `Question ${i + 1}`} — "${q.prompt.trim()}"${q.seeds.trim() ? ` (seeds: ${q.seeds.trim()})` : ''}`)
        .join('\n');

    const subject = interview.targetType
        ? `a single ${interview.targetType} article for the subject`
        : 'a set of World Bible articles (grouped into sensible folders)';

    return [
        `GUIDED INTERVIEW: "${interview.title}" — the user launched it. Run it now.`,
        `Your job: take them from nothing to ${subject}, using the ${questions.length} questions below.`,
        'If you have ALREADY completed this interview earlier in the conversation, do not restart it —',
        'just keep helping normally.',
        '',
        'HOW TO RUN IT:',
        '- Open with one warm sentence, then ask QUESTION 1. Ask ONE question at a time and wait for the answer.',
        '- Keep momentum. Ask a short follow-up only if an answer is too thin to build on — never interrogate.',
        '- If the user is unsure or says "skip", offer a quick suggestion or move on. Never stall.',
        '- Do NOT call any creation tool mid-interview. Gather every answer first.',
        '',
        `THE ${questions.length} QUESTIONS (ask in order):`,
        steps,
        '',
        'AFTER THE LAST QUESTION — PROPOSE WHAT TO CREATE, THEN CONFIRM:',
        '- Give a short paragraph summarizing the subject, then list the World Bible articles you plan to create:',
        interview.targetType
            ? `  the main ${interview.targetType} article, plus any related articles the answers clearly implied (a faction, a place, a person).`
            : '  the folders and articles, grouped sensibly using the seed types above.',
        '- Ask for a single confirmation, e.g. "Want me to create all of this?".',
        '- ONLY after they agree, call create_category first for any folders, then create_article for each article.',
        '- If they want changes, revise the plan and confirm again before creating anything.',
    ].join('\n');
}
