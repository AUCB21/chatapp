"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabaseClient";

/**
 * Waits for the Supabase client to have a valid auth session.
 * Realtime subscriptions must NOT be created until this returns true,
 * otherwise RLS policies will silently block all events.
 */
export function useSupabaseAuth() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();

    // Listen for auth state changes (initial restore from localStorage, refreshes, sign-outs)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsReady(true);
      } else if (event === "SIGNED_OUT") {
        setIsReady(false);
      }
    });

    // Check immediately in case the session was already restored
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return isReady;
}
