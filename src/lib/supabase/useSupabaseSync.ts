"use client";

import { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { loadWorkspace, saveWorkspace } from './workspaceSync';
import { logger } from '@/lib/logger';

const SAVE_DEBOUNCE_MS = 800;

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

/**
 * Returns the most recent content timestamp (ms) across a workspace blob —
 * used to decide which copy (local vs cloud) holds the newer writing.
 */
function newestContentTime(state: Record<string, any> | null | undefined): number {
  if (!state) return 0;
  let newest = 0;
  for (const key of ['projects', 'documents', 'scenes', 'entities']) {
    const arr = state[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const t = item?.updatedAt ?? item?.createdAt;
      if (t) {
        const ms = new Date(t).getTime();
        if (ms > newest) newest = ms;
      }
    }
  }
  return newest;
}

/** Cheap structural guard so we never setState a malformed/hostile cloud blob. */
function looksLikeWorkspace(data: unknown): data is Record<string, any> {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  // Every persisted core collection, when present, must be an array.
  return ['projects', 'documents', 'scenes', 'entities'].every(
    k => d[k] === undefined || Array.isArray(d[k])
  );
}

/**
 * useSupabaseSync Hook
 *
 * 1. On mount: hydrates from Supabase ONLY when the cloud copy is newer than
 *    the local copy, so a stale cloud row never silently clobbers newer local
 *    writing (the previous behavior was an unconditional overwrite).
 * 2. On change: debounces the store to Supabase and tracks success/failure.
 * 3. On tab hide / unload: flushes a final save so the last edits aren't lost.
 */
export function useSupabaseSync(userId: string) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const latestStateRef = useRef<Record<string, any> | null>(null);

  const setHasHydrated = useWorkspaceStore(s => s.setHasHydrated);

  // 1. Conflict-safe cloud hydration
  useEffect(() => {
    async function hydrate() {
      if (!userId || userId.trim() === '') return;

      const cloud = await loadWorkspace(userId);

      if (cloud && looksLikeWorkspace(cloud.data)) {
        const localState = useWorkspaceStore.getState() as Record<string, any>;
        const localNewest = newestContentTime(localState);
        const cloudNewest = Math.max(newestContentTime(cloud.data), cloud.updatedAt);
        const localHasContent =
          Array.isArray(localState.projects) && localState.projects.length > 0;

        // Take the cloud copy only when local is empty or the cloud is newer.
        if (!localHasContent || cloudNewest > localNewest) {
          useWorkspaceStore.setState(cloud.data);
        } else {
          logger.info('MythForge Sync: local copy is newer — keeping local, skipping cloud overwrite');
        }
      } else if (cloud) {
        logger.error('MythForge Sync: cloud workspace failed validation — ignoring');
      }

      setHasHydrated(true);
      isInitialLoadRef.current = false;
    }

    hydrate();
  }, [userId, setHasHydrated]);

  // 2. Debounced cloud save (+ keep a ref to the latest state for flush-on-exit)
  useEffect(() => {
    if (!userId || userId.trim() === '') return;

    const flush = async () => {
      const state = latestStateRef.current;
      if (!state) return false;
      const ok = await saveWorkspace(userId, state);
      setStatus(ok ? 'saved' : 'error');
      return ok;
    };

    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      if (isInitialLoadRef.current) return;
      latestStateRef.current = state as Record<string, any>;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setStatus('syncing');
      saveTimeoutRef.current = setTimeout(async () => {
        await flush();
        saveTimeoutRef.current = null;
      }, SAVE_DEBOUNCE_MS);
    });

    // Flush the pending save when the tab is hidden or the app is closing,
    // closing the debounce gap that previously dropped the last edit.
    const handleExit = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        void flush();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handleExit();
    };
    window.addEventListener('pagehide', handleExit);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', handleExit);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [userId]);

  return { status, isSyncing: status === 'syncing' };
}
