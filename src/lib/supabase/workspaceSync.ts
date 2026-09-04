import { createClient } from './client';
import { logger } from '@/lib/logger';

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
 */
export type SaveResult =
  | { ok: true; updatedAt: number }
  | { ok: false; conflict: true; remoteUpdatedAt: number }
  | { ok: false; conflict: false };

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
 */
export async function saveWorkspace(
  userId: string,
  data: Record<string, any>,
  expectedUpdatedAt: number,
): Promise<SaveResult> {
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
