import { createClient } from './client';
import { logger } from '@/lib/logger';
import {
  HARD_LIMIT_BYTES,
  describeWorkspaceSize,
  formatBytes,
  measureWorkspace,
  type SizeNotice,
  type WorkspaceSize,
} from '@/lib/workspaceSize';

/**
 * Workspace Sync Utilities
 *
 * Provides functions to load and save the Zustand workspace state
 * directly to the 'workspaces' table in Supabase.
 */

export interface LoadedWorkspace {
  data: Record<string, any>;
  /** Server-side last-write timestamp (ms since epoch), or 0 if unknown. */
  updatedAt: number;
}

/**
 * Loads the workspace data for a specific user.
 * Returns the data plus the server updated_at so callers can resolve
 * conflicts instead of blindly overwriting newer local work.
 * Falls back to null if no cloud data is found.
 */
export async function loadWorkspace(userId: string): Promise<LoadedWorkspace | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('workspaces')
      .select('data, updated_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // Ignore "no rows found" error
        logger.error('LoreCanvas Sync: Error loading workspace:', error.message);
      }
      return null;
    }

    if (!data?.data) return null;
    const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
    return { data: data.data, updatedAt };
  } catch (err) {
    logger.error('LoreCanvas Sync: Unexpected error loading workspace:', err);
    return null;
  }
}

/**
 * The outcome of a cloud write.
 *
 * `conflict` is deliberately distinct from a plain failure: a conflict means the
 * write was correctly refused and the caller must re-hydrate, while a failure
 * means it should be retried.
 *
 * `tooLarge` is the third refusal: the blob is over the hard size limit and was
 * never sent. It carries the measurement so the caller can say which part of
 * the workspace is responsible. Retrying it is pointless until the workspace
 * shrinks, but harmless — nothing was written and nothing was lost.
 */
export type SaveResult =
  | { ok: true; updatedAt: number }
  | { ok: false; conflict: true; remoteUpdatedAt: number }
  | { ok: false; conflict: false; tooLarge?: never }
  | { ok: false; conflict: false; tooLarge: true; size: WorkspaceSize };

/**
 * The current size notice, and a way to hear about the next one.
 *
 * A refusal nobody can see is worse than no limit at all: the writer would
 * believe they were synced. The save path has no React in it, so the notice is
 * published here and read by the banner through `useSyncExternalStore`. It is
 * one value, not a queue — the newest measurement is the only true one.
 */
let sizeNotice: SizeNotice | null = null;
const sizeNoticeListeners = new Set<() => void>();

function publishSizeNotice(next: SizeNotice | null) {
  // Compared, not just assigned: an unchanged notice must not re-render every
  // banner once per debounced save, and must not un-dismiss itself.
  if (next?.tone === sizeNotice?.tone && next?.headline === sizeNotice?.headline) return;
  sizeNotice = next;
  for (const listener of sizeNoticeListeners) listener();
}

/** The latest workspace-size notice, or null when there is nothing to say. */
export function getWorkspaceSizeNotice(): SizeNotice | null {
  return sizeNotice;
}

/** Server render has never measured anything, so it always has nothing to say. */
export function getServerWorkspaceSizeNotice(): SizeNotice | null {
  return null;
}

export function subscribeWorkspaceSizeNotice(listener: () => void): () => void {
  sizeNoticeListeners.add(listener);
  return () => {
    sizeNoticeListeners.delete(listener);
  };
}

/**
 * Measure before writing, and decide whether the write may happen at all.
 *
 * Returns the measurement when the blob is small enough to send (including the
 * over-soft-limit case, which warns and proceeds), or null when it is not.
 * A measurement that throws is not a reason to refuse a save — an unmeasurable
 * workspace is a bug in the measurement, not evidence of a huge workspace.
 */
