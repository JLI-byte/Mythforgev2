/**
 * A manuscript measured in its own units — LEAF MODULE (no store, no React).
 *
 * Words per day tells a writer whether they sat down. It does not tell them
 * whether the book exists. A story is built of chapters and scenes, so that is
 * what gets counted here: how many scenes have prose in them, and how many
 * chapters those scenes add up to.
 *
 * Word totals come from Scene.wordCount, which the editor writes on every
 * debounced save — no re-counting, and no dependence on the writingDays log,
 * which only knows about days the goals system was watching.
 */

export interface ProgressInput {
    projectId: string;
    documents: { id: string; projectId: string }[];
    scenes: { id: string; projectId: string; documentId: string; content: string; wordCount?: number }[];
}

export interface StructuralProgress {
    chapters: number;
    chaptersStarted: number;
    scenes: number;
    scenesStarted: number;
    words: number;
    /** Scenes with prose over scenes that exist. 0 when there are none. */
    fraction: number;
}

/** True when a scene holds words rather than empty editor markup. */
export function hasProse(content: string): boolean {
    if (!content) return false;
    return content
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim()
        .length > 0;
}

/** Chapter and scene counts for one project. */
export function projectProgress(input: ProgressInput): StructuralProgress {
    const docs = input.documents.filter(d => d.projectId === input.projectId);
    const scenes = input.scenes.filter(s => s.projectId === input.projectId);

    const startedDocIds = new Set<string>();
    let scenesStarted = 0;
    let words = 0;

    for (const s of scenes) {
        words += s.wordCount ?? 0;
        if (!hasProse(s.content)) continue;
        scenesStarted += 1;
        startedDocIds.add(s.documentId);
    }

    return {
        chapters: docs.length,
        chaptersStarted: docs.filter(d => startedDocIds.has(d.id)).length,
        scenes: scenes.length,
        scenesStarted,
        words,
        fraction: scenes.length > 0 ? scenesStarted / scenes.length : 0,
    };
}

const plural = (n: number, one: string) => (n === 1 ? one : `${one}s`);

/** One line a writer can read at a glance, in the unit the work uses. */
export function progressLine(p: StructuralProgress): string {
    if (p.scenes === 0) return 'No scenes yet';
    return `${p.scenesStarted} of ${p.scenes} ${plural(p.scenes, 'scene')} drafted`
        + ` · ${p.chaptersStarted} of ${p.chapters} ${plural(p.chapters, 'chapter')} started`;
}
