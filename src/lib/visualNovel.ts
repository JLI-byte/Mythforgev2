/**
 * Visual novel branching — the choices that lead out of a scene, and the
 * checks worth running before export. LEAF MODULE (no store, no React).
 *
 * A visual novel is a graph, not a list: two choices routinely converge on one
 * scene. Scenes stay an ordered list and carry their outgoing edges, which is
 * exactly the shape Ren'Py wants — a label, a menu, and a jump per choice.
 */

/** One option in a scene's menu. */
export interface VNChoice {
    id: string;
    /** What the player sees. */
    text: string;
    /** Scene this jumps to. */
    targetSceneId: string;
    /** Flag set when this choice is taken. */
    setsFlag?: string;
    /** Choice is only shown when this flag is set. */
    requiresFlag?: string;
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

/**
 * Every flag mentioned anywhere, sorted and deduped. Ren'Py wants a `default`
 * line for each, so a value from an old save cannot leak into a new game.
 */
export function collectFlags(scenes: VNScene[]): string[] {
    const flags = new Set<string>();
    for (const scene of scenes) {
        for (const choice of scene.choices ?? []) {
            if (choice.setsFlag) flags.add(choice.setsFlag);
            if (choice.requiresFlag) flags.add(choice.requiresFlag);
        }
    }
    return [...flags].sort();
}