function checkWorkspaceSize(data: Record<string, unknown>): WorkspaceSize | null {
  let measured: WorkspaceSize;
  try {
    measured = measureWorkspace(data);
  } catch (err) {
    logger.error('LoreCanvas Sync: could not measure the workspace', err);
    return null;
  }

  publishSizeNotice(describeWorkspaceSize(measured));

  if (measured.verdict === 'blocked') {
    logger.error(
      `LoreCanvas Sync: workspace is ${formatBytes(measured.totalBytes)}, over the ` +
      `${formatBytes(HARD_LIMIT_BYTES)} cloud limit - keeping local only. ` +
      `Largest part: ${measured.largest?.key} (${formatBytes(measured.largest?.bytes ?? 0)}).`,
    );
    return measured;
  }

  if (measured.verdict === 'warn') {
    logger.warn(
      `LoreCanvas Sync: workspace is ${formatBytes(measured.totalBytes)}, approaching the ` +
      `${formatBytes(HARD_LIMIT_BYTES)} cloud limit. ` +
      `Largest part: ${measured.largest?.key} (${formatBytes(measured.largest?.bytes ?? 0)}).`,
    );
  }
  return null;
}

/**
 * Writes the workspace, refusing to clobber a row that has moved since the copy
 * the caller hydrated from.
 *
 * `expectedUpdatedAt` is the server stamp of the row this client last read or
 * wrote. When it is greater than zero the write goes through a conditional
 * UPDATE … WHERE updated_at <= expected, which Postgres evaluates atomically:
 * a second tab or a second device that saved in the meantime makes the update
 * match zero rows, and the write is refused rather than silently winning.
 *
 * When it is zero this client has never seen a row — first sign-in on a new
 * device — and the upsert is correct.
 *
 * Refuses outright, before any network call, when the workspace is over the
 * hard size limit. The refusal is returned as `tooLarge`, logged, and published
 * as a notice the banner renders, so it can never pass for a successful sync.
 */
export async function saveWorkspace(
  userId: string,
  data: Record<string, any>,
  expectedUpdatedAt: number,
): Promise<SaveResult> {
  // Measure before the write. An unbounded blob is a database and a cost
  // problem, and the writer should hear about it before it becomes one. Past
  // the hard limit the cloud write is refused outright and said out loud;
  // local persistence is a different layer entirely and keeps running.
  const blocked = checkWorkspaceSize(data);
  if (blocked) {
    return { ok: false, conflict: false, tooLarge: true, size: blocked };
  }

  const nextIso = new Date().toISOString();
  try {
    const supabase = createClient();

    if (expectedUpdatedAt > 0) {
      const { data: rows, error } = await supabase
        .from('workspaces')
        .update({ data, updated_at: nextIso })
        .eq('user_id', userId)
        .lte('updated_at', new Date(expectedUpdatedAt).toISOString())
        .select('updated_at');

      if (error) {
        logger.error('LoreCanvas Sync: Error saving workspace:', error.message);
        return { ok: false, conflict: false };
      }
      if (rows && rows.length > 0) {
        return { ok: true, updatedAt: new Date(nextIso).getTime() };
      }

      // Zero rows means either somebody else wrote, or the row is gone.
      const { data: probe } = await supabase
        .from('workspaces')
        .select('updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (probe?.updated_at) {
        logger.warn('LoreCanvas Sync: cloud row moved since hydrate — refusing to overwrite');
        return {
          ok: false,
          conflict: true,
          remoteUpdatedAt: new Date(probe.updated_at).getTime(),
        };
      }
    }

    const { error } = await supabase
      .from('workspaces')
      .upsert(
        {
          user_id: userId,
          data,
          updated_at: nextIso,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      logger.error('LoreCanvas Sync: Error saving workspace:', error.message);
      return { ok: false, conflict: false };
    }
    return { ok: true, updatedAt: new Date(nextIso).getTime() };
  } catch (err) {
    logger.error('LoreCanvas Sync: Unexpected error saving workspace:', err);
    return { ok: false, conflict: false };
  }
}
