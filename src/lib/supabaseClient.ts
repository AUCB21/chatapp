import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side Supabase instance.
 * Used exclusively for Realtime subscriptions.
 * All data fetching goes through API routes.
 * 
 * Uses createBrowserClient which automatically reads session from cookies.
 */

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get or create the Supabase client instance.
 * Lazily initialized on first access in the browser.
 */
export function getSupabase(): SupabaseClient {
  // Only initialize in the browser
  if (typeof window === 'undefined') {
    throw new Error('Supabase client can only be used in the browser');
  }

  // Return cached instance if already created
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. " +
      "Check your Supabase project's API settings to find these values: " +
      "https://supabase.com/dashboard/project/_/settings/api\n" +
      "Required variables:\n" +
      "- NEXT_PUBLIC_SUPABASE_URL\n" +
      "- NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  console.log('[Supabase] Client initialized with cookie-based auth');
  return supabaseInstance;
}

// Direct export for convenience - safe because it's only evaluated in browser
export const supabase = typeof window !== 'undefined' ? getSupabase() : ({} as SupabaseClient);
