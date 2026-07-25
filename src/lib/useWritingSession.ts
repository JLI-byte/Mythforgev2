import { useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';

const AUTO_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Writing-session tracking — feeds the Goals/streak system and Version History.
 *
 * Baselines live at MODULE scope, not in component refs: the editor unmounts
 * whenever the writer switches to Home, the World Bible, or another scene, and
 * per-component refs meant every return re-baselined at the current word count
 * and silently recorded zero words for that session.
 *
 * Baselines are also seeded when a scene loads (see `useSeedWritingBaseline`)
 * rather than at the first keystroke, so words typed before the editor's first
 * debounced save still count.
 */

/** Words a scene had when we started watching it, keyed by scene id. */
const baselines = new Map<string, number>();
/** When the current stretch of writing on that scene began. */
const starts = new Map<string, number>();
/** Last auto-snapshot time per scene. */
const lastAuto = new Map<string, number>();

export interface SessionDelta {
    wordsAdded: number;
    minutesSpent: number;
}

/**
 * Record that we're now watching `sceneId`, which currently has `wordCount`
 * words. No-op if the scene already has a baseline, so remounting mid-session
 * doesn't discard progress.
 */
export function seedWritingBaseline(sceneId: string, wordCount: number, now: number = Date.now()): void {
    if (!sceneId || baselines.has(sceneId)) return;
    baselines.set(sceneId, wordCount);
    starts.set(sceneId, now);
}

/**
 * Advance the baseline for a scene and return the delta to record, or null
 * when nothing new was written. Touches only the module-level session maps.
 */
export function nextSessionDelta(sceneId: string, wordCount: number, now: number): SessionDelta | null {
    if (!sceneId) return null;

    if (!baselines.has(sceneId)) {
        // First sighting without a seed — start from here rather than counting
        // the whole existing scene as freshly written.
        baselines.set(sceneId, wordCount);
        starts.set(sceneId, now);
        return null;
    }

    const baseline = baselines.get(sceneId) ?? wordCount;
    const wordsAdded = Math.max(wordCount - baseline, 0);

    if (wordsAdded <= 0) {
        // Deleting text moves the baseline down, so re-typing isn't counted twice.
        if (wordCount < baseline) baselines.set(sceneId, wordCount);
        return null;
    }

    const start = starts.get(sceneId) ?? now;
    const minutesSpent = Math.max(Math.round((now - start) / 60000), 1);
    baselines.set(sceneId, wordCount);
    starts.set(sceneId, now);
    return { wordsAdded, minutesSpent };
}

/** True when the scene is due another automatic snapshot (and marks it taken). */
export function shouldAutoSnapshot(sceneId: string, now: number, wordCount: number): boolean {
    if (wordCount <= 0) return false;
    const last = lastAuto.get(sceneId) ?? 0;
    if (now - last <= AUTO_SNAPSHOT_INTERVAL_MS) return false;
    lastAuto.set(sceneId, now);
    return true;
}

/** Test helper — clears all in-memory session state. */
export function __resetWritingSession(): void {
    baselines.clear();
    starts.clear();
    lastAuto.clear();
}

/**
 * Seed the baseline for a scene as soon as its editor is ready, so words typed
 * before the first debounced save are counted. Safe to call every render —
 * seeding happens once per scene.
 */
export function useSeedWritingBaseline(sceneId: string | null | undefined, wordCount: number | undefined): void {
    useEffect(() => {
        if (!sceneId || wordCount === undefined) return;
        seedWritingBaseline(sceneId, wordCount);
    }, [sceneId, wordCount]);
}

/**
 * Returns `track(sceneId, wordCount, now)` for the editors' debounced onUpdate.
 * Records only the delta of words added, and takes an automatic snapshot at
 * most once every 5 minutes per scene.
 */
export function useWritingSession() {
    const recordWritingSession = useWorkspaceStore(s => s.recordWritingSession);
    const saveSceneSnapshot = useWorkspaceStore(s => s.saveSceneSnapshot);

    return function track(sceneId: string, wordCount: number, now: number) {
        const projectId = useWorkspaceStore.getState().activeProjectId;
        if (!projectId || !sceneId) return;

        const delta = nextSessionDelta(sceneId, wordCount, now);
        if (delta) {
            recordWritingSession(projectId, delta.wordsAdded, delta.minutesSpent);
        }

        if (shouldAutoSnapshot(sceneId, now, wordCount)) {
            const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            saveSceneSnapshot(sceneId, `Auto — ${timeStr}`, true);
        }
    };
}
