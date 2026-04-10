"use client";

import { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { loadWorkspace, saveWorkspace } from './workspaceSync';

/**
 * useSupabaseSync Hook
 * 
 * Orchestrates the lifecycle of cloud synchronization.
 * 1. On mount: Hydrates the store from Supabase (falling back to localStorage).
 * 2. On change: Debounces the full store state to Supabase after 800ms of inactivity.
 * 
 * Creator: Antigravity
 */
export function useSupabaseSync(userId: string) {
  const [isSyncing, setIsSyncing] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // Zustand State & Setters
  const setHasHydrated = useWorkspaceStore(s => s.setHasHydrated);

  // 1. Initial Cloud Hydration
  useEffect(() => {
    async function hydrate() {
      if (!userId || userId.trim() === '') return;
      
      const cloudData = await loadWorkspace(userId);
      
      if (cloudData) {
        // Overwrites the local store state with the authenticated user's cloud data to ensure cross-device consistency.
        // This will trigger local persistence (localStorage) as well.
        useWorkspaceStore.setState(cloudData);
      }
      
      // Mark as hydrated regardless of source (localStorage or Cloud)
      setHasHydrated(true);
      isInitialLoadRef.current = false;
    }

    hydrate();
  }, [userId, setHasHydrated]);

  // 2. Debounced Cloud Save
  useEffect(() => {
    if (!userId || userId.trim() === '') return;

    // Subscribe to ALL state changes
    const unsubscribe = useWorkspaceStore.subscribe((state) => {
      // Skip the save if we are still performing the initial cloud load
      if (isInitialLoadRef.current) return;

      // Logic: Wait for 800ms of inactivity before saving
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        setIsSyncing(true);
        
        // We only save the fields that are marked for persistence in the store's partialize.
        // For simplicity and alignment with requirements, we send the whole state 
        // as Zustand's persist middleware would.
        // Note: In a real production app, one might use partialize() here too.
        await saveWorkspace(userId, state);
        
        setIsSyncing(false);
        saveTimeoutRef.current = null;
      }, 800);
    });

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [userId]);

  return { isSyncing };
}
