/**
 * Entity trigger matching — LEAF MODULE (no store or React import).
 *
 * Two ways to reach the World Bible from inside a sentence: `@` links an entry
 * that already exists, `[[` offers to create one on the spot. They are the same
 * shape — a trigger, then the name being typed — so one matcher answers for
 * both and the ProseMirror plugin stays a thin wrapper around it.
 *
 * Neither trigger character appears in the name run, so the two patterns are
 * mutually exclusive by construction: whichever trigger the cursor sits inside
 * is the only one whose run can still reach the end of the text.
 */

export type EntityTrigger = '@' | '[[';

export interface TriggerMatch {
    trigger: EntityTrigger;
    /** The name typed after the trigger. Empty right after the trigger itself. */
    query: string;
    /** Characters back from the cursor the trigger starts, trigger included. */
    length: number;
}

/** Characters a world-entry name may contain while it is being typed. */
const NAME_RUN = "[\\w \\-'\u2019]";

const PATTERNS: { trigger: EntityTrigger; re: RegExp }[] = [
    { trigger: '[[', re: new RegExp(`\\[\\[(${NAME_RUN}*)$`) },
    { trigger: '@', re: new RegExp(`@(${NAME_RUN}*)$`) },
];

/** Longest a name can get before the trigger is assumed abandoned. */
export const MAX_QUERY_LENGTH = 30;

/**
 * The trigger the cursor is currently inside, or null.
 *
 * `textBefore` is the text immediately preceding the cursor. When both could
 * match, the one that starts later wins — its match is the shorter one.
 */
export function matchEntityTrigger(textBefore: string): TriggerMatch | null {
    let best: TriggerMatch | null = null;

    for (const { trigger, re } of PATTERNS) {
        const m = textBefore.match(re);
        if (!m) continue;

        const query = m[1];
        if (query.endsWith('  ') || query.length > MAX_QUERY_LENGTH) continue;

        const length = query.length + trigger.length;
        if (!best || length < best.length) best = { trigger, query, length };
    }

    return best;
}
