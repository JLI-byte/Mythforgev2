"use client";

import { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore, partializeWorkspace, type WorkspaceState } from '@/store/workspaceStore';
import { loadWorkspace, saveWorkspace } from './workspaceSync';
import { logger } from '@/lib/logger';
import { migrateWorkspaceSchema } from '@/store/migrateWorkspaceSchema';
import {
  countContent, looksLikeWorkspace, newestContentTime, resolveWorkspaceConflict,
} from '@/lib/workspaceConflict';
import { isForeignWorkspace } from '@/lib/workspaceOwner';
import { shouldSaveToCloud } from '@/lib/syncGate';

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
  // The server stamp of the row this client last read or wrote. Zero means we
  // have never seen a row, which is the only case where a blind upsert is safe.
  const remoteUpdatedAtRef = useRef(0);

  const setHasHydrated = useWorkspaceStore(s => s.setHasHydrated);

  // 1. Conflict-safe cloud hydration
  useEffect(() => {
    async function hydrate() {
      if (!userId || userId.trim() === '') return;

      const claimWorkspace = useWorkspaceStore.getState().claimWorkspace;
      const resetWorkspace = useWorkspaceStore.getState().resetWorkspace;

      try {
        // LAYER 1 — the one that matters. Sign-out often never runs: a closed
        // tab, a crash, an expired session, or simply a second person opening
        // the same browser. Whatever is in localStorage is discarded here,
        // before a single byte of it can be read, merged or uploaded.
        const localOwner = useWorkspaceStore.getState().ownerUserId;
        if (isForeignWorkspace(localOwner, userId)) {
          logger.info('LoreCanvas Sync: persisted workspace belongs to another account — discarding');
          resetWorkspace();
        }

        const cloud = await loadWorkspace(userId);
        remoteUpdatedAtRef.current = cloud?.updatedAt ?? 0;

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

        // Whatever is in the store now is this user's: either it came from
        // their cloud row, or it is local work that survived the ownership
        // check above. Claim it BEFORE marking hydration OK, so the save gate
        // can never see hydrated-but-unclaimed state.
        claimWorkspace(userId);
        hydrationOkRef.current = true;
      } catch (err) {
        // A hydration failure must not brick the session: without the finally
        // below, hasHydrated stays false and cloud saves stay disabled.
        // hydrationOkRef stays false, so the gate still blocks an empty save.
        logger.error('LoreCanvas Sync: cloud hydration failed — continuing with local data', err);
        claimWorkspace(userId);
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
      const result = await saveWorkspace(userId, state, remoteUpdatedAtRef.current);

      if (result.ok) {
        remoteUpdatedAtRef.current = result.updatedAt;
        failureCountRef.current = 0;
        backoffUntilRef.current = 0;
        setStatus('saved');
        return true;
      }

      if (result.conflict) {
        // Somebody else wrote this row. Re-read it and let the same rules that
        // run on hydrate decide, instead of retrying the write that just lost.
        const cloud = await loadWorkspace(userId);
        remoteUpdatedAtRef.current = cloud?.updatedAt ?? 0;
        if (cloud && looksLikeWorkspace(cloud.data)) {
          const localState = useWorkspaceStore.getState() as Record<string, any>;
          const { takeCloud, reason } = resolveWorkspaceConflict(localState, cloud.data);
          if (takeCloud) {
            useWorkspaceStore.setState(migrateWorkspaceSchema(cloud.data));
            logger.info(`LoreCanvas Sync: adopted the newer cloud workspace after a write conflict (${reason})`);
          } else {
            logger.info(`LoreCanvas Sync: keeping local after a write conflict (${reason}) — will retry`);
          }
        }
        setStatus('syncing');
        return false;
      }

      if (result.tooLarge) {
        // Not a transient failure, so it must not enter the retry backoff: the
        // workspace is over the cloud limit and will be over it on the next
        // attempt too. Backing off would then delay the FIRST successful sync
        // after the writer shrinks it by up to five minutes. The banner has
        // already told them what to do; local saving is untouched.
        setStatus('error');
        return false;
      }

      failureCountRef.current += 1;
      const wait = Math.min(
        BACKOFF_MAX_MS,
        BACKOFF_BASE_MS * 2 ** (failureCountRef.current - 1),
      );
      backoffUntilRef.current = Date.now() + wait;
      if (failureCountRef.current === 3) {
        logger.error('LoreCanvas Sync: repeated save failures — backing off retries');
      }
      setStatus('error');
      return false;
    };

    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      if (isInitialLoadRef.current) return;

      // Never write state that is not provably this user's, and never let an
      // empty workspace reach the cloud when we could not read what is already
      // there — that is how a transient network failure wipes an account.
      const gate = {
        hydrationOk: hydrationOkRef.current,
        stateOwnerUserId: (state as unknown as { ownerUserId?: string | null }).ownerUserId,
        currentUserId: userId,
        contentCount: countContent(state as unknown as Record<string, unknown>),
      };
      if (!shouldSaveToCloud(gate)) {
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
