import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase instance.
 * Used exclusively for Realtime subscriptions.
 * All data fetching goes through API routes.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
