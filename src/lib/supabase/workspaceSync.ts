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
 * Upserts the workspace data to Supabase.
 * Returns true on success, false on failure, so callers can surface a
 * sync-failed state instead of silently losing the write.
 */
export async function saveWorkspace(userId: string, data: Record<string, any>): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('workspaces')
      .upsert(
        {
          user_id: userId,
          data,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      logger.error('LoreCanvas Sync: Error saving workspace:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('LoreCanvas Sync: Unexpected error saving workspace:', err);
    return false;
  }
}
