/**
 * Declared story state for visual novels — the flags a branch map tracks, and
 * the Ren'Py fragments they turn into. LEAF MODULE (no store, no React).
 *
 * Flags are declared rather than typed, and every effect and condition is
 * assembled from a registry entry plus an operator. Nothing here accepts a
 * free-text expression: the generated file cannot be compiled on this machine,
 * so it has to be valid by construction.
 *
 * These functions take the flag's already-slugified identifier rather than
 * deriving it, so this module stays a leaf and the slugifier can live beside
 * the label logic in renpyExport.
 */

export type VNFlagKind = 'bool' | 'counter';

export interface VNFlag {
    id: string;
    /** Author-facing name. Slugified into an identifier before emission. */
    name: string;
    kind: VNFlagKind;
    /** Starting value. Booleans use 0 for off, anything else for on. */
    initial: number;
}

/** What a choice does to state when it is taken. */
export interface VNEffect {
    flagId: string;
    op: 'set' | 'clear' | 'add';
    /** Used by 'add'. Negative subtracts. Defaults to 1. */
    value?: number;
}

/** Whether a choice is offered at all. */
export interface VNCondition {
    flagId: string;
    op: 'is' | 'not' | 'atLeast' | 'atMost';
    /** Used by 'atLeast' and 'atMost'. */
    value?: number;
}

/**
 * The `default` line declaring a flag. Ren'Py's docs ask for one per variable
 * that changes, so a value from an old save cannot leak into a new game.
 */
export function formatDefault(flag: VNFlag, identifier: string): string {
    const value = flag.kind === 'bool'
        ? (flag.initial ? 'True' : 'False')
        : `${flag.initial}`;
    return `default ${identifier} = ${value}`;
}

/** The inline Python statement a choice runs when taken. */
export function formatEffect(effect: VNEffect, identifier: string): string {
    switch (effect.op) {
        case 'set': return `$ ${identifier} = True`;
        case 'clear': return `$ ${identifier} = False`;
        case 'add': return `$ ${identifier} += ${effect.value ?? 1}`;
    }
}

/** The guard expression for a menu choice, without the leading `if`. */
export function formatCondition(condition: VNCondition, identifier: string): string {
    switch (condition.op) {
        case 'is': return identifier;
        case 'not': return `not ${identifier}`;
        case 'atLeast': return `${identifier} >= ${condition.value ?? 1}`;
        case 'atMost': return `${identifier} <= ${condition.value ?? 0}`;
    }
}
