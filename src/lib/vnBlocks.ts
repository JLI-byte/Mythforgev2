/**
 * Blocks — the beats a visual novel branch map is drawn from, and the adapter
 * that turns them back into the flat scene list the Ren'Py exporter eats.
 * LEAF MODULE (no store, no React).
 *
 * A block is a run of scenes that plays straight through, ending at a decision.
 * Storing choices on the block rather than a scene means adding a scene to a
 * beat cannot move the decision to the wrong place.
 *
 * The exporter is untouched by all of this. Scenes inside a block chain by
 * themselves, because a scene with no choices already emits a jump to the next
 * scene by order — so flattening only has to put each block's choices on its
 * last scene and point them at the target block's first.
 */

import type { VNChoice, VNScene } from './visualNovel';
import type { VNEffect, VNCondition } from './vnFlags';

/** A choice as drafted on the map: it targets a block, not a scene. */
export interface VNBlockChoice {
    id: string;
    text: string;
    targetBlockId: string;
    effects?: VNEffect[];
    condition?: VNCondition;
}

/** A beat on the branch map. Backed by a Document in the store. */
export interface VNBlock {
    id: string;
    title: string;
    order: number;
    choices?: VNBlockChoice[];
}

/**
 * Blocks and their scenes as one ordered scene list.
 *
 * Empty blocks are drafting placeholders rather than story beats, so they are
 * dropped and anything aiming at one is re-pointed at the next block that has
 * scenes. A choice with nowhere left to go gets an empty target, which
 * buildRenpyScript already renders as a comment and `return`.
 */
export function flattenBlocksToScenes(
    blocks: VNBlock[],
    scenesByBlock: Map<string, VNScene[]>,
): VNScene[] {
    const ordered = [...blocks].sort((a, b) => a.order - b.order);

    const scenesFor = (blockId: string): VNScene[] =>
        [...(scenesByBlock.get(blockId) ?? [])].sort((a, b) => a.order - b.order);

    // Block id → the scene a jump into it should land on. An empty block
    // forwards to whatever comes next, so a placeholder never breaks a branch.
    const entryScene = new Map<string, string>();
    let carried: string[] = [];
    for (const b of ordered) {
        const first = scenesFor(b.id)[0];
        if (first) {
            entryScene.set(b.id, first.id);
            for (const pending of carried) entryScene.set(pending, first.id);
            carried = [];
        } else {
            carried.push(b.id);
        }
    }
    for (const pending of carried) entryScene.set(pending, '');

    const out: VNScene[] = [];
    let order = 0;

    for (const b of ordered) {
        const scenes = scenesFor(b.id);
        if (!scenes.length) continue;

        scenes.forEach((scene, index) => {
            const isLast = index === scenes.length - 1;
            const choices: VNChoice[] | undefined = isLast && b.choices?.length
                ? b.choices.map(c => ({
                    id: c.id,
                    text: c.text,
                    targetSceneId: entryScene.get(c.targetBlockId) ?? '',
                    effects: c.effects,
                    condition: c.condition,
                }))
                : undefined;

            out.push({ ...scene, order: order++, choices });
        });
    }

    return out;
}
