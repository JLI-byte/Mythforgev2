import { useRef } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';

const AUTO_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * useWritingSession — reconnects the Goals/streak system and Version History to
 * the active editor. Both the Writing Desk editor and the Screenplay editor call
 * the returned `track(sceneId, wordCount)` from their debounced onUpdate.
 *
 * It records only the *delta* of words added since the last call (so streaks and
 * heatmaps reflect real activity, not absolute counts) and takes an automatic
 * snapshot at most once every 5 minutes per scene.
 */
export function useWritingSession() {
    const recordWritingSession = useWorkspaceStore(s => s.recordWritingSession);
    const saveSceneSnapshot = useWorkspaceStore(s => s.saveSceneSnapshot);

    // Per-scene baselines so switching scenes doesn't leak word deltas.
    const baselineRef = useRef<Record<string, number>>({});
    const startRef = useRef<Record<string, number>>({});
    const lastAutoRef = useRef<Record<string, number>>({});

    return function track(sceneId: string, wordCount: number, now: number) {
        const projectId = useWorkspaceStore.getState().activeProjectId;
        if (!projectId || !sceneId) return;

        // Establish a baseline the first time we see this scene this session.
        if (baselineRef.current[sceneId] === undefined) {
            baselineRef.current[sceneId] = wordCount;
            startRef.current[sceneId] = now;
        }

        const wordsAdded = Math.max(wordCount - baselineRef.current[sceneId], 0);
        if (wordsAdded > 0) {
            const minutesSpent = Math.max(Math.round((now - (startRef.current[sceneId] ?? now)) / 60000), 1);
            recordWritingSession(projectId, wordsAdded, minutesSpent);
            baselineRef.current[sceneId] = wordCount;
            startRef.current[sceneId] = now;
        }

        // Auto-snapshot at most once per interval per scene.
        const lastAuto = lastAutoRef.current[sceneId] || 0;
        if (now - lastAuto > AUTO_SNAPSHOT_INTERVAL_MS && wordCount > 0) {
            const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            saveSceneSnapshot(sceneId, `Auto — ${timeStr}`, true);
            lastAutoRef.current[sceneId] = now;
        }
    };
}
