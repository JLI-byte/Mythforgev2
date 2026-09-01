"use client";

import { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore, partializeWorkspace, type WorkspaceState } from '@/store/workspaceStore';
import { loadWorkspace, saveWorkspace } from './workspaceSync';
import { logger } from '@/lib/logger';
import { migrateWorkspaceSchema } from '@/store/migrateWorkspaceSchema';
import {
  countContent, looksLikeWorkspace, newestContentTime, resolveWorkspaceConflict,
} from '@/lib/workspaceConflict';

const SAVE_DEBOUNCE_MS = 800;
// After repeated save failures, stop hammering the endpoint (each attempt
// serialises the whole workspace on the main thread — visible as UI stutter).
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60_000;

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

/**
 * useSupabaseSync Hook
 *
 * 1. On mount: hydrates from Supabase only when resolveWorkspaceConflict says
 *    the cloud copy should win, so a stale or empty cloud row can never clobber
 *    local writing.
 * 2. On change: debounces the store to Supabase and tracks success/failure.
 * 3. On tab hide / unload: flushes a final save so the last edits aren't lost.
 */
export function useSupabaseSync(userId: string) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const latestStateRef = useRef<Record<string, any> | null>(null);
  const failureCountRef = useRef(0);
  const backoffUntilRef = useRef(0);
  // False until a cloud read actually succeeds. Guards the one write that can
  // destroy a whole account: pushing a freshly-seeded empty workspace over real
  // cloud content because the read failed and local looked blank.
  const hydrationOkRef = useRef(false);

  const setHasHydrated = useWorkspaceStore(s => s.setHasHydrated);

  // 1. Conflict-safe cloud hydration
  useEffect(() => {
    async function hydrate() {
      if (!userId || userId.trim() === '') return;

      try {
        const cloud = await loadWorkspace(userId);

        hydrationOkRef.current = true;

        if (cloud && looksLikeWorkspace(cloud.data)) {
          const localState = useWorkspaceStore.getState() as Record<string, any>;
          const { takeCloud, reason } = resolveWorkspaceConflict(localState, cloud.data);

          if (takeCloud) {
            // Cloud blobs bypass zustand's persist migrate — apply schema
            // migrations here. Idempotent, so double-migration is harmless.
            useWorkspaceStore.setState(migrateWorkspaceSchema(cloud.data));
            logger.info(`LoreCanvas Sync: applied cloud workspace (${reason})`);
          } else {
            logger.info(
              `LoreCanvas Sync: keeping local workspace (${reason}) — ` +
              `local ${countContent(localState)} items @ ${new Date(newestContentTime(localState)).toISOString()}, ` +
              `cloud ${countContent(cloud.data)} items @ ${new Date(newestContentTime(cloud.data)).toISOString()}`,
            );
          }
        } else if (cloud) {
          logger.error('LoreCanvas Sync: cloud workspace failed validation — ignoring');
        }
      } catch (err) {
        // A hydration failure must not brick the session: without the finally
        // below, hasHydrated stays false and cloud saves stay disabled.
        logger.error('LoreCanvas Sync: cloud hydration failed — continuing with local data', err);
      } finally {
        setHasHydrated(true);
        isInitialLoadRef.current = false;
      }
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
      if (ok) {
        failureCountRef.current = 0;
        backoffUntilRef.current = 0;
      } else {
        failureCountRef.current += 1;
        const wait = Math.min(
          BACKOFF_MAX_MS,
          BACKOFF_BASE_MS * 2 ** (failureCountRef.current - 1),
        );
        backoffUntilRef.current = Date.now() + wait;
        if (failureCountRef.current === 3) {
          logger.error('LoreCanvas Sync: repeated save failures — backing off retries');
        }
      }
      setStatus(ok ? 'saved' : 'error');
      return ok;
    };

    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      if (isInitialLoadRef.current) return;

      // Never let an empty workspace reach the cloud when we could not read what
      // is already there — that is how a transient network failure turns into a
      // wiped account. Real local content still syncs normally.
      if (!hydrationOkRef.current && countContent(state as unknown as Record<string, unknown>) === 0) {
        logger.error('LoreCanvas Sync: cloud read failed and local is empty — suppressing save to avoid overwriting cloud data');
        return;
      }

      // Sync only the persisted subset — same shape the local persist layer uses.
      latestStateRef.current = partializeWorkspace(state as WorkspaceState) as Record<string, any>;

      // During failure backoff, keep tracking the latest state (the exit flush
      // still uses it) but don't schedule another doomed save attempt.
      if (Date.now() < backoffUntilRef.current) return;

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
