/**
 * Writing-zone selection — LEAF MODULE (no store or React import).
 *
 * Which chapter is open is remembered twice: the binder keeps it on its own
 * desk widget, and the rest of the app — Export, the Draft Table's "to the
 * Writing Desk", the command palette, Home's resume card — says it through the
 * store. Two memories of one fact drift. Build chapters from an outline and the
 * store moves while the binder stays on the empty chapter you started from, so
 * success looks exactly like failure.
 *
 * This decides, purely, when the binder should follow the store. The reverse
 * direction is a plain write: the binder tells the store on every pick.
 */

export interface ZoneSelection {
    documentId: string;
    sceneId: string;
}

export interface ActiveSelection {
    documentId: string | null;
    sceneId: string | null;
}

export interface SceneLike {
    id: string;
    documentId: string;
    order: number;
}

/**
 * Values the binder stores in place of a scene id: "show the whole chapter"
 * and "show the book information page". Neither is the store's business.
 */
const PSEUDO_SCENES = new Set(['all', 'cover']);

/**
 * What the binder should show, or null when it is already right.
 *
 * It follows the store only to a DIFFERENT chapter that still exists. Within
 * one chapter the binder keeps its own view, so changing scene in the desk
 * never yanks a writer out of the whole-chapter view.
 */
export function reconcileZoneSelection(
    zone: ZoneSelection,
    active: ActiveSelection,
    scenes: SceneLike[],
    documentIds: string[],
): ZoneSelection | null {
    const target = active.documentId;
    if (!target) return null;
    if (!documentIds.includes(target)) return null;
    if (target === zone.documentId) return null;

    const chapterScenes = scenes
        .filter(s => s.documentId === target)
        .slice()
        .sort((a, b) => a.order - b.order);

    const named = active.sceneId && !PSEUDO_SCENES.has(active.sceneId)
        ? chapterScenes.find(s => s.id === active.sceneId)
        : undefined;

    return {
        documentId: target,
        // A chapter with no scenes yet shows whole rather than pointing at nothing.
        sceneId: (named ?? chapterScenes[0])?.id ?? 'all',
    };
}
