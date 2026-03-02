import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side Supabase instance.
 * Used exclusively for Realtime subscriptions.
 * All data fetching goes through API routes.
 */

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get or create the Supabase client instance.
 * Lazily initialized on first use in the browser.
 * Safe to call during SSR - returns null which components should handle.
 */
function getSupabaseInstance(): SupabaseClient | null {
  // During SSR or build, return null
  if (typeof window === 'undefined') {
    return null;
  }

  // Return cached instance if already created
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Missing Supabase environment variables. " +
      "Check your Supabase project's API settings to find these values: " +
      "https://supabase.com/dashboard/project/_/settings/api\n" +
      "Required variables:\n" +
      "- NEXT_PUBLIC_SUPABASE_URL\n" +
      "- NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    return null;
  }

  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  console.log('[Supabase] Client initialized');
  return supabaseInstance;
}

/**
 * Get the Supabase client for use in components.
 * Returns the singleton instance, creating it on first call.
 * This function-based export ensures lazy initialization.
 */
export function getSupabase(): SupabaseClient {
  const instance = getSupabaseInstance();
  if (!instance) {
    throw new Error('Supabase client can only be used in the browser');
  }
  return instance;
}

/**
 * Direct export of Supabase client.
 * Uses getter to ensure it's created when accessed, not at module load time.
 * This ensures auth session from localStorage is available.
 * Components using this should be client-side only ("use client").
 */
let _supabase: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      if (typeof window === 'undefined') {
        throw new Error('Supabase client can only be used in the browser');
      }
      _supabase = getSupabaseInstance();
      if (!_supabase) {
        throw new Error('Failed to initialize Supabase client');
      }
    }
    return (_supabase as any)[prop];
  },
});
