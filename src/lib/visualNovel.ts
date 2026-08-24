/**
 * Visual novel branching — the choices that lead out of a scene, and the
 * checks worth running before export. LEAF MODULE (no store, no React).
 *
 * A visual novel is a graph, not a list: two choices routinely converge on one
 * scene. Scenes stay an ordered list and carry their outgoing edges, which is
 * exactly the shape Ren'Py wants — a label, a menu, and a jump per choice.
 */

import type { VNEffect, VNCondition } from './vnFlags';

/** One option in a scene's menu. */
export interface VNChoice {
    id: string;
    /** What the player sees. */
    text: string;
    /** Scene this jumps to. */
    targetSceneId: string;
    /** What taking this choice does to story state. */
    effects?: VNEffect[];
    /** Choice is only offered when this holds. */
    condition?: VNCondition;
}

/**
 * The slice of a Scene the visual novel code needs. Declared structurally so
 * these modules stay leaves — they never import the store.
 */
export interface VNScene {
    id: string;
    title: string;
    content: string;
    order: number;
    choices?: VNChoice[];
}

export type VNIssueKind =
    | 'broken-jump' | 'unreachable' | 'unsatisfiable-flag';

export interface VNIssue {
    kind: VNIssueKind;
    sceneId: string;
    message: string;
}

/**
 * Warnings worth showing before export — never blockers, so a work in progress
 * can always be exported.
 *
 * A scene with no choices falls through to the next by order, so it is only a
 * dead end when there is no next scene, and the scene after a choiceless one
 * is reachable even if nothing jumps to it.
 */
export function validateVisualNovel(scenes: VNScene[]): VNIssue[] {
    const ordered = [...scenes].sort((a, b) => a.order - b.order);
    const ids = new Set(ordered.map(s => s.id));
    const issues: VNIssue[] = [];

    const targeted = new Set<string>();
    const writtenFlags = new Set<string>();
    for (const scene of ordered) {
        for (const choice of scene.choices ?? []) {
            // A choice that targets its own scene doesn't make that scene
            // reachable — the scene still needs an incoming edge from elsewhere.
            if (choice.targetSceneId !== scene.id) targeted.add(choice.targetSceneId);
            for (const effect of choice.effects ?? []) writtenFlags.add(effect.flagId);
        }
    }

    ordered.forEach((scene, index) => {
        const choices = scene.choices ?? [];

        for (const choice of choices) {
            if (!ids.has(choice.targetSceneId)) {
                issues.push({
                    kind: 'broken-jump', sceneId: scene.id,
                    message: `“${choice.text}” points at a scene that no longer exists.`,
                });
            }
            if (choice.condition && !writtenFlags.has(choice.condition.flagId)) {
                issues.push({
                    kind: 'unsatisfiable-flag', sceneId: scene.id,
                    message: `“${choice.text}” depends on state that nothing sets.`,
                });
            }
        }

        const isFirst = index === 0;
        const fallsThroughToHere = index > 0 && !(ordered[index - 1].choices ?? []).length;
        if (!isFirst && !targeted.has(scene.id) && !fallsThroughToHere) {
            issues.push({
                kind: 'unreachable', sceneId: scene.id,
                message: `Nothing leads to “${scene.title}”.`,
            });
        }

        // There is deliberately no dead-end check. Fall-through means every
        // scene but the last leads somewhere, and a choiceless last scene is
        // how a visual novel is supposed to end — it compiles to `return`.
        // A dead end in this model cannot occur without also being correct.
    });

    return issues;
}
