/**
 * The guided "Build a World" interview: a fixed ten-question script the research
 * assistant follows to take a user from a blank world to a seeded World Bible.
 *
 * The order is deliberate and grounded in worldbuilding practice: lead with the
 * cascade roots (premise, then conflict) because those decide which systems need
 * depth; sweep the cultural-coverage backbone (place, peoples, power, belief,
 * the special system, daily life) so nothing civilizational is missed; close
 * with motion (the turning point and what's breaking now) so the world isn't a
 * static museum.
 *
 * The route injects buildInterviewGuide() into the system prompt only while an
 * interview is active, so ordinary chats aren't weighed down by it.
 */

export interface InterviewQuestion {
    /** Short step label shown in the guide. */
    label: string;
    /** The question, phrased for the assistant to ask conversationally. */
    prompt: string;
    /** World Bible entity types this answer typically seeds. */
    seeds: string;
}

/** The ten questions, asked in order. */
export const WORLD_INTERVIEW_QUESTIONS: InterviewQuestion[] = [
    {
        label: 'Premise',
        prompt: "In a sentence or two — what's the big idea of your world, and what makes it the one place this story could happen?",
        seeds: 'the core concept',
    },
    {
        label: 'Central conflict',
        prompt: 'What tension is pulling this world apart — and who or what are the opposing sides?',
        seeds: 'faction',
    },
    {
        label: 'Physical world',
        prompt: 'Where and when are we? The land, the climate, the scale of it, and the era of technology.',
        seeds: 'location',
    },
    {
        label: 'Peoples & cultures',
        prompt: 'Who lives here? The main peoples, cultures, or species — and how they see each other.',
        seeds: 'species, character',
    },
    {
        label: 'Power',
        prompt: 'Who holds power, and who wants it? How is the world ruled, and where is that contested?',
        seeds: 'faction',
    },
    {
        label: 'Belief',
        prompt: "What do people here believe — religions, myths, or the values they'd fight to defend?",
        seeds: 'religion, lore',
    },
    {
        label: 'The special system',
        prompt: "Is there magic or technology beyond ours? If so — where does it come from, what does it cost, and what can't it do?",
        seeds: 'magic, artifact',
    },
    {
        label: 'Daily life',
        prompt: "How do ordinary people get by? What's scarce, what's abundant, and what's a normal day for someone at the bottom?",
        seeds: 'lore, location',
    },
    {
        label: 'The turning point',
        prompt: 'What one event in the past made the present what it is?',
        seeds: 'lore',
    },
    {
        label: "What's breaking now",
        prompt: 'What fragile balance is about to break as the story opens?',
        seeds: 'lore',
    },
];

/**
 * Render the full interview instructions for the system prompt: how to run it,
 * the ten questions with their seed types, and the propose-the-whole-world-at-
 * the-end protocol.
 */
export function buildInterviewGuide(): string {
    const steps = WORLD_INTERVIEW_QUESTIONS
        .map((q, i) => `${i + 1}. ${q.label} — "${q.prompt}" (seeds: ${q.seeds})`)
        .join('\n');

    return [
        'GUIDED WORLD-BUILDING INTERVIEW — the user launched "Build a World". Run it now.',
        'Your job: take them from a blank world to a seeded World Bible using the ten questions below.',
        'If you have ALREADY completed this interview earlier in the conversation, do not restart it —',
        'just keep helping normally.',
        '',
        'HOW TO RUN IT:',
        '- Open with one warm sentence, then ask QUESTION 1. Ask ONE question at a time and wait for the answer.',
        '- Keep momentum. Ask a short follow-up only if an answer is too thin to build on — never interrogate.',
        '- If the user is unsure or says "skip", offer a quick suggestion or move on. Never stall.',
        '- Do NOT call any creation tool mid-interview. Gather all ten answers first.',
        '',
        'THE TEN QUESTIONS (ask in order):',
        steps,
        '',
        'AFTER QUESTION 10 — PROPOSE THE WHOLE WORLD AT ONCE:',
        '- Give a short paragraph summarizing the world, then list the folders and articles you plan to create',
        '  (use the seed types above; group related articles under sensible categories).',
        '- Ask for a single confirmation, e.g. "Want me to create all of this?".',
        '- ONLY after they agree, call create_category first for any folders, then create_article for each',
        '  article, filing it under the right folder. Do it all in one batch.',
        '- If they want changes, revise the plan and confirm again before creating anything.',
    ].join('\n');
}
