/**
 * LEAF MODULE — the Workshop's three stages.
 *
 * The Workshop is one tab that moves Research -> Drafting -> Writing. Each
 * stage is already implemented: they are the three `variant` values WritingDesk
 * has always taken, each with its own board slice. This module holds the stage
 * list, the stage -> variant mapping, and the migration for the two mode names
 * the Workshop replaced.
 *
 * No store import beyond types, no React, 4-space indent (matches worldKey.ts,
 * researchScope.ts, folderTree.ts).
 */

export const DESK_STAGES = ['research', 'draft', 'write'] as const;
export type DeskStage = typeof DESK_STAGES[number];

/** The stage a writer lands on when nothing else is known. */
export const DEFAULT_STAGE: DeskStage = 'write';

export const STAGE_LABELS: Record<DeskStage, string> = {
    research: 'Research',
    draft: 'Drafting',
    write: 'Writing',
};

/** One line each, for the stage rail's tooltips. */
export const STAGE_HINTS: Record<DeskStage, string> = {
    research: 'Gather notes, clippings and links',
    draft: 'Outline with a writing method',
    write: 'Write the manuscript',
};

/** The WritingDesk variant that implements a stage. */
export type DeskVariant = 'research' | 'draft' | 'desk';

export function variantForStage(stage: DeskStage): DeskVariant {
    // Only 'write' differs from its stage name: the manuscript canvas has been
    // called the 'desk' variant since before the stages existed.
    return stage === 'write' ? 'desk' : stage;
}

export function isDeskStage(value: unknown): value is DeskStage {
    return typeof value === 'string' && (DESK_STAGES as readonly string[]).includes(value);
}

/** An unknown stage falls back to Writing, as an unknown mode falls back to home. */
export function coerceStage(value: unknown): DeskStage {
    return isDeskStage(value) ? value : DEFAULT_STAGE;
}

/**
 * The Workshop absorbed two workspace modes. Persisted state and old `?view=`
 * links still carry the retired names, so both entry points route through here.
 *
 * Unknown modes pass straight through with no stage opinion: validating against
 * WORKSPACE_MODES stays with the caller, which already does it, so this module
 * never imports that list and never drifts from it.
 */
export function resolveLegacyMode(mode: string | undefined): { mode: string | undefined; stage: DeskStage | null } {
    switch (mode) {
        case 'template':
            return { mode: 'desk', stage: 'draft' };
        case 'research':
            return { mode: 'desk', stage: 'research' };
        case 'desk':
            // A legacy entry point meant the manuscript specifically, so pin the
            // stage rather than leaving whatever was last persisted.
            return { mode: 'desk', stage: 'write' };
        default:
            return { mode, stage: null };
    }
}
