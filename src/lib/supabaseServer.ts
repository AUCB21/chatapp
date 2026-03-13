import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client.
 * Uses the anon key + cookie-based session — respects RLS.
 * Use this in API routes and Server Components.
 */
export async function createSupabaseServer() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Provide clear error message for runtime
    const error = new Error(
      "Missing Supabase environment variables. " +
      "Please set SUPABASE_URL and SUPABASE_ANON_KEY (or fallback NEXT_PUBLIC equivalents) in your Vercel project settings: " +
      "https://vercel.com/dashboard -> Your Project -> Settings -> Environment Variables"
    );
    console.error("[Supabase] Configuration error:", error.message);
    throw error;
  }

  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookie writes are a no-op here
          }
        },
      },
    }
  );
}

/**
 * Retrieves the authenticated user from the current session.
 * Returns null if unauthenticated — never throws.
 */
export async function getAuthUser() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
