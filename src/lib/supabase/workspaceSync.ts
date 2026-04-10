import { createClient } from './client';

/**
 * Workspace Sync Utilities
 * 
 * Provides functions to load and save the Zustand workspace state
 * directly to the 'workspaces' table in Supabase.
 * 
 * Creator: Antigravity
 */

/**
 * Loads the workspace data for a specific user.
 * Falls back to null if no cloud data is found, allowing the store
 * to rely on its native localStorage cache.
 */
export async function loadWorkspace(userId: string): Promise<Record<string, any> | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('workspaces')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // Ignore "no rows found" error
        console.error('MythForge Sync: Error loading workspace:', error.message);
      }
      return null;
    }

    return data?.data || null;
  } catch (err) {
    console.error('MythForge Sync: Unexpected error loading workspace:', err);
    return null;
  }
}

/**
 * Upserts the workspace data to Supabase.
 * Uses 'user_id' as the conflict target to ensure one row per user.
 */
export async function saveWorkspace(userId: string, data: Record<string, any>): Promise<void> {
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
      console.error('MythForge Sync: Error saving workspace:', error.message);
    }
  } catch (err) {
    console.error('MythForge Sync: Unexpected error saving workspace:', err);
  }
}
