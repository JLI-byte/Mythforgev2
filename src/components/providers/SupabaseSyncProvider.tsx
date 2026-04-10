"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSupabaseSync } from '@/lib/supabase/useSupabaseSync';

/**
 * SupabaseSyncProvider
 * 
 * A transparent wrapper that detects the authenticated user and
 * initializes the cloud-sync hook. 
 * 
 * Renders children immediately and always, ensuring no UI disruption
 * during authentication checks or synchronization.
 * 
 * Creator: Antigravity
 */
export function SupabaseSyncProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    
    checkUser();

    // Listen for auth state changes (e.g. login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Activate the sync logic if a user is present
  // Note: the hook handles its own mounting/unmounting logic
  useSupabaseSync(userId || '');

  return <>{children}</>;
}
