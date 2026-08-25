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

export type VNBoxKind = 'story' | 'season' | 'episode' | 'decision';

export interface VNBox {
    id: string;
    kind: VNBoxKind;
    parentId?: string;
    title: string;
    /** Drawn as a title bar only, with no contents. */
    collapsed: boolean;
    x: number; y: number; width: number; height: number;
}

export interface VNFocus {
    kind: 'season' | 'episode';
    id: string;
}

/** The lane episodes fall into with no season, or one that was deleted. */
export const UNSORTED_SEASON_ID = '__unsorted__';
/** The single outermost box. */
export const STORY_BOX_ID = '__story__';

const PAD = 24;
const SEASON_HEADER = 40;
const EPISODE_HEADER = 32;
const DECISION_H = 28;
const GAP = 16;
const SEASON_GAP = 28;
const COLLAPSED_H = 44;
const SEASON_W = 1160;
const EP_SCAN_W = 208;
const EP_SCAN_H = 116;
const EP_FOCUS_W = SEASON_W - PAD * 2;

function episodeHeight(episode: VNEpisode, expanded: boolean): number {
    if (!expanded) return COLLAPSED_H;
    return EPISODE_HEADER + (episode.decisions?.length ?? 0) * DECISION_H + PAD;
}

/**
 * Every box on the timeline, positioned. Parents are emitted before their
 * children so a parent drawn later cannot paint over them.
 *
 * With no focus, episodes wrap left-to-right so a season's shape reads at a
 * glance. With a focus, they stack vertically at full width — the same
 * structure, laid out for working rather than scanning.
 */
export function layoutTimeline(
    seasons: VNSeason[],
    episodes: VNEpisode[],
    focus?: VNFocus,
): VNBox[] {
    const known = new Set(seasons.map(s => s.id));
    const isUnsorted = (e: VNEpisode) => !e.seasonId || !known.has(e.seasonId);

    // Unsorted goes last, matching the order the exporter plays episodes in.
    // A map that showed these first while the script played them last would be
    // lying about the shape of the story, which is worse than either choice on
    // its own.
    const lanes: VNSeason[] = [
        ...[...seasons].sort((a, b) => a.order - b.order),
        ...(episodes.some(isUnsorted)
            ? [{ id: UNSORTED_SEASON_ID, title: 'Unsorted', order: Number.MAX_SAFE_INTEGER }]
            : []),
    ];

    const episodesIn = (laneId: string) =>
        episodes
            .filter(e => laneId === UNSORTED_SEASON_ID ? isUnsorted(e) : e.seasonId === laneId)
            .sort((a, b) => a.order - b.order);

    const focusedEpisode = focus?.kind === 'episode'
        ? episodes.find(e => e.id === focus.id)
        : undefined;

    const focusedLaneId = focus?.kind === 'season'
        ? focus.id
        : focusedEpisode
            ? (isUnsorted(focusedEpisode) ? UNSORTED_SEASON_ID : focusedEpisode.seasonId!)
            : undefined;

    const boxes: VNBox[] = [];
    let y = PAD;

    for (const lane of lanes) {
        if (focus && lane.id !== focusedLaneId) {
            boxes.push({
                id: lane.id, kind: 'season', title: lane.title,
                collapsed: true, x: PAD, y, width: SEASON_W, height: COLLAPSED_H,
            });
            y += COLLAPSED_H + SEASON_GAP;
            continue;
        }

        const eps = episodesIn(lane.id);
        const innerTop = y + SEASON_HEADER;
        const children: VNBox[] = [];
        let innerHeight = 0;

        if (!focus) {
            const perRow = Math.max(1, Math.floor((SEASON_W - PAD * 2 + GAP) / (EP_SCAN_W + GAP)));
            eps.forEach((ep, i) => {
                children.push({
                    id: ep.id, kind: 'episode', parentId: lane.id, title: ep.title,
                    collapsed: false,
                    x: PAD * 2 + (i % perRow) * (EP_SCAN_W + GAP),
                    y: innerTop + Math.floor(i / perRow) * (EP_SCAN_H + GAP),
                    width: EP_SCAN_W, height: EP_SCAN_H,
                });
            });
            const rows = Math.ceil(eps.length / perRow);
            innerHeight = rows ? rows * EP_SCAN_H + (rows - 1) * GAP : 0;
        } else {
            let ey = innerTop;
            for (const ep of eps) {
                const expanded = !focusedEpisode || focusedEpisode.id === ep.id;
                const height = episodeHeight(ep, expanded);

                children.push({
                    id: ep.id, kind: 'episode', parentId: lane.id, title: ep.title,
                    collapsed: !expanded,
                    x: PAD * 2, y: ey, width: EP_FOCUS_W, height,
                });

                if (focusedEpisode?.id === ep.id) {
                    [...(ep.decisions ?? [])]
                        .sort((a, b) => a.order - b.order)
                        .forEach((decision, i) => {
                            children.push({
                                id: decision.id, kind: 'decision', parentId: ep.id,
                                title: decision.prompt, collapsed: false,
                                x: PAD * 3,
                                y: ey + EPISODE_HEADER + i * DECISION_H,
                                width: EP_FOCUS_W - PAD * 2, height: DECISION_H,
                            });
                        });
                }

                ey += height + GAP;
            }
            innerHeight = eps.length ? ey - innerTop - GAP : 0;
        }

        const height = SEASON_HEADER + innerHeight + PAD;
        boxes.push({
            id: lane.id, kind: 'season', title: lane.title,
            collapsed: false, x: PAD, y, width: SEASON_W, height,
        });
        boxes.push(...children);

        y += height + SEASON_GAP;
    }

    const storyHeight = Math.max(lanes.length ? y - SEASON_GAP + PAD : PAD * 2, PAD * 2);

    return [
        {
            id: STORY_BOX_ID, kind: 'story', title: 'Story', collapsed: false,
            x: 0, y: 0, width: SEASON_W + PAD * 2, height: storyHeight,
        },
        ...boxes,
    ];
}
