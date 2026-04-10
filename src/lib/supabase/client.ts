import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase Client (Browser)
 * 
 * This client is used for client-side interactions with Supabase.
 * It is a singleton that should be used in Client Components.
 * 
 * Creator: Antigravity
 */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
