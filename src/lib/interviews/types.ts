/**
 * Interview registry types.
 *
 * An "interview" is a launchable skill: a named, ordered set of questions the
 * research assistant asks one at a time to take the user from nothing to a
 * filled-in World Bible entry. Like the writing-method registry, an interview
 * is DATA, not code — built-ins ship in a registry, and users author their own
 * (stored in the workspace and fully editable). No new component per interview.
 */

import type { EntityType } from '@/store/workspaceStore';

export interface InterviewQuestion {
    /** Short step label, e.g. "Premise". */
    label: string;
    /** The question, phrased for the assistant to ask conversationally. */
    prompt: string;
    /** World Bible entity types this answer typically seeds, e.g. "faction". */
    seeds: string;
}

export interface Interview {
    /** kebab-case unique id, e.g. 'build-a-character'. */
    id: string;
    /** Display title, e.g. "Character". Used in the menu and launch line. */
    title: string;
    /** Emoji shown in the menu. */
    icon: string;
    /** One-line description of what this interview builds. */
    tagline: string;
    /**
     * The World Bible entity type the finished subject is filed as. Undefined
     * for the World interview, which produces many articles of mixed types.
     */
    targetType?: EntityType;
    /** true for the shipped built-ins (read-only; duplicate to customize). */
    builtIn?: boolean;
    /** The questions, asked in order. */
    questions: InterviewQuestion[];
}
