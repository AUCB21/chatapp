import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase instance.
 * Used exclusively for Realtime subscriptions.
 * All data fetching goes through API routes.
 */

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Only throw error if we're actually in the browser and missing vars
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    "Missing Supabase environment variables. " +
    "Check your Supabase project's API settings to find these values: " +
    "https://supabase.com/dashboard/project/_/settings/api\n" +
    "Required variables:\n" +
    "- NEXT_PUBLIC_SUPABASE_URL\n" +
    "- NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export const supabase = createBrowserClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);
