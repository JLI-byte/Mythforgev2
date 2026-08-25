/**
 * The visual novel timeline's shape and geometry — Story containing Seasons
 * containing Episodes containing Decisions. LEAF MODULE (no store, no React).
 *
 * Layout is computed from the structure on every render and never stored, so
 * the map cannot drift from the story. Focus changes the geometry rather than
 * only the styling: episodes flow left-to-right while scanning, and stack
 * vertically at full width once a season is focused, which is where writing
 * room is wanted.
 */

import type { VNEffect, VNCondition } from './vnFlags';

export interface VNSeason {
    id: string;
    title: string;
    order: number;
}

/** One branch of a decision. */
export interface VNOption {
    id: string;
    text: string;
    effects?: VNEffect[];
    condition?: VNCondition;
    /**
     * Cross-episode route. Undefined means rejoin and carry on, which is the
     * default and the common case. Only ever set on a major decision.
     */
    routeToEpisodeId?: string;
}

export interface VNDecision {
    id: string;
    /** Major decisions may route to another episode; minor ones never can. */
    kind: 'major' | 'minor';
    /** What the player is deciding. */
    prompt: string;
    order: number;
    options: VNOption[];
}

/**
 * The slice of a Document the timeline needs. Declared structurally so this
 * stays a leaf the store can import, never the reverse.
 */
export interface VNEpisode {
    id: string;
    title: string;
    seasonId?: string;
    order: number;
    decisions?: VNDecision[];
}

export type VNTier = 'story' | 'season' | 'episode' | 'decision';

/**
 * How much detail a box should draw, from the canvas zoom. The canvas runs
 * 0.2 to 2.0; values outside that clamp rather than falling through.
 */
export function tierForZoom(zoom: number): VNTier {
    if (zoom < 0.35) return 'story';
    if (zoom < 0.65) return 'season';
    if (zoom < 1.1) return 'episode';
    return 'decision';
}
